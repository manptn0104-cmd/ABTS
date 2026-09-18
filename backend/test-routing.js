require('dotenv').config();

const { getRoadInfo } = require('./src/services/routingService');

const ambulance = {
    latitude: 12.9502,
    longitude: 77.6688
};

const pickup = {
    latitude: 12.9986,
    longitude: 77.7610
};

console.log('================================');
console.log('AMBULANCE LOCATION');
console.log('Latitude :', ambulance.latitude);
console.log('Longitude:', ambulance.longitude);

console.log('\nPICKUP LOCATION');
console.log('Latitude :', pickup.latitude);
console.log('Longitude:', pickup.longitude);

getRoadInfo(ambulance, pickup)
    .then(result => {
        console.log('\n================================');
        console.log('GOOGLE ROUTE RESULT');
        console.log('================================');
        console.log('Road Distance:', result.roadDistanceKm, 'km');
        console.log('ETA:', result.durationMinutes, 'minutes');
        console.log('Distance meters:', result.distanceMeters);
        console.log('Duration seconds:', result.durationSeconds);
        console.log('================================');
    })
    .catch(error => {
        console.error('ROUTE FAILED:', error);
    });