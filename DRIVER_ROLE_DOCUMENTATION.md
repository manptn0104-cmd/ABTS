# ABTS Driver Role Documentation

## Purpose
The Driver role represents ambulance operators who receive booking requests, accept/reject trips, navigate to pickup, and complete rides.

## Access Control
Driver-protected endpoints require:
- JWT authentication via `protect` middleware

Driver-only or driver-enabled endpoints additionally use role checks such as:
- `authorize('driver', 'admin')`

## Backend Route Scope Used by Driver
Primary route groups used by Driver:
- `/api/auth`
- `/api/ambulances`
- `/api/bookings`
- `/api/tracking`

## Driver Capabilities

### 1. Account & Session
- Login using email/password
- Load current session profile (`/me`)
- Update profile
- Change password

Note:
- Registration endpoint accepts `role=driver` in current implementation, so driver accounts can be created through the public register API as well.

### 2. Ambulance Ownership & Availability
- View assigned ambulance (`/api/ambulances/mine`)
- Register ambulance (driver/admin endpoint)
- Update owned ambulance details
- Toggle own ambulance availability
- Update ambulance location

### 3. Booking Operations
- Receive booking requests (socket events)
- View bookings for an ambulance
- Accept booking (`pending` -> `confirmed`)
- Reject booking (`pending` -> `rejected`)
- Start trip (`confirmed` -> `in_progress`)
- Complete trip (`in_progress` -> `completed`)

### 4. Navigation & Tracking
- Open turn-by-turn navigation to pickup (maps deep links from DriverMap screen)
- Consume live booking status and location events

## Driver API Endpoints

### Auth
- `POST /api/auth/login`
- `GET /api/auth/me` (protected)
- `PUT /api/auth/profile` (protected)
- `PUT /api/auth/change-password` (protected)

### Ambulances
- `GET /api/ambulances/mine` (protected, driver/admin)
- `POST /api/ambulances` (protected, driver/admin)
- `PUT /api/ambulances/:id` (protected, driver/admin)
- `PUT /api/ambulances/:id/availability` (protected, driver/admin)
- `PUT /api/ambulances/:id/location` (protected)

### Bookings
- `GET /api/bookings/ambulance/:ambulanceId` (protected, driver/admin)
- `PUT /api/bookings/:id/status` (protected, driver/admin)
- `GET /api/bookings/:id` (protected, owner or privileged)

## Booking Status Transition Rules (Driver Flow)
From current implementation:
- `pending` -> `confirmed` or `rejected`
- `confirmed` -> `in_progress` or `cancelled`
- `in_progress` -> `completed` or `cancelled`

Driver-facing actions in UI:
- Accept
- Reject
- Start Trip
- Complete Trip

## Realtime Behavior for Driver
Driver dashboard connects socket and:
- Joins ambulance room: `ambulance_<ambulanceId>`
- Listens for:
  - `new_booking_request`
  - `booking_status_update`

When a booking is assigned/reassigned, backend emits to:
- `ambulance_<ambulanceId>`
- `user_<driverUserId>`

## Frontend Navigation for Driver
When logged-in role is `driver`, app routes to Driver stack:
- Tabs:
  - Dashboard
  - Profile
- Extra screen:
  - DriverMap (pickup navigation view)

## Role Boundaries (What Driver Cannot Do)
Driver cannot access:
- Admin route group: `/api/admin`
- Super Admin route group: `/api/superadmin`

Driver also cannot:
- View platform analytics/admin stats
- Manage organizations/subscriptions
- Perform super-admin governance tasks

## Operational Notes
- Driver dashboard relies on an assigned ambulance. If `/api/ambulances/mine` returns 404, booking handling UI will not function correctly.
- Booking fetch endpoint `/api/bookings/ambulance/:ambulanceId` is role-guarded but does not additionally verify ambulance ownership in controller logic; this is an implementation caveat.
- `PUT /api/ambulances/:id/location` is protected but not role-restricted in routes; any authenticated role can call it in current code.

## Demo Credentials (Seed Data)
- Email: `driver1@abts.com`
- Password: `Driver@123`
