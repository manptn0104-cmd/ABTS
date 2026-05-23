const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { protect, authorizeSuperAdmin } = require('../middleware/auth');
const {
  createAdmin,
  listAdmins,
  deleteAdmin,
  suspendAdmin,
  getAuditLogs,
  getOverview,
} = require('../controllers/superAdminController');

router.use(protect);
router.use(authorizeSuperAdmin);

router.get('/overview', getOverview);
router.get('/audit-logs', getAuditLogs);
router.get('/admins', listAdmins);
router.post(
  '/admins',
  [
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('phone').matches(/^[0-9]{10,15}$/),
    body('password').isLength({ min: 6 }),
  ],
  createAdmin
);
router.delete('/admins/:id', deleteAdmin);
router.patch('/admins/:id/suspend', suspendAdmin);

module.exports = router;
