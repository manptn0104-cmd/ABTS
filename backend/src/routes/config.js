const express = require('express');
const router  = express.Router();
const { getConfig, updateConfig } = require('../controllers/configController');
const { protect, authorize }      = require('../middleware/auth');

// Public — frontend fetches this on boot to get dynamic config
router.get('/', getConfig);

// SuperAdmin only — update a single config key at runtime
router.put('/:key', protect, authorize('superadmin'), updateConfig);

module.exports = router;
