from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs = {}

@app.post("/process")
def process_video():
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "processing"
    }
    return {"job_id": job_id}

@app.get("/status/{job_id}")
def get_status(job_id: str):
    return jobs.get(job_id, {"status": "unknown"})

@app.get("/results/{job_id}")
def get_results(job_id: str):
    return {
        "results": [
            {
                "start": 12,
                "end": 30,
                "reason": "High speech energy and key takeaway discussed"
            },
            {
                "start": 45,
                "end": 70,
                "reason": "Clear explanation with strong emphasis"
            },
            {
                "start": 95,
                "end": 120,
                "reason": "Summarizes an important concept"
            }
        ]
    }