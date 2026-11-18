const test = require('node:test');
const assert = require('node:assert/strict');
const { nextStage, TRIP_STAGES, BIKE_TRIP_STAGES } = require('../src/utils/tripStages');

test('bike stages end with first aid and regular stages remain unchanged', () => {
  assert.deepEqual(BIKE_TRIP_STAGES, [
    'assigned', 'en_route_to_pickup', 'arrived_at_pickup',
    'patient_assessment', 'first_aid_provided',
  ]);
  for (let i = 0; i < BIKE_TRIP_STAGES.length - 1; i++) {
    assert.equal(nextStage({ responseType: 'bike', tripStage: BIKE_TRIP_STAGES[i] }), BIKE_TRIP_STAGES[i + 1]);
  }
  assert.equal(nextStage({ responseType: 'bike', tripStage: 'first_aid_provided', status: 'completed' }), null);
  for (let i = 0; i < TRIP_STAGES.length - 1; i++) {
    assert.equal(nextStage({ responseType: 'regular', tripStage: TRIP_STAGES[i] }), TRIP_STAGES[i + 1]);
  }
  assert.equal(nextStage({ responseType: 'regular', tripStage: 'trip_completed' }), null);
});

const fake = (path, exports) => {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
let booking;
let updates;
let events;
const Booking = {
  findOne: () => ({ populate: async () => booking }),
};
const Ambulance = {
  findByIdAndUpdate: async (id, update) => { updates.push({ id, update }); },
};
fake('../src/models/Booking', Booking);
fake('../src/models/Ambulance', Ambulance);
fake('../src/models/User', {});
fake('../src/services/socketService', {
  getIO: () => ({ to: (room) => ({ emit: (name, data) => events.push({ room, name, data }) }) }),
  emitStageLocation: async () => {},
});
const controller = require('../src/controllers/bookingController');

const setup = (stage = 'patient_assessment', type = 'bike') => {
  updates = [];
  events = [];
  booking = {
    _id: 'booking1', user: 'patient1', organizationId: 'org1', status: 'in_progress',
    responseType: type, tripStage: stage, tripTimeline: [],
    ambulance: { _id: 'vehicle1', owner: 'driver1' },
    save: async () => {}, populate: async () => {},
  };
};
const invoke = async (handler, body = {}) => {
  const req = { params: { id: 'booking1' }, body, user: { id: 'driver1', role: 'driver', organizationId: 'org1' } };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  await handler(req, res, (error) => { throw error; });
  return res;
};

test('marking first aid completes the response, releases the bike and emits completion', async () => {
  setup();
  const response = await invoke(controller.updateTripStage, { regularAmbulanceRequired: true });
  assert.equal(response.statusCode, 200);
  assert.equal(booking.tripStage, 'first_aid_provided');
  assert.equal(booking.status, 'completed');
  assert.ok(booking.completedAt instanceof Date);
  assert.deepEqual(booking.tripTimeline.map((entry) => entry.stage), ['first_aid_provided']);
  assert.deepEqual(updates, [{ id: 'vehicle1', update: { isAvailable: true, $inc: { totalTrips: 1 } } }]);
  assert.equal(events.length, 2);
  assert.ok(events.every((e) => e.name === 'booking_status_update' && e.data.status === 'completed'));
  assert.equal((await invoke(controller.updateTripStage)).statusCode, 400);
  assert.equal(updates.length, 1);
});

test('old bike responses waiting for a decision can be completed without coordinating transport', async () => {
  setup('first_aid_provided');
  booking.tripTimeline = [{ stage: 'first_aid_provided' }];
  const response = await invoke(controller.updateTripStage);
  assert.equal(response.statusCode, 200);
  assert.equal(booking.status, 'completed');
  assert.equal(booking.tripTimeline.length, 1);
  assert.equal(updates.length, 1);
});

test('bike completion cannot skip assessment through the status endpoint', async () => {
  setup('arrived_at_pickup');
  const response = await invoke(controller.updateBookingStatus, { status: 'completed' });
  assert.equal(response.statusCode, 400);
  assert.equal(booking.status, 'in_progress');
  assert.equal(updates.length, 0);
});

test('regular trips still complete through the final transport stage', async () => {
  setup('handover_completed', 'regular');
  const response = await invoke(controller.updateTripStage);
  assert.equal(response.statusCode, 200);
  assert.equal(booking.tripStage, 'trip_completed');
  assert.equal(booking.status, 'completed');
  assert.equal(updates.length, 1);
});
