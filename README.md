# 🚑 ABTS — Ambulance Booking & Tracking System

A full-stack, real-time ambulance booking and tracking application built with **React Native** (frontend) and **Node.js + MongoDB** (backend).

---

## 🧩 Tech Stack

| Layer        | Technology |
|-------------|------------|
| Frontend     | React Native (Expo) + React Native Web |
| Backend      | Node.js + Express.js |
| Database     | MongoDB + Mongoose |
| Real-time    | Socket.IO |
| Auth         | JWT (JSON Web Tokens) |
| State Mgmt   | Redux Toolkit |
| Maps         | Google Maps / react-native-maps |

---

## 📁 Project Structure

```
ABTS/
├── backend/                     # Node.js + Express API
│   ├── src/
│   │   ├── config/database.js   # MongoDB connection
│   │   ├── controllers/         # Route handlers
│   │   │   ├── authController.js
│   │   │   ├── ambulanceController.js
│   │   │   ├── bookingController.js
│   │   │   └── trackingController.js
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT middleware
│   │   │   └── errorHandler.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Ambulance.js
│   │   │   ├── Booking.js
│   │   │   └── Location.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── ambulances.js
│   │   │   ├── bookings.js
│   │   │   └── tracking.js
│   │   ├── services/
│   │   │   └── socketService.js  # Socket.IO real-time
│   │   └── scripts/seed.js       # Demo data seeder
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
└── frontend/                    # React Native (Expo)
    ├── src/
    │   ├── api/                 # Axios API calls
    │   ├── components/          # Reusable UI components
    │   ├── hooks/               # useLocation, useSocket
    │   ├── navigation/          # React Navigation setup
    │   ├── screens/             # All app screens
    │   │   ├── Auth/            # Login, Register
    │   │   ├── Home/            # Map + search
    │   │   ├── AmbulanceList/   # Browse + filter
    │   │   ├── AmbulanceDetails/# Details + booking
    │   │   ├── Booking/         # Confirmation, My Bookings
    │   │   ├── Tracking/        # Live GPS tracking
    │   │   └── Profile/         # User profile
    │   ├── store/               # Redux slices
    │   ├── theme/               # Colors, typography, spacing
    │   └── utils/               # Constants, helpers
    ├── App.js
    ├── app.json
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- MongoDB (local or Atlas)
- Expo CLI: `npm install -g expo-cli`
- A Google Maps API key (for maps & places)

---

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm run dev
```

**Seed demo data:**
```bash
npm run seed
```

Demo accounts created:
| Email               | Password   | Role   |
|---------------------|------------|--------|
| admin@abts.com      | Admin@123  | Admin  |
| driver1@abts.com    | Driver@123 | Driver |
| user@abts.com       | User@123   | User   |

---

### 2. Frontend Setup

```bash
cd frontend
npm install

# Start Expo
npm start        # Interactive menu
npm run web      # Open in browser
npm run android  # Run on Android
npm run ios      # Run on iOS
```

---

## 🔌 REST API Reference

### Auth
| Method | Endpoint                | Description          |
|--------|-------------------------|----------------------|
| POST   | /api/auth/register      | Register new user    |
| POST   | /api/auth/login         | Login                |
| GET    | /api/auth/me            | Get current user     |
| PUT    | /api/auth/profile       | Update profile       |
| PUT    | /api/auth/change-password | Change password    |

### Ambulances
| Method | Endpoint                       | Description              |
|--------|--------------------------------|--------------------------|
| GET    | /api/ambulances?lat=&lng=      | List with geo-distance   |
| GET    | /api/ambulances/:id            | Get single ambulance     |
| POST   | /api/ambulances                | Register ambulance       |
| PUT    | /api/ambulances/:id/location   | Update GPS location      |
| PUT    | /api/ambulances/:id/availability| Toggle availability     |

### Bookings
| Method | Endpoint                    | Description          |
|--------|-----------------------------|----------------------|
| POST   | /api/bookings               | Create booking       |
| GET    | /api/bookings               | My bookings          |
| GET    | /api/bookings/:id           | Single booking       |
| PUT    | /api/bookings/:id/status    | Accept/Reject        |
| PUT    | /api/bookings/:id/cancel    | Cancel booking       |
| POST   | /api/bookings/:id/rate      | Rate completed trip  |

### Tracking
| Method | Endpoint                          | Description           |
|--------|-----------------------------------|-----------------------|
| GET    | /api/tracking/:id/location        | Latest location       |
| POST   | /api/tracking/:id/location        | Save location log     |
| GET    | /api/tracking/:id/history         | Location history      |

---

## ⚡ Socket.IO Events

### Client → Server
| Event                  | Payload                              |
|------------------------|--------------------------------------|
| `join_ambulance_room`  | `ambulanceId`                        |
| `join_booking_room`    | `bookingId`                          |
| `driver_location_update` | `{ ambulanceId, bookingId, lat, lng, speed, heading }` |
| `watch_ambulance`      | `ambulanceId`                        |

### Server → Client
| Event                  | Description                          |
|------------------------|--------------------------------------|
| `new_booking_request`  | Sent to driver when user books       |
| `booking_created`      | Sent to user on successful booking   |
| `booking_status_update`| Status changes (confirmed/rejected)  |
| `ambulance_location`   | Real-time GPS coordinates            |
| `booking_cancelled`    | Sent to driver on user cancellation  |

---

## 🎯 Features

### User (Patient)
- ✅ Register & login with JWT
- ✅ GPS location auto-detection
- ✅ Browse nearby ambulances with distance & ETA
- ✅ Filter by facilities (Oxygen, Nurse, Doctor, etc.)
- ✅ Filter by type, price, availability
- ✅ View detailed ambulance & driver info
- ✅ Book with patient details & emergency type
- ✅ Real-time booking status notifications
- ✅ Live GPS tracking of ambulance
- ✅ Cancel booking
- ✅ View booking history
- ✅ Rate completed trips

### Driver / Provider
- ✅ Receive new booking requests via Socket.IO
- ✅ Accept or reject booking
- ✅ Broadcast real-time location during trip
- ✅ Mark trip as in-progress / completed

### System
- ✅ Geospatial queries (MongoDB 2dsphere)
- ✅ JWT authentication
- ✅ Rate limiting & security headers
- ✅ Auto-expiry of location logs (24h TTL)
- ✅ Cross-platform: Mobile + Desktop Web

---

## 🔐 Environment Variables

### Backend `.env`
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/abts
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:8081
GOOGLE_MAPS_API_KEY=your_key
NODE_ENV=development
```

---

## 📱 Screens

| Screen               | Description                              |
|---------------------|------------------------------------------|
| Login / Register    | JWT-based auth with role selection       |
| Home                | Map + nearby ambulances + Quick Book     |
| Ambulance List      | Filterable list with sort options        |
| Ambulance Details   | Full info + facilities + pricing         |
| Booking Confirmation| Emergency type, patient details, fare    |
| Live Tracking       | Real-time map with driver location       |
| My Bookings         | Full history with status badges          |
| Profile             | Edit profile + settings + logout         |

---

## 🏗️ Architecture

```
Client (RN App)
     │
     ├── REST API  ──►  Express Router  ──►  Controller  ──►  MongoDB
     │
     └── Socket.IO ──►  socketService   ──►  Rooms (user_*, ambulance_*, booking_*)
```
