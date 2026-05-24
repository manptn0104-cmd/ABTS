/**
 * Real-Time Smart Arrival & Dispatch ETA/Ranking Engine
 * Predictions are based on distance, live speed, road type, signals, traffic level, and emergency priority.
 */

function calculateSmartETA(params) {
  const {
    distanceMeters,
    currentSpeed = 40,
    trafficLevel = 'clear',
    roadType = 'main_road',
    signalsCount = 1,
    motionStatus = 'moving',
  } = params;

  // 1. Base travel time based on distance and speed (or default road speed)
  // Determine realistic speed for road type if current speed is 0 or not active
  let effectiveSpeed = currentSpeed;
  if (!effectiveSpeed || effectiveSpeed <= 0 || motionStatus === 'waiting' || motionStatus === 'stuck') {
    if (roadType === 'highway') effectiveSpeed = 55;
    else if (roadType === 'main_road') effectiveSpeed = 35;
    else effectiveSpeed = 20; // local_street
  }

  const distanceKm = distanceMeters / 1000;
  let baseMinutes = (distanceKm / effectiveSpeed) * 60;

  // 2. Traffic Multiplier
  let trafficMultiplier = 1.0;
  if (trafficLevel === 'moderate') trafficMultiplier = 1.5;
  else if (trafficLevel === 'heavy') trafficMultiplier = 2.4;

  let calculatedETA = baseMinutes * trafficMultiplier;

  // 3. Stop / Signal Delay
  const signalDelay = signalsCount * 1.3; // 1.3 minutes per traffic light/stop
  calculatedETA += signalDelay;

  // 4. Motion Delay Penalty (e.g. startup/stuck delay)
  if (motionStatus === 'stuck') {
    calculatedETA += 3.0; // 3 mins penalty
  } else if (motionStatus === 'waiting') {
    calculatedETA += 1.5; // 1.5 mins delay to start moving
  }

  // Ensure minimum ETA is realistic (at least 1 minute)
  calculatedETA = Math.max(1, Math.round(calculatedETA));

  // Debug logs as requested
  console.log(`[Smart ETA Debug] Dist: ${distanceKm.toFixed(2)}km, Speed: ${effectiveSpeed}km/h, Traffic: ${trafficLevel} (x${trafficMultiplier}), Signals: ${signalsCount} (+${signalDelay.toFixed(1)}m), Motion: ${motionStatus}, Calculated Smart ETA: ${calculatedETA} mins`);

  return calculatedETA;
}

function calculateRankScore(params) {
  const {
    smartETA,
    ambulanceType = 'basic',
    emergencyType = 'general',
    ratingAverage = 0,
    facilities = {},
  } = params;

  // Base score is the predicted Smart ETA in minutes (lower is better)
  let score = smartETA;

  // Apply Emergency Priority Logic
  const highPriority = ['cardiac', 'trauma', 'accident'].includes(emergencyType);

  if (highPriority) {
    // Boost highly equipped/ICU ambulances
    if (ambulanceType === 'icu') {
      score -= 5; // boost (subtract penalty)
    } else if (ambulanceType === 'advanced') {
      score -= 2; // minor boost
    } else if (ambulanceType === 'basic') {
      score += 4; // penalty for low capability in cardiac/trauma/accident
    }

    // Check specific critical equipment
    const hasOxygen = !!facilities.oxygen;
    const hasVentilator = !!facilities.ventilator;
    const hasDefibrillator = !!facilities.defibrillator;
    const hasNurseOrDoctor = !!(facilities.nurse || facilities.doctor);

    if (!hasOxygen) score += 3;
    if (!hasNurseOrDoctor) score += 2;
    if (emergencyType === 'cardiac' && !hasDefibrillator) score += 5; // cardiac needs defibrillator
    if (emergencyType === 'respiratory' && !hasVentilator) score += 4; // respiratory needs ventilator
  }

  // Factor in rating slightly to break ties
  score -= (ratingAverage / 5) * 0.5;

  console.log(`[Smart Rank Debug] Type: ${ambulanceType}, Emergency: ${emergencyType}, Smart ETA: ${smartETA}m, Calculated Rank Score: ${score.toFixed(2)}`);

  return score;
}

function getTrafficLabel(trafficLevel) {
  switch (trafficLevel) {
    case 'clear': return '🟢 Clear Route';
    case 'moderate': return '🟡 Moderate Traffic';
    case 'heavy': return '🔴 Heavy Traffic';
    default: return '🟢 Clear Route';
  }
}

function getMotionLabel(motionStatus) {
  switch (motionStatus) {
    case 'moving': return '🟢 Moving towards you';
    case 'waiting': return '🟡 Waiting';
    case 'stuck': return '🔴 Traffic delay';
    default: return '🟢 Moving towards you';
  }
}

module.exports = {
  calculateSmartETA,
  calculateRankScore,
  getTrafficLabel,
  getMotionLabel,
};
