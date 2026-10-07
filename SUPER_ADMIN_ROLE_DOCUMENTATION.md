# ABTS Super Admin Role Documentation

## Purpose
The Super Admin role is the highest-privilege platform governance role. It is responsible for tenant-level control, subscription governance, compliance/quality modules, and cross-platform analytics.

## Access Control
Super Admin APIs are protected by:
- JWT authentication via `protect` middleware
- Role authorization via `authorize('superadmin')`

All Super Admin backend routes are mounted under:
- `/api/superadmin`

## Backend Route Scope Used by Super Admin
Primary route groups used by Super Admin:
- `/api/superadmin`
- `/api/auth` (login, profile, password)

## Super Admin Capabilities

### 1. Platform Dashboard
- View aggregated platform statistics across organizations, ambulances, users, drivers, bookings, and revenue.
- Includes operational KPIs such as availability, online/offline states, pending verification, cancellations, and subscription revenue.

### 2. Organization Management
- List organizations with filtering/search/pagination
- Create organization
- Update organization
- Update organization status (`active`, `suspended`, `expired`, `pending`)
- Delete organization

### 3. Subscription & Billing Governance
- List subscription plans
- Create/update/delete subscription plans
- Assign subscriptions to organizations
- Generate payment record during subscription assignment
- List payments with summary aggregation by payment type/status

### 4. Ambulance Governance
- List ambulances platform-wide with filters
- Update operational status (`active`, `offline`, `maintenance`)

### 5. User and Driver Governance
- List users with search/status filters
- User status actions (`block`, `unblock`, `activate`, `deactivate`)
- View user booking history
- List drivers with search/status filters and attached ambulance info
- Driver status actions (`verify`, `suspend`, `activate`)

### 6. Feedback & Complaint Operations
- List feedback with filters
- Get feedback analytics summary
- Update feedback status
- List complaints with filters
- Execute complaint workflow actions (`assign`, `escalate`, `resolve`, `close`, `reopen`, `start`)

### 7. Notifications
- Send platform notifications by recipient type:
  - `all`
  - `all_users`
  - `drivers`
  - `org_admins`
  - `selected_orgs`

### 8. Reports & Analytics
- Generate organization-level operational reports with filters:
  - org, city, state
  - date range
  - ambulance type
- Output includes bookings, completion/cancellation, revenue, response-time proxy, and fleet utilization.

## Super Admin API Endpoints

### Dashboard
- `GET /api/superadmin/stats`

### Organizations
- `GET /api/superadmin/organizations`
- `POST /api/superadmin/organizations`
- `PUT /api/superadmin/organizations/:id`
- `PATCH /api/superadmin/organizations/:id/status`
- `DELETE /api/superadmin/organizations/:id`

### Subscriptions
- `GET /api/superadmin/subscriptions`
- `POST /api/superadmin/subscriptions`
- `PUT /api/superadmin/subscriptions/:id`
- `DELETE /api/superadmin/subscriptions/:id`
- `POST /api/superadmin/subscriptions/assign`

### Ambulances
- `GET /api/superadmin/ambulances`
- `PATCH /api/superadmin/ambulances/:id/status`

### Users
- `GET /api/superadmin/users`
- `PATCH /api/superadmin/users/:id/status`
- `GET /api/superadmin/users/:id/bookings`

### Drivers
- `GET /api/superadmin/drivers`
- `PATCH /api/superadmin/drivers/:id/status`

### Feedback
- `GET /api/superadmin/feedback`
- `GET /api/superadmin/feedback/analytics`
- `PATCH /api/superadmin/feedback/:id/status`

### Complaints
- `GET /api/superadmin/complaints`
- `PATCH /api/superadmin/complaints/:id/action`

### Payments
- `GET /api/superadmin/payments`

### Notifications
- `POST /api/superadmin/notifications/send`

### Reports
- `GET /api/superadmin/reports`

## Frontend Navigation for Super Admin
When logged-in role is `superadmin`, app routes to the dedicated Super Admin navigator.

Bottom tabs:
- Dashboard
- Organizations
- Users
- More

More stack screens include:
- Ambulance Management
- Feedback & Ratings
- Complaint Management
- Subscriptions & Billing
- Send Notification
- Analytics & Reports

## Role Boundaries (What Super Admin Is Separate From)
Super Admin does not use Admin route group (`/api/admin`) for governance tasks. Super Admin has a separate route group and workflow model designed for platform-wide management.

## Operational Notes
- Super Admin endpoints are globally scoped and are not restricted to a single organization.
- Notification API currently reports recipient count and logs dispatch intent; real push/email/SMS queueing is represented as future/placeholder behavior.
- Reports derive metrics from organizations and related ambulances/bookings using server-side aggregation.

## Demo Credential (Seed Data)
- Email: `superadmin@abts.com`
- Password: `SuperAdmin@123`
