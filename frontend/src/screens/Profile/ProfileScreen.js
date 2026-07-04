import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { logout, updateProfile } from '../../store/authSlice';
import Input  from '../../components/common/Input';
import Button from '../../components/common/Button';
import Card   from '../../components/common/Card';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ name: user?.name || '', phone: user?.phone || '', address: user?.address || '' });

  const handleSave = async () => {
    const result = await dispatch(updateProfile(form));
    if (updateProfile.fulfilled.match(result)) {
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } else {
      Alert.alert('Error', 'Failed to update profile. Try again.');
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      dispatch(logout());
      return;
    }
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => dispatch(logout()) },
      ]
    );
  };

  const MENU_ITEMS = [
    { icon: 'clipboard-list-outline', label: 'My Bookings',  onPress: () => navigation?.navigate?.('Bookings') },
    { icon: 'bell-outline',           label: 'Notifications', onPress: () => {} },
    { icon: 'help-circle-outline',    label: 'Help & Support', onPress: () => navigation?.navigate?.('HelpSupport') },
    { icon: 'information-outline',    label: 'About ABTS',    onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => setEditing((e) => !e)}>
          <MaterialCommunityIcons name={editing ? 'close' : 'pencil'} size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <View style={[styles.roleBadge, user?.role === 'driver' && styles.roleBadgeDriver]}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
          </View>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Edit form */}
        {editing ? (
          <Card shadow="light" style={styles.section}>
            <Text style={styles.sectionTitle}>Edit Profile</Text>
            <Input
              label="Full Name"
              value={form.name}
              onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
              placeholder="Your full name"
              leftIcon={<MaterialCommunityIcons name="account-outline" size={20} color={Colors.textMuted} />}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))}
              placeholder="Phone number"
              keyboardType="phone-pad"
              leftIcon={<MaterialCommunityIcons name="phone-outline" size={20} color={Colors.textMuted} />}
            />
            <Input
              label="Address"
              value={form.address}
              onChangeText={(v) => setForm((p) => ({ ...p, address: v }))}
              placeholder="Your address"
              leftIcon={<MaterialCommunityIcons name="home-outline" size={20} color={Colors.textMuted} />}
            />
            <Button title="Save Changes" onPress={handleSave} />
          </Card>
        ) : (
          <Card shadow="light" style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Info</Text>
            <InfoRow icon="phone" label="Phone"   value={user?.phone   || '—'} />
            <InfoRow icon="email" label="Email"   value={user?.email   || '—'} />
            <InfoRow icon="home"  label="Address" value={user?.address || '—'} />
          </Card>
        )}

        {/* Menu */}

        <Card shadow="light" style={styles.section} padding={false}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, i < MENU_ITEMS.length - 1 && styles.menuDivider]}
              onPress={item.onPress}
            >
              <MaterialCommunityIcons name={item.icon} size={22} color={Colors.textSecondary} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </Card>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, styles.logoutBtnInner]}
          onPress={handleLogout}
          onClick={handleLogout}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="logout" size={18} color={Colors.primary} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>ABTS v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={infoStyles.row}>
      <MaterialCommunityIcons name={icon + '-outline'} size={18} color={Colors.textSecondary} />
      <View>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Spacing.md },
  label: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  value: { fontSize: 14, color: Colors.text, fontWeight: '500', marginTop: 2 },
});

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
  },
  headerTitle:  { fontSize: 20, fontWeight: '700', color: Colors.white },
  container:    { padding: Spacing.md, paddingBottom: 40 },
  avatarSection:{ alignItems: 'center', paddingVertical: Spacing.xl },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.sm,
    ...Shadow.medium,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: Colors.white },
  userName:   { fontSize: 20, fontWeight: '700', color: Colors.text },
  roleBadge:  { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.full, backgroundColor: Colors.background, marginVertical: 6 },
  roleBadgeDriver: { backgroundColor: '#E3F2FD' },
  roleText:   { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  userEmail:  { fontSize: 13, color: Colors.textSecondary },
  section:    { marginBottom: Spacing.md },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  menuItem:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  menuDivider:{ borderBottomWidth: 1, borderBottomColor: Colors.divider },
  menuLabel:  { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },
  logoutBtn:     { marginBottom: Spacing.lg },
  logoutBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  version:    { textAlign: 'center', fontSize: 12, color: Colors.textMuted },
});
