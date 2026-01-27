import whisper
import openai
import os
from openai import OpenAI

from dotenv import load_dotenv
load_dotenv()


client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def rank_clips(video_path):
    print(f"[DEBUG] Loading Whisper model and transcribing: {video_path}")
    model = whisper.load_model("base")
    result = model.transcribe(video_path)
    segments = result["segments"]
    print(f"[DEBUG] Transcription complete. {len(segments)} segments found.")

    # Build transcript text with segment indices
    transcript = "\n".join(f"[{i}] {seg['text']}" for i, seg in enumerate(segments))

    # Prompt for LLM (allow merging, require double quotes for JSON)
    prompt = (
        "Pick up to 3 interesting/shareable moments (30-60s each, merge segments if needed). "
        "Clips must start/end at a complete sentence. Expand to full sentence if needed. "
        "Return JSON: [{\"start_segment\": n, \"end_segment\": n, \"quote\": \"...\", \"reason\": \"...\"}]\n"
        "Transcript:\n" + transcript
    )


    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
        temperature=0.4,
    )
    import json
    import re
    # Extract JSON from response
    text = response.choices[0].message.content
    # Find first JSON array in response
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if not match:
        print("LLM output (no JSON found):\n", text)
        raise ValueError("Could not parse LLM response: " + text)
    try:
        clips_ai = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        print("LLM output (invalid JSON):\n", match.group(0))
        raise

    # Map segment indices to timestamps (support merging, extend end time)
    video_duration = result.get("duration") or segments[-1]["end"]
    selected = []
    for clip in clips_ai:
        start_idx = clip["start_segment"]
        end_idx = clip["end_segment"]
        seg_start = segments[start_idx]["start"]
        seg_end = segments[end_idx]["end"]
        # Extend end time by 1.5s, but not past video duration
        extended_end = min(seg_end, video_duration)
        selected.append({
            "start": round(seg_start, 1),
            "end": round(extended_end, 1),
            "reason": clip["reason"],
            "quote": clip["quote"]
        })

    # Remove overlaps, keep top 3
    non_overlap = []
    for c in selected:
        overlap = any(
            not (c["end"] <= s["start"] or c["start"] >= s["end"])
            for s in non_overlap
        )
        if not overlap:
            non_overlap.append(c)
        if len(non_overlap) == 3:
            break

    return [
        {
            "start": c["start"],
            "end": c["end"],
            "reason": c["reason"],
            "quote": c["quote"]
        }
        for c in non_overlap
    ]
