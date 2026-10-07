import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/authSlice';
import { Colors } from '../../theme';

const PURPLE = '#6A1B9A';

const MENU_ITEMS = [
  { screen: 'SAAmbulances',    label: 'Ambulance Management',  icon: 'ambulance',       color: '#B71C1C' },
  { screen: 'SAFeedback',      label: 'Feedback & Ratings',    icon: 'star-outline',    color: '#E65100' },
  { screen: 'SAComplaints',    label: 'Complaint Management',  icon: 'alert-circle',    color: '#B71C1C' },
  { screen: 'SASubscriptions', label: 'Subscriptions & Billing',icon: 'credit-card',    color: '#2E7D32' },
  { screen: 'SANotifications', label: 'Send Notifications',    icon: 'bell-ring',       color: '#1565C0' },
  { screen: 'SAAnalytics',     label: 'Analytics & Reports',   icon: 'chart-bar',       color: PURPLE },
];

export default function SAMoreScreen({ navigation }) {
  const dispatch = useDispatch();
  const user     = useSelector((s) => s.auth.user);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>More</Text>
          <Text style={styles.headerSub}>{user?.name} · SuperAdmin</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {MENU_ITEMS.map(({ screen, label, icon, color }) => (
          <TouchableOpacity
            key={screen}
            style={styles.menuItem}
            onPress={() => navigation.navigate(screen)}
          >
            <View style={[styles.iconBox, { backgroundColor: color + '18' }]}>
              <MaterialCommunityIcons name={icon} size={26} color={color} />
            </View>
            <Text style={styles.menuLabel}>{label}</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}

        {/* Logout */}
        <TouchableOpacity
          style={[styles.menuItem, styles.logoutItem]}
          onPress={() => dispatch(logout())}
        >
          <View style={[styles.iconBox, { backgroundColor: '#B71C1C18' }]}>
            <MaterialCommunityIcons name="logout" size={26} color="#B71C1C" />
          </View>
          <Text style={[styles.menuLabel, { color: '#B71C1C' }]}>Logout</Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.background },
  header:      { backgroundColor: PURPLE, paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  content:     { padding: 16, gap: 10 },
  menuItem:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, padding: 16, gap: 14, elevation: 1 },
  iconBox:     { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel:   { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  logoutItem:  { marginTop: 12, borderWidth: 1, borderColor: '#B71C1C22' },
});
