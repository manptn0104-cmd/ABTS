const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/bikeAmbulanceController');
const { protect, authorize } = require('../middleware/auth');

// ── Public / User ────────────────────────────────────────────────────────────
router.get('/nearby',         protect, ctrl.getNearby);
router.get('/recommendation', protect, ctrl.getRecommendation);
router.get('/my-bookings',    protect, ctrl.getMyBikeBookings);

// ── Driver ────────────────────────────────────────────────────────────────────
router.get('/mine', protect, authorize('driver', 'admin'), ctrl.getMyBike);
router.put('/:id/location', protect, ctrl.updateLocation);

// ── Booking lifecycle ────────────────────────────────────────────────────────
router.post('/:id/assign',  protect, ctrl.assignBike);
router.put('/:id/status',   protect, ctrl.updateStatus);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/',                  protect, authorize('admin', 'superadmin'), ctrl.listAll);
router.post('/',                 protect, authorize('admin', 'superadmin'), ctrl.register);
router.delete('/:id',            protect, authorize('admin', 'superadmin'), ctrl.deregister);
router.get('/emergency-config',  protect, authorize('admin', 'superadmin'), ctrl.getConfig);
router.put('/emergency-config',  protect, authorize('admin', 'superadmin'), ctrl.updateConfig);

// ── Assign shortcut (from admin/recommendation) ──────────────────────────────
router.post('/assign', protect, ctrl.assignBike);

module.exports = router;
