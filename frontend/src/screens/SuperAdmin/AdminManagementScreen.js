import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, Modal, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { listAdmins, createAdmin, deleteAdmin, suspendAdmin } from '../../api/superAdmin';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

const BLANK_ADMIN_FORM = {
  name: '',
  email: '',
  phone: '',
  password: '',
};

function AdminCard({ item, onPress, onSuspend, onDelete }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.adminName}>{item.name}</Text>
          <Text style={styles.adminEmail}>{item.email}</Text>
        </View>
        {item.isSuspended && (
          <View style={[styles.statusBadge, { backgroundColor: '#FFEBEE' }]}>
            <Text style={[styles.statusText, { color: '#B71C1C' }]}>Suspended</Text>
          </View>
        )}
      </View>

      <Text style={styles.cardSub}>
        <MaterialCommunityIcons name="phone" size={14} color={Colors.textSecondary} />
        {' '}{item.phone}
      </Text>
      <Text style={styles.cardSub}>
        <MaterialCommunityIcons name="office-building" size={14} color={Colors.textSecondary} />
        {' '}{item.organizationId?.organizationName || 'No organization'}
      </Text>
      <Text style={styles.cardSub}>
        <MaterialCommunityIcons name="calendar" size={14} color={Colors.textSecondary} />
        {' Created: '}{new Date(item.createdAt).toLocaleDateString('en-IN')}
      </Text>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onPress(item)}>
          <MaterialCommunityIcons name="eye" size={16} color={Colors.primary} />
          <Text style={styles.actionBtnText}>View</Text>
        </TouchableOpacity>
        {!item.isSuspended ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => onSuspend(item)}>
            <MaterialCommunityIcons name="pause-circle" size={16} color="#FF8F00" />
            <Text style={styles.actionBtnText}>Suspend</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.actionBtn, styles.deleteAction]} onPress={() => onDelete(item)}>
          <MaterialCommunityIcons name="delete" size={16} color={Colors.error} />
          <Text style={[styles.actionBtnText, { color: Colors.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CreateAdminModal({ visible, onClose, onCreated }) {
  const [form, setForm] = useState(BLANK_ADMIN_FORM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email';
    if (!form.phone.trim()) newErrors.phone = 'Phone is required';
    if (!/^[0-9]{10,15}$/.test(form.phone)) newErrors.phone = 'Invalid phone number';
    if (!form.password.trim()) newErrors.password = 'Password is required';
    if (form.password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await createAdmin(form);
      if (res.data.success) {
        Alert.alert('Success', 'Admin created successfully');
        setForm(BLANK_ADMIN_FORM);
        onCreated();
        onClose();
      } else {
        Alert.alert('Error', res.data.message || 'Failed to create admin');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create New Admin</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Input
              label="Name *"
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="Enter admin name"
              error={errors.name}
            />
            <Input
              label="Email *"
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v.toLowerCase() }))}
              placeholder="Enter email"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />
            <Input
              label="Phone *"
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v.replace(/[^0-9]/g, '') }))}
              placeholder="10-15 digit phone number"
              keyboardType="phone-pad"
              error={errors.phone}
            />
            <Input
              label="Password *"
              value={form.password}
              onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
              placeholder="Enter password"
              secureTextEntry
              error={errors.password}
            />

            <Button
              title="Create Admin"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={{ marginTop: Spacing.md }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function AdminManagementScreen() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadAdmins = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await listAdmins();
      if (res.data.success) {
        setAdmins(res.data.admins || []);
      }
    } catch (err) {
      console.error('Failed to load admins:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleSuspend = async (admin) => {
    const reason = Platform.OS === 'web'
      ? window.prompt('Enter suspension reason (optional):')
      : null;
    
    const ok = Platform.OS === 'web'
      ? window.confirm(`Suspend ${admin.name}?`)
      : true;
    if (!ok) return;

    try {
      const payload = reason ? { reason } : {};
      const res = await suspendAdmin(admin._id, payload);
      if (res.data.success) {
        Alert.alert('Success', 'Admin suspended successfully');
        loadAdmins(true);
      } else {
        Alert.alert('Error', res.data.message || 'Failed to suspend admin');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Network error');
    }
  };

  const handleDelete = async (admin) => {
    const ok = Platform.OS === 'web'
      ? window.confirm(`Delete ${admin.name}?\n\nThis action cannot be undone.`)
      : true;
    if (!ok) return;

    try {
      const res = await deleteAdmin(admin._id);
      if (res.data.success) {
        Alert.alert('Success', 'Admin deleted successfully');
        loadAdmins(true);
      } else {
        Alert.alert('Error', res.data.message || 'Failed to delete admin');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Network error');
    }
  };

  const filteredAdmins = admins.filter((admin) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      admin.name?.toLowerCase().includes(searchLower) ||
      admin.email?.toLowerCase().includes(searchLower) ||
      admin.phone?.includes(search)
    );
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Management</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
          <MaterialCommunityIcons name="plus" size={18} color={Colors.white} />
          <Text style={styles.createBtnText}>Create Admin</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search admins..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#9C27B0" />
        </View>
      ) : (
        <FlatList
          data={filteredAdmins}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <AdminCard
              item={item}
              onPress={(admin) => console.log('View admin:', admin._id)}
              onSuspend={handleSuspend}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadAdmins(true)} colors={['#9C27B0']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="shield-account" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {search ? 'No admins match your search' : 'No admins found'}
              </Text>
            </View>
          }
        />
      )}

      <CreateAdminModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => loadAdmins(true)}
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
  adminName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  adminEmail: {
    fontSize: 13,
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
  deleteAction: {
    backgroundColor: '#FFEBEE',
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
    maxHeight: '80%',
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
});
