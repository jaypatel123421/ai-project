const path = require('path');
const { extractAudio } = require('../services/ffmpeg.service');
const { transcribeAudio } = require('../services/whisper.service');
const { cleanupFiles } = require('../utils/cleanup');

/**
 * Health check handler
 */
function healthCheck(req, res) {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}

/**
 * Handles video transcription:
 * 1. Validates uploaded file
 * 2. Extracts mono 16kHz WAV using FFmpeg
 * 3. Transcribes using Whisper.cpp
 * 4. Cleans up all temporary files
 * 5. Responds with JSON segments
 */
async function transcribeVideo(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No video file uploaded. Please send a video file using the "video" field.'
    });
  }

  const videoPath = req.file.path;
  const originalName = req.file.originalname;
  let audioPath = null;
  let jsonPath = null;

  try {
    // 1. Extract audio via FFmpeg
    audioPath = await extractAudio(videoPath);

    // 2. Transcribe via Whisper
    const transcriptionResult = await transcribeAudio(audioPath, {
      language: req.body.language || 'auto'
    });

    jsonPath = transcriptionResult.jsonPath;

    // 3. Clean up all temporary files before returning response
    await cleanupFiles([videoPath, audioPath, jsonPath].filter(Boolean));

    // 4. Return JSON response
    return res.status(200).json({
      success: true,
      filename: originalName,
      language: transcriptionResult.language,
      text: transcriptionResult.text,
      segments: transcriptionResult.segments
    });
  } catch (err) {
    console.error('[Transcription Error]:', err.message || err);

    // Ensure cleanup happens on error as well
    await cleanupFiles([videoPath, audioPath, jsonPath].filter(Boolean));

    return res.status(500).json({
      success: false,
      error: err.message || 'An error occurred during transcription.'
    });
  }
}

module.exports = {
  healthCheck,
  transcribeVideo,
};
