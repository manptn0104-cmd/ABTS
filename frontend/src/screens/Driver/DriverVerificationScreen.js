import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Platform, SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/authSlice';
import { Colors, Spacing, BorderRadius, Shadow, Typography } from '../../theme';
import { fetchMyDriver, uploadDriverDocuments, fetchDriverDocuments } from '../../api/drivers';

const REQUIRED_DOCS = [
  { key: 'aadhaarImage', label: 'Aadhaar Card' },
  { key: 'licenceImage', label: 'Driving Licence' },
  { key: 'driverPhoto', label: 'Driver Photo' },
];

export default function DriverVerificationScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [driverData, setDriverData] = useState(null);

  // Upload state
  const [files, setFiles] = useState({});

  const checkDriverStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyDriver();
      if (res.data?.success && res.data?.driver) {
        setDriverData(res.data.driver);
      } else {
        setDriverData(user);
      }
    } catch (err) {
      // Error means no driver data yet, use current user
      setDriverData(user);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkDriverStatus();
  }, [checkDriverStatus]);

  const pickFile = (key) => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          setFiles((prev) => ({ ...prev, [key]: file }));
        }
      };
      input.click();
    } else {
      showAlert('Supported Platforms', 'Document uploading on mobile requires Expo document picking library.');
    }
  };

  const handleUploadDocs = async () => {
    // Validate that all documents are picked
    const missingDocs = REQUIRED_DOCS.filter((doc) => !files[doc.key]);
    if (missingDocs.length > 0 && (!driverData?.documents || driverData.approvalStatus !== 'rejected')) {
      showAlert('Missing Documents', `Please select a file for: ${missingDocs.map((d) => d.label).join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      Object.keys(files).forEach((key) => {
        if (files[key]) {
          if (Platform.OS === 'web') {
            formData.append(key, files[key]);
          } else {
            formData.append(key, {
              uri: files[key].uri,
              name: files[key].name || `${key}.jpg`,
              type: files[key].type || 'image/jpeg',
            });
          }
        }
      });

      const res = await uploadDriverDocuments(user._id, formData);
      if (res.data?.success) {
        setDriverData(res.data.driver);
        setFiles({});
        showAlert('Success', 'Documents uploaded successfully. Verification status is now pending.');
        await checkDriverStatus();
      } else {
        showAlert('Upload Failed', res.data?.message || 'Failed to upload documents.');
      }
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Upload failed.');
    } finally {
      setSaving(false);
    }
  };

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loadingText}>Fetching verification status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // State: Approved
  if (driverData?.approvalStatus === 'approved') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.containerCenter}>
          <MaterialCommunityIcons name="check-circle" size={72} color={Colors.success} />
          <Text style={styles.statusTitle}>Verification Approved</Text>
          <Text style={styles.statusDescription}>
            Your driver account has been verified and approved. You can now access the dashboard and receive booking requests.
          </Text>
          <TouchableOpacity
            style={styles.dashboardBtn}
            onPress={() => navigation.replace('DriverTabs')}
          >
            <MaterialCommunityIcons name="steering" size={18} color={Colors.white} />
            <Text style={styles.dashboardBtnText}>Go to Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutLink} onPress={() => dispatch(logout())}>
            <Text style={styles.logoutLinkText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // State: Pending
  if (driverData?.approvalStatus === 'pending') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.containerCenter}>
          <MaterialCommunityIcons name="clock-outline" size={72} color={Colors.warning} />
          <Text style={styles.statusTitle}>Verification Pending</Text>
          <Text style={styles.statusDescription}>
            Your driver documents are currently under review by the admin panel. 
            Once approved, you will get access to the dashboard.
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={checkDriverStatus} disabled={loading}>
            <MaterialCommunityIcons name="refresh" size={18} color={Colors.white} />
            <Text style={styles.refreshBtnText}>Check Status</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutLink} onPress={() => dispatch(logout())}>
            <Text style={styles.logoutLinkText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // State: Rejected or Initial Upload
  const isRejected = driverData?.approvalStatus === 'rejected';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Driver Verification</Text>
          <Text style={styles.headerSub}>
            Upload your documents to verify your driver account.
          </Text>
        </View>

        {isRejected && (
          <View style={styles.rejectedBanner}>
            <View style={styles.rejectedBannerHeader}>
              <MaterialCommunityIcons name="alert-decagram" size={20} color={Colors.error} />
              <Text style={styles.rejectedBannerTitle}>Verification Rejected</Text>
            </View>
            <Text style={styles.rejectedReason}>
              Reason: "{driverData?.rejectionReason || 'Documents are invalid or illegible.'}"
            </Text>
            <Text style={styles.rejectedNote}>
              Please review the feedback above, replace the rejected documents, and resubmit.
            </Text>
          </View>
        )}

        <View style={[styles.card, Shadow.medium]}>
          <Text style={styles.cardTitle}>Upload Verification Documents</Text>

          {REQUIRED_DOCS.map((doc) => {
            const hasPicked = !!files[doc.key];
            const fileObj = files[doc.key];
            const prevUploaded = driverData?.documents?.[doc.key]?.url;

            return (
              <View key={doc.key} style={styles.docRow}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={styles.docLabel}>{doc.label} *</Text>
                  {hasPicked ? (
                    <Text style={styles.pickedFile} numberOfLines={1}>
                      📎 {fileObj.name || 'documentSelected'}
                    </Text>
                  ) : prevUploaded ? (
                    <Text style={styles.uploadedFile} numberOfLines={1}>
                      ✓ Already Uploaded (Click to change)
                    </Text>
                  ) : (
                    <Text style={styles.noFile}>No document selected</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.pickBtn, hasPicked && styles.pickBtnActive]}
                  onPress={() => pickFile(doc.key)}
                >
                  <Text style={[styles.pickBtnText, hasPicked && styles.pickBtnTextActive]}>
                    {hasPicked ? 'Change' : 'Pick File'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <TouchableOpacity style={styles.submitBtn} onPress={handleUploadDocs} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>
                {isRejected ? 'Submit Re-upload' : 'Submit for Verification'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(logout())}>
          <MaterialCommunityIcons name="logout" size={18} color={Colors.primary} />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  container: { padding: Spacing.md, paddingBottom: 40 },
  containerCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, textAlign: 'center' },
  loadingText: { marginTop: Spacing.sm, color: Colors.textSecondary, fontSize: 14 },
  
  header: { marginBottom: Spacing.lg },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  headerSub: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  
  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md,
    padding: Spacing.sm, fontSize: 14, color: Colors.text, backgroundColor: Colors.surface,
  },
  
  row: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  half: { flex: 1 },
  
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },
  
  submitBtn: {
    backgroundColor: Colors.secondary, padding: Spacing.md, borderRadius: BorderRadius.md,
    alignItems: 'center', marginTop: 24, ...Shadow.light,
  },
  submitBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  
  docRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  docLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  noFile: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  pickedFile: { fontSize: 12, color: Colors.secondary, fontWeight: '600', marginTop: 2 },
  uploadedFile: { fontSize: 12, color: Colors.success, fontWeight: '600', marginTop: 2 },
  
  pickBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.secondary, backgroundColor: Colors.surface,
  },
  pickBtnActive: { backgroundColor: Colors.secondaryLight, borderColor: Colors.secondaryLight },
  pickBtnText: { fontSize: 13, fontWeight: '700', color: Colors.secondary },
  pickBtnTextActive: { color: Colors.white },

  statusTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: Spacing.md },
  statusDescription: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, paddingHorizontal: Spacing.md, lineHeight: 22 },
  
  detailsBox: {
    backgroundColor: Colors.white, padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, marginVertical: 20, width: '100%', maxWidth: 300,
  },
  detailsText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, paddingVertical: 2 },
  
  refreshBtn: {
    flexDirection: 'row', gap: 6, backgroundColor: Colors.secondary,
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: BorderRadius.md,
    alignItems: 'center', ...Shadow.light,
  },
  refreshBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  
  rejectedBanner: {
    backgroundColor: '#FFEBEE', borderWidth: 1.5, borderColor: Colors.error,
    borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md,
  },
  rejectedBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rejectedBannerTitle: { fontSize: 15, fontWeight: '700', color: Colors.error },
  rejectedReason: { fontSize: 14, fontWeight: '600', color: Colors.text, marginVertical: 4 },
  rejectedNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  
  logoutBtn: {
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 12, marginTop: Spacing.xl, backgroundColor: Colors.surface,
  },
  logoutBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  
  logoutLink: { marginTop: 20 },
  logoutLinkText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },

  dashboardBtn: {
    flexDirection: 'row', gap: 6, backgroundColor: Colors.secondary,
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: BorderRadius.md,
    alignItems: 'center', ...Shadow.light, marginTop: 20,
  },
  dashboardBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
});
