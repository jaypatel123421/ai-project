const { spawn } = require('child_process');
const path = require('path');

/**
 * Extracts mono 16 kHz WAV audio from video using FFmpeg.
 * @param {string} videoPath - Path to input video file
 * @param {string} [outputPath] - Optional destination for audio file
 * @returns {Promise<string>} - Path to the extracted WAV file
 */
function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    const audioPath = outputPath || path.join(
      path.dirname(videoPath),
      `${path.parse(videoPath).name}_audio_${Date.now()}.wav`
    );

    // Command: ffmpeg -y -i <videoPath> -vn -ac 1 -ar 16000 -c:a pcm_s16le <audioPath>
    const args = [
      '-y',
      '-i', videoPath,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'pcm_s16le',
      audioPath
    ];

    const ffmpegProcess = spawn('ffmpeg', args);

    let stderr = '';

    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve(audioPath);
      } else {
        if (stderr.includes('does not contain any stream') || stderr.includes('Output file does not contain any stream')) {
          reject(new Error('The uploaded video does not contain an audio stream.'));
        } else {
          reject(new Error(`FFmpeg failed with exit code ${code}: ${stderr.slice(-300)}`));
        }
      }
    });
  });
}

module.exports = {
  extractAudio,
};
