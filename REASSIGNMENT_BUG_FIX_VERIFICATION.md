# Automatic Reassignment Bug Fix - Verification Guide

## Bug Fixed

**Problem:** Bookings were being continuously reassigned every 30 seconds in a loop instead of waiting for the timeout period to elapse.

**Root Cause:** The timeout calculation used `assignedAt` (which never changed), not `reassignedAt`, causing every scheduler cycle to detect a timeout.

**Solution:** 
1. Added `reassignedAt` field to Booking model
2. Updated timeout calculation to use: `reassignedAt || assignedAt`
3. Reset timer by setting `reassignedAt = new Date()` after each reassignment
4. Added comprehensive debug logging to track the timer behavior

---

## Expected Behavior: Timeline

### Scenario: General Booking Timeout (120 seconds)

```
T=0s
  Log: [BookingTimeout] ⏰ SCHEDULER CHECK | Pending bookings: 1 | Checking for timeouts...
  Log: [BookingTimeout] Booking abc123 | Ambulance: VH001 | Reassignments: 0 | Reference: assignedAt (2026-06-04T10:00:00Z) | Elapsed: 0.1s / 120s timeout
  Log: [BookingTimeout] ✓ SCHEDULER COMPLETE | Reassigned: 0 | Unavailable: 0 | No timeout yet: 1 | Errors: 0

T=30s (Scheduler runs again)
  Log: [BookingTimeout] Booking abc123 | Ambulance: VH001 | Reassignments: 0 | Reference: assignedAt (2026-06-04T10:00:00Z) | Elapsed: 30.5s / 120s timeout
  Log: [BookingTimeout] ✓ SCHEDULER COMPLETE | Reassigned: 0 | Unavailable: 0 | No timeout yet: 1 | Errors: 0

T=60s (Scheduler runs again)
  Log: [BookingTimeout] Booking abc123 | Ambulance: VH001 | Reassignments: 0 | Reference: assignedAt (2026-06-04T10:00:00Z) | Elapsed: 60.2s / 120s timeout
  Log: [BookingTimeout] ✓ SCHEDULER COMPLETE | Reassigned: 0 | Unavailable: 0 | No timeout yet: 1 | Errors: 0

T=90s (Scheduler runs again)
  Log: [BookingTimeout] Booking abc123 | Ambulance: VH001 | Reassignments: 0 | Reference: assignedAt (2026-06-04T10:00:00Z) | Elapsed: 90.1s / 120s timeout
  Log: [BookingTimeout] ✓ SCHEDULER COMPLETE | Reassigned: 0 | Unavailable: 0 | No timeout yet: 1 | Errors: 0

T=120s (TIMEOUT!)
  Log: [BookingTimeout] ⏰ SCHEDULER CHECK | Pending bookings: 1 | Checking for timeouts...
  Log: [BookingTimeout] Booking abc123 | Ambulance: VH001 | Reassignments: 0 | Reference: assignedAt (2026-06-04T10:00:00Z) | Elapsed: 120.5s / 120s timeout
  Log: [BookingTimeout] ⏱ TIMEOUT TRIGGERED for booking abc123 (120s > 120s). Attempting reassignment #1
  Log: [BookingTimeout] Searching for next ambulance. Excluding 1 previously assigned ambulances.
  Log: [BookingTimeout] 🚑 AMBULANCE SEARCH COMPLETE | Available: 12 | Top Choice: VH002 | Distance: 2.5km | ETA: 5min | Rank Score: 3.45 | Has Facilities: true
  Log: [BookingTimeout] ✓ Notified driver John Doe that booking reassigned from VH001
  Log: [BookingTimeout] ✓ Released ambulance VH001 back to available pool
  Log: [BookingTimeout] ✓ REASSIGNMENT COMPLETE for booking abc123 | Reassignment #1 | New Ambulance: VH002 | reassignedAt: 2026-06-04T10:02:00Z (timer reset)
  Log: [BookingTimeout] ✓ Marked ambulance VH002 as unavailable
  Log: [BookingTimeout] ✓ Notified driver Jane Smith (VH002) of new booking request
  Log: [BookingTimeout] ✓ Notified user user456 of reassignment. Next timeout in 120s
  Log: [BookingTimeout] ✓ SCHEDULER COMPLETE | Reassigned: 1 | Unavailable: 0 | No timeout yet: 0 | Errors: 0

T=150s (Scheduler runs again - NEW TIMER ACTIVE)
  Log: [BookingTimeout] Booking abc123 | Ambulance: VH002 | Reassignments: 1 | Reference: reassignedAt (2026-06-04T10:02:00Z) | Elapsed: 30.2s / 120s timeout
  Log: [BookingTimeout] ✓ SCHEDULER COMPLETE | Reassigned: 0 | Unavailable: 0 | No timeout yet: 1 | Errors: 0
  🎯 NOTE: Now it's using reassignedAt! Timer resets to 0 at T=120s

T=180s (Scheduler runs again)
  Log: [BookingTimeout] Booking abc123 | Ambulance: VH002 | Reassignments: 1 | Reference: reassignedAt (2026-06-04T10:02:00Z) | Elapsed: 60.1s / 120s timeout
  Log: [BookingTimeout] ✓ SCHEDULER COMPLETE | Reassigned: 0 | Unavailable: 0 | No timeout yet: 1 | Errors: 0

T=240s (Second timeout if no response)
  Log: [BookingTimeout] Booking abc123 | Ambulance: VH002 | Reassignments: 1 | Reference: reassignedAt (2026-06-04T10:02:00Z) | Elapsed: 120.3s / 120s timeout
  Log: [BookingTimeout] ⏱ TIMEOUT TRIGGERED for booking abc123 (120s > 120s). Attempting reassignment #2
  Log: [BookingTimeout] 🚑 AMBULANCE SEARCH COMPLETE | Available: 10 | Top Choice: VH003 | Distance: 3.1km | ETA: 6min | Rank Score: 3.89 | Has Facilities: true
  Log: [BookingTimeout] ✓ REASSIGNMENT COMPLETE for booking abc123 | Reassignment #2 | New Ambulance: VH003 | reassignedAt: 2026-06-04T10:04:00Z (timer reset)
  Log: [BookingTimeout] ✓ SCHEDULER COMPLETE | Reassigned: 1 | Unavailable: 0 | No timeout yet: 0 | Errors: 0
```

---

## Key Improvements in Logs

### Before Fix
```
[BookingTimeout] Found 12 available ambulances for reassignment. Top choice: 507f1f77bcf86cd799439012
[BookingTimeout] ✓ Reassigned booking 507f1f77bcf86cd799439011 to ambulance 507f1f77bcf86cd799439012 (attempt #1)
[BookingTimeout] ✓ Timeout check complete: 1 reassigned, 0 marked unavailable
```

### After Fix
```
[BookingTimeout] Booking abc123 | Ambulance: VH001 | Reassignments: 0 | Reference: assignedAt (2026-06-04T10:00:00Z) | Elapsed: 120.5s / 120s timeout
[BookingTimeout] ⏱ TIMEOUT TRIGGERED for booking abc123 (120s > 120s). Attempting reassignment #1
[BookingTimeout] 🚑 AMBULANCE SEARCH COMPLETE | Available: 12 | Top Choice: VH002 | Distance: 2.5km | ETA: 5min | Rank Score: 3.45 | Has Facilities: true
[BookingTimeout] ✓ REASSIGNMENT COMPLETE for booking abc123 | Reassignment #1 | New Ambulance: VH002 | reassignedAt: 2026-06-04T10:02:00Z (timer reset)
[BookingTimeout] ✓ SCHEDULER COMPLETE | Reassigned: 1 | Unavailable: 0 | No timeout yet: 1 | Errors: 0
```

---

## Database State Verification

### After Initial Assignment (T=0s)

```javascript
db.bookings.findOne({_id: ObjectId("abc123")})
{
  _id: ObjectId("abc123"),
  user: ObjectId("user456"),
  ambulance: ObjectId("VH001"),
  status: "pending",
  emergencyType: "general",
  assignedAt: ISODate("2026-06-04T10:00:00Z"),
  reassignedAt: null,  // Not set yet
  reassignmentCount: 0,
  previousAssignments: []
}
```

### After First Timeout & Reassignment (T=120s)

```javascript
db.bookings.findOne({_id: ObjectId("abc123")})
{
  _id: ObjectId("abc123"),
  user: ObjectId("user456"),
  ambulance: ObjectId("VH002"),  // NEW AMBULANCE
  status: "pending",
  emergencyType: "general",
  assignedAt: ISODate("2026-06-04T10:00:00Z"),  // UNCHANGED
  reassignedAt: ISODate("2026-06-04T10:02:00Z"),  // ✓ RESET TIMER
  reassignmentCount: 1,
  previousAssignments: [
    {
      ambulanceId: ObjectId("VH001"),
      driverId: ObjectId("driver1"),
      assignedAt: ISODate("2026-06-04T10:00:00Z"),
      timeoutAt: ISODate("2026-06-04T10:02:00Z"),
      reason: "Timeout after 120 seconds",
      driverName: "John Doe",
      vehicleNumber: "VH001"
    }
  ]
}
```

**Key Change:** `reassignedAt` is now set, so next timeout calculation uses this instead of `assignedAt`.

### After Second Timeout & Reassignment (T=240s)

```javascript
db.bookings.findOne({_id: ObjectId("abc123")})
{
  _id: ObjectId("abc123"),
  user: ObjectId("user456"),
  ambulance: ObjectId("VH003"),  // THIRD AMBULANCE
  status: "pending",
  emergencyType: "general",
  assignedAt: ISODate("2026-06-04T10:00:00Z"),  // NEVER CHANGES
  reassignedAt: ISODate("2026-06-04T10:04:00Z"),  // ✓ UPDATED AGAIN
  reassignmentCount: 2,
  previousAssignments: [
    {
      ambulanceId: ObjectId("VH001"),
      driverId: ObjectId("driver1"),
      assignedAt: ISODate("2026-06-04T10:00:00Z"),
      timeoutAt: ISODate("2026-06-04T10:02:00Z"),
      reason: "Timeout after 120 seconds",
      driverName: "John Doe",
      vehicleNumber: "VH001"
    },
    {
      ambulanceId: ObjectId("VH002"),
      driverId: ObjectId("driver2"),
      assignedAt: ISODate("2026-06-04T10:02:00Z"),
      timeoutAt: ISODate("2026-06-04T10:04:00Z"),
      reason: "Timeout after 120 seconds",
      driverName: "Jane Smith",
      vehicleNumber: "VH002"
    }
  ]
}
```

---

## Critical Differences

| Aspect | Before Fix | After Fix |
|--------|-----------|----------|
| **Timeout Reference** | Always `assignedAt` (never resets) | Uses `reassignedAt` or `assignedAt` |
| **Behavior** | Reassigned every 30s (infinite loop) | Reassigned only after 120s timeout |
| **Timer Reset** | ❌ Never resets | ✅ Resets with `reassignedAt` |
| **Log Detail** | Minimal | Comprehensive timing info |
| **Ambulance Churn** | ✗ Huge waste of resources | ✓ Stable, predictable |
| **User Experience** | ✗ Constant driver changes | ✓ Driver gets 120s to respond |

---

## Testing This Fix

### Quick Test

```bash
# 1. Create booking
# 2. Check logs immediately
# Look for: "Elapsed: 0.1s / 120s timeout"
# Expected: NOT reassigned

# 3. Wait 120 seconds
# Look for: "Elapsed: 120.5s / 120s timeout"
# Expected: REASSIGNED

# 4. Check logs after reassignment
# Look for: "reassignedAt: 2026-06-04T10:02:00Z (timer reset)"
# Expected: Timer reset to new time

# 5. Wait another 120 seconds
# Look for: "Elapsed: 30.2s / 120s timeout" (using reassignedAt)
# Expected: NOT reassigned (timer is fresh)
```

### Manual Database Check

```javascript
// After reassignment, verify these fields:
const booking = db.bookings.findOne({_id: ObjectId("...")});

console.log("Current ambulance:", booking.ambulance);
console.log("Reassignments:", booking.reassignmentCount);
console.log("Original assignment:", booking.assignedAt);
console.log("Last reassignment:", booking.reassignedAt);
console.log("Previous assignments count:", booking.previousAssignments.length);

// reassignedAt should be MORE RECENT than assignedAt
if (booking.reassignedAt > booking.assignedAt) {
  console.log("✓ Timer properly reset!");
} else {
  console.log("✗ Timer not reset properly");
}
```

### Expected Logs Over 5 Minutes

```
T=0min:   Booking created → assignedAt set
T=2min:   TIMEOUT → Reassigned #1 → reassignedAt set (timer reset)
T=4min:   TIMEOUT → Reassigned #2 → reassignedAt updated (timer reset)
T=6min:   TIMEOUT → Reassigned #3 → reassignedAt updated (timer reset)
```

NOT:
```
T=0min:   REASSIGNED (WRONG - too fast)
T=0.5min: REASSIGNED (WRONG - continuous loop)
T=1min:   REASSIGNED (WRONG - continuous loop)
```

---

## Verification Checklist

- [ ] Logs show correct `Reference: assignedAt` on first timeout
- [ ] Logs show timeout triggered exactly at 120 seconds (not before)
- [ ] After reassignment, logs show new `reassignedAt` time
- [ ] After reassignment, logs show `Reference: reassignedAt` on next check
- [ ] Subsequent checks show `Elapsed` counted from `reassignedAt`
- [ ] Second timeout occurs 120 seconds after first reassignment
- [ ] Previous ambulance becomes available after each reassignment
- [ ] New ambulance marked unavailable after each reassignment
- [ ] Reassignment count increments correctly
- [ ] Previous assignments array grows with each reassignment
- [ ] No rapid reassignments (should be 120+ seconds apart)
- [ ] Socket events received by users/drivers as expected
- [ ] Database shows `reassignedAt` timestamp updating

---

## If Something Looks Wrong

### Issue: Reassigning Too Frequently

**Check:**
```
[BookingTimeout] Elapsed: 5.2s / 120s timeout
[BookingTimeout] ⏱ TIMEOUT TRIGGERED
```

**Problem:** Timeout calculation wrong

**Fix:** Verify `reassignedAt` is being set after reassignment
```javascript
const booking = db.bookings.findOne({...});
console.log("reassignedAt set?", booking.reassignedAt !== null);
console.log("reassignedAt value:", booking.reassignedAt);
```

### Issue: Not Reassigning After Timeout

**Check:**
```
[BookingTimeout] Elapsed: 150.1s / 120s timeout
[BookingTimeout] Reassigned: 0
```

**Problem:** Timeout detected but reassignment failed

**Fix:** Check logs for reassignment errors
```
[BookingTimeout] ❌ AMBULANCE SEARCH FAILED
```

### Issue: Wrong Reference Time

**Check:**
```
[BookingTimeout] Reference: assignedAt (2026-06-04T10:00:00Z)
// After reassignment:
[BookingTimeout] Reference: assignedAt (2026-06-04T10:00:00Z)  // STILL USING assignedAt!
```

**Problem:** `reassignedAt` not being used

**Fix:** Check reassignment code sets `reassignedAt = new Date()`

---

## Success Indicators

✅ Booking reassigned exactly once per timeout period
✅ Timer resets after each reassignment
✅ Timeout calculation uses correct reference time
✅ Logs show clear timing information
✅ No infinite reassignment loops
✅ Previous assignments recorded correctly
✅ Ambulance availability managed correctly
