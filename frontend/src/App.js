import React, { useState, useRef, useEffect } from "react";

// VideoClipPlayer component: plays only the segment between start and end
function VideoClipPlayer({ start, end, src }) {
  const videoRef = useRef();

  // Robustly seek to start time when loaded or when play is pressed
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => {
      // Only seek if not already at start
      if (Math.abs(video.currentTime - start) > 0.1) {
        video.currentTime = start;
      }
    };
    const handlePlay = () => {
      // Always seek to start when play is pressed and before playing
      if (Math.abs(video.currentTime - start) > 0.1) {
        video.currentTime = start;
      }
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("play", handlePlay);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("play", handlePlay);
    };
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
    <div className="video-clip-player">
      <video
        ref={videoRef}
        width={320}
        controls
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        preload="metadata"
      />
      <div className="video-clip-player-info">
        Clip duration: {formatTime(end - start)}
      </div>
    </div>
  );
}

function App() {
  const [status, setStatus] = useState("");
  // jobId state removed (was unused)

  // Format seconds as mm:ss
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
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
        setStatus("processing");
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
        setStatus(data.status);
        if (data.status === "completed") {
          done = true;
          setPolling(false);
          fetchResults(jobId);
        } else if (data.status === "failed") {
          done = true;
          setPolling(false);
          setStatus("failed");
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
    <div className="app-container">
      <h1>Videotto Clip Ranking</h1>

      <div
        className="drop-area"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          type="file"
          accept="video/*"
          className="hidden-input"
          id="video-upload"
          onChange={handleFileChange}
        />
        <label htmlFor="video-upload" className="upload-label">
          <b>Drag & drop a video here, or click to select</b>
        </label>
      </div>

      <button className="process-btn" onClick={handleProcess} disabled={polling || !videoUrl}>
        Process Video
      </button>

      {status && (
        <p className="status-text">
          {status === "processing" && <span className="spinner" />}
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </p>
      )}

      <ul className="clip-list">
        {results.length > 0 &&
          results.map((clip, idx) => (
            <li key={idx} className="clip-list-item">
              <b>Clip {idx + 1}:</b> {formatTime(clip.start)} - {formatTime(clip.end)} <br />
              <i>{clip.reason.replace(/^This segment/i, "This clip")}</i>
              <br />
              <VideoClipPlayer start={clip.start} end={clip.end} src={videoUrl} />
            </li>
          ))
        }
      </ul>
    </div>
  );
}

export default App;