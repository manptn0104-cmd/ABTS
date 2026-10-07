const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const sa = require('../controllers/superAdminController');

// All routes require a logged-in superadmin
router.use(protect);
router.use(authorize('superadmin'));

// Dashboard
router.get('/stats', sa.getDashboardStats);

// Organizations
router.get   ('/organizations',           sa.getOrganizations);
router.post  ('/organizations',           sa.createOrganization);
router.put   ('/organizations/:id',       sa.updateOrganization);
router.patch ('/organizations/:id/status',sa.updateOrgStatus);
router.delete('/organizations/:id',       sa.deleteOrganization);

// Subscriptions
router.get   ('/subscriptions',     sa.getSubscriptionPlans);
router.post  ('/subscriptions',     sa.createSubscriptionPlan);
router.put   ('/subscriptions/:id', sa.updateSubscriptionPlan);
router.delete('/subscriptions/:id', sa.deleteSubscriptionPlan);
router.post  ('/subscriptions/assign', sa.assignSubscription);

// Ambulances
router.get  ('/ambulances',           sa.getAmbulances);
router.patch('/ambulances/:id/status',sa.updateAmbulanceStatus);

// Users
router.get  ('/users',              sa.getUsers);
router.patch('/users/:id/status',   sa.updateUserStatus);
router.get  ('/users/:id/bookings', sa.getUserBookings);

// Drivers
router.get  ('/drivers',            sa.getDrivers);
router.patch('/drivers/:id/status', sa.updateDriverStatus);

// Feedback
router.get  ('/feedback',               sa.getFeedback);
router.get  ('/feedback/analytics',     sa.getFeedbackAnalytics);
router.patch('/feedback/:id/status',    sa.updateFeedbackStatus);

// Complaints
router.get  ('/complaints',           sa.getComplaints);
router.patch('/complaints/:id/action',sa.updateComplaintAction);

// Payments
router.get('/payments', sa.getPayments);

// Notifications
router.post('/notifications/send', sa.sendNotification);

// Reports
router.get('/reports', sa.getReports);

module.exports = router;
