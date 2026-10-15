const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { healthCheck, transcribeVideo } = require('../controllers/transcription.controller');

const router = express.Router();

// Ensure uploads directory exists
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `upload-${uniqueSuffix}${ext}`);
  }
});

// Allowed video MIME types and extensions
const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/avi',
  'video/x-msvideo',
  'application/octet-stream' // Some clients report MP4s as octet-stream
]);

const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi']);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isAllowedExt = ALLOWED_EXTENSIONS.has(ext);
  const isAllowedMime = ALLOWED_MIME_TYPES.has(file.mimetype) || file.mimetype.startsWith('video/');

  if (isAllowedExt && isAllowedMime) {
    cb(null, true);
  } else {
    const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
    error.message = `Unsupported file type "${ext || file.mimetype}". Only video files (MP4, MOV, WEBM, MKV, AVI) are supported.`;
    cb(error, false);
  }
};

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '200', 10);
const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSizeMB * 1024 * 1024 // e.g. 200MB
  },
  fileFilter
});

// Middleware to accept either 'video' or 'file' field names seamlessly
const uploadMiddleware = (req, res, next) => {
  const uploader = upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ]);

  uploader(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: `File exceeds maximum allowed size of ${maxFileSizeMB} MB.`
          });
        }
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message || 'Error processing uploaded file.'
      });
    }

    // Normalize req.file from fields
    if (req.files) {
      if (req.files.video && req.files.video.length > 0) {
        req.file = req.files.video[0];
      } else if (req.files.file && req.files.file.length > 0) {
        req.file = req.files.file[0];
      }
    }

    next();
  });
};

router.get('/health', healthCheck);
router.post('/transcribe', uploadMiddleware, transcribeVideo);

module.exports = router;
