# Automatic Reassignment - Testing Guide

## Quick Test Checklist

### ✅ Step 1: Verify Server Started with Scheduler

**Expected Output:**
```
[BookingTimeout] Starting scheduler (checking every 30s, timeout: 120s general / 60s emergency)
```

**Check:**
```bash
# Look in server logs
npm start  # in backend directory
```

### ✅ Step 2: Create Test Booking

**Steps:**
1. Open frontend app
2. Select ambulance
3. Fill booking details
4. Submit booking

**Expected:**
- Booking created with status: `pending`
- Driver receives notification
- `assignedAt` timestamp set in database

**Verify in DB:**
```javascript
db.bookings.findOne({status: "pending"})
// Should show:
// {
//   status: "pending",
//   assignedAt: ISODate("2024-01-15T10:00:00Z"),
//   reassignmentCount: 0
// }
```

### ✅ Step 3: Option A - Wait for Timeout (Automatic Test)

**For General Booking:**
- Wait 2 minutes (120 seconds)
- Scheduler checks every 30 seconds
- At 120s: Timeout triggers → Reassignment starts

**For Emergency Booking:**
- Wait 1 minute (60 seconds)
- Timeout triggers faster

**Expected in Logs:**
```
[BookingTimeout] ⏰ Checking 1 pending bookings...
[BookingTimeout] ⏱ Booking 507f... timed out (125s > 120s). Attempting reassignment #1
[BookingTimeout] Found 12 available ambulances for reassignment. Top choice: 507f...
[BookingTimeout] ✓ Reassigned booking 507f... to ambulance 507f... (attempt #1)
[BookingTimeout] ✓ Timeout check complete: 1 reassigned, 0 marked unavailable
```

### ✅ Step 3: Option B - Force Reassignment (Manual Test - Faster)

**Use Admin Endpoint:**
```bash
# Make POST request as admin user
curl -X POST http://localhost:5000/api/bookings/{bookingId}/manual-reassign \
  -H "Authorization: Bearer {adminToken}" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Booking reassigned successfully",
  "newAmbulanceId": "507f1f77bcf86cd799439012"
}
```

**Expected in Logs:**
```
[BookingTimeout] ✓ Reassigned booking ... to ambulance ...
```

### ✅ Step 4: Verify Reassignment in Database

**Query:**
```javascript
db.bookings.findOne({_id: ObjectId("507f...")})
```

**Expected Output:**
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  status: "pending",
  ambulance: ObjectId("507f1f77bcf86cd799439012"),  // NEW ambulance
  assignedAt: ISODate("2024-01-15T10:02:00Z"),      // NEW time
  reassignmentCount: 1,
  previousAssignments: [
    {
      ambulanceId: ObjectId("507f1f77bcf86cd799439010"),
      assignedAt: ISODate("2024-01-15T10:00:00Z"),
      timeoutAt: ISODate("2024-01-15T10:02:00Z"),
      reason: "Timeout after 120 seconds",
      driverName: "Old Driver",
      vehicleNumber: "MH02AB1111"
    }
  ]
}
```

### ✅ Step 5: Verify Socket Events Received

**Frontend User Receives:**
```javascript
socket.on('booking_reassigned', (data) => {
  console.log('✓ booking_reassigned event:', data);
  // Expected:
  // {
  //   bookingId: "507f...",
  //   newAmbulanceId: "507f...",
  //   driverName: "New Driver Name",
  //   vehicleNumber: "MH02AB2222",
  //   message: "Your booking has been reassigned..."
  // }
});
```

**Frontend Old Driver Receives:**
```javascript
socket.on('booking_timeout', (data) => {
  console.log('✓ booking_timeout event:', data);
  // Expected:
  // {
  //   bookingId: "507f...",
  //   message: "This booking request has expired and been reassigned..."
  // }
});
```

**Frontend New Driver Receives:**
```javascript
socket.on('new_booking_request', (data) => {
  console.log('✓ new_booking_request event:', data);
  // Expected:
  // {
  //   booking: {...},
  //   message: "New booking request received",
  //   isReassignment: true,
  //   reassignmentAttempt: 1
  // }
});
```

### ✅ Step 6: Check Reassignment History

**API Call:**
```bash
curl -X GET http://localhost:5000/api/bookings/{bookingId}/reassignment-history \
  -H "Authorization: Bearer {adminToken}"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "bookingId": "507f1f77bcf86cd799439011",
    "currentAmbulance": {
      "_id": "507f1f77bcf86cd799439012",
      "vehicleNumber": "MH02AB2222"
    },
    "reassignmentCount": 1,
    "totalAttempts": 2,
    "assignedAt": "2024-01-15T10:02:00Z",
    "previousAssignments": [
      {
        "ambulanceId": "507f1f77bcf86cd799439010",
        "assignedAt": "2024-01-15T10:00:00Z",
        "timeoutAt": "2024-01-15T10:02:00Z",
        "reason": "Timeout after 120 seconds",
        "vehicleNumber": "MH02AB1111"
      }
    ]
  }
}
```

## Advanced Tests

### Test: Multiple Reassignments

**Steps:**
1. Create booking
2. Force reassign (endpoint or wait)
3. Force reassign again
4. Check `reassignmentCount` = 2

**Expected:**
- `reassignmentCount: 2`
- `previousAssignments` array has 2 entries

### Test: Max Reassignments Reached

**Setup:**
- Make all but 5 ambulances unavailable in database
- Create booking
- Force reassign 5 times

**Expected:**
```
[BookingTimeout] Max reassignments reached for booking 507f...
[BookingTimeout] ✗ Marked booking 507f... as unavailable after 5 attempts
```

**Verify in DB:**
```javascript
db.bookings.findOne({_id: ObjectId("507f...")})
// status: "unavailable"
// reassignmentCount: 5
```

### Test: No Ambulances Available

**Setup:**
- Mark all ambulances unavailable
- Create booking
- Try to reassign (endpoint)

**Expected Response:**
```json
{
  "success": false,
  "message": "No available ambulances for reassignment."
}
```

**Expected in Logs:**
```
[BookingTimeout] No available ambulances for reassignment of booking 507f...
```

### Test: Emergency vs General Timeout

**General Booking:**
```javascript
// emergencyType: 'general'
// Timeout: 120 seconds
```

**Emergency Booking:**
```javascript
// emergencyType: 'cardiac'
// Timeout: 60 seconds
```

**Verify:**
- Create general booking, wait 120s → reassigns
- Create cardiac booking, wait 60s → reassigns sooner

## Performance Tests

### Test: Scheduler Under Load

**Steps:**
1. Create 10+ pending bookings
2. Wait for scheduler check (30 seconds)
3. Monitor logs and database

**Expected:**
```
[BookingTimeout] ⏰ Checking 10 pending bookings...
[BookingTimeout] ✓ Timeout check complete: X reassigned, Y marked unavailable
```

**Performance:**
- Should complete in <1 second for 10 bookings
- No server lag or crashes

### Test: Logging Volume

**Expected:**
- ~10-15 log lines per reassignment
- Clean, timestamped logs
- No duplicate logs

## Troubleshooting Tests

### If No Logs Appear

**Check 1: Scheduler Started?**
```bash
# Look for this in server startup logs:
[BookingTimeout] Starting scheduler...
```

**Fix:**
- Restart server: `npm start`
- Check for errors in logs

**Check 2: Pending Bookings Exist?**
```javascript
db.bookings.countDocuments({status: "pending"})
// Should be > 0
```

**Fix:**
- Create test booking first

**Check 3: Timeout Exceeded?**
```javascript
// Check if enough time passed
const booking = db.bookings.findOne({status: "pending"});
const now = new Date();
const elapsed = (now - booking.assignedAt) / 1000;
console.log(`Elapsed: ${elapsed} seconds`);
// Should be > 120 for general booking
```

**Fix:**
- Wait longer or use manual endpoint

### If Reassignment Fails

**Check Logs:**
```
[BookingTimeout] Error reassigning booking:
```

**Fix:**
1. Verify ambulance availability: `db.ambulances.findOne({isAvailable: true})`
2. Check database connection
3. Review error message in logs

### If Socket Events Not Received

**Check Connection:**
```javascript
socket.on('connect', () => console.log('✓ Connected'));
socket.on('disconnect', () => console.log('✗ Disconnected'));
```

**Fix:**
1. Check frontend socket initialization
2. Verify token authentication
3. Check websocket URL in config

## Monitoring Checklist

- [ ] Logs show scheduler starting
- [ ] Logs show timeout detection
- [ ] Logs show reassignment success
- [ ] Socket events received by clients
- [ ] Database shows updated booking
- [ ] Reassignment history accessible
- [ ] No server errors or crashes

## Success Criteria

✅ All tests pass when:

1. **Automatic Timeout Works**
   - Booking reassigned after 60s (emergency) or 120s (general)

2. **Manual Reassignment Works**
   - Admin endpoint triggers reassignment

3. **Notifications Work**
   - User receives new driver info
   - Driver receives timeout notification
   - New driver receives booking

4. **History Preserved**
   - Previous assignments recorded
   - Reassignment count incremented
   - All data stored correctly

5. **Error Handling**
   - No ambulances → booking marked unavailable
   - Max reassignments → booking marked unavailable
   - Errors logged but don't crash system

## Questions?

Review: `AUTOMATIC_REASSIGNMENT_DOCS.md` for detailed information
