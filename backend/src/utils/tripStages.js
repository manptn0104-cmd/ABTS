// Regular transport and bike first-aid responses share the pickup stages.
const SHARED_PICKUP_STAGES = ['assigned', 'en_route_to_pickup', 'arrived_at_pickup'];
const REGULAR_STAGES_AFTER_PICKUP = [
  'patient_onboard', 'en_route_to_hospital', 'arrived_at_hospital',
  'patient_dropped_off', 'handover_completed', 'trip_completed',
];
const BIKE_STAGES_AFTER_PICKUP = ['patient_assessment', 'first_aid_provided'];
const TRIP_STAGES = [...SHARED_PICKUP_STAGES, ...REGULAR_STAGES_AFTER_PICKUP];
const BIKE_TRIP_STAGES = [...SHARED_PICKUP_STAGES, ...BIKE_STAGES_AFTER_PICKUP];

const STAGE_STATUS = {};
[...TRIP_STAGES, ...BIKE_TRIP_STAGES].forEach((stage) => {
  STAGE_STATUS[stage] = stage === 'trip_completed' ? 'completed'
    : stage === 'assigned' ? 'confirmed' : 'in_progress';
});

// Older bike responses may already be waiting at a now-removed handoff stage.
const LEGACY_BIKE_STAGES = [
  'first_aid_provided', 'regular_ambulance_requested', 'regular_ambulance_arrived',
  'patient_handover', 'bike_response_completed', 'handover_completed', 'trip_completed',
];

const nextStage = (booking) => {
  if (booking.status === 'completed') return null;
  const stage = booking.tripStage || 'assigned';
  const isBike = booking.responseType === 'bike';
  const pickupIdx = SHARED_PICKUP_STAGES.indexOf(stage);
  if (pickupIdx !== -1) {
    if (pickupIdx < SHARED_PICKUP_STAGES.length - 1) return SHARED_PICKUP_STAGES[pickupIdx + 1];
    return isBike ? 'patient_assessment' : 'patient_onboard';
  }
  if (isBike) {
    if (stage === 'patient_assessment' || LEGACY_BIKE_STAGES.includes(stage)) return 'first_aid_provided';
    return null;
  }
  const idx = REGULAR_STAGES_AFTER_PICKUP.indexOf(stage);
  return idx === -1 || idx === REGULAR_STAGES_AFTER_PICKUP.length - 1
    ? null : REGULAR_STAGES_AFTER_PICKUP[idx + 1];
};

module.exports = { TRIP_STAGES, BIKE_TRIP_STAGES, SHARED_PICKUP_STAGES, STAGE_STATUS, nextStage };
