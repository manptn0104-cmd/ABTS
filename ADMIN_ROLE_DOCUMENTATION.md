# ABTS Admin Role Documentation

## Purpose
The Admin role is an operations role for managing day-to-day ambulance dispatch workflows.

Admin can:
- Monitor dashboard metrics and recent bookings
- Manage bookings (view, status updates, reassign rejected bookings)
- Manage users at operational level (view users and drivers, add drivers)
- Manage ambulance records (register, availability toggle, deregister)

Admin cannot:
- Access Super Admin features (organizations, subscriptions, global governance, reports module, etc.)

## Access Control
Admin APIs are protected by:
- JWT authentication middleware (`protect`)
- Role authorization middleware (`authorize('admin')`)

All Admin backend routes are mounted under:
- `/api/admin`

## Admin API Endpoints

### Dashboard
- `GET /api/admin/stats`
  - Returns dashboard counts, revenue summary, and recent bookings.

### Booking Management
- `GET /api/admin/bookings?status=<status>&page=<n>&limit=<n>`
  - Returns paginated bookings.
- `PATCH /api/admin/bookings/:id/status`
  - Updates booking status.
  - Allowed values: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `rejected`
- `PATCH /api/admin/bookings/:id/reassign`
  - Reassigns a rejected booking to an available ambulance.
  - Body: `{ "ambulanceId": "<ambulance_object_id>" }`

### User/Driver Management
- `GET /api/admin/users?role=user|driver`
  - Lists users. If no role filter is provided, both users and drivers are returned.
- Driver registration from Admin UI uses:
  - `POST /api/auth/register` with role `driver`

### Ambulance Management
- `GET /api/admin/ambulances`
  - Lists ambulances with owner details.
- `POST /api/admin/ambulances`
  - Registers a new ambulance and assigns it to a driver (`ownerId`).
- `PATCH /api/admin/ambulances/:id/availability`
  - Toggles availability (`isAvailable`).
- `DELETE /api/admin/ambulances/:id`
  - Deregisters (deletes) ambulance.

## Frontend Behavior
When a logged-in user has role `admin`, app navigation routes to the Admin stack.

Admin UI tabs:
- Overview
- Bookings
- Users
- Ambulances

Primary features available in UI:
- Reassign rejected bookings to available ambulances
- Register driver accounts
- Register new ambulances and map driver ownership
- Toggle ambulance availability and deregister ambulances

## Operational Notes
- Current Admin controllers operate globally across data; there is no organization-scoped restriction in Admin queries.
- Reassignment emits socket notifications to:
  - Assigned driver user room (`user_<driverId>`)
  - Assigned ambulance room (`ambulance_<ambulanceId>`)
  - Patient user room (`user_<patientId>`)

## Role Boundary: Admin vs Super Admin
Admin role is intentionally narrower than Super Admin.

Super Admin-only area includes (separate route group `/api/superadmin`):
- Organization lifecycle and status control
- Subscription plans and assignment
- Platform-wide user and driver governance actions
- Feedback, complaints, payments, analytics, notifications, reports

## Demo Credentials (Seed Data)
- Email: `admin@abts.com`
- Password: `Admin@123`
