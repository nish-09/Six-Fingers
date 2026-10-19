import asyncio
import random
import logging
import time
from typing import Optional, Any
from .models import BotProfile, BotDifficulty
from .config import bot_settings
from .engine import BotDecisionEngine
from .registry import bot_registry
from .banter import BotBanterEngine
from ..models.game import MatchPhase, DeliveryResult, ChatMessage
from ..engine.hand_cricket import HandCricketEngine

logger = logging.getLogger("six_fingers.bots.session")

class BotGameSession:
    """
    Manages the active lifecycle, toss calls, delivery submissions, and contextual
    live banter of a bot opponent inside an authoritative MatchRoom.
    """
    def __init__(
        self,
        room: Any, # MatchRoom
        bot_player_id: str,
        bot_profile: BotProfile,
        difficulty: BotDifficulty
    ):
        self.room = room
        self.bot_player_id = bot_player_id
        self.bot_profile = bot_profile
        self.difficulty = difficulty
        self.is_active = True
        self._current_task: Optional[asyncio.Task] = None
        self._banter_task: Optional[asyncio.Task] = None
        self._last_submitted_delivery_id: Optional[str] = None
        self.banter_engine = BotBanterEngine(bot_profile)

    def cancel_pending(self):
        """Cancels active pending game tasks safely."""
        if self._current_task and not self._current_task.done():
            self._current_task.cancel()
        self._current_task = None

    async def cleanup(self):
        """Releases the bot back to the registry and clears background tasks."""
        if not self.is_active:
            return
        self.is_active = False
        self.cancel_pending()
        if self._banter_task and not self._banter_task.done():
            self._banter_task.cancel()
            self._banter_task = None
        await bot_registry.release_bot(self.bot_profile.bot_id, self.room.room_code)
        logger.info(f"Bot session {self.bot_profile.bot_id} cleaned up for room {self.room.room_code}")

    def on_phase_change(self, new_phase: MatchPhase):
        """Synchronous phase event dispatcher that schedules appropriate async tasks."""
        if not self.is_active:
            return

        self.cancel_pending()

        if new_phase == MatchPhase.TOSS:
            self._current_task = asyncio.create_task(self._handle_toss())
        elif new_phase == MatchPhase.DECISION:
            self._current_task = asyncio.create_task(
                self._handle_decision(self.room.state.current_delivery_id)
            )
        elif new_phase == MatchPhase.DISCUSSION:
            self._current_task = asyncio.create_task(self._handle_discussion())
        elif new_phase == MatchPhase.INNINGS_BREAK:
            self._current_task = asyncio.create_task(self._handle_innings_break())
        elif new_phase == MatchPhase.OVER_BREAK:
            self._current_task = asyncio.create_task(self._handle_over_break())
        elif new_phase == MatchPhase.MATCH_END:
            asyncio.create_task(self.cleanup())

    def on_delivery_resolved(self, delivery_res: DeliveryResult):
        """
        Called after delivery resolution to trigger contextual banter
        and schedule the next delivery transition.
        """
        if not self.is_active:
            return

        state = self.room.state

        # Trigger contextual live banter asynchronously
        event_type = self.banter_engine.evaluate_delivery_event(
            state, delivery_res, self.bot_player_id
        )
        if event_type and self.banter_engine.should_trigger_banter(event_type):
            line = self.banter_engine.generate_banter(event_type, state, delivery_res)
            if line:
                self._banter_task = asyncio.create_task(self._send_bot_banter(line))

        # Schedule appropriate next phase task
        if state.is_match_over:
            asyncio.create_task(self.cleanup())
        elif state.phase == MatchPhase.INNINGS_BREAK:
            self.on_phase_change(MatchPhase.INNINGS_BREAK)
        elif state.phase == MatchPhase.OVER_BREAK:
            self.on_phase_change(MatchPhase.OVER_BREAK)
        else:
            self.on_phase_change(MatchPhase.DISCUSSION)

    async def _send_bot_banter(self, text: str):
        """Simulates realistic typing delay and broadcasts bot live-chat message."""
        try:
            from ..rooms.manager import room_manager
            # Broadcast typing indicator to opponent
            await room_manager.broadcast_to_room(self.room, {
                "type": "BOT_TYPING",
                "bot_id": self.bot_player_id,
                "bot_name": self.bot_profile.display_name,
                "is_typing": True
            })

            # Natural typing delay based on message length (0.8s to 1.6s)
            typing_delay = min(1.6, max(0.8, len(text) * 0.025))
            await asyncio.sleep(typing_delay)

            if not self.is_active:
                return

            now = time.time()
            chat_msg = ChatMessage(
                id=f"chat_bot_{int(now * 1000)}_{random.randint(100, 999)}",
                sender_id=self.bot_player_id,
                sender_name=self.bot_profile.display_name,
                sender_role="player",
                team_id=self.room.state.team_b.id if self.bot_player_id == self.room.state.player_2_id else self.room.state.team_a.id,
                channel="all",
                text=text,
                reaction=None,
                timestamp=now
            )

            # Store in room history
            self.room.state.recent_chats.append(chat_msg)
            if len(self.room.state.recent_chats) > 50:
                self.room.state.recent_chats = self.room.state.recent_chats[-50:]

            # Broadcast message and clear typing indicator
            await room_manager.broadcast_to_room(self.room, {
                "type": "BOT_TYPING",
                "bot_id": self.bot_player_id,
                "bot_name": self.bot_profile.display_name,
                "is_typing": False
            })
            await room_manager.broadcast_to_room(self.room, {
                "type": "CHAT_MESSAGE",
                "message": chat_msg.model_dump()
            })
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning(f"Error in bot banter delivery: {e}")

    async def _handle_toss(self):
        try:
            from ..rooms.manager import room_manager

            # Give a human-like delay for toss
            await asyncio.sleep(1.0)
            if not self.is_active or self.room.state.phase != MatchPhase.TOSS:
                return

            # Check if bot is the toss caller
            toss_caller = self.room.state.player_2_id or "p2"
            if toss_caller == self.bot_player_id and not self.room.state.toss_winner_id:
                call_choice = random.choice(["heads", "tails"])
                coin_flip = "heads" if random.random() > 0.5 else "tails"
                winner_id = self.bot_player_id if call_choice == coin_flip else self.room.state.player_1_id
                self.room.state.toss_winner_id = winner_id

                await room_manager.broadcast_to_room(self.room, {
                    "type": "TOSS_RESULT",
                    "coin_flip": coin_flip,
                    "toss_winner_id": winner_id,
                    "state": self.room.state.model_dump(exclude={"pending_submissions"})
                })

            # If bot won the toss, make the decision after a brief pause
            if self.room.state.toss_winner_id == self.bot_player_id and not self.room.state.toss_decision:
                await asyncio.sleep(1.2)
                if not self.is_active or self.room.state.phase != MatchPhase.TOSS:
                    return

                # Bots usually prefer to bat first in hand cricket (~65%)
                decision = "bat" if random.random() < 0.65 else "bowl"
                self.room.state.toss_decision = decision

                inn1 = HandCricketEngine.initialize_innings(self.room.state, 1)
                self.room.state.innings_list = [inn1]
                self.room.state.current_innings_number = 1
                HandCricketEngine.start_new_delivery(self.room.state)

                await room_manager.broadcast_state_to_all(self.room, "MATCH_STARTED")
                # Trigger delivery submission for Innings 1 Ball 1
                self.on_phase_change(MatchPhase.DECISION)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in bot toss handler: {e}")

    async def _handle_decision(self, delivery_id: str):
        try:
            from ..rooms.manager import room_manager

            state = self.room.state
            if state.phase != MatchPhase.DECISION or state.current_delivery_id != delivery_id:
                return

            # Check if bot is an active controller for this delivery
            active_bat = state.active_batting_controller_id or state.player_1_id
            active_bowl = state.active_bowling_controller_id or state.player_2_id

            if self.bot_player_id not in [active_bat, active_bowl]:
                return

            # Idempotency check: avoid double submissions for the same delivery ID
            if self._last_submitted_delivery_id == delivery_id:
                return
            if self.bot_player_id in state.pending_submissions:
                return

            # Realistic human-like delay (1.2 to 2.5 seconds)
            delay = random.uniform(
                bot_settings.decision_delay_min,
                bot_settings.decision_delay_max
            )
            await asyncio.sleep(delay)

            if not self.is_active or self.room.state.phase != MatchPhase.DECISION:
                return
            if self.room.state.current_delivery_id != delivery_id:
                return
            if self.bot_player_id in self.room.state.pending_submissions:
                return

            # Compute tactical action
            action = BotDecisionEngine.decide_action(
                state=self.room.state,
                bot_controller_id=self.bot_player_id,
                difficulty=self.difficulty
            )

            self._last_submitted_delivery_id = delivery_id

            # Submit via authoritative room manager
            await room_manager.handle_delivery_submission(
                room=self.room,
                player_id=self.bot_player_id,
                delivery_id=delivery_id,
                chosen_number=action
            )
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in bot decision handler: {e}")

    async def _handle_discussion(self):
        try:
            from ..rooms.manager import room_manager

            # Realistic pause after reveal before clicking "Ready for next ball"
            # Allows players to enjoy the fanfare, celebration animation, and commentary
            await asyncio.sleep(1.8)
            if not self.is_active or self.room.state.phase not in [MatchPhase.REVEAL, MatchPhase.DISCUSSION]:
                return

            # Mark bot ready
            both_ready = HandCricketEngine.set_player_ready_for_next(
                self.room.state, self.bot_player_id
            )
            await room_manager.broadcast_state_to_all(self.room, "STATE_UPDATE", {
                "ready_player_id": self.bot_player_id,
                "both_ready": both_ready
            })

            # In bot matches: if the human hasn't clicked "Ready" after an additional 2.5s,
            # auto-advance so webcam gestures and hands-free players never get stuck
            if not both_ready and self.room.state.is_bot_match:
                await asyncio.sleep(2.5)
                if self.is_active and self.room.state.phase in [MatchPhase.REVEAL, MatchPhase.DISCUSSION]:
                    human_id = self.room.state.player_1_id
                    if human_id and not self.room.state.ready_for_next_ball.get(human_id):
                        both_ready = HandCricketEngine.set_player_ready_for_next(
                            self.room.state, human_id
                        )

            # Check post-readiness phase
            if self.room.state.is_match_over:
                from ..database import save_completed_match
                asyncio.create_task(save_completed_match(
                    self.room.state.model_dump(),
                    player_1_user_id=self.room.state.player_1_user_id,
                    player_2_user_id=self.room.state.player_2_user_id,
                    match_type="PUBLIC"
                ))
                await self.cleanup()
            elif both_ready:
                # set_player_ready_for_next has already transitioned the state!
                await room_manager.broadcast_state_to_all(self.room, "STATE_UPDATE")
                if self.room.state.phase == MatchPhase.DECISION:
                    self.on_phase_change(MatchPhase.DECISION)
                elif self.room.state.phase == MatchPhase.OVER_BREAK:
                    self.on_phase_change(MatchPhase.OVER_BREAK)
                elif self.room.state.phase == MatchPhase.INNINGS_BREAK:
                    self.on_phase_change(MatchPhase.INNINGS_BREAK)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in bot discussion handler: {e}")

    async def _handle_innings_break(self):
        try:
            from ..rooms.manager import room_manager

            # Natural innings break pause (~2.5 seconds)
            await asyncio.sleep(2.5)
            if not self.is_active or self.room.state.phase != MatchPhase.INNINGS_BREAK:
                return

            # Transition to 2nd Innings
            HandCricketEngine.transition_to_innings_2(self.room.state)
            await room_manager.broadcast_state_to_all(self.room, "STATE_UPDATE")
            self.on_phase_change(MatchPhase.DECISION)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in bot innings break handler: {e}")

    async def _handle_over_break(self):
        try:
            from ..rooms.manager import room_manager

            await asyncio.sleep(1.2)
            if not self.is_active or self.room.state.phase != MatchPhase.OVER_BREAK:
                return

            ready = HandCricketEngine.set_over_transition_ready(
                self.room.state, self.bot_player_id
            )
            await room_manager.broadcast_state_to_all(self.room, "STATE_UPDATE", {
                "over_ready": ready
            })

            # In bot matches, if human hasn't readied after 1.8s, auto-ready human
            if not ready and self.room.state.is_bot_match:
                await asyncio.sleep(1.8)
                if self.is_active and self.room.state.phase == MatchPhase.OVER_BREAK:
                    human_id = self.room.state.player_1_id
                    if human_id and not self.room.state.over_transition_ready.get(human_id):
                        ready = HandCricketEngine.set_over_transition_ready(
                            self.room.state, human_id
                        )

            if ready:
                # set_over_transition_ready already started the new delivery!
                await room_manager.broadcast_state_to_all(self.room, "STATE_UPDATE")
                self.on_phase_change(MatchPhase.DECISION)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in bot over break handler: {e}")
