import os
import json
import re
from dotenv import load_dotenv
from openai import OpenAI
from faster_whisper import WhisperModel

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Load Whisper once (important for performance)
model = WhisperModel("base.en", device="cpu", compute_type="int8")


def rank_clips(video_path):
    print(f"[DEBUG] Transcribing video: {video_path}")

    # --- Transcription ---
    segments_gen, info = model.transcribe(video_path, vad_filter=True)
    segments = list(segments_gen)

    print(f"[DEBUG] Transcription complete: {len(segments)} segments")

    # Build transcript with indices
    transcript = "\n".join(
        f"[{i}] {seg.text.strip()}"
        for i, seg in enumerate(segments)
    )

    # --- LLM Prompt ---
    prompt = (
        "You are given a podcast transcript split into timestamped segments.\n"
        "Select up to 3 interesting or shareable moments.\n"
        "- Each clip should be ~30–60 seconds\n"
        "- You may merge consecutive segments\n"
        "- Clips must start and end at complete sentences\n"
        "- If a quote is long, shorten it to a complete sentence\n"
        "- Do NOT truncate JSON output\n\n"
        "Return ONLY valid JSON in this format:\n"
        "[{\"start_segment\": 0, \"end_segment\": 3, \"quote\": \"...\", \"reason\": \"...\"}]\n\n"
        "Transcript:\n"
        f"{transcript}"
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=600,
    )

    text = response.choices[0].message.content.strip()

    # --- Strip markdown code fences if present ---
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)

    # --- Extract JSON safely (non-greedy) ---
    match = re.search(r"\[\s*{.*?}\s*\]", text, re.DOTALL)
    if not match:
        print("[ERROR] LLM output:\n", text)
        raise ValueError("Could not find valid JSON array in LLM output")

    try:
        clips_ai = json.loads(match.group(0))
    except json.JSONDecodeError:
        print("[ERROR] Invalid JSON returned by LLM:\n", match.group(0))
        raise

    # --- Build final clips ---
    video_duration = info.duration or segments[-1].end
    selected = []

    for clip in clips_ai:
        start_idx = clip.get("start_segment")
        end_idx = clip.get("end_segment")

        # Bounds check
        if (
            start_idx is None
            or end_idx is None
            or start_idx < 0
            or end_idx >= len(segments)
            or end_idx < start_idx
        ):
            continue

        seg_start = segments[start_idx].start
        seg_end = segments[end_idx].end

        selected.append({
            "start": round(seg_start, 1),
            "end": round(min(seg_end, video_duration), 1),
            "reason": clip.get("reason", ""),
            "quote": clip.get("quote", ""),
        })

    # --- Remove overlaps, keep top 3 ---
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

    return non_overlap