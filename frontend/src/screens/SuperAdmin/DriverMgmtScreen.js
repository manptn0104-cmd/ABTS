import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SA from '../../api/superAdmin';
import { Colors } from '../../theme';

const TEAL = '#00695C';
const DRIVER_ACTIONS = [
  { key: 'verify',   label: 'Verify License', color: '#1565C0', icon: 'shield-check' },
  { key: 'activate', label: 'Activate',        color: '#2E7D32', icon: 'check-circle-outline' },
  { key: 'suspend',  label: 'Suspend',         color: '#B71C1C', icon: 'account-cancel' },
];

function DriverCard({ driver, onAction }) {
  const suspended = driver.isBlocked;
  const verified  = driver.licenseVerified;
  const online    = driver.isOnline;
  const amb       = driver.ambulance;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="steering" size={20} color={TEAL} />
        <Text style={styles.cardTitle} numberOfLines={1}>{driver.name}</Text>
        {suspended && <View style={[styles.badge, { backgroundColor: '#B71C1C22', borderColor: '#B71C1C' }]}><Text style={[styles.badgeText, { color: '#B71C1C' }]}>Suspended</Text></View>}
        {!suspended && online && <View style={[styles.badge, { backgroundColor: '#2E7D3222', borderColor: '#2E7D32' }]}><Text style={[styles.badgeText, { color: '#2E7D32' }]}>Online</Text></View>}
        {!suspended && !online && <View style={[styles.badge, { backgroundColor: '#75757522', borderColor: '#757575' }]}><Text style={[styles.badgeText, { color: '#757575' }]}>Offline</Text></View>}
      </View>
      <Text style={styles.cardSub}>{driver.email} · {driver.phone}</Text>
      <View style={styles.verifyRow}>
        <MaterialCommunityIcons name={verified ? 'shield-check' : 'shield-alert'} size={14} color={verified ? '#2E7D32' : '#F57F17'} />
        <Text style={[styles.cardSub, { color: verified ? '#2E7D32' : '#F57F17', marginLeft: 4 }]}>
          License: {verified ? 'Verified' : 'Pending Verification'}
        </Text>
      </View>
      {amb && (
        <Text style={styles.cardSub}>Ambulance: {amb.vehicleNumber} ({amb.type})</Text>
      )}
      <Text style={styles.cardSub}>Joined: {new Date(driver.createdAt).toLocaleDateString()}</Text>
      <TouchableOpacity style={styles.actionBtn} onPress={() => onAction(driver)}>
        <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={16} color={TEAL} />
        <Text style={[styles.actionText, { color: TEAL }]}>Actions</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DriverMgmtScreen() {
  const [drivers,  setDrivers]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (status) q.set('status', status);
      const res = await SA.getDrivers(q.toString() ? `?${q}` : '');
      if (res.success) { setDrivers(res.drivers); setTotal(res.total); }
    } finally { setLoading(false); setRefresh(false); }
  }, [search, status]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action) => {
    const res = await SA.updateDriverStatus(selected._id, action);
    if (res.success) { Alert.alert('Done', res.message); setSelected(null); load(); }
    else Alert.alert('Error', res.message);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Drivers ({total})</Text>
      </View>

      <View style={styles.filterRow}>
        <TextInput style={styles.searchInput} placeholder="Search driver..." value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['', 'active', 'online', 'suspended', 'pending'].map((s) => (
            <TouchableOpacity key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}>
              <Text style={[styles.chipText, status === s && { color: Colors.white }]}>{s || 'All'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator size="large" color={TEAL} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={drivers}
          keyExtractor={(i) => i._id}
          renderItem={({ item }) => <DriverCard driver={item} onAction={(d) => setSelected(d)} />}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[TEAL]} />}
          ListEmptyComponent={<Text style={styles.empty}>No drivers found.</Text>}
        />
      )}

      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{selected?.name}</Text>
            <Text style={styles.modalSub}>{selected?.email} · {selected?.phone}</Text>
            <Text style={styles.modalSub}>License: {selected?.licenseVerified ? '✅ Verified' : '⚠️ Pending'}</Text>
            <Text style={styles.modalSub}>Status: {selected?.isBlocked ? 'Suspended' : 'Active'}</Text>
            <View style={{ gap: 8, marginTop: 16 }}>
              {DRIVER_ACTIONS.map(({ key, label, color, icon }) => (
                <TouchableOpacity key={key} style={[styles.actionRow, { backgroundColor: color + '11' }]} onPress={() => doAction(key)}>
                  <MaterialCommunityIcons name={icon} size={20} color={color} />
                  <Text style={[styles.actionRowText, { color }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.border, marginTop: 16, alignSelf: 'flex-end' }]} onPress={() => setSelected(null)}>
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
  header:        { padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle:   { fontSize: 18, fontWeight: '700', color: Colors.text },
  filterRow:     { padding: 12, backgroundColor: Colors.surface },
  searchInput:   { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, fontSize: 14 },
  chip:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.border, marginRight: 6 },
  chipActive:    { backgroundColor: TEAL },
  chipText:      { fontSize: 12, color: Colors.text },
  card:          { backgroundColor: Colors.surface, borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle:     { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  cardSub:       { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  verifyRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  badge:         { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:     { fontSize: 10, fontWeight: '600' },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  actionText:    { fontSize: 13, fontWeight: '600' },
  overlay:       { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:    { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalSub:      { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  actionRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8 },
  actionRowText: { fontSize: 15, fontWeight: '600' },
  btn:           { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  empty:         { textAlign: 'center', color: Colors.textMuted, marginTop: 40 },
});
