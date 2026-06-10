const Booking = require('../models/Booking');
const Ambulance = require('../models/Ambulance');
const User = require('../models/User');
const { getIO } = require('../services/socketService');

// POST /api/bookings
exports.createBooking = async (req, res, next) => {
  try {
    console.log('REQ BODY:', req.body);
    
    const {
      ambulanceId,
      pickupLocation,
      dropLocation,
      emergencyType,
      patientDetails,
      estimatedDistance = 0,
      paymentMethod = 'cash',
      requiredFacilities = [],
      patientConsent,
    } = req.body;

    if (!ambulanceId || !pickupLocation) {
      return res.status(400).json({ success: false, message: 'ambulanceId and pickupLocation are required.' });
    }

    // Validate emergency contact phone (optional but must be 10 digits if provided)
    if (patientDetails?.emergencyContact?.phone) {
      const phoneRegex = /^[0-9]{10}$/;
      const cleanPhone = patientDetails.emergencyContact.phone.replace(/\D/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Emergency contact phone must be a valid 10-digit number if provided.'
        });
      }
    }

    const ambulance = await Ambulance.findById(ambulanceId);
    if (!ambulance) {
      return res.status(404).json({ success: false, message: 'Ambulance not found.' });
    }
    if (!ambulance.isAvailable) {
      return res.status(409).json({ success: false, message: 'Ambulance is currently unavailable.' });
    }

    const fare = {
      base:  ambulance.basePrice,
      perKm: ambulance.pricePerKm * estimatedDistance,
      total: ambulance.basePrice + ambulance.pricePerKm * estimatedDistance,
    };

    const booking = await Booking.create({
      user: req.user.id,
      ambulance: ambulanceId,
      pickupLocation,
      dropLocation,
      emergencyType,
      requiredFacilities,
      patientDetails,
      estimatedDistance,
      fare,
      paymentMethod,
      patientConsent,
    });

    await booking.populate([
      { path: 'user', select: 'name phone email' },
      { path: 'ambulance' },
    ]);

    const io = getIO();

    // Notify ambulance room (if driver is already connected there)
    io.to(`ambulance_${ambulanceId}`).emit('new_booking_request', {
      booking,
      message: 'New booking request received',
    });

    // Also notify driver's personal room (so they get it even before joining ambulance room)
    const driverUser = await User.findOne({ _id: ambulance.owner });
    if (driverUser) {
      io.to(`user_${driverUser._id}`).emit('new_booking_request', {
        booking,
        message: 'New booking request received',
      });
    }

    // Confirm to user
    io.to(`user_${req.user.id}`).emit('booking_created', {
      bookingId: booking._id,
      message: 'Booking submitted. Waiting for driver confirmation.',
    });

    res.status(201).json({ success: true, message: 'Booking created. Awaiting driver confirmation.', booking });

    // ── Demo simulation: auto-progress booking so UI shows real flow ─────────
  } catch (error) {
    next(error);
  }
};

// GET /api/bookings  (my bookings)
exports.getMyBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { user: req.user.id };
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('ambulance', 'vehicleNumber driverName driverPhone type facilities rating')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);
    res.json({ success: true, count: bookings.length, total, bookings });
  } catch (error) {
    next(error);
  }
};

// GET /api/bookings/:id
exports.getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name phone email')
      .populate('ambulance');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const isOwner = booking.user._id.toString() === req.user.id;
    const isPrivileged = ['admin', 'driver'].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};

// PUT /api/bookings/:id/status  (driver / admin)
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    const booking = await Booking.findById(req.params.id).populate('ambulance');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const validTransitions = {
      pending:     ['confirmed', 'rejected'],
      confirmed:   ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
    };

    if (!validTransitions[booking.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${booking.status}' to '${status}'.`,
      });
    }

    // Handle driver rejection with immediate reassignment
    if (status === 'rejected') {
      const ambulance = booking.ambulance;
      console.log('[Driver Reject] Booking:', booking._id);
      console.log('[Driver Reject] Ambulance:', ambulance?.vehicleNumber);
      console.log('[Driver Reject] Starting immediate reassignment...');

      // 1. Release current ambulance and mark it available
      if (ambulance) {
        await Ambulance.findByIdAndUpdate(ambulance._id, { isAvailable: true });
        console.log(`[Driver Reject] Released ambulance ${ambulance.vehicleNumber} back to available pool`);
      }

      // 2. Find next best ambulance, excluding the rejected one and previous reassignments
      const previousIds = booking.previousAssignments.map((p) => p.ambulanceId);
      if (ambulance) {
        previousIds.push(ambulance._id);
      }

      const { findNextBestAmbulance, reassignBooking } = require('../services/bookingTimeoutService');
      const nextAmbulance = await findNextBestAmbulance(booking, previousIds);

      console.log('[Driver Reject] Next ambulance found:', nextAmbulance?.vehicleNumber);

      if (nextAmbulance) {
        // We found a next ambulance! Assign it immediately.
        const reason = `Driver Rejected: ${rejectionReason || 'No reason provided'}`;
        await reassignBooking(booking, nextAmbulance, ambulance?._id, reason);

        console.log('[Driver Reject] Reassignment completed');

        // Populate for response
        await booking.populate([
          { path: 'user', select: 'name phone email' },
          { path: 'ambulance' },
        ]);

        return res.json({
          success: true,
          message: 'Booking rejected by driver. Reassigned to next best ambulance.',
          booking,
        });
      } else {
        // No next ambulance found. Mark the booking as Rejected.
        console.log('[Driver Reject] No available ambulances for reassignment.');
        booking.status = 'rejected';
        booking.rejectionReason = rejectionReason || 'No available ambulances in the area.';

        // Push the rejection to history
        if (ambulance) {
          booking.previousAssignments.push({
            ambulanceId: ambulance._id,
            driverId: ambulance.owner,
            assignedAt: booking.reassignedAt || booking.assignedAt,
            timeoutAt: new Date(),
            reason: `Driver Rejected (Final): ${rejectionReason || 'No reason provided'}`,
            driverName: ambulance.driverName || 'Unknown',
            vehicleNumber: ambulance.vehicleNumber || 'Unknown',
          });
        }

        await booking.save();
        console.log('[Driver Reject] Reassignment completed');

        // Populate booking data
        await booking.populate([
          { path: 'user', select: 'name phone email' },
          { path: 'ambulance' },
        ]);

        // Notify user about final rejection via socket
        const io = getIO();
        const userId = booking.user._id || booking.user;
        io.to(`user_${userId}`).emit('booking_status_update', {
          bookingId: booking._id,
          status: 'rejected',
          message: `Your booking was rejected by the driver: ${booking.rejectionReason}`,
          booking,
        });
        io.to(`booking_${booking._id}`).emit('booking_status_update', { status: 'rejected', booking });

        return res.json({
          success: true,
          message: 'Booking rejected. No other ambulances available.',
          booking,
        });
      }
    }

    booking.status = status;
    if (status === 'rejected')    booking.rejectionReason = rejectionReason || 'No reason provided';
    if (status === 'confirmed') {
      booking.confirmedAt = new Date();
      await Ambulance.findByIdAndUpdate(booking.ambulance._id, { isAvailable: false });
    }
    if (status === 'in_progress') booking.startedAt = new Date();
    if (status === 'completed') {
      booking.completedAt = new Date();
      await Ambulance.findByIdAndUpdate(booking.ambulance._id, {
        isAvailable: true,
        $inc: { totalTrips: 1 },
      });
    }
    if (status === 'cancelled') {
      booking.cancelledAt = new Date();
      await Ambulance.findByIdAndUpdate(booking.ambulance._id, { isAvailable: true });
    }

    await booking.save();

    // Notify user
    const io = getIO();
    io.to(`user_${booking.user}`).emit('booking_status_update', {
      bookingId: booking._id,
      status,
      message: `Your booking has been ${status}.`,
      booking,
    });

    // Notify booking room for tracking screen
    io.to(`booking_${booking._id}`).emit('booking_status_update', { status, booking });

    res.json({ success: true, message: `Booking ${status}.`, booking });

    // When driver starts the trip, simulate ambulance moving toward pickup
    if (status === 'in_progress') {
      const bookingIdStr = booking._id.toString();
      const userId       = booking.user.toString();
      const ambulanceId  = booking.ambulance._id.toString();
      const pickupCoords = booking.pickupLocation?.coordinates; // [lng, lat]
      const amb          = await Ambulance.findById(ambulanceId);

      if (amb?.currentLocation?.coordinates && pickupCoords) {
        const [startLng, startLat] = amb.currentLocation.coordinates;
        const [pickupLng, pickupLat] = pickupCoords;
        const STEPS = 10;

        for (let i = 0; i <= STEPS; i++) {
          const frac = i / STEPS;
          const stepLat = startLat + (pickupLat - startLat) * frac;
          const stepLng = startLng + (pickupLng - startLng) * frac;
          const etaMin  = Math.round((STEPS - i) * 0.4);

          setTimeout(() => {
            io.to(`booking_${bookingIdStr}`).emit('ambulance_location', {
              ambulanceId,
              latitude:  stepLat,
              longitude: stepLng,
              eta:       etaMin,
            });
            io.to(`user_${userId}`).emit('ambulance_location', {
              ambulanceId,
              latitude:  stepLat,
              longitude: stepLng,
              eta:       etaMin,
            });
          }, i * 3000);
        }
      }
    }
  } catch (error) {
    next(error);
  }
};

// PUT /api/bookings/:id/cancel  (user)
exports.cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'This booking cannot be cancelled.' });
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();
    await Ambulance.findByIdAndUpdate(booking.ambulance, { isAvailable: true });

    const io = getIO();
    io.to(`ambulance_${booking.ambulance}`).emit('booking_cancelled', {
      bookingId: booking._id,
      message: 'Booking cancelled by user.',
    });

    res.json({ success: true, message: 'Booking cancelled.', booking });
  } catch (error) {
    next(error);
  }
};

// POST /api/bookings/:id/rate
exports.rateBooking = async (req, res, next) => {
  try {
    const { stars, feedback } = req.body;

    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.user.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized.' });
    if (booking.status !== 'completed') return res.status(400).json({ success: false, message: 'Only completed bookings can be rated.' });
    if (booking.rating?.stars) return res.status(400).json({ success: false, message: 'Booking already rated.' });

    booking.rating = { stars, feedback, givenAt: new Date() };
    await booking.save();

    // Recalculate ambulance average rating
    const rated = await Booking.find({
      ambulance: booking.ambulance,
      'rating.stars': { $exists: true, $ne: null },
    });
    const avg = rated.reduce((s, b) => s + b.rating.stars, 0) / rated.length;
    await Ambulance.findByIdAndUpdate(booking.ambulance, {
      'rating.average': Math.round(avg * 10) / 10,
      'rating.count': rated.length,
    });

    res.json({ success: true, message: 'Rating submitted. Thank you!', booking });
  } catch (error) {
    next(error);
  }
};

// GET /api/bookings/ambulance/:ambulanceId  (driver/admin)
exports.getAmbulanceBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { ambulance: req.params.ambulanceId };

    if (status) {
      // Support comma-separated statuses e.g. "confirmed,in_progress"
      const statuses = status.split(',').map((s) => s.trim());
      query.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }

    const bookings = await Booking.find(query)
      .populate('user', 'name phone email')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);
    res.json({ success: true, count: bookings.length, total, bookings });
  } catch (error) {
    next(error);
  }
};

// GET /api/bookings/:id/reassignment-history  (admin)
exports.getReassignmentHistory = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('ambulance', 'vehicleNumber driverName')
      .populate('previousAssignments.ambulanceId', 'vehicleNumber')
      .populate('previousAssignments.driverId', 'name phone');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const reassignmentData = {
      bookingId: booking._id,
      currentAmbulance: booking.ambulance,
      reassignmentCount: booking.reassignmentCount,
      assignedAt: booking.assignedAt,
      previousAssignments: booking.previousAssignments,
      totalAttempts: booking.reassignmentCount + 1, // Current assignment + reassignments
    };

    res.json({ success: true, data: reassignmentData });
  } catch (error) {
    next(error);
  }
};

// POST /api/bookings/:id/manual-reassign  (admin - for testing/manual override)
exports.manualReassign = async (req, res, next) => {
  try {
    const { bookingTimeoutService } = require('../services/bookingTimeoutService');
    const booking = await Booking.findById(req.params.id).populate('ambulance');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending bookings can be reassigned.' });
    }

    // Find previously assigned ambulances
    const previousIds = booking.previousAssignments.map((p) => p.ambulanceId);
    previousIds.push(booking.ambulance._id);

    // Find next best ambulance
    const { findNextBestAmbulance, reassignBooking } = require('../services/bookingTimeoutService');
    const nextAmbulance = await findNextBestAmbulance(booking, previousIds);

    if (!nextAmbulance) {
      return res.status(409).json({
        success: false,
        message: 'No available ambulances for reassignment.',
      });
    }

    // Perform reassignment
    await reassignBooking(booking, nextAmbulance, booking.ambulance._id);

    res.json({
      success: true,
      message: 'Booking reassigned successfully',
      booking,
      newAmbulanceId: nextAmbulance._id,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/bookings/debug/timeout-status  (admin - debug endpoint)
exports.getTimeoutDebugStatus = async (req, res, next) => {
  try {
    // Get all pending bookings with timing details
    const pendingBookings = await Booking.find({
      status: 'pending',
      assignedAt: { $exists: true, $ne: null },
    }).populate('ambulance', 'vehicleNumber driverName').select('_id status emergencyType assignedAt reassignedAt reassignmentCount ambulance createdAt');

    const now = Date.now();
    const bookingStatus = pendingBookings.map((booking) => {
      const referenceTime = booking.reassignedAt || booking.assignedAt;
      const elapsedSec = (now - referenceTime.getTime()) / 1000;
      const timeout = (booking.emergencyType === 'accident' || booking.emergencyType === 'cardiac' || booking.emergencyType === 'trauma')
        ? 60 : 120;
      
      return {
        bookingId: booking._id,
        status: booking.status,
        emergencyType: booking.emergencyType,
        ambulanceNumber: booking.ambulance?.vehicleNumber,
        driverName: booking.ambulance?.driverName,
        createdAt: booking.createdAt,
        assignedAt: booking.assignedAt,
        reassignedAt: booking.reassignedAt,
        reassignmentCount: booking.reassignmentCount,
        referenceTimeUsed: booking.reassignedAt ? 'reassignedAt' : 'assignedAt',
        elapsedSeconds: Math.round(elapsedSec),
        timeoutThreshold: timeout,
        willTimeoutIn: Math.max(0, Math.round(timeout - elapsedSec)),
        isTimedOut: elapsedSec >= timeout,
      };
    });

    res.json({
      success: true,
      message: 'Timeout debug status',
      now: new Date(),
      pendingBookingsCount: pendingBookings.length,
      bookings: bookingStatus,
    });
  } catch (error) {
    next(error);
  }
};
