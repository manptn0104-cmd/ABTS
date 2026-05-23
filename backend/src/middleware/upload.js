const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads/ambulance-docs');

if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_ROOT, req.params.ambulanceId || 'temp');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    const safeField = (file.fieldname || 'file').replace(/[^a-z0-9_]/gi, '');
    cb(null, `${safeField}-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, and PDF files are allowed.'), false);
  }
};

const uploadAmbulanceDocs = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: 'insurance', maxCount: 1 },
  { name: 'pollutionCertificate', maxCount: 1 },
  { name: 'rcBook', maxCount: 1 },
  { name: 'driverLicense', maxCount: 1 },
  { name: 'aadhaar', maxCount: 1 },
  { name: 'ambulanceImage', maxCount: 1 },
]);

module.exports = { uploadAmbulanceDocs, UPLOAD_ROOT };
