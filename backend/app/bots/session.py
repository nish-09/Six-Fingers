import asyncio
import random
import logging
from typing import Optional, Any
from .models import BotProfile, BotDifficulty
from .config import bot_settings
from .engine import BotDecisionEngine
from .registry import bot_registry
from ..models.game import MatchPhase, DeliveryResult
from ..engine.hand_cricket import HandCricketEngine

logger = logging.getLogger("six_fingers.bots.session")

class BotGameSession:
    """
    Manages the active lifecycle, toss calls, and delivery submissions of a bot
    opponent inside an authoritative MatchRoom.
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

    def cancel_pending(self):
        if self._current_task and not self._current_task.done():
            self._current_task.cancel()
        self._current_task = None

    async def cleanup(self):
        """Releases the bot back to the registry and clears background tasks."""
        if not self.is_active:
            return
        self.is_active = False
        self.cancel_pending()
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

            # If bot is the winner of the toss, make the decision after a brief pause
            if self.room.state.toss_winner_id == self.bot_player_id and not self.room.state.toss_decision:
                await asyncio.sleep(1.2)
                if not self.is_active or self.room.state.phase != MatchPhase.TOSS:
                    return

                # Bots usually prefer to bat first in hand cricket (~65%), unless personality prefers chase
                decision = "bat" if random.random() < 0.65 else "bowl"
                self.room.state.toss_decision = decision

                inn1 = HandCricketEngine.initialize_innings(self.room.state, 1)
                self.room.state.innings_list = [inn1]
                self.room.state.current_innings_number = 1
                HandCricketEngine.start_new_delivery(self.room.state)

                await room_manager.broadcast_state_to_all(self.room, "MATCH_STARTED")
                # Immediately trigger delivery submission for Innings 1 Ball 1
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

            # Check if bot is an active controller for this over
            active_bat = state.active_batting_controller_id or state.player_1_id
            active_bowl = state.active_bowling_controller_id or state.player_2_id

            if self.bot_player_id not in [active_bat, active_bowl]:
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

            # Compute tactical action
            action = BotDecisionEngine.decide_action(
                state=self.room.state,
                bot_controller_id=self.bot_player_id,
                difficulty=self.difficulty
            )

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
            await asyncio.sleep(1.5)
            if not self.is_active or self.room.state.phase != MatchPhase.DISCUSSION:
                return

            # Set bot ready
            both_ready = HandCricketEngine.set_player_ready_for_next(
                self.room.state, self.bot_player_id
            )
            await room_manager.broadcast_state_to_all(self.room, "STATE_UPDATE", {
                "ready_player_id": self.bot_player_id,
                "both_ready": both_ready
            })

            # If match is completed, finalize
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
                # Both players are ready -> start next delivery!
                HandCricketEngine.start_new_delivery(self.room.state)
                await room_manager.broadcast_state_to_all(self.room, "STATE_UPDATE")
                self.on_phase_change(MatchPhase.DECISION)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in bot discussion handler: {e}")

    async def _handle_innings_break(self):
        try:
            from ..rooms.manager import room_manager

            # Natural innings break pause (~2.0 seconds)
            await asyncio.sleep(2.0)
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

            if ready:
                HandCricketEngine.start_new_delivery(self.room.state)
                await room_manager.broadcast_state_to_all(self.room, "STATE_UPDATE")
                self.on_phase_change(MatchPhase.DECISION)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in bot over break handler: {e}")
