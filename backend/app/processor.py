import whisper

KEYWORDS = ["important", "key", "why", "how", "big", "lesson"]

def rank_clips(video_path):
    model = whisper.load_model("base")
    result = model.transcribe(video_path)

    segments = result["segments"]

    candidates = []
    for seg in segments:
        score = len(seg["text"].split())
        score += sum(k in seg["text"].lower() for k in KEYWORDS) * 5

        candidates.append({
            "start": seg["start"],
            "end": seg["end"],
            "score": score,
            "reason": "High speech density and key phrases detected"
        })

    top = sorted(candidates, key=lambda x: x["score"], reverse=True)[:3]

    return [
        {
            "start": round(c["start"], 1),
            "end": round(c["end"], 1),
            "reason": c["reason"]
        }
        for c in top
    ]
