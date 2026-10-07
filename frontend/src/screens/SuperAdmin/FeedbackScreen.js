import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SA from '../../api/superAdmin';
import { Colors } from '../../theme';

const ORANGE = '#E65100';
const TYPES  = ['', 'app', 'driver', 'organization', 'hospital'];

function Stars({ rating }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map((i) => (
        <MaterialCommunityIcons key={i} name={i <= rating ? 'star' : 'star-outline'} size={14} color="#F9A825" />
      ))}
    </View>
  );
}

function AnalyticsCard({ analytics }) {
  if (!analytics) return null;
  const { overall, byType, satisfactionIndex, bookingAvgRating } = analytics;
  return (
    <View style={styles.analyticsBox}>
      <Text style={styles.sectionTitle}>Analytics Overview</Text>
      <View style={styles.analyticsRow}>
        <View style={styles.analyticsItem}>
          <Text style={styles.analyticsValue}>{overall.avgRating}</Text>
          <Text style={styles.analyticsLabel}>Avg App Rating</Text>
        </View>
        <View style={styles.analyticsItem}>
          <Text style={styles.analyticsValue}>{bookingAvgRating}</Text>
          <Text style={styles.analyticsLabel}>Avg Booking Rating</Text>
        </View>
        <View style={styles.analyticsItem}>
          <Text style={styles.analyticsValue}>{satisfactionIndex}%</Text>
          <Text style={styles.analyticsLabel}>Satisfaction Index</Text>
        </View>
        <View style={styles.analyticsItem}>
          <Text style={styles.analyticsValue}>{overall.count}</Text>
          <Text style={styles.analyticsLabel}>Total Feedback</Text>
        </View>
      </View>
      <View style={styles.byTypeRow}>
        {Object.entries(byType || {}).map(([type, data]) => (
          <View key={type} style={styles.byTypeItem}>
            <Text style={styles.byTypeLabel}>{type}</Text>
            <Text style={styles.byTypeVal}>{Number(data.avgRating).toFixed(1)} ⭐</Text>
            <Text style={styles.byTypeCnt}>{data.count} reviews</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function FeedbackScreen() {
  const [feedback,  setFeedback]  = useState([]);
  const [total,     setTotal]     = useState(0);
  const [analytics, setAnalytics] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refresh,   setRefresh]   = useState(false);
  const [type,      setType]      = useState('');
  const [selected,  setSelected]  = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const q   = type ? `?type=${type}` : '';
      const [fbRes, anRes] = await Promise.all([SA.getFeedback(q), SA.getFeedbackAnalytics()]);
      if (fbRes.success)  { setFeedback(fbRes.feedback); setTotal(fbRes.total); }
      if (anRes.success)  setAnalytics(anRes.analytics);
    } finally { setLoading(false); setRefresh(false); }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const handleStatusUpdate = async (status) => {
    const res = await SA.updateFeedbackStatus(selected._id, status);
    if (res.success) { Alert.alert('Done', 'Status updated.'); setSelected(null); load(); }
    else Alert.alert('Error', res.message);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="comment-text-outline" size={18} color={ORANGE} />
        <Text style={styles.cardType}>{item.type}</Text>
        <Stars rating={item.rating} />
        <View style={[styles.badge, { borderColor: item.status === 'resolved' ? '#2E7D32' : ORANGE, backgroundColor: (item.status === 'resolved' ? '#2E7D32' : ORANGE) + '22' }]}>
          <Text style={[styles.badgeText, { color: item.status === 'resolved' ? '#2E7D32' : ORANGE }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.cardSub} numberOfLines={2}>{item.comment || '(No comment)'}</Text>
      <Text style={styles.cardSub}>By: {item.user?.name || 'Anonymous'} · {new Date(item.createdAt).toLocaleDateString()}</Text>
      {item.organization && <Text style={styles.cardSub}>Org: {item.organization.name}</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feedback & Ratings ({total})</Text>
      </View>

      {loading ? <ActivityIndicator size="large" color={ORANGE} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={feedback}
          keyExtractor={(i) => i._id}
          renderItem={renderItem}
          ListHeaderComponent={
            <>
              <AnalyticsCard analytics={analytics} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12, marginBottom: 8 }}>
                {TYPES.map((t) => (
                  <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
                    <Text style={[styles.chipText, type === t && { color: Colors.white }]}>{t || 'All'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          }
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[ORANGE]} />}
          ListEmptyComponent={<Text style={styles.empty}>No feedback yet.</Text>}
        />
      )}

      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Stars rating={selected?.rating} />
              <Text style={styles.modalTitle}>{selected?.type} Feedback</Text>
            </View>
            <Text style={styles.detailText}>{selected?.comment || '(No comment)'}</Text>
            <Text style={styles.detailMeta}>By: {selected?.user?.name || 'Anonymous'} — {selected && new Date(selected.createdAt).toLocaleDateString()}</Text>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Update Status</Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {['reviewed', 'resolved'].map((s) => (
                <TouchableOpacity key={s} style={[styles.statusBtn, { backgroundColor: s === 'resolved' ? '#2E7D3222' : ORANGE + '22' }]} onPress={() => handleStatusUpdate(s)}>
                  <Text style={{ color: s === 'resolved' ? '#2E7D32' : ORANGE, fontWeight: '600' }}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
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
  analyticsBox:  { margin: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, elevation: 2 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  analyticsRow:  { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  analyticsItem: { alignItems: 'center' },
  analyticsValue:{ fontSize: 22, fontWeight: '800', color: ORANGE },
  analyticsLabel:{ fontSize: 10, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
  byTypeRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  byTypeItem:    { backgroundColor: Colors.background, borderRadius: 8, padding: 10, minWidth: 80, alignItems: 'center' },
  byTypeLabel:   { fontSize: 11, color: Colors.textSecondary, textTransform: 'capitalize' },
  byTypeVal:     { fontSize: 16, fontWeight: '700', color: Colors.text },
  byTypeCnt:     { fontSize: 10, color: Colors.textMuted },
  chip:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.border, marginRight: 6 },
  chipActive:    { backgroundColor: ORANGE },
  chipText:      { fontSize: 12, color: Colors.text },
  card:          { backgroundColor: Colors.surface, borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardType:      { fontSize: 13, fontWeight: '700', color: Colors.text, textTransform: 'capitalize' },
  cardSub:       { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  badge:         { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 'auto' },
  badgeText:     { fontSize: 10, fontWeight: '600' },
  overlay:       { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:    { fontSize: 16, fontWeight: '700', color: Colors.text },
  detailText:    { fontSize: 14, color: Colors.text, lineHeight: 20 },
  detailMeta:    { fontSize: 12, color: Colors.textMuted, marginTop: 6 },
  statusBtn:     { padding: 12, borderRadius: 8, alignItems: 'center' },
  btn:           { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  empty:         { textAlign: 'center', color: Colors.textMuted, marginTop: 40 },
});
