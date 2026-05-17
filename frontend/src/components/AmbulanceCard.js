import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Shadow, Spacing } from '../theme';
import { getAmbulanceType, formatDistance, formatETA, formatCurrency } from '../utils/helpers';
import { FACILITIES } from '../utils/constants';

export default function AmbulanceCard({ ambulance, onPress, style }) {
  const typeConfig    = getAmbulanceType(ambulance.type);
  const distanceKm    = ambulance.distanceKm ?? null;
  const etaMin        = ambulance.estimatedArrivalMin ?? null;
  const availFacilities = FACILITIES.filter((f) => ambulance.facilities?.[f.key]);

  return (
    <TouchableOpacity
      style={[styles.card, Shadow.medium, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Header Row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.typeBadge, { backgroundColor: typeConfig.color }]}>
            <Text style={styles.typeLabel}>{typeConfig.label}</Text>
          </View>
          <Text style={styles.vehicleNumber}>{ambulance.vehicleNumber}</Text>
        </View>

        <View style={styles.headerRight}>
          <MaterialCommunityIcons name="star" size={14} color="#FFC107" />
          <Text style={styles.ratingText}>
            {ambulance.rating?.average?.toFixed(1) ?? '—'}
          </Text>
          <Text style={styles.ratingCount}>({ambulance.rating?.count ?? 0})</Text>
        </View>
      </View>

      {/* Driver */}
      <View style={styles.row}>
        <MaterialCommunityIcons name="account" size={16} color={Colors.textSecondary} />
        <Text style={styles.driverName}>{ambulance.driverName}</Text>
      </View>

      {/* Distance & ETA */}
      {distanceKm !== null && (
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="map-marker-distance" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>{formatDistance(distanceKm * 1000)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="clock-fast" size={16} color={Colors.secondary} />
            <Text style={styles.infoText}>{formatETA(etaMin)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="currency-inr" size={16} color={Colors.success} />
            <Text style={styles.infoText}>{formatCurrency(ambulance.basePrice)} base</Text>
          </View>
        </View>
      )}

      {/* Facilities */}
      {availFacilities.length > 0 && (
        <View style={styles.facilitiesRow}>
          {availFacilities.slice(0, 5).map((f) => (
            <View key={f.key} style={styles.facilityChip}>
              <MaterialCommunityIcons name={f.icon} size={12} color={Colors.secondary} />
              <Text style={styles.facilityLabel}>{f.label}</Text>
            </View>
          ))}
          {availFacilities.length > 5 && (
            <Text style={styles.moreText}>+{availFacilities.length - 5} more</Text>
          )}
        </View>
      )}

      {/* Availability */}
      <View style={styles.footer}>
        <View style={[styles.availDot, { backgroundColor: ambulance.isAvailable ? Colors.success : Colors.error }]} />
        <Text style={[styles.availText, { color: ambulance.isAvailable ? Colors.success : Colors.error }]}>
          {ambulance.isAvailable ? 'Available' : 'Unavailable'}
        </Text>
        <Text style={styles.bookText}>Tap to book →</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight:{ flexDirection: 'row', alignItems: 'center', gap: 3 },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  typeLabel:     { color: Colors.white, fontSize: 11, fontWeight: '700' },
  vehicleNumber: { fontSize: 15, fontWeight: '700', color: Colors.text },
  ratingText:    { fontSize: 13, fontWeight: '700', color: Colors.text },
  ratingCount:   { fontSize: 12, color: Colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  driverName: { fontSize: 13, color: Colors.textSecondary },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  infoText:  { fontSize: 12, fontWeight: '600', color: Colors.text },
  separator: { width: 1, height: 20, backgroundColor: Colors.border },
  facilitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  facilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  facilityLabel: { fontSize: 11, color: Colors.secondary, fontWeight: '500' },
  moreText:      { fontSize: 11, color: Colors.textMuted, alignSelf: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  availDot:  { width: 8, height: 8, borderRadius: 4 },
  availText: { fontSize: 12, fontWeight: '600', flex: 1 },
  bookText:  { fontSize: 12, color: Colors.primary, fontWeight: '600' },
});
