import React, { useState, useRef, useEffect } from "react";

// VideoClipPlayer component: plays only the segment between start and end
function VideoClipPlayer({ start, end, src }) {
  const videoRef = useRef();
  const [duration, setDuration] = useState(0);

  // Seek to start time when loaded
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => {
      video.currentTime = start;
      setDuration(end - start);
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    return () => video.removeEventListener("loadedmetadata", handleLoaded);
  }, [start, end, src]);

  // Prevent seeking outside the clip
  const handleSeeking = () => {
    const video = videoRef.current;
    if (video.currentTime < start) {
      video.currentTime = start;
    } else if (video.currentTime > end) {
      video.currentTime = end;
      video.pause();
    }
  };

  // Pause at end time
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video.currentTime >= end) {
      video.pause();
      video.currentTime = start;
    }
  };

  // Format seconds as mm:ss
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ marginTop: 8 }}>
      <video
        ref={videoRef}
        width={320}
        controls
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        preload="metadata"
      />
      <div style={{ fontSize: '0.9em', color: '#555' }}>
        Clip duration: {formatTime(end - start)}
      </div>
    </div>
  );
}

function App() {
  const [status, setStatus] = useState("Not started");
  const [jobId, setJobId] = useState(null);
  const [results, setResults] = useState([]);
  const [polling, setPolling] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("/sample.mp4");

  // Handle file drop or selection
  const handleFileChange = (e) => {
    const file = e.target.files ? e.target.files[0] : e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setStatus("Video loaded: " + file.name);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFileChange(e);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleProcess = async () => {
    setStatus("Processing...");
    setResults([]);
    if (!videoFile) {
      setStatus("No video file selected");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", videoFile);
      const res = await fetch("http://localhost:8000/process", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.job_id) {
        setJobId(data.job_id);
        setStatus("Processing started (Job: " + data.job_id + ")");
        setPolling(true);
        pollStatus(data.job_id);
      } else {
        setStatus("Failed to get job ID");
      }
    } catch (err) {
      setStatus("Failed to start processing");
    }
  };

  const pollStatus = async (jobId) => {
    let done = false;
    while (!done) {
      try {
        const res = await fetch(`http://localhost:8000/status/${jobId}`);
        const data = await res.json();
        setStatus(`Status: ${data.status}`);
        if (data.status === "completed") {
          done = true;
          setPolling(false);
          fetchResults(jobId);
        } else if (data.status === "failed") {
          done = true;
          setPolling(false);
          setStatus("Processing failed");
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch (err) {
        setStatus("Error checking status");
        done = true;
        setPolling(false);
      }
    }
  };

  const fetchResults = async (jobId) => {
    try {
      const res = await fetch(`http://localhost:8000/results/${jobId}`);
      const data = await res.json();
      setResults(data.results || []);
      setStatus("Completed");
    } catch (err) {
      setStatus("Error fetching results");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Videotto Clip Ranking</h1>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: "2px dashed #aaa",
          borderRadius: 8,
          padding: 20,
          marginBottom: 16,
          background: "#fafafa",
          textAlign: "center",
        }}
      >
        <input
          type="file"
          accept="video/*"
          style={{ display: "none" }}
          id="video-upload"
          onChange={handleFileChange}
        />
        <label htmlFor="video-upload" style={{ cursor: "pointer" }}>
          <b>Drag & drop a video here, or click to select</b>
        </label>
      </div>

      <button onClick={handleProcess} disabled={polling || !videoUrl}>
        Process Video
      </button>

      <p>{status}</p>

      <ul>
        {results.length > 0 ? (
          results.map((clip, idx) => (
            <li key={idx} style={{ marginBottom: '30px' }}>
              <b>Clip {idx + 1}:</b> {clip.start} - {clip.end} <br />
              <i>{clip.reason}</i>
              <br />
              <VideoClipPlayer start={clip.start} end={clip.end} src={videoUrl} />
            </li>
          ))
        ) : (
          <li>No results yet.</li>
        )}
      </ul>
    </div>
  );
}

export default App;