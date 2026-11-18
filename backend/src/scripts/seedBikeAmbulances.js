/**
 * Adds bike-ambulance riders and vehicles without touching existing data.
 * Run: node src/scripts/seedBikeAmbulances.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Ambulance = require('../models/Ambulance');
const Organization = require('../models/Organization');

const riders = [
  {
    email: 'rider1@abts.com',
    name: 'Manoj Gowda',
    phone: '9200000001',
    vehicleNumber: 'KA05BIKE01',
    driverLicense: 'KA0520230101',
    location: { coordinates: [77.6101, 12.9352], address: 'HSR Layout, Bangalore' },
  },
  {
    email: 'rider2@abts.com',
    name: 'Faisal Khan',
    phone: '9200000002',
    vehicleNumber: 'KA05BIKE02',
    driverLicense: 'KA0520230102',
    location: { coordinates: [77.5667, 12.9850], address: 'Malleshwaram, Bangalore' },
  },
  {
    email: 'rider3@abts.com',
    name: 'Divya Shetty',
    phone: '9200000003',
    vehicleNumber: 'KA05BIKE03',
    driverLicense: 'KA0520230103',
    location: { coordinates: [77.6410, 12.9352], address: 'Marathahalli, Bangalore' },
  },
];

const seedBikeAmbulances = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/abts');
  console.log('✅ Connected to MongoDB');

  const organization = await Organization.findOne({ organizationCode: 'ABTSDEMO' }) || await Organization.findOne();
  if (!organization) {
    throw new Error('No organization found — run the main seed script first.');
  }

  for (const r of riders) {
    let rider = await User.findOne({ email: r.email });
    if (!rider) {
      rider = await User.create({
        name: r.name,
        email: r.email,
        phone: r.phone,
        password: 'Rider@123',
        role: 'driver',
        organizationId: organization._id,
        isVerified: true,
      });
      console.log(`✅ Rider created: ${r.email}`);
    } else {
      console.log(`↷ Rider already exists: ${r.email}`);
    }

    const existingAmbulance = await Ambulance.findOne({ vehicleNumber: r.vehicleNumber });
    if (existingAmbulance) {
      console.log(`↷ Bike ambulance already exists: ${r.vehicleNumber}`);
      continue;
    }

    await Ambulance.create({
      vehicleNumber: r.vehicleNumber,
      driverName: r.name,
      driverPhone: r.phone,
      driverLicense: r.driverLicense,
      type: 'bike',
      specializations: ['accident', 'cardiac', 'trauma', 'general'],
      facilities: {
        oxygen: true, saline: false, stretcher: false, nurse: false,
        doctor: false, defibrillator: true, ventilator: false, cctvCamera: false,
      },
      pricePerKm: 8, basePrice: 100, isAvailable: true,
      currentLocation: { type: 'Point', ...r.location },
      baseLocation: { type: 'Point', ...r.location },
      rating: { average: 4.3, count: 5 },
      owner: rider._id,
      organizationId: organization._id,
    });
    console.log(`✅ Bike ambulance created: ${r.vehicleNumber}`);
  }

  console.log('\nBike ambulance seed complete.');
  console.log('Riders (all use password: Rider@123): rider1@abts.com, rider2@abts.com, rider3@abts.com');

  await mongoose.disconnect();
};

seedBikeAmbulances().catch((err) => {
  console.error(err);
  process.exit(1);
});
