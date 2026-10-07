import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SA from '../../api/superAdmin';
import { Colors } from '../../theme';

const RED = '#B71C1C';
const PRIORITY_COLOR = { low: '#2E7D32', medium: '#F57F17', high: '#E65100', critical: '#B71C1C' };
const STATUS_COLOR   = { open: '#1565C0', assigned: '#F57F17', in_progress: '#00695C', resolved: '#2E7D32', closed: '#757575', escalated: '#B71C1C', reopened: '#E65100' };

const ACTIONS = [
  { key: 'assign',    label: 'Assign',    icon: 'account-arrow-right', color: '#1565C0' },
  { key: 'start',     label: 'Start',     icon: 'play-circle-outline',  color: '#00695C' },
  { key: 'escalate',  label: 'Escalate',  icon: 'arrow-up-circle',      color: '#E65100' },
  { key: 'resolve',   label: 'Resolve',   icon: 'check-circle',         color: '#2E7D32' },
  { key: 'close',     label: 'Close',     icon: 'close-circle',         color: '#757575' },
  { key: 'reopen',    label: 'Reopen',    icon: 'refresh-circle',       color: '#F57F17' },
];

function Badge({ label, colorMap }) {
  const color = colorMap[label] || Colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export default function ComplaintScreen() {
  const [complaints, setComplaints] = useState([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refresh,    setRefresh]    = useState(false);
  const [statusF,    setStatusF]    = useState('');
  const [priorityF,  setPriorityF]  = useState('');
  const [selected,   setSelected]   = useState(null);
  const [resolution, setResolution] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusF)   q.set('status',   statusF);
      if (priorityF) q.set('priority', priorityF);
      const res = await SA.getComplaints(q.toString() ? `?${q}` : '');
      if (res.success) { setComplaints(res.complaints); setTotal(res.total); }
    } finally { setLoading(false); setRefresh(false); }
  }, [statusF, priorityF]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action) => {
    const data = { action };
    if (resolution) data.resolution = resolution;
    const res = await SA.updateComplaintAction(selected._id, data);
    if (res.success) { Alert.alert('Done', res.message); setSelected(null); setResolution(''); load(); }
    else Alert.alert('Error', res.message);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="alert-circle-outline" size={18} color={PRIORITY_COLOR[item.priority] || RED} />
        <Text style={styles.cardTitle} numberOfLines={1}>{item.subject}</Text>
        <Badge label={item.priority} colorMap={PRIORITY_COLOR} />
      </View>
      <Text style={styles.cardSub} numberOfLines={2}>{item.description}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <Badge label={item.status} colorMap={STATUS_COLOR} />
        <Text style={styles.cardMeta}>{item.submitterType} · {new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      {item.submittedBy && <Text style={styles.cardSub}>By: {item.submittedBy.name}</Text>}
      {item.organization && <Text style={styles.cardSub}>Org: {item.organization.name}</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Complaints ({total})</Text>
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <Text style={styles.filterLabel}>Status: </Text>
          {['', 'open', 'assigned', 'in_progress', 'resolved', 'closed', 'escalated'].map((s) => (
            <TouchableOpacity key={s} style={[styles.chip, statusF === s && styles.chipActive]} onPress={() => setStatusF(s)}>
              <Text style={[styles.chipText, statusF === s && { color: Colors.white }]}>{s || 'All'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Text style={styles.filterLabel}>Priority: </Text>
          {['', 'low', 'medium', 'high', 'critical'].map((p) => (
            <TouchableOpacity key={p} style={[styles.chip, priorityF === p && styles.chipActive]} onPress={() => setPriorityF(p)}>
              <Text style={[styles.chipText, priorityF === p && { color: Colors.white }]}>{p || 'All'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? <ActivityIndicator size="large" color={RED} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={complaints}
          keyExtractor={(i) => i._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[RED]} />}
          ListEmptyComponent={<Text style={styles.empty}>No complaints found.</Text>}
        />
      )}

      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <ScrollView>
              <Text style={styles.modalTitle}>{selected?.subject}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
                <Badge label={selected?.status || ''} colorMap={STATUS_COLOR} />
                <Badge label={selected?.priority || ''} colorMap={PRIORITY_COLOR} />
              </View>
              <Text style={styles.detailText}>{selected?.description}</Text>
              <Text style={styles.detailMeta}>
                Submitted by: {selected?.submittedBy?.name || 'Unknown'} ({selected?.submitterType}) — {selected && new Date(selected.createdAt).toLocaleDateString()}
              </Text>
              {selected?.assignedTo && <Text style={styles.detailMeta}>Assigned to: {selected.assignedTo.name}</Text>}
              {selected?.resolution && <Text style={styles.detailMeta}>Resolution: {selected.resolution}</Text>}

              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Resolution Note (optional)</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={3}
                value={resolution}
                onChangeText={setResolution}
                placeholder="Enter resolution or notes..."
              />

              <Text style={styles.sectionTitle}>Actions</Text>
              <View style={{ gap: 8 }}>
                {ACTIONS.map(({ key, label, icon, color }) => (
                  <TouchableOpacity key={key} style={[styles.actionRow, { backgroundColor: color + '11' }]} onPress={() => doAction(key)}>
                    <MaterialCommunityIcons name={icon} size={20} color={color} />
                    <Text style={[styles.actionRowText, { color }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={[styles.btn, { backgroundColor: Colors.border, marginTop: 12, alignSelf: 'flex-end' }]} onPress={() => setSelected(null)}>
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
  filterRow:     { padding: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterLabel:   { fontSize: 12, color: Colors.textSecondary, alignSelf: 'center', marginRight: 4 },
  chip:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.border, marginRight: 6 },
  chipActive:    { backgroundColor: RED },
  chipText:      { fontSize: 12, color: Colors.text },
  card:          { backgroundColor: Colors.surface, borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle:     { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  cardSub:       { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cardMeta:      { fontSize: 11, color: Colors.textMuted, alignSelf: 'center' },
  badge:         { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:     { fontSize: 10, fontWeight: '600' },
  overlay:       { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:    { fontSize: 16, fontWeight: '700', color: Colors.text },
  detailText:    { fontSize: 14, color: Colors.text, lineHeight: 20, marginTop: 8 },
  detailMeta:    { fontSize: 12, color: Colors.textMuted, marginTop: 6 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 12, marginBottom: 8 },
  textArea:      { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 8 },
  actionRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8 },
  actionRowText: { fontSize: 15, fontWeight: '600' },
  btn:           { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  empty:         { textAlign: 'center', color: Colors.textMuted, marginTop: 40 },
});
