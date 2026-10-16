# AI Video Editor (Stage 1: Transcription Engine & Web Studio)

A full-stack, local AI video transcription application. It uses **Whisper.cpp** to transcribe uploaded videos locally with timestamped segments (zero API costs), exposed via **Cloudflare Tunnel**, with an interactive **React frontend** that synchronizes video playback with generated transcripts.

---

## 📁 Project Structure

```text
ai-video-editor/
├── client/                     # 🌐 Frontend Studio (React + Vite)
│   ├── src/
│   │   ├── App.jsx             # Video player & interactive timestamped segments
│   │   ├── index.css           # Modern dark UI styling
│   │   └── main.jsx
│   ├── .env                    # Frontend environment (API base URL)
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # ⚙️ Backend API (Node.js + Express)
│   ├── src/
│   │   ├── app.js              # Express app entry & configuration
│   │   ├── routes/             # Upload handling & endpoint definitions
│   │   ├── controllers/        # Request handling & orchestration
│   │   ├── services/
│   │   │   ├── ffmpeg.service.js  # Audio extraction (mono, 16kHz WAV)
│   │   │   └── whisper.service.js # Local Whisper.cpp runner
│   │   └── utils/
│   │       └── cleanup.js      # Temp file cleanup
│   ├── uploads/                # Temporary file staging (auto-purged)
│   ├── test_assets/            # Sample videos for testing
│   ├── tests/                  # Automated API test suite
│   ├── .env                    # Backend configuration
│   ├── .env.example
│   └── package.json
│
├── package.json                # Root workspace convenience scripts
└── README.md
```

---

## 🚀 Quick Start

### 1. Backend (`server/`)

```bash
cd server
npm install
npm start
```
*The server starts on `http://127.0.0.1:8000`.*

To run tests:
```bash
npm test
```

### 2. Frontend (`client/`)

```bash
cd client
npm install
npm run dev
```
*The React app starts on `http://localhost:5173`.*

---

## 📱 Hosting Backend on Tablet (OnePlus Pad 3 via Termux)

1. **In Termux**, navigate to the server folder:
   ```bash
   cd ~/ai-video-editor/server
   npm install
   ```

2. **Start the backend in detached mode with PM2**:
   ```bash
   pm2 start src/app.js --name "video-api"
   ```

3. **Expose the API publicly with Cloudflare**:
   ```bash
   cloudflared tunnel --url http://127.0.0.1:8000
   ```
   Copy the generated HTTPS URL: `https://xxxx.trycloudflare.com`.

4. **Connect the Frontend**:
   - Open your frontend app in your browser (`http://localhost:5173` or deployed site).
   - Paste the Cloudflare URL into the "Backend URL" input field at the top and click **"Test Connection"**.
