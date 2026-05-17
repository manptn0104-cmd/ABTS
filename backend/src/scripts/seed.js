/**
 * Seed script â€” populates DB with demo users and ambulances.
 * Run: node src/scripts/seed.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Ambulance = require('../models/Ambulance');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/abts');
  console.log('âœ… Connected to MongoDB');

  await User.deleteMany({});
  await Ambulance.deleteMany({});

  const admin = await User.create({
    name: 'Admin',
    email: 'admin@abts.com',
    phone: '1000000001',
    password: 'Admin@123',
    role: 'admin',
    isVerified: true,
  });

  const driver1 = await User.create({
    name: 'Ravi Kumar',
    email: 'driver1@abts.com',
    phone: '9000000001',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver2 = await User.create({
    name: 'Priya Singh',
    email: 'driver2@abts.com',
    phone: '9000000002',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver3 = await User.create({
    name: 'Suresh Nair',
    email: 'driver3@abts.com',
    phone: '9100000001',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver4 = await User.create({
    name: 'Arjun Reddy',
    email: 'driver4@abts.com',
    phone: '9100000002',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver5 = await User.create({
    name: 'Suresh Patil',
    email: 'driver5@abts.com',
    phone: '9000000003',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver6 = await User.create({
    name: 'Kiran Rao',
    email: 'driver6@abts.com',
    phone: '9100000003',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver7 = await User.create({
    name: 'Anita Sharma',
    email: 'driver7@abts.com',
    phone: '9000000004',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver8 = await User.create({
    name: 'Deepak Menon',
    email: 'driver8@abts.com',
    phone: '9100000004',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver9 = await User.create({
    name: 'Meena Iyer',
    email: 'driver9@abts.com',
    phone: '9100000005',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver10 = await User.create({
    name: 'Padma Venkat',
    email: 'driver10@abts.com',
    phone: '9200000005',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver11 = await User.create({
    name: 'Vinod Shetty',
    email: 'driver11@abts.com',
    phone: '9100000006',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver12 = await User.create({
    name: 'Rajan Pillai',
    email: 'driver12@abts.com',
    phone: '9100000007',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  const driver13 = await User.create({
    name: 'Shankar Das',
    email: 'driver13@abts.com',
    phone: '9100000008',
    password: 'Driver@123',
    role: 'driver',
    isVerified: true,
  });

  await User.create({
    name: 'Test Patient',
    email: 'user@abts.com',
    phone: '9742316945',
    password: 'User@123',
    role: 'user',
    isVerified: true,
  });

  await Ambulance.create([
    // â”€â”€ Accident â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      vehicleNumber: 'KA01AMB001',
      driverName: 'Ravi Kumar',
      driverPhone: '9000000001',
      driverLicense: 'KA0120230001',
      type: 'advanced',
      specializations: ['accident', 'trauma', 'general'],
      facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: false, defibrillator: false, ventilator: false },
      pricePerKm: 25, basePrice: 500, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.596, 12.97], address: 'Indiranagar, Bangalore' },
      rating: { average: 4.6, count: 28 },
      owner: driver1._id,
    },
    {
      vehicleNumber: 'KA02AMB001',
      driverName: 'Suresh Nair',
      driverPhone: '9100000001',
      driverLicense: 'KA0220230001',
      type: 'basic',
      specializations: ['accident', 'general'],
      facilities: { oxygen: true, saline: true, stretcher: true, nurse: false, doctor: false, defibrillator: false, ventilator: false },
      pricePerKm: 15, basePrice: 300, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.580, 12.960], address: 'Koramangala, Bangalore' },
      rating: { average: 4.1, count: 12 },
      owner: driver3._id,
    },

    // â”€â”€ Cardiac â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      vehicleNumber: 'KA03AMB002',
      driverName: 'Priya Singh',
      driverPhone: '9000000002',
      driverLicense: 'KA0320230002',
      type: 'icu',
      specializations: ['cardiac', 'respiratory', 'general'],
      facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: true, defibrillator: true, ventilator: true },
      pricePerKm: 55, basePrice: 1200, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.696, 12.95], address: 'Whitefield, Bangalore' },
      rating: { average: 4.9, count: 42 },
      owner: driver2._id,
    },
    {
      vehicleNumber: 'KA04AMB002',
      driverName: 'Arjun Reddy',
      driverPhone: '9100000002',
      driverLicense: 'KA0420230002',
      type: 'advanced',
      specializations: ['cardiac', 'accident'],
      facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: false, defibrillator: true, ventilator: false },
      pricePerKm: 35, basePrice: 700, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.640, 12.980], address: 'HAL, Bangalore' },
      rating: { average: 4.5, count: 19 },
      owner: driver4._id,
    },

    // â”€â”€ Respiratory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      vehicleNumber: 'KA05AMB003',
      driverName: 'Suresh Patil',
      driverPhone: '9000000003',
      driverLicense: 'KA0520230003',
      type: 'basic',
      specializations: ['respiratory', 'general'],
      facilities: { oxygen: true, saline: false, stretcher: true, nurse: false, doctor: false, defibrillator: false, ventilator: false },
      pricePerKm: 15, basePrice: 300, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.5946, 12.9716], address: 'MG Road, Bangalore' },
      rating: { average: 4.2, count: 15 },
      owner: driver5._id,
    },
    {
      vehicleNumber: 'KA06AMB003',
      driverName: 'Kiran Rao',
      driverPhone: '9100000003',
      driverLicense: 'KA0620230003',
      type: 'icu',
      specializations: ['respiratory', 'cardiac'],
      facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: true, defibrillator: false, ventilator: true },
      pricePerKm: 50, basePrice: 1100, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.622, 12.935], address: 'HSR Layout, Bangalore' },
      rating: { average: 4.7, count: 33 },
      owner: driver6._id,
    },

    // â”€â”€ Trauma â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      vehicleNumber: 'KA07AMB004',
      driverName: 'Anita Sharma',
      driverPhone: '9000000004',
      driverLicense: 'KA0720230004',
      type: 'advanced',
      specializations: ['trauma', 'accident'],
      facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: false, defibrillator: false, ventilator: false },
      pricePerKm: 30, basePrice: 600, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.5619, 12.9279], address: 'Jayanagar, Bangalore' },
      rating: { average: 4.7, count: 19 },
      owner: driver7._id,
    },
    {
      vehicleNumber: 'KA08AMB004',
      driverName: 'Deepak Menon',
      driverPhone: '9100000004',
      driverLicense: 'KA0820230004',
      type: 'icu',
      specializations: ['trauma', 'accident', 'general'],
      facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: true, defibrillator: true, ventilator: false },
      pricePerKm: 45, basePrice: 950, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.548, 12.915], address: 'Banashankari, Bangalore' },
      rating: { average: 4.4, count: 24 },
      owner: driver8._id,
    },

    // â”€â”€ Maternity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      vehicleNumber: 'KA09AMB005',
      driverName: 'Meena Iyer',
      driverPhone: '9100000005',
      driverLicense: 'KA0920230005',
      type: 'neonatal',
      specializations: ['maternity', 'general'],
      facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: true, defibrillator: false, ventilator: false },
      pricePerKm: 40, basePrice: 800, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.607, 13.003], address: 'Hebbal, Bangalore' },
      rating: { average: 4.8, count: 31 },
      owner: driver9._id,
    },
    {
      vehicleNumber: 'KA10AMB005',
      driverName: 'Padma Venkat',
      driverPhone: '9200000005',
      driverLicense: 'KA1020230005',
      type: 'neonatal',
      specializations: ['maternity'],
      facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: false, defibrillator: false, ventilator: false },
      pricePerKm: 35, basePrice: 750, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.635, 12.913], address: 'BTM Layout, Bangalore' },
      rating: { average: 4.6, count: 17 },
      owner: driver10._id,
    },

    // â”€â”€ General â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      vehicleNumber: 'KA11AMB006',
      driverName: 'Vinod Shetty',
      driverPhone: '9100000006',
      driverLicense: 'KA1120230006',
      type: 'basic',
      specializations: ['general', 'other'],
      facilities: { oxygen: false, saline: true, stretcher: true, nurse: false, doctor: false, defibrillator: false, ventilator: false },
      pricePerKm: 12, basePrice: 250, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.572, 12.989], address: 'Rajajinagar, Bangalore' },
      rating: { average: 4.0, count: 8 },
      owner: driver11._id,
    },

    // â”€â”€ Other â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
      vehicleNumber: 'KA12AMB007',
      driverName: 'Rajan Pillai',
      driverPhone: '9100000007',
      driverLicense: 'KA1220230007',
      type: 'basic',
      specializations: ['other', 'general'],
      facilities: { oxygen: false, saline: true, stretcher: true, nurse: false, doctor: false, defibrillator: false, ventilator: false },
      pricePerKm: 10, basePrice: 200, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.553, 12.942], address: 'Vijayanagar, Bangalore' },
      rating: { average: 3.9, count: 6 },
      owner: driver12._id,
    },
    {
      vehicleNumber: 'KA13AMB008',
      driverName: 'Shankar Das',
      driverPhone: '9100000008',
      driverLicense: 'KA1320230008',
      type: 'advanced',
      specializations: ['accident', 'cardiac', 'respiratory', 'trauma', 'maternity', 'general', 'other'],
      facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: true, defibrillator: true, ventilator: true },
      pricePerKm: 60, basePrice: 1500, isAvailable: true,
      currentLocation: { type: 'Point', coordinates: [77.590, 12.965], address: 'Central Bangalore' },
      rating: { average: 5.0, count: 52 },
      owner: driver13._id,
    },
  ]);
  console.log('\nSeed complete! 13 ambulances + 15 users added.');
  console.log('Admin:   admin@abts.com | Admin@123');
  console.log('Patient: user@abts.com  | User@123');
  console.log('Drivers (all use password: Driver@123):');
  console.log('  driver1@abts.com  -> KA01 (Ravi Kumar)');
  console.log('  driver2@abts.com  -> KA03 (Priya Singh)');
  console.log('  driver3@abts.com  -> KA02 (Suresh Nair)');
  console.log('  driver4@abts.com  -> KA04 (Arjun Reddy)');
  console.log('  driver5@abts.com  -> KA05 (Suresh Patil)');
  console.log('  driver6@abts.com  -> KA06 (Kiran Rao)');
  console.log('  driver7@abts.com  -> KA07 (Anita Sharma)');
  console.log('  driver8@abts.com  -> KA08 (Deepak Menon)');
  console.log('  driver9@abts.com  -> KA09 (Meena Iyer)');
  console.log('  driver10@abts.com -> KA10 (Padma Venkat)');
  console.log('  driver11@abts.com -> KA11 (Vinod Shetty)');
  console.log('  driver12@abts.com -> KA12 (Rajan Pillai)');
  console.log('  driver13@abts.com -> KA13 (Shankar Das)\n');

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
})
