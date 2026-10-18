import random
from typing import Dict, Any, Optional
from ..models.game import (
    MatchState,
    DeliveryResult,
    CommentaryLanguage
)

class CommentaryService:
    """
    Multilingual, context-aware cricket commentary engine.
    Supports English, Hindi, Marathi, and Gujarati.
    Works deterministically with rich sports templates and can integrate with LLMs.
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

        res = {}
        for lang in [CommentaryLanguage.ENGLISH, CommentaryLanguage.HINDI, 
                     CommentaryLanguage.MARATHI, CommentaryLanguage.GUJARATI]:
            res[lang.value] = self._build_text(lang, batter, bowler, runs, is_wicket, inn_runs, inn_wkt, state)
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
        state: MatchState
    ) -> str:
        if is_wicket:
            if lang == CommentaryLanguage.HINDI:
                opts = [
                    f"आउट! बड़ा झटका! {batter} और {bowler} दोनों ने {delivery_num(runs, state)} चुना! {bowler} को मिली बड़ी सफलता!",
                    f"विकेट! गेंद हवा में और सीधा कैच! {batter} पवेलियन लौटते हुए, स्कोर {inn_runs}/{inn_wkt}!",
                    f"क्लीन बोल्ड जैसा कमाल! {bowler} की सटीक चाल, {batter} की पारी समाप्त!"
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
            else: # English
                opts = [
                    f"WICKET! What a catch! Both showed {delivery_num(runs, state)}! {bowler} dismisses {batter}!",
                    f"OUT! That is a huge breakthrough! {batter} departs, leaving the team at {inn_runs}/{inn_wkt}!",
                    f"GONE! Caught and bowled style! {bowler} outsmarts {batter} with a matching hand!"
                ]
            return random.choice(opts)

        if runs == 6:
            if lang == CommentaryLanguage.HINDI:
                opts = [
                    f"गगनचुंबी छक्का! {batter} ने गेंद को मैदान के बाहर भेज दिया! 6 रन!",
                    f"क्या शॉट है! सीधा दर्शकों के बीच! {batter} के बल्ले से निकला विस्फोटक छक्का!",
                    f"मॉन्स्टर हिट! 6 रन! गेंद हवाई सैर पर निकल पड़ी!"
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
            else: # English
                opts = [
                    f"BOOM! MAXIMUM! {batter} sends that into the top tier for SIX!",
                    f"DISPATCHED! What a massive six by {batter}! Crowd goes wild!",
                    f"UNBELIEVABLE HIT! Clean strike over long-on for six monster runs!"
                ]
            return random.choice(opts)

        if runs == 4:
            if lang == CommentaryLanguage.HINDI:
                opts = [
                    f"करारा चौका! {batter} की टाइमिंग इतनी सटीक कि फील्डर के पास कोई मौका नहीं! 4 रन!",
                    f"खूबसूरत बाउंड्री! {batter} ने गेंद को गैप में चीरते हुए 4 रन बटोरे!",
                    f"रॉकेट की रफ्तार से चौका! बेहतरीन क्रिकेटिंग शॉट!"
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
            else: # English
                opts = [
                    f"CRACKING FOUR! {batter} pierces the gap with sheer precision!",
                    f"RACING AWAY! Beautiful stroke play from {batter} for four runs!",
                    f"FOUR RUNS! Swept away with grace to the fence!"
                ]
            return random.choice(opts)

        # Runs 1, 2, 3, 5
        if lang == CommentaryLanguage.HINDI:
            opts = [
                f"{runs} रन! {batter} ने गेंद को आराम से धकेला और तेज़ी से रन पूरे किए।",
                f"अच्छी रनिंग बिटवीन द विकेट्स, {batter} ने जोड़े {runs} महत्वपूर्ण रन।",
                f"सटीक प्लेसमेंट! {runs} रन स्कोरबोर्ड में जुड़े, कुल {inn_runs}/{inn_wkt}।"
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
        else: # English
            opts = [
                f"{runs} run{'s' if runs > 1 else ''}! Nicely worked away into the open pocket by {batter}.",
                f"Quick running between the wickets, taking {runs} clean run{'s' if runs > 1 else ''}.",
                f"Good rotation of strike, adding {runs} to make it {inn_runs}/{inn_wkt}."
            ]
        return random.choice(opts)

def delivery_num(runs: int, state: MatchState) -> int:
    return runs if runs > 0 else (state.pending_submissions.get(state.player_1_id) or 0)

commentary_service = CommentaryService()
