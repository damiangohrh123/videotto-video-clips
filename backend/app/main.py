from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import uuid
import os
from .processor import rank_clips
from .status import jobs, set_status, set_results
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process")
async def process_video(file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "processing"}

    # Save uploaded file to disk
    temp_path = f"temp_{job_id}.mp4"
    print(f"[DEBUG] Starting processing for job_id={job_id}, saving to {temp_path}")
    with open(temp_path, "wb") as f:
        content = await file.read()
        f.write(content)

    set_status(job_id, "transcribing")
    print(f"[DEBUG] Transcribing video: {temp_path}")
    clips = rank_clips(temp_path)

    set_results(job_id, clips)
    print(f"[DEBUG] Processing complete for job_id={job_id}")

    # Delete the temp file after processing
    try:
        os.remove(temp_path)
    except Exception as e:
        print(f"Warning: could not delete temp file {temp_path}: {e}")

    return {"job_id": job_id}

@app.get("/status/{job_id}")
def get_status(job_id: str):
    return {"status": jobs[job_id]["status"]}

@app.get("/results/{job_id}")
def get_results(job_id: str):
    return {"results": jobs[job_id]["results"]}
