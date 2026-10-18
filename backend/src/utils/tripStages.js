// Ordered ambulance trip lifecycle (after the driver accepts the booking).
const TRIP_STAGES = [
  'assigned',
  'en_route_to_pickup',
  'arrived_at_pickup',
  'patient_onboard',
  'en_route_to_hospital',
  'arrived_at_hospital',
  'patient_dropped_off',
  'handover_completed',
  'trip_completed',
];

// Coarse booking status that corresponds to each stage.
const STAGE_STATUS = {
  assigned: 'confirmed',
  en_route_to_pickup: 'in_progress',
  arrived_at_pickup: 'in_progress',
  patient_onboard: 'in_progress',
  en_route_to_hospital: 'in_progress',
  arrived_at_hospital: 'in_progress',
  patient_dropped_off: 'in_progress',
  handover_completed: 'in_progress',
  trip_completed: 'completed',
};

const nextStage = (stage) => {
  const idx = TRIP_STAGES.indexOf(stage);
  return idx === -1 || idx === TRIP_STAGES.length - 1 ? null : TRIP_STAGES[idx + 1];
};

module.exports = { TRIP_STAGES, STAGE_STATUS, nextStage };
