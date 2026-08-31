import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getOrganizationById, updateOrganization } from '../../api/organizations';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

const BLANK_FORM = {
  organizationName: '',
  organizationCode: '',
  registrationNumber: '',
  gstNumber: '',
  contactPerson: '',
  address: '',
  mobileNumber: '',
  email: '',
  city: '',
  state: '',
  country: '',
  maximumAmbulanceLimit: '',
  maximumDriverLimit: '',
  maximumUserLimit: '',
};

export default function EditOrganizationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { organizationId } = route.params;

  const [form, setForm] = useState(BLANK_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const loadOrganization = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOrganizationById(organizationId);
      if (res.data.success) {
        const org = res.data.organization;
        setForm({
          organizationName: org.organizationName || '',
          organizationCode: org.organizationCode || '',
          registrationNumber: org.registrationNumber || '',
          gstNumber: org.gstNumber || '',
          contactPerson: org.contactPerson || '',
          address: org.address || '',
          mobileNumber: org.mobileNumber || '',
          email: org.email || '',
          city: org.city || '',
          state: org.state || '',
          country: org.country || '',
          maximumAmbulanceLimit: org.maximumAmbulanceLimit?.toString() || '',
          maximumDriverLimit: org.maximumDriverLimit?.toString() || '',
          maximumUserLimit: org.maximumUserLimit?.toString() || '',
        });
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

  const validateForm = () => {
    const newErrors = {};
    
    if (!form.organizationName.trim()) newErrors.organizationName = 'Organization name is required';
    if (!form.organizationCode.trim()) newErrors.organizationCode = 'Organization code is required';
    if (!form.contactPerson.trim()) newErrors.contactPerson = 'Contact person is required';
    if (!form.mobileNumber.trim()) newErrors.mobileNumber = 'Mobile number is required';
    if (!/^[0-9]{10,15}$/.test(form.mobileNumber)) newErrors.mobileNumber = 'Invalid mobile number';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.state.trim()) newErrors.state = 'State is required';
    if (!form.country.trim()) newErrors.country = 'Country is required';
    
    const maxAmb = parseInt(form.maximumAmbulanceLimit);
    if (!form.maximumAmbulanceLimit || isNaN(maxAmb) || maxAmb < 1) {
      newErrors.maximumAmbulanceLimit = 'Valid limit required';
    }
    
    const maxDriver = parseInt(form.maximumDriverLimit);
    if (!form.maximumDriverLimit || isNaN(maxDriver) || maxDriver < 1) {
      newErrors.maximumDriverLimit = 'Valid limit required';
    }
    
    const maxUser = parseInt(form.maximumUserLimit);
    if (!form.maximumUserLimit || isNaN(maxUser) || maxUser < 1) {
      newErrors.maximumUserLimit = 'Valid limit required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        organizationName: form.organizationName,
        organizationCode: form.organizationCode,
        registrationNumber: form.registrationNumber,
        gstNumber: form.gstNumber,
        contactPerson: form.contactPerson,
        address: form.address,
        mobileNumber: form.mobileNumber,
        email: form.email,
        city: form.city,
        state: form.state,
        country: form.country,
        maximumAmbulanceLimit: parseInt(form.maximumAmbulanceLimit),
        maximumDriverLimit: parseInt(form.maximumDriverLimit),
        maximumUserLimit: parseInt(form.maximumUserLimit),
      };

      const res = await updateOrganization(organizationId, payload);
      
      if (res.data.success) {
        Alert.alert('Success', 'Organization updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', res.data.message || 'Failed to update organization');
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Organization</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.noticeCard}>
          <MaterialCommunityIcons name="information" size={20} color={Colors.warning} />
          <Text style={styles.noticeText}>
            Status and lifecycle fields are managed separately. Use the Details screen to activate, suspend, or delete organizations.
          </Text>
        </View>

        <Input
          label="Organization Name *"
          value={form.organizationName}
          onChangeText={(v) => updateField('organizationName', v)}
          placeholder="Enter organization name"
          error={errors.organizationName}
          leftIcon={<MaterialCommunityIcons name="office-building" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Organization Code *"
          value={form.organizationCode}
          onChangeText={(v) => updateField('organizationCode', v.toUpperCase())}
          placeholder="e.g., ABTS-001"
          error={errors.organizationCode}
          leftIcon={<MaterialCommunityIcons name="tag" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Registration Number"
          value={form.registrationNumber}
          onChangeText={(v) => updateField('registrationNumber', v)}
          placeholder="Enter registration number"
          leftIcon={<MaterialCommunityIcons name="file-document" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="GST Number"
          value={form.gstNumber}
          onChangeText={(v) => updateField('gstNumber', v.toUpperCase())}
          placeholder="Enter GST number"
          leftIcon={<MaterialCommunityIcons name="receipt" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Contact Person *"
          value={form.contactPerson}
          onChangeText={(v) => updateField('contactPerson', v)}
          placeholder="Enter contact person name"
          error={errors.contactPerson}
          leftIcon={<MaterialCommunityIcons name="account" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Address"
          value={form.address}
          onChangeText={(v) => updateField('address', v)}
          placeholder="Enter full address"
          multiline
          leftIcon={<MaterialCommunityIcons name="map-marker" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Mobile Number *"
          value={form.mobileNumber}
          onChangeText={(v) => updateField('mobileNumber', v.replace(/[^0-9]/g, ''))}
          placeholder="10-15 digit mobile number"
          keyboardType="phone-pad"
          error={errors.mobileNumber}
          leftIcon={<MaterialCommunityIcons name="phone" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Email *"
          value={form.email}
          onChangeText={(v) => updateField('email', v.toLowerCase())}
          placeholder="Enter email address"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
          leftIcon={<MaterialCommunityIcons name="email" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="City *"
          value={form.city}
          onChangeText={(v) => updateField('city', v)}
          placeholder="Enter city"
          error={errors.city}
          leftIcon={<MaterialCommunityIcons name="city" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="State *"
          value={form.state}
          onChangeText={(v) => updateField('state', v)}
          placeholder="Enter state"
          error={errors.state}
          leftIcon={<MaterialCommunityIcons name="map" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Country *"
          value={form.country}
          onChangeText={(v) => updateField('country', v)}
          placeholder="Enter country"
          error={errors.country}
          leftIcon={<MaterialCommunityIcons name="earth" size={20} color={Colors.textMuted} />}
        />

        <Text style={styles.sectionTitle}>Limits</Text>

        <Input
          label="Max Ambulance Limit *"
          value={form.maximumAmbulanceLimit}
          onChangeText={(v) => updateField('maximumAmbulanceLimit', v)}
          placeholder="Maximum ambulances allowed"
          keyboardType="numeric"
          error={errors.maximumAmbulanceLimit}
          leftIcon={<MaterialCommunityIcons name="ambulance" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Max Driver Limit *"
          value={form.maximumDriverLimit}
          onChangeText={(v) => updateField('maximumDriverLimit', v)}
          placeholder="Maximum drivers allowed"
          keyboardType="numeric"
          error={errors.maximumDriverLimit}
          leftIcon={<MaterialCommunityIcons name="steering" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Max User Limit *"
          value={form.maximumUserLimit}
          onChangeText={(v) => updateField('maximumUserLimit', v)}
          placeholder="Maximum users allowed"
          keyboardType="numeric"
          error={errors.maximumUserLimit}
          leftIcon={<MaterialCommunityIcons name="account-multiple" size={20} color={Colors.textMuted} />}
        />

        <View style={styles.buttonContainer}>
          <Button
            title="Save Changes"
            onPress={handleSubmit}
            loading={saving}
            disabled={saving}
          />
          <Button
            title="Cancel"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={{ marginTop: Spacing.sm }}
          />
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
  container: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.light,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  buttonContainer: {
    marginTop: Spacing.xl,
  },
});
