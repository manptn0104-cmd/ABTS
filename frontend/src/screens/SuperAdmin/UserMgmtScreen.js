import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SA from '../../api/superAdmin';
import { Colors } from '../../theme';

const BLUE = '#1565C0';
const ACTIONS = [
  { key: 'activate', label: 'Activate',   color: '#2E7D32', icon: 'check-circle-outline' },
  { key: 'block',    label: 'Block',      color: '#B71C1C', icon: 'account-cancel' },
  { key: 'unblock',  label: 'Unblock',    color: '#F57F17', icon: 'account-check' },
  { key: 'deactivate',label:'Deactivate', color: '#757575', icon: 'account-off' },
];

function UserCard({ user, onAction, onHistory }) {
  const blocked   = user.isBlocked;
  const inactive  = !user.isActive;
  const statusColor = blocked ? '#B71C1C' : inactive ? '#757575' : '#2E7D32';
  const statusLabel = blocked ? 'Blocked' : inactive ? 'Inactive' : 'Active';
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="account-circle" size={20} color={BLUE} />
        <Text style={styles.cardTitle} numberOfLines={1}>{user.name}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={styles.cardSub}>{user.email}</Text>
      <Text style={styles.cardSub}>{user.phone}</Text>
      <Text style={styles.cardSub}>Joined: {new Date(user.createdAt).toLocaleDateString()}</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onHistory(user)}>
          <MaterialCommunityIcons name="clipboard-list-outline" size={16} color={BLUE} />
          <Text style={[styles.actionText, { color: BLUE }]}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onAction(user)}>
          <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={16} color={Colors.warning} />
          <Text style={[styles.actionText, { color: Colors.warning }]}>Actions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function UserMgmtScreen({ navigation }) {
  const [users,    setUsers]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [selected, setSelected] = useState(null);
  const [modal,    setModal]    = useState(null); // 'action' | 'history'
  const [bookings, setBookings] = useState([]);
  const [bhLoading,setBhLoading]= useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (status) q.set('status', status);
      const res = await SA.getUsers(q.toString() ? `?${q}` : '');
      if (res.success) { setUsers(res.users); setTotal(res.total); }
    } finally { setLoading(false); setRefresh(false); }
  }, [search, status]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action) => {
    const res = await SA.updateUserStatus(selected._id, action);
    if (res.success) { Alert.alert('Done', res.message); setModal(null); load(); }
    else Alert.alert('Error', res.message);
  };

  const openHistory = async (user) => {
    setSelected(user); setModal('history'); setBhLoading(true);
    const res = await SA.getUserBookings(user._id);
    if (res.success) setBookings(res.bookings);
    setBhLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Users ({total})</Text>
        <TouchableOpacity
          style={styles.driversBtn}
          onPress={() => navigation.navigate('SADrivers')}
        >
          <MaterialCommunityIcons name="steering" size={16} color={BLUE} />
          <Text style={[styles.actionText, { color: BLUE }]}>Drivers</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <TextInput style={styles.searchInput} placeholder="Search name/email/phone..." value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['', 'active', 'blocked', 'inactive'].map((s) => (
            <TouchableOpacity key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}>
              <Text style={[styles.chipText, status === s && { color: Colors.white }]}>{s || 'All'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator size="large" color={BLUE} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={users}
          keyExtractor={(i) => i._id}
          renderItem={({ item }) => (
            <UserCard user={item} onAction={(u) => { setSelected(u); setModal('action'); }} onHistory={openHistory} />
          )}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[BLUE]} />}
          ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
        />
      )}

      {/* Action Modal */}
      <Modal visible={modal === 'action'} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{selected?.name}</Text>
            <Text style={styles.modalSub}>{selected?.email}</Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              {ACTIONS.map(({ key, label, color, icon }) => (
                <TouchableOpacity key={key} style={[styles.actionRow, { backgroundColor: color + '11' }]} onPress={() => doAction(key)}>
                  <MaterialCommunityIcons name={icon} size={20} color={color} />
                  <Text style={[styles.actionRowText, { color }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.border, marginTop: 16, alignSelf: 'flex-end' }]} onPress={() => setModal(null)}>
              <Text>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal visible={modal === 'history'} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Booking History — {selected?.name}</Text>
            {bhLoading ? <ActivityIndicator color={BLUE} style={{ margin: 20 }} /> : (
              <FlatList
                data={bookings}
                keyExtractor={(i) => i._id}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => (
                  <View style={styles.bRow}>
                    <Text style={styles.bTitle}>{item.ambulance?.vehicleNumber || '—'} ({item.ambulance?.type})</Text>
                    <Text style={styles.bSub}>{item.pickupLocation?.address}</Text>
                    <Text style={styles.bSub}>Status: {item.status}  Fare: ₹{item.fare?.total || 0}</Text>
                    <Text style={styles.bSub}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.empty}>No bookings yet.</Text>}
              />
            )}
            <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.border, marginTop: 12, alignSelf: 'flex-end' }]} onPress={() => setModal(null)}>
              <Text>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.background },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle:   { fontSize: 18, fontWeight: '700', color: Colors.text },
  driversBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BLUE + '18', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterRow:     { padding: 12, backgroundColor: Colors.surface },
  searchInput:   { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, fontSize: 14 },
  chip:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.border, marginRight: 6 },
  chipActive:    { backgroundColor: BLUE },
  chipText:      { fontSize: 12, color: Colors.text },
  card:          { backgroundColor: Colors.surface, borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle:     { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  cardSub:       { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  badge:         { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:     { fontSize: 10, fontWeight: '600' },
  cardActions:   { flexDirection: 'row', gap: 20, marginTop: 10 },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText:    { fontSize: 13, fontWeight: '600' },
  overlay:       { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:    { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalSub:      { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  actionRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8 },
  actionRowText: { fontSize: 15, fontWeight: '600' },
  btn:           { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  bRow:          { borderBottomWidth: 1, borderBottomColor: Colors.divider, paddingVertical: 8 },
  bTitle:        { fontSize: 13, fontWeight: '700', color: Colors.text },
  bSub:          { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  empty:         { textAlign: 'center', color: Colors.textMuted, marginTop: 20 },
});
