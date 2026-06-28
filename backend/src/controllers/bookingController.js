const Booking = require('../models/Booking');
const Ambulance = require('../models/Ambulance');
const User = require('../models/User');
const { getIO } = require('../services/socketService');

// Map to track and clear simulator timers to prevent memory leaks
const simulationTimers = new Map();

// Helper function to auto-reassign a booking to the next closest available ambulances concurrently
const autoReassign = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    // Verify booking is still in a pending/rejected state (i.e. not confirmed, cancelled or completed)
    if (booking.status !== 'pending' && booking.status !== 'rejected') return;

    // Release any currently active candidate ambulances and add them to rejected list
    if (booking.candidateAmbulances && booking.candidateAmbulances.length > 0) {
      if (!booking.rejectedAmbulances) booking.rejectedAmbulances = [];
      for (const ambId of booking.candidateAmbulances) {
        const ambIdStr = ambId.toString();
        if (!booking.rejectedAmbulances.map(id => id.toString()).includes(ambIdStr)) {
          booking.rejectedAmbulances.push(ambId);
        }
        await Ambulance.findByIdAndUpdate(ambId, { isAvailable: true });
      }
    }

    const [lng, lat] = booking.pickupLocation.coordinates;
    const matchQuery = {
      isAvailable: true,
      _id: { $nin: booking.rejectedAmbulances || [] },
    };

    if (booking.requiredFacilities && booking.requiredFacilities.length > 0) {
      booking.requiredFacilities.forEach((f) => {
        matchQuery[`facilities.${f}`] = true;
      });
    }

    // Query up to 3 new candidates
    const additionalAmbulances = await Ambulance.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distance',
          maxDistance: 50000,
          query: matchQuery,
          spherical: true,
        },
      },
      { $limit: 3 },
    ]);

    const io = getIO();

    if (additionalAmbulances.length > 0) {
      const candidateIds = additionalAmbulances.map(c => c._id);
      
      // Mark new candidates as unavailable atomically
      await Ambulance.updateMany({ _id: { $in: candidateIds } }, { isAvailable: false });

      // Reassign the booking candidates
      booking.ambulance = candidateIds[0]; // set primary to the first candidate
      booking.candidateAmbulances = candidateIds;
      booking.status = 'pending';
      booking.rejectionReason = null;
      await booking.save();

      await booking.populate([
        { path: 'user', select: 'name phone email' },
        { path: 'ambulance' },
      ]);

      // Set a 30-second timeout for the new candidates
      const timeoutId = setTimeout(async () => {
        await autoReassign(booking._id);
      }, 30000);

      const bookingIdStr = booking._id.toString();
      if (!simulationTimers.has(bookingIdStr)) {
        simulationTimers.set(bookingIdStr, []);
      }
      simulationTimers.get(bookingIdStr).push(timeoutId);

      // Notify the new drivers
      for (const candidate of additionalAmbulances) {
        io.to(`ambulance_${candidate._id}`).emit('new_booking_request', {
          booking,
          message: 'New booking request received',
        });

        const driverUser = await User.findOne({ _id: candidate.owner });
        if (driverUser) {
          io.to(`user_${driverUser._id}`).emit('new_booking_request', {
            booking,
            message: 'New booking request automatically assigned to you.',
          });
        }
      }

      // Notify patient of the reassignment
      io.to(`user_${booking.user}`).emit('booking_status_update', {
        bookingId: booking._id,
        status: 'pending',
        message: `Your booking was reassigned to nearby ambulances (${additionalAmbulances.map(c => c.vehicleNumber).join(', ')}).`,
        booking,
      });

      io.to(`booking_${booking._id}`).emit('booking_status_update', {
        status: 'pending',
        booking,
      });

      console.log(`[AutoReassign] Booking ${booking._id} reassigned concurrently to: ${additionalAmbulances.map(c => c.vehicleNumber).join(', ')}`);
    } else {
      // No candidates found - booking is rejected
      booking.status = 'rejected';
      booking.rejectionReason = 'No nearby available ambulances found matching your requirements.';
      await booking.save();

      // Notify patient of final rejection
      io.to(`user_${booking.user}`).emit('booking_status_update', {
        bookingId: booking._id,
        status: 'rejected',
        message: 'No available ambulances found matching your requirements.',
        booking,
      });

      io.to(`booking_${booking._id}`).emit('booking_status_update', {
        status: 'rejected',
        booking,
      });

      console.log(`[AutoReassign Failed] No other ambulances available for Booking ${booking._id}`);
    }
  } catch (err) {
    console.error('[AutoReassign Error]', err);
  }
};

// POST /api/bookings
exports.createBooking = async (req, res, next) => {
  let candidateIds = [];
  try {
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

    // Find the requested ambulance
    const primaryAmbulance = await Ambulance.findById(ambulanceId);
    if (!primaryAmbulance || !primaryAmbulance.isAvailable) {
      return res.status(409).json({ success: false, message: 'Selected ambulance is currently unavailable.' });
    }

    // Now find up to 2 other closest matching available ambulances within a 50km radius
    const matchQuery = {
      _id: { $ne: primaryAmbulance._id },
      isAvailable: true,
    };
    if (requiredFacilities && requiredFacilities.length > 0) {
      requiredFacilities.forEach((f) => {
        matchQuery[`facilities.${f}`] = true;
      });
    }

    const [lng, lat] = pickupLocation.coordinates;
    const additionalAmbulances = await Ambulance.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distance',
          maxDistance: 50000,
          query: matchQuery,
          spherical: true,
        },
      },
      { $limit: 2 },
    ]);

    const candidates = [primaryAmbulance, ...additionalAmbulances];
    candidateIds = candidates.map(c => c._id);

    // Mark all candidates as unavailable atomically
    await Ambulance.updateMany({ _id: { $in: candidateIds } }, { isAvailable: false });

    const fare = {
      base:  primaryAmbulance.basePrice,
      perKm: primaryAmbulance.pricePerKm * estimatedDistance,
      total: primaryAmbulance.basePrice + primaryAmbulance.pricePerKm * estimatedDistance,
    };

    const booking = await Booking.create({
      user: req.user.id,
      ambulance: ambulanceId,
      candidateAmbulances: candidateIds,
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

    // Notify each candidate driver
    for (const candidate of candidates) {
      io.to(`ambulance_${candidate._id}`).emit('new_booking_request', {
        booking,
        message: 'New concurrent booking request received',
      });

      const driverUser = await User.findOne({ _id: candidate.owner });
      if (driverUser) {
        io.to(`user_${driverUser._id}`).emit('new_booking_request', {
          booking,
          message: 'New concurrent booking request received',
        });
      }
    }

    // Confirm to user
    io.to(`user_${req.user.id}`).emit('booking_created', {
      bookingId: booking._id,
      message: 'Booking submitted. Waiting for driver confirmation.',
    });

    // Set a 30-second timeout for driver acceptance/timeout reassignment
    const timeoutId = setTimeout(async () => {
      await autoReassign(booking._id);
    }, 30000);

    const bookingIdStr = booking._id.toString();
    if (!simulationTimers.has(bookingIdStr)) {
      simulationTimers.set(bookingIdStr, []);
    }
    simulationTimers.get(bookingIdStr).push(timeoutId);

    res.status(201).json({ success: true, message: 'Booking created. Awaiting driver confirmation.', booking });
  } catch (error) {
    if (candidateIds && candidateIds.length > 0) {
      await Ambulance.updateMany({ _id: { $in: candidateIds } }, { isAvailable: true });
    }
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

    let driverAmbulance = null;
    if (req.user.role === 'driver') {
      driverAmbulance = await Ambulance.findOne({ owner: req.user.id });
      if (!driverAmbulance) {
        return res.status(400).json({ success: false, message: 'No registered ambulance found for this driver.' });
      }
    }

    // Clear any active simulator loops if trip ends or is accepted
    if (['confirmed', 'completed', 'cancelled', 'rejected'].includes(status)) {
      const timers = simulationTimers.get(booking._id.toString());
      if (timers) {
        timers.forEach(clearTimeout);
        simulationTimers.delete(booking._id.toString());
      }
    }

    if (status === 'confirmed') {
      booking.confirmedAt = new Date();
      booking.status = 'confirmed';
      const winningAmbulanceId = driverAmbulance ? driverAmbulance._id : booking.ambulance._id;

      // Release other candidate ambulances back to available
      if (booking.candidateAmbulances && booking.candidateAmbulances.length > 0) {
        const otherCandidates = booking.candidateAmbulances.filter(
          id => id.toString() !== winningAmbulanceId.toString()
        );
        await Ambulance.updateMany({ _id: { $in: otherCandidates } }, { isAvailable: true });
      }

      booking.ambulance = winningAmbulanceId;
      await Ambulance.findByIdAndUpdate(winningAmbulanceId, { isAvailable: false });
    }

    if (status === 'rejected') {
      const rejectingAmbulanceId = driverAmbulance ? driverAmbulance._id : booking.ambulance._id;

      // Mark the rejecting ambulance back to available
      await Ambulance.findByIdAndUpdate(rejectingAmbulanceId, { isAvailable: true });

      // Track as rejected
      if (!booking.rejectedAmbulances) booking.rejectedAmbulances = [];
      const rejectingAmbulanceIdStr = rejectingAmbulanceId.toString();
      if (!booking.rejectedAmbulances.map(id => id.toString()).includes(rejectingAmbulanceIdStr)) {
        booking.rejectedAmbulances.push(rejectingAmbulanceId);
      }

      // Remove from candidates
      if (booking.candidateAmbulances && booking.candidateAmbulances.length > 0) {
        booking.candidateAmbulances = booking.candidateAmbulances.filter(
          id => id.toString() !== rejectingAmbulanceIdStr
        );
      }

      // If other candidates are still pending, do not transition the overall booking status yet
      if (booking.candidateAmbulances && booking.candidateAmbulances.length > 0) {
        await booking.save();
        return res.json({
          success: true,
          message: 'Rejection submitted. Other candidates are still pending.',
          booking,
        });
      }

      // Otherwise, transition booking status to rejected and trigger reassign
      booking.status = 'rejected';
      booking.rejectionReason = rejectionReason || 'All candidate drivers rejected the booking.';
    }

    if (status === 'in_progress') {
      booking.status = 'in_progress';
      booking.startedAt = new Date();
    }
    if (status === 'completed') {
      booking.status = 'completed';
      booking.completedAt = new Date();
      await Ambulance.findByIdAndUpdate(booking.ambulance._id, {
        isAvailable: true,
        $inc: { totalTrips: 1 },
      });
    }
    if (status === 'cancelled') {
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      await Ambulance.findByIdAndUpdate(booking.ambulance._id, { isAvailable: true });
    }

    await booking.save();

    await booking.populate([
      { path: 'user', select: 'name phone email' },
      { path: 'ambulance' },
    ]);

    // Notify user safely using raw user ID if populate returns null
    const userNotificationId = booking.user?._id || booking.user;
    const io = getIO();
    io.to(`user_${userNotificationId}`).emit('booking_status_update', {
      bookingId: booking._id,
      status,
      message: `Your booking has been ${status}.`,
      booking,
    });

    // Notify booking room for tracking screen
    io.to(`booking_${booking._id}`).emit('booking_status_update', { status, booking });

    res.json({ success: true, message: `Booking ${status}.`, booking });

    if (status === 'rejected') {
      setTimeout(async () => {
        await autoReassign(booking._id);
      }, 0);
    }

    // When driver starts the trip, simulate ambulance moving toward pickup along OSRM road paths
    if (status === 'in_progress') {
      const bookingIdStr = booking._id.toString();
      const userId       = userNotificationId.toString();
      const ambulanceId  = booking.ambulance._id.toString();
      const pickupCoords = booking.pickupLocation?.coordinates; // [lng, lat]
      const amb          = await Ambulance.findById(ambulanceId);

      if (amb?.currentLocation?.coordinates && pickupCoords) {
        const [startLng, startLat] = amb.currentLocation.coordinates;
        const [pickupLng, pickupLat] = pickupCoords;

        if (!simulationTimers.has(bookingIdStr)) {
          simulationTimers.set(bookingIdStr, []);
        }

        // Fetch OSRM actual road route path
        let routeCoords = [];
        try {
          const osrmRes = await fetch(`http://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${pickupLng},${pickupLat}?geometries=geojson`);
          const osrmData = await osrmRes.json();
          if (osrmData.routes && osrmData.routes.length > 0) {
            routeCoords = osrmData.routes[0].geometry.coordinates; // [[lng, lat], ...]
          }
        } catch (routeErr) {
          console.warn('[OSRM Simulation Fallback]', routeErr.message);
        }

        const STEPS = 10;
        for (let i = 0; i <= STEPS; i++) {
          let stepLat, stepLng;
          if (routeCoords.length > 0) {
            // Traverse along the OSRM path
            const idx = Math.min(
              Math.floor((i / STEPS) * (routeCoords.length - 1)),
              routeCoords.length - 1
            );
            const [lng, lat] = routeCoords[idx];
            stepLat = lat;
            stepLng = lng;
          } else {
            // Straight line fallback
            const frac = i / STEPS;
            stepLat = startLat + (pickupLat - startLat) * frac;
            stepLng = startLng + (pickupLng - startLng) * frac;
          }
          const etaMin = Math.round((STEPS - i) * 0.4);

          const timerId = setTimeout(() => {
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

          simulationTimers.get(bookingIdStr).push(timerId);
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
    const query = {
      $or: [
        { ambulance: req.params.ambulanceId },
        { candidateAmbulances: req.params.ambulanceId }
      ],
      rejectedAmbulances: { $ne: req.params.ambulanceId }
    };

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
