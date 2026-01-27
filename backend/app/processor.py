import os
import re
import json
import subprocess
from faster_whisper import WhisperModel
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Load a smaller, faster model
MODEL_NAME = "tiny.en"
whisper_model = WhisperModel(MODEL_NAME)

def extract_audio(video_path, out_path=None):
    """
    Extract audio from video and downsample to 16kHz mono WAV.
    """
    if out_path is None:
        out_path = os.path.splitext(video_path)[0] + "_audio.wav"

    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vn",         # no video
        "-ac", "1",    # mono
        "-ar", "12000",# 16 kHz
        "-y",          # overwrite
        out_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out_path

def rank_clips(video_path):
    print(f"[DEBUG] Extracting audio from video: {video_path}")
    audio_path = extract_audio(video_path)
    print(f"[DEBUG] Audio extracted: {audio_path}")

    try:
        print(f"[DEBUG] Transcribing audio with Whisper ({MODEL_NAME})...")
        segments_gen, info = whisper_model.transcribe(audio_path, vad_filter=False)
        segments = list(segments_gen)
        print(f"[DEBUG] Transcription complete: {len(segments)} segments, duration={info.duration:.1f}s")

        # Build transcript text for LLM
        transcript_for_llm = "\n".join(f"[{i}] {seg.text.strip()}" for i, seg in enumerate(segments))

        # LLM prompt to pick top 3 clips
        prompt = (
            "You are given a podcast transcript split into timestamped segments.\n"
            "Select up to 3 interesting or shareable moments (~30–60s each, may merge consecutive segments).\n"
            "Clips must start and end at complete sentences.\n"
            "Return ONLY JSON in this format:\n"
            "[{\"start_segment\": 0, \"end_segment\": 3, \"quote\": \"...\", \"reason\": \"...\"}]\n\n"
            f"Transcript:\n{transcript_for_llm}"
        )

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )

        text = response.choices[0].message.content
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if not match:
            raise ValueError(f"Could not find JSON in LLM output:\n{text}")

        clips_ai = json.loads(match.group(0))

        # Map LLM segment indices to actual timestamps
        video_duration = info.duration or segments[-1].end
        selected = []
        for clip in clips_ai:
            start_idx = clip["start_segment"]
            end_idx = clip["end_segment"]
            if start_idx < 0 or end_idx >= len(segments):
                continue
            seg_start = segments[start_idx].start
            seg_end = segments[end_idx].end
            selected.append({
                "start": round(seg_start, 1),
                "end": round(min(seg_end, video_duration), 1),
                "quote": clip["quote"],
                "reason": clip["reason"]
            })

        # Remove overlaps and keep top 3
        non_overlap = []
        for c in selected:
            if not any(not (c["end"] <= s["start"] or c["start"] >= s["end"]) for s in non_overlap):
                non_overlap.append(c)
            if len(non_overlap) == 3:
                break

        return non_overlap

    finally:
        # Clean up temp files
        if os.path.exists(audio_path):
            os.remove(audio_path)
        if os.path.exists(video_path):
            os.remove(video_path)
        print(f"[DEBUG] Temporary files removed: {video_path}, {audio_path}")