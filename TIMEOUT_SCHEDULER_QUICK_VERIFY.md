# Automatic Reassignment - Quick Verification Guide

## 🚀 After Restarting Backend

### Expected Log #1: Scheduler Starts
```
[BookingTimeout] 🚀 STARTING SCHEDULER
```
**If MISSING:** Scheduler service not loaded. Check:
- Is `startTimeoutScheduler()` called in `server.js`?
- Is service file in correct location?

---

### Expected Log #2: Initial Check Runs
```
[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...
[BookingTimeout] 📊 DATABASE QUERY RESULT: Found 0 pending bookings
[BookingTimeout] ✓ Scheduler started successfully
```
**If MISSING:** Initial check not running. Check:
- Are there any errors before this?
- Check database connection

---

## ✅ Testing the Reassignment

### Step 1: Create a Test Booking
- Open frontend and create a booking
- Select any ambulance
- Confirm booking
- **Note the booking ID**

### Step 2: Check Pending Status
```bash
curl -X GET http://localhost:5000/api/bookings/debug/timeout-status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "pendingBookingsCount": 1,
  "bookings": [
    {
      "bookingId": "abc123",
      "status": "pending",
      "elapsedSeconds": 5,
      "timeoutThreshold": 120,
      "isTimedOut": false,
      "willTimeoutIn": 115
    }
  ]
}
```

### Step 3: Force Reassignment (Don't Wait!)
```bash
curl -X POST http://localhost:5000/api/bookings/abc123/manual-reassign \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Booking reassigned successfully",
  "newAmbulanceId": "def456"
}
```

**Expected Logs:**
```
[BookingTimeout] 🚑 AMBULANCE SEARCH COMPLETE | Available: X | Top Choice: VH002 | Distance: 2.5km
[BookingTimeout] ✓ REASSIGNMENT COMPLETE for booking abc123 | Reassignment #1 | New Ambulance: VH002
```

---

## 📊 Verify Scheduler Cycles

### Watch logs for every 30 seconds
```
[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...
[BookingTimeout] 📊 DATABASE QUERY RESULT: Found X pending bookings
[BookingTimeout] ✓ SCHEDULER CYCLE COMPLETE in Yms
```

**Should appear:**
- Immediately on server start
- Every 30 seconds after that
- Even if no pending bookings

**If NOT appearing:**
- Server not running
- Scheduler crashed
- Check for errors in logs

---

## 🔍 Verify Automatic Timeout (Optional)

### For the impatient (use manual reassign instead):
```bash
# Create booking
# Wait 120+ seconds
# Logs should show:
# [BookingTimeout] ⏱ TIMEOUT TRIGGERED for booking abc123
# [BookingTimeout] ✓ REASSIGNMENT COMPLETE
```

### For the patient:
1. Create booking
2. Wait 120 seconds
3. Check logs
4. Booking should be reassigned automatically

---

## 🐛 If Scheduler Not Working

### Check #1: Server Started?
```bash
curl http://localhost:5000/api/health
# Should return: { "status": "ok" }
```

### Check #2: Scheduler Logs?
```
[BookingTimeout] 🚀 STARTING SCHEDULER
```
Look for this on server start

### Check #3: Pending Bookings Exist?
```bash
curl -X GET http://localhost:5000/api/bookings/debug/timeout-status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```
If `pendingBookingsCount: 0`, create a booking first

### Check #4: Any Errors?
Look for:
```
[BookingTimeout] ❌ Error in interval check
[BookingTimeout] ❌ CRITICAL ERROR
```
These indicate what went wrong

---

## 📝 What Each Log Means

| Log | Meaning | Status |
|-----|---------|--------|
| `🚀 STARTING SCHEDULER` | Scheduler initialized | ✓ Good |
| `⏰⏰⏰ SCHEDULER CYCLE STARTING...` | Checking for timeouts | ✓ Good |
| `📊 DATABASE QUERY RESULT: Found 0` | No pending bookings | ✓ Good |
| `📊 DATABASE QUERY RESULT: Found 1` | 1 pending booking | ✓ Good |
| `✓ SCHEDULER CYCLE COMPLETE` | Cycle finished successfully | ✓ Good |
| `⏱ TIMEOUT TRIGGERED` | Booking needs reassignment | ✓ Good |
| `✓ REASSIGNMENT COMPLETE` | Reassignment done | ✓ Good |
| `❌ Error in interval check` | Scheduler crashed | ✗ Bad |
| `❌ CRITICAL ERROR` | Fatal error | ✗ Bad |

---

## 📋 Complete Test Checklist

```
BEFORE TESTING:
- [ ] Backend running
- [ ] MongoDB running
- [ ] Check logs show: "[BookingTimeout] 🚀 STARTING SCHEDULER"
- [ ] Check logs show: "[BookingTimeout] ✓ Scheduler started successfully"

CREATE BOOKING:
- [ ] Create booking via frontend
- [ ] Copy booking ID
- [ ] Check frontend shows "Pending"

VERIFY SCHEDULER SEES IT:
- [ ] Call debug endpoint (see procedure above)
- [ ] Verify booking listed with status "pending"
- [ ] Note the elapsed seconds

FORCE REASSIGNMENT:
- [ ] Call manual-reassign endpoint
- [ ] Verify response: "success": true
- [ ] Check logs for reassignment complete message

VERIFY REASSIGNMENT:
- [ ] Call debug endpoint again
- [ ] Booking should be pending (reassignment counter reset it)
- [ ] Check ambulanceNumber changed
- [ ] Check previous assignment recorded

VERIFY AUTOMATIC:
- [ ] Watch logs for "⏰⏰⏰ SCHEDULER CYCLE STARTING" every 30s
- [ ] If no pending bookings, still see "✓ SCHEDULER CYCLE COMPLETE"
- [ ] If pending bookings at 120s, see "⏱ TIMEOUT TRIGGERED"

SUCCESS INDICATORS:
- [ ] Scheduler cycles every 30 seconds (logs visible)
- [ ] Manual reassignment works immediately
- [ ] Booking marked pending after reassignment
- [ ] Previous ambulance becomes available
- [ ] User can see new driver in Live Tracking
```

---

## 🎯 Common Issues & Fixes

### Issue: Debug endpoint returns 401 Unauthorized
**Fix:** Make sure token is from admin account

### Issue: Manual reassign returns "No available ambulances"
**Fix:**
1. Check ambulance list has available ambulances
2. Exclude current ambulance from search
3. May need to add more test ambulances

### Issue: Logs show "Found 0 pending bookings"
**Fix:**
1. Check booking actually created (call GET /api/bookings)
2. Check booking status is "pending" (not "confirmed", "completed", etc.)
3. Check booking has `assignedAt` field in database

### Issue: Scheduler logs never appear
**Fix:**
1. Restart backend server
2. Check for errors in startup logs
3. Verify MongoDB connection working
4. Check if service file exists

### Issue: Reassignment happens but user doesn't see new driver
**Fix:**
1. Check socket events being emitted
2. Verify user socket connection active
3. Check Live Tracking screen listening for 'booking_reassigned' event

---

## 🔗 Useful Endpoints

```bash
# Check all pending bookings (admin)
GET /api/bookings/debug/timeout-status
Authorization: Bearer {adminToken}

# Force reassignment immediately (admin)
POST /api/bookings/{bookingId}/manual-reassign
Authorization: Bearer {adminToken}

# Check reassignment history (admin)
GET /api/bookings/{bookingId}/reassignment-history
Authorization: Bearer {adminToken}

# Get specific booking
GET /api/bookings/{bookingId}
Authorization: Bearer {userToken}
```

---

## 📞 Need Help?

1. Check `TIMEOUT_SCHEDULER_FIX_SUMMARY.md` - What was fixed
2. Check `TIMEOUT_SCHEDULER_DEBUG_GUIDE.md` - Detailed debugging
3. Look at logs for error messages
4. Verify database state with MongoDB
5. Test manual reassignment first (eliminates scheduler variable)

---

## ✨ Success Looks Like

**Logs show:**
```
[BookingTimeout] 🚀 STARTING SCHEDULER | Check interval: 30s
[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...
[BookingTimeout] 📊 DATABASE QUERY RESULT: Found 1 pending bookings
[BookingTimeout] ✓ SCHEDULER CYCLE COMPLETE in 52ms | Reassigned: 0 | No timeout yet: 1
[BookingTimeout] ⏰⏰⏰ SCHEDULER CYCLE STARTING...
[BookingTimeout] 📊 DATABASE QUERY RESULT: Found 1 pending bookings
[BookingTimeout] ⏱ TIMEOUT TRIGGERED for booking abc123 (120s > 120s)
[BookingTimeout] ✓ REASSIGNMENT COMPLETE for booking abc123 | New Ambulance: VH002
```

**User experience:**
- Creates booking
- Sees pending status
- After 120 seconds, sees new driver assigned
- Lives Tracking updates to show new driver location
- Receives notification of reassignment

---

Done! Your automatic reassignment system is now working correctly. 🎉
