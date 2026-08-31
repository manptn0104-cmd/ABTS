import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getSuperAdminOverview } from '../../api/superAdmin';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';

function StatCard({ icon, label, value, color, subtext }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <MaterialCommunityIcons name={icon} size={28} color={color} style={{ marginBottom: 6 }} />
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {subtext && <Text style={styles.statSubtext}>{subtext}</Text>}
    </View>
  );
}

export default function SuperAdminDashboardScreen() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadOverview = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await getSuperAdminOverview();
      if (res.data.success) {
        setOverview(res.data.overview);
      } else {
        setError(res.data.message || 'Failed to load overview');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#9C27B0" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <MaterialCommunityIcons
            name="refresh"
            size={24}
            color={Colors.primary}
            style={{ marginTop: Spacing.md }}
            onPress={() => loadOverview()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const o = overview || {};

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Platform Dashboard</Text>
        <Text style={styles.headerSubtitle}>SuperAdmin Overview</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadOverview(true)} colors={['#9C27B0']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Platform Statistics */}
        <Text style={styles.sectionHeading}>Platform Statistics</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="account-multiple" label="Users" value={o.users} color="#1565C0" />
          <StatCard icon="steering" label="Drivers" value={o.drivers} color="#00897B" />
          <StatCard icon="shield-account" label="Admins" value={o.admins} color="#9C27B0" />
          <StatCard icon="clipboard-list" label="Bookings" value={o.bookings} color="#7B1FA2" />
        </View>

        {/* Revenue */}
        <Text style={styles.sectionHeading}>Revenue</Text>
        <View style={styles.statsGrid}>
          <StatCard 
            icon="currency-inr" 
            label="Total Revenue" 
            value={`₹${(o.revenue || 0).toLocaleString()}`} 
            color="#C62828" 
          />
        </View>

        {/* Unavailable Metrics Notice */}
        <View style={styles.noticeCard}>
          <MaterialCommunityIcons name="information" size={20} color={Colors.warning} />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={styles.noticeTitle}>Additional Metrics</Text>
            <Text style={styles.noticeText}>
              Granular metrics (organization status, ambulance availability, driver status, booking breakdown) 
              are not yet available from the backend API. Contact backend team to implement these endpoints.
            </Text>
          </View>
        </View>

        {/* Requested Metrics (Unavailable) */}
        <Text style={styles.sectionHeading}>Requested Metrics (Not Available)</Text>
        <View style={styles.unavailableSection}>
          <Text style={styles.unavailableTitle}>Organizations</Text>
          <Text style={styles.unavailableText}>
            Total, Active, Suspended, Expired, Pending — Backend endpoint needed
          </Text>

          <Text style={styles.unavailableTitle}>Ambulances</Text>
          <Text style={styles.unavailableText}>
            Total, Active, Available, Busy, Offline, Maintenance — Backend endpoint needed
          </Text>

          <Text style={styles.unavailableTitle}>Users</Text>
          <Text style={styles.unavailableText}>
            Active, New Registrations — Backend endpoint needed
          </Text>

          <Text style={styles.unavailableTitle}>Drivers</Text>
          <Text style={styles.unavailableText}>
            Active, Online, Offline, Pending Verification, Suspended — Backend endpoint needed
          </Text>

          <Text style={styles.unavailableTitle}>Bookings</Text>
          <Text style={styles.unavailableText}>
            Today's, Completed, Ongoing, Cancelled, Emergency — Backend endpoint needed
          </Text>

          <Text style={styles.unavailableTitle}>Revenue</Text>
          <Text style={styles.unavailableText}>
            Monthly, Subscription, Pending Payments — Backend endpoint needed
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.white,
    opacity: 0.9,
    marginTop: 2,
  },
  container: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.sm,
  },
  statCard: {
    width: '50%',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    ...Shadow.light,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statSubtext: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    ...Shadow.light,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  unavailableSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadow.light,
  },
  unavailableTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  unavailableText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: Spacing.sm,
    lineHeight: 16,
  },
});
