import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getOrganizations, deleteOrganization, updateOrganizationStatus, restoreOrganization } from '../../api/organizations';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';

const STATUS_OPTIONS = ['', 'pending', 'active', 'suspended', 'expired'];
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#FF8F00', bg: '#FFF8E1' },
  active: { label: 'Active', color: '#2E7D32', bg: '#E8F5E9' },
  suspended: { label: 'Suspended', color: '#B71C1C', bg: '#FFEBEE' },
  expired: { label: 'Expired', color: '#757575', bg: '#F5F5F5' },
};

function OrganizationCard({ item, onPress, onAction }) {
  const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orgName}>{item.organizationName}</Text>
          <Text style={styles.orgCode}>{item.organizationCode}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        </View>
      </View>

      <Text style={styles.cardSub}>
        <MaterialCommunityIcons name="account" size={14} color={Colors.textSecondary} />
        {' '}{item.contactPerson}
      </Text>
      <Text style={styles.cardSub}>
        <MaterialCommunityIcons name="email" size={14} color={Colors.textSecondary} />
        {' '}{item.email}
      </Text>
      <Text style={styles.cardSub}>
        <MaterialCommunityIcons name="map-marker" size={14} color={Colors.textSecondary} />
        {' '}{item.city}, {item.state}
      </Text>
      <Text style={styles.cardSub}>
        <MaterialCommunityIcons name="calendar" size={14} color={Colors.textSecondary} />
        {' Created: '}{new Date(item.createdAt).toLocaleDateString('en-IN')}
      </Text>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onAction(item, 'view')}>
          <MaterialCommunityIcons name="eye" size={16} color={Colors.primary} />
          <Text style={styles.actionBtnText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onAction(item, 'edit')}>
          <MaterialCommunityIcons name="pencil" size={16} color={Colors.primary} />
          <Text style={styles.actionBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function ActionModal({ visible, organization, onClose, onAction }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action) => {
    if (action === 'delete') {
      const ok = Platform.OS === 'web'
        ? window.confirm(`Delete ${organization.organizationName}?\n\nThis action cannot be undone.`)
        : true;
      if (!ok) return;
    }

    setLoading(true);
    try {
      await onAction(organization, action);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{organization?.organizationName}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalAction}
              onPress={() => handleAction('activate')}
              disabled={loading}
            >
              <MaterialCommunityIcons name="check-circle" size={20} color="#2E7D32" />
              <Text style={styles.modalActionText}>Activate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalAction}
              onPress={() => handleAction('suspend')}
              disabled={loading}
            >
              <MaterialCommunityIcons name="pause-circle" size={20} color="#FF8F00" />
              <Text style={styles.modalActionText}>Suspend</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalAction}
              onPress={() => handleAction('expired')}
              disabled={loading}
            >
              <MaterialCommunityIcons name="clock-alert" size={20} color="#757575" />
              <Text style={styles.modalActionText}>Mark Expired</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalAction}
              onPress={() => handleAction('restore')}
              disabled={loading}
            >
              <MaterialCommunityIcons name="restore" size={20} color="#1565C0" />
              <Text style={styles.modalActionText}>Restore</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalAction, styles.modalActionDelete]}
              onPress={() => handleAction('delete')}
              disabled={loading}
            >
              <MaterialCommunityIcons name="delete" size={20} color={Colors.error} />
              <Text style={[styles.modalActionText, { color: Colors.error }]}>Delete</Text>
            </TouchableOpacity>

            {loading && <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.md }} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function OrganizationListScreen() {
  const navigation = useNavigation();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionTarget, setActionTarget] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);

  const loadOrganizations = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      };
      const res = await getOrganizations(params);
      if (res.data.success) {
        setOrganizations(res.data.organizations);
        setTotal(res.data.total);
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const handleCardPress = (org) => {
    navigation.navigate('OrganizationDetails', { organizationId: org._id });
  };

  const handleCardAction = (org, action) => {
    if (action === 'view') {
      navigation.navigate('OrganizationDetails', { organizationId: org._id });
    } else if (action === 'edit') {
      navigation.navigate('EditOrganization', { organizationId: org._id });
    } else {
      setActionTarget(org);
      setShowActionModal(true);
    }
  };

  const handleModalAction = async (org, action) => {
    try {
      if (action === 'delete') {
        await deleteOrganization(org._id);
      } else if (action === 'activate') {
        await updateOrganizationStatus(org._id, { status: 'active' });
      } else if (action === 'suspend') {
        await updateOrganizationStatus(org._id, { status: 'suspended' });
      } else if (action === 'expired') {
        await updateOrganizationStatus(org._id, { status: 'expired' });
      } else if (action === 'restore') {
        await restoreOrganization(org._id);
      }
      loadOrganizations(true);
    } catch (err) {
      console.error('Action failed:', err);
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  const handleCreate = () => {
    navigation.navigate('CreateOrganization');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Organizations</Text>
        <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
          <MaterialCommunityIcons name="plus" size={18} color={Colors.white} />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search organizations..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Status Filter */}
      <View style={styles.filterBar}>
        {STATUS_OPTIONS.map((status) => {
          const isActive = statusFilter === status;
          const config = STATUS_CONFIG[status];
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                isActive && { 
                  backgroundColor: config?.color || Colors.primary, 
                  borderColor: config?.color || Colors.primary 
                },
              ]}
              onPress={() => setStatusFilter(status)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {status === '' ? 'All' : config?.label || status}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#9C27B0" />
        </View>
      ) : (
        <FlatList
          data={organizations}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <OrganizationCard item={item} onPress={handleCardPress} onAction={handleCardAction} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadOrganizations(true)} colors={['#9C27B0']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="office-building" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No organizations found</Text>
            </View>
          }
          onEndReached={() => {
            if (organizations.length < total) {
              setPage((p) => p + 1);
            }
          }}
          onEndReachedThreshold={0.5}
        />
      )}

      <ActionModal
        visible={showActionModal}
        organization={actionTarget}
        onClose={() => setShowActionModal(false)}
        onAction={handleModalAction}
      />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: '#9C27B0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9C27B0',
    marginLeft: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadow.light,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    marginLeft: Spacing.sm,
    fontSize: 14,
    color: Colors.text,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: '600',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 40,
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
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  orgCode: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primary,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    width: '100%',
    maxWidth: 400,
    ...Shadow.heavy,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalContent: {
    padding: Spacing.md,
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalActionDelete: {
    marginTop: Spacing.sm,
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginLeft: Spacing.md,
  },
});
