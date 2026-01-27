from fastapi import FastAPI, File, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uuid
import os
from .processor import rank_clips
from .status import jobs, set_status, set_results
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

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

@app.post("/process")
async def process_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "processing",
        "results": []
    }

    temp_path = f"temp_{job_id}.mp4"
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    background_tasks.add_task(run_processing, job_id, temp_path)

    return {"job_id": job_id}

@app.get("/status/{job_id}")
def get_status(job_id: str):
    return {"status": jobs[job_id]["status"]}

@app.get("/results/{job_id}")
def get_results(job_id: str):
    return {"results": jobs[job_id]["results"]}