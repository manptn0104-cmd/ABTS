const Booking = require('../models/Booking');
const Ambulance = require('../models/Ambulance');
const dispatchConfig = require('../config/dispatchConfig');
const { getIO } = require('./socketService');

const assignNextDriver = async (bookingId) => {

    const booking = await Booking.findById(bookingId)
        .populate('ambulance')
        .populate('user');

    if (!booking) {
        throw new Error('Booking not found');
    }

    console.log('========== DISPATCH ==========');
    console.log('Booking:', booking._id.toString());
    console.log('Status:', booking.status);
    console.log('Facilities:', booking.requiredFacilities);
    console.log('Pickup:', booking.pickupLocation.address);
    console.log('Contacted Drivers:', booking.contactedDrivers);
    console.log('==============================');

    // Read pickup coordinates
const [lng, lat] = booking.pickupLocation.coordinates;

// Read required facilities
const requiredFacilities = booking.requiredFacilities || [];

// Read drivers already contacted
const contactedDrivers = booking.contactedDrivers || [];

console.log("Latitude:", lat);
console.log("Longitude:", lng);
console.log("Required Facilities:", requiredFacilities);
console.log("Contacted Drivers:", contactedDrivers);
// Build facility filter dynamically
const facilityFilter = {};

requiredFacilities.forEach((facility) => {
    facilityFilter[`facilities.${facility}`] = true;
});

console.log("Facility Filter:", facilityFilter);

// Find available ambulances that match facilities
console.log("===== DEBUG =====");

const allAvailable = await Ambulance.find({ isAvailable: true });

console.log("Available ambulances:", allAvailable.length);

allAvailable.forEach(a => {
    console.log({
        vehicle: a.vehicleNumber,
        driver: a.driverName,
        owner: a.owner.toString(),
        facilities: a.facilities,
        address: a.currentLocation.address,
    });
});

console.log("=================");
const ambulances = await Ambulance.find({
    isAvailable: true,

    owner: {
        $nin: contactedDrivers,
    },

    ...facilityFilter,

    currentLocation: {
        $near: {
            $geometry: {
                type: "Point",
                coordinates: [lng, lat],
            },
            $maxDistance: dispatchConfig.SEARCH_RADIUS,
        },
    },
});
console.log("========== MATCHING AMBULANCES ==========");

console.log("Total:", ambulances.length);

ambulances.forEach((ambulance, index) => {

    console.log({
        No: index + 1,
        Vehicle: ambulance.vehicleNumber,
        Driver: ambulance.driverName,
        DriverId: ambulance.owner.toString(),
        Available: ambulance.isAvailable,
        Facilities: ambulance.facilities,
        Address: ambulance.currentLocation.address,
    });

});

console.log("=========================================");

// No matching ambulance found
if (ambulances.length === 0) {
    console.log("No matching ambulance found.");
    return null;
}

// Pick the nearest ambulance (first result from $near)
const selectedAmbulance = ambulances[0];

console.log("Selected Ambulance:");
console.log("Vehicle:", selectedAmbulance.vehicleNumber);
console.log("Driver:", selectedAmbulance.driverName);
console.log("Driver ID:", selectedAmbulance.owner.toString());

// Assign booking to the selected driver
booking.assignedDriver = selectedAmbulance.owner;

// Assign the selected ambulance
booking.ambulance = selectedAmbulance._id;

// Update dispatch status
booking.dispatchStatus = "assigned";

// Record assignment time
booking.assignmentStartedAt = new Date();

// Increase dispatch attempts
booking.dispatchAttempts += 1;

// Add this driver to contacted drivers (avoid reassigning later)
booking.contactedDrivers.push(selectedAmbulance.owner);

// Save changes
await booking.save();

console.log("Booking assigned successfully.");
console.log("Assigned Driver:", booking.assignedDriver.toString());
console.log("Dispatch Attempts:", booking.dispatchAttempts);

// Start response timeout for this driver
setTimeout(async () => {

    try {

        const latestBooking = await Booking.findById(booking._id);

        if (!latestBooking) return;

        // Driver already accepted
        if (latestBooking.status !== "pending") {
            return;
        }

        console.log(
            "[Dispatch] Driver response timeout."
        );

        latestBooking.dispatchStatus = "expired";

        await latestBooking.save();

        const nextDriver = await assignNextDriver(
            latestBooking._id
        );

        if (!nextDriver) {
            console.log(
                "[Dispatch] No more drivers available."
            );
            return;
        }

        const io = getIO();

        io.to(`ambulance_${nextDriver.ambulance._id}`).emit(
            "new_booking_request",
            {
                booking: nextDriver.booking,
                message: "New booking request",
            }
        );

        io.to(`user_${nextDriver.ambulance.owner}`).emit(
            "new_booking_request",
            {
                booking: nextDriver.booking,
                message: "New booking request",
            }
        );

        console.log(
            "[Dispatch] Assigned to next driver after timeout."
        );

    } catch (err) {

        console.error(err);

    }

}, dispatchConfig.DRIVER_RESPONSE_TIMEOUT_MS);

return {
    booking,
    ambulance: selectedAmbulance,
};
};

module.exports = {
    assignNextDriver,
};