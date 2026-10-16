import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Video, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  Download, 
  RefreshCw, 
  Languages, 
  Server,
  FileText
} from 'lucide-react';

export default function App() {
  const [backendUrl, setBackendUrl] = useState(
    import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
  );
  const [serverStatus, setServerStatus] = useState('unchecked'); // 'unchecked' | 'online' | 'offline' | 'checking'
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [language, setLanguage] = useState('auto');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [result, setResult] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Check health on mount or when backendUrl changes
  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setServerStatus('checking');
    setError(null);
    try {
      const cleanUrl = backendUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/health`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });
      if (res.ok) {
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }
    } catch {
      setServerStatus('offline');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024 * 1024) {
        setError('Selected file exceeds the 200MB limit.');
        return;
      }
      setSelectedFile(file);
      setVideoSrc(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const handleTranscribe = async () => {
    if (!selectedFile) {
      setError('Please select a video file first.');
      return;
    }

    setIsTranscribing(true);
    setError(null);
    setProgressMsg('Uploading video to backend...');

    try {
      const cleanUrl = backendUrl.replace(/\/+$/, '');
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('language', language);

      setProgressMsg('Extracting audio & Transcribing with local Whisper.cpp...');
      
      const response = await fetch(`${cleanUrl}/transcribe`, {
        method: 'POST',
        headers: {
          'bypass-tunnel-reminder': 'true'
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Server responded with status ${response.status}`);
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to transcribe video.');
    } finally {
      setIsTranscribing(false);
      setProgressMsg('');
    }
  };

  // Keep segment highlight in sync with video current time
  const handleTimeUpdate = () => {
    if (!videoRef.current || !result?.segments) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    const index = result.segments.findIndex(
      (s) => time >= s.start && time <= s.end
    );
    setActiveSegmentIndex(index);
  };

  const jumpToSegment = (start) => {
    if (videoRef.current) {
      videoRef.current.currentTime = start;
      videoRef.current.play();
    }
  };

  const copyTranscript = () => {
    if (!result?.text) return;
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSrt = () => {
    if (!result?.segments) return;
    const formatTime = (secs) => {
      const pad = (n, z = 2) => ('00' + n).slice(-z);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = Math.floor(secs % 60);
      const ms = Math.floor((secs % 1) * 1000);
      return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
    };

    let srtContent = '';
    result.segments.forEach((seg, i) => {
      srtContent += `${i + 1}\n${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedFile?.name || 'transcript'}.srt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container">
      {/* Header */}
      <header>
        <div className="logo-group">
          <div className="logo-icon">
            <Video size={24} color="#fff" />
          </div>
          <div>
            <h1>AI Video Editor</h1>
            <p className="subtitle">Local Whisper.cpp Video Transcription</p>
          </div>
        </div>
      </header>

      {/* Backend URL & Status Bar */}
      <div className="backend-bar">
        <div className="backend-input-group">
          <Server size={18} color="#9ca3af" />
          <input
            type="text"
            className="input-field"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="http://127.0.0.1:8000 or https://xxxx.trycloudflare.com"
          />
          <button className="btn btn-secondary" onClick={checkHealth} disabled={serverStatus === 'checking'}>
            <RefreshCw size={15} className={serverStatus === 'checking' ? 'spinner' : ''} />
            Test Connection
          </button>
        </div>
        <div>
          {serverStatus === 'online' && (
            <span className="status-pill status-online">
              <CheckCircle size={14} /> Backend Connected
            </span>
          )}
          {serverStatus === 'offline' && (
            <span className="status-pill status-offline">
              <AlertCircle size={14} /> Backend Offline
            </span>
          )}
          {serverStatus === 'checking' && (
            <span className="status-pill" style={{ background: 'rgba(255,255,255,0.1)' }}>
              Checking...
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="main-grid">
        {/* Left Column: Upload & Video Preview */}
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', fontWeight: 600 }}>1. Upload Video</h2>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/avi"
            style={{ display: 'none' }}
          />

          <div 
            className="upload-zone"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={36} className="upload-icon" />
            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
              {selectedFile ? selectedFile.name : 'Click or drop video here'}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              MP4, MOV, WEBM, MKV, AVI (Max 200 MB)
            </p>
          </div>

          {/* Settings */}
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <Languages size={18} color="#9ca3af" />
              <select
                className="input-field"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{ padding: '0.5rem' }}
              >
                <option value="auto">Auto Detect Language</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="hi">Hindi</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
              </select>
            </div>

            <button
              className="btn"
              onClick={handleTranscribe}
              disabled={!selectedFile || isTranscribing}
            >
              {isTranscribing ? 'Processing...' : 'Transcribe Video'}
            </button>
          </div>

          {/* Video Preview */}
          {videoSrc && (
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Video Preview
              </p>
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                className="video-preview"
                onTimeUpdate={handleTimeUpdate}
              />
            </div>
          )}
        </div>

        {/* Right Column: Transcription Output */}
        <div className="card">
          <div className="transcript-header">
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>2. Transcript & Segments</h2>
              {result && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Language: <strong style={{ color: 'var(--primary)' }}>{result.language.toUpperCase()}</strong> • {result.segments?.length || 0} segments
                </p>
              )}
            </div>
            {result && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary" onClick={copyTranscript} title="Copy Full Text">
                  <Copy size={15} />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button className="btn btn-secondary" onClick={downloadSrt} title="Download SRT Subtitles">
                  <Download size={15} />
                  SRT
                </button>
              </div>
            )}
          </div>

          {isTranscribing && (
            <div className="loading-indicator">
              <div className="spinner" />
              <p style={{ fontWeight: 600, color: 'var(--primary)' }}>Transcribing Locally</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {progressMsg}
              </p>
            </div>
          )}

          {!isTranscribing && !result && (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>Upload a video and click "Transcribe Video" to generate timestamped segments.</p>
            </div>
          )}

          {!isTranscribing && result && (
            <div className="segments-list">
              {result.segments?.map((seg, idx) => (
                <div
                  key={idx}
                  className={`segment-item ${activeSegmentIndex === idx ? 'active' : ''}`}
                  onClick={() => jumpToSegment(seg.start)}
                >
                  <div className="segment-meta">
                    <Play size={12} fill="currentColor" />
                    <span>{seg.start}s — {seg.end}s</span>
                  </div>
                  <p className="segment-text">{seg.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
