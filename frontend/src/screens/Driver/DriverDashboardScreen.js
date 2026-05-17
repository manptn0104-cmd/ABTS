import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, SafeAreaView, StatusBar, ScrollView, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';
import { fetchMyAmbulance } from '../../api/ambulances';
import { fetchAmbulanceBookings, updateBookingStatus } from '../../api/bookings';
import { useSocket } from '../../hooks/useSocket';

const STATUS_COLOR = {
  pending:     Colors.statusPending,
  confirmed:   Colors.statusConfirmed,
  in_progress: Colors.statusInProgress,
  completed:   Colors.statusCompleted,
  cancelled:   Colors.statusCancelled,
  rejected:    Colors.statusRejected,
};

const STATUS_LABEL = {
  pending:     'Pending',
  confirmed:   'Confirmed',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
  rejected:    'Rejected',
};

export default function DriverDashboardScreen() {
  const { user } = useSelector((s) => s.auth);
  const { connect, socket } = useSocket();

  const [ambulance,  setAmbulance]  = useState(null);
  const [bookings,   setBookings]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const [tab,        setTab]        = useState('pending'); // 'pending' | 'active' | 'history'

  const socketRef = useRef(null);

  // Load ambulance + bookings
  const loadData = useCallback(async () => {
    try {
      const ambRes = await fetchMyAmbulance();
      const amb    = ambRes.data.ambulance;
      setAmbulance(amb);

      const statuses = tab === 'pending'  ? 'pending'
                     : tab === 'active'   ? 'confirmed,in_progress'
                     : 'completed,cancelled,rejected';

      const bRes = await fetchAmbulanceBookings(amb._id, { status: statuses });
      setBookings(bRes.data.bookings || []);
    } catch (e) {
      console.error('Driver load error:', e?.response?.data || e.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  // Socket: join ambulance room, listen for new requests
  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      const sock = await connect();
      if (!sock || !mounted) return;
      socketRef.current = sock;

      if (ambulance) {
        sock.emit('join_ambulance_room', ambulance._id);
      }

      const handleNewRequest = (data) => {
        if (!mounted) return;
        // Add to top of list if we're on pending tab
        setBookings((prev) => {
          if (tab !== 'pending') return prev;
          const exists = prev.some((b) => b._id === data.booking._id);
          return exists ? prev : [data.booking, ...prev];
        });
      };

      const handleStatusUpdate = (data) => {
        if (!mounted) return;
        setBookings((prev) =>
          prev.map((b) => b._id === data.bookingId ? { ...b, status: data.status } : b)
        );
      };

      sock.on('new_booking_request', handleNewRequest);
      sock.on('booking_status_update', handleStatusUpdate);

      return () => {
        sock.off('new_booking_request', handleNewRequest);
        sock.off('booking_status_update', handleStatusUpdate);
      };
    };

    const cleanup = setup();
    return () => {
      mounted = false;
      cleanup.then((fn) => fn?.());
    };
  }, [ambulance, tab, connect]);

  const handleAction = async (bookingId, status) => {
    setActioningId(bookingId);
    try {
      await updateBookingStatus(bookingId, { status });
      // Refresh current tab
      await loadData();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Action failed.');
    } finally {
      setActioningId(null);
    }
  };

  const renderActionButtons = (booking) => {
    if (booking.status === 'pending') {
      return (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={() => handleAction(booking._id, 'confirmed')}
            disabled={actioningId === booking._id}
          >
            {actioningId === booking._id
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Text style={styles.actionBtnText}>✓ Accept</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => handleAction(booking._id, 'rejected')}
            disabled={actioningId === booking._id}
          >
            <Text style={styles.actionBtnText}>✗ Reject</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (booking.status === 'confirmed') {
      return (
        <TouchableOpacity
          style={[styles.actionBtn, styles.startBtn, { alignSelf: 'flex-start' }]}
          onPress={() => handleAction(booking._id, 'in_progress')}
          disabled={actioningId === booking._id}
        >
          {actioningId === booking._id
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Text style={styles.actionBtnText}>🚑 Start Trip</Text>
          }
        </TouchableOpacity>
      );
    }

    if (booking.status === 'in_progress') {
      return (
        <TouchableOpacity
          style={[styles.actionBtn, styles.completeBtn, { alignSelf: 'flex-start' }]}
          onPress={() => handleAction(booking._id, 'completed')}
          disabled={actioningId === booking._id}
        >
          {actioningId === booking._id
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Text style={styles.actionBtnText}>✔ Complete Trip</Text>
          }
        </TouchableOpacity>
      );
    }

    return null;
  };

  const renderBooking = ({ item }) => (
    <View style={[styles.card, Shadow.medium]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.emergencyBadge}>
          <MaterialCommunityIcons name="ambulance" size={14} color={Colors.white} />
          <Text style={styles.emergencyText}>{item.emergencyType?.toUpperCase() || 'GENERAL'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '22', borderColor: STATUS_COLOR[item.status] }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
        </View>
      </View>

      {/* Patient info */}
      <View style={styles.infoRow}>
        <MaterialCommunityIcons name="account" size={16} color={Colors.secondary} />
        <Text style={styles.infoText}>
          {item.patientDetails?.name || 'Patient'}{item.patientDetails?.age ? `, ${item.patientDetails.age}y` : ''}
        </Text>
      </View>

      {/* Blood group */}
      {item.patientDetails?.bloodGroup && item.patientDetails.bloodGroup !== 'unknown' ? (
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="water" size={16} color="#E53935" />
          <Text style={styles.infoLabel}>Blood Group</Text>
          <View style={styles.bloodBadge}>
            <Text style={styles.bloodBadgeText}>{item.patientDetails.bloodGroup}</Text>
          </View>
        </View>
      ) : null}

      {/* Emergency contact */}
      {(item.patientDetails?.emergencyContact?.name || item.patientDetails?.emergencyContact?.phone) ? (
        <View style={styles.emergencyContactBox}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="phone-alert" size={16} color="#E53935" />
            <Text style={[styles.infoLabel, { color: '#E53935' }]}>Emergency Contact</Text>
          </View>
          {item.patientDetails.emergencyContact.name ? (
            <View style={[styles.infoRow, { marginLeft: 24 }]}>
              <MaterialCommunityIcons name="account-alert" size={14} color={Colors.textSecondary} />
              <Text style={styles.infoText}>{item.patientDetails.emergencyContact.name}</Text>
            </View>
          ) : null}
          {item.patientDetails.emergencyContact.phone ? (
            <View style={[styles.infoRow, { marginLeft: 24 }]}>
              <MaterialCommunityIcons name="phone" size={14} color={Colors.textSecondary} />
              <Text style={styles.infoText}>{item.patientDetails.emergencyContact.phone}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Pickup */}
      <View style={styles.infoRow}>
        <MaterialCommunityIcons name="map-marker" size={16} color={Colors.primary} />
        <Text style={styles.infoText} numberOfLines={2}>{item.pickupLocation?.address || 'N/A'}</Text>
      </View>

      {/* Drop */}
      {item.dropLocation?.address ? (
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="hospital-marker" size={16} color={Colors.success} />
          <Text style={styles.infoText} numberOfLines={1}>{item.dropLocation.address}</Text>
        </View>
      ) : null}

      {/* User contact */}
      {item.user?.phone ? (
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="phone" size={16} color={Colors.textSecondary} />
          <Text style={styles.infoText}>{item.user.phone}</Text>
        </View>
      ) : null}

      {/* Fare */}
      <View style={styles.fareRow}>
        <Text style={styles.fareLabel}>Fare</Text>
        <Text style={styles.fareValue}>₹{item.fare?.total?.toFixed(0) || 0}</Text>
      </View>

      {/* Action buttons */}
      {renderActionButtons(item)}
    </View>
  );

  const TAB_ITEMS = [
    { key: 'pending', label: 'Requests', icon: 'bell-ring' },
    { key: 'active',  label: 'Active',   icon: 'car-emergency' },
    { key: 'history', label: 'History',  icon: 'history' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={Colors.secondary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Driver Dashboard</Text>
          <Text style={styles.headerSub}>Welcome, {user?.name || 'Driver'}</Text>
        </View>
        <View style={[styles.onlineDot, { backgroundColor: Colors.success }]} />
      </View>

      {/* Ambulance info card */}
      {ambulance && (
        <View style={styles.ambCard}>
          <MaterialCommunityIcons name="ambulance" size={28} color={Colors.secondary} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <Text style={styles.ambVehicle}>{ambulance.vehicleNumber}</Text>
            <Text style={styles.ambType}>{ambulance.type?.toUpperCase()} • {ambulance.currentLocation?.address || 'Location unknown'}</Text>
          </View>
          <View style={[styles.availDot, { backgroundColor: ambulance.isAvailable ? Colors.success : Colors.statusRejected }]}>
            <Text style={styles.availText}>{ambulance.isAvailable ? 'Available' : 'Busy'}</Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TAB_ITEMS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <MaterialCommunityIcons
              name={t.icon}
              size={18}
              color={tab === t.key ? Colors.secondary : Colors.textMuted}
            />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="clipboard-check-outline" size={56} color={Colors.border} />
          <Text style={styles.emptyText}>
            {tab === 'pending' ? 'No new booking requests' : tab === 'active' ? 'No active trips' : 'No history yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item._id}
          renderItem={renderBooking}
          contentContainerStyle={styles.list}
          onRefresh={loadData}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.secondary, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  onlineDot:   { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.white },

  ambCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, marginHorizontal: Spacing.md,
    marginTop: Spacing.md, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.light,
  },
  ambVehicle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  ambType:    { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  availDot:   { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  availText:  { fontSize: 11, fontWeight: '700', color: Colors.white },

  tabBar: {
    flexDirection: 'row', backgroundColor: Colors.white,
    marginHorizontal: Spacing.md, marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadow.light,
  },
  tab:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, gap: 4 },
  tabActive:   { borderBottomWidth: 3, borderBottomColor: Colors.secondary },
  tabText:     { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  tabTextActive:{ color: Colors.secondary },

  list:  { padding: Spacing.md, gap: Spacing.sm },
  center:{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyText: { marginTop: Spacing.md, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },

  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md, gap: Spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emergencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  emergencyText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  statusBadge:  {
    borderRadius: BorderRadius.full, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  statusText:   { fontSize: 11, fontWeight: '700' },

  infoRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoText: { flex: 1, fontSize: 13, color: Colors.text },
  infoLabel:{ fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  bloodBadge: {
    backgroundColor: '#FFEBEE', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 2, borderWidth: 1, borderColor: '#E53935',
  },
  bloodBadgeText: { fontSize: 12, fontWeight: '800', color: '#E53935' },

  emergencyContactBox: {
    backgroundColor: '#FFF8F8', borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: '#FFCDD2', padding: Spacing.sm, gap: 4,
  },

  fareRow:  { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing.sm },
  fareLabel:{ fontSize: 13, color: Colors.textSecondary },
  fareValue:{ fontSize: 15, fontWeight: '800', color: Colors.secondary },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: BorderRadius.md, paddingVertical: 10,
  },
  acceptBtn:   { backgroundColor: Colors.success },
  rejectBtn:   { backgroundColor: Colors.statusRejected },
  startBtn:    { backgroundColor: Colors.secondary, flex: 0, paddingHorizontal: Spacing.lg },
  completeBtn: { backgroundColor: Colors.accent,    flex: 0, paddingHorizontal: Spacing.lg },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
