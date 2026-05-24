# ABTS Feedback & Reviews Implementation - Test Guide

## Overview
Implemented full feedback persistence with admin and driver review visibility using MongoDB + Express + React Native.

## Architecture

### Backend Models
- **Review.js** - Stores feedback with fields: bookingId, userId, driverId, ambulanceId, rating, feedback, tags, createdAt
- **User.js** - Added averageRating and reviewCount for drivers
- **Ambulance.js** - Uses nested rating.average and rating.count (already existed)
- **Booking.js** - Links to reviews through reviewId

### Backend API Endpoints

#### Review Creation (Protected)
```
POST /api/reviews
Body: {
  bookingId: string,
  rating: number (1-5),
  feedback: string (optional),
  tags: string[] (optional)
}
Returns: { success: true, data: review }
```

#### Get Driver Reviews
```
GET /api/reviews/driver/:driverId?page=1&limit=10
Returns: { success: true, data: reviews[], total: number, pages: number }
```

#### Get All Reviews (Admin Only)
```
GET /api/reviews/admin/all?page=1&limit=20
Requires: Admin role authorization
Returns: { success: true, data: reviews[], total: number, pages: number }
```

#### Get Single Review
```
GET /api/reviews/:id
Requires: Authentication
Returns: { success: true, data: review }
```

### Frontend Screens

#### 1. FeedbackScreen (User)
**Location:** `frontend/src/screens/Feedback/FeedbackScreen.js`
- 5-star rating selector
- 8 predefined tags (positive/negative)
- Free text feedback (500 char max)
- Submit button → POST /api/reviews
- Validates: rating >= 1, completed booking only, one review per booking

#### 2. Admin Reviews Dashboard
**Location:** `frontend/src/screens/Admin/AdminDashboardScreen.js` (Reviews Tab)
- Tab 5: "Reviews" with star icon
- Lists all reviews across system
- Filter by rating (1-5 stars)
- Shows: user, driver, ambulance, rating, tags, feedback, date
- Pagination support

#### 3. Driver Reviews Dashboard
**Location:** `frontend/src/screens/Driver/ReviewsScreen.js`
- Shows average rating (large display)
- Total reviews count
- Top 5 feedback tags with frequency
- Latest 10 reviews in chronological order
- Each review shows: user name, rating stars, tags, feedback text

### Database Relationships

```
Booking ──── Review
  ├── user
  ├── ambulance ──── Ambulance ──── Owner (User - Driver)
  └── review (unique per booking)

User (Driver)
  ├── averageRating (calculated from reviews)
  └── reviewCount (count from reviews)
```

## Test Flow

### Step 1: Create a Booking and Complete It
1. Login as user@abts.com
2. Book an ambulance
3. (Manually update booking status to 'completed' in MongoDB for testing)
   ```javascript
   db.bookings.updateOne(
     { _id: ObjectId("...") },
     { $set: { status: "completed", completedAt: new Date() } }
   )
   ```

### Step 2: Submit Feedback
1. User navigates to booking history or gets prompted to review
2. Opens FeedbackScreen for completed booking
3. Selects 1-5 stars
4. Selects 1+ tags from predefined list
5. (Optional) Writes feedback text
6. Submits review
7. Verify success: "Your feedback has been submitted successfully"

### Step 3: Verify Backend Storage
```bash
curl http://localhost:5000/api/reviews/admin/all \
  -H "Authorization: Bearer {ADMIN_TOKEN}"
```

Expected Response:
```json
{
  "success": true,
  "count": 1,
  "total": 1,
  "data": [{
    "_id": "...",
    "bookingId": "...",
    "userId": { "name": "User Name", "email": "..." },
    "driverId": { "name": "Driver Name", "email": "...", "averageRating": 4.5 },
    "rating": 4,
    "feedback": "Great service",
    "tags": ["Fast Arrival", "Professional Driver"],
    "createdAt": "2026-05-24T..."
  }]
}
```

### Step 4: Admin Views Reviews
1. Login as admin@abts.com / Admin@123
2. Navigate to Admin Dashboard
3. Click "Reviews" tab (5th tab with star icon)
4. Verify:
   - Review appears in list
   - Filter by rating works
   - All fields display correctly

### Step 5: Driver Views Their Reviews
1. Login as driver (owner of ambulance)
2. Click "Reviews" tab in driver dashboard
3. Verify:
   - Average rating displays correctly
   - Total review count shows
   - Tags summary shows frequency
   - Individual reviews list with details

### Step 6: Verify Duplicate Prevention
1. Try to submit review again for same booking
2. Should get error: "You have already reviewed this booking"

### Step 7: Verify Validation
1. Try to submit rating = 0: Should fail with "Rating must be between 1 and 5"
2. Try to review non-completed booking: Should fail with "You can only review completed bookings"
3. Try to review someone else's booking: Should fail with "You can only review your own bookings"

## Key Features Verified

✓ One review per booking (unique constraint)
✓ Completed booking only (status validation)
✓ Minimum 1 star (rating validation)
✓ Driver rating auto-updates
✓ Admin can see all reviews
✓ Driver can see their reviews
✓ Tags persist and display
✓ Feedback text persists
✓ Review timestamps accurate
✓ User/Driver data populated correctly

## Database Queries

### View all reviews
```javascript
db.reviews.find().pretty()
```

### View reviews for specific driver
```javascript
db.reviews.find({ driverId: ObjectId("...") }).pretty()
```

### Check driver rating updated
```javascript
db.users.findOne({ _id: ObjectId("..."), role: "driver" })
```

### View review with all populated fields
```javascript
db.reviews.aggregate([
  { $match: { _id: ObjectId("...") } },
  { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
  { $lookup: { from: "users", localField: "driverId", foreignField: "_id", as: "driver" } },
  { $lookup: { from: "ambulances", localField: "ambulanceId", foreignField: "_id", as: "ambulance" } },
  { $lookup: { from: "bookings", localField: "bookingId", foreignField: "_id", as: "booking" } }
]).pretty()
```

## Troubleshooting

### Reviews not appearing in admin panel
- Check: Admin token valid and role = 'admin'
- Check: Reviews exist in database
- Check: getAllReviews endpoint returning data

### Driver rating not updating
- Check: updateDriverRating function called after review creation
- Check: Driver exists in database
- Verify: User.findByIdAndUpdate uses correct field names (averageRating, reviewCount)

### Duplicate review allowed
- Check: Booking has unique index on bookingId in Review schema
- Verify: createReview checks for existingReview before creating

### FeedbackScreen not accessible
- Check: Booking ID passed via route params
- Check: User authenticated
- Check: Booking belongs to logged-in user

## Performance Notes

- Review queries indexed by: driverId, ambulanceId, userId, createdAt
- Pagination implemented for admin review list (default 20 per page)
- Driver tags summary calculated in frontend (not stored)
- Rating aggregation in backend only

## Future Enhancements

1. Reply/Response system for reviews (admin/driver can reply)
2. Review moderation (flag inappropriate reviews)
3. Analytics dashboard (review trends, common complaints)
4. Photo upload with reviews
5. Review approval workflow
6. Automatic email notifications on new reviews
7. Review analytics by ambulance type
8. Driver performance badges based on ratings
