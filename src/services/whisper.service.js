const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const WHISPER_PATH = process.env.WHISPER_PATH || path.join(process.env.HOME || '', 'whisper.cpp/build/bin/whisper-cli');
const WHISPER_MODEL = process.env.WHISPER_MODEL || path.join(process.env.HOME || '', 'whisper.cpp/models/ggml-base.bin');

/**
 * Transcribes a 16kHz WAV audio file using whisper.cpp executable.
 * @param {string} wavPath - Path to input WAV file
 * @param {object} [options] - Options including language
 * @returns {Promise<{ language: string, text: string, segments: Array<{ start: number, end: number, text: string }>, jsonPath: string }>}
 */
function transcribeAudio(wavPath, options = {}) {
  return new Promise((resolve, reject) => {
    const outputPrefix = path.join(
      path.dirname(wavPath),
      `${path.parse(wavPath).name}_transcription_${Date.now()}`
    );
    const expectedJsonPath = `${outputPrefix}.json`;
    const language = options.language || 'auto';

    // Arguments: -m <model> -f <audio> -l <lang> -oj -of <prefix>
    const args = [
      '-m', WHISPER_MODEL,
      '-f', wavPath,
      '-l', language,
      '-oj',
      '-of', outputPrefix
    ];

    const whisperProcess = spawn(WHISPER_PATH, args);

    let stderr = '';
    let stdout = '';

    whisperProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    whisperProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    whisperProcess.on('error', (err) => {
      reject(new Error(`Failed to start Whisper executable (${WHISPER_PATH}): ${err.message}`));
    });

    whisperProcess.on('close', async (code) => {
      if (code !== 0) {
        return reject(new Error(`Whisper failed with exit code ${code}: ${stderr.slice(-300)}`));
      }

      try {
        const fileContent = await fs.readFile(expectedJsonPath, 'utf8');
        const rawJson = JSON.parse(fileContent);

        const detectedLanguage = rawJson?.result?.language || rawJson?.params?.language || 'en';
        const rawSegments = rawJson?.transcription || [];

        const segments = rawSegments.map((seg) => {
          const startMs = seg.offsets?.from ?? 0;
          const endMs = seg.offsets?.to ?? 0;
          return {
            start: parseFloat((startMs / 1000).toFixed(2)),
            end: parseFloat((endMs / 1000).toFixed(2)),
            text: (seg.text || '').trim()
          };
        });

        const fullText = segments.map((s) => s.text).filter(Boolean).join(' ').trim();

        resolve({
          language: detectedLanguage,
          text: fullText,
          segments,
          jsonPath: expectedJsonPath
        });
      } catch (err) {
        reject(new Error(`Failed to read/parse Whisper JSON output: ${err.message}`));
      }
    });
  });
}

module.exports = {
  transcribeAudio,
};
