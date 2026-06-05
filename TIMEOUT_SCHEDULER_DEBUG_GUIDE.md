# Automatic Reassignment - Complete Fix & Debug Guide

## Issues Found & Fixed

### 1. **Silent Exit on No Pending Bookings** ❌ FIXED
**Problem:** When no pending bookings existed, the scheduler would exit silently without logging.
```javascript
// BEFORE (Line 388)
if (pendingBookings.length === 0) {
  return; // No logging - you never knew if scheduler ran!
}
```

**Fix:** Added logs at every scheduler cycle, even when no bookings found.
```javascript
// AFTER
if (pendingBookings.length === 0) {
  const cycleTime = Date.now() - cycleStart;
  console.log(
    `[BookingTimeout] ✓ No pending bookings to check. Cycle complete in ${cycleTime}ms`
  );
  return;
}
```

### 2. **Query Not Filtering Correctly** ❌ FIXED
**Problem:** Query might not find bookings if `assignedAt` was null/undefined.
```javascript
// BEFORE
assignedAt: { $exists: true }  // This might still match null values!
```

**Fix:** Added explicit check for null.
```javascript
// AFTER
assignedAt: { $exists: true, $ne: null }
```

### 3. **No Immediate First Run** ❌ FIXED
**Problem:** Scheduler only ran after first 30-second interval, missing early timeouts.
```javascript
// BEFORE
timeoutScheduler = setInterval(runTimeoutCheck, CONFIG.CHECK_INTERVAL_SEC * 1000);
// First run: 30 seconds from now!
```

**Fix:** Run check immediately on startup.
```javascript
// AFTER
// Run immediately on startup
runTimeoutCheck().catch((error) => {
  console.error('[BookingTimeout] ❌ Error in initial check:', error.message);
});

// Then run at regular intervals
timeoutScheduler = setInterval(() => {
  runTimeoutCheck().catch((error) => {
    console.error('[BookingTimeout] ❌ Error in interval check:', error.message);
  });
}, CONFIG.CHECK_INTERVAL_SEC * 1000);
```

### 4. **Silent Error Swallowing** ❌ FIXED
**Problem:** Errors in async interval would silently fail without logging.
```javascript
// BEFORE
timeoutScheduler = setInterval(runTimeoutCheck, ...);
// If runTimeoutCheck throws unhandled error, no logs!
```

**Fix:** Wrapped with .catch() to handle async errors.
```javascript
// AFTER
setInterval(() => {
  runTimeoutCheck().catch((error) => {
    console.error('[BookingTimeout] ❌ Error in interval check:', error.message);
  });
}, ...);
```

### 5. **Incomplete Error Logging** ❌ FIXED
**Problem:** Errors only showed message, not full details.
```javascript
// BEFORE
console.error('[BookingTimeout] Error in timeout scheduler:', error.message);
```

**Fix:** Added full error details with stack trace.
```javascript
// AFTER
console.error('[BookingTimeout] ❌ CRITICAL ERROR in timeout scheduler:', error.message);
console.error('[BookingTimeout] Error Details:', {
  name: error.name,
  message: error.message,
  stack: error.stack,
});
```

### 6. **No Scheduler Cycle Visibility** ❌ FIXED
**Problem:** Hard to tell if scheduler was actually running its cycles.
```javascript
// BEFORE - No indication when cycle started
```

**Fix:** Added clear start and end markers for each cycle.
```javascript
// AFTER
console.log(`[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...`);
console.log('[BookingTimeout] 🔍 Querying database for pending bookings...');
console.log(`[BookingTimeout] 📊 DATABASE QUERY RESULT: Found ${pendingBookings.length} pending bookings`);
// ... processing ...
console.log(`[BookingTimeout] ✓ SCHEDULER CYCLE COMPLETE in ${cycleTime}ms | ...`);
```

---

## New Debug Endpoint

### Get Timeout Status
**Endpoint:** `GET /api/bookings/debug/timeout-status`

**Auth:** Admin only

**Purpose:** Check status of all pending bookings and their timeout calculations

**Response:**
```json
{
  "success": true,
  "message": "Timeout debug status",
  "now": "2026-06-04T10:05:30.123Z",
  "pendingBookingsCount": 1,
  "bookings": [
    {
      "bookingId": "abc123",
      "status": "pending",
      "emergencyType": "general",
      "ambulanceNumber": "VH001",
      "driverName": "John Doe",
      "createdAt": "2026-06-04T10:00:00Z",
      "assignedAt": "2026-06-04T10:00:00Z",
      "reassignedAt": null,
      "reassignmentCount": 0,
      "referenceTimeUsed": "assignedAt",
      "elapsedSeconds": 330,
      "timeoutThreshold": 120,
      "willTimeoutIn": 0,
      "isTimedOut": true
    }
  ]
}
```

---

## Expected Log Output After Fix

### On Server Startup
```
[BookingTimeout] 🚀 STARTING SCHEDULER | Check interval: 30s | General timeout: 120s | Emergency timeout: 60s | Max reassignments: 5
[BookingTimeout] 🏃 Running initial check immediately...
[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...
[BookingTimeout] 🔍 Querying database for pending bookings...
[BookingTimeout] 📊 DATABASE QUERY RESULT: Found 0 pending bookings
[BookingTimeout] ✓ No pending bookings to check. Cycle complete in 45ms
[BookingTimeout] ✓ Scheduler started successfully
```

### Every 30 Seconds (No Pending Bookings)
```
[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...
[BookingTimeout] 🔍 Querying database for pending bookings...
[BookingTimeout] 📊 DATABASE QUERY RESULT: Found 0 pending bookings
[BookingTimeout] ✓ No pending bookings to check. Cycle complete in 38ms
```

### When Booking Created
```
[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...
[BookingTimeout] 🔍 Querying database for pending bookings...
[BookingTimeout] 📊 DATABASE QUERY RESULT: Found 1 pending bookings
[BookingTimeout] ⏰ SCHEDULER CHECK | Pending bookings: 1 | Checking for timeouts...
[BookingTimeout] Booking abc123 | Ambulance: VH001 | Reassignments: 0 | Reference: assignedAt (2026-06-04T10:00:00Z) | Elapsed: 5.2s / 120s timeout
[BookingTimeout] ✓ SCHEDULER CYCLE COMPLETE in 52ms | Reassigned: 0 | Unavailable: 0 | No timeout yet: 1 | Errors: 0
```

### When Timeout Detected (After 120s)
```
[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...
[BookingTimeout] 🔍 Querying database for pending bookings...
[BookingTimeout] 📊 DATABASE QUERY RESULT: Found 1 pending bookings
[BookingTimeout] ⏰ SCHEDULER CHECK | Pending bookings: 1 | Checking for timeouts...
[BookingTimeout] Booking abc123 | Ambulance: VH001 | Reassignments: 0 | Reference: assignedAt (2026-06-04T10:00:00Z) | Elapsed: 120.5s / 120s timeout
[BookingTimeout] ⏱ TIMEOUT TRIGGERED for booking abc123 (120s > 120s). Attempting reassignment #1
[BookingTimeout] Searching for next ambulance. Excluding 1 previously assigned ambulances.
[BookingTimeout] 🚑 AMBULANCE SEARCH COMPLETE | Available: 12 | Top Choice: VH002 | Distance: 2.5km | ETA: 5min | Rank Score: 3.45 | Has Facilities: true
[BookingTimeout] ✓ Notified driver John Doe that booking reassigned from VH001
[BookingTimeout] ✓ Released ambulance VH001 back to available pool
[BookingTimeout] ✓ REASSIGNMENT COMPLETE for booking abc123 | Reassignment #1 | New Ambulance: VH002 | reassignedAt: 2026-06-04T10:02:00Z (timer reset)
[BookingTimeout] ✓ Marked ambulance VH002 as unavailable
[BookingTimeout] ✓ Notified driver Jane Smith (VH002) of new booking request
[BookingTimeout] ✓ Notified user user456 of reassignment. Next timeout in 120s
[BookingTimeout] ✓ SCHEDULER CYCLE COMPLETE in 245ms | Reassigned: 1 | Unavailable: 0 | No timeout yet: 0 | Errors: 0
```

---

## Testing Steps

### Step 1: Verify Server Startup
**Expected Output:**
```
[BookingTimeout] 🚀 STARTING SCHEDULER | ...
[BookingTimeout] ✓ Scheduler started successfully
```

**If NOT showing:**
- Check server logs
- Restart server
- Verify `startTimeoutScheduler()` is called in `server.js`

### Step 2: Check Pending Bookings Exist
**Call this endpoint as admin:**
```bash
curl -X GET http://localhost:5000/api/bookings/debug/timeout-status \
  -H "Authorization: Bearer {adminToken}"
```

**Expected Response:**
- Should show list of pending bookings
- Check `elapsedSeconds` and `isTimedOut` status
- If empty, no bookings to test with - create one

### Step 3: Create Test Booking
**Steps:**
1. Use frontend or API to create booking
2. Check logs for booking creation
3. Call timeout-status endpoint
4. Verify `elapsedSeconds: 0` and `isTimedOut: false`

### Step 4: Wait for Timeout
**For General Booking:**
- Wait 120+ seconds
- Check logs for reassignment

**For Emergency Booking (faster):**
- Create booking with `emergencyType: "cardiac"`
- Wait 60+ seconds
- Check logs for reassignment

### Step 5: Verify Scheduler Cycles
**Expected logs every 30 seconds:**
```
[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...
[BookingTimeout] 📊 DATABASE QUERY RESULT: Found ...
[BookingTimeout] ✓ SCHEDULER CYCLE COMPLETE in Xms | ...
```

If NOT showing, scheduler is not running!

### Step 6: Force Reassignment (Testing)
**Use admin endpoint:**
```bash
curl -X POST http://localhost:5000/api/bookings/{bookingId}/manual-reassign \
  -H "Authorization: Bearer {adminToken}" \
  -H "Content-Type: application/json"
```

**Expected:**
- Booking reassigned immediately
- Check logs for reassignment complete message

---

## Troubleshooting

### Problem: Scheduler logs never appear

**Check:**
```
[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...
```

**If missing:**
1. Server not started with timeout service
2. `startTimeoutScheduler()` not called in server.js
3. Fatal error in scheduler initialization

**Fix:**
```bash
# Verify in server.js:
const { startTimeoutScheduler } = require('./src/services/bookingTimeoutService');
startTimeoutScheduler();
```

### Problem: Bookings created but scheduler logs don't show them

**Check:**
```
[BookingTimeout] 📊 DATABASE QUERY RESULT: Found 0 pending bookings
```

**Causes:**
1. Booking status not "pending"
2. Booking missing `assignedAt` field
3. `assignedAt` is null

**Fix:**
1. Verify booking in database:
```javascript
db.bookings.find({status: "pending"})
```

2. Check booking fields:
```javascript
db.bookings.findOne({_id: ObjectId("...")})
// Should have:
// status: "pending"
// assignedAt: ISODate("...")
```

### Problem: Scheduler runs but doesn't reassign after timeout

**Check Logs:**
```
[BookingTimeout] Elapsed: 125.3s / 120s timeout
[BookingTimeout] ⏱ TIMEOUT TRIGGERED
[BookingTimeout] ❌ No available ambulances for reassignment
```

**Causes:**
1. No ambulances available
2. All ambulances already assigned to this booking
3. Ambulance search failing

**Fix:**
1. Make ambulances available
2. Use debug endpoint to check ambulance status:
```bash
curl -X GET "http://localhost:5000/api/ambulances?available=true" \
  -H "Authorization: Bearer {token}"
```

### Problem: Database connection error

**Check Logs:**
```
[BookingTimeout] ❌ CRITICAL ERROR in timeout scheduler: ...
[BookingTimeout] Error Details: { name: "MongooseError", ...}
```

**Fix:**
1. Verify MongoDB is running
2. Check connection string
3. Ensure database is accessible

---

## Files Changed

1. **`backend/src/services/bookingTimeoutService.js`**
   - Fixed `runTimeoutCheck()` logging
   - Added immediate first run
   - Improved error handling
   - Better query filtering

2. **`backend/src/controllers/bookingController.js`**
   - Added `getTimeoutDebugStatus()` endpoint

3. **`backend/src/routes/bookings.js`**
   - Added `/debug/timeout-status` route

---

## Verification Checklist

After restart, verify:

- [ ] Server shows: `[BookingTimeout] 🚀 STARTING SCHEDULER`
- [ ] Server shows: `[BookingTimeout] ✓ Scheduler started successfully`
- [ ] Logs show scheduler cycle starting every 30s
- [ ] Create booking, shows it's pending
- [ ] Call debug endpoint, see booking listed
- [ ] Wait 120s (or use manual endpoint)
- [ ] Logs show: `[BookingTimeout] ⏱ TIMEOUT TRIGGERED`
- [ ] Logs show: `[BookingTimeout] ✓ REASSIGNMENT COMPLETE`
- [ ] Booking status changes in database
- [ ] User receives socket notification
- [ ] New driver receives booking

---

## Quick Test Command

```bash
# 1. Create booking via API or frontend
# 2. Get booking ID
# 3. Check status after 2 minutes:
curl -X GET http://localhost:5000/api/bookings/debug/timeout-status \
  -H "Authorization: Bearer {adminToken}" | jq '.bookings[].isTimedOut'

# 4. Should see: true (if 120+ seconds elapsed)
```

---

## Success Indicators

✅ Scheduler logs appear every 30 seconds  
✅ Database query shows correct pending bookings  
✅ Elapsed time increments correctly  
✅ Timeout triggers at exactly 120s (general) or 60s (emergency)  
✅ Reassignment completes successfully  
✅ Socket events notify users  
✅ Ambulance status updates  
✅ Previous ambulance becomes available  
