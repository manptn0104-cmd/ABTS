const https = require('https');

const query = '17th Main Road, New Tavarekere, Bengaluru';
const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&countrycodes=in`;

const options = {
  headers: {
    'User-Agent': 'ABTS-Ambulance-Booking-Test-App/1.0 (raman@example.com)'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Nominatim Results:');
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
}).on('error', (err) => {
  console.error('Error:', err);
});
