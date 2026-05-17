import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, FlatList, TextInput,
  Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
import { logout } from '../../store/authSlice';
import { Colors, Spacing } from '../../theme';
import { API_BASE_URL } from '../../utils/constants';

const TABS = ['Overview', 'Bookings', 'Users', 'Ambulances'];

const STATUS_COLOR = {
  pending:     '#F57F17',
  confirmed:   '#1565C0',
  in_progress: '#00897B',
  completed:   '#2E7D32',
  cancelled:   '#757575',
  rejected:    '#B71C1C',
};

async function adminFetch(path) {
  const token = await AsyncStorage.getItem('abts_token');
  const res   = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function adminPost(path, body) {
  const token = await AsyncStorage.getItem('abts_token');
  const res   = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function adminDelete(path) {
  const token = await AsyncStorage.getItem('abts_token');
  const res   = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function adminPatch(path, body) {
  const token = await AsyncStorage.getItem('abts_token');
  const res   = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <MaterialCommunityIcons name={icon} size={28} color={color} style={{ marginBottom: 6 }} />
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────────
function OverviewTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const res = await adminFetch('/admin/stats');
      if (res.success) setData(res);
    } finally {
      setLoading(false); setRefresh(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  const s = data?.stats || {};
  return (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[Colors.primary]} />}
    >
      <Text style={styles.sectionHeading}>System Overview</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="account-multiple" label="Patients"    value={s.totalUsers}        color="#1565C0" />
        <StatCard icon="steering"          label="Drivers"     value={s.totalDrivers}       color="#00897B" />
        <StatCard icon="ambulance"         label="Ambulances"  value={s.totalAmbulances}    color={Colors.primary} />
        <StatCard icon="check-circle"      label="Available"   value={s.availableAmbulances} color="#2E7D32" />
        <StatCard icon="clipboard-list"    label="Bookings"    value={s.totalBookings}      color="#7B1FA2" />
        <StatCard icon="clock-outline"     label="Pending"     value={s.pendingBookings}    color="#F57F17" />
        <StatCard icon="flag-checkered"    label="Completed"   value={s.completedBookings}  color="#2E7D32" />
        <StatCard icon="currency-inr"      label="Revenue"     value={`₹${(s.totalRevenue || 0).toLocaleString()}`} color="#C62828" />
      </View>

      <Text style={styles.sectionHeading}>Recent Bookings</Text>
      {(data?.recentBookings || []).map((b) => (
        <View key={b._id} style={styles.recentRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recentName}>{b.user?.name || 'Unknown'}</Text>
            <Text style={styles.recentSub}>{b.ambulance?.vehicleNumber} · {b.pickupLocation?.address}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[b.status] + '22' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[b.status] }]}>{b.status}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ── Re-assign Modal ────────────────────────────────────────────────────────────
function ReassignModal({ booking, visible, onClose, onReassigned }) {
  const [ambulances, setAmbulances] = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => {
    if (!visible) return;
    setSelected(null); setError('');
    setLoading(true);
    adminFetch('/admin/ambulances').then((res) => {
      if (res.success) setAmbulances(res.ambulances.filter((a) => a.isAvailable));
    }).finally(() => setLoading(false));
  }, [visible]);

  const handleReassign = async () => {
    if (!selected) { setError('Please select an ambulance.'); return; }
    setSaving(true); setError('');
    try {
      const res = await adminPatch(`/admin/bookings/${booking._id}/reassign`, { ambulanceId: selected });
      if (res.success) { onReassigned(res.booking); onClose(); }
      else setError(res.message || 'Reassign failed.');
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Re-assign Booking</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {booking ? (
            <View style={styles.reassignInfo}>
              <Text style={styles.reassignInfoText}>Patient: {booking.user?.name}</Text>
              <Text style={styles.reassignInfoText}>Pickup: {booking.pickupLocation?.address}</Text>
              <Text style={[styles.reassignInfoText, { color: STATUS_COLOR.rejected, fontWeight: '700' }]}>
                Previously rejected{booking.rejectionReason ? `: "${booking.rejectionReason}"` : ''}
              </Text>
            </View>
          ) : null}

          <Text style={styles.inputLabel}>Select Available Ambulance</Text>
          {error ? <Text style={styles.modalError}>{error}</Text> : null}

          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : ambulances.length === 0 ? (
            <Text style={styles.emptyText}>No available ambulances right now.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {ambulances.map((a) => (
                <TouchableOpacity
                  key={a._id}
                  style={[styles.ambSelectRow, selected === a._id && styles.ambSelectRowActive]}
                  onPress={() => setSelected(a._id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ambSelectVehicle}>{a.vehicleNumber}</Text>
                    <Text style={styles.ambSelectSub}>{a.driverName} · {a.type} · ₹{a.basePrice}+{a.pricePerKm}/km</Text>
                  </View>
                  {selected === a._id && (
                    <MaterialCommunityIcons name="check-circle" size={22} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, { marginTop: 14 }]}
            onPress={handleReassign}
            disabled={saving || loading}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Reassign to Selected Ambulance</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Bookings Tab ───────────────────────────────────────────────────────────────
function BookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refresh, setRefresh]   = useState(false);
  const [filter, setFilter]     = useState('');
  const [reassignTarget, setReassignTarget] = useState(null); // booking to reassign

  const FILTER_OPTIONS = ['', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'];

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const q = filter ? `?status=${filter}` : '';
      const res = await adminFetch(`/admin/bookings${q}`);
      if (res.success) setBookings(res.bookings);
    } finally { setLoading(false); setRefresh(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleReassigned = (updatedBooking) => {
    setBookings((prev) => prev.map((b) => b._id === updatedBooking._id ? updatedBooking : b));
  };

  const STATUS_CHIP_COLOR = {
    '':          Colors.primary,
    pending:     '#F57F17',
    confirmed:   '#1565C0',
    in_progress: '#00897B',
    completed:   '#2E7D32',
    cancelled:   '#757575',
    rejected:    '#B71C1C',
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Filter chips */}
      <View style={styles.filterBar}>
        {FILTER_OPTIONS.map((s) => {
          const chipColor = STATUS_CHIP_COLOR[s];
          const isActive  = filter === s;
          return (
            <TouchableOpacity
              key={s}
              style={[
                styles.filterChip,
                isActive && { backgroundColor: chipColor, borderColor: chipColor },
              ]}
              onPress={() => setFilter(s)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {s === '' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b._id}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[Colors.primary]} />}
          contentContainerStyle={styles.tabContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No bookings found.</Text>}
          renderItem={({ item: b }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{b.user?.name || 'Unknown Patient'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[b.status], borderColor: STATUS_COLOR[b.status] }]}>
                  <Text style={styles.statusTextWhite}>
                    {b.status === 'in_progress' ? 'In Progress' : b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSub}>📞 {b.user?.phone}  ·  {b.ambulance?.vehicleNumber}</Text>
              <Text style={styles.cardSub}>🚑 Driver: {b.ambulance?.driverName}</Text>
              <Text style={styles.cardSub}>📍 {b.pickupLocation?.address}</Text>
              <Text style={styles.cardSub}>🕐 {new Date(b.createdAt).toLocaleString('en-IN')}</Text>
              {b.estimatedFare ? <Text style={styles.cardSub}>💰 ₹{b.estimatedFare}</Text> : null}
              {b.rejectionReason ? (
                <Text style={[styles.cardSub, { color: STATUS_COLOR.rejected }]}>
                  ✗ Reason: {b.rejectionReason}
                </Text>
              ) : null}

              {/* Re-assign button — only for rejected bookings */}
              {b.status === 'rejected' && (
                <TouchableOpacity
                  style={styles.reassignBtn}
                  onPress={() => setReassignTarget(b)}
                >
                  <MaterialCommunityIcons name="ambulance" size={15} color="#fff" />
                  <Text style={styles.reassignBtnText}>Re-assign to New Driver</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      <ReassignModal
        visible={!!reassignTarget}
        booking={reassignTarget}
        onClose={() => setReassignTarget(null)}
        onReassigned={handleReassigned}
      />
    </View>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [filter, setFilter]   = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const q = filter ? `?role=${filter}` : '';
      const res = await adminFetch(`/admin/users${q}`);
      if (res.success) setUsers(res.users);
    } finally { setLoading(false); setRefresh(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filterBar}>
        {['', 'user', 'driver'].map((r) => {
          const chipColor = r === 'driver' ? '#00897B' : Colors.primary;
          const isActive  = filter === r;
          return (
            <TouchableOpacity
              key={r}
              style={[
                styles.filterChip,
                isActive && { backgroundColor: chipColor, borderColor: chipColor },
              ]}
              onPress={() => setFilter(r)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {r ? r.charAt(0).toUpperCase() + r.slice(1) : 'All'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u._id}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[Colors.primary]} />}
          contentContainerStyle={styles.tabContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
          renderItem={({ item: u }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{u.name}</Text>
                <View style={[styles.roleBadge, u.role === 'driver' ? styles.roleBadgeDriver : styles.roleBadgeUser]}>
                  <Text style={styles.roleText}>{u.role}</Text>
                </View>
              </View>
              <Text style={styles.cardSub}>📧 {u.email}</Text>
              <Text style={styles.cardSub}>📞 {u.phone}</Text>
              <Text style={styles.cardSub}>🗓 Joined: {new Date(u.createdAt).toLocaleDateString('en-IN')}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ── Ambulances Tab ─────────────────────────────────────────────────────────────
const AMBULANCE_TYPES = ['basic', 'advanced', 'icu', 'neonatal'];
const SPECIALIZATIONS = ['accident', 'cardiac', 'respiratory', 'trauma', 'maternity', 'general', 'other'];
const TYPE_COLOR = { basic: '#1565C0', advanced: '#7B1FA2', icu: '#C62828', neonatal: '#00897B' };

const BLANK_FORM = {
  vehicleNumber: '', driverName: '', driverPhone: '', driverLicense: '',
  ownerId: '', type: 'basic', pricePerKm: '15', basePrice: '300',
  specializations: ['general'],
};

function RegisterModal({ visible, drivers, onClose, onSaved }) {
  const [form, setForm]       = useState(BLANK_FORM);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const toggleSpec = (s) =>
    setForm((f) => ({
      ...f,
      specializations: f.specializations.includes(s)
        ? f.specializations.filter((x) => x !== s)
        : [...f.specializations, s],
    }));

  const handleSave = async () => {
    if (!form.vehicleNumber.trim() || !form.driverName.trim() || !form.driverPhone.trim() ||
        !form.driverLicense.trim() || !form.ownerId) {
      setError('All fields are required. Please select a driver.');
      return;
    }
    setSaving(true); setError('');
    try {
      const res = await adminPost('/admin/ambulances', {
        ...form,
        pricePerKm: parseFloat(form.pricePerKm) || 15,
        basePrice:  parseFloat(form.basePrice)  || 300,
      });
      if (res.success) {
        setForm(BLANK_FORM);
        onSaved();
        onClose();
      } else {
        setError(res.message || 'Failed to register ambulance.');
      }
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Register New Ambulance</Text>
            <TouchableOpacity onPress={onClose}><MaterialCommunityIcons name="close" size={22} color={Colors.text} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {error ? <Text style={styles.modalError}>{error}</Text> : null}

            {[
              { key: 'vehicleNumber',  label: 'Vehicle Number (e.g. KA14AMB009)', upper: true },
              { key: 'driverName',     label: 'Driver Name' },
              { key: 'driverPhone',    label: 'Driver Phone (10 digits)', kb: 'phone-pad' },
              { key: 'driverLicense',  label: 'Driver License Number' },
              { key: 'pricePerKm',     label: 'Price per km (₹)', kb: 'numeric' },
              { key: 'basePrice',      label: 'Base Price (₹)', kb: 'numeric' },
            ].map(({ key, label, upper, kb }) => (
              <View key={key} style={{ marginBottom: 10 }}>
                <Text style={styles.inputLabel}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={form[key]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [key]: upper ? v.toUpperCase() : v }))}
                  keyboardType={kb || 'default'}
                  placeholderTextColor={Colors.textMuted}
                  placeholder={label}
                />
              </View>
            ))}

            {/* Assign Driver */}
            <Text style={styles.inputLabel}>Assign Driver Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {drivers.map((d) => (
                <TouchableOpacity
                  key={d._id}
                  style={[styles.driverChip, form.ownerId === d._id && styles.driverChipActive]}
                  onPress={() => setForm((f) => ({ ...f, ownerId: d._id }))}
                >
                  <Text style={[styles.driverChipText, form.ownerId === d._id && styles.driverChipTextActive]} numberOfLines={1}>
                    {d.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Type */}
            <Text style={styles.inputLabel}>Ambulance Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {AMBULANCE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, form.type === t && { backgroundColor: TYPE_COLOR[t], borderColor: TYPE_COLOR[t] }]}
                  onPress={() => setForm((f) => ({ ...f, type: t }))}
                >
                  <Text style={[styles.typeChipText, form.type === t && { color: '#fff' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Specializations */}
            <Text style={styles.inputLabel}>Specializations</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {SPECIALIZATIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.typeChip, form.specializations.includes(s) && styles.typeChipActive]}
                  onPress={() => toggleSpec(s)}
                >
                  <Text style={[styles.typeChipText, form.specializations.includes(s) && { color: '#fff' }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Register Ambulance</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AmbulancesTab() {
  const [ambulances, setAmbulances] = useState([]);
  const [drivers, setDrivers]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refresh, setRefresh]       = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [actionId, setActionId]     = useState(null); // id currently being acted on

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const [ambRes, drvRes] = await Promise.all([
        adminFetch('/admin/ambulances'),
        adminFetch('/admin/users?role=driver'),
      ]);
      if (ambRes.success) setAmbulances(ambRes.ambulances);
      if (drvRes.success) setDrivers(drvRes.users);
    } finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id) => {
    setActionId(id);
    try {
      const res = await adminPatch(`/admin/ambulances/${id}/availability`, {});
      if (res.success) {
        setAmbulances((prev) => prev.map((a) => a._id === id ? { ...a, isAvailable: res.isAvailable } : a));
      }
    } finally { setActionId(null); }
  };

  const handleDeregister = async (id, vehicleNumber) => {
    const ok = Platform.OS === 'web'
      ? window.confirm(`Deregister ambulance ${vehicleNumber}?\n\nThis action cannot be undone.`)
      : true;
    if (!ok) return;
    setActionId(id);
    try {
      const res = await adminDelete(`/admin/ambulances/${id}`);
      if (res.success) setAmbulances((prev) => prev.filter((a) => a._id !== id));
      else window.alert && window.alert(res.message || 'Failed to deregister.');
    } finally { setActionId(null); }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Register button */}
      <View style={styles.ambHeader}>
        <Text style={styles.ambCount}>{ambulances.length} Ambulance{ambulances.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity style={styles.registerBtn} onPress={() => setShowModal(true)}>
          <MaterialCommunityIcons name="plus" size={16} color="#fff" />
          <Text style={styles.registerBtnText}>Register New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={ambulances}
          keyExtractor={(a) => a._id}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[Colors.primary]} />}
          contentContainerStyle={styles.tabContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No ambulances registered.</Text>}
          renderItem={({ item: a }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{a.vehicleNumber}</Text>
                <View style={[styles.statusBadge, { backgroundColor: (TYPE_COLOR[a.type] || Colors.primary) + '22' }]}>
                  <Text style={[styles.statusText, { color: TYPE_COLOR[a.type] || Colors.primary }]}>{a.type}</Text>
                </View>
              </View>
              <Text style={styles.cardSub}>🧑‍✈️ {a.driverName}  ·  📞 {a.driverPhone}</Text>
              <Text style={styles.cardSub}>📍 {a.currentLocation?.address}</Text>
              <Text style={styles.cardSub}>⭐ {a.rating?.average?.toFixed(1)} ({a.rating?.count} reviews)</Text>
              <Text style={styles.cardSub}>💰 Base ₹{a.basePrice}  ·  ₹{a.pricePerKm}/km</Text>

              {/* Action row */}
              <View style={styles.ambActions}>
                <TouchableOpacity
                  style={[styles.toggleBtn, a.isAvailable ? styles.toggleBtnActive : styles.toggleBtnInactive]}
                  onPress={() => handleToggle(a._id)}
                  disabled={actionId === a._id}
                >
                  {actionId === a._id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name={a.isAvailable ? 'check-circle' : 'close-circle'}
                        size={14} color="#fff"
                      />
                      <Text style={styles.toggleBtnText}>
                        {a.isAvailable ? 'Available' : 'Unavailable'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deregisterBtn}
                  onPress={() => handleDeregister(a._id, a.vehicleNumber)}
                  disabled={actionId === a._id}
                >
                  <MaterialCommunityIcons name="delete-outline" size={14} color={Colors.error} />
                  <Text style={styles.deregisterBtnText}>Deregister</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <RegisterModal
        visible={showModal}
        drivers={drivers}
        onClose={() => setShowModal(false)}
        onSaved={() => load(true)}
      />
    </View>
  );
}

// ── Main Admin Dashboard ───────────────────────────────────────────────────────
export default function AdminDashboardScreen() {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState(0);

  const TAB_ICONS = ['view-dashboard', 'clipboard-list', 'account-multiple', 'ambulance'];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="shield-account" size={22} color={Colors.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Admin Panel</Text>
            <Text style={styles.headerSub}>ABTS Management</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(logout())}>
          <MaterialCommunityIcons name="logout" size={20} color={Colors.white} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <MaterialCommunityIcons
              name={TAB_ICONS[i]}
              size={18}
              color={activeTab === i ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 0 && <OverviewTab />}
        {activeTab === 1 && <BookingsTab />}
        {activeTab === 2 && <UsersTab />}
        {activeTab === 3 && <AmbulancesTab />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon:  { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  logoutBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  logoutText:  { fontSize: 13, color: Colors.white, fontWeight: '600' },

  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab:    { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText:   { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: Colors.primary },

  filterBar:            { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  filterChip:           { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border },
  filterChipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText:       { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: '#ffffff', fontWeight: '700' },

  tabContent: { padding: Spacing.md, paddingBottom: 40 },

  sectionHeading: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, marginTop: 4 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.lg },
  statCard: {
    width: '47%', backgroundColor: Colors.surface, borderRadius: 12,
    padding: 14, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  recentRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 10,
    padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  recentName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  recentSub:  { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  card: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 },
  cardSub:    { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },

  statusBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:       { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statusTextWhite:  { fontSize: 11, fontWeight: '700', color: '#ffffff' },

  roleBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  roleBadgeUser:   { backgroundColor: '#1565C022' },
  roleBadgeDriver: { backgroundColor: '#2E7D3222' },
  roleText:        { fontSize: 11, fontWeight: '700', textTransform: 'capitalize', color: Colors.text },

  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 14 },

  // Ambulance tab
  ambHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  ambCount:        { fontSize: 14, fontWeight: '700', color: Colors.text },
  registerBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  registerBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  ambActions:      { flexDirection: 'row', gap: 8, marginTop: 10 },
  toggleBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, minWidth: 100 },
  toggleBtnActive: { backgroundColor: '#2E7D32' },
  toggleBtnInactive:{ backgroundColor: '#757575' },
  toggleBtnText:   { fontSize: 12, fontWeight: '700', color: '#fff' },
  deregisterBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.error },
  deregisterBtnText:{ fontSize: 12, fontWeight: '700', color: Colors.error },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '90%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: Colors.text },
  modalError:    { backgroundColor: '#ffebee', color: Colors.error, padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 13 },
  inputLabel:    { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:         { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, backgroundColor: Colors.background },
  driverChip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, marginRight: 8 },
  driverChipActive:    { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  driverChipText:      { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  driverChipTextActive:{ color: '#fff' },
  typeChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  typeChipActive:{ backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText:  { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', textTransform: 'capitalize' },
  saveBtn:       { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText:   { fontSize: 16, fontWeight: '800', color: '#fff' },

  // Re-assign
  reassignBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E65100', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginTop: 10, alignSelf: 'flex-start' },
  reassignBtnText:    { fontSize: 13, fontWeight: '700', color: '#fff' },
  reassignInfo:       { backgroundColor: '#FFF3E0', borderRadius: 10, padding: 10, marginBottom: 12 },
  reassignInfoText:   { fontSize: 13, color: Colors.text, marginBottom: 2 },
  ambSelectRow:       { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, backgroundColor: Colors.background },
  ambSelectRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '11' },
  ambSelectVehicle:   { fontSize: 14, fontWeight: '700', color: Colors.text },
  ambSelectSub:       { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
