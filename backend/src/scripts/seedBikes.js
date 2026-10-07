/**
 * seedBikes.js – Seeds BikeAmbulance drivers and BikeAmbulance records.
 *
 * Usage:
 *   node src/scripts/seedBikes.js
 *   node src/scripts/seedBikes.js --wipe   (removes existing bike data first)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const path     = require('path');
const bcrypt   = require('bcryptjs');

const User          = require('../models/User');
const BikeAmbulance = require('../models/BikeAmbulance');
const AppConfig     = require('../models/AppConfig');

const DATA_DIR       = path.join(__dirname, 'seedData');
const BIKE_DATA      = require(path.join(DATA_DIR, 'bikeAmbulances.json'));
const APP_CONFIG     = require(path.join(DATA_DIR, 'appConfig.json'));

const WIPE = process.argv.includes('--wipe');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/abts');
  console.log('Connected to MongoDB\n');

  if (WIPE) {
    await BikeAmbulance.deleteMany({});
    await User.deleteMany({ email: { $in: BIKE_DATA.map((b) => b.driverEmail) } });
    console.log('Wiped existing bike ambulance data\n');
  }

  console.log('── Seeding Bike Ambulance Drivers & Vehicles ──');

  for (const data of BIKE_DATA) {
    const {
      vehicleNumber, driverEmail, driverName, driverPhone,
      driverLicense, driverPassword, facilities, currentLocation, rating,
    } = data;

    // 1. Upsert driver user
    let driverUser = await User.findOne({ email: driverEmail });
    if (!driverUser) {
      driverUser = await User.create({
        name:       driverName,
        email:      driverEmail,
        phone:      driverPhone,
        password:   driverPassword,
        role:       'driver',
        isVerified: true,
        isActive:   true,
      });
      console.log(`  created  [driver]        ${driverEmail}`);
    } else {
      console.log(`  exists   [driver]        ${driverEmail}`);
    }

    // 2. Upsert bike ambulance
    let bike = await BikeAmbulance.findOne({ vehicleNumber });
    if (!bike) {
      bike = await BikeAmbulance.create({
        vehicleNumber,
        driverName,
        driverPhone,
        driverLicense,
        owner:           driverUser._id,
        facilities:      facilities || {},
        currentLocation: currentLocation || { type: 'Point', coordinates: [77.5946, 12.9716] },
        rating:          rating || { average: 0, count: 0 },
        isAvailable:     true,
        isActive:        true,
      });
      console.log(`  created  [bike-amb]      ${vehicleNumber} (driver: ${driverName})`);
    } else {
      Object.assign(bike, { driverName, driverPhone, driverLicense, facilities, rating });
      await bike.save();
      console.log(`  updated  [bike-amb]      ${vehicleNumber}`);
    }
  }

  // 3. Upsert emergencyConfig in AppConfig
  console.log('\n── Seeding Emergency Config ──');
  const emergencyConfig = APP_CONFIG.emergencyConfig;
  if (emergencyConfig) {
    await AppConfig.findOneAndUpdate(
      { key: 'emergencyConfig' },
      { value: emergencyConfig },
      { upsert: true }
    );
    console.log('  upserted [config]        emergencyConfig');
  }

  console.log('\n════════════════════════════════');
  console.log(' Bike Ambulance Seed Complete');
  console.log('════════════════════════════════');
  console.log('  BA-001  bikedriver1@abts.com  /  BikeDriver@123');
  console.log('  BA-002  bikedriver2@abts.com  /  BikeDriver@123');
  console.log('  BA-003  bikedriver3@abts.com  /  BikeDriver@123');
  console.log('════════════════════════════════\n');

  await mongoose.disconnect();
};

run().catch((err) => { console.error('Seed failed:', err.message); process.exit(1); });
