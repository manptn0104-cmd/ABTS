import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { logout } from '../../store/authSlice';
import * as SA from '../../api/superAdmin';
import { Colors, Spacing, Typography } from '../../theme';

const PURPLE = '#6A1B9A';
const TEAL   = '#00695C';
const ORANGE = '#E65100';
const BLUE   = '#1565C0';
const RED    = '#B71C1C';
const GREEN  = '#2E7D32';

function StatCard({ icon, label, value, color }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, icon, color, children }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.section}>
      <TouchableOpacity style={[styles.sectionHeader, { borderLeftColor: color }]} onPress={() => setOpen(!open)}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={color} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>
      {open && <View style={styles.statsGrid}>{children}</View>}
    </View>
  );
}

function NavCard({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={[styles.navCard, { borderTopColor: color }]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={28} color={color} />
      <Text style={styles.navLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SuperAdminDashboardScreen() {
  const dispatch = useDispatch();
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const res = await SA.getDashboardStats();
      if (res.success) setStats(res.stats);
    } catch {
      Alert.alert('Error', 'Failed to load dashboard stats.');
    } finally {
      setLoading(false); setRefresh(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const s = stats || {};
  const o = s.organizations || {};
  const a = s.ambulances    || {};
  const u = s.users         || {};
  const d = s.drivers       || {};
  const b = s.bookings      || {};
  const r = s.revenue       || {};

  const fmt = (n) => (n ?? 0).toLocaleString();
  const money = (n) => `₹${(n ?? 0).toLocaleString()}`;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SuperAdmin Panel</Text>
          <Text style={styles.headerSub}>ABTS Command Center</Text>
        </View>
        <TouchableOpacity onPress={() => dispatch(logout())} style={styles.logoutBtn}>
          <MaterialCommunityIcons name="logout" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} colors={[PURPLE]} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={PURPLE} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* ── Stats ── */}
            <Section title="Organizations" icon="office-building" color={PURPLE}>
              <StatCard icon="office-building-outline" label="Total"      value={fmt(o.total)}          color={PURPLE} />
              <StatCard icon="check-circle-outline"    label="Active"     value={fmt(o.active)}         color={GREEN}  />
              <StatCard icon="pause-circle-outline"    label="Suspended"  value={fmt(o.suspended)}      color={ORANGE} />
              <StatCard icon="clock-alert-outline"     label="Expired"    value={fmt(o.expired)}        color={RED}    />
              <StatCard icon="timer-sand"              label="Pending"    value={fmt(o.pending)}        color={Colors.warning} />
              <StatCard icon="new-box"                 label="New/Month"  value={fmt(o.newlyRegistered)}color={BLUE}   />
            </Section>

            <Section title="Ambulances" icon="ambulance" color={RED}>
              <StatCard icon="ambulance"             label="Total"        value={fmt(a.total)}          color={RED}    />
              <StatCard icon="check-circle-outline"  label="Active"       value={fmt(a.active)}         color={GREEN}  />
              <StatCard icon="map-marker-check"      label="Available"    value={fmt(a.available)}      color={TEAL}   />
              <StatCard icon="run-fast"              label="Busy"         value={fmt(a.busy)}           color={ORANGE} />
              <StatCard icon="power-off"             label="Offline"      value={fmt(a.offline)}        color={Colors.textMuted} />
              <StatCard icon="wrench-clock"          label="Maintenance"  value={fmt(a.underMaintenance)}color={Colors.warning} />
            </Section>

            <Section title="Users" icon="account-group" color={BLUE}>
              <StatCard icon="account-multiple"     label="Total"        value={fmt(u.total)}         color={BLUE}  />
              <StatCard icon="account-check"        label="Active"       value={fmt(u.active)}        color={GREEN} />
              <StatCard icon="account-plus"         label="New Today"    value={fmt(u.newToday)}      color={TEAL}  />
              <StatCard icon="trending-up"          label="Monthly Growth" value={fmt(u.monthlyGrowth)} color={ORANGE}/>
              <StatCard icon="account-cancel"       label="Blocked"      value={fmt(u.blocked)}       color={RED}   />
            </Section>

            <Section title="Drivers" icon="steering" color={TEAL}>
              <StatCard icon="steering"             label="Total"        value={fmt(d.total)}          color={TEAL}   />
              <StatCard icon="check-circle-outline" label="Active"       value={fmt(d.active)}         color={GREEN}  />
              <StatCard icon="wifi"                 label="Online"       value={fmt(d.online)}         color={Colors.success}/>
              <StatCard icon="wifi-off"             label="Offline"      value={fmt(d.offline)}        color={Colors.textMuted}/>
              <StatCard icon="clock-check-outline"  label="Pending Verify" value={fmt(d.pendingVerification)} color={ORANGE}/>
              <StatCard icon="account-cancel"       label="Suspended"    value={fmt(d.suspended)}      color={RED}    />
            </Section>

            <Section title="Bookings" icon="clipboard-list" color={ORANGE}>
              <StatCard icon="clipboard-list"       label="Total"        value={fmt(b.total)}          color={ORANGE} />
              <StatCard icon="calendar-today"       label="Today"        value={fmt(b.today)}          color={BLUE}   />
              <StatCard icon="flag-checkered"       label="Completed"    value={fmt(b.completed)}      color={GREEN}  />
              <StatCard icon="progress-clock"       label="Ongoing"      value={fmt(b.ongoing)}        color={TEAL}   />
              <StatCard icon="close-circle-outline" label="Cancelled"    value={fmt(b.cancelled)}      color={RED}    />
            </Section>

            <Section title="Revenue" icon="currency-inr" color={GREEN}>
              <StatCard icon="currency-inr"         label="Total Revenue" value={money(r.total)}       color={GREEN}  />
              <StatCard icon="calendar-month"       label="This Month"    value={money(r.monthly)}     color={TEAL}   />
              <StatCard icon="credit-card-clock"    label="Pending Pays"  value={fmt(r.pending)}       color={ORANGE} />
              <StatCard icon="tag-multiple"         label="Subscription"  value={money(r.subscription)}color={PURPLE} />
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.background },
  header:        { backgroundColor: PURPLE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle:   { fontSize: 20, fontWeight: '700', color: Colors.white },
  headerSub:     { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  logoutBtn:     { padding: 8 },
  scroll:        { flex: 1 },
  section:       { margin: 12, backgroundColor: Colors.surface, borderRadius: 12, elevation: 2, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, borderLeftWidth: 4, gap: 8 },
  sectionTitle:  { fontSize: 15, fontWeight: '700' },
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 0 },
  statCard:      { width: '31%', margin: '1%', padding: 10, backgroundColor: Colors.background, borderRadius: 8, borderLeftWidth: 3, alignItems: 'center' },
  statValue:     { fontSize: 20, fontWeight: '800', marginVertical: 2 },
  statLabel:     { fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },
  navHeading:    { fontSize: 16, fontWeight: '700', color: Colors.text, marginHorizontal: 16, marginTop: 8, marginBottom: 8 },
  navGrid:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, marginBottom: 24 },
  navCard:       { width: '29%', margin: '2%', backgroundColor: Colors.surface, borderRadius: 12, borderTopWidth: 3, alignItems: 'center', paddingVertical: 16, elevation: 2 },
  navLabel:      { fontSize: 11, fontWeight: '600', color: Colors.text, marginTop: 6, textAlign: 'center' },
});
