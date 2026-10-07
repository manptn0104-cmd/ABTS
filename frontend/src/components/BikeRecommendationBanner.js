import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadow } from '../theme';

const REASON_LABEL = {
  NO_REGULAR_AMBULANCE: 'No regular ambulance available nearby',
  ETA_EXCEEDED:         'Regular ambulance ETA exceeds emergency threshold',
  FASTER_RESPONSE:      'Bike ambulance provides significantly faster response',
  ROAD_DIFFICULT:       'Road conditions may delay regular ambulance',
  BIKE_AVAILABLE:       'Bike ambulance available nearby for rapid first response',
};

export default function BikeRecommendationBanner({
  recommendation,
  onRequest,
  onDismiss,
  requesting = false,
}) {
  if (!recommendation?.recommended) return null;

  const { bikeAmbulance, bikeETA, regularAmbulanceETA, bikeDistanceKm, timeSaving, reasons } = recommendation;

  const primaryReason   = REASON_LABEL[reasons?.[0]] || 'Bike ambulance available nearby';
  const isUrgent        = reasons?.some((r) => ['NO_REGULAR_AMBULANCE','ETA_EXCEEDED','FASTER_RESPONSE','ROAD_DIFFICULT'].includes(r));
  const bgColor         = isUrgent ? '#1A237E' : '#1B5E20';
  const borderColor     = isUrgent ? '#3949AB' : '#2E7D32';
  const headerTitle     = isUrgent ? '⚡ Faster Emergency Response Available' : '🏍️ Bike Ambulance Available Nearby';

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name={isUrgent ? 'alert-circle' : 'motorbike'} size={20} color="#fff" />
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <MaterialCommunityIcons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}
      </View>

      {/* ETA comparison */}
      <View style={styles.etaRow}>
        {regularAmbulanceETA && (
          <View style={styles.etaBox}>
            <Text style={styles.etaIcon}>🚑</Text>
            <Text style={styles.etaValue}>{regularAmbulanceETA} min</Text>
            <Text style={styles.etaLabel}>Regular Ambulance</Text>
          </View>
        )}

        {regularAmbulanceETA && (
          <View style={styles.etaArrow}>
            <MaterialCommunityIcons name="arrow-right" size={20} color="rgba(255,255,255,0.5)" />
          </View>
        )}

        <View style={[styles.etaBox, styles.etaBoxHighlight]}>
          <Text style={styles.etaIcon}>🏍️</Text>
          <Text style={[styles.etaValue, styles.etaValueFast]}>{bikeETA} min</Text>
          <Text style={[styles.etaLabel, styles.etaLabelFast]}>Bike Ambulance</Text>
        </View>
      </View>

      {timeSaving > 0 && (
        <Text style={styles.savingText}>
          ⚡ {timeSaving} minutes faster than regular ambulance
        </Text>
      )}

      {/* Bike ambulance info */}
      <View style={styles.bikeInfo}>
        <View style={styles.bikeInfoRow}>
          <MaterialCommunityIcons name="motorbike" size={15} color={Colors.primary} />
          <Text style={styles.bikeInfoText}>
            {bikeAmbulance?.vehicleNumber || 'BA-???'}  ·  {bikeAmbulance?.driverName || 'Driver'}
          </Text>
          {bikeAmbulance?.rating?.average > 0 && (
            <Text style={styles.ratingText}>⭐ {bikeAmbulance.rating.average.toFixed(1)}</Text>
          )}
        </View>
        <View style={styles.bikeInfoRow}>
          <MaterialCommunityIcons name="map-marker-distance" size={15} color={Colors.textSecondary} />
          <Text style={styles.bikeInfoText}>{bikeDistanceKm} km away</Text>
        </View>

        {/* Facilities */}
        {bikeAmbulance?.facilities && (
          <View style={styles.facilitiesRow}>
            {bikeAmbulance.facilities.firstAid       && <FacilityChip label="First Aid" />}
            {bikeAmbulance.facilities.emergencyKit   && <FacilityChip label="Emergency Kit" />}
            {bikeAmbulance.facilities.oxygen         && <FacilityChip label="Oxygen" />}
            {bikeAmbulance.facilities.basicLifeSupport && <FacilityChip label="Basic Life Support" />}
            {bikeAmbulance.facilities.aed            && <FacilityChip label="AED" />}
          </View>
        )}
      </View>

      {/* Reason */}
      <Text style={styles.reason}>{primaryReason}</Text>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.requestBtn, requesting && styles.requestBtnDisabled]}
        onPress={onRequest}
        disabled={requesting}
        activeOpacity={0.85}
      >
        {requesting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <MaterialCommunityIcons name="motorbike" size={18} color="#fff" />
            <Text style={styles.requestBtnText}>Request Bike Ambulance</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

function FacilityChip({ label }) {
  return (
    <View style={styles.facilityChip}>
      <Text style={styles.facilityChipText}>✓ {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A237E',
    borderRadius: BorderRadius.lg || 16,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#3949AB',
    ...Shadow.heavy,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
  },

  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
  },
  etaBox: {
    alignItems: 'center',
    flex: 1,
  },
  etaBoxHighlight: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 8,
  },
  etaArrow: { paddingHorizontal: 4 },
  etaIcon:  { fontSize: 22, marginBottom: 2 },
  etaValue: { fontSize: 22, fontWeight: '800', color: 'rgba(255,255,255,0.7)' },
  etaValueFast: { color: '#69F0AE' },
  etaLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2, textAlign: 'center' },
  etaLabelFast: { color: 'rgba(255,255,255,0.85)', fontWeight: '700' },

  savingText: {
    fontSize: 12,
    color: '#69F0AE',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },

  bikeInfo: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: 10,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  bikeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  bikeInfoText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  ratingText:   { fontSize: 12, color: '#FFD54F', marginLeft: 4 },

  facilitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  facilityChip: {
    backgroundColor: 'rgba(105,240,174,0.15)',
    borderColor:     'rgba(105,240,174,0.4)',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  facilityChipText: { fontSize: 10, color: '#69F0AE', fontWeight: '600' },

  reason: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },

  requestBtn: {
    backgroundColor: '#E53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.md || 12,
  },
  requestBtnDisabled: { opacity: 0.6 },
  requestBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
