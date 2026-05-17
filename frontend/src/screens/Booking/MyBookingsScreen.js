import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyBookings, updateBookingInList } from '../../store/bookingSlice';
import { cancelBooking } from '../../api/bookings';
import { useSocket } from '../../hooks/useSocket';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Card from '../../components/common/Card';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';
import { getBookingStatus, formatDateTime, formatCurrency } from '../../utils/helpers';

const STATUS_TABS = [
  { label: 'All',         value: '' },
  { label: 'Active',      value: 'confirmed' },
  { label: 'Completed',   value: 'completed' },
  { label: 'Cancelled',   value: 'cancelled' },
];

export default function MyBookingsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { list: bookings, isLoading, total } = useSelector((s) => s.booking);
  const [activeTab, setActiveTab]     = useState('');
  const [cancellingId, setCancellingId]   = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const { connect } = useSocket();
  const socketRef = useRef(null);

  const load = (status) => {
    dispatch(fetchMyBookings({ status: status || undefined, limit: 20 }));
  };

  useEffect(() => { load(activeTab); }, [activeTab]);

  // Real-time status updates via socket
  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      const sock = await connect();
      if (!sock || !mounted) return;
      socketRef.current = sock;

      const handleStatusUpdate = (data) => {
        if (!mounted) return;
        dispatch(updateBookingInList({ bookingId: data.bookingId, status: data.status }));
      };

      sock.on('booking_status_update', handleStatusUpdate);
      return () => sock.off('booking_status_update', handleStatusUpdate);
    };

    const cleanup = setup();
    return () => {
      mounted = false;
      cleanup.then((fn) => fn?.());
    };
  }, [connect, dispatch]);

  const handleCancel = async (bookingId) => {
    setConfirmCancelId(null);
    setCancellingId(bookingId);
    try {
      const res = await cancelBooking(bookingId);
      if (res.data?.success) {
        dispatch(updateBookingInList({ bookingId, status: 'cancelled' }));
        // reload current tab so server-filtered lists stay consistent
        load(activeTab);
      }
    } catch (e) {
      // silently log; user can retry
      console.warn('Cancel booking failed:', e?.response?.data?.message || e.message);
    } finally {
      setCancellingId(null);
    }
  };

  const renderBooking = ({ item }) => {
    const statusCfg  = getBookingStatus(item.status);
    const isActive   = ['pending', 'confirmed', 'in_progress'].includes(item.status);
    const isCancellable = ['pending', 'confirmed'].includes(item.status);

    return (
      <TouchableOpacity
        style={[styles.card, Shadow.light]}
        onPress={() => {
          if (isActive) {
            navigation.navigate('LiveTracking', { bookingId: item._id });
          }
        }}
        activeOpacity={0.85}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.bookingId}>#{item._id?.slice(-6).toUpperCase()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>

        {/* Ambulance Info */}
        <View style={styles.row}>
          <MaterialCommunityIcons name="ambulance" size={16} color={Colors.primary} />
          <Text style={styles.vehicleText}>
            {item.ambulance?.vehicleNumber} — {item.ambulance?.type?.toUpperCase()}
          </Text>
        </View>

        <View style={styles.row}>
          <MaterialCommunityIcons name="map-marker" size={16} color={Colors.textSecondary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickupLocation?.address || '—'}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.timeText}>{formatDateTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.fareText}>{formatCurrency(item.fare?.total)}</Text>
        </View>

        {/* Action row */}
        {(isActive || isCancellable) && (
          <View style={styles.actionRow}>
            {isActive && (
              <TouchableOpacity
                style={styles.trackBtn}
                onPress={() => navigation.navigate('LiveTracking', { bookingId: item._id })}
              >
                <MaterialCommunityIcons name="map-marker-radius" size={14} color={Colors.secondary} />
                <Text style={styles.trackText}>Track</Text>
              </TouchableOpacity>
            )}
            {isCancellable && (
              confirmCancelId === item._id ? (
                /* Inline confirmation — works inside iframes, no browser dialog needed */
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmText}>Cancel this booking?</Text>
                  <TouchableOpacity
                    style={styles.confirmYesBtn}
                    onPress={() => handleCancel(item._id)}
                    disabled={cancellingId === item._id}
                  >
                    {cancellingId === item._id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.confirmYesText}>Yes, Cancel</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmNoBtn}
                    onPress={() => setConfirmCancelId(null)}
                  >
                    <Text style={styles.confirmNoText}>No</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setConfirmCancelId(item._id)}
                  disabled={cancellingId === item._id}
                >
                  {cancellingId === item._id ? (
                    <ActivityIndicator size="small" color={Colors.error} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="close-circle-outline" size={14} color={Colors.error} />
                      <Text style={styles.cancelBtnText}>Cancel Booking</Text>
                    </>
                  )}
                </TouchableOpacity>
              )
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <Text style={styles.headerCount}>{total} total</Text>
      </View>

      {/* Status tabs */}
      <View style={styles.tabs}>
        {STATUS_TABS.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.tab, activeTab === t.value && styles.tabActive]}
            onPress={() => setActiveTab(t.value)}
          >
            <Text style={[styles.tabText, activeTab === t.value && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && bookings.length === 0 ? (
        <LoadingSpinner message="Loading your bookings…" fullscreen />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item._id}
          renderItem={renderBooking}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => load(activeTab)}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No bookings found</Text>
              <Text style={styles.emptySubtitle}>Your booking history will appear here</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
  },
  headerTitle:{ fontSize: 20, fontWeight: '700', color: Colors.white },
  headerCount:{ fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  tab: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, marginRight: Spacing.sm },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText:   { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  list:  { padding: Spacing.md, paddingBottom: 32 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  bookingId:  { fontSize: 14, fontWeight: '700', color: Colors.text },
  statusBadge:{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full },
  statusText: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  vehicleText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  locationText:{ flex: 1, fontSize: 13, color: Colors.textSecondary },
  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  timeText:    { fontSize: 12, color: Colors.textMuted },
  fareText:    { fontSize: 14, fontWeight: '700', color: Colors.primary },
  trackRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm, backgroundColor: '#E3F2FD', borderRadius: 6, padding: 6 },
  trackText:   { fontSize: 12, color: Colors.secondary, fontWeight: '600' },
  actionRow:   { flexDirection: 'row', gap: 8, marginTop: Spacing.sm },
  trackBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E3F2FD', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  cancelBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFEBEE', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#FFCDD2', minWidth: 44, justifyContent: 'center' },
  cancelBtnText: { fontSize: 12, color: Colors.error, fontWeight: '700' },
  confirmRow:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF3E0', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#FFCC80' },
  confirmText:   { flex: 1, fontSize: 12, color: '#E65100', fontWeight: '600' },
  confirmYesBtn: { backgroundColor: Colors.error, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, minWidth: 80, alignItems: 'center' },
  confirmYesText:{ fontSize: 12, color: '#fff', fontWeight: '700' },
  confirmNoBtn:  { backgroundColor: Colors.surface, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  confirmNoText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyEmoji:   { fontSize: 48 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: Spacing.md },
  emptySubtitle:{ fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
});
