import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SA from '../../api/superAdmin';
import { Colors } from '../../theme';

const RED = '#B71C1C';
const STATUS_COLOR = { active: '#2E7D32', offline: '#757575', maintenance: '#F57F17' };
const TYPE_COLOR   = { basic: '#43A047', advanced: '#1E88E5', icu: '#E53935', neonatal: '#8E24AA' };

function Badge({ label, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function DetailModal({ amb, onClose, onStatusChange }) {
  const [newStatus, setNewStatus] = useState(amb?.status || 'active');
  if (!amb) return null;
  return (
    <View style={styles.modalBox}>
      <Text style={styles.modalTitle}>{amb.vehicleNumber}</Text>
      <ScrollView style={{ maxHeight: 400 }}>
        <View style={styles.detailRow}><Text style={styles.detailKey}>Type</Text><Text style={styles.detailVal}>{amb.type}</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailKey}>Driver</Text><Text style={styles.detailVal}>{amb.driverName}</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailKey}>Driver Phone</Text><Text style={styles.detailVal}>{amb.driverPhone}</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailKey}>License</Text><Text style={styles.detailVal}>{amb.driverLicense}</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailKey}>Organization</Text><Text style={styles.detailVal}>{amb.organization?.name || 'N/A'}</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailKey}>City/State</Text><Text style={styles.detailVal}>{amb.organization?.city}, {amb.organization?.state}</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailKey}>Base Price</Text><Text style={styles.detailVal}>₹{amb.basePrice}</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailKey}>Per Km</Text><Text style={styles.detailVal}>₹{amb.pricePerKm}</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailKey}>Rating</Text><Text style={styles.detailVal}>{amb.rating?.average?.toFixed(1)} ⭐ ({amb.rating?.count} reviews)</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailKey}>Total Trips</Text><Text style={styles.detailVal}>{amb.totalTrips}</Text></View>
        {amb.insuranceExpiry && <View style={styles.detailRow}><Text style={styles.detailKey}>Insurance Expiry</Text><Text style={styles.detailVal}>{new Date(amb.insuranceExpiry).toLocaleDateString()}</Text></View>}
        {amb.registrationExpiry && <View style={styles.detailRow}><Text style={styles.detailKey}>Reg. Expiry</Text><Text style={styles.detailVal}>{new Date(amb.registrationExpiry).toLocaleDateString()}</Text></View>}

        <Text style={[styles.modalTitle, { fontSize: 14, marginTop: 12 }]}>Change Status</Text>
        {['active', 'offline', 'maintenance'].map((s) => (
          <TouchableOpacity key={s} style={[styles.statusOption, newStatus === s && { backgroundColor: STATUS_COLOR[s] + '22' }]} onPress={() => setNewStatus(s)}>
            <MaterialCommunityIcons name={newStatus === s ? 'radiobox-marked' : 'radiobox-blank'} size={18} color={STATUS_COLOR[s]} />
            <Text style={[styles.statusOptionText, { color: STATUS_COLOR[s] }]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.modalActions}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.border }]} onPress={onClose}><Text>Close</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: RED }]} onPress={() => onStatusChange(amb._id, newStatus)}>
          <Text style={{ color: Colors.white, fontWeight: '700' }}>Apply Status</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AmbulanceMgmtScreen() {
  const [ambulances, setAmbulances] = useState([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refresh,    setRefresh]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected,   setSelected]   = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search)       q.set('search', search);
      if (statusFilter) q.set('status', statusFilter);
      const res = await SA.getAmbulances(q.toString() ? `?${q}` : '');
      if (res.success) { setAmbulances(res.ambulances); setTotal(res.total); }
    } finally { setLoading(false); setRefresh(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id, status) => {
    const res = await SA.updateAmbulanceStatus(id, { status });
    if (res.success) { Alert.alert('Done', res.message); setSelected(null); load(); }
    else Alert.alert('Error', res.message);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="ambulance" size={20} color={TYPE_COLOR[item.type] || RED} />
        <Text style={styles.cardTitle}>{item.vehicleNumber}</Text>
        <Badge label={item.status || 'active'} color={STATUS_COLOR[item.status] || STATUS_COLOR.active} />
        <Badge label={item.type} color={TYPE_COLOR[item.type] || RED} />
      </View>
      <Text style={styles.cardSub}>Driver: {item.driverName} · {item.driverPhone}</Text>
      <Text style={styles.cardSub}>Org: {item.organization?.name || 'Unassigned'} | {item.organization?.city || '—'}</Text>
      <Text style={styles.cardSub}>Rating: {item.rating?.average?.toFixed(1)} ⭐  Trips: {item.totalTrips}  Base: ₹{item.basePrice}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ambulances ({total})</Text>
      </View>

      <View style={styles.filterRow}>
        <TextInput style={styles.searchInput} placeholder="Search vehicle/driver..." value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['', 'active', 'offline', 'maintenance'].map((s) => (
            <TouchableOpacity key={s} style={[styles.chip, statusFilter === s && styles.chipActive]} onPress={() => setStatusFilter(s)}>
              <Text style={[styles.chipText, statusFilter === s && { color: Colors.white }]}>{s || 'All'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator size="large" color={RED} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={ambulances}
          keyExtractor={(i) => i._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[RED]} />}
          ListEmptyComponent={<Text style={styles.empty}>No ambulances found.</Text>}
        />
      )}

      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.overlay}>
          <DetailModal amb={selected} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.background },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle:     { fontSize: 18, fontWeight: '700', color: Colors.text },
  filterRow:       { padding: 12, gap: 8, backgroundColor: Colors.surface },
  searchInput:     { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, fontSize: 14 },
  chip:            { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.border, marginRight: 6 },
  chipActive:      { backgroundColor: RED },
  chipText:        { fontSize: 12, color: Colors.text },
  card:            { backgroundColor: Colors.surface, borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2 },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  cardTitle:       { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  cardSub:         { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  badge:           { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:       { fontSize: 10, fontWeight: '600' },
  overlay:         { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:      { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  detailRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  detailKey:       { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  detailVal:       { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1.5, textAlign: 'right' },
  statusOption:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, marginBottom: 4 },
  statusOptionText:{ fontSize: 14, fontWeight: '600' },
  modalActions:    { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  btn:             { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  empty:           { textAlign: 'center', color: Colors.textMuted, marginTop: 40 },
});
