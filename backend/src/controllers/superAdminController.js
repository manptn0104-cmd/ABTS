const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Booking = require('../models/Booking');
const { logAudit } = require('../utils/audit');

// POST /api/super-admin/admins
exports.createAdmin = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email or phone already registered.' });
    }

    const admin = await User.create({
      name,
      email,
      phone: String(phone).replace(/\D/g, ''),
      password,
      role: 'admin',
      isVerified: true,
    });

    await logAudit({
      actorId: req.user._id,
      action: 'admin_created',
      targetType: 'admin',
      targetId: admin._id,
      ip: req.ip,
    });

    res.status(201).json({ success: true, message: 'Admin created.', user: admin });
  } catch (error) {
    next(error);
  }
};

// GET /api/super-admin/admins
exports.listAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ role: 'admin' }).sort({ createdAt: -1 });
    res.json({ success: true, admins });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/super-admin/admins/:id
exports.deleteAdmin = async (req, res, next) => {
  try {
    const admin = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    await User.deleteOne({ _id: admin._id });

    await logAudit({
      actorId: req.user._id,
      action: 'admin_deleted',
      targetType: 'admin',
      targetId: admin._id,
      ip: req.ip,
    });

    res.json({ success: true, message: 'Admin deleted.' });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/super-admin/admins/:id/suspend
exports.suspendAdmin = async (req, res, next) => {
  try {
    const admin = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    admin.isSuspended = !admin.isSuspended;
    admin.suspendedAt = admin.isSuspended ? new Date() : null;
    admin.suspendedReason = req.body.reason || null;
    await admin.save();

    await logAudit({
      actorId: req.user._id,
      action: admin.isSuspended ? 'admin_suspended' : 'admin_unsuspended',
      targetType: 'admin',
      targetId: admin._id,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: admin.isSuspended ? 'Admin suspended.' : 'Admin reactivated.',
      user: admin,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/super-admin/audit-logs
exports.getAuditLogs = async (req, res, next) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const logs = await AuditLog.find()
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ success: true, logs });
  } catch (error) {
    next(error);
  }
};

// GET /api/super-admin/analytics-overview
exports.getOverview = async (req, res, next) => {
  try {
    const [admins, drivers, users, bookings, revenue] = await Promise.all([
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'driver' }),
      User.countDocuments({ role: 'user' }),
      Booking.countDocuments(),
      Booking.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$fare.total' } } },
      ]),
    ]);

    res.json({
      success: true,
      overview: {
        admins,
        drivers,
        users,
        bookings,
        revenue: revenue[0]?.total || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};
