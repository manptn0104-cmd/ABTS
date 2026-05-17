import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAmbulanceById, clearSelected } from '../../store/ambulanceSlice';
import Button         from '../../components/common/Button';
import Card           from '../../components/common/Card';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Colors, Spacing, BorderRadius, Shadow, Typography } from '../../theme';
import { getAmbulanceType, formatDistance, formatETA, formatCurrency, getAvailableFacilities } from '../../utils/helpers';
import { FACILITIES } from '../../utils/constants';

export default function AmbulanceDetailsScreen({ route, navigation }) {
  const { ambulanceId, location } = route.params;
  const dispatch = useDispatch();
  const { selected: ambulance, isLoadingDetails } = useSelector((s) => s.ambulance);
  const [selectedFacilities, setSelectedFacilities] = useState([]);

  useEffect(() => {
    dispatch(fetchAmbulanceById(ambulanceId));
    return () => dispatch(clearSelected());
  }, [ambulanceId, dispatch]);

  if (isLoadingDetails || !ambulance) {
    return <LoadingSpinner fullscreen message="Loading ambulance details…" />;
  }

  const typeConfig = getAmbulanceType(ambulance.type);
  const allFacilities = FACILITIES;

  const toggleFacility = (key) => {
    setSelectedFacilities((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  const handleBook = () => {
    if (!location) {
      Alert.alert('Location Required', 'We need your pickup location to proceed.');
      return;
    }
    navigation.navigate('BookingConfirmation', { ambulance, location, selectedFacilities });
  };

  const FacilityRow = ({ facility }) => {
    const available = ambulance.facilities?.[facility.key];
    const isSelected = selectedFacilities.includes(facility.key);

    return (
     <TouchableOpacity
  style={[
    styles.facilityRow,
    !available && styles.facilityDisabled,
    isSelected && styles.facilitySelected,
  ]}
  onPress={() => available && toggleFacility(facility.key)}
  disabled={!available}
>
  <MaterialCommunityIcons
    name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
    size={20}
    color={
      !available
        ? Colors.textMuted
        : isSelected
        ? Colors.white
        : Colors.primary
    }
  />

  <Text
    style={[
      styles.facilityName,
      !available && styles.facilityDisabledText,
      isSelected && styles.facilityNameSelected,
    ]}
  >
    {facility.label}
  </Text>
</TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Vehicle Header */}
        <Card shadow="medium" style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={[styles.typePill, { backgroundColor: typeConfig.color }]}>
              <Text style={styles.typePillText}>{typeConfig.label} Ambulance</Text>
            </View>
            <View style={styles.ratingBadge}>
              <MaterialCommunityIcons name="star" size={14} color="#FFC107" />
              <Text style={styles.ratingText}>{ambulance.rating?.average?.toFixed(1) ?? '—'}</Text>
              <Text style={styles.ratingCount}>({ambulance.rating?.count})</Text>
            </View>
          </View>

          <Text style={styles.vehicleNum}>{ambulance.vehicleNumber}</Text>

          <View style={styles.statsRow}>
            {location && (
              <>
                <View style={styles.stat}>
                  <MaterialCommunityIcons name="map-marker-distance" size={18} color={Colors.primary} />
                  <Text style={styles.statValue}>{formatDistance((ambulance.distanceKm ?? 0) * 1000)}</Text>
                  <Text style={styles.statLabel}>Distance</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <MaterialCommunityIcons name="clock-fast" size={18} color={Colors.secondary} />
                  <Text style={styles.statValue}>{formatETA(ambulance.estimatedArrivalMin ?? 0)}</Text>
                  <Text style={styles.statLabel}>ETA</Text>
                </View>
                <View style={styles.statDivider} />
              </>
            )}
            <View style={styles.stat}>
              <MaterialCommunityIcons name="currency-inr" size={18} color={Colors.success} />
              <Text style={styles.statValue}>{formatCurrency(ambulance.basePrice)}</Text>
              <Text style={styles.statLabel}>Base Fare</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <MaterialCommunityIcons name="road-variant" size={18} color={Colors.accent} />
              <Text style={styles.statValue}>{formatCurrency(ambulance.pricePerKm)}/km</Text>
              <Text style={styles.statLabel}>Per KM</Text>
            </View>
          </View>

          {/* Availability indicator */}
          <View style={[styles.availBadge, { backgroundColor: ambulance.isAvailable ? '#E8F5E9' : '#FFEBEE' }]}>
            <View style={[styles.availDot, { backgroundColor: ambulance.isAvailable ? Colors.success : Colors.error }]} />
            <Text style={[styles.availText, { color: ambulance.isAvailable ? Colors.success : Colors.error }]}>
              {ambulance.isAvailable ? 'Available Now' : 'Currently Unavailable'}
            </Text>
          </View>
        </Card>

        {/* Driver Details */}
        <Card shadow="light" style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Information</Text>
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <MaterialCommunityIcons name="account" size={32} color={Colors.white} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{ambulance.driverName}</Text>
              <View style={styles.driverDetail}>
                <MaterialCommunityIcons name="phone" size={14} color={Colors.textSecondary} />
                <Text style={styles.driverDetailText}>{ambulance.driverPhone}</Text>
              </View>
              <View style={styles.driverDetail}>
                <MaterialCommunityIcons name="card-account-details" size={14} color={Colors.textSecondary} />
                <Text style={styles.driverDetailText}>License: {ambulance.driverLicense}</Text>
              </View>
            </View>
            <View style={styles.tripsChip}>
              <Text style={styles.tripsNum}>{ambulance.totalTrips}</Text>
              <Text style={styles.tripsLabel}>Trips</Text>
            </View>
          </View>
        </Card>

        {/* Safety Features - CCTV Badge */}
        <View style={styles.cctvBadgeContainer}>
          <View style={styles.cctvBadge}>
            <MaterialCommunityIcons name="cctv" size={24} color="#FFFFFF" />
            <View style={styles.cctvTextContainer}>
              <Text style={styles.cctvTitle}>CCTV Protected</Text>
              <Text style={styles.cctvSubtitle}>24/7 Monitoring</Text>
            </View>
            <MaterialCommunityIcons name="shield-check" size={20} color="#FFFFFF" />
          </View>
        </View>

        {/* Facilities */}
        <Card shadow="light" style={styles.section}>
          <Text style={styles.sectionTitle}>Facilities & Equipment</Text>
          <View style={styles.facilitiesList}>
            {allFacilities.map((f) => (
              <FacilityRow key={f.key} facility={f} />
            ))}
          </View>
        </Card>

        {/* Pricing */}
        <Card shadow="light" style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing Details</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Base Fare</Text>
            <Text style={styles.priceValue}>{formatCurrency(ambulance.basePrice)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Per Kilometre</Text>
            <Text style={styles.priceValue}>{formatCurrency(ambulance.pricePerKm)}</Text>
          </View>
          <View style={[styles.priceRow, styles.priceTotalRow]}>
            <Text style={styles.priceTotalLabel}>Estimated for 5 km</Text>
            <Text style={styles.priceTotalValue}>
              {formatCurrency(ambulance.basePrice + ambulance.pricePerKm * 5)}
            </Text>
          </View>
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Book Button */}
      <View style={styles.bookingBar}>
        <View>
          <Text style={styles.fareLabel}>Starting at</Text>
          <Text style={styles.fareValue}>{formatCurrency(ambulance.basePrice)}</Text>
        </View>
        <Button
          title={ambulance.isAvailable ? 'Book Now' : 'Unavailable'}
          onPress={handleBook}
          disabled={!ambulance.isAvailable}
          size="lg"
          style={styles.bookBtn}
          icon={<MaterialCommunityIcons name="ambulance" size={20} color={Colors.white} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.md, paddingBottom: 120 },
  heroCard:  { marginBottom: Spacing.md },
  heroTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  typePill:  { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.full },
  typePillText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  ratingBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText:   { fontSize: 14, fontWeight: '700', color: Colors.text },
  ratingCount:  { fontSize: 12, color: Colors.textSecondary },
  vehicleNum:   { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md },
  statsRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: Spacing.md },
  stat:         { alignItems: 'center', gap: 4, flex: 1 },
  statValue:    { fontSize: 13, fontWeight: '700', color: Colors.text },
  statLabel:    { fontSize: 11, color: Colors.textSecondary },
  statDivider:  { width: 1, height: 32, backgroundColor: Colors.border },
  availBadge:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.sm, borderRadius: BorderRadius.md },
  availDot:     { width: 8, height: 8, borderRadius: 4 },
  availText:    { fontSize: 13, fontWeight: '700' },
  section:      { marginBottom: Spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  driverRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  driverAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  driverInfo:   { flex: 1, gap: 4 },
  driverName:   { fontSize: 16, fontWeight: '700', color: Colors.text },
  driverDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  driverDetailText: { fontSize: 12, color: Colors.textSecondary },
  tripsChip:    { alignItems: 'center', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.sm },
  tripsNum:     { fontSize: 18, fontWeight: '800', color: Colors.primary },
  tripsLabel:   { fontSize: 11, color: Colors.textSecondary },
  facilitiesList: { gap: 8 },
  facilityRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: Colors.background },
  facilityAvailable: { backgroundColor: '#F3F9FF' },
  facilitySelected: { backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.primary },
  facilityDisabled: {
  backgroundColor: '#F5F5F5',
  opacity: 0.5,
},

facilityDisabledText: {
  color: Colors.textMuted,
},
  facilityName: { flex: 1, fontSize: 14, color: Colors.text },
  facilityNA:   { color: Colors.textMuted },
  facilityNameSelected: { color: Colors.white, fontWeight: '700' },
  facilityCheck:{ marginLeft: 'auto' },
  priceRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  priceLabel:   { fontSize: 14, color: Colors.textSecondary },
  priceValue:   { fontSize: 14, fontWeight: '600', color: Colors.text },
  priceTotalRow:{ borderBottomWidth: 0, marginTop: 4 },
  priceTotalLabel:{ fontSize: 15, fontWeight: '700', color: Colors.text },
  priceTotalValue:{ fontSize: 16, fontWeight: '800', color: Colors.primary },
  bookingBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    ...Shadow.heavy,
  },
  fareLabel: { fontSize: 12, color: Colors.textSecondary },
  fareValue: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  bookBtn:   { flex: 1, marginLeft: Spacing.lg },

  // CCTV Safety Badge
  cctvBadgeContainer: { marginBottom: Spacing.md },
  cctvBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.medium,
  },
  cctvTextContainer: {
    flex: 1,
  },
  cctvTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  cctvSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
});
