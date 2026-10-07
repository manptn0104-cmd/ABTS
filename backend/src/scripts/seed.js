/**
 * seed.js - Full database seed: Subscriptions, Organizations, Users, Ambulances, AppConfig.
 *
 * Usage:
 *   node src/scripts/seed.js          - upsert all seed data, keep unrelated records
 *   node src/scripts/seed.js --wipe   - wipe all collections first, then seed
 *
 * All seed data is stored in src/scripts/seedData/*.json
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const path     = require('path');

const User         = require('../models/User');
const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const Ambulance    = require('../models/Ambulance');
const AppConfig    = require('../models/AppConfig');
const Booking      = require('../models/Booking');
const Feedback     = require('../models/Feedback');
const Complaint    = require('../models/Complaint');
const SupportMessage = require('../models/SupportMessage');
const Otp          = require('../models/Otp');
const Location     = require('../models/Location');
const Payment      = require('../models/Payment');

const WIPE = process.argv.includes('--wipe');

// ─── Load seed data from JSON files ──────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'seedData');
const SUBSCRIPTION_PLANS = require(path.join(DATA_DIR, 'subscriptions.json'));
const ORGANIZATIONS       = require(path.join(DATA_DIR, 'organizations.json'));
const USERS               = require(path.join(DATA_DIR, 'users.json'));
const AMBULANCE_TEMPLATES = require(path.join(DATA_DIR, 'ambulances.json'));
const APP_CONFIG_DATA     = require(path.join(DATA_DIR, 'appConfig.json'));

// ─── (kept for reference — actual data now lives in seedData/*.json) ─────────
// ─── Subscription Plans ───────────────────────────────────────────────────────
const SUBSCRIPTION_PLANS_UNUSED = [
  {
    name: 'Basic',
    description: 'Entry-level plan for small operators',
    price: 2999,
    duration: 30,
    maxAmbulances: 5,
    maxDrivers: 10,
    features: ['GPS Tracking', 'Booking Management', 'Basic Reports'],
    isActive: true,
    gstPercent: 18,
    trialDays: 7,
  },
  {
    name: 'Standard',
    description: 'Mid-tier plan for growing organizations',
    price: 7999,
    duration: 90,
    maxAmbulances: 20,
    maxDrivers: 40,
    features: ['GPS Tracking', 'Booking Management', 'Advanced Reports', 'Priority Support', 'Driver App'],
    isActive: true,
    gstPercent: 18,
    trialDays: 14,
  },
  {
    name: 'Premium',
    description: 'Full-featured plan for large fleets',
    price: 19999,
    duration: 365,
    maxAmbulances: -1,
    maxDrivers: -1,
    features: [
      'GPS Tracking', 'Booking Management', 'Advanced Reports',
      '24/7 Priority Support', 'Driver App', 'Patient History',
      'Multi-Organization', 'API Access',
    ],
    isActive: true,
    gstPercent: 18,
    trialDays: 30,
  },
];

// ─── Organizations ────────────────────────────────────────────────────────────
const ORGANIZATIONS_UNUSED = [
  {
    name: 'City Ambulance Services',
    email: 'contact@cityambulance.com',
    phone: '9800001111',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: '12, MG Road, Bengaluru - 560001',
    gstNumber: '29ABCDE1234F1Z5',
    registrationNumber: 'KA-AMB-2020-001',
    contactPerson: 'Rajesh Kumar',
    website: 'https://cityambulance.com',
    status: 'active',
  },
  {
    name: 'LifeLine Emergency Care',
    email: 'info@lifelinecare.in',
    phone: '9800002222',
    city: 'Mumbai',
    state: 'Maharashtra',
    address: '45, Bandra West, Mumbai - 400050',
    gstNumber: '27FGHIJ5678K2L6',
    registrationNumber: 'MH-AMB-2019-007',
    contactPerson: 'Priya Mehta',
    website: 'https://lifelinecare.in',
    status: 'active',
  },
];

// ─── Users ────────────────────────────────────────────────────────────────────
const USERS_UNUSED = [
  // System accounts
  { name: 'Super Admin',    email: 'superadmin@abts.com', phone: '9999999999', password: 'SuperAdmin@123', role: 'superadmin' },
  { name: 'Admin',          email: 'admin@abts.com',      phone: '1000000001', password: 'Admin@123',      role: 'admin'      },
  // Regular users
  { name: 'Anil Sharma',    email: 'user@abts.com',       phone: '9742316945', password: 'User@123',       role: 'user'       },
  { name: 'Priya Verma',    email: 'priya@abts.com',      phone: '9845001122', password: 'User@123',       role: 'user'       },
  { name: 'Suresh Nair',    email: 'suresh@abts.com',     phone: '9900112233', password: 'User@123',       role: 'user'       },
  // Drivers
  { name: 'Ramesh Babu',    email: 'driver1@abts.com',    phone: '9810101010', password: 'Driver@123',     role: 'driver'     },
  { name: 'Venkat Reddy',   email: 'driver2@abts.com',    phone: '9810202020', password: 'Driver@123',     role: 'driver'     },
  { name: 'Mohan Das',      email: 'driver3@abts.com',    phone: '9810303030', password: 'Driver@123',     role: 'driver'     },
  { name: 'Kiran Patil',    email: 'driver4@abts.com',    phone: '9810404040', password: 'Driver@123',     role: 'driver'     },
];

// ─── Ambulances (built after org + driver users are known) ───────────────────
const buildAmbulancesFromJSON = (userDocs, orgDocs) =>
  AMBULANCE_TEMPLATES.map((tmpl) => {
    const { driverEmail, organizationEmail, insuranceExpiry, registrationExpiry, ...rest } = tmpl;
    const driverUser = userDocs[driverEmail];
    const org        = orgDocs[organizationEmail];
    return {
      ...rest,
      owner:              driverUser._id,
      organization:       org._id,
      insuranceExpiry:    new Date(insuranceExpiry),
      registrationExpiry: new Date(registrationExpiry),
    };
  });

// ─── (legacy inline builder kept for reference — replaced by buildAmbulancesFromJSON) ───
const buildAmbulances_UNUSED = (adminUser, driverUsers, org) => [
  {
    vehicleNumber: 'KA01AB1234',
    driverName: driverUsers[0].name,
    driverPhone: driverUsers[0].phone,
    driverLicense: 'KA0120210012345',
    type: 'advanced',
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, defibrillator: true, cctvCamera: true },
    pricePerKm: 20,
    basePrice: 300,
    isAvailable: true,
    currentLocation: { type: 'Point', coordinates: [77.5946, 12.9716], address: 'MG Road, Bengaluru' },
    specializations: ['cardiac', 'trauma'],
    status: 'active',
    owner: driverUsers[0]._id,
    organization: org._id,
    insuranceExpiry: new Date('2026-12-31'),
    registrationExpiry: new Date('2026-06-30'),
  },
  {
    vehicleNumber: 'KA02CD5678',
    driverName: driverUsers[1].name,
    driverPhone: driverUsers[1].phone,
    driverLicense: 'KA0220190067890',
    type: 'icu',
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, doctor: true, ventilator: true, defibrillator: true, cctvCamera: true },
    pricePerKm: 35,
    basePrice: 600,
    isAvailable: true,
    currentLocation: { type: 'Point', coordinates: [77.6101, 12.9352], address: 'Koramangala, Bengaluru' },
    specializations: ['cardiac', 'respiratory', 'general'],
    status: 'active',
    owner: driverUsers[1]._id,
    organization: org._id,
    insuranceExpiry: new Date('2026-09-30'),
    registrationExpiry: new Date('2026-08-31'),
  },
  {
    vehicleNumber: 'KA03EF9012',
    driverName: driverUsers[2].name,
    driverPhone: driverUsers[2].phone,
    driverLicense: 'KA0320220056789',
    type: 'basic',
    facilities: { stretcher: true, cctvCamera: true },
    pricePerKm: 12,
    basePrice: 150,
    isAvailable: true,
    currentLocation: { type: 'Point', coordinates: [77.5800, 13.0000], address: 'Malleshwaram, Bengaluru' },
    specializations: ['general', 'accident'],
    status: 'active',
    owner: driverUsers[2]._id,
    organization: org._id,
    insuranceExpiry: new Date('2027-01-31'),
    registrationExpiry: new Date('2027-03-31'),
  },
  {
    vehicleNumber: 'KA04GH3456',
    driverName: driverUsers[3].name,
    driverPhone: driverUsers[3].phone,
    driverLicense: 'KA0420230078901',
    type: 'neonatal',
    facilities: { oxygen: true, saline: true, stretcher: true, nurse: true, cctvCamera: true },
    pricePerKm: 25,
    basePrice: 400,
    isAvailable: true,
    currentLocation: { type: 'Point', coordinates: [77.6200, 12.9250], address: 'HSR Layout, Bengaluru' },
    specializations: ['maternity', 'general'],
    status: 'active',
    owner: driverUsers[3]._id,
    organization: org._id,
    insuranceExpiry: new Date('2026-11-30'),
    registrationExpiry: new Date('2026-10-31'),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const upsertUser = async (data) => {
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    existing.role = data.role;
    existing.isActive = true;
    existing.isBlocked = false;
    existing.isVerified = true;
    if (data.organization) existing.organization = data.organization;
    await existing.save();
    return { doc: existing, action: 'updated' };
  }
  const doc = await User.create({ ...data, isVerified: true, isActive: true, isBlocked: false });
  return { doc, action: 'created' };
};

const upsertSubscription = async (data) => {
  const existing = await Subscription.findOne({ name: data.name });
  if (existing) {
    Object.assign(existing, data);
    await existing.save();
    return { doc: existing, action: 'updated' };
  }
  const doc = await Subscription.create(data);
  return { doc, action: 'created' };
};

const upsertOrganization = async (data) => {
  const existing = await Organization.findOne({ email: data.email });
  if (existing) {
    Object.assign(existing, data);
    await existing.save();
    return { doc: existing, action: 'updated' };
  }
  const doc = await Organization.create(data);
  return { doc, action: 'created' };
};

const upsertAmbulance = async (data) => {
  const existing = await Ambulance.findOne({ vehicleNumber: data.vehicleNumber });
  if (existing) {
    Object.assign(existing, data);
    await existing.save();
    return { doc: existing, action: 'updated' };
  }
  const doc = await Ambulance.create(data);
  return { doc, action: 'created' };
};

// ─── Fetch & display summary from DB ─────────────────────────────────────────
const fetchAndDisplay = async () => {
  console.log('\n════════════════════════════════════════════');
  console.log(' DATABASE SNAPSHOT (fetched live)');
  console.log('════════════════════════════════════════════');

  // Subscription Plans
  const plans = await Subscription.find({}, 'name price duration maxAmbulances isActive').lean();
  console.log('\n── Subscription Plans (' + plans.length + ') ──');
  plans.forEach((p) =>
    console.log(`  [${p.isActive ? 'active' : 'off  '}] ${p.name.padEnd(10)} ₹${p.price} / ${p.duration}d  maxAmb: ${p.maxAmbulances === -1 ? '∞' : p.maxAmbulances}`)
  );

  // Organizations
  const orgs = await Organization.find({}, 'name city status email').lean();
  console.log('\n── Organizations (' + orgs.length + ') ──');
  orgs.forEach((o) =>
    console.log(`  [${o.status.padEnd(9)}] ${o.name.padEnd(30)} ${o.city}  <${o.email}>`)
  );

  // Users by role
  const users = await User.find({}, 'name email phone role isActive isVerified').lean();
  console.log('\n── Users (' + users.length + ') ──');
  ['superadmin', 'admin', 'driver', 'user'].forEach((role) => {
    const group = users.filter((u) => u.role === role);
    if (!group.length) return;
    console.log(`  ${role.toUpperCase()} (${group.length}):`);
    group.forEach((u) =>
      console.log(`    ${u.name.padEnd(20)} ${u.email.padEnd(28)} ${u.phone}`)
    );
  });

  // Ambulances
  const ambs = await Ambulance.find({}, 'vehicleNumber driverName type pricePerKm basePrice isAvailable status')
    .populate('organization', 'name')
    .lean();
  console.log('\n── Ambulances (' + ambs.length + ') ──');
  ambs.forEach((a) =>
    console.log(
      `  [${a.status.padEnd(11)}] ${a.vehicleNumber.padEnd(12)} ` +
      `${a.type.padEnd(8)} ₹${a.basePrice}+₹${a.pricePerKm}/km  ` +
      `driver: ${a.driverName.padEnd(15)} ` +
      `available: ${a.isAvailable ? 'YES' : 'NO '}  ` +
      `org: ${a.organization ? a.organization.name : 'none'}`
    )
  );

  console.log('\n════════════════════════════════════════════');
  console.log(' QUICK LOGIN CREDENTIALS');
  console.log('════════════════════════════════════════════');
  console.log('  superadmin@abts.com  /  SuperAdmin@123');
  console.log('  admin@abts.com       /  Admin@123');
  console.log('  user@abts.com        /  User@123');
  console.log('  driver1@abts.com     /  Driver@123');
  console.log('════════════════════════════════════════════\n');
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/abts');
  console.log('Connected to MongoDB\n');

  if (WIPE) {
    const models = [User, Subscription, Organization, Ambulance, AppConfig, Booking,
                    Feedback, Complaint, SupportMessage, Otp, Location, Payment];
    await Promise.all(models.map((M) => M.deleteMany({})));
    console.log('Wiped ' + models.length + ' collections\n');
  }

  // 1. Subscription Plans
  console.log('── Seeding Subscription Plans ──');
  const planDocs = {};
  for (const plan of SUBSCRIPTION_PLANS) {
    const { doc, action } = await upsertSubscription(plan);
    planDocs[plan.name] = doc;
    console.log(`  ${action.padEnd(7)} [plan]  ${doc.name}`);
  }

  // 2. Organizations (subscriptionPlanName resolved from planDocs)
  console.log('\n── Seeding Organizations ──');
  const orgDocs = {};
  for (const org of ORGANIZATIONS) {
    const { subscriptionPlanName, ...orgData } = org;
    const plan = planDocs[subscriptionPlanName];
    const { doc, action } = await upsertOrganization({
      ...orgData,
      subscriptionPlan:    plan._id,
      subscriptionStarted: new Date(),
      subscriptionExpiry:  new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000),
    });
    orgDocs[org.email] = doc;
    console.log(`  ${action.padEnd(7)} [org]   ${doc.name}`);
  }

  // 3. Users
  console.log('\n── Seeding Users ──');
  const userDocs = {};
  const primaryOrg = orgDocs['contact@cityambulance.com'];
  for (const user of USERS) {
    const extra = user.role === 'driver' || user.role === 'admin'
      ? { organization: primaryOrg._id }
      : {};
    const { doc, action } = await upsertUser({ ...user, ...extra });
    userDocs[user.email] = doc;
    console.log(`  ${action.padEnd(7)} [${user.role.padEnd(10)}]  ${user.email}`);
  }

  // 4. Ambulances (owner/org resolved from JSON driverEmail / organizationEmail)
  console.log('\n── Seeding Ambulances ──');
  for (const ambData of buildAmbulancesFromJSON(userDocs, orgDocs)) {
    const { doc, action } = await upsertAmbulance(ambData);
    console.log(`  ${action.padEnd(7)} [ambulance]  ${doc.vehicleNumber}  (${doc.type})`);
  }

  // 5. App Config (facilities, ambulanceTypes, bookingStatus, paymentMethods, etc.)
  console.log('\n── Seeding App Config ──');
  for (const [key, value] of Object.entries(APP_CONFIG_DATA)) {
    const existing = await AppConfig.findOne({ key });
    if (existing) {
      existing.value = value;
      await existing.save();
      console.log(`  updated  [config]  ${key}`);
    } else {
      await AppConfig.create({ key, value });
      console.log(`  created  [config]  ${key}`);
    }
  }

  // 6. Fetch everything from DB and display
  await fetchAndDisplay();

  await mongoose.disconnect();
};

run().catch((err) => { console.error('Seed failed:', err.message); process.exit(1); });