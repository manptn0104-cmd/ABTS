/**
 * Seed script — populates DB with demo users and ambulances.
 * Run: node src/scripts/seed.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User      = require('../models/User');
const Ambulance = require('../models/Ambulance');

// ── Driver data ───────────────────────────────────────────────────────────────
const DRIVER_DATA = [
  { name: 'Ravi Kumar',    email: 'driver1@abts.com',  phone: '9000000001' },
  { name: 'Priya Singh',   email: 'driver2@abts.com',  phone: '9000000002' },
  { name: 'Suresh Nair',   email: 'driver3@abts.com',  phone: '9100000001' },
  { name: 'Arjun Reddy',   email: 'driver4@abts.com',  phone: '9100000002' },
  { name: 'Suresh Patil',  email: 'driver5@abts.com',  phone: '9000000003' },
  { name: 'Kiran Rao',     email: 'driver6@abts.com',  phone: '9100000003' },
  { name: 'Anita Sharma',  email: 'driver7@abts.com',  phone: '9000000004' },
  { name: 'Deepak Menon',  email: 'driver8@abts.com',  phone: '9100000004' },
  { name: 'Meena Iyer',    email: 'driver9@abts.com',  phone: '9100000005' },
  { name: 'Padma Venkat',  email: 'driver10@abts.com', phone: '9200000005' },
  { name: 'Vinod Shetty',  email: 'driver11@abts.com', phone: '9100000006' },
  { name: 'Rajan Pillai',  email: 'driver12@abts.com', phone: '9100000007' },
  { name: 'Shankar Das',   email: 'driver13@abts.com', phone: '9100000008' },
];

// ── Ambulance data (uses driver index 0-12) ───────────────────────────────────
const AMBULANCE_DATA = [
  // ── Accident ──────────────────────────────────────────────────────────────
  {
    vehicleNumber: 'KA01AMB001', driverIdx: 0,
    driverPhone: '9000000001', driverLicense: 'KA0120230001',
    type: 'advanced', specializations: ['accident', 'trauma', 'general'],
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: false, defibrillator: false, ventilator: false, cctvCamera: true },
    pricePerKm: 25, basePrice: 500, rating: { average: 4.6, count: 28 },
    location: [77.596, 12.97], address: 'Indiranagar, Bangalore',
  },
  {
    vehicleNumber: 'KA02AMB001', driverIdx: 2,
    driverPhone: '9100000001', driverLicense: 'KA0220230001',
    type: 'basic', specializations: ['accident', 'general'],
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: false, doctor: false, defibrillator: false, ventilator: false, cctvCamera: false },
    pricePerKm: 15, basePrice: 300, rating: { average: 4.1, count: 12 },
    location: [77.580, 12.960], address: 'Koramangala, Bangalore',
  },

  // ── Cardiac ───────────────────────────────────────────────────────────────
  {
    vehicleNumber: 'KA03AMB002', driverIdx: 1,
    driverPhone: '9000000002', driverLicense: 'KA0320230002',
    type: 'icu', specializations: ['cardiac', 'respiratory', 'general'],
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: true, defibrillator: true, ventilator: true, cctvCamera: true },
    pricePerKm: 55, basePrice: 1200, rating: { average: 4.9, count: 42 },
    location: [77.696, 12.95], address: 'Whitefield, Bangalore',
  },
  {
    vehicleNumber: 'KA04AMB002', driverIdx: 3,
    driverPhone: '9100000002', driverLicense: 'KA0420230002',
    type: 'advanced', specializations: ['cardiac', 'accident'],
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: false, defibrillator: true, ventilator: false, cctvCamera: true },
    pricePerKm: 35, basePrice: 700, rating: { average: 4.5, count: 19 },
    location: [77.640, 12.980], address: 'HAL, Bangalore',
  },

  // ── Respiratory ───────────────────────────────────────────────────────────
  {
    vehicleNumber: 'KA05AMB003', driverIdx: 4,
    driverPhone: '9000000003', driverLicense: 'KA0520230003',
    type: 'basic', specializations: ['respiratory', 'general'],
    facilities: { oxygen: true, saline: false, stretcher: true, nurse: false, doctor: false, defibrillator: false, ventilator: false, cctvCamera: false },
    pricePerKm: 15, basePrice: 300, rating: { average: 4.2, count: 15 },
    location: [77.5946, 12.9716], address: 'MG Road, Bangalore',
  },
  {
    vehicleNumber: 'KA06AMB003', driverIdx: 5,
    driverPhone: '9100000003', driverLicense: 'KA0620230003',
    type: 'icu', specializations: ['respiratory', 'cardiac'],
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: true, defibrillator: false, ventilator: true, cctvCamera: true },
    pricePerKm: 50, basePrice: 1100, rating: { average: 4.7, count: 33 },
    location: [77.622, 12.935], address: 'HSR Layout, Bangalore',
  },

  // ── Trauma ────────────────────────────────────────────────────────────────
  {
    vehicleNumber: 'KA07AMB004', driverIdx: 6,
    driverPhone: '9000000004', driverLicense: 'KA0720230004',
    type: 'advanced', specializations: ['trauma', 'accident'],
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: false, defibrillator: false, ventilator: false, cctvCamera: true },
    pricePerKm: 30, basePrice: 600, rating: { average: 4.7, count: 19 },
    location: [77.5619, 12.9279], address: 'Jayanagar, Bangalore',
  },
  {
    vehicleNumber: 'KA08AMB004', driverIdx: 7,
    driverPhone: '9100000004', driverLicense: 'KA0820230004',
    type: 'icu', specializations: ['trauma', 'accident', 'general'],
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: true, defibrillator: true, ventilator: false, cctvCamera: false },
    pricePerKm: 45, basePrice: 950, rating: { average: 4.4, count: 24 },
    location: [77.548, 12.915], address: 'Banashankari, Bangalore',
  },

  // ── Maternity ─────────────────────────────────────────────────────────────
  {
    vehicleNumber: 'KA09AMB005', driverIdx: 8,
    driverPhone: '9100000005', driverLicense: 'KA0920230005',
    type: 'neonatal', specializations: ['maternity', 'general'],
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: true, defibrillator: false, ventilator: false, cctvCamera: true },
    pricePerKm: 40, basePrice: 800, rating: { average: 4.8, count: 31 },
    location: [77.607, 13.003], address: 'Hebbal, Bangalore',
  },
  {
    vehicleNumber: 'KA10AMB005', driverIdx: 9,
    driverPhone: '9200000005', driverLicense: 'KA1020230005',
    type: 'neonatal', specializations: ['maternity'],
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: false, defibrillator: false, ventilator: false, cctvCamera: false },
    pricePerKm: 35, basePrice: 750, rating: { average: 4.6, count: 17 },
    location: [77.635, 12.913], address: 'BTM Layout, Bangalore',
  },

  // ── General ───────────────────────────────────────────────────────────────
  {
    vehicleNumber: 'KA11AMB006', driverIdx: 10,
    driverPhone: '9100000006', driverLicense: 'KA1120230006',
    type: 'basic', specializations: ['general', 'other'],
    facilities: { oxygen: false, saline: true, stretcher: true, nurse: false, doctor: false, defibrillator: false, ventilator: false, cctvCamera: false },
    pricePerKm: 12, basePrice: 250, rating: { average: 4.0, count: 8 },
    location: [77.572, 12.989], address: 'Rajajinagar, Bangalore',
  },

  // ── Other ─────────────────────────────────────────────────────────────────
  {
    vehicleNumber: 'KA12AMB007', driverIdx: 11,
    driverPhone: '9100000007', driverLicense: 'KA1220230007',
    type: 'basic', specializations: ['other', 'general'],
    facilities: { oxygen: false, saline: true, stretcher: true, nurse: false, doctor: false, defibrillator: false, ventilator: false, cctvCamera: false },
    pricePerKm: 10, basePrice: 200, rating: { average: 3.9, count: 6 },
    location: [77.553, 12.942], address: 'Vijayanagar, Bangalore',
  },
  {
    vehicleNumber: 'KA13AMB008', driverIdx: 12,
    driverPhone: '9100000008', driverLicense: 'KA1320230008',
    type: 'advanced', specializations: ['accident', 'cardiac', 'respiratory', 'trauma', 'maternity', 'general', 'other'],
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: true, defibrillator: true, ventilator: true, cctvCamera: true },
    pricePerKm: 60, basePrice: 1500, rating: { average: 5.0, count: 52 },
    location: [77.590, 12.965], address: 'Central Bangalore',
  },
];

// ── Seed ──────────────────────────────────────────────────────────────────────
const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/abts');
  console.log('✅ Connected to MongoDB');

  await User.deleteMany({});
  await Ambulance.deleteMany({});

  // Create admin
  await User.create({
    name: 'Admin', email: 'admin@abts.com', phone: '1000000001',
    password: 'Admin@123', role: 'admin', isVerified: true,
  });

  // Create all drivers from data array
  const drivers = await Promise.all(
    DRIVER_DATA.map((d) =>
      User.create({ ...d, password: 'Driver@123', role: 'driver', isVerified: true })
    )
  );

  // Create test patient
  await User.create({
    name: 'Test Patient', email: 'user@abts.com', phone: '9742316945',
    password: 'User@123', role: 'user', isVerified: true,
  });

  // Create all ambulances using driver._id by index
  await Ambulance.create(
    AMBULANCE_DATA.map(({ driverIdx, location, address, ...amb }) => ({
      ...amb,
      driverName: DRIVER_DATA[driverIdx].name,
      isAvailable: true,
      owner: drivers[driverIdx]._id,
      currentLocation: { type: 'Point', coordinates: location, address },
    }))
  );

  console.log('\nSeed complete! 13 ambulances + 15 users added.');
  console.log('Admin:   admin@abts.com | Admin@123');
  console.log('Patient: user@abts.com  | User@123');
  console.log('Drivers (all use password: Driver@123):');
  DRIVER_DATA.forEach((d, i) => {
    const amb = AMBULANCE_DATA.find((a) => a.driverIdx === i);
    console.log(`  ${d.email.padEnd(22)} -> ${amb?.vehicleNumber || 'N/A'} (${d.name})`);
  });
  console.log('');

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
