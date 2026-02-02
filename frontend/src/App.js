import React, { useState, useRef, useEffect } from "react";
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import XHRUpload from '@uppy/xhr-upload';
import '@uppy/core/dist/style.css';
import '@uppy/dashboard/dist/style.css';

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
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("");

  // Format seconds as mm:ss
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Uppy instance for chunked uploads
  const [uppy] = useState(() => {
    return new Uppy({
      restrictions: { maxNumberOfFiles: 1 },
      autoProceed: false,
    }).use(XHRUpload, {
      endpoint: '/upload',
      fieldName: 'file',
      bundle: false,
    });
  });

  useEffect(() => {
    uppy.on('upload', () => setStatus('Uploading...'));
    uppy.on('upload-success', async (file, response) => {
      setStatus('Processing...');
      const jobId = response.body.job_id;
      if (jobId) {
        // Trigger processing after upload
        try {
          const res = await fetch(`/process/${jobId}`, { method: 'POST' });
          const data = await res.json();
          if (data.status === 'started') {
            pollStatus(jobId);
          } else {
            setStatus('Failed to start processing');
          }
        } catch (err) {
          setStatus('Failed to start processing');
        }
      } else {
        setStatus('Failed to get job ID');
      }
    });
    uppy.on('upload-error', (file, error, response) => {
      setStatus('Upload failed');
    });
    return () => uppy.close();
    // eslint-disable-next-line
  }, [uppy]);

  // Poll backend for job status
  const pollStatus = async (jobId) => {
    let done = false;
    while (!done) {
      try {
        const res = await fetch(`/status/${jobId}`);
        const data = await res.json();
        setStatus(data.status);
        if (data.status === "completed") {
          done = true;
          fetchResults(jobId);
        } else if (data.status === "failed") {
          done = true;
          setStatus("failed");
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch (err) {
        setStatus("Error checking status");
        done = true;
      }
    }
  };

  // Fetch results from backend
  const fetchResults = async (jobId) => {
    try {
      const res = await fetch(`/results/${jobId}`);
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
      <h2>Chunked Video Upload</h2>
      <Dashboard uppy={uppy} proudlyDisplayPoweredByUppy={false} height={350} />

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
              {/* You may want to update this to use the processed video URL if available */}
            </li>
          ))
        }
      </ul>
    </div>
  );
}

export default App;