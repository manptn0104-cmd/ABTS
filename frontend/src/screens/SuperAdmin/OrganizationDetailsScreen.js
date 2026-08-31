import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getOrganizationById, deleteOrganization, updateOrganizationStatus, restoreOrganization } from '../../api/organizations';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';
import Button from '../../components/common/Button';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#FF8F00', bg: '#FFF8E1' },
  active: { label: 'Active', color: '#2E7D32', bg: '#E8F5E9' },
  suspended: { label: 'Suspended', color: '#B71C1C', bg: '#FFEBEE' },
  expired: { label: 'Expired', color: '#757575', bg: '#F5F5F5' },
};

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={20} color={Colors.textSecondary} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

export default function OrganizationDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { organizationId } = route.params;

  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadOrganization = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOrganizationById(organizationId);
      if (res.data.success) {
        setOrganization(res.data.organization);
      } else {
        Alert.alert('Error', res.data.message || 'Failed to load organization');
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Network error');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [organizationId, navigation]);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  const handleAction = async (action) => {
    const confirmMessages = {
      activate: `Activate ${organization.organizationName}?`,
      suspend: `Suspend ${organization.organizationName}?`,
      expired: `Mark ${organization.organizationName} as expired?`,
      restore: `Restore ${organization.organizationName}?`,
      delete: `Delete ${organization.organizationName}?\n\nThis action cannot be undone.`,
    };

    const ok = Platform.OS === 'web'
      ? window.confirm(confirmMessages[action])
      : true;
    if (!ok) return;

    setActionLoading(true);
    try {
      if (action === 'delete') {
        await deleteOrganization(organizationId);
      } else if (action === 'activate') {
        await updateOrganizationStatus(organizationId, { status: 'active' });
      } else if (action === 'suspend') {
        await updateOrganizationStatus(organizationId, { status: 'suspended' });
      } else if (action === 'expired') {
        await updateOrganizationStatus(organizationId, { status: 'expired' });
      } else if (action === 'restore') {
        await restoreOrganization(organizationId);
      }

      Alert.alert('Success', 'Organization updated successfully');
      loadOrganization();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#9C27B0" />
        </View>
      </SafeAreaView>
    );
  }

  if (!organization) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Organization not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[organization.status] || STATUS_CONFIG.pending;
  const isDeleted = organization.isDeleted;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Organization Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        {isDeleted && (
          <View style={[styles.statusBanner, { backgroundColor: '#FFEBEE' }]}>
            <MaterialCommunityIcons name="delete-forever" size={20} color="#B71C1C" />
            <Text style={[styles.statusBannerText, { color: '#B71C1C' }]}>
              This organization has been deleted
            </Text>
          </View>
        )}

        {/* Organization Info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.orgName}>{organization.organizationName}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
          </View>
          <Text style={styles.orgCode}>{organization.organizationCode}</Text>
        </View>

        {/* Contact Information */}
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.card}>
          <InfoRow icon="account" label="Contact Person" value={organization.contactPerson} />
          <InfoRow icon="email" label="Email" value={organization.email} />
          <InfoRow icon="phone" label="Mobile" value={organization.mobileNumber} />
          <InfoRow icon="map-marker" label="Address" value={organization.address} />
        </View>

        {/* Location */}
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.card}>
          <InfoRow icon="city" label="City" value={organization.city} />
          <InfoRow icon="map" label="State" value={organization.state} />
          <InfoRow icon="earth" label="Country" value={organization.country} />
        </View>

        {/* Registration */}
        <Text style={styles.sectionTitle}>Registration</Text>
        <View style={styles.card}>
          <InfoRow icon="file-document" label="Registration Number" value={organization.registrationNumber} />
          <InfoRow icon="receipt" label="GST Number" value={organization.gstNumber} />
        </View>

        {/* Limits */}
        <Text style={styles.sectionTitle}>Limits</Text>
        <View style={styles.card}>
          <InfoRow icon="ambulance" label="Max Ambulances" value={organization.maximumAmbulanceLimit} />
          <InfoRow icon="steering" label="Max Drivers" value={organization.maximumDriverLimit} />
          <InfoRow icon="account-multiple" label="Max Users" value={organization.maximumUserLimit} />
        </View>

        {/* Subscription */}
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.card}>
          <InfoRow icon="tag" label="Plan" value={organization.subscriptionPlan || 'Not set'} />
          <InfoRow 
            icon="calendar" 
            label="Expiry Date" 
            value={organization.subscriptionExpiryDate 
              ? new Date(organization.subscriptionExpiryDate).toLocaleDateString('en-IN')
              : 'Not set'
            } 
          />
        </View>

        {/* Metadata */}
        <Text style={styles.sectionTitle}>Metadata</Text>
        <View style={styles.card}>
          <InfoRow 
            icon="calendar-plus" 
            label="Created At" 
            value={new Date(organization.createdAt).toLocaleString('en-IN')} 
          />
          <InfoRow 
            icon="calendar-clock" 
            label="Updated At" 
            value={new Date(organization.updatedAt).toLocaleString('en-IN')} 
          />
        </View>

        {/* Actions */}
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionsCard}>
          {!isDeleted && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#E8F5E9' }]}
                onPress={() => handleAction('activate')}
                disabled={actionLoading}
              >
                <MaterialCommunityIcons name="check-circle" size={20} color="#2E7D32" />
                <Text style={[styles.actionBtnText, { color: '#2E7D32' }]}>Activate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#FFF8E1' }]}
                onPress={() => handleAction('suspend')}
                disabled={actionLoading}
              >
                <MaterialCommunityIcons name="pause-circle" size={20} color="#FF8F00" />
                <Text style={[styles.actionBtnText, { color: '#FF8F00' }]}>Suspend</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#F5F5F5' }]}
                onPress={() => handleAction('expired')}
                disabled={actionLoading}
              >
                <MaterialCommunityIcons name="clock-alert" size={20} color="#757575" />
                <Text style={[styles.actionBtnText, { color: '#757575' }]}>Mark Expired</Text>
              </TouchableOpacity>
            </>
          )}

          {isDeleted && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#E3F2FD' }]}
              onPress={() => handleAction('restore')}
              disabled={actionLoading}
            >
              <MaterialCommunityIcons name="restore" size={20} color="#1565C0" />
              <Text style={[styles.actionBtnText, { color: '#1565C0' }]}>Restore</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => navigation.navigate('EditOrganization', { organizationId })}
            disabled={actionLoading}
          >
            <MaterialCommunityIcons name="pencil" size={20} color={Colors.primary} />
            <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Edit Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleAction('delete')}
            disabled={actionLoading}
          >
            <MaterialCommunityIcons name="delete" size={20} color={Colors.error} />
            <Text style={[styles.actionBtnText, { color: Colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>

        {actionLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#9C27B0" />
          </View>
        )}
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
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: '#9C27B0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  container: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    ...Shadow.light,
  },
  statusBannerText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.light,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  orgName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  orgCode: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  infoContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
    marginTop: 2,
  },
  actionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadow.light,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  editBtn: {
    backgroundColor: Colors.background,
  },
  deleteBtn: {
    backgroundColor: '#FFEBEE',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  loadingOverlay: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});
