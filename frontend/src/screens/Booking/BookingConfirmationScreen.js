import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { createBooking, clearCurrent } from '../../store/bookingSlice';
import Button from '../../components/common/Button';
import Card   from '../../components/common/Card';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';
import { formatCurrency, formatDistance, formatETA, getAmbulanceType, haversineDistance } from '../../utils/helpers';
import { EMERGENCY_TYPES, PAYMENT_METHODS, FACILITIES } from '../../utils/constants';

export default function BookingConfirmationScreen({ route, navigation }) {
  // Defensive route.params extraction with fallbacks
  const {
    ambulance,
    location,
    selectedFacilities: passedFacilities = [],
    searchText = 'Current Location',
  } = route.params || {};
  
  // Ensure selectedFacilities is always an array
  const selectedFacilities = Array.isArray(passedFacilities) ? passedFacilities : [];
  
  // Log received parameters for debugging
  console.log('[BookingConfirmationScreen] Route params:', {
    ambulanceId: ambulance?._id,
    location: { lat: location?.latitude, lng: location?.longitude },
    selectedFacilitiesReceived: passedFacilities,
    selectedFacilitiesProcessed: selectedFacilities,
    searchText,
  });
  
  const dispatch = useDispatch();
  const { isCreating, current: booking, error } = useSelector((s) => s.booking);

  const [emergencyType,  setEmergencyType]  = useState('general');
  const [paymentMethod,  setPaymentMethod]  = useState('cash');
  const [patientDetails, setPatientDetails] = useState({ name: '', age: '', condition: '', bloodGroup: '' });
  const [emergencyContact, setEmergencyContact] = useState({ name: '', phone: '' });
  const [showConfirmOverlay, setShowConfirmOverlay] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [relation, setRelation] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);

  // Pickup location (readonly, pre-filled from home screen via navigation params)
  const pickupAddress = searchText || 'Current Location';
  const pickupCoords = location || null;

  // Drop location (editable)
  const [dropAddress,    setDropAddress]    = useState('');
  const [dropCoords,     setDropCoords]     = useState(null);
  const [dropSuggestions, setDropSuggestions] = useState([]);
  const [dropSugLoading,  setDropSugLoading]  = useState(false);
  const [showDropSug,     setShowDropSug]     = useState(false);
  const dropDebounceRef = useRef(null);

  const nominatimSearch = useCallback(async (query) => {
    // Bias results near pickup location for better local search
    const biasLat = pickupCoords?.latitude  ?? 12.9716;
    const biasLng = pickupCoords?.longitude ?? 77.5946;
    const viewbox = `${biasLng - 0.5},${biasLat + 0.5},${biasLng + 0.5},${biasLat - 0.5}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&countrycodes=in&viewbox=${viewbox}&bounded=0`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    return data.map((r) => ({
      label:     r.display_name,
      shortLabel: [r.address?.road, r.address?.suburb, r.address?.city || r.address?.town || r.address?.village]
                    .filter(Boolean).join(', ') || r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  }, [pickupCoords]);

  const fetchDropSuggestions = useCallback(async (query) => {
    if (!query || query.length < 3) { setDropSuggestions([]); return; }
    setDropSugLoading(true);
    try { setDropSuggestions(await nominatimSearch(query)); }
    catch (_) { setDropSuggestions([]); }
    finally { setDropSugLoading(false); }
  }, [nominatimSearch]);

  const handleDropTextChange = (text) => {
    setDropAddress(text);
    setShowDropSug(true);
    clearTimeout(dropDebounceRef.current);
    dropDebounceRef.current = setTimeout(() => fetchDropSuggestions(text), 400);
  };

  const handleSelectDropSuggestion = (s) => {
    setDropAddress(s.shortLabel);
    setDropCoords({ latitude: s.lat, longitude: s.lng });
    setDropSuggestions([]);
    setShowDropSug(false);
  };

  // Clear any stale booking from previous session on mount
  useEffect(() => { dispatch(clearCurrent()); }, [dispatch]);

  const typeConfig = getAmbulanceType(ambulance.type);

  // Estimated fare calculation
  const distanceKm = ambulance.distanceKm ?? 5;
  const fare = {
    base:  ambulance.basePrice,
    perKm: ambulance.pricePerKm * distanceKm,
    total: ambulance.basePrice + ambulance.pricePerKm * distanceKm,
  };

  // Once booking is created, move to tracking or confirmation
  useEffect(() => {
    if (booking && booking.status === 'pending') {
      navigation.replace('LiveTracking', { bookingId: booking._id });
    }
  }, [booking]);

  const doBooking = async () => {
    // Validate ambulance and location
    if (!ambulance) {
      Alert.alert('Error', 'Ambulance information is missing. Please go back and select an ambulance.');
      return;
    }

    if (!ambulance._id) {
      Alert.alert('Error', 'Invalid ambulance ID. Please try again.');
      return;
    }

    const resolvedPickup = pickupCoords || location;

    // Validate pickup location
    if (!resolvedPickup) {
      Alert.alert('Error', 'Pickup location is required. Please go back and select a location.');
      return;
    }

    if (!resolvedPickup.latitude || !resolvedPickup.longitude) {
      Alert.alert('Error', 'Invalid pickup coordinates. Please try again.');
      return;
    }

    // Validate patient details
    if (!patientDetails.name || patientDetails.name.trim() === '') {
      Alert.alert('Validation Error', 'Please enter patient name.');
      return;
    }

    if (!emergencyContact.phone || emergencyContact.phone.trim() === '') {
      Alert.alert('Validation Error', 'Please enter emergency contact phone number.');
      return;
    }

    // Build booking data
    const bookingData = {
      ambulanceId: ambulance._id,
      pickupLocation: {
        type: 'Point',
        coordinates: [resolvedPickup.longitude, resolvedPickup.latitude],
        address: pickupAddress || 'Current Location',
      },
      dropLocation: (dropCoords && dropAddress)
        ? {
            type: 'Point',
            coordinates: [dropCoords.longitude, dropCoords.latitude],
            address: dropAddress,
          }
        : undefined,
      emergencyType,
      patientDetails: {
        name: patientDetails.name,
        age: patientDetails.age ? parseInt(patientDetails.age, 10) : undefined,
        condition: patientDetails.condition,
        bloodGroup: patientDetails.bloodGroup || 'unknown',
        emergencyContact: {
          name: emergencyContact.name,
          phone: emergencyContact.phone,
        },
      },
      estimatedDistance: distanceKm,
      paymentMethod,
      requiredFacilities: selectedFacilities && Array.isArray(selectedFacilities) ? selectedFacilities : [],
      patientConsent: {
        accepted: consentAccepted,
        acceptedAt: new Date(),
        guardianName,
        relation,
        emergencyRiskAccepted: riskAccepted,
      },
    };

    // Log the complete booking payload for debugging
    console.log(
      'FINAL BOOKING PAYLOAD:',
      JSON.stringify(bookingData, null, 2)
    );

    // Additional validation logs
    console.log('Booking Validation Checks:');
    console.log('✓ Ambulance ID:', ambulance._id);
    console.log('✓ Pickup Coordinates:', bookingData.pickupLocation.coordinates);
    console.log('✓ Patient Name:', bookingData.patientDetails.name);
    console.log('✓ Emergency Contact Phone:', bookingData.patientDetails.emergencyContact.phone);
    console.log('✓ Required Facilities:', bookingData.requiredFacilities);
    console.log('✓ Emergency Type:', emergencyType);
    console.log('✓ Payment Method:', paymentMethod);

    try {
      const result = await dispatch(createBooking(bookingData));

      if (result.type === 'booking/create/fulfilled') {
        // Booking successful - handled by useEffect above
        console.log('✓ Booking created successfully:', result.payload);
      } else if (result.type === 'booking/create/rejected') {
        // Booking failed - show backend error
        const errorMsg = result.payload || 'Could not create booking. Please try again.';
        console.error('❌ Booking rejected:', errorMsg);
        Alert.alert('Booking Failed', errorMsg);
      }
    } catch (error) {
      // Catch any unexpected errors
      console.error('❌ BOOKING ERROR:', {
        message: error.message,
        response: error.response?.data || error.response,
        status: error.response?.status,
        errorData: error.response?.data?.error,
      });

      const errorMsg = error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || 'Booking failed due to an unexpected error.';

      Alert.alert('Booking Error', errorMsg);
    }
  };

  // Cross-platform alert helper
  const showAlert = (title, msg) => {
    if (Platform.OS === 'web') { window.alert(`${title}\n\n${msg}`); }
    else { Alert.alert(title, msg); }
  };

  const handleConfirm = () => {
    // Validate ambulance selection
    if (!ambulance || !ambulance._id) {
      showAlert('Error', 'Please select a valid ambulance.');
      return;
    }

    // Validate location
    if (!location && !pickupCoords) {
      showAlert('Error', 'Pickup location is required.');
      return;
    }

    // Validate patient name
    if (!patientDetails.name || patientDetails.name.trim() === '') {
      showAlert('Validation Error', 'Please enter patient name.');
      return;
    }

    // Validate emergency contact phone
    if (!emergencyContact.phone || emergencyContact.phone.trim() === '') {
      showAlert('Validation Error', 'Please enter emergency contact phone number.');
      return;
    }

    // Validate consents
    if (!consentAccepted || !riskAccepted) {
      showAlert('Consent Required', 'Please scroll to the bottom and accept both the patient consent terms and emergency risk acknowledgement.');
      return;
    }

    // Log validation success
    console.log('✓ All validations passed before booking');
    setShowConfirmOverlay(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Ambulance Summary */}
        <Card shadow="medium" style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Ambulance</Text>
          <View style={styles.ambRow}>
            <View style={[styles.ambTypePill, { backgroundColor: typeConfig.color }]}>
              <Text style={styles.ambTypeText}>{typeConfig.label}</Text>
            </View>
            <View style={styles.ambInfo}>
              <Text style={styles.ambVehicle}>{ambulance.vehicleNumber}</Text>
              <Text style={styles.ambDriver}>🧑‍✈️ {ambulance.driverName}</Text>
            </View>
            <View>
              <MaterialCommunityIcons name="star" size={14} color="#FFC107" />
              <Text style={styles.ambRating}>{ambulance.rating?.average?.toFixed(1)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Distance</Text>
              <Text style={styles.infoValue}>{formatDistance(distanceKm * 1000)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>ETA</Text>
              <Text style={styles.infoValue}>{formatETA(ambulance.estimatedArrivalMin ?? Math.round(distanceKm * 1.5))}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Base Fare</Text>
              <Text style={styles.infoValue}>{formatCurrency(ambulance.basePrice)}</Text>
            </View>
          </View>
        </Card>

        {/* Pickup Location - Readonly Summary Card */}
        <Card shadow="medium" style={styles.section}>
          <View style={styles.pickupHeader}>
            <MaterialCommunityIcons name="map-marker" size={18} color={Colors.primary} />
            <Text style={styles.pickupLabel}>Pickup Location</Text>
          </View>
          <View style={styles.pickupReadonlyBox}>
            <MaterialCommunityIcons name="map-marker-check" size={24} color={Colors.primary} />
            <View style={styles.pickupTextContainer}>
              <Text style={styles.pickupAddress} numberOfLines={2}>{pickupAddress}</Text>
              {pickupCoords && (
                <Text style={styles.pickupCoords}>
                  {pickupCoords.latitude.toFixed(5)}, {pickupCoords.longitude.toFixed(5)}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Emergency Type */}
        <Card shadow="light" style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Type</Text>
          <View style={styles.chipGrid}>
            {EMERGENCY_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.eChip, emergencyType === t.value && styles.eChipActive]}
                onPress={() => setEmergencyType(t.value)}
              >
                <MaterialCommunityIcons
                  name={t.icon}
                  size={16}
                  color={emergencyType === t.value ? Colors.white : Colors.textSecondary}
                />
                <Text style={[styles.eChipText, emergencyType === t.value && styles.eChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Patient Details */}
        <Card shadow="light" style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Details (Optional)</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Patient Name</Text>
              <TextInput
                style={styles.input}
                value={patientDetails.name}
                onChangeText={(v) => setPatientDetails((p) => ({ ...p, name: v }))}
                placeholder="Full name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Age</Text>
              <TextInput
                style={styles.input}
                value={patientDetails.age}
                onChangeText={(v) => setPatientDetails((p) => ({ ...p, age: v }))}
                placeholder="Age"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Condition / Notes</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={patientDetails.condition}
            onChangeText={(v) => setPatientDetails((p) => ({ ...p, condition: v }))}
            placeholder="Briefly describe the condition…"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
          />

          {/* Blood Group - Bug #9 fix: no pre-selected 'unknown' */}
          <Text style={[styles.inputLabel, { marginTop: Spacing.md, marginBottom: 8 }]}>Blood Group (Optional)</Text>
          <View style={styles.bloodGroupGrid}>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].map((bg) => (
              <TouchableOpacity
                key={bg}
                style={[styles.bgChip, patientDetails.bloodGroup === bg.toLowerCase().replace('+','+').replace('-','-') && styles.bgChipActive]}
                onPress={() => setPatientDetails((p) => ({ ...p, bloodGroup: bg === 'Unknown' ? 'unknown' : bg }))}
              >
                <Text style={[styles.bgChipText, patientDetails.bloodGroup === (bg === 'Unknown' ? 'unknown' : bg) && styles.bgChipTextActive]}>{bg}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Emergency Contact */}
          <Text style={[styles.inputLabel, { marginTop: Spacing.md, marginBottom: 8 }]}>Emergency Contact</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Contact Name</Text>
              <TextInput
                style={styles.input}
                value={emergencyContact.name}
                onChangeText={(v) => setEmergencyContact((c) => ({ ...c, name: v }))}
                placeholder="Full name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Contact Phone</Text>
              <TextInput
                style={styles.input}
                value={emergencyContact.phone}
                onChangeText={(v) => setEmergencyContact((c) => ({ ...c, phone: v }))}
                placeholder="10-digit number"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
          </View>
        </Card>

        {/* Drop Location */}
        <Card shadow="light" style={[styles.section, { zIndex: 10, overflow: 'visible' }]}>
          <Text style={styles.sectionTitle}>Drop Location (Optional)</Text>
          <View style={styles.dropWrapper}>
            <View style={styles.dropInputRow}>
              <MaterialCommunityIcons name="hospital-marker" size={18} color={Colors.secondary} style={styles.dropIcon} />
              <TextInput
                style={styles.dropInput}
                value={dropAddress}
                onChangeText={handleDropTextChange}
                placeholder="Hospital name or address"
                placeholderTextColor={Colors.textMuted}
                onFocus={() => dropAddress.length >= 3 && setShowDropSug(true)}
                onBlur={() => setTimeout(() => setShowDropSug(false), 150)}
                returnKeyType="search"
              />
              {dropSugLoading && <ActivityIndicator size="small" color={Colors.secondary} style={{ marginLeft: 6 }} />}
              {dropAddress.length > 0 && !dropSugLoading && (
                <TouchableOpacity onPress={() => { setDropAddress(''); setDropCoords(null); setDropSuggestions([]); }}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            {showDropSug && dropSuggestions.length > 0 && (
              <View style={styles.dropSugBox}>
                {dropSuggestions.map((s, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.dropSugItem, idx < dropSuggestions.length - 1 && styles.dropSugBorder]}
                    onPress={() => handleSelectDropSuggestion(s)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="map-marker-outline" size={15} color={Colors.secondary} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dropSugShort} numberOfLines={1}>{s.shortLabel}</Text>
                      <Text style={styles.dropSugFull}  numberOfLines={1}>{s.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </Card>

        {/* Selected Facilities (readonly) — from HomeScreen selection */}
        <Card shadow="light" style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Facilities</Text>
          {selectedFacilities && selectedFacilities.length > 0 ? (
            <>
              <Text style={[styles.inputLabel, { marginBottom: 10 }]}>
                Special facilities needed for this booking
              </Text>
              <View style={styles.facilityChips}>
                {FACILITIES.filter((f) => selectedFacilities.includes(f.key)).map((fac) => (
                  <View
                    key={fac.key}
                    style={[
                      styles.facilityChip,
                      { backgroundColor: Colors.primary, opacity: 0.9 },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={fac.icon}
                      size={16}
                      color={Colors.white}
                    />
                    <Text style={[styles.facilityChipText, { color: Colors.white }]}>
                      {fac.label}
                    </Text>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={14}
                      color={Colors.white}
                      style={{ marginLeft: 4 }}
                    />
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.emptyFacilitiesBox}>
              <MaterialCommunityIcons name="information-outline" size={24} color={Colors.textSecondary} />
              <Text style={styles.emptyFacilitiesText}>No special facilities selected</Text>
            </View>
          )}
        </Card>

        {/* Payment Method */}
        <Card shadow="light" style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.payRow}>
            {PAYMENT_METHODS.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={[styles.payChip, paymentMethod === m.value && styles.payChipActive]}
                onPress={() => setPaymentMethod(m.value)}
              >
                <Text style={[styles.payText, paymentMethod === m.value && styles.payTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Fare Breakdown */}
        <Card shadow="light" style={styles.section}>
          <Text style={styles.sectionTitle}>Fare Estimate</Text>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Base Fare</Text>
            <Text style={styles.fareValue}>{formatCurrency(fare.base)}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>{distanceKm.toFixed(1)} km × {formatCurrency(ambulance.pricePerKm)}</Text>
            <Text style={styles.fareValue}>{formatCurrency(fare.perKm)}</Text>
          </View>
          <View style={[styles.fareRow, styles.fareTotalRow]}>
            <Text style={styles.fareTotalLabel}>Total Estimate</Text>
            <Text style={styles.fareTotalValue}>{formatCurrency(fare.total)}</Text>
          </View>
          <Text style={styles.fareDisclaimer}>* Final fare may vary based on actual distance</Text>
        </Card>

        {/* Patient Consent & Risk Acknowledgement */}
        <Card shadow="medium" style={styles.consentCard}>
          <View style={styles.consentHeader}>
            <MaterialCommunityIcons name="shield-check" size={22} color={Colors.primary} />
            <Text style={styles.consentTitle}>Patient Consent & Risk Acknowledgement</Text>
          </View>

          <Text style={styles.consentText}>
            I understand that ambulance transportation involves risks depending on patient condition,
            traffic, delays, or medical emergencies.
          </Text>
          <Text style={styles.consentText}>
            I confirm the patient details provided are correct and accept emergency transportation
            terms and medical support conditions.
          </Text>

          <TextInput
            placeholder="Guardian / Patient Name"
            value={guardianName}
            onChangeText={setGuardianName}
            style={styles.input}
            placeholderTextColor={Colors.textMuted}
          />
          <TextInput
            placeholder="Relation (Father, Mother, Brother…)"
            value={relation}
            onChangeText={setRelation}
            style={[styles.input, { marginTop: 8 }]}
            placeholderTextColor={Colors.textMuted}
          />

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setConsentAccepted(!consentAccepted)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={consentAccepted ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={26}
              color={consentAccepted ? Colors.primary : Colors.textMuted}
            />
            <Text style={styles.checkboxText}>
              I agree to the patient consent terms. <Text style={{ color: Colors.error || '#E53935' }}>*</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setRiskAccepted(!riskAccepted)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={riskAccepted ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={26}
              color={riskAccepted ? Colors.primary : Colors.textMuted}
            />
            <Text style={styles.checkboxText}>
              I understand emergency transportation risks. <Text style={{ color: Colors.error || '#E53935' }}>*</Text>
            </Text>
          </TouchableOpacity>

          {(!consentAccepted || !riskAccepted) && (
            <Text style={styles.consentWarning}>
              ⚠️ Both checkboxes must be ticked to confirm booking.
            </Text>
          )}
        </Card>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Confirm Overlay */}
      {showConfirmOverlay && (
        <View style={styles.overlayBackdrop}>
          <View style={styles.overlayCard}>
            <View style={styles.overlayHeader}>
              <MaterialCommunityIcons name="map-marker-check" size={28} color={Colors.primary} />
              <Text style={styles.overlayTitle}>Confirm Pickup Location</Text>
            </View>

            <View style={styles.overlayLocationBox}>
              <MaterialCommunityIcons name="map-marker" size={20} color={Colors.primary} />
              <Text style={styles.overlayLocationText}>
                {pickupAddress.trim() || 'Current GPS Location'}
              </Text>
            </View>

            {pickupCoords && (
              <Text style={styles.overlayCoords}>
                {pickupCoords.latitude.toFixed(5)}, {pickupCoords.longitude.toFixed(5)}
              </Text>
            )}

            <Text style={styles.overlayQuestion}>Is this the correct pickup location?</Text>

            <View style={styles.overlayActions}>
              <TouchableOpacity
                style={styles.overlayEditBtn}
                onPress={() => setShowConfirmOverlay(false)}
              >
                <MaterialCommunityIcons name="pencil" size={16} color={Colors.primary} />
                <Text style={styles.overlayEditText}>Edit Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.overlayConfirmBtn}
                onPress={() => { setShowConfirmOverlay(false); doBooking(); }}
              >
                <MaterialCommunityIcons name="check-circle" size={16} color={Colors.white} />
                <Text style={styles.overlayConfirmText}>Yes, Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Confirm Button */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Estimated Fare</Text>
          <Text style={styles.footerFare}>{formatCurrency(fare.total)}</Text>
        </View>
        <Button
          title="Confirm Booking"
          onPress={handleConfirm}
          loading={isCreating}
          disabled={isCreating}
          size="lg"
          style={styles.confirmBtn}
          icon={<MaterialCommunityIcons name="check-circle" size={20} color={Colors.white} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.md, paddingBottom: 100 },
  section:   { marginBottom: Spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  ambRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  ambTypePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full, minWidth: 60, alignItems: 'center' },
  ambTypeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  ambInfo:   { flex: 1 },
  ambVehicle:{ fontSize: 16, fontWeight: '700', color: Colors.text },
  ambDriver: { fontSize: 13, color: Colors.textSecondary },
  ambRating: { fontSize: 12, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  infoRow:   { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.sm },
  infoItem:  { flex: 1, alignItems: 'center' },
  infoLabel: { fontSize: 11, color: Colors.textSecondary },
  infoValue: { fontSize: 13, fontWeight: '700', color: Colors.text },
  pickupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  pickupLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  pickupReadonlyBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.background, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary,
  },
  pickupTextContainer: { flex: 1 },
  pickupAddress: { fontSize: 15, fontWeight: '600', color: Colors.text, lineHeight: 22 },
  pickupCoords: { fontSize: 11, color: Colors.textMuted, marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  chipGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  eChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  eChipText:   { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  eChipTextActive: { color: Colors.white },
  inputRow:  { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  inputHalf: { flex: 1 },
  inputLabel:{ fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: Spacing.sm,
    fontSize: 14, color: Colors.text, backgroundColor: Colors.surface,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top', marginBottom: 0 },
  payRow:    { flexDirection: 'row', gap: 10 },
  payChip:   { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border },
  payChipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  payText:   { fontSize: 13, color: Colors.text, fontWeight: '500' },
  payTextActive: { color: Colors.white },
  fareRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  fareLabel: { fontSize: 14, color: Colors.textSecondary },
  fareValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
  fareTotalRow:   { borderBottomWidth: 0, marginTop: 4 },
  fareTotalLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  fareTotalValue: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  fareDisclaimer: { fontSize: 11, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'center' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
  },
  footerLabel: { fontSize: 12, color: Colors.textSecondary },
  footerFare:  { fontSize: 20, fontWeight: '800', color: Colors.primary },
  confirmBtn:  { flex: 1, marginLeft: Spacing.lg },

  // Confirm Overlay
  overlayBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 100, padding: Spacing.lg,
  },
  overlayCard: {
    backgroundColor: Colors.surface || '#fff', borderRadius: 20,
    padding: Spacing.lg, width: '100%', maxWidth: 400,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
  },
  overlayHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.md,
  },
  overlayTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  overlayLocationBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.background || '#F5F5F5', borderRadius: 12,
    padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary,
  },
  overlayLocationText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text, lineHeight: 20 },
  overlayCoords: {
    fontSize: 11, color: Colors.textMuted, textAlign: 'center',
    marginTop: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  overlayQuestion: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center',
    marginTop: Spacing.md, marginBottom: Spacing.md,
  },
  overlayActions: { flexDirection: 'row', gap: 10 },
  overlayEditBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.surface || '#fff',
  },
  overlayEditText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  overlayConfirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary,
  },
  overlayConfirmText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  // Blood group chips
  bloodGroupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  bgChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
    minWidth: 52, alignItems: 'center',
  },
  bgChipActive:    { backgroundColor: Colors.error || '#E53935', borderColor: Colors.error || '#E53935' },
  bgChipText:      { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  bgChipTextActive:{ color: Colors.white },

  pickupHint: { fontSize: 12, color: '#E53935', marginTop: 6, marginLeft: 4 },
  dropInputRowError: { borderColor: '#E53935' },

  // Drop location autocomplete
  dropWrapper:   { position: 'relative' },
  dropInputRow:  {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface, minHeight: 44,
  },
  dropIcon:   { marginRight: 6 },
  dropInput:  { flex: 1, fontSize: 14, color: Colors.text, paddingVertical: Spacing.sm },
  dropSugBox: {
    position: 'absolute', top: 48, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
    zIndex: 999, elevation: 10,
    overflow: 'hidden',
  },
  dropSugItem:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.md, backgroundColor: Colors.white },
  dropSugBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropSugShort:  { fontSize: 13, fontWeight: '600', color: Colors.text },
  dropSugFull:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  // Required facilities
  facilityChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  facilityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  facilityChipText: { fontSize: 12, fontWeight: '600' },

  // Empty Facilities State
  emptyFacilitiesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyFacilitiesText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // Patient Consent
  consentCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  consentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  consentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  consentText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  consentWarning: {
    fontSize: 12,
    color: Colors.error || '#E53935',
    marginTop: 12,
    fontWeight: '600',
  },
});

