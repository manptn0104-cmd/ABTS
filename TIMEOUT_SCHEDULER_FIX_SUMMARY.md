# Automatic Reassignment Bug Fix - Executive Summary

## The Problem

Automatic driver reassignment was **completely broken**. Bookings remained stuck in "pending" status indefinitely because the scheduler was starting but **never actually checking for timeouts**.

### Symptoms
- ✗ Scheduler starts: `[BookingTimeout] Starting scheduler...` ✓
- ✗ Booking created and pending
- ✗ Wait 2+ minutes
- ✗ Booking STILL pending, no reassignment
- ✗ Logs NEVER show: "Checking pending bookings", "Timeout triggered", "Reassigning"

---

## Root Causes (6 Issues Found)

### 1. Silent Exit Without Logs
**Code:**
```javascript
if (pendingBookings.length === 0) {
  return;  // ❌ Returns silently - no way to know scheduler ran!
}
```
**Impact:** When no pending bookings, scheduler would exit without logging. You couldn't tell if it was running!

---

### 2. Query Filter Too Loose
**Code:**
```javascript
assignedAt: { $exists: true }  // ❌ Might match null values
```
**Impact:** Query might not find bookings with `assignedAt: null`

---

### 3. No Immediate First Run
**Code:**
```javascript
timeoutScheduler = setInterval(runTimeoutCheck, 30000);  // First run: after 30s!
```
**Impact:** Scheduler waited 30 seconds before first check. Early timeouts would be missed.

---

### 4. Async Error Swallowing
**Code:**
```javascript
setInterval(runTimeoutCheck, 30000);  // If async function fails, silently dies
```
**Impact:** Any error in `runTimeoutCheck` would crash the interval without logging.

---

### 5. Incomplete Error Logging
**Code:**
```javascript
console.error('Error in timeout scheduler:', error.message);  // ❌ Missing stack trace
```
**Impact:** Hard to debug what actually went wrong.

---

### 6. No Cycle Visibility
**No logs indicating:**
- When cycle starts
- How many pending bookings found
- How many were checked
- How many errors occurred

**Impact:** Impossible to diagnose if scheduler was actually executing.

---

## The Fix

### Fix #1: Log Every Cycle (Even With No Bookings)
```javascript
// BEFORE
if (pendingBookings.length === 0) {
  return;  // Silent exit
}

// AFTER
if (pendingBookings.length === 0) {
  const cycleTime = Date.now() - cycleStart;
  console.log(
    `[BookingTimeout] ✓ No pending bookings to check. Cycle complete in ${cycleTime}ms`
  );
  return;  // Now you see the log!
}
```

### Fix #2: Tighten Query Filter
```javascript
// BEFORE
assignedAt: { $exists: true }

// AFTER
assignedAt: { $exists: true, $ne: null }  // Explicit null check
```

### Fix #3: Run Immediately on Startup
```javascript
// BEFORE
timeoutScheduler = setInterval(runTimeoutCheck, 30000);  // First run after 30s

// AFTER
// Run immediately
runTimeoutCheck().catch((error) => {
  console.error('[BookingTimeout] ❌ Error in initial check:', error.message);
});

// Then run at intervals
timeoutScheduler = setInterval(() => {
  runTimeoutCheck().catch((error) => {
    console.error('[BookingTimeout] ❌ Error in interval check:', error.message);
  });
}, 30000);
```

### Fix #4: Catch Async Errors
```javascript
// BEFORE
setInterval(runTimeoutCheck, 30000);  // Unhandled promise rejection!

// AFTER
setInterval(() => {
  runTimeoutCheck().catch((error) => {  // ✓ Caught with .catch()
    console.error('[BookingTimeout] ❌ Error in interval check:', error.message);
  });
}, 30000);
```

### Fix #5: Add Full Error Details
```javascript
// BEFORE
console.error('Error in timeout scheduler:', error.message);

// AFTER
console.error('[BookingTimeout] ❌ CRITICAL ERROR in timeout scheduler:', error.message);
console.error('[BookingTimeout] Error Details:', {
  name: error.name,
  message: error.message,
  stack: error.stack,  // Full stack trace
});
```

### Fix #6: Add Clear Cycle Logging
```javascript
// BEFORE
// No indication of cycle start/end
console.log('Checking pending bookings...');

// AFTER
console.log(`[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...`);
console.log('[BookingTimeout] 🔍 Querying database for pending bookings...');
console.log(`[BookingTimeout] 📊 DATABASE QUERY RESULT: Found ${pendingBookings.length}`);
// ... processing ...
console.log(`[BookingTimeout] ✓ SCHEDULER CYCLE COMPLETE in ${cycleTime}ms | Reassigned: ${count}`);
```

---

## New Debug Endpoint

Added new admin endpoint to check timeout status:

```bash
GET /api/bookings/debug/timeout-status
Authorization: Bearer {adminToken}
```

**Returns:**
- List of all pending bookings
- Elapsed time since assignment
- Timeout threshold
- Whether timeout has occurred
- Time remaining until timeout

**Use:**
```bash
curl -X GET http://localhost:5000/api/bookings/debug/timeout-status \
  -H "Authorization: Bearer {adminToken}"
```

---

## Expected Behavior After Fix

### Logs on Server Start
```
[BookingTimeout] 🚀 STARTING SCHEDULER | Check interval: 30s | General timeout: 120s | Emergency timeout: 60s | Max reassignments: 5
[BookingTimeout] 🏃 Running initial check immediately...
[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...
[BookingTimeout] 🔍 Querying database for pending bookings...
[BookingTimeout] 📊 DATABASE QUERY RESULT: Found 0 pending bookings
[BookingTimeout] ✓ No pending bookings to check. Cycle complete in 45ms
[BookingTimeout] ✓ Scheduler started successfully
```

### Every 30 Seconds (Cycle Check)
```
[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...
[BookingTimeout] 🔍 Querying database for pending bookings...
[BookingTimeout] 📊 DATABASE QUERY RESULT: Found X pending bookings
[BookingTimeout] ✓ SCHEDULER CYCLE COMPLETE in Yms | Reassigned: A | Unavailable: B | No timeout yet: C | Errors: D
```

### When Timeout Occurs (120s elapsed)
```
[BookingTimeout] ⏱ TIMEOUT TRIGGERED for booking abc123 (120s > 120s). Attempting reassignment #1
[BookingTimeout] 🚑 AMBULANCE SEARCH COMPLETE | Available: 12 | Top Choice: VH002 | Distance: 2.5km | ETA: 5min | Rank Score: 3.45 | Has Facilities: true
[BookingTimeout] ✓ REASSIGNMENT COMPLETE for booking abc123 | Reassignment #1 | New Ambulance: VH002 | reassignedAt: 2026-06-04T10:02:00Z (timer reset)
```

---

## Files Modified

1. **`backend/src/services/bookingTimeoutService.js`**
   - Fixed `runTimeoutCheck()` function
   - Fixed `startTimeoutScheduler()` function
   - Improved all logging

2. **`backend/src/controllers/bookingController.js`**
   - Added `getTimeoutDebugStatus()` endpoint

3. **`backend/src/routes/bookings.js`**
   - Added `/debug/timeout-status` route

---

## Testing

### Quick Verification
```bash
# 1. Start server - should see scheduler logs
npm start

# 2. Create a booking (frontend or API)

# 3. Wait 120 seconds or force with:
curl -X POST http://localhost:5000/api/bookings/{id}/manual-reassign \
  -H "Authorization: Bearer {adminToken}"

# 4. Check logs - should see reassignment logs

# 5. Check booking - status should be pending, ambulance changed
```

### Check Timeout Status Anytime
```bash
curl -X GET http://localhost:5000/api/bookings/debug/timeout-status \
  -H "Authorization: Bearer {adminToken}" | jq '.bookings[] | {id:.bookingId, elapsed:.elapsedSeconds, willTimeout:.isTimedOut}'
```

---

## Success Checklist

After applying fix and restarting:

- [ ] Server logs show: `[BookingTimeout] 🚀 STARTING SCHEDULER`
- [ ] Server logs show: `[BookingTimeout] ✓ Scheduler started successfully`
- [ ] Logs show scheduler cycle starting every 30 seconds
- [ ] Create booking, see it's pending
- [ ] Wait 120+ seconds
- [ ] Logs show: `[BookingTimeout] ⏱ TIMEOUT TRIGGERED`
- [ ] Logs show: `[BookingTimeout] ✓ REASSIGNMENT COMPLETE`
- [ ] Booking ambulance changed in database
- [ ] User receives notification of new driver
- [ ] New driver receives booking request notification

---

## Why This Was Broken

1. **Silent failures** - No logs to indicate what went wrong
2. **No immediate run** - First check was delayed 30 seconds
3. **Loose error handling** - Async errors silently died
4. **Poor logging** - Impossible to diagnose issues
5. **No visibility** - Users didn't know why booking wasn't reassigning

---

## Why This Is Now Fixed

1. ✅ **Every cycle logged** - You can see what's happening
2. ✅ **Immediate first run** - No delays on startup
3. ✅ **Proper error handling** - All errors caught and logged
4. ✅ **Comprehensive logging** - Easy to diagnose any issue
5. ✅ **Debug endpoint** - Check status anytime
6. ✅ **Explicit null checks** - Query works correctly
7. ✅ **Clear cycle markers** - Know exactly when scheduler runs

---

## What Happens Now

```
User Books → Ambulance Assigned (pending)
  ↓
Scheduler checks every 30 seconds
  ↓
120 seconds passes (for general booking)
  ↓
Timeout detected → Find next best ambulance
  ↓
Reassign booking → Release old ambulance
  ↓
Notify user → Notify new driver
  ↓
User sees new driver in Live Tracking
  ↓
New driver receives booking request
```

---

## Support

See `TIMEOUT_SCHEDULER_DEBUG_GUIDE.md` for:
- Detailed troubleshooting
- Log interpretation
- Database verification
- Test procedures
