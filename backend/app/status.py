jobs = {}

def set_status(job_id, status):
    jobs[job_id]["status"] = status

def set_results(job_id, results):
    jobs[job_id]["status"] = "completed"
    jobs[job_id]["results"] = results