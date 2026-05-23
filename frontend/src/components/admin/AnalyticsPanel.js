import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import api from '../../api';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';

function StatCard({ label, value, color }) {
  return (
    <View style={[styles.statCard, Shadow.light]}>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function AnalyticsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics')
      .then((res) => setData(res.data.analytics))
      .catch((e) => console.error('Analytics error:', e?.response?.data || e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Unable to load analytics.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.grid}>
        <StatCard label="Total Bookings" value={data.totalBookings} />
        <StatCard label="Completed" value={data.completedRides} color={Colors.success} />
        <StatCard label="Cancelled" value={data.cancelledRides} color={Colors.error} />
        <StatCard label="Revenue" value={`₹${Math.round(data.revenue || 0)}`} color={Colors.secondary} />
        <StatCard label="Avg Response" value={`${data.averageResponseTimeMin} min`} />
        <StatCard label="Pending" value={data.pendingBookings} color={Colors.warning} />
      </View>

      <Text style={styles.sectionTitle}>Emergency trends</Text>
      {(data.emergencyTrends || []).map((t) => (
        <View key={t._id} style={styles.row}>
          <Text style={styles.rowLabel}>{t._id || 'general'}</Text>
          <Text style={styles.rowValue}>{t.count}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Top drivers</Text>
      {(data.topDrivers || []).map((d) => (
        <View key={d._id} style={styles.row}>
          <Text style={styles.rowLabel}>{d.driverName} ({d.vehicleNumber})</Text>
          <Text style={styles.rowValue}>{d.trips} trips</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Daily bookings (last 30 days)</Text>
      {(data.dailyBookings || []).slice(-7).map((d) => (
        <View key={d._id} style={styles.barRow}>
          <Text style={styles.barLabel}>{d._id}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.min(100, (d.count / Math.max(data.totalBookings, 1)) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.barCount}>{d.count}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  muted: { color: Colors.textMuted },
  container: { padding: Spacing.md, paddingBottom: 80 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.white, padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: 6,
  },
  rowLabel: { fontSize: 13, color: Colors.text },
  rowValue: { fontSize: 13, fontWeight: '700', color: Colors.secondary },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { width: 72, fontSize: 11, color: Colors.textSecondary },
  barTrack: { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: Colors.primary },
  barCount: { width: 28, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});
