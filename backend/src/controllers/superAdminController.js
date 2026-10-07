const User         = require('../models/User');
const Ambulance    = require('../models/Ambulance');
const Booking      = require('../models/Booking');
const Organization = require('../models/Organization');
const Feedback     = require('../models/Feedback');
const Complaint    = require('../models/Complaint');
const Subscription = require('../models/Subscription');
const Payment      = require('../models/Payment');

// ── Dashboard Stats ─────────────────────────────────────────────────────────
exports.getDashboardStats = async (req, res, next) => {
  try {
    const now        = new Date();
    const today      = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrgs, activeOrgs, suspendedOrgs, expiredOrgs, pendingOrgs, newOrgs,
      totalAmbulances, availableAmbulances, maintenanceAmbulances, offlineAmbulances,
      totalUsers, newUsersToday, newUsersMonthly, blockedUsers,
      totalDrivers, onlineDrivers, pendingDrivers, suspendedDrivers,
      totalBookings, todayBookings, completedBookings, ongoingBookings,
      cancelledBookings,
      revenueAgg, monthlyRevenueAgg, subRevAgg,
    ] = await Promise.all([
      Organization.countDocuments(),
      Organization.countDocuments({ status: 'active' }),
      Organization.countDocuments({ status: 'suspended' }),
      Organization.countDocuments({ status: 'expired' }),
      Organization.countDocuments({ status: 'pending' }),
      Organization.countDocuments({ createdAt: { $gte: monthStart } }),

      Ambulance.countDocuments(),
      Ambulance.countDocuments({ isAvailable: true, status: 'active' }),
      Ambulance.countDocuments({ status: 'maintenance' }),
      Ambulance.countDocuments({ status: 'offline' }),

      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'user', createdAt: { $gte: today } }),
      User.countDocuments({ role: 'user', createdAt: { $gte: monthStart } }),
      User.countDocuments({ role: 'user', isBlocked: true }),

      User.countDocuments({ role: 'driver' }),
      User.countDocuments({ role: 'driver', isOnline: true }),
      User.countDocuments({ role: 'driver', licenseVerified: false }),
      User.countDocuments({ role: 'driver', isBlocked: true }),

      Booking.countDocuments(),
      Booking.countDocuments({ createdAt: { $gte: today } }),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ status: 'in_progress' }),
      Booking.countDocuments({ status: { $in: ['cancelled', 'rejected'] } }),

      Booking.aggregate([
        { $match: { status: 'completed', paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$fare.total' } } },
      ]),
      Booking.aggregate([
        { $match: { status: 'completed', paymentStatus: 'paid', createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$fare.total' } } },
      ]),
      Payment.aggregate([
        { $match: { type: 'subscription', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const busyAmbulances = await Booking.distinct('ambulance', { status: 'in_progress' });
    const activeUsers    = await User.countDocuments({ role: 'user', isActive: true, isBlocked: false });
    const pendingPayCount= await Booking.countDocuments({ status: 'completed', paymentStatus: 'pending' });

    res.json({
      success: true,
      stats: {
        organizations: {
          total: totalOrgs, active: activeOrgs, suspended: suspendedOrgs,
          expired: expiredOrgs, pending: pendingOrgs, newlyRegistered: newOrgs,
        },
        ambulances: {
          total: totalAmbulances,
          active: totalAmbulances - maintenanceAmbulances - offlineAmbulances,
          available: availableAmbulances,
          busy: busyAmbulances.length,
          offline: offlineAmbulances,
          underMaintenance: maintenanceAmbulances,
        },
        users: {
          total: totalUsers, active: activeUsers,
          newToday: newUsersToday, monthlyGrowth: newUsersMonthly, blocked: blockedUsers,
        },
        drivers: {
          total: totalDrivers,
          active: totalDrivers - suspendedDrivers,
          online: onlineDrivers,
          offline: totalDrivers - onlineDrivers,
          pendingVerification: pendingDrivers,
          suspended: suspendedDrivers,
        },
        bookings: {
          total: totalBookings, today: todayBookings, completed: completedBookings,
          ongoing: ongoingBookings, cancelled: cancelledBookings,
        },
        revenue: {
          total: revenueAgg[0]?.total || 0,
          monthly: monthlyRevenueAgg[0]?.total || 0,
          pending: pendingPayCount,
          subscription: subRevAgg[0]?.total || 0,
        },
      },
    });
  } catch (error) { next(error); }
};

// ── Organization Management ──────────────────────────────────────────────────
exports.getOrganizations = async (req, res, next) => {
  try {
    const { search, status, city, state, plan, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (city)   filter.city   = new RegExp(city, 'i');
    if (state)  filter.state  = new RegExp(state, 'i');
    if (plan)   filter.subscriptionPlan = plan;
    if (search) filter.$or = [
      { name:  new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
    ];

    const skip  = (Number(page) - 1) * Number(limit);
    const [orgs, total] = await Promise.all([
      Organization.find(filter)
        .populate('subscriptionPlan', 'name price duration')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Organization.countDocuments(filter),
    ]);
    res.json({ success: true, organizations: orgs, total, page: Number(page), limit: Number(limit) });
  } catch (error) { next(error); }
};

exports.createOrganization = async (req, res, next) => {
  try {
    const org = await Organization.create(req.body);
    res.status(201).json({ success: true, message: 'Organization created.', organization: org });
  } catch (error) { next(error); }
};

exports.updateOrganization = async (req, res, next) => {
  try {
    const org = await Organization.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found.' });
    res.json({ success: true, message: 'Organization updated.', organization: org });
  } catch (error) { next(error); }
};

exports.updateOrgStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const allowed = ['active', 'suspended', 'expired', 'pending'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
    const update = { status };
    if (notes) update.notes = notes;
    const org = await Organization.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found.' });
    res.json({ success: true, message: `Organization ${status}.`, organization: org });
  } catch (error) { next(error); }
};

exports.deleteOrganization = async (req, res, next) => {
  try {
    const org = await Organization.findByIdAndDelete(req.params.id);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found.' });
    res.json({ success: true, message: 'Organization deleted.' });
  } catch (error) { next(error); }
};

// ── Ambulance Management ────────────────────────────────────────────────────
exports.getAmbulances = async (req, res, next) => {
  try {
    const { search, status, orgId, type, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (orgId)  filter.organization = orgId;
    if (type)   filter.type = type;
    if (search) filter.$or = [
      { vehicleNumber: new RegExp(search, 'i') },
      { driverName:   new RegExp(search, 'i') },
      { driverPhone:  new RegExp(search, 'i') },
    ];

    const skip = (Number(page) - 1) * Number(limit);
    const [ambulances, total] = await Promise.all([
      Ambulance.find(filter)
        .populate('organization', 'name city state')
        .populate('owner', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Ambulance.countDocuments(filter),
    ]);
    res.json({ success: true, ambulances, total, page: Number(page), limit: Number(limit) });
  } catch (error) { next(error); }
};

exports.updateAmbulanceStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['active', 'offline', 'maintenance'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
    const update = { status };
    if (status !== 'maintenance') update.maintenanceUntil = null;
    if (req.body.maintenanceUntil) update.maintenanceUntil = req.body.maintenanceUntil;
    const amb = await Ambulance.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!amb) return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    res.json({ success: true, message: `Ambulance status updated to ${status}.`, ambulance: amb });
  } catch (error) { next(error); }
};

// ── User Management ──────────────────────────────────────────────────────────
exports.getUsers = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const filter = { role: 'user' };
    if (status === 'blocked')  filter.isBlocked = true;
    if (status === 'inactive') filter.isActive  = false;
    if (status === 'active')   { filter.isBlocked = false; filter.isActive = true; }
    if (search) filter.$or = [
      { name:  new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
    ];

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, users, total, page: Number(page), limit: Number(limit) });
  } catch (error) { next(error); }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const { action } = req.body;
    const update = {};
    if (action === 'block')    { update.isBlocked = true;  update.isActive = false; }
    if (action === 'unblock')  { update.isBlocked = false; update.isActive = true; }
    if (action === 'activate') { update.isActive  = true;  }
    if (action === 'deactivate') { update.isActive = false; }
    if (!Object.keys(update).length) return res.status(400).json({ success: false, message: 'Invalid action.' });
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: `User ${action}ed.`, user });
  } catch (error) { next(error); }
};

exports.getUserBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.params.id })
      .populate('ambulance', 'vehicleNumber type driverName')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, bookings });
  } catch (error) { next(error); }
};

// ── Driver Management ────────────────────────────────────────────────────────
exports.getDrivers = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const filter = { role: 'driver' };
    if (status === 'suspended')          filter.isBlocked = true;
    if (status === 'active')             { filter.isBlocked = false; filter.isActive = true; }
    if (status === 'online')             filter.isOnline = true;
    if (status === 'pending')            filter.licenseVerified = false;
    if (search) filter.$or = [
      { name:  new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
    ];

    const skip = (Number(page) - 1) * Number(limit);
    const [drivers, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      User.countDocuments(filter),
    ]);

    // Attach ambulance info
    const driverIds  = drivers.map((d) => d._id);
    const ambulances = await Ambulance.find({ owner: { $in: driverIds } }).lean();
    const ambMap     = {};
    ambulances.forEach((a) => { ambMap[a.owner.toString()] = a; });

    const enriched = drivers.map((d) => ({ ...d, ambulance: ambMap[d._id.toString()] || null }));
    res.json({ success: true, drivers: enriched, total, page: Number(page), limit: Number(limit) });
  } catch (error) { next(error); }
};

exports.updateDriverStatus = async (req, res, next) => {
  try {
    const { action } = req.body;
    const update = {};
    if (action === 'verify')    update.licenseVerified = true;
    if (action === 'suspend')   { update.isBlocked = true;  update.isOnline = false; }
    if (action === 'activate')  { update.isBlocked = false; update.isActive = true; }
    if (!Object.keys(update).length) return res.status(400).json({ success: false, message: 'Invalid action.' });
    const driver = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'driver' }, update, { new: true }
    ).select('-password');
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });
    res.json({ success: true, message: `Driver ${action}d.`, driver });
  } catch (error) { next(error); }
};

// ── Feedback Management ──────────────────────────────────────────────────────
exports.getFeedback = async (req, res, next) => {
  try {
    const { type, status, minRating, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type)      filter.type   = type;
    if (status)    filter.status = status;
    if (minRating) filter.rating = { $gte: Number(minRating) };

    const skip = (Number(page) - 1) * Number(limit);
    const [feedback, total] = await Promise.all([
      Feedback.find(filter)
        .populate('user', 'name email phone')
        .populate('organization', 'name city')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Feedback.countDocuments(filter),
    ]);
    res.json({ success: true, feedback, total, page: Number(page), limit: Number(limit) });
  } catch (error) { next(error); }
};

exports.getFeedbackAnalytics = async (req, res, next) => {
  try {
    const [overall, byType, bookingRatings] = await Promise.all([
      Feedback.aggregate([{ $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }]),
      Feedback.aggregate([{ $group: { _id: '$type', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }]),
      Booking.aggregate([
        { $match: { 'rating.stars': { $exists: true } } },
        { $group: { _id: null, avgRating: { $avg: '$rating.stars' }, count: { $sum: 1 } } },
      ]),
    ]);

    const byTypeMap = {};
    byType.forEach((t) => { byTypeMap[t._id] = { avgRating: t.avgRating, count: t.count }; });

    res.json({
      success: true,
      analytics: {
        overall:              { avgRating: overall[0]?.avgRating?.toFixed(2) || 0, count: overall[0]?.count || 0 },
        byType:               byTypeMap,
        bookingAvgRating:     bookingRatings[0]?.avgRating?.toFixed(2) || 0,
        bookingRatingCount:   bookingRatings[0]?.count || 0,
        satisfactionIndex:    Math.round(((overall[0]?.avgRating || 0) / 5) * 100),
      },
    });
  } catch (error) { next(error); }
};

exports.updateFeedbackStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const fb = await Feedback.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found.' });
    res.json({ success: true, message: 'Feedback status updated.', feedback: fb });
  } catch (error) { next(error); }
};

// ── Complaint Management ─────────────────────────────────────────────────────
exports.getComplaints = async (req, res, next) => {
  try {
    const { status, priority, category, submitterType, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status)        filter.status        = status;
    if (priority)      filter.priority      = priority;
    if (category)      filter.category      = category;
    if (submitterType) filter.submitterType = submitterType;

    const skip = (Number(page) - 1) * Number(limit);
    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .populate('submittedBy', 'name email phone')
        .populate('assignedTo', 'name email')
        .populate('organization', 'name city')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Complaint.countDocuments(filter),
    ]);
    res.json({ success: true, complaints, total, page: Number(page), limit: Number(limit) });
  } catch (error) { next(error); }
};

exports.updateComplaintAction = async (req, res, next) => {
  try {
    const { action, assignedTo, resolution, escalationReason } = req.body;
    const statusMap = {
      assign:    'assigned',
      escalate:  'escalated',
      resolve:   'resolved',
      close:     'closed',
      reopen:    'reopened',
      start:     'in_progress',
    };
    const newStatus = statusMap[action];
    if (!newStatus) return res.status(400).json({ success: false, message: 'Invalid action.' });

    const update = { status: newStatus };
    if (assignedTo)       update.assignedTo       = assignedTo;
    if (resolution)       update.resolution       = resolution;
    if (escalationReason) update.escalationReason = escalationReason;

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('submittedBy', 'name email')
      .populate('assignedTo', 'name email');
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });
    res.json({ success: true, message: `Complaint ${action}d.`, complaint });
  } catch (error) { next(error); }
};

// ── Subscription Management ──────────────────────────────────────────────────
exports.getSubscriptionPlans = async (req, res, next) => {
  try {
    const plans = await Subscription.find().sort({ price: 1 }).lean();
    // Attach org count per plan
    const planIds = plans.map((p) => p._id);
    const orgCounts = await Organization.aggregate([
      { $match: { subscriptionPlan: { $in: planIds } } },
      { $group: { _id: '$subscriptionPlan', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    orgCounts.forEach((c) => { countMap[c._id.toString()] = c.count; });
    const enriched = plans.map((p) => ({ ...p, orgCount: countMap[p._id.toString()] || 0 }));
    res.json({ success: true, plans: enriched });
  } catch (error) { next(error); }
};

exports.createSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await Subscription.create(req.body);
    res.status(201).json({ success: true, message: 'Subscription plan created.', plan });
  } catch (error) { next(error); }
};

exports.updateSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await Subscription.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    res.json({ success: true, message: 'Plan updated.', plan });
  } catch (error) { next(error); }
};

exports.deleteSubscriptionPlan = async (req, res, next) => {
  try {
    const plan = await Subscription.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    res.json({ success: true, message: 'Plan deleted.' });
  } catch (error) { next(error); }
};

exports.assignSubscription = async (req, res, next) => {
  try {
    const { orgId, planId, expiryDays } = req.body;
    const plan = await Subscription.findById(planId);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + (expiryDays || plan.duration));
    const org = await Organization.findByIdAndUpdate(orgId, {
      subscriptionPlan: planId, subscriptionExpiry: expiry, subscriptionStarted: new Date(), status: 'active',
    }, { new: true });
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found.' });

    // Create payment record
    const gst = (plan.price * plan.gstPercent) / 100;
    await Payment.create({
      organization: orgId, subscription: planId,
      amount: plan.price, gstAmount: gst, totalAmount: plan.price + gst,
      type: 'subscription', status: 'completed',
      invoiceNumber: `INV-${Date.now()}`,
    });
    res.json({ success: true, message: 'Subscription assigned.', organization: org });
  } catch (error) { next(error); }
};

// ── Payment / Billing ────────────────────────────────────────────────────────
exports.getPayments = async (req, res, next) => {
  try {
    const { type, status, orgId, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type)   filter.type         = type;
    if (status) filter.status       = status;
    if (orgId)  filter.organization = orgId;

    const skip = (Number(page) - 1) * Number(limit);
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('organization', 'name city state')
        .populate('subscription', 'name price duration')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Payment.countDocuments(filter),
    ]);

    const revenueAgg = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$type', total: { $sum: '$totalAmount' } } },
    ]);
    const revenueMap = {};
    revenueAgg.forEach((r) => { revenueMap[r._id] = r.total; });

    res.json({ success: true, payments, total, page: Number(page), limit: Number(limit), summary: revenueMap });
  } catch (error) { next(error); }
};

// ── Notification Management ──────────────────────────────────────────────────
exports.sendNotification = async (req, res, next) => {
  try {
    const { title, message, recipientType, orgIds } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, message: 'Title and message are required.' });

    let recipientCount = 0;
    const roleMap = {
      all_users: 'user', drivers: 'driver', all: null,
      org_admins: 'admin',
    };

    if (recipientType === 'all') {
      recipientCount = await User.countDocuments({ isActive: true });
    } else if (roleMap[recipientType]) {
      recipientCount = await User.countDocuments({ role: roleMap[recipientType], isActive: true });
    } else if (recipientType === 'selected_orgs' && orgIds?.length) {
      recipientCount = await User.countDocuments({ organization: { $in: orgIds }, isActive: true });
    }

    // In a real system this would dispatch FCM/SMS/Email jobs
    // Here we log and return success
    console.log(`[NOTIFICATION] "${title}" → ${recipientType} (${recipientCount} recipients)`);

    res.json({ success: true, message: 'Notification queued successfully.', recipientCount });
  } catch (error) { next(error); }
};

// ── Analytics & Reports ──────────────────────────────────────────────────────
exports.getReports = async (req, res, next) => {
  try {
    const { orgId, city, state, startDate, endDate, ambulanceType } = req.query;
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate)   dateFilter.$lte = new Date(endDate);

    const bookingFilter = {};
    if (Object.keys(dateFilter).length) bookingFilter.createdAt = dateFilter;
    if (ambulanceType) {
      const ambs = await Ambulance.distinct('_id', { type: ambulanceType });
      bookingFilter.ambulance = { $in: ambs };
    }

    let orgFilter = {};
    if (orgId)  orgFilter._id   = orgId;
    if (city)   orgFilter.city  = new RegExp(city,  'i');
    if (state)  orgFilter.state = new RegExp(state, 'i');

    const orgs = await Organization.find(orgFilter).lean();

    const reportRows = await Promise.all(orgs.map(async (org) => {
      const orgAmbIds = await Ambulance.distinct('_id', { organization: org._id });
      const filter    = { ...bookingFilter, ambulance: { $in: orgAmbIds } };
      const [total, completed, cancelled, revenue, avgTime] = await Promise.all([
        Booking.countDocuments(filter),
        Booking.countDocuments({ ...filter, status: 'completed' }),
        Booking.countDocuments({ ...filter, status: { $in: ['cancelled', 'rejected'] } }),
        Booking.aggregate([
          { $match: { ...filter, status: 'completed', paymentStatus: 'paid' } },
          { $group: { _id: null, total: { $sum: '$fare.total' } } },
        ]),
        Booking.aggregate([
          { $match: { ...filter, status: 'completed' } },
          { $group: { _id: null, avgTime: { $avg: '$estimatedTime' } } },
        ]),
      ]);
      const ambulances = await Ambulance.countDocuments({ organization: org._id });
      const drivers    = await User.countDocuments({ organization: org._id, role: 'driver' });
      const users      = await User.countDocuments({ organization: org._id, role: 'user' });
      return {
        organization:     org.name,
        city:             org.city,
        state:            org.state,
        status:           org.status,
        ambulances,
        drivers,
        users,
        totalBookings:    total,
        completedTrips:   completed,
        cancelledTrips:   cancelled,
        revenue:          revenue[0]?.total || 0,
        avgResponseTime:  Math.round(avgTime[0]?.avgTime || 0),
        fleetUtilization: ambulances > 0 ? Math.round((total / ambulances) * 100) / 100 : 0,
      };
    }));

    const summary = reportRows.reduce((acc, r) => ({
      totalBookings:  acc.totalBookings  + r.totalBookings,
      completedTrips: acc.completedTrips + r.completedTrips,
      cancelledTrips: acc.cancelledTrips + r.cancelledTrips,
      revenue:        acc.revenue        + r.revenue,
    }), { totalBookings: 0, completedTrips: 0, cancelledTrips: 0, revenue: 0 });

    res.json({ success: true, report: reportRows, summary, generatedAt: new Date() });
  } catch (error) { next(error); }
};
