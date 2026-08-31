/**
 * STEP 5D — SAFE LEGACY DATA -> ORGANIZATION TENANT MIGRATION
 *
 * One-time migration script to associate legacy demo tenant data (admins, drivers, ambulances)
 * with the BEAS-001 organization ("Bangalore Emergency Ambulance Services")
 * without modifying historical operational data, bookings, or bills.
 *
 * Usage:
 *   Audit only (dry-run): node src/scripts/migrateLegacyTenantData.js
 *   Execute migration:    node src/scripts/migrateLegacyTenantData.js --confirm
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Organization = require('../models/Organization');
const User = require('../models/User');
const Ambulance = require('../models/Ambulance');
const Booking = require('../models/Booking');
const Bill = require('../models/Bill');

const TARGET_ORG_CODE = 'BEAS-001';
const EXPECTED_ORG_ID = '6a8d8c95500325e16375a682';

const runMigration = async () => {
  const isConfirm = process.argv.includes('--confirm');

  console.log('===============================================================');
  console.log(' STEP 5D: SAFE LEGACY DATA -> ORGANIZATION TENANT MIGRATION');
  console.log(` Mode: ${isConfirm ? 'EXECUTE (LIVE WRITES)' : 'READ-ONLY AUDIT (DRY RUN)'}`);
  console.log('===============================================================\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  const dbName = mongoose.connection.name;
  console.log(`✅ Connected to database: "${dbName}"\n`);

  try {
    // -------------------------------------------------------------
    // 1. Initial Database Counts
    // -------------------------------------------------------------
    const countUsersBefore = await User.countDocuments();
    const countOrgsBefore = await Organization.countDocuments();
    const countAmbulancesBefore = await Ambulance.countDocuments();
    const countBookingsBefore = await Booking.countDocuments();
    const countBillsBefore = await Bill.countDocuments();

    console.log('-------------------- DATABASE COUNTS (BEFORE) --------------------');
    console.log(`Users:         ${countUsersBefore}`);
    console.log(`Organizations: ${countOrgsBefore}`);
    console.log(`Ambulances:    ${countAmbulancesBefore}`);
    console.log(`Bookings:      ${countBookingsBefore}`);
    console.log(`Bills:         ${countBillsBefore}`);
    console.log('------------------------------------------------------------------\n');

    // -------------------------------------------------------------
    // 2. Audit Organization: BEAS-001
    // -------------------------------------------------------------
    console.log('-------------------- 1. ORGANIZATION AUDIT --------------------');
    const org = await Organization.findOne({ organizationCode: TARGET_ORG_CODE });
    if (!org) {
      console.error(`❌ CRITICAL: Target organization "${TARGET_ORG_CODE}" does not exist in database.`);
      console.error('STOPPING: Cannot proceed without target organization.');
      process.exit(1);
    }

    console.log(`Organization Found:     ${org.organizationName}`);
    console.log(`Organization Code:      ${org.organizationCode}`);
    console.log(`Organization ID:        ${org._id.toString()}`);
    console.log(`Organization Status:    ${org.status}`);
    console.log(`isDeleted:              ${org.isDeleted}`);

    if (org._id.toString() !== EXPECTED_ORG_ID) {
      console.warn(`⚠️ WARNING: Org ID in DB (${org._id}) does not match expected ID (${EXPECTED_ORG_ID}).`);
    }

    if (org.isDeleted) {
      console.error('❌ CRITICAL: Target organization is marked as deleted (isDeleted: true).');
      process.exit(1);
    }
    console.log('Organization check passed.\n');

    const targetOrgId = org._id;

    // -------------------------------------------------------------
    // 3. Audit Admin Candidates
    // -------------------------------------------------------------
    console.log('-------------------- 2. ADMIN ACCOUNTS AUDIT --------------------');
    const allAdmins = await User.find({ role: 'admin' });
    console.log(`Found ${allAdmins.length} user(s) with role="admin":`);

    let confirmedTenantAdmins = [];
    let ambiguousAdmins = [];

    for (const adm of allAdmins) {
      const currentOrgStr = adm.organizationId ? adm.organizationId.toString() : 'None';
      console.log(` - ID: ${adm._id} | Email: ${adm.email} | Name: ${adm.name} | OrgId: ${currentOrgStr}`);
      
      // If admin already has another different organizationId, flag as ambiguous
      if (adm.organizationId && adm.organizationId.toString() !== targetOrgId.toString()) {
        ambiguousAdmins.push(adm);
      } else {
        confirmedTenantAdmins.push(adm);
      }
    }

    if (ambiguousAdmins.length > 0) {
      console.error(`❌ Found ${ambiguousAdmins.length} admin(s) assigned to conflicting organizations!`);
      process.exit(1);
    }

    console.log(`Confirmed Tenant Admin(s): ${confirmedTenantAdmins.length} (Candidates to receive organizationId: ${targetOrgId})\n`);

    // -------------------------------------------------------------
    // 4. Audit Ambulances and Owners
    // -------------------------------------------------------------
    console.log('-------------------- 3. AMBULANCE & DRIVER AUDIT --------------------');
    const allAmbulances = await Ambulance.find().populate('owner');
    console.log(`Found ${allAmbulances.length} ambulance(s) in database.`);

    const confirmedTenantAmbulances = [];
    const confirmedTenantDriversMap = new Map();
    const ambiguousAmbulances = [];
    const ambulancesAlreadyMigrated = [];

    for (const amb of allAmbulances) {
      const owner = amb.owner;
      const ambOrgStr = amb.organizationId ? amb.organizationId.toString() : 'None';
      
      console.log(`\nAmbulance ID: ${amb._id}`);
      console.log(`  Vehicle: ${amb.vehicleNumber} (${amb.type})`);
      console.log(`  Driver Name on Vehicle: "${amb.driverName}", Phone: "${amb.driverPhone}"`);
      console.log(`  Current organizationId: ${ambOrgStr}`);

      if (!owner) {
        console.error(`  ❌ Owner not found for ambulance ${amb.vehicleNumber} (ownerId: ${amb._id})`);
        ambiguousAmbulances.push({ ambulance: amb, reason: 'Owner missing from database' });
        continue;
      }

      console.log(`  Owner: ID: ${owner._id} | Name: ${owner.name} | Email: ${owner.email} | Role: ${owner.role}`);

      if (owner.role !== 'driver') {
        console.warn(`  ⚠️ Owner is not role="driver" (role is "${owner.role}")`);
        ambiguousAmbulances.push({ ambulance: amb, reason: `Owner role is "${owner.role}", not "driver"` });
        continue;
      }

      if (amb.organizationId && amb.organizationId.toString() !== targetOrgId.toString()) {
        console.warn(`  ⚠️ Ambulance has conflicting organizationId: ${amb.organizationId}`);
        ambiguousAmbulances.push({ ambulance: amb, reason: 'Conflicting organizationId on ambulance' });
        continue;
      }

      if (owner.organizationId && owner.organizationId.toString() !== targetOrgId.toString()) {
        console.warn(`  ⚠️ Owner has conflicting organizationId: ${owner.organizationId}`);
        ambiguousAmbulances.push({ ambulance: amb, reason: 'Conflicting organizationId on owner' });
        continue;
      }

      if (amb.organizationId && amb.organizationId.toString() === targetOrgId.toString()) {
        ambulancesAlreadyMigrated.push(amb);
      }

      confirmedTenantAmbulances.push(amb);
      confirmedTenantDriversMap.set(owner._id.toString(), owner);
    }

    const confirmedTenantDrivers = Array.from(confirmedTenantDriversMap.values());

    console.log('\n-------------------- DRIVERS AUDIT --------------------');
    const allDrivers = await User.find({ role: 'driver' });
    console.log(`Total Drivers in DB: ${allDrivers.length}`);
    console.log(`Confirmed Tenant Drivers (via ambulance ownership): ${confirmedTenantDrivers.length}`);
    
    // Check if there are other drivers not linked to any ambulance
    const unlinkedDrivers = allDrivers.filter(d => !confirmedTenantDriversMap.has(d._id.toString()));
    if (unlinkedDrivers.length > 0) {
      console.log(`\nDrivers not owning any ambulance (${unlinkedDrivers.length}):`);
      for (const d of unlinkedDrivers) {
        console.log(` - ID: ${d._id} | Name: ${d.name} | Email: ${d.email} | OrgId: ${d.organizationId || 'None'}`);
      }
    }

    console.log('\n-------------------- 4. AUDIT SUMMARY --------------------');
    console.log(`Target Organization:              ${org.organizationName} (${org.organizationCode})`);
    console.log(`Target Organization ID:           ${targetOrgId}`);
    console.log(`Organization Status:              ${org.status}`);
    console.log(`Total Users in DB:                ${countUsersBefore}`);
    console.log(`Total Admins in DB:               ${allAdmins.length}`);
    console.log(`Confirmed Tenant Admins:          ${confirmedTenantAdmins.length}`);
    console.log(`Total Drivers in DB:              ${allDrivers.length}`);
    console.log(`Confirmed Tenant Drivers:         ${confirmedTenantDrivers.length}`);
    console.log(`Total Ambulances in DB:           ${allAmbulances.length}`);
    console.log(`Confirmed Tenant Ambulances:      ${confirmedTenantAmbulances.length}`);
    console.log(`Ambiguous Ambulances:             ${ambiguousAmbulances.length}`);
    console.log(`Ambiguous Admins:                 ${ambiguousAdmins.length}`);
    console.log(`Bookings (will NOT be modified):  ${countBookingsBefore}`);
    console.log(`Bills (will NOT be modified):     ${countBillsBefore}`);

    // Detail modifications to be made
    const usersToUpdate = [...confirmedTenantAdmins, ...confirmedTenantDrivers].filter(
      u => !u.organizationId || u.organizationId.toString() !== targetOrgId.toString()
    );
    const ambulancesToUpdate = confirmedTenantAmbulances.filter(
      a => !a.organizationId || a.organizationId.toString() !== targetOrgId.toString()
    );

    console.log('\n-------------------- 5. PLANNED MODIFICATIONS --------------------');
    console.log(`Users requiring organizationId assignment:       ${usersToUpdate.length}`);
    for (const u of usersToUpdate) {
      console.log(`  + User: ${u.email} (${u.name}, role: ${u.role}, ID: ${u._id}) -> set organizationId = ${targetOrgId}`);
    }

    console.log(`Ambulances requiring organizationId assignment:  ${ambulancesToUpdate.length}`);
    for (const a of ambulancesToUpdate) {
      console.log(`  + Ambulance: ${a.vehicleNumber} (ID: ${a._id}) -> set organizationId = ${targetOrgId}`);
    }

    console.log(`\nRecords that will NOT be changed:`);
    console.log(`  - Regular Patients/Users (${countUsersBefore - allAdmins.length - allDrivers.length} accounts): NO CHANGE`);
    console.log(`  - Unlinked Drivers (${unlinkedDrivers.length} accounts): NO CHANGE`);
    console.log(`  - Bookings (${countBookingsBefore} records): NO CHANGE (0 modified, 0 inserted, 0 deleted)`);
    console.log(`  - Bills (${countBillsBefore} records): NO CHANGE (0 modified, 0 inserted, 0 deleted)`);
    console.log(`  - Organization Status: Remains "${org.status}" (NO CHANGE)`);

    // -------------------------------------------------------------
    // 6. Safety Validation
    // -------------------------------------------------------------
    let safetyPassed = true;
    const safetyIssues = [];

    if (!org || org.isDeleted) {
      safetyPassed = false;
      safetyIssues.push('Target organization BEAS-001 does not exist or is deleted.');
    }
    if (ambiguousAdmins.length > 0) {
      safetyPassed = false;
      safetyIssues.push(`${ambiguousAdmins.length} admin(s) have conflicting organization assignments.`);
    }
    if (ambiguousAmbulances.length > 0) {
      safetyPassed = false;
      safetyIssues.push(`${ambiguousAmbulances.length} ambulance(s) have ambiguous or conflicting ownership.`);
    }

    console.log('\n-------------------- 6. SAFETY CHECK RESULT --------------------');
    if (safetyPassed) {
      console.log('✅ ALL SAFETY CHECKS PASSED.');
      console.log('Migration is SAFE to execute.');
    } else {
      console.error('❌ SAFETY CHECKS FAILED:');
      for (const issue of safetyIssues) {
        console.error(`  - ${issue}`);
      }
      console.error('MIGRATION CANNOT BE EXECUTED.');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // 7. Execution (Only if --confirm is supplied)
    // -------------------------------------------------------------
    if (!isConfirm) {
      console.log('\n===============================================================');
      console.log(' ℹ️  DRY RUN COMPLETED. ZERO WRITES PERFORMED.');
      console.log(' To execute these changes, re-run with:');
      console.log(' node src/scripts/migrateLegacyTenantData.js --confirm');
      console.log('===============================================================\n');
      await mongoose.disconnect();
      return;
    }

    // Live Execution with MongoDB Session / Transaction
    console.log('\n===============================================================');
    console.log(' 🚀 EXECUTING LIVE MIGRATION WITHIN MONGO TRANSACTION...');
    console.log('===============================================================\n');

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Update Users
        for (const u of usersToUpdate) {
          await User.updateOne(
            { _id: u._id },
            { $set: { organizationId: targetOrgId } },
            { session }
          );
        }

        // Update Ambulances
        for (const a of ambulancesToUpdate) {
          await Ambulance.updateOne(
            { _id: a._id },
            { $set: { organizationId: targetOrgId } },
            { session }
          );
        }
      });
      console.log('✅ Transaction committed successfully.');
    } catch (txError) {
      console.error('❌ Transaction failed and was rolled back:', txError.message);
      throw txError;
    } finally {
      await session.endSession();
    }

    // Verification After Writes
    const countUsersAfter = await User.countDocuments();
    const countOrgsAfter = await Organization.countDocuments();
    const countAmbulancesAfter = await Ambulance.countDocuments();
    const countBookingsAfter = await Booking.countDocuments();
    const countBillsAfter = await Bill.countDocuments();

    const usersInOrg = await User.countDocuments({ organizationId: targetOrgId });
    const driversInOrg = await User.countDocuments({ organizationId: targetOrgId, role: 'driver' });
    const ambulancesInOrg = await Ambulance.countDocuments({ organizationId: targetOrgId });
    const ambulancesMissingOrg = await Ambulance.countDocuments({ organizationId: { $exists: false } });

    console.log('\n-------------------- DATABASE COUNTS (AFTER) --------------------');
    console.log(`Users:         ${countUsersAfter} (Before: ${countUsersBefore})`);
    console.log(`Organizations: ${countOrgsAfter} (Before: ${countOrgsBefore})`);
    console.log(`Ambulances:    ${countAmbulancesAfter} (Before: ${countAmbulancesBefore})`);
    console.log(`Bookings:      ${countBookingsAfter} (Before: ${countBookingsBefore})`);
    console.log(`Bills:         ${countBillsAfter} (Before: ${countBillsBefore})`);
    console.log('------------------------------------------------------------------');

    console.log('\n-------------------- POST-MIGRATION VERIFICATION --------------------');
    console.log(`Users assigned to BEAS-001:       ${usersInOrg}`);
    console.log(`Drivers assigned to BEAS-001:     ${driversInOrg}`);
    console.log(`Ambulances assigned to BEAS-001:  ${ambulancesInOrg}`);
    console.log(`Ambulances missing organizationId: ${ambulancesMissingOrg}`);
    console.log('=====================================================================\n');

  } catch (err) {
    console.error('❌ Error during audit/migration:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

runMigration();
