import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';

export default function DriverMapScreen({ route, navigation }) {
  const { booking, ambulanceLocation } = route.params;

  // Extract pickup coordinates (GeoJSON: [lng, lat])
  const [pickupLng, pickupLat] = booking.pickupLocation?.coordinates || [0, 0];

  // Ambulance/driver current location
  const ambCoord = useMemo(() => {
    if (!ambulanceLocation?.coordinates) return null;
    const [lng, lat] = ambulanceLocation.coordinates;
    return lat && lng ? { latitude: lat, longitude: lng } : null;
  }, [ambulanceLocation]);
  const driverLocationText = ambulanceLocation?.address || (ambCoord ? 'Driver location available' : 'Location unavailable');

  // Open external maps app for turn-by-turn navigation
  const openNavigation = () => {
    const dest = `${pickupLat},${pickupLng}`;
    const originStr = ambCoord ? `&origin=${ambCoord.latitude},${ambCoord.longitude}` : '';
    const webUrl = `https://www.google.com/maps/dir/?api=1${originStr}&destination=${dest}&travelmode=driving`;

    if (Platform.OS === 'ios') {
      Linking.openURL(`maps://app?daddr=${dest}`).catch(() => Linking.openURL(webUrl));
    } else if (Platform.OS === 'android') {
      Linking.openURL(`google.navigation:q=${dest}`).catch(() => Linking.openURL(webUrl));
    } else {
      Linking.openURL(webUrl);
    }
  };

  // View pickup on Google Maps
  const openGoogleMapsLink = () => {
    const query = `${pickupLat},${pickupLng}`;
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;

    if (Platform.OS === 'android') {
      Linking.openURL(`https://maps.google.com/?q=${query}`).catch(() => Linking.openURL(webUrl));
    } else {
      Linking.openURL(webUrl);
    }
  };

  // Google Maps static preview URL (requires API key for a true static map render)
  const staticMapUrl = `https://www.google.com/maps?q=${pickupLat},${pickupLng}&z=15&output=embed`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pickup Navigation</Text>
        <TouchableOpacity onPress={openNavigation} style={styles.navIconBtn}>
          <MaterialCommunityIcons name="navigation-variant" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Map Preview — opens Google Maps */}
        <TouchableOpacity style={styles.mapCard} onPress={openGoogleMapsLink} activeOpacity={0.85}>
          <View style={styles.mapImageWrapper}>
            {Platform.OS === 'web' ? (
              <iframe
                title="Google Maps pickup location"
                src={staticMapUrl}
                style={{ width: '100%', height: '100%', border: 0, borderRadius: 16 }}
                allowFullScreen
              />
            ) : (
              <View style={styles.mapPlaceholder}>
                <MaterialCommunityIcons name="map-marker-radius" size={48} color={Colors.primary} />
                <Text style={styles.mapPlaceholderText}>Tap to open Google Maps</Text>
              </View>
            )}
          </View>
          <View style={styles.mapOverlay}>
            <MaterialCommunityIcons name="open-in-new" size={14} color={Colors.white} />
            <Text style={styles.mapOverlayText}>View on Google Maps</Text>
          </View>
        </TouchableOpacity>

        {/* Location Details Card */}
        <View style={[styles.card, Shadow.medium]}>
          {/* Driver current position */}
          {ambulanceLocation ? (
            <>
              <View style={styles.locationRow}>
                <View style={[styles.locationDot, { backgroundColor: '#E53935' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationLabel}>DRIVER CURRENT LOCATION</Text>
                  <Text style={styles.locationText}>{driverLocationText}</Text>
                  {ambCoord ? (
                    <Text style={styles.coordText}>
                      {ambCoord.latitude.toFixed(5)}, {ambCoord.longitude.toFixed(5)}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.locationDivider} />
            </>
          ) : null}

          {/* Pickup */}
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: Colors.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationLabel}>PICKUP LOCATION</Text>
              <Text style={styles.locationText}>{booking.pickupLocation?.address || 'N/A'}</Text>
              <Text style={styles.coordText}>
                {pickupLat.toFixed(5)}, {pickupLng.toFixed(5)}
              </Text>
            </View>
          </View>

          {/* Drop (if available) */}
          {booking.dropLocation?.address ? (
            <>
              <View style={styles.locationDivider} />
              <View style={styles.locationRow}>
                <View style={[styles.locationDot, { backgroundColor: Colors.success || '#4CAF50' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationLabel}>DROP LOCATION</Text>
                  <Text style={styles.locationText}>{booking.dropLocation.address}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* Patient Info Card */}
        <View style={[styles.card, Shadow.medium]}>
          <Text style={styles.cardTitle}>Patient Details</Text>
          <View style={styles.infoGrid}>
            <InfoItem icon="account" label="Name" value={booking.patientDetails?.name || booking.user?.name || 'N/A'} />
            {booking.patientDetails?.age ? <InfoItem icon="calendar" label="Age" value={`${booking.patientDetails.age} yrs`} /> : null}
            {booking.user?.phone ? <InfoItem icon="phone" label="Phone" value={booking.user.phone} /> : null}

            {booking.patientDetails?.bloodGroup && booking.patientDetails.bloodGroup !== 'unknown' ? (
              <InfoItem icon="water" label="Blood" value={booking.patientDetails.bloodGroup} color="#E53935" />
            ) : null}
            {booking.patientDetails?.condition ? (
              <InfoItem icon="note-text" label="Condition" value={booking.patientDetails.condition} />
            ) : null}
          </View>

          {/* Emergency Contact */}
          {(booking.patientDetails?.emergencyContact?.name || booking.patientDetails?.emergencyContact?.phone) ? (
            <View style={styles.emergencyBox}>
              <Text style={styles.emergencyBoxTitle}>Emergency Contact</Text>
              {booking.patientDetails.emergencyContact.name ? (
                <Text style={styles.emergencyBoxText}>👤 {booking.patientDetails.emergencyContact.name}</Text>
              ) : null}
              {booking.patientDetails.emergencyContact.phone ? (
                <Text style={styles.emergencyBoxText}>📞 {booking.patientDetails.emergencyContact.phone}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Fare Card */}
        {booking.fare?.total ? (
          <View style={[styles.card, Shadow.medium]}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Estimated Fare</Text>
              <Text style={styles.fareValue}>₹{booking.fare.total.toFixed(0)}</Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Navigate Button at Bottom */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.navigateBtn} onPress={openNavigation} activeOpacity={0.8}>
          <MaterialCommunityIcons name="navigation-variant" size={22} color={Colors.white} />
          <Text style={styles.navigateBtnText}>Navigate to Pickup</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Small reusable info row
function InfoItem({ icon, label, value, color }) {
  return (
    <View style={styles.infoItem}>
      <MaterialCommunityIcons name={icon} size={15} color={color || Colors.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.secondary, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.white },
  navIconBtn:  { padding: 4 },

  content: { padding: Spacing.md },

  // Map card
  mapCard: { borderRadius: 16, overflow: 'hidden', marginBottom: Spacing.md, position: 'relative' },
  mapImageWrapper: { width: '100%', height: 220, backgroundColor: Colors.border, borderRadius: 16 },
  mapPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#E8F5E9', borderRadius: 16,
  },
  mapPlaceholderText: { fontSize: 13, color: Colors.textSecondary, marginTop: 8 },
  mapOverlay: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  mapOverlayText: { fontSize: 11, color: Colors.white, fontWeight: '600' },

  // Cards
  card: {
    backgroundColor: Colors.surface || '#fff', borderRadius: BorderRadius.lg || 16,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Location rows
  locationRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  locationDot:     { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  locationLabel:   { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 2 },
  locationText:    { fontSize: 14, fontWeight: '600', color: Colors.text, lineHeight: 20 },
  coordText:       { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  locationDivider: { width: 2, height: 20, backgroundColor: Colors.border, marginLeft: 5, marginVertical: 4 },

  // Info grid
  infoGrid: { gap: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 12, color: Colors.textMuted, width: 70 },
  infoValue: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text, textTransform: 'capitalize' },

  // Emergency contact
  emergencyBox: {
    marginTop: Spacing.sm, backgroundColor: '#FFF8F8',
    borderRadius: BorderRadius.md || 10, padding: Spacing.sm,
    borderWidth: 1, borderColor: '#FFCDD2',
  },
  emergencyBoxTitle: { fontSize: 12, fontWeight: '700', color: '#E53935', marginBottom: 4 },
  emergencyBoxText:  { fontSize: 13, color: Colors.text, marginBottom: 2 },

  // Fare
  fareRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fareLabel: { fontSize: 14, color: Colors.textSecondary },
  fareValue: { fontSize: 20, fontWeight: '800', color: Colors.secondary },

  // Patient row
  patientRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center',
  },
  patientName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  patientSub:  { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface || '#fff', padding: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
    ...Shadow.heavy,
  },
  navigateBtn: {
    backgroundColor: '#1B5E20', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: BorderRadius.lg || 14,
  },
  navigateBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
});
