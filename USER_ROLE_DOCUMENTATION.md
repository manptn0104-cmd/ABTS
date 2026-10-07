# ABTS User Role Documentation

## Purpose
The User role represents a patient/customer who can discover ambulances, create bookings, track trips, manage their profile, and communicate with support.

## Access Control
User-protected endpoints require:
- JWT authentication via `protect` middleware

User role is the default role for normal app customers.

## Backend Route Scope Used by User
Primary route groups used by User:
- `/api/auth`
- `/api/ambulances`
- `/api/bookings`
- `/api/tracking`
- `/api/support`

## User Capabilities

### 1. Account & Session
- Register account
- Login using email/password
- Login using OTP flow
- Load current session profile (`/me`)
- Update profile
- Change password

### 2. Ambulance Discovery
- List ambulances with optional location and facility filters
- View ambulance details

### 3. Booking Lifecycle
- Create a booking against a selected ambulance
- View own bookings (with status filtering and pagination)
- View booking details
- Cancel own booking when status is `pending` or `confirmed`
- Rate own completed booking (1 to 5 stars, optional feedback)

### 4. Live Tracking
- Fetch latest ambulance location
- Fetch location history
- Receive live status updates/location via socket events in booking room

### 5. Help & Support
- Send support messages
- Read own support conversation history

## User API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `GET /api/auth/me` (protected)
- `PUT /api/auth/profile` (protected)
- `PUT /api/auth/change-password` (protected)

### Ambulances
- `GET /api/ambulances`
- `GET /api/ambulances/:id`

### Bookings
- `POST /api/bookings` (protected)
- `GET /api/bookings` (protected, returns current user's bookings)
- `GET /api/bookings/:id` (protected, owner or privileged role)
- `PUT /api/bookings/:id/cancel` (protected, owner only)
- `POST /api/bookings/:id/rate` (protected, owner only, completed only)

### Tracking
- `GET /api/tracking/:ambulanceId/location` (protected)
- `GET /api/tracking/:ambulanceId/history` (protected)

### Support
- `POST /api/support` (protected)
- `GET /api/support` (protected)

## Business Rules Implemented for User

### Registration Rules
- On registration, if role is not explicitly `user` or `driver`, backend defaults to `user`.
- Duplicate email or phone is rejected.

### Booking Creation Rules
- `ambulanceId` and `pickupLocation` are required.
- Selected ambulance must be available.
- System selects additional nearby matching ambulances and creates a concurrent candidate set.
- Booking starts in pending flow and waits for driver confirmation.

### Booking Cancellation Rules
- Only the booking owner can cancel.
- Only bookings in `pending` or `confirmed` can be cancelled.
- Cancelling releases reserved/candidate ambulances back to available pool.

### Rating Rules
- Only booking owner can rate.
- Booking must be `completed`.
- A booking can be rated only once.
- Rating recalculates ambulance aggregate rating.

### OTP Rules
- OTP is phone-based and expires (10-minute window in current implementation).
- Existing OTPs for that phone are cleared before issuing a new one.
- In non-production/demo mode, OTP can be returned in API response.

## Socket/Realtime Behavior Relevant to User
User receives realtime notifications such as:
- `booking_created`
- `booking_status_update`
- `ambulance_location`

User joins booking-specific room for live tracking updates.

## Frontend Navigation for User
When logged-in role is `user`, app routes to the standard user stack with:
- Main tabs: Home, Bookings, Profile
- Additional screens: Ambulance list/details, booking confirmation, live tracking, help support

## Role Boundaries (What User Cannot Do)
User cannot access admin/superadmin/driver-only capabilities, including:
- Admin routes under `/api/admin`
- Super admin routes under `/api/superadmin`
- Driver/admin-only endpoints such as:
  - `GET /api/ambulances/mine`
  - `PUT /api/bookings/:id/status`
  - `GET /api/bookings/ambulance/:ambulanceId`

## Demo Credential (Seed Data)
- Email: `user@abts.com`
- Password: `User@123`
