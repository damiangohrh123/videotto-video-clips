
import React, { useState } from "react";

function App() {
  const [status, setStatus] = useState("Not started");
  const [jobId, setJobId] = useState(null);

  const handleProcess = async () => {
    setStatus("Processing...");
    try {
      const res = await fetch("http://localhost:8000/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setJobId(data.job_id);
      setStatus("Processing started (Job: " + data.job_id + ")");
    } catch (err) {
      setStatus("Failed to start processing");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Videotto Clip Ranking</h1>

      <button onClick={handleProcess}>Process Video</button>

      <p>Status: {status}</p>

      <ul>
        {/* Results will appear here */}
      </ul>
    </div>
  );
}

export default App;