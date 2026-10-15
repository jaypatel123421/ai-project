# Local AI Video Transcription API (Stage 1)

A fast, offline-first Node.js and Express backend that accepts video uploads, extracts mono 16 kHz WAV audio via FFmpeg, transcribes the audio locally using **Whisper.cpp**, and returns timestamped JSON segments without requiring paid third-party APIs. It can be exposed publicly via Cloudflare Tunnel.

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| **Runtime** | Node.js (v18+) / Termux on Android / macOS / Linux |
| **Backend** | Express.js |
| **Uploads** | Multer (with 200MB limit & type filtering) |
| **Audio Extraction** | FFmpeg (`-ac 1 -ar 16000 -c:a pcm_s16le`) |
| **Transcription Engine** | Whisper.cpp (`ggml-base.bin`) via `child_process.spawn()` |
| **Temporary Files** | Safe async cleanup (`fs.unlink`) |
| **Public Exposure** | Cloudflare Tunnel (`cloudflared`) |

---

## 📁 Project Structure

```text
ai-video-editor/
├── src/
│   ├── app.js                          # Express app entry & configuration
│   ├── routes/
│   │   └── transcription.routes.js     # Route definitions & Multer upload middleware
│   ├── controllers/
│   │   └── transcription.controller.js # Endpoint business logic & response handling
│   ├── services/
│   │   ├── ffmpeg.service.js           # FFmpeg spawn wrapper (video -> 16kHz mono WAV)
│   │   └── whisper.service.js          # Whisper.cpp spawn wrapper & JSON parser
│   └── utils/
│       └── cleanup.js                  # Temp file cleanup utility
├── uploads/                            # Temporary upload staging (cleaned up automatically)
├── .env                                # Local environment config
├── .env.example                        # Template environment config
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Setup & Installation

### 1. Prerequisites

Ensure `node`, `npm`, `ffmpeg`, and `whisper.cpp` are installed.

#### On macOS:
```bash
brew install ffmpeg cmake cloudflared
git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git ~/whisper.cpp
cmake -B ~/whisper.cpp/build -S ~/whisper.cpp
cmake --build ~/whisper.cpp/build --config Release -j$(sysctl -n hw.ncpu)
bash ~/whisper.cpp/models/download-ggml-model.sh base ~/whisper.cpp/models
```

#### On Android (Termux):
```bash
pkg update && pkg install nodejs-lts git cmake clang python ffmpeg cloudflared -y
git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git ~/whisper.cpp
cmake -B ~/whisper.cpp/build -S ~/whisper.cpp
cmake --build ~/whisper.cpp/build --config Release -j$(nproc)
bash ~/whisper.cpp/models/download-ggml-model.sh base ~/whisper.cpp/models
```

### 2. Install Project Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Edit `.env` (or copy from `.env.example`):
```env
PORT=8000
WHISPER_PATH=/Users/jaypatel/whisper.cpp/build/bin/whisper-cli
WHISPER_MODEL=/Users/jaypatel/whisper.cpp/models/ggml-base.bin
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=200
```

---

## 🏃 Running the Server

### Local Development:
```bash
npm run dev
```

### Production:
```bash
npm start
```

The server will listen at `http://127.0.0.1:8000`.

---

## 📡 API Contract

### 1. Health Check

- **Method:** `GET`
- **Path:** `/health`
- **Response:** `200 OK`
```json
{
  "status": "ok",
  "uptime": 12.34,
  "timestamp": "2026-10-15T16:50:00.000Z"
}
```

### 2. Video Transcription

- **Method:** `POST`
- **Path:** `/transcribe`
- **Content-Type:** `multipart/form-data`
- **Body Parameters:**
  - `video` (file, required): The video file (MP4, MOV, WEBM, MKV, AVI, up to 200MB).
  - `language` (text, optional): Spoken language code (e.g. `en`, `es`, `fr`, or `auto` by default).

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "filename": "sample_video.mp4",
  "language": "en",
  "text": "And so my fellow Americans ask not what your country can do for you, ask what you can do for your country.",
  "segments": [
    {
      "start": 0.0,
      "end": 10.5,
      "text": "And so my fellow Americans ask not what your country can do for you, ask what you can do for your country."
    }
  ]
}
```

#### Error Responses:
- **400 Bad Request:** Missing file, unsupported file extension, or unparseable input.
- **413 Payload Too Large:** Uploaded file exceeds the 200MB limit.
- **500 Internal Server Error:** FFmpeg extraction failure (e.g. no audio stream) or Whisper engine failure.

---

## 🌐 Exposing via Cloudflare Tunnel

To make your API accessible over the public internet (with free HTTPS):

```bash
cloudflared tunnel --url http://127.0.0.1:8000
```

Cloudflare will output a temporary public URL, such as:
```text
https://random-subdomain.trycloudflare.com
```

You can now hit `https://random-subdomain.trycloudflare.com/health` and `/transcribe` from any mobile device, frontend app, or Postman!

---

## 🧪 Testing with cURL

```bash
# 1. Health check
curl -X GET http://127.0.0.1:8000/health

# 2. Transcribe a video
curl -X POST http://127.0.0.1:8000/transcribe \
  -F "video=@/path/to/video.mp4"
```
