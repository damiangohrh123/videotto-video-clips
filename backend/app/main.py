from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uuid
from .processor import rank_clips
from .status import jobs, set_status, set_results

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VIDEO_PATH = "sample.mp4"

@app.post("/process")
def process_video():
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "processing"}

    set_status(job_id, "transcribing")
    clips = rank_clips(VIDEO_PATH)

    set_results(job_id, clips)
    return {"job_id": job_id}

@app.get("/status/{job_id}")
def get_status(job_id: str):
    return {"status": jobs[job_id]["status"]}

@app.get("/results/{job_id}")
def get_results(job_id: str):
    return {"results": jobs[job_id]["results"]}
