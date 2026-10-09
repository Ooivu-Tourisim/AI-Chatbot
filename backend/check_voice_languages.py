"""Live Azure check using synthetic speech only; no customer/catalogue data."""
import json
import os
import re
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from providers import GroqClient, synthesize, transcribe_audio

SAMPLES = {
    "en": "I would like to travel to Sri Lanka with my family for a relaxing holiday.",
    "de": "Ich möchte mit meiner Familie nach Sri Lanka reisen und einen schönen Urlaub verbringen.",
    "fr": "Je voudrais voyager au Sri Lanka avec ma famille pour passer de belles vacances.",
    "ar": "أريد السفر إلى سريلانكا مع عائلتي لقضاء عطلة جميلة والاستمتاع بالطبيعة.",
    "ko": "가족과 함께 스리랑카로 여행을 가고 싶어요. 아름다운 자연과 해변을 즐기고 싶습니다.",
    "zh": "我想和家人一起去斯里兰卡旅行，欣赏美丽的自然风景和海滩。",
    "hi": "मैं अपने परिवार के साथ श्रीलंका की यात्रा करना चाहता हूँ और सुंदर समुद्र तट देखना चाहता हूँ।",
    "it": "Vorrei viaggiare in Sri Lanka con la mia famiglia per una bella vacanza al mare.",
    "es": "Quiero viajar a Sri Lanka con mi familia para disfrutar de unas vacaciones en la playa.",
    "si": "මට මගේ පවුලේ අය සමඟ ශ්‍රී ලංකාවේ සංචාරයක් යන්න ඕනෑ. ලස්සන මුහුදු වෙරළ බලන්න කැමතියි.",
    "ta": "என் குடும்பத்துடன் இலங்கைக்கு சுற்றுலா செல்ல விரும்புகிறேன். அழகான கடற்கரைகளை பார்க்க விரும்புகிறேன்.",
}


def check(item):
    code, sample = item
    result = {"language": code, "speech_output": False, "automatic_transcription": False}
    try:
        audio = synthesize(sample, code)
        result["speech_output"] = audio[:4] == b"RIFF" and len(audio) > 44
        transcript = transcribe_audio(audio, "audio/wav")
        result["detected_language"] = transcript["language_code"]
        result["transcript"] = transcript["text"]
        result["automatic_transcription"] = bool(transcript["text"]) and transcript["language_code"] == code
        if "--conversation" in sys.argv:
            from google.genai import types
            client = GroqClient(os.environ["LLM_API_KEY"])
            chat = client.create(client.model, [], types.GenerateContentConfig(
                system_instruction="You are a travel assistant. Briefly acknowledge the customer in one sentence. "
                    + "Speech recognition language hint: " + transcript["language_code"], max_output_tokens=1024))
            reply = "".join(chunk.text for chunk in chat.send_message_stream(transcript["text"]))
            match = re.match(r"\s*\[\[language:([a-z]{2,3})\]\]\s*", reply)
            result["reply_language"] = match.group(1) if match else None
            result["conversation_language"] = result["reply_language"] == code
            spoken = synthesize(reply[match.end():] if match else reply, result["reply_language"] or code)
            result["conversation_audio"] = spoken[:4] == b"RIFF" and len(spoken) > 44
    except Exception as exc:
        result["error_type"] = type(exc).__name__
        result["status"] = getattr(exc, "code", None)
    return result


if __name__ == "__main__":
    load_dotenv(Path(__file__).with_name(".env"))
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(check, SAMPLES.items()))
    Path(__file__).with_name("voice_language_report.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    for result in results:
        print(result["language"], "TTS", result["speech_output"], "STT", result["automatic_transcription"], "conversation", result.get("conversation_language"), "reply audio", result.get("conversation_audio"), "status", result.get("status"))
