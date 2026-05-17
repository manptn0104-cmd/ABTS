const User      = require('../models/User');
const Ambulance = require('../models/Ambulance');
const Booking   = require('../models/Booking');

// GET /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const [
      totalUsers, totalDrivers, totalAmbulances, totalBookings,
      pendingBookings, completedBookings, cancelledBookings,
      availableAmbulances,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'driver' }),
      Ambulance.countDocuments(),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ status: { $in: ['cancelled', 'rejected'] } }),
      Ambulance.countDocuments({ isAvailable: true }),
    ]);

    // Total revenue from completed bookings
    const revenueAgg = await Booking.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$estimatedFare' } } },
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    // Recent 5 bookings
    const recentBookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name phone')
      .populate('ambulance', 'vehicleNumber driverName type');

    res.json({
      success: true,
      stats: {
        totalUsers, totalDrivers, totalAmbulances, totalBookings,
        pendingBookings, completedBookings, cancelledBookings,
        availableAmbulances, totalRevenue,
      },
      recentBookings,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/bookings?page=1&limit=20&status=
exports.getAllBookings = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const skip   = (page - 1) * limit;
    const filter = req.query.status ? { status: req.query.status } : {};

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit)
        .populate('user', 'name phone email')
        .populate('ambulance', 'vehicleNumber driverName type'),
      Booking.countDocuments(filter),
    ]);

    res.json({ success: true, bookings, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/users
exports.getAllUsers = async (req, res, next) => {
  try {
    const role  = req.query.role;
    const filter = role ? { role } : { role: { $in: ['user', 'driver'] } };
    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/ambulances
exports.getAllAmbulances = async (req, res, next) => {
  try {
    const ambulances = await Ambulance.find()
      .sort({ createdAt: -1 })
      .populate('owner', 'name email');
    res.json({ success: true, ambulances });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/bookings/:id/status
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('user', 'name phone').populate('ambulance', 'vehicleNumber driverName');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/ambulances  — register a new ambulance (admin creates it, assigns to a driver)
exports.registerAmbulance = async (req, res, next) => {
  try {
    const {
      vehicleNumber, driverName, driverPhone, driverLicense,
      type, pricePerKm, basePrice, specializations,
      facilities, ownerId,
    } = req.body;

    if (!vehicleNumber || !driverName || !driverPhone || !driverLicense || !ownerId) {
      return res.status(400).json({ success: false, message: 'vehicleNumber, driverName, driverPhone, driverLicense and ownerId are required.' });
    }

    const owner = await User.findById(ownerId);
    if (!owner || owner.role !== 'driver') {
      return res.status(400).json({ success: false, message: 'ownerId must reference an existing driver account.' });
    }

    const existing = await Ambulance.findOne({ vehicleNumber: vehicleNumber.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: `Vehicle ${vehicleNumber.toUpperCase()} is already registered.` });
    }

    const ambulance = await Ambulance.create({
      vehicleNumber,
      driverName,
      driverPhone,
      driverLicense,
      type:            type            || 'basic',
      pricePerKm:      pricePerKm      || 15,
      basePrice:       basePrice       || 300,
      specializations: specializations || ['general'],
      facilities:      facilities      || {},
      owner:           ownerId,
      currentLocation: { type: 'Point', coordinates: [77.5946, 12.9716], address: 'Bangalore' },
    });

    res.status(201).json({ success: true, message: 'Ambulance registered successfully.', ambulance });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/ambulances/:id  — deregister (permanently remove) an ambulance
exports.deregisterAmbulance = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findByIdAndDelete(req.params.id);
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }
    res.json({ success: true, message: `Ambulance ${ambulance.vehicleNumber} deregistered successfully.` });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/bookings/:id/reassign  — reassign a rejected booking to another ambulance
exports.reassignBooking = async (req, res, next) => {
  try {
    const { ambulanceId } = req.body;
    if (!ambulanceId) {
      return res.status(400).json({ success: false, message: 'ambulanceId is required.' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (booking.status !== 'rejected') {
      return res.status(400).json({ success: false, message: 'Only rejected bookings can be reassigned.' });
    }

    const ambulance = await Ambulance.findById(ambulanceId);
    if (!ambulance) return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    if (!ambulance.isAvailable) {
      return res.status(409).json({ success: false, message: 'Selected ambulance is currently unavailable.' });
    }

    booking.ambulance       = ambulanceId;
    booking.status          = 'pending';
    booking.rejectionReason = null;
    await booking.save();

    await booking.populate([
      { path: 'user',      select: 'name phone email' },
      { path: 'ambulance' },
    ]);

    // Notify the new driver via socket
    const { getIO } = require('../services/socketService');
    const io = getIO();
    const driverUser = await User.findById(ambulance.owner);
    if (driverUser) {
      io.to(`user_${driverUser._id}`).emit('new_booking_request', {
        booking,
        message: 'New booking request assigned by admin',
      });
    }
    io.to(`ambulance_${ambulanceId}`).emit('new_booking_request', {
      booking,
      message: 'New booking request received',
    });

    // Notify original patient
    io.to(`user_${booking.user._id}`).emit('booking_status_update', {
      bookingId: booking._id,
      status: 'pending',
      message: 'Your booking has been reassigned to a new ambulance.',
      booking,
    });

    res.json({ success: true, message: 'Booking reassigned successfully.', booking });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/ambulances/:id/availability  — toggle isAvailable
exports.toggleAmbulanceAvailability = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findById(req.params.id);
    if (!ambulance) return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    ambulance.isAvailable = !ambulance.isAvailable;
    await ambulance.save();
    res.json({ success: true, isAvailable: ambulance.isAvailable, message: `Ambulance marked as ${ambulance.isAvailable ? 'available' : 'unavailable'}.` });
  } catch (error) {
    next(error);
  }
};
