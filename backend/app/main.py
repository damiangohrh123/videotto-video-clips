# New upload endpoint: streams file to disk and returns job_id
import time
from fastapi import HTTPException
from fastapi import FastAPI, File, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uuid
import os
from .processor import rank_clips
from .status import jobs, set_status, set_results
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# New process trigger endpoint: starts background processing for uploaded file
@app.post("/process/{job_id}")
async def process_video(job_id: str, background_tasks: BackgroundTasks):
    temp_path = os.path.join("uploads", f"{job_id}.mp4")
    if not os.path.exists(temp_path):
        raise HTTPException(status_code=404, detail="File not found")
    set_status(job_id, "queued")
    background_tasks.add_task(run_processing, job_id, temp_path)
    print(f"[DEBUG] Background processing started for job_id={job_id}")
    return {"status": "started"}

def run_processing(job_id: str, temp_path: str):
    try:
        set_status(job_id, "processing")
        clips = rank_clips(temp_path)

        set_status(job_id, "completed")
        set_results(job_id, clips)
    except Exception as e:
        set_status(job_id, "failed")
        print(e)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use a constant for chunk size
CHUNK_SIZE = 1024 * 1024  # 1MB

# Updated /upload endpoint: no path in response
@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    print("\ud83d\udd25 HIT EC2 UPLOAD ENDPOINT")
    import time
    job_id = str(uuid.uuid4())
    temp_dir = "uploads"
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"{job_id}.mp4")
    start = time.time()
    try:
        with open(temp_path, "wb") as f:
            print(f"[DEBUG] Streaming upload to {temp_path} in chunks...")
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                f.write(chunk)
        print(f"[DEBUG] Finished writing {temp_path} ({os.path.getsize(temp_path)} bytes) in {time.time() - start:.2f}s")
    except Exception as e:
        print(f"[ERROR] Failed to write upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    jobs[job_id] = {"status": "uploaded", "results": []}
    return {"job_id": job_id}

@app.get("/status/{job_id}")
def get_status(job_id: str):
    return {"status": jobs[job_id]["status"]}

@app.get("/results/{job_id}")
def get_results(job_id: str):
    return {"results": jobs[job_id]["results"]}