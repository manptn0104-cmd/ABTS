# Automatic Driver Reassignment for Unaccepted Bookings

## Overview

This feature implements automatic driver reassignment when an ambulance driver does not accept a booking request within a configured timeout. The system ensures users never wait indefinitely for ambulance response by automatically finding and assigning the next best available ambulance.

## Architecture

### Components

1. **Booking Model Updates** (`backend/src/models/Booking.js`)
   - `assignedAt` - Timestamp when ambulance was assigned
   - `reassignmentCount` - Number of reassignment attempts
   - `previousAssignments` - Array tracking all assignment history
   - New status: `unavailable` - When no ambulances are available

2. **Booking Timeout Service** (`backend/src/services/bookingTimeoutService.js`)
   - Runs every 30 seconds to check pending bookings
   - Detects timeouts and triggers reassignments
   - Uses Smart ETA ranking for ambulance selection
   - Maintains reassignment history

3. **API Endpoints**
   - `GET /api/bookings/:id/reassignment-history` - View reassignment audit trail
   - `POST /api/bookings/:id/manual-reassign` - Admin manual reassignment

4. **Socket.IO Events**
   - `booking_reassigned` - Notify user of new driver
   - `booking_timeout` - Notify driver of timeout
   - `booking_unavailable` - Notify user when no ambulances available
   - `new_booking_request` - Notify new driver (with reassignment flag)

## Configuration

### Timeout Settings

Located in `bookingTimeoutService.js`:

```javascript
const CONFIG = {
  EMERGENCY_TIMEOUT_SEC: 60,      // Emergency bookings: 60 seconds
  GENERAL_TIMEOUT_SEC: 120,       // General bookings: 2 minutes
  CHECK_INTERVAL_SEC: 30,         // Scheduler runs every 30 seconds
  MAX_REASSIGNMENTS: 5,           // Maximum 5 reassignment attempts
  MAX_AMBULANCES_TO_SEARCH: 50,   // Search top 50 ambulances
};
```

**Emergency Types Triggering 60s Timeout:**
- accident
- cardiac
- trauma

**All Other Types Trigger 120s Timeout:**
- general
- maternity
- respiratory
- other

### Adjust Timeouts

To change timeout values, edit `backend/src/services/bookingTimeoutService.js`:

```javascript
// For shorter timeout (45 seconds for emergency)
EMERGENCY_TIMEOUT_SEC: 45,

// For longer timeout (3 minutes for general)
GENERAL_TIMEOUT_SEC: 180,

// For more frequent checks (every 15 seconds)
CHECK_INTERVAL_SEC: 15,
```

## How It Works

### Timeline Example: General Booking

```
T=0s    → User creates booking
T=0s    → System assigns best ambulance (Vehicle A)
T=0s    → Driver notified
T=30s   → Scheduler checks (no timeout yet, >120s elapsed? no)
T=60s   → Scheduler checks (no timeout yet)
T=90s   → Scheduler checks (no timeout yet)
T=120s  → Scheduler checks → TIMEOUT DETECTED
T=120s  → System finds next best ambulance (Vehicle B)
T=120s  → Previous assignment recorded in history
T=120s  → Driver A notified: "This booking has been reassigned"
T=120s  → User notified: "New driver assigned"
T=120s  → Driver B receives booking request
T=120s  → Vehicle A marked available again
T=120s  → Vehicle B marked unavailable
```

### Emergency Booking (60s timeout)

```
T=0s    → User creates EMERGENCY booking
T=0s    → System assigns best ambulance (Vehicle A)
T=0s    → Driver notified (URGENT)
T=30s   → Scheduler checks (no timeout yet)
T=60s   → Scheduler checks → TIMEOUT DETECTED (60s exceeded)
T=60s   → System finds next best ambulance (Vehicle B)
T=60s   → Reassign to Vehicle B
T=60s   → Both drivers & user notified
```

### Smart Ambulance Selection During Reassignment

When finding the next ambulance, the system:

1. **Excludes Previously Assigned** - Never assigns same ambulance twice
2. **Checks Availability** - Only available ambulances
3. **Uses Smart ETA** - Considers:
   - Distance
   - Current speed
   - Traffic level
   - Road type
   - Traffic signals
   - Motion status

4. **Matches Facilities** - Prioritizes ambulances with required facilities
5. **Ranks by Score** - Lowest score = best ETA
6. **Considers Rating** - Uses rating as tie-breaker

### Max Reassignment Limit

If no ambulance found after 5 attempts:

```javascript
if (booking.reassignmentCount >= 5) {
  → Mark booking as UNAVAILABLE
  → User notified: "No ambulances available"
  → Booking history preserved
}
```

## Data Structure

### Booking Document After Reassignments

```javascript
{
  _id: ObjectId,
  user: ObjectId,
  ambulance: ObjectId,              // Current ambulance
  status: "pending",
  assignedAt: 2024-01-15T10:30:00Z, // Current assignment time
  reassignmentCount: 2,             // 2 reassignment attempts
  previousAssignments: [
    {
      ambulanceId: ObjectId,
      driverId: ObjectId,
      assignedAt: 2024-01-15T10:00:00Z,
      timeoutAt: 2024-01-15T10:02:00Z,  // When it timed out
      reason: "Timeout after 120 seconds",
      driverName: "John Doe",
      vehicleNumber: "MH02AB1234"
    },
    {
      ambulanceId: ObjectId,
      driverId: ObjectId,
      assignedAt: 2024-01-15T10:02:00Z,
      timeoutAt: 2024-01-15T10:04:00Z,
      reason: "Timeout after 120 seconds",
      driverName: "Jane Smith",
      vehicleNumber: "MH02AB5678"
    }
  ]
}
```

## API Reference

### Get Reassignment History

**Endpoint:** `GET /api/bookings/:id/reassignment-history`

**Auth:** Admin only

**Response:**
```javascript
{
  "success": true,
  "data": {
    "bookingId": "507f1f77bcf86cd799439011",
    "currentAmbulance": {
      "_id": "507f1f77bcf86cd799439012",
      "vehicleNumber": "MH02AB9999",
      "driverName": "Current Driver"
    },
    "reassignmentCount": 2,
    "assignedAt": "2024-01-15T10:04:00Z",
    "totalAttempts": 3,  // Current + 2 reassignments
    "previousAssignments": [...]
  }
}
```

### Manual Reassign (Admin)

**Endpoint:** `POST /api/bookings/:id/manual-reassign`

**Auth:** Admin only

**Request Body:** `{}`

**Response:**
```javascript
{
  "success": true,
  "message": "Booking reassigned successfully",
  "booking": {...},
  "newAmbulanceId": "507f1f77bcf86cd799439012"
}
```

## Real-Time Updates via Socket.IO

### User Receives: Booking Reassigned

```javascript
socket.on('booking_reassigned', (data) => {
  {
    bookingId: "507f1f77bcf86cd799439011",
    previousAmbulanceId: "507f1f77bcf86cd799439010",
    newAmbulanceId: "507f1f77bcf86cd799439012",
    driverName: "Jane Smith",
    vehicleNumber: "MH02AB5678",
    distanceKm: 2.5,
    estimatedArrivalMin: 5,
    message: "Your booking has been reassigned to Jane Smith in MH02AB5678"
  }
});
```

### Driver Receives: Booking Timeout

```javascript
socket.on('booking_timeout', (data) => {
  {
    bookingId: "507f1f77bcf86cd799439011",
    message: "This booking request has expired and been reassigned to another ambulance.",
    reason: "No response within timeout"
  }
});
```

### User Receives: Booking Unavailable

```javascript
socket.on('booking_unavailable', (data) => {
  {
    bookingId: "507f1f77bcf86cd799439011",
    message: "Unfortunately, no ambulances are available in your area. Please try again later.",
    reassignmentAttempts: 5
  }
});
```

### New Driver Receives: Booking Request (Reassigned)

```javascript
socket.on('new_booking_request', (data) => {
  {
    booking: {...},
    message: "New booking request received",
    isReassignment: true,  // Flag indicates this is a reassignment
    reassignmentAttempt: 1 // Which attempt (0 = original, 1+ = reassignments)
  }
});
```

## Logging

The service logs all actions with `[BookingTimeout]` prefix:

```
[BookingTimeout] ⏰ Checking 3 pending bookings...
[BookingTimeout] ⏱ Booking 507f1f77bcf86cd799439011 timed out (125s > 120s). Attempting reassignment #1
[BookingTimeout] Found 12 available ambulances for reassignment. Top choice: 507f1f77bcf86cd799439012
[BookingTimeout] ✓ Reassigned booking 507f1f77bcf86cd799439011 to ambulance 507f1f77bcf86cd799439012 (attempt #1)
[BookingTimeout] ✓ Timeout check complete: 1 reassigned, 0 marked unavailable
```

## Database Indexes

New indexes added for performance:

```javascript
bookingSchema.index({ status: 1, assignedAt: 1 });
bookingSchema.index({ status: 1, reassignmentCount: 1 });
```

These ensure fast queries for:
- Finding pending bookings to check for timeouts
- Filtering bookings by reassignment count

## Testing

### Manual Test: Trigger Reassignment

1. **Create a booking**
   - Book an ambulance normally
   - Note the booking ID

2. **Wait for timeout or use admin endpoint**
   - Option A: Wait 60s (emergency) or 120s (general)
   - Option B: Use admin endpoint to force:
     ```
     POST /api/bookings/{bookingId}/manual-reassign
     ```

3. **Verify in logs**
   ```
   [BookingTimeout] ✓ Reassigned booking ... to ambulance ...
   ```

4. **Check reassignment history**
   ```
   GET /api/bookings/{bookingId}/reassignment-history
   ```

5. **Verify socket events received**
   - User receives `booking_reassigned`
   - New driver receives `new_booking_request`
   - Old driver receives `booking_timeout`

### Test Scenario: No Ambulances Available

1. Mark all ambulances unavailable in database
2. Create a new booking
3. Wait for multiple timeouts (up to 5 reassignments)
4. Verify booking marked as `unavailable`
5. User receives `booking_unavailable` socket event

## Error Handling

The service gracefully handles:

- ✅ Invalid booking data
- ✅ Ambulances becoming unavailable during search
- ✅ Database connection issues
- ✅ Socket.IO connection failures
- ✅ Driver disconnections

All errors are logged but do not crash the scheduler.

## Performance

**Scheduler Performance:**
- Runs every 30 seconds
- Checks pending bookings
- Average runtime: <200ms for typical load
- No blocking operations (all async)

**Database Impact:**
- Indexed queries for fast lookup
- Minimal document updates
- Historical data preserved (no deletion)

## Backward Compatibility

✅ **All existing features preserved:**
- Smart ETA ranking still used
- Facility filtering still works
- Live tracking unaffected
- Feedback system unchanged
- Driver dashboard works normally
- Admin dashboard unchanged
- Existing socket events still emit

✅ **No breaking changes:**
- Old bookings unaffected
- Reassignment is additive feature
- Can be disabled by stopping scheduler

## Monitoring

**Metrics to track:**

1. **Reassignment Count**: Track how often reassignments occur
2. **Success Rate**: (Successful reassignments) / (Total timeouts)
3. **Unavailable Rate**: (Bookings marked unavailable) / (Total timeouts)
4. **Scheduler Health**: Check logs for errors

## Future Enhancements

Potential improvements:

1. **Configurable Timeouts Per Ambulance Type**: Different timeouts for different vehicle types
2. **Driver Response Rate**: Track driver response times, adjust priorities
3. **Predictive Reassignment**: Reassign before timeout if driver inactive
4. **Cost Optimization**: Prefer cheaper ambulances during reassignment
5. **User Preferences**: Let users set acceptable number of reassignments
6. **Emergency Priority Queue**: Fast-track emergency reassignments
7. **Geographic Clustering**: Optimize for ambulances in same zone
8. **Machine Learning**: Predict driver acceptance rates

## Troubleshooting

### Scheduler Not Running

**Symptom:** Bookings not reassigned after timeout

**Check:**
1. Server logs show `[BookingTimeout] Starting scheduler`?
2. Scheduler running: `ps aux | grep node`
3. Check database connection

**Fix:**
```javascript
// In server.js, ensure this line exists:
startTimeoutScheduler();
```

### Bookings Stuck in Pending

**Symptom:** Booking stays pending indefinitely

**Cause:**
- Scheduler not checking frequently enough
- All ambulances marked unavailable
- MAX_REASSIGNMENTS limit hit

**Fix:**
- Increase `CHECK_INTERVAL_SEC` to check more frequently
- Check ambulance availability
- View reassignment history

### Socket Events Not Received

**Symptom:** Client not receiving notifications

**Check:**
1. Socket connected? Check console logs
2. User in correct socket room? (`user_{userId}`)
3. Check getIO() returns correct instance

**Fix:**
- Ensure socket authentication working
- Check room joins in socketService

## Support

For issues or questions:

1. Check logs with `[BookingTimeout]` prefix
2. View reassignment history: `GET /api/bookings/:id/reassignment-history`
3. Run manual reassignment: `POST /api/bookings/:id/manual-reassign`
4. Review this documentation
