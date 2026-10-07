import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, ScrollView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SA from '../../api/superAdmin';
import { Colors } from '../../theme';

const GREEN = '#2E7D32';
const TABS  = ['Plans', 'Payments'];

function PlanForm({ initial = {}, onSave, onClose }) {
  const [form, setForm] = useState({
    name:          initial.name          || '',
    description:   initial.description   || '',
    price:         initial.price         ? String(initial.price)         : '',
    duration:      initial.duration      ? String(initial.duration)      : '',
    maxAmbulances: initial.maxAmbulances ? String(initial.maxAmbulances) : '-1',
    maxDrivers:    initial.maxDrivers    ? String(initial.maxDrivers)    : '-1',
    gstPercent:    initial.gstPercent    ? String(initial.gstPercent)    : '18',
    trialDays:     initial.trialDays     ? String(initial.trialDays)     : '0',
    features:      initial.features      ? initial.features.join(', ')   : '',
  });
  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const fields = [
    { key: 'name',          label: 'Plan Name',       required: true },
    { key: 'price',         label: 'Price (₹)',        required: true },
    { key: 'duration',      label: 'Duration (days)',  required: true },
    { key: 'description',   label: 'Description' },
    { key: 'maxAmbulances', label: 'Max Ambulances (-1=unlimited)' },
    { key: 'maxDrivers',    label: 'Max Drivers (-1=unlimited)' },
    { key: 'gstPercent',    label: 'GST %' },
    { key: 'trialDays',     label: 'Trial Days' },
    { key: 'features',      label: 'Features (comma-separated)' },
  ];
  const handleSave = () => {
    const data = { ...form, price: Number(form.price), duration: Number(form.duration), maxAmbulances: Number(form.maxAmbulances), maxDrivers: Number(form.maxDrivers), gstPercent: Number(form.gstPercent), trialDays: Number(form.trialDays), features: form.features.split(',').map((s) => s.trim()).filter(Boolean) };
    onSave(data);
  };
  return (
    <ScrollView style={{ maxHeight: 450 }}>
      {fields.map(({ key, label, required }) => (
        <View key={key} style={styles.formField}>
          <Text style={styles.formLabel}>{label}{required ? ' *' : ''}</Text>
          <TextInput style={styles.input} value={form[key]} onChangeText={set(key)} placeholder={label} keyboardType={['price', 'duration', 'maxAmbulances', 'maxDrivers', 'gstPercent', 'trialDays'].includes(key) ? 'numeric' : 'default'} />
        </View>
      ))}
      <View style={styles.modalActions}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.border }]} onPress={onClose}><Text>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: GREEN }]} onPress={handleSave}><Text style={{ color: Colors.white, fontWeight: '700' }}>Save</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function PlanCard({ plan, onEdit, onDelete }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="tag-multiple" size={20} color={GREEN} />
        <Text style={styles.cardTitle}>{plan.name}</Text>
        {plan.isActive ? (
          <View style={[styles.badge, { backgroundColor: '#2E7D3222', borderColor: GREEN }]}><Text style={[styles.badgeText, { color: GREEN }]}>Active</Text></View>
        ) : (
          <View style={[styles.badge, { backgroundColor: '#75757522', borderColor: '#757575' }]}><Text style={styles.badgeText}>Inactive</Text></View>
        )}
      </View>
      <Text style={styles.priceText}>₹{plan.price.toLocaleString()} / {plan.duration} days</Text>
      <Text style={styles.cardSub}>GST {plan.gstPercent}% · Max Ambulances: {plan.maxAmbulances < 0 ? 'Unlimited' : plan.maxAmbulances} · Max Drivers: {plan.maxDrivers < 0 ? 'Unlimited' : plan.maxDrivers}</Text>
      <Text style={styles.cardSub}>Organizations using: {plan.orgCount || 0}</Text>
      {plan.features?.length > 0 && (
        <View style={styles.featuresRow}>
          {plan.features.map((f, i) => (
            <View key={i} style={styles.featureChip}><Text style={styles.featureText}>{f}</Text></View>
          ))}
        </View>
      )}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(plan)}>
          <MaterialCommunityIcons name="pencil" size={16} color={GREEN} /><Text style={[styles.actionText, { color: GREEN }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onDelete(plan)}>
          <MaterialCommunityIcons name="delete" size={16} color={Colors.error} /><Text style={[styles.actionText, { color: Colors.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PaymentRow({ item }) {
  const statusColor = { pending: '#F57F17', completed: '#2E7D32', failed: '#B71C1C', refunded: '#757575' };
  const color = statusColor[item.status] || Colors.textMuted;
  return (
    <View style={styles.payRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.payOrg}>{item.organization?.name || 'N/A'}</Text>
        <Text style={styles.paySub}>{item.type} · {item.subscription?.name || '—'}</Text>
        <Text style={styles.paySub}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.payAmount, { color }]}>₹{item.totalAmount?.toLocaleString()}</Text>
        <Text style={[styles.payStatus, { color }]}>{item.status}</Text>
        {item.invoiceNumber && <Text style={styles.paySub}>{item.invoiceNumber}</Text>}
      </View>
    </View>
  );
}

export default function SubscriptionScreen() {
  const [tab,      setTab]      = useState('Plans');
  const [plans,    setPlans]    = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      if (tab === 'Plans') {
        const res = await SA.getSubscriptions();
        if (res.success) setPlans(res.plans);
      } else {
        const res = await SA.getPayments();
        if (res.success) setPayments(res.payments);
      }
    } finally { setLoading(false); setRefresh(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data) => {
    const res = editing ? await SA.updateSubscription(editing._id, data) : await SA.createSubscription(data);
    if (res.success) { Alert.alert('Done', res.message); setModal(false); setEditing(null); load(); }
    else Alert.alert('Error', res.message);
  };

  const handleDelete = (plan) => {
    Alert.alert('Delete', `Delete plan "${plan.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const res = await SA.deleteSubscription(plan._id);
        if (res.success) load(); else Alert.alert('Error', res.message);
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Subscriptions & Billing</Text>
        {tab === 'Plans' && (
          <TouchableOpacity onPress={() => { setEditing(null); setModal(true); }}>
            <MaterialCommunityIcons name="plus-circle" size={28} color={GREEN} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator size="large" color={GREEN} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={tab === 'Plans' ? plans : payments}
          keyExtractor={(i) => i._id}
          renderItem={({ item }) => tab === 'Plans'
            ? <PlanCard plan={item} onEdit={(p) => { setEditing(p); setModal(true); }} onDelete={handleDelete} />
            : <PaymentRow item={item} />
          }
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[GREEN]} />}
          ListEmptyComponent={<Text style={styles.empty}>{tab === 'Plans' ? 'No subscription plans yet.' : 'No payments found.'}</Text>}
        />
      )}

      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Plan' : 'Create Plan'}</Text>
            <PlanForm initial={editing || {}} onSave={handleSave} onClose={() => { setModal(false); setEditing(null); }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: Colors.text },
  tabRow:       { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn:       { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: GREEN },
  tabText:      { fontSize: 14, color: Colors.textSecondary },
  tabTextActive:{ fontWeight: '700', color: GREEN },
  card:         { backgroundColor: Colors.surface, borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2 },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle:    { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  priceText:    { fontSize: 18, fontWeight: '800', color: GREEN, marginVertical: 4 },
  cardSub:      { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  badge:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:    { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  featuresRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  featureChip:  { backgroundColor: GREEN + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  featureText:  { fontSize: 11, color: GREEN, fontWeight: '600' },
  cardActions:  { flexDirection: 'row', gap: 20, marginTop: 10 },
  actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText:   { fontSize: 13, fontWeight: '600' },
  payRow:       { backgroundColor: Colors.surface, borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', elevation: 1 },
  payOrg:       { fontSize: 14, fontWeight: '700', color: Colors.text },
  paySub:       { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  payAmount:    { fontSize: 16, fontWeight: '800' },
  payStatus:    { fontSize: 11, fontWeight: '600', marginTop: 2 },
  overlay:      { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:   { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  formField:    { marginBottom: 12 },
  formLabel:    { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  input:        { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  btn:          { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  empty:        { textAlign: 'center', color: Colors.textMuted, marginTop: 40 },
});
