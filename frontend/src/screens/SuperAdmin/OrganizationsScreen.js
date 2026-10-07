import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SA from '../../api/superAdmin';
import { Colors } from '../../theme';

const PURPLE = '#6A1B9A';

const STATUS_COLOR = { active: '#2E7D32', suspended: '#E65100', expired: '#B71C1C', pending: '#F57F17' };

function Badge({ label, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function OrgForm({ initial = {}, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial.name || '', email: initial.email || '', phone: initial.phone || '',
    city: initial.city || '', state: initial.state || '', address: initial.address || '',
    contactPerson: initial.contactPerson || '', gstNumber: initial.gstNumber || '',
    registrationNumber: initial.registrationNumber || '', website: initial.website || '',
  });
  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const fields = [
    { key: 'name', label: 'Organization Name', required: true },
    { key: 'email', label: 'Email', required: true },
    { key: 'phone', label: 'Phone', required: true },
    { key: 'city', label: 'City', required: true },
    { key: 'state', label: 'State', required: true },
    { key: 'contactPerson', label: 'Contact Person' },
    { key: 'address', label: 'Address' },
    { key: 'gstNumber', label: 'GST Number' },
    { key: 'registrationNumber', label: 'Reg Number' },
    { key: 'website', label: 'Website' },
  ];
  return (
    <ScrollView style={{ maxHeight: 480 }}>
      {fields.map(({ key, label, required }) => (
        <View key={key} style={styles.formField}>
          <Text style={styles.formLabel}>{label}{required ? ' *' : ''}</Text>
          <TextInput style={styles.input} value={form[key]} onChangeText={set(key)} placeholder={label} />
        </View>
      ))}
      <View style={styles.modalActions}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.border }]} onPress={onClose}>
          <Text style={{ color: Colors.text }}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: PURPLE }]} onPress={() => onSave(form)}>
          <Text style={{ color: Colors.white, fontWeight: '700' }}>Save</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export default function OrganizationsScreen() {
  const [orgs,     setOrgs]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [modal,    setModal]    = useState(null); // null | 'add' | 'edit' | 'status'
  const [selected, setSelected] = useState(null);
  const [newStatus,setNewStatus]= useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (status) q.set('status', status);
      const res = await SA.getOrganizations(q.toString() ? `?${q}` : '');
      if (res.success) { setOrgs(res.organizations); setTotal(res.total); }
    } finally { setLoading(false); setRefresh(false); }
  }, [search, status]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    const res = selected
      ? await SA.updateOrganization(selected._id, form)
      : await SA.createOrganization(form);
    if (res.success) { Alert.alert('Success', res.message); setModal(null); setSelected(null); load(); }
    else Alert.alert('Error', res.message);
  };

  const handleDelete = (org) => {
    Alert.alert('Delete', `Delete "${org.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const res = await SA.deleteOrganization(org._id);
        if (res.success) load(); else Alert.alert('Error', res.message);
      }},
    ]);
  };

  const handleStatusChange = async () => {
    if (!newStatus) return;
    const res = await SA.updateOrgStatus(selected._id, newStatus);
    if (res.success) { Alert.alert('Success', res.message); setModal(null); load(); }
    else Alert.alert('Error', res.message);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="office-building" size={20} color={PURPLE} />
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        <Badge label={item.status} color={STATUS_COLOR[item.status] || Colors.textMuted} />
      </View>
      <Text style={styles.cardSub}>{item.email} · {item.phone}</Text>
      <Text style={styles.cardSub}>{item.city}, {item.state}</Text>
      {item.subscriptionPlan && (
        <Text style={styles.cardSub}>Plan: {item.subscriptionPlan.name}</Text>
      )}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => { setSelected(item); setModal('edit'); }}>
          <MaterialCommunityIcons name="pencil" size={16} color={PURPLE} /><Text style={[styles.actionText, { color: PURPLE }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => { setSelected(item); setNewStatus(item.status); setModal('status'); }}>
          <MaterialCommunityIcons name="swap-horizontal" size={16} color={Colors.warning} /><Text style={[styles.actionText, { color: Colors.warning }]}>Status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
          <MaterialCommunityIcons name="delete" size={16} color={Colors.error} /><Text style={[styles.actionText, { color: Colors.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Organizations ({total})</Text>
        <TouchableOpacity onPress={() => { setSelected(null); setModal('add'); }}>
          <MaterialCommunityIcons name="plus-circle" size={28} color={PURPLE} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <TextInput style={styles.searchInput} placeholder="Search..." value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['', 'active', 'suspended', 'expired', 'pending'].map((s) => (
            <TouchableOpacity key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}>
              <Text style={[styles.chipText, status === s && { color: Colors.white }]}>{s || 'All'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator size="large" color={PURPLE} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={orgs}
          keyExtractor={(i) => i._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[PURPLE]} />}
          ListEmptyComponent={<Text style={styles.empty}>No organizations found.</Text>}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal visible={modal === 'add' || modal === 'edit'} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{modal === 'add' ? 'Add Organization' : 'Edit Organization'}</Text>
            <OrgForm initial={selected || {}} onSave={handleSave} onClose={() => { setModal(null); setSelected(null); }} />
          </View>
        </View>
      </Modal>

      {/* Status Modal */}
      <Modal visible={modal === 'status'} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { maxHeight: 320 }]}>
            <Text style={styles.modalTitle}>Change Status — {selected?.name}</Text>
            {['active', 'suspended', 'expired', 'pending'].map((s) => (
              <TouchableOpacity key={s} style={[styles.statusOption, newStatus === s && { backgroundColor: STATUS_COLOR[s] + '22' }]} onPress={() => setNewStatus(s)}>
                <MaterialCommunityIcons name={newStatus === s ? 'radiobox-marked' : 'radiobox-blank'} size={18} color={STATUS_COLOR[s]} />
                <Text style={[styles.statusOptionText, { color: STATUS_COLOR[s] }]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.border }]} onPress={() => setModal(null)}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: PURPLE }]} onPress={handleStatusChange}>
                <Text style={{ color: Colors.white, fontWeight: '700' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  chipActive:      { backgroundColor: PURPLE },
  chipText:        { fontSize: 12, color: Colors.text },
  card:            { backgroundColor: Colors.surface, borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2 },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle:       { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  cardSub:         { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  badge:           { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:       { fontSize: 10, fontWeight: '600' },
  cardActions:     { flexDirection: 'row', gap: 16, marginTop: 10 },
  actionBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText:      { fontSize: 13, fontWeight: '600' },
  overlay:         { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:      { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  formField:       { marginBottom: 12 },
  formLabel:       { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  input:           { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  modalActions:    { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  btn:             { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  statusOption:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, marginBottom: 4 },
  statusOptionText:{ fontSize: 14, fontWeight: '600' },
  empty:           { textAlign: 'center', color: Colors.textMuted, marginTop: 40 },
});
