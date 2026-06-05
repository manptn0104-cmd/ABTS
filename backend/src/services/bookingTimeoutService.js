/**
 * Booking Timeout & Automatic Reassignment Service
 * Runs every 30 seconds to check for unaccepted bookings and trigger reassignments
 */

const Booking = require('../models/Booking');
const Ambulance = require('../models/Ambulance');
const User = require('../models/User');
const { getIO } = require('./socketService');
const { calculateSmartETA, calculateRankScore } = require('../utils/etaPredictor');

// Configuration
const CONFIG = {
  EMERGENCY_TIMEOUT_SEC: 60,      // 60 seconds for emergency
  GENERAL_TIMEOUT_SEC: 120,       // 2 minutes for general
  CHECK_INTERVAL_SEC: 30,         // Run every 30 seconds
  MAX_REASSIGNMENTS: 5,           // Maximum reassignment attempts
  MAX_AMBULANCES_TO_SEARCH: 50,   // Search top 50 ambulances
};

let timeoutScheduler = null;

/**
 * Get timeout duration in seconds based on emergency type
 */
function getTimeoutDuration(emergencyType) {
  const isEmergency = (emergencyType === 'accident' || emergencyType === 'cardiac' || emergencyType === 'trauma');
  const timeout = isEmergency ? CONFIG.EMERGENCY_TIMEOUT_SEC : CONFIG.GENERAL_TIMEOUT_SEC;
  return timeout;
}

/**
 * Find the next best available ambulance for reassignment
 * Excludes previously assigned ambulances
 * Uses Smart ETA ranking
 */
async function findNextBestAmbulance(booking, previousAmbulanceIds = []) {
  try {
    const pickupCoords = booking.pickupLocation.coordinates;
    const [pickupLng, pickupLat] = pickupCoords;

    // Find nearby ambulances (similar to ambulance search endpoint)
    let availableAmbulances = await Ambulance.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [pickupLng, pickupLat] },
          distanceField: 'distance',
          maxDistance: 30000, // 30km search radius
          query: {
            isAvailable: true,
            _id: { $nin: previousAmbulanceIds }, // Exclude previously assigned
          },
          spherical: true,
        },
      },
      {
        $limit: CONFIG.MAX_AMBULANCES_TO_SEARCH,
      },
      {
        $lookup: {
          from: 'users',
          localField: 'owner',
          foreignField: '_id',
          as: 'ownerDetails',
          pipeline: [{ $project: { name: 1, phone: 1 } }],
        },
      },
      { $unwind: { path: '$ownerDetails', preserveNullAndEmptyArrays: true } },
    ]);

    if (availableAmbulances.length === 0) {
      console.log(
        `[BookingTimeout] ❌ AMBULANCE SEARCH FAILED | ` +
        `Booking: ${booking._id} | ` +
        `No available ambulances found within 30km radius | ` +
        `Excluding: ${previousAmbulanceIds.length} previously assigned ambulances`
      );
      return null;
    }

    // Calculate Smart ETA and ranking for each ambulance
    let rankedAmbulances = availableAmbulances.map((amb) => {
      const distanceMeters = amb.distance || 0;
      const currentSpeed = amb.currentSpeed || 40;
      const trafficLevel = amb.trafficLevel || 'clear';
      const roadType = amb.roadType || 'main_road';
      const signalsCount = amb.signalsCount || 1;
      const motionStatus = amb.motionStatus || 'moving';

      const smartETA = calculateSmartETA({
        distanceMeters,
        currentSpeed,
        trafficLevel,
        roadType,
        signalsCount,
        motionStatus,
      });

      const rankScore = calculateRankScore({
        smartETA,
        ambulanceType: amb.type,
        emergencyType: booking.emergencyType,
        ratingAverage: amb.rating?.average || 0,
        facilities: amb.facilities || {},
      });

      // Check facility matching
      const hasAllFacilities = booking.requiredFacilities.every(
        (facility) => amb.facilities?.[facility] === true
      );

      return {
        ...amb,
        distanceKm: parseFloat((distanceMeters / 1000).toFixed(2)),
        smartETA,
        rankScore,
        hasAllFacilities,
      };
    });

    // Sort by: 1) Has all facilities, 2) Rank score
    rankedAmbulances.sort((a, b) => {
      if (b.hasAllFacilities !== a.hasAllFacilities) {
        return b.hasAllFacilities ? 1 : -1; // Prioritize with facilities
      }
      return a.rankScore - b.rankScore;
    });

    const topChoiceAmbulance = rankedAmbulances[0];
    console.log(
      `[BookingTimeout] 🚑 AMBULANCE SEARCH COMPLETE | ` +
      `Available: ${rankedAmbulances.length} | ` +
      `Top Choice: ${topChoiceAmbulance.vehicleNumber} | ` +
      `Distance: ${topChoiceAmbulance.distanceKm}km | ` +
      `ETA: ${topChoiceAmbulance.smartETA}min | ` +
      `Rank Score: ${topChoiceAmbulance.rankScore.toFixed(2)} | ` +
      `Has Facilities: ${topChoiceAmbulance.hasAllFacilities}`
    );

    return topChoiceAmbulance;
  } catch (error) {
    console.error(
      `[BookingTimeout] ❌ Error finding next ambulance for booking ${booking._id}:`,
      error.message
    );
    console.error('[BookingTimeout] Stack:', error.stack);
    return null;
  }
}

/**
 * Perform reassignment of booking to a new ambulance
 */
async function reassignBooking(booking, newAmbulance, oldAmbulanceId = null, reason = null) {
  try {
    const io = getIO();
    const oldAmbulanceName = booking.ambulance?.vehicleNumber || 'Unknown';

    // Record the previous assignment in history
    if (oldAmbulanceId) {
      const oldAmbulance = await Ambulance.findById(oldAmbulanceId);
      const oldDriver = await User.findById(oldAmbulance?.owner);

      booking.previousAssignments.push({
        ambulanceId: oldAmbulanceId,
        driverId: oldAmbulance?.owner,
        assignedAt: booking.reassignedAt || booking.assignedAt, // Use reassignedAt if available
        timeoutAt: new Date(),
        reason: reason || `Timeout after ${getTimeoutDuration(booking.emergencyType)} seconds`,
        driverName: oldDriver?.name || 'Unknown',
        vehicleNumber: oldAmbulance?.vehicleNumber || 'Unknown',
      });

      // Notify old driver that assignment expired
      io.to(`user_${oldAmbulance.owner}`).emit('booking_timeout', {
        bookingId: booking._id,
        message: 'This booking request has expired and been reassigned to another ambulance.',
        reason: 'No response within timeout',
        reassignmentAttempt: booking.reassignmentCount + 1,
      });

      console.log(`[BookingTimeout] ✓ Notified driver ${oldDriver?.name} that booking reassigned from ${oldAmbulanceName}`);

      // Make old ambulance available again
      await Ambulance.findByIdAndUpdate(oldAmbulanceId, { isAvailable: true });
      console.log(`[BookingTimeout] ✓ Released ambulance ${oldAmbulanceName} back to available pool`);
    }

    // Update booking with new ambulance assignment
    booking.ambulance = newAmbulance._id;
    booking.reassignedAt = new Date(); // CRITICAL: Reset timer by setting reassignedAt
    booking.reassignmentCount += 1;
    await booking.save();

    console.log(
      `[BookingTimeout] ✓ REASSIGNMENT COMPLETE for booking ${booking._id} | ` +
      `Reassignment #${booking.reassignmentCount} | ` +
      `New Ambulance: ${newAmbulance.vehicleNumber} | ` +
      `reassignedAt: ${booking.reassignedAt.toISOString()} (timer reset)`
    );

    // Make new ambulance unavailable
    await Ambulance.findByIdAndUpdate(newAmbulance._id, { isAvailable: false });
    console.log(`[BookingTimeout] ✓ Marked ambulance ${newAmbulance.vehicleNumber} as unavailable`);

    // Populate for notification
    await booking.populate([
      { path: 'user', select: 'name phone' },
      { path: 'ambulance' },
    ]);

    // Notify new driver
    const newDriver = await User.findById(newAmbulance.owner);
    io.to(`user_${newAmbulance.owner}`).emit('new_booking_request', {
      booking,
      message: 'New booking request received',
      isReassignment: true,
      reassignmentAttempt: booking.reassignmentCount,
    });
    io.to(`ambulance_${newAmbulance._id}`).emit('new_booking_request', {
      booking,
      message: 'New booking request received',
      isReassignment: true,
      reassignmentAttempt: booking.reassignmentCount,
    });

    console.log(
      `[BookingTimeout] ✓ Notified driver ${newDriver?.name} (${newAmbulance.vehicleNumber}) of new booking request`
    );

    // Notify user of reassignment
    const userRoom = `user_${booking.user}`;
    const bookingRoom = `booking_${booking._id}`;
    
    console.log(
      `[BookingTimeout] 📡 SOCKET EMIT | ` +
      `Room: ${userRoom} | ` +
      `Event: booking_reassigned | ` +
      `Data: driver=${newDriver?.name}, vehicle=${newAmbulance.vehicleNumber}`
    );

    io.to(userRoom).emit('booking_reassigned', {
      bookingId: booking._id,
      previousAmbulanceId: oldAmbulanceId,
      newAmbulanceId: newAmbulance._id,
      driverName: newDriver?.name || 'Driver',
      vehicleNumber: newAmbulance.vehicleNumber,
      distanceKm: newAmbulance.distanceKm,
      estimatedArrivalMin: newAmbulance.smartETA,
      message: `Your booking has been reassigned to ${newDriver?.name || 'a driver'} in ${newAmbulance.vehicleNumber}`,
      reassignmentAttempt: booking.reassignmentCount,
    });

    console.log(
      `[BookingTimeout] 📡 SOCKET EMIT | ` +
      `Room: ${bookingRoom} | ` +
      `Event: booking_reassigned`
    );

    // Emit booking update
    io.to(bookingRoom).emit('booking_reassigned', {
      booking,
      previousAmbulanceId: oldAmbulanceId,
      newAmbulanceId: newAmbulance._id,
      reassignmentAttempt: booking.reassignmentCount,
    });

    console.log(
      `[BookingTimeout] ✓ Notified user ${booking.user} of reassignment. Next timeout in ${getTimeoutDuration(
        booking.emergencyType
      )}s`
    );

    return true;
  } catch (error) {
    console.error('[BookingTimeout] ❌ Error reassigning booking:', error.message);
    console.error('[BookingTimeout] Stack:', error.stack);
    return false;
  }
}

/**
 * Mark booking as unavailable (no ambulances available)
 */
async function markBookingUnavailable(booking) {
  try {
    const io = getIO();

    booking.status = 'unavailable';
    booking.rejectionReason = `No ambulances available after ${booking.reassignmentCount} reassignment attempts`;
    await booking.save();

    console.log(
      `[BookingTimeout] ❌ BOOKING UNAVAILABLE: ${booking._id} | ` +
      `Reassignment attempts: ${booking.reassignmentCount} / ${CONFIG.MAX_REASSIGNMENTS}`
    );

    // Notify user
    io.to(`user_${booking.user}`).emit('booking_unavailable', {
      bookingId: booking._id,
      message: 'Unfortunately, no ambulances are available in your area. Please try again later.',
      reassignmentAttempts: booking.reassignmentCount,
      reason: booking.rejectionReason,
    });

    // Release current ambulance if any
    if (booking.ambulance) {
      await Ambulance.findByIdAndUpdate(booking.ambulance, { isAvailable: true });
      console.log(`[BookingTimeout] ✓ Released current ambulance back to pool`);
    }

    return true;
  } catch (error) {
    console.error('[BookingTimeout] ❌ Error marking booking unavailable:', error.message);
    return false;
  }
}

/**
 * Check a single booking for timeout and perform reassignment if needed
 */
async function checkAndReassignBooking(booking) {
  try {
    const timeoutSec = getTimeoutDuration(booking.emergencyType);
    const now = Date.now();
    
    // Use reassignedAt as reference if available, otherwise use assignedAt
    const referenceTime = booking.reassignedAt || booking.assignedAt;
    if (!referenceTime) {
      console.log(`[BookingTimeout] Booking ${booking._id} has no assignedAt/reassignedAt timestamp, skipping`);
      return null;
    }
    
    const referenceTimeMs = referenceTime.getTime();
    const elapsedSec = (now - referenceTimeMs) / 1000;

    // Log detailed timing info
    console.log(
      `[BookingTimeout] Booking ${booking._id} | ` +
      `Ambulance: ${booking.ambulance._id} | ` +
      `Reassignments: ${booking.reassignmentCount} | ` +
      `Reference: ${booking.reassignedAt ? 'reassignedAt' : 'assignedAt'} (${referenceTime.toISOString()}) | ` +
      `Elapsed: ${elapsedSec.toFixed(1)}s / ${timeoutSec}s timeout`
    );

    // Check if timeout exceeded
    if (elapsedSec < timeoutSec) {
      return null; // Not yet timed out
    }

    console.log(
      `[BookingTimeout] ⏱ TIMEOUT TRIGGERED for booking ${booking._id} (${elapsedSec.toFixed(0)}s > ${timeoutSec}s). Attempting reassignment #${
        booking.reassignmentCount + 1
      }`
    );

    // Check if max reassignments reached
    if (booking.reassignmentCount >= CONFIG.MAX_REASSIGNMENTS) {
      console.log(`[BookingTimeout] ⚠️ Max reassignments (${CONFIG.MAX_REASSIGNMENTS}) reached for booking ${booking._id}`);
      await markBookingUnavailable(booking);
      return 'max_reassignments';
    }

    // Get list of previously assigned ambulances
    const previousIds = booking.previousAssignments.map((p) => p.ambulanceId);
    const currentAmbulanceId = booking.ambulance._id;
    previousIds.push(currentAmbulanceId);

    console.log(
      `[BookingTimeout] Searching for next ambulance. Excluding ${previousIds.length} previously assigned ambulances.`
    );

    // Find next best ambulance
    const nextAmbulance = await findNextBestAmbulance(booking, previousIds);

    if (!nextAmbulance) {
      console.log(`[BookingTimeout] ❌ No available ambulances for reassignment of booking ${booking._id}`);
      await markBookingUnavailable(booking);
      return 'no_ambulances';
    }

    // Perform reassignment
    await reassignBooking(booking, nextAmbulance, currentAmbulanceId);
    return 'reassigned';
  } catch (error) {
    console.error(`[BookingTimeout] ❌ Error checking booking ${booking._id}:`, error.message);
    return 'error';
  }
}

/**
 * Main scheduler function - runs every CHECK_INTERVAL_SEC
 */
async function runTimeoutCheck() {
  const cycleStart = Date.now();
  console.log(`[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...`);
  
  try {
    // Find all pending bookings with assignedAt timestamp
    console.log('[BookingTimeout] 🔍 Querying database for pending bookings...');
    const pendingBookings = await Booking.find({
      status: 'pending',
      assignedAt: { $exists: true, $ne: null },
    }).populate('ambulance', '_id vehicleNumber driverName');

    console.log(
      `[BookingTimeout] 📊 DATABASE QUERY RESULT: Found ${pendingBookings.length} pending bookings`
    );

    if (pendingBookings.length === 0) {
      const cycleTime = Date.now() - cycleStart;
      console.log(
        `[BookingTimeout] ✓ No pending bookings to check. Cycle complete in ${cycleTime}ms`
      );
      return; // No pending bookings
    }

    console.log(
      `[BookingTimeout] ⏰ SCHEDULER CHECK | Pending bookings: ${pendingBookings.length} | Checking for timeouts...`
    );

    let reassignmentCount = 0;
    let unavailableCount = 0;
    let errorCount = 0;
    let noTimeoutCount = 0;

    for (const booking of pendingBookings) {
      const result = await checkAndReassignBooking(booking);

      if (result === 'reassigned') {
        reassignmentCount++;
      } else if (result === 'max_reassignments' || result === 'no_ambulances') {
        unavailableCount++;
      } else if (result === 'error') {
        errorCount++;
      } else if (result === null) {
        noTimeoutCount++;
      }
    }

    console.log(
      `[BookingTimeout] ✓ SCHEDULER COMPLETE | ` +
      `Reassigned: ${reassignmentCount} | ` +
      `Unavailable: ${unavailableCount} | ` +
      `No timeout yet: ${noTimeoutCount} | ` +
      `Errors: ${errorCount}`
    );
  } catch (error) {
    console.error('[BookingTimeout] ❌ Error in timeout scheduler:', error.message);
    console.error('[BookingTimeout] Stack:', error.stack);
  }
}

/**
 * Start the booking timeout scheduler
 */
function startTimeoutScheduler() {
  if (timeoutScheduler) {
    console.log('[BookingTimeout] ⚠️ Scheduler already running');
    return;
  }

  console.log(
    `[BookingTimeout] 🚀 STARTING SCHEDULER | ` +
    `Check interval: ${CONFIG.CHECK_INTERVAL_SEC}s | ` +
    `General timeout: ${CONFIG.GENERAL_TIMEOUT_SEC}s | ` +
    `Emergency timeout: ${CONFIG.EMERGENCY_TIMEOUT_SEC}s | ` +
    `Max reassignments: ${CONFIG.MAX_REASSIGNMENTS}`
  );

  // Run immediately on startup
  console.log('[BookingTimeout] 🏃 Running initial check immediately...');
  runTimeoutCheck().catch((error) => {
    console.error('[BookingTimeout] ❌ Error in initial check:', error.message);
  });

  // Then run at regular intervals
  timeoutScheduler = setInterval(() => {
    runTimeoutCheck().catch((error) => {
      console.error('[BookingTimeout] ❌ Error in interval check:', error.message);
    });
  }, CONFIG.CHECK_INTERVAL_SEC * 1000);

  console.log('[BookingTimeout] ✓ Scheduler started successfully');
}

/**
 * Stop the booking timeout scheduler
 */
function stopTimeoutScheduler() {
  if (timeoutScheduler) {
    clearInterval(timeoutScheduler);
    timeoutScheduler = null;
    console.log('[BookingTimeout] Scheduler stopped');
  }
}

module.exports = {
  startTimeoutScheduler,
  stopTimeoutScheduler,
  checkAndReassignBooking,
  findNextBestAmbulance,
  reassignBooking,
};
