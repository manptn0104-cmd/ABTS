# ABTS Production Features — Implementation Guide

## Updated folder structure

```
ABTS-main/
├── backend/
│   ├── uploads/ambulance-docs/          # Multer document storage
│   ├── src/
│   │   ├── config/cors.js
│   │   ├── controllers/
│   │   │   ├── analyticsController.js   # NEW — MongoDB aggregations
│   │   │   ├── documentController.js    # NEW — verification docs
│   │   │   ├── superAdminController.js  # NEW — admin management
│   │   │   ├── authController.js        # driver status on login
│   │   │   └── bookingController.js     # driver status sync + location emit
│   │   ├── middleware/
│   │   │   ├── security.js              # NEW — mongo-sanitize, hpp, XSS strip
│   │   │   ├── upload.js                # NEW — multer
│   │   │   └── auth.js                  # super_admin, suspended check
│   │   ├── models/
│   │   │   ├── AuditLog.js              # NEW
│   │   │   ├── User.js                  # driverStatus, super_admin, suspend
│   │   │   └── Ambulance.js             # documents, verificationStatus
│   │   ├── routes/
│   │   │   ├── superAdmin.js            # NEW
│   │   │   └── admin.js                 # analytics + documents
│   │   ├── utils/
│   │   │   ├── socketLocation.js        # NEW — dual socket events
│   │   │   ├── driverStatus.js
│   │   │   └── audit.js
│   │   └── services/socketService.js    # driver:location:update alias
│   └── server.js
└── frontend/
    └── src/
        ├── components/common/AppInput.js     # NEW — Formik + Expo Web safe
        ├── components/admin/AnalyticsPanel.js
        ├── validation/authSchemas.js         # Yup
        ├── hooks/useDriverLocation.js        # expo-location 5s + socket
        ├── utils/driverStatus.js
        └── screens/Auth/                     # Formik Login + Register
```

---

## MongoDB schema updates

### User
| Field | Type | Notes |
|-------|------|-------|
| `role` | enum | `user`, `driver`, `admin`, **`super_admin`** |
| `driverStatus` | enum | `offline`, `online`, `busy`, `on_trip`, `inactive` |
| `isSuspended` | boolean | blocks JWT `protect` |
| `suspendedAt`, `suspendedReason` | | admin actions |

### Ambulance
| Field | Type | Notes |
|-------|------|-------|
| `verificationStatus` | enum | `pending`, `approved`, `rejected` |
| `documents.*` | url + uploadedAt | insurance, RC, license, etc. |
| `owner` | ObjectId → User | **driver assignment field** (not driverId) |

### AuditLog (new)
`actor`, `action`, `targetType`, `targetId`, `metadata`, `ip`, timestamps

---

## API endpoints added

| Method | Path | Role |
|--------|------|------|
| GET | `/api/ambulances/mine` | driver |
| PATCH | `/api/auth/driver-status` | driver |
| GET | `/api/admin/analytics` | admin, super_admin |
| POST | `/api/admin/ambulances/:id/documents` | admin (multipart) |
| PATCH | `/api/admin/ambulances/:id/verification` | admin |
| PATCH | `/api/admin/drivers/:userId/suspend` | admin |
| GET | `/api/super-admin/admins` | super_admin |
| POST | `/api/super-admin/admins` | super_admin |
| DELETE | `/api/super-admin/admins/:id` | super_admin |
| PATCH | `/api/super-admin/admins/:id/suspend` | super_admin |
| GET | `/api/super-admin/audit-logs` | super_admin |

---

## Socket.io (backward compatible)

| Event | Direction | Notes |
|-------|-----------|-------|
| `driver_location_update` | driver → server | **legacy — still works** |
| `driver:location:update` | driver → server | **new alias — same handler** |
| `ambulance_location` | server → patient | **legacy** |
| `booking:{bookingId}:location` | server → patient | **new alias** |
| `new_booking_request` | unchanged | booking flow preserved |

---

## Expo packages

```bash
cd frontend
npx expo install expo-location react-native-maps
npm install formik yup
```

```bash
cd backend
npm install express-mongo-sanitize hpp multer
```

---

## Step-by-step implementation order

1. **Backend security** — `security.js`, update `app.js`, restart server  
2. **Schema migration** — existing DB picks up new fields with defaults  
3. **Seed super admin** — `npm run seed` (optional, wipes DB)  
4. **Auth UI** — AppInput + Formik screens (done)  
5. **Driver location** — `useDriverLocation` on trip `in_progress`  
6. **Patient map** — LiveTracking listens to both location events  
7. **Admin documents** — upload via Postman/admin UI extension  
8. **Analytics tab** — Admin → Analytics  
9. **Super admin** — use `superadmin@abts.com` / `Super@123` after seed  

---

## Testing checklist

### Auth UI
- [ ] Login email/password validation shows inline errors  
- [ ] Register confirm-password mismatch blocked  
- [ ] No “Unexpected text node” warnings in Expo Web console  
- [ ] Password visibility toggle works  

### Driver location
- [ ] Grant location permission on device/web  
- [ ] Start trip → patient map marker moves  
- [ ] Network tab shows socket emits every ~5s  

### Driver status
- [ ] Login as driver → status `online`  
- [ ] Accept booking → `busy`  
- [ ] Start trip → `on_trip` + GPS active  
- [ ] Complete → `online`  
- [ ] Logout → `offline`  

### Admin documents
- [ ] POST multipart to `/api/admin/ambulances/:id/documents`  
- [ ] PATCH verification `approved` / `rejected`  
- [ ] Suspend driver returns 403 on next API call  

### Super admin
- [ ] Create/list/delete admin  
- [ ] Audit logs populated  

### Analytics
- [ ] `/api/admin/analytics` returns revenue, trends, top drivers  
- [ ] Admin Analytics tab renders  

### Booking flow (regression)
- [ ] Patient books → driver sees pending request  
- [ ] Accept → patient tracking updates  
- [ ] Socket `new_booking_request` still fires  

---

## Driver assignment reminder

Drivers **must** have an ambulance with `owner` = their `User._id`. Register via **Admin → Ambulances → Register New** or seed accounts `driver1@abts.com`.

---

## Production notes

- Set `NODE_ENV=production` and restrict CORS (`FRONTEND_URL`)  
- Store uploads on S3 in production (replace local `uploads/`)  
- Add `expo-location` permissions to `app.json` for iOS/Android  
- Web GPS requires HTTPS or localhost  
