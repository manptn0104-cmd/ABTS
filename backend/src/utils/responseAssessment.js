// Implements the "Assess Location, Traffic and Severity" step of the
// emergency-response flowchart. Since the actual dispatch resource (bike vs
// regular ambulance) is still chosen by the patient from the nearby list,
// this assessment is used to (a) flag bookings assigned to a bike ambulance
// as likely to also need a regular ambulance for transport, and (b) surface
// a recommendation to the patient when browsing nearby ambulances.

const HIGH_SEVERITY_TYPES = ['cardiac', 'trauma', 'accident'];
const MEDIUM_SEVERITY_TYPES = ['respiratory', 'maternity'];

// Bike ambulances can weave through traffic to reach a patient quickly, but
// can't transport them — past this range a regular ambulance is the better
// first call for the pickup leg itself.
const BIKE_FEASIBLE_RADIUS_KM = 10;

const assessSeverity = (emergencyType) => {
  if (HIGH_SEVERITY_TYPES.includes(emergencyType)) return 'high';
  if (MEDIUM_SEVERITY_TYPES.includes(emergencyType)) return 'medium';
  return 'low';
};

// Returns the recommended "Best Response Resource?" outcome: 'bike',
// 'regular', or 'both' (bike first response + a regular ambulance expected).
const recommendResponseResource = ({ emergencyType, distanceKm }) => {
  const severity = assessSeverity(emergencyType);
  const km = Number.isFinite(distanceKm) ? distanceKm : null;

  if (severity === 'high') {
    // Close enough for a bike to arrive first and start first aid while a
    // regular ambulance is coordinated for transport.
    if (km == null || km <= BIKE_FEASIBLE_RADIUS_KM) return 'both';
    return 'regular';
  }
  if (km != null && km <= BIKE_FEASIBLE_RADIUS_KM) return 'bike';
  return 'regular';
};

// Called once a bike ambulance has actually been assigned to a booking, to
// pre-flag whether a regular ambulance will likely be needed afterwards.
const likelyNeedsRegularAmbulance = ({ emergencyType, distanceKm }) => {
  const recommendation = recommendResponseResource({ emergencyType, distanceKm });
  return recommendation === 'both' || assessSeverity(emergencyType) === 'high';
};

module.exports = { assessSeverity, recommendResponseResource, likelyNeedsRegularAmbulance, BIKE_FEASIBLE_RADIUS_KM };
