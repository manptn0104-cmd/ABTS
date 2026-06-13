const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Base upload directories
const AMBULANCE_ROOT = path.join(__dirname, '../../uploads/ambulance-docs');
const DRIVER_ROOT = path.join(__dirname, '../../uploads/driver-docs');

// Ensure root directories exist
[AMBULANCE_ROOT, DRIVER_ROOT].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

// Generic storage generator
const makeStorage = (baseRoot, paramName) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const id = req.params[paramName] || 'temp';
      const dir = path.join(baseRoot, id);
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

// Ambulance document upload middleware
const uploadAmbulanceDocs = multer({
  storage: makeStorage(AMBULANCE_ROOT, 'ambulanceId'),
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

// Driver document upload middleware
const uploadDriverDocs = multer({
  storage: makeStorage(DRIVER_ROOT, 'driverId'),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: 'aadhaarImage', maxCount: 1 },
  { name: 'licenceImage', maxCount: 1 },
  { name: 'driverPhoto', maxCount: 1 },
]);

module.exports = { uploadAmbulanceDocs, uploadDriverDocs, AMBULANCE_ROOT, DRIVER_ROOT };
