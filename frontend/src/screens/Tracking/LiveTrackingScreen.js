import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  Animated, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBookingById, cancelBooking, updateCurrentStatus } from '../../store/bookingSlice';
import { useSocket } from '../../hooks/useSocket';
import MapComponent from '../../components/MapComponent';
import Card  from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';
import { getBookingStatus, formatETA, formatDateTime } from '../../utils/helpers';
import { BOOKING_STATUS } from '../../utils/constants';

const PULSE_STATUSES = ['pending', 'confirmed', 'in_progress'];

export default function LiveTrackingScreen({ route, navigation }) {
  const { bookingId } = route.params;
  const dispatch  = useDispatch();
  const { connect, on, off, emit } = useSocket();
  const { current: booking, isLoading } = useSelector((s) => s.booking);
  const { user } = useSelector((s) => s.auth);

  const [ambulanceLoc, setAmbulanceLoc] = useState(null);
  const [mapRegion, setMapRegion]       = useState(null);
  const [eta, setEta]                   = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Fetch booking data
  useEffect(() => {
    dispatch(fetchBookingById(bookingId));
  }, [bookingId, dispatch]);

  // Set initial map region from booking pickup
  useEffect(() => {
    if (booking?.pickupLocation?.coordinates) {
      const [lng, lat] = booking.pickupLocation.coordinates;
      setMapRegion({
        latitude: lat, longitude: lng,
        latitudeDelta: 0.02, longitudeDelta: 0.02,
      });
    }
  }, [booking]);

  // Pulse animation for active statuses
  useEffect(() => {
    if (PULSE_STATUSES.includes(booking?.status)) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [booking?.status]);

  // Socket connection & listeners
  useEffect(() => {
    let socket;

    const handleAmbulanceLoc = (data) => {
      const loc = { latitude: data.latitude, longitude: data.longitude };
      setAmbulanceLoc(loc);
      setEta(data.eta || null);
      setMapRegion((r) =>
        r
          ? { ...r, latitude: (r.latitude + loc.latitude) / 2, longitude: (r.longitude + loc.longitude) / 2 }
          : { ...loc, latitudeDelta: 0.02, longitudeDelta: 0.02 }
      );
    };

    const handleStatusUpdate = (data) => {
      dispatch(updateCurrentStatus(data.status));
      if (data.status === 'completed') {
        Alert.alert('Trip Completed', 'Your ambulance has arrived. Thank you!', [
          { text: 'Rate Trip', onPress: () => navigation.replace('MyBookings') },
          { text: 'Close',     onPress: () => navigation.navigate('MainTabs') },
        ]);
      }
      if (data.status === 'rejected') {
        Alert.alert('Booking Rejected', data.booking?.rejectionReason || 'Driver rejected the booking.', [
          { text: 'Find Another', onPress: () => navigation.goBack() },
        ]);
      }
    };

    const setup = async () => {
      socket = await connect();
      if (!socket) return;

      socket.emit('join_booking_room', bookingId);
      socket.on('ambulance_location', handleAmbulanceLoc);
      socket.on('booking_status_update', handleStatusUpdate);
    };

    setup();

    return () => {
      if (socket) {
        socket.emit('leave_booking_room', bookingId);
        socket.off('ambulance_location', handleAmbulanceLoc);
        socket.off('booking_status_update', handleStatusUpdate);
      }
    };
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            await dispatch(cancelBooking(bookingId));
            navigation.navigate('MainTabs');
          },
        },
      ]
    );
  };

  if (isLoading || !booking) {
    return <LoadingSpinner fullscreen message="Loading booking details…" />;
  }

  const statusConfig = getBookingStatus(booking.status);
  const [pickupLng, pickupLat] = booking.pickupLocation?.coordinates ?? [0, 0];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapComponent
          region={mapRegion}
          userLocation={{ latitude: pickupLat, longitude: pickupLng }}
          ambulanceLocation={ambulanceLoc}
          style={styles.map}
          routeCoords={
            ambulanceLoc
              ? [ambulanceLoc, { latitude: pickupLat, longitude: pickupLng }]
              : []
          }
        />

        {/* Status Overlay */}
        <View style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}>
          <Animated.View
            style={[
              styles.statusDot,
              { backgroundColor: statusConfig.color, transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Bottom info sheet */}
      <View style={styles.sheet}>
        {/* Booking ID & time */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>Booking #{booking._id?.slice(-6).toUpperCase()}</Text>
            <Text style={styles.sheetTime}>{formatDateTime(booking.createdAt)}</Text>
          </View>
          {eta && (
            <View style={styles.etaBox}>
              <MaterialCommunityIcons name="clock-fast" size={18} color={Colors.secondary} />
              <Text style={styles.etaText}>{formatETA(eta)}</Text>
              <Text style={styles.etaLabel}>ETA</Text>
            </View>
          )}
        </View>

        {/* Driver info */}
        <Card style={styles.driverCard} padding={false}>
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Text style={{ fontSize: 24 }}>🧑‍✈️</Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{booking.ambulance?.driverName}</Text>
              <Text style={styles.vehicleNum}>{booking.ambulance?.vehicleNumber}</Text>
            </View>
            <TouchableOpacity style={styles.callBtn}>
              <MaterialCommunityIcons name="phone" size={22} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Pickup location */}
        <View style={styles.locationRow}>
          <MaterialCommunityIcons name="map-marker" size={18} color={Colors.primary} />
          <Text style={styles.locationText} numberOfLines={2}>
            {booking.pickupLocation?.address || 'Your pickup location'}
          </Text>
        </View>

        {/* Status timeline */}
        <View style={styles.timeline}>
          {['pending', 'confirmed', 'in_progress', 'completed'].map((s, i) => {
            const statuses = ['pending', 'confirmed', 'in_progress', 'completed'];
            const currentIdx = statuses.indexOf(booking.status);
            const isDone = i <= currentIdx;
            const cfg = BOOKING_STATUS[s];
            return (
              <View key={s} style={styles.timelineItem}>
                <View style={[styles.timelineDot, isDone && { backgroundColor: Colors.success }]}>
                  {isDone && <MaterialCommunityIcons name="check" size={12} color={Colors.white} />}
                </View>
                {i < 3 && <View style={[styles.timelineLine, i < currentIdx && styles.timelineLineDone]} />}
                <Text style={[styles.timelineLabel, isDone && styles.timelineLabelDone]}>{cfg.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Cancel button — only for pending/confirmed */}
        {['pending', 'confirmed'].includes(booking.status) && (
          <Button
            title="Cancel Booking"
            variant="outline"
            onPress={handleCancel}
            style={styles.cancelBtn}
          />
        )}

        {/* Home button — always visible */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.navigate('MainTabs')}
        >
          <MaterialCommunityIcons name="home" size={18} color={Colors.primary} />
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.background },
  mapContainer: { flex: 1, position: 'relative' },
  map:          { flex: 1 },
  statusPill: {
    position: 'absolute', top: Spacing.md, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: BorderRadius.full,
    ...Shadow.medium,
  },
  statusDot:  { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '700' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg,
    ...Shadow.heavy,
    maxHeight: '55%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  sheetTitle:  { fontSize: 16, fontWeight: '700', color: Colors.text },
  sheetTime:   { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  etaBox:      { alignItems: 'center', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.sm },
  etaText:     { fontSize: 18, fontWeight: '800', color: Colors.secondary },
  etaLabel:    { fontSize: 11, color: Colors.textSecondary },
  driverCard: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md,
  },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  driverInfo:  { flex: 1 },
  driverName:  { fontSize: 15, fontWeight: '700', color: Colors.text },
  vehicleNum:  { fontSize: 13, color: Colors.textSecondary },
  callBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.success,
    justifyContent: 'center', alignItems: 'center',
  },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: Spacing.md },
  locationText:{ flex: 1, fontSize: 13, color: Colors.textSecondary },
  timeline:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
  timelineItem:{ flex: 1, alignItems: 'center' },
  timelineDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  timelineLine: { position: 'absolute', top: 9, left: '50%', width: '100%', height: 2, backgroundColor: Colors.border },
  timelineLineDone: { backgroundColor: Colors.success },
  timelineLabel:     { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
  timelineLabelDone: { color: Colors.success, fontWeight: '600' },
  cancelBtn: { marginTop: Spacing.sm },
  homeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: Spacing.sm, paddingVertical: 10,
    borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  homeBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
});
