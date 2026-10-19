import random
from typing import Dict, Any, Optional
from ..models.game import (
    MatchState,
    DeliveryResult,
    CommentaryLanguage
)

class CommentaryService:
    """
    Multilingual, context-aware Indian cricket commentary engine.
    Produces energetic, broadcast-style cricket commentary with authentic
    Indian English accents and Hinglish expressions.
    Supports English (Indian style), Hindi, Marathi, and Gujarati.
    """

    def generate_delivery_commentary(
        self, state: MatchState, delivery: DeliveryResult
    ) -> Dict[str, str]:
        batter = delivery.batsman_name
        bowler = delivery.bowler_name
        runs = delivery.runs_scored
        is_wicket = delivery.is_wicket
        inn_runs = delivery.innings_total_runs
        inn_wkt = delivery.innings_wickets

        # Check for high-pressure close finish scenario in 2nd innings
        is_close_finish = False
        if state.current_innings_number == 2:
            current_inn = state.innings_list[1] if len(state.innings_list) > 1 else None
            if current_inn and current_inn.target is not None:
                needed = max(0, current_inn.target - current_inn.total_runs)
                total_balls = state.rules.overs_per_innings * state.rules.balls_per_over
                balls_left = max(0, total_balls - current_inn.balls_bowled)
                if needed <= 10 and balls_left <= 6 and not current_inn.is_completed and not state.is_match_over:
                    is_close_finish = True

        res = {}
        for lang in [CommentaryLanguage.ENGLISH, CommentaryLanguage.HINDI, 
                     CommentaryLanguage.MARATHI, CommentaryLanguage.GUJARATI]:
            res[lang.value] = self._build_text(
                lang, batter, bowler, runs, is_wicket, inn_runs, inn_wkt, state, is_close_finish
            )
        return res

    def _build_text(
        self,
        lang: CommentaryLanguage,
        batter: str,
        bowler: str,
        runs: int,
        is_wicket: bool,
        inn_runs: int,
        inn_wkt: int,
        state: MatchState,
        is_close_finish: bool = False
    ) -> str:
        # 1. Wicket Delivery
        if is_wicket:
            if lang == CommentaryLanguage.HINDI:
                opts = [
                    f"OUT! Kya delivery thi! Batter {batter} ko pavilion ka raasta dikhana padega!",
                    f"विकेट! गेंद हवा में और सीधा कैच! {batter} पवेलियन लौटते हुए, स्कोर {inn_runs}/{inn_wkt}!",
                    f"बड़ा झटका! {bowler} की जादुई चाल, {batter} आउट होकर मैदान से बाहर!",
                    f"OUT! Hand cricket mein matching number aur seedha out! {bowler} ko mili badi kamyabi!"
                ]
            elif lang == CommentaryLanguage.MARATHI:
                opts = [
                    f"बाद! फलंदाज बाद! {batter} आणि {bowler} दोघांचाही एकच नंबर! {bowler} चा अफलातून मारा!",
                    f"मोठा धक्का! {batter} बाद होऊन तंबूत परतला. धावसंख्या {inn_runs}/{inn_wkt}!",
                    f"झेलबाद! {bowler} ने मिळवला महत्त्वपूर्ण बळी!"
                ]
            elif lang == CommentaryLanguage.GUJARATI:
                opts = [
                    f"આઉટ! મોટો ઝટકો! {batter} અને {bowler} બંનેનો એક જ નંબર! {bowler} ને મળી સફળતા!",
                    f"વિકેટ! {batter} આઉટ થઈને પેવેલિયન ભેગા થયા! સ્કોર {inn_runs}/{inn_wkt}!",
                    f"શાનદાર બોલિંગ! {bowler} એ કરી કમાલ, બેટર આઉટ!"
                ]
            else: # Indian English Broadcast Style
                opts = [
                    f"OUT! What a delivery! {bowler} outsmarts {batter} and points him straight to the pavilion!",
                    f"WICKET! Big breakthrough! Both controllers locked the same number, and {batter} is GONE!",
                    f"OUT! That is plumb out! Spectacular bowling by {bowler}, scoreboard reads {inn_runs}/{inn_wkt}!",
                    f"CAUGHT! Massive blow to the batting side! {batter} walks back!"
                ]
            return random.choice(opts)

        # 2. Six (Maximum)
        if runs == 6:
            if lang == CommentaryLanguage.HINDI:
                opts = [
                    f"Arre waah! Kya shot hai! Seedha stands mein, SIX!",
                    f"गगनचुंबी छक्का! {batter} ने गेंद को मैदान के बाहर भेज दिया! 6 रन!",
                    f"YEH GAYA! Seedha darshako ke beech! {batter} ka monster hit, SIX! 6 run!",
                    f"Awaaz toh suniye! Clean strike over long-on, poore 6 run, छक्का!"
                ]
            elif lang == CommentaryLanguage.MARATHI:
                opts = [
                    f"उत्तुंग षटकार! {batter} चा चेंडू थेट सीमारेषेबाहेर प्रेक्षकांमध्ये!",
                    f"काय फटका मारलाय! खणखणीत ६ धावा! {batter} चा दणदणीत प्रहार!",
                    f"विस्फोटक षटकार! {bowler} च्या चेंडूवर {batter} चा कडक प्रहार!"
                ]
            elif lang == CommentaryLanguage.GUJARATI:
                opts = [
                    f"ધમાકેદાર સિક્સર! {batter} નો જોરદાર શોટ, બોલ સીધો સ્ટેન્ડમાં!",
                    f"વાહ શું શોટ છે! આખો સ્ટેડિયમ ઝૂમી ઉઠ્યો, પૂરા ૬ રન!",
                    f"અદ્ભુત બેટિંગ! {batter} એ ફટકાર્યો ગગનચુંબી છગ્ગો!"
                ]
            else: # Indian English Broadcast Style
                opts = [
                    f"Arre waah! Kya shot hai! Clean as a whistle, straight into the stands for SIX!",
                    f"DISPATCHED! What a massive six by {batter}! The crowd is absolutely roaring in the stadium!",
                    f"BOOM! Out of the ground! That is an absolute monster hit from {batter} for SIX!",
                    f"MAXIMUM! In the slot and hoisted high into the night sky for 6 runs!"
                ]
            return random.choice(opts)

        # 3. Four (Boundary)
        if runs == 4:
            if lang == CommentaryLanguage.HINDI:
                opts = [
                    f"Shot maara hai! Gap mein gayi ball, FOUR!",
                    f"करारा चौका! {batter} की टाइमिंग इतनी सटीक कि फील्डर के पास कोई मौका नहीं! 4 रन!",
                    f"खूबसूरत बाउंड्री! गैप चीरती हुई गेंद गोली की तरह बाउंड्री पार!",
                    f"Chauka! Bullet ki tarah nikal gayi ball, what a placement!"
                ]
            elif lang == CommentaryLanguage.MARATHI:
                opts = [
                    f"सुरेख चौकार! {batter} चा नजाकतदार फटका, चेंडू सुसाट सीमारेषेपार!",
                    f"खणखणीत ४ धावा! टाइमिंग अत्यंत अचूक, {batter} चा देखणा शॉट!",
                    f"बुलेटसारखा चौकार! {bowler} हताश, {batter} च्या खात्यात ४ धावा!"
                ]
            elif lang == CommentaryLanguage.GUJARATI:
                opts = [
                    f"શાનદાર ચોગ્ગો! {batter} નો ક્લાસિક શોટ, ૪ રન!",
                    f"ગોળીની જેમ બોલ બાઉન્ડ્રી બહાર! {batter} ના ખાતામાં ૪ રન!",
                    f"ચોગ્ગો! ઉત્કૃષ્ટ ટાઇમિંગ અને પ્લેસમેન્ટ!"
                ]
            else: # Indian English Broadcast Style
                opts = [
                    f"Shot maara hai! Pierces the gap with surgical precision, FOUR!",
                    f"CRACKING FOUR! Beautiful timing through the covers, racing away like a tracer bullet!",
                    f"FOUR! Swept away with elegance, deep into the fence!",
                    f"What a boundary! {batter} finds the open pocket brilliantly!"
                ]
            return random.choice(opts)

        # 4. Dot Ball (runs == 0, not out)
        if runs == 0:
            if is_close_finish:
                if lang == CommentaryLanguage.HINDI:
                    return "Dot ball! Ab pressure dono taraf hai! Agli delivery match decide kar sakti hai!"
                else:
                    return "Huge dot ball! Pressure is boiling over in the stadium! Every ball is gold right now!"

            if lang == CommentaryLanguage.HINDI:
                opts = [
                    f"Achha ball hai! {batter} ko koi run nahi mila.",
                    f"Beaten completely! Ek dum dot ball, {bowler} ka shandar over!",
                    f"Seedha fielder ke haath mein, dot ball! Pressure badhta hua!",
                    f"Dot ball! {bowler} ki chaturai, batter ko bilkul baandh ke rakha hai!"
                ]
            elif lang == CommentaryLanguage.MARATHI:
                opts = [
                    f"डॉट बॉल! {batter} ला एकही धाव घेता आली नाही.",
                    f"सुरेख मारा! {bowler} ने फलंदाजाला जखडून ठेवले आहे.",
                    f"कोणतीही धाव नाही! उत्कृष्ट गोलंदाजी {bowler} कडून!"
                ]
            elif lang == CommentaryLanguage.GUJARATI:
                opts = [
                    f"ડોટ બોલ! {batter} ને રન બનાવવાની કોઈ તક ન મળી.",
                    f"ચુસ્ત બોલિંગ! {bowler} એ બેટરને બાંધી રાખ્યા છે.",
                    f"ઝીરો રન! શાનદાર ડિલિવરી {bowler} તરફથી!"
                ]
            else: # Indian English
                opts = [
                    f"Achha ball hai! Beaten outside off, batter gets no run!",
                    f"Dot ball! Excellent length from {bowler}, keeping things razor tight.",
                    f"Swing and a miss! That's a crucial dot ball in the over.",
                    f"Straight to the fielder, that's a dot ball! No run taken as {bowler} applies the squeeze!"
                ]
            return random.choice(opts)

        # 5. Singles, Twos, Threes
        if is_close_finish:
            if lang == CommentaryLanguage.HINDI:
                return f"Tezi se {runs} run liye! Game abhi baaki hai dosto, har run keemti hai!"
            else:
                return f"Quick running between the wickets for {runs}! Down to the wire now!"

        if runs == 1:
            if lang == CommentaryLanguage.HINDI:
                opts = [
                    f"Good running! Ek run le liya, strike rotate hui.",
                    f"Halka sa push, aur tezi se single pura kiya {batter} ne.",
                    f"Ek run scoreboard mein juda, score {inn_runs}/{inn_wkt}."
                ]
            elif lang == CommentaryLanguage.MARATHI:
                opts = [
                    f"एक धाव! {batter} ने चपळाईने एक धाव काढली.",
                    f"चांगली धावपळ, धावफलक हलत ठेवले {batter} ने."
                ]
            elif lang == CommentaryLanguage.GUJARATI:
                opts = [
                    f"એક રન! {batter} એ ઝડપથી દોડીને સિંગલ લીધો.",
                    f"સરસ પ્લેસમેન્ટ, સ્કોરમાં એક રનનો ઉમેરો."
                ]
            else: # Indian English
                opts = [
                    f"Good running! Ek run le liya, sensible rotation of strike by {batter}.",
                    f"Pushed gently into the gap, easy single taken.",
                    f"Tucked away for a single, keeps the scoreboard ticking over at {inn_runs}/{inn_wkt}."
                ]
            return random.choice(opts)

        # Runs 2, 3, 5
        if lang == CommentaryLanguage.HINDI:
            opts = [
                f"{runs} run! Badiya running between the wickets {batter} dwara!",
                f"Gap mein dhakela aur tezi se {runs} run poore kiye!",
                f"Sateek placement! {runs} run judte hue, kul score {inn_runs}/{inn_wkt}."
            ]
        elif lang == CommentaryLanguage.MARATHI:
            opts = [
                f"{runs} धावा! {batter} ने चपळाई दाखवत धावा पळवून काढल्या.",
                f"चांगली धावपळ, {batter} च्या खात्यात {runs} धावा जमा.",
                f"सुरेख खेळ, {runs} धावा मिळाल्या, धावसंख्या आता {inn_runs}/{inn_wkt}."
            ]
        elif lang == CommentaryLanguage.GUJARATI:
            opts = [
                f"{runs} રન! {batter} એ ઝડપથી દોડીને રન લીધા.",
                f"સરસ પ્લેસમેન્ટ, સ્કોરબોર્ડમાં {runs} રન ઉમેરાયા.",
                f"શાંતિપૂર્વક રમીને {batter} એ લીધા {runs} રન."
            ]
        else: # Indian English
            opts = [
                f"Superb running between the wickets! {runs} quick runs collected by {batter}!",
                f"Worked into the deep pocket, they hustle back for {runs} runs!",
                f"Good cricket all around, adding {runs} valuable runs to make it {inn_runs}/{inn_wkt}."
            ]
        return random.choice(opts)

commentary_service = CommentaryService()
