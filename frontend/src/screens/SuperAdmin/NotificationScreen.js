import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SA from '../../api/superAdmin';
import { Colors } from '../../theme';

const BLUE = '#1565C0';
const RECIPIENT_TYPES = [
  { key: 'all',            label: 'All Users',           icon: 'account-group' },
  { key: 'all_users',      label: 'Patients Only',       icon: 'account-multiple' },
  { key: 'drivers',        label: 'Drivers Only',        icon: 'steering' },
  { key: 'org_admins',     label: 'Organization Admins', icon: 'office-building' },
  { key: 'selected_orgs',  label: 'Selected Organizations', icon: 'filter-outline' },
];

const CHANNELS = [
  { key: 'push',  label: 'Push Notification', icon: 'bell-ring', note: 'Sent via FCM' },
  { key: 'sms',   label: 'SMS',               icon: 'message-text', note: 'Requires SMS provider' },
  { key: 'email', label: 'Email',              icon: 'email', note: 'Requires email config' },
];

export default function NotificationScreen() {
  const [title,      setTitle]      = useState('');
  const [message,    setMessage]    = useState('');
  const [recipient,  setRecipient]  = useState('all');
  const [channels,   setChannels]   = useState({ push: true, sms: false, email: false });
  const [loading,    setLoading]    = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const toggleChannel = (key) => setChannels((c) => ({ ...c, [key]: !c[key] }));

  const handleSend = async () => {
    if (!title.trim())   return Alert.alert('Validation', 'Title is required.');
    if (!message.trim()) return Alert.alert('Validation', 'Message is required.');
    const activeChannels = Object.keys(channels).filter((k) => channels[k]);
    if (!activeChannels.length) return Alert.alert('Validation', 'Select at least one channel.');

    Alert.alert(
      'Confirm Send',
      `Send "${title}" to ${RECIPIENT_TYPES.find((r) => r.key === recipient)?.label}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: async () => {
          setLoading(true);
          try {
            const res = await SA.sendNotification({ title, message, recipientType: recipient, channels: activeChannels });
            if (res.success) {
              setLastResult(res);
              setTitle(''); setMessage('');
              Alert.alert('Sent', `Notification queued for ${res.recipientCount} recipients.`);
            } else {
              Alert.alert('Error', res.message);
            }
          } finally { setLoading(false); }
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Send Notification</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Compose */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compose Message</Text>
          <TextInput
            style={styles.input}
            placeholder="Notification Title *"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Message Body *"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{message.length}/500</Text>
        </View>

        {/* Recipients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recipients</Text>
          {RECIPIENT_TYPES.map(({ key, label, icon }) => (
            <TouchableOpacity
              key={key}
              style={[styles.recipientRow, recipient === key && styles.recipientRowActive]}
              onPress={() => setRecipient(key)}
            >
              <MaterialCommunityIcons name={icon} size={20} color={recipient === key ? BLUE : Colors.textSecondary} />
              <Text style={[styles.recipientLabel, recipient === key && { color: BLUE, fontWeight: '700' }]}>{label}</Text>
              {recipient === key && <MaterialCommunityIcons name="check-circle" size={20} color={BLUE} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Channels */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Channels</Text>
          {CHANNELS.map(({ key, label, icon, note }) => (
            <View key={key} style={styles.channelRow}>
              <MaterialCommunityIcons name={icon} size={20} color={channels[key] ? BLUE : Colors.textMuted} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.channelLabel, !channels[key] && { color: Colors.textMuted }]}>{label}</Text>
                <Text style={styles.channelNote}>{note}</Text>
              </View>
              <Switch
                value={channels[key]}
                onValueChange={() => toggleChannel(key)}
                trackColor={{ false: Colors.border, true: BLUE + '88' }}
                thumbColor={channels[key] ? BLUE : Colors.textMuted}
              />
            </View>
          ))}
        </View>

        {/* Last Result */}
        {lastResult && (
          <View style={[styles.section, { backgroundColor: '#E8F5E9', borderRadius: 10 }]}>
            <Text style={[styles.sectionTitle, { color: '#2E7D32' }]}>Last Send Result</Text>
            <Text style={{ color: '#2E7D32' }}>Recipients reached: {lastResult.recipientCount}</Text>
            <Text style={{ color: '#2E7D32', fontSize: 12, marginTop: 4 }}>{lastResult.message}</Text>
          </View>
        )}

        {/* Send Button */}
        <TouchableOpacity
          style={[styles.sendBtn, loading && { opacity: 0.6 }]}
          onPress={handleSend}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="send" size={20} color={Colors.white} />
              <Text style={styles.sendBtnText}>Send Notification</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: Colors.background },
  header:            { padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle:       { fontSize: 18, fontWeight: '700', color: Colors.text },
  content:           { padding: 16, gap: 16 },
  section:           { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, elevation: 2 },
  sectionTitle:      { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  input:             { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 12 },
  textArea:          { minHeight: 100, textAlignVertical: 'top' },
  charCount:         { fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: -8 },
  recipientRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  recipientRowActive:{ borderColor: BLUE, backgroundColor: BLUE + '11' },
  recipientLabel:    { fontSize: 14, color: Colors.text },
  channelRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  channelLabel:      { fontSize: 14, fontWeight: '600', color: Colors.text },
  channelNote:       { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  sendBtn:           { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
  sendBtnText:       { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
