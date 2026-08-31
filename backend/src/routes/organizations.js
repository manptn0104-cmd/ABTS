const express = require('express');
const router  = express.Router();
const { protect, authorizeSuperAdmin } = require('../middleware/auth');
const {
  createOrganization,
  getAllOrganizations,
  getOrganizationById,
  updateOrganization,
  updateOrganizationStatus,
  deleteOrganization,
  restoreOrganization,
} = require('../controllers/organizationController');

router.use(protect);
router.use(authorizeSuperAdmin);

router.post('/',                  createOrganization);
router.get('/',                   getAllOrganizations);
router.get('/:id',                getOrganizationById);
router.put('/:id',                updateOrganization);
router.patch('/:id/status',       updateOrganizationStatus);
router.delete('/:id',             deleteOrganization);
router.patch('/:id/restore',      restoreOrganization);

module.exports = router;
