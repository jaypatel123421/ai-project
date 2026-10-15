require('dotenv').config();
const express = require('express');
const cors = require('cors');
const transcriptionRoutes = require('./routes/transcription.routes');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Mount Routes
app.use('/', transcriptionRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server if not imported by test runner
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`🚀 Video Transcription API Server is running!`);
    console.log(`📍 Local Address: http://127.0.0.1:${PORT}`);
    console.log(`📍 Network Address: http://0.0.0.0:${PORT}`);
    console.log(`📡 Endpoints:`);
    console.log(`   GET  /health`);
    console.log(`   POST /transcribe (multipart/form-data: "video")`);
    console.log(`===============================================`);
  });

  const shutdown = () => {
    console.log('\nGracefully shutting down server...');
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;
