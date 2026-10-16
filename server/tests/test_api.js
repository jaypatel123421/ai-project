const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');

const PORT = 8001; // Separate port for tests

function runRequest(options, postData = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        ...options,
        headers: {
          ...headers,
          ...(postData && !headers['Content-Type']
            ? { 'Content-Type': 'application/json' }
            : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on('error', reject);

    if (postData) {
      if (Buffer.isBuffer(postData)) {
        req.write(postData);
      } else if (typeof postData === 'string') {
        req.write(postData);
      } else {
        req.write(JSON.stringify(postData));
      }
    }
    req.end();
  });
}

function createMultipartFormData(filePath, fieldName = 'video', extraFields = {}) {
  const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
  const filename = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath);

  const parts = [];

  // Extra text fields
  for (const [key, value] of Object.entries(extraFields)) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${value}\r\n`
    );
  }

  // File part
  const mimeType = filePath.endsWith('.mp4') ? 'video/mp4' : 'text/plain';
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`
  );

  const headerBuffer = Buffer.from(parts.join(''), 'utf-8');
  const footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');

  const body = Buffer.concat([headerBuffer, fileContent, footerBuffer]);
  const contentType = `multipart/form-data; boundary=${boundary}`;

  return { body, contentType };
}

async function runTests() {
  console.log('🧪 Starting API Verification Tests...\n');
  const server = app.listen(PORT, '127.0.0.1');

  await new Promise((resolve) => server.on('listening', resolve));
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failedCount++;
    }
  }

  try {
    // Test 1: GET /health
    console.log('[Test 1] GET /health');
    const healthRes = await runRequest({ path: '/health', method: 'GET' });
    assert(healthRes.status === 200, 'Health check returns status 200');
    assert(healthRes.data?.status === 'ok', 'Health response payload has status: "ok"');

    // Test 2: POST /transcribe with speech MP4
    console.log('\n[Test 2] POST /transcribe with valid MP4 video containing speech');
    const validUpload = createMultipartFormData('test_assets/speech_test.mp4', 'video');
    const transcribeRes = await runRequest(
      { path: '/transcribe', method: 'POST' },
      validUpload.body,
      { 'Content-Type': validUpload.contentType }
    );
    assert(transcribeRes.status === 200, `Transcription returns status 200 (got ${transcribeRes.status})`);
    assert(transcribeRes.data?.success === true, 'Response contains success: true');
    assert(typeof transcribeRes.data?.filename === 'string', 'Response contains valid filename');
    assert(typeof transcribeRes.data?.language === 'string', `Response contains detected language: "${transcribeRes.data?.language}"`);
    assert(Array.isArray(transcribeRes.data?.segments), 'Response contains segments array');
    assert(transcribeRes.data?.segments?.length > 0, `Segments array has ${transcribeRes.data?.segments?.length} segment(s)`);
    assert(typeof transcribeRes.data?.segments[0]?.start === 'number', 'Segment has numeric start timestamp');
    assert(typeof transcribeRes.data?.segments[0]?.end === 'number', 'Segment has numeric end timestamp');
    assert(typeof transcribeRes.data?.segments[0]?.text === 'string', `Segment has text: "${transcribeRes.data?.segments[0]?.text}"`);

    // Test 3: Temporary files cleanup check
    console.log('\n[Test 3] Verify temporary files cleanup');
    const uploadsDir = path.resolve('uploads');
    const remainingFiles = fs.readdirSync(uploadsDir).filter((f) => f !== '.gitkeep');
    assert(remainingFiles.length === 0, `Temporary upload directory is completely clean (remaining: ${remainingFiles.length})`);

    // Test 4: POST /transcribe with invalid file type (e.g. .txt)
    console.log('\n[Test 4] POST /transcribe with invalid file type (.txt)');
    const invalidUpload = createMultipartFormData('test_assets/invalid_file.txt', 'video');
    const invalidRes = await runRequest(
      { path: '/transcribe', method: 'POST' },
      invalidUpload.body,
      { 'Content-Type': invalidUpload.contentType }
    );
    assert(invalidRes.status === 400, `Rejects invalid file format with status 400 (got ${invalidRes.status})`);
    assert(invalidRes.data?.success === false, 'Returns success: false for invalid file format');

    // Test 5: POST /transcribe with no file uploaded
    console.log('\n[Test 5] POST /transcribe without file');
    const noFileRes = await runRequest(
      { path: '/transcribe', method: 'POST' },
      '',
      {}
    );
    assert(noFileRes.status === 400, `Rejects request without file with status 400 (got ${noFileRes.status})`);

    // Test 6: POST /transcribe with video with no audio stream
    console.log('\n[Test 6] POST /transcribe with video missing audio stream');
    const noAudioUpload = createMultipartFormData('test_assets/no_audio_test.mp4', 'video');
    const noAudioRes = await runRequest(
      { path: '/transcribe', method: 'POST' },
      noAudioUpload.body,
      { 'Content-Type': noAudioUpload.contentType }
    );
    assert(noAudioRes.status === 500, `Handles video without audio stream with status 500 (got ${noAudioRes.status})`);
    assert(
      typeof noAudioRes.data?.error === 'string' && noAudioRes.data?.error.toLowerCase().includes('audio'),
      `Provides clear error message regarding audio stream: "${noAudioRes.data?.error}"`
    );

    // Final clean check
    const finalCleanCheck = fs.readdirSync(uploadsDir).filter((f) => f !== '.gitkeep');
    assert(finalCleanCheck.length === 0, `Temporary upload directory remains clean after all tests`);

  } finally {
    server.close();
  }

  console.log(`\n================================`);
  console.log(`Test Summary: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log(`================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
