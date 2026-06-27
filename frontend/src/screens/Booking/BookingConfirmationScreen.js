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
import Input  from '../../components/common/Input';
import { Colors, Spacing, BorderRadius, Typography } from '../../theme';
import { formatCurrency, formatDistance, formatETA, getAmbulanceType, haversineDistance } from '../../utils/helpers';
import { EMERGENCY_TYPES, PAYMENT_METHODS, FACILITIES } from '../../utils/constants';

export default function BookingConfirmationScreen({ route, navigation }) {
  const { ambulance, location, selectedFacilities } = route.params || {};
  const dispatch = useDispatch();
  const { isCreating, current: booking, error } = useSelector((s) => s.booking);

  const [emergencyType,  setEmergencyType]  = useState('general');
  const [paymentMethod,  setPaymentMethod]  = useState('cash');
  const [patientDetails, setPatientDetails] = useState({ name: '', age: '', condition: '', bloodGroup: '' });
  const [emergencyContact, setEmergencyContact] = useState({ name: '', phone: '' });
  const [showConfirmOverlay, setShowConfirmOverlay] = useState(false);
  const [requiredFacilities, setRequiredFacilities] = useState(selectedFacilities || []);
  const [guardianName, setGuardianName] = useState('');
  const [relation, setRelation] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);

  // Address fetching logic
  const [displayAddress, setDisplayAddress] = useState(route.params?.searchText || '');
  
  useEffect(() => {
    if (!displayAddress && location) {
      const fetchAddress = async () => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}`, {
            headers: {
              'User-Agent': 'ABTS-App/1.0',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          });
          const data = await res.json();
          if (data && data.display_name) {
            setDisplayAddress(data.display_name);
          } else {
            setDisplayAddress('Current GPS Location');
          }
        } catch (e) {
          setDisplayAddress('Current GPS Location');
        }
      };
      fetchAddress();
    }
  }, [location, displayAddress]);

  // Pickup location (editable, pre-filled from home screen)
  const [pickupAddress,    setPickupAddress]    = useState(route.params?.searchText || '');
  const [pickupCoords,     setPickupCoords]     = useState(location || null);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [pickupSugLoading,  setPickupSugLoading]  = useState(false);
  const [showPickupSug,     setShowPickupSug]     = useState(false);
  const pickupDebounceRef = useRef(null);

  // Drop location
  const [dropAddress,    setDropAddress]    = useState('');
  const [dropCoords,     setDropCoords]     = useState(null);
  const [dropSuggestions, setDropSuggestions] = useState([]);
  const [dropSugLoading,  setDropSugLoading]  = useState(false);
  const [showDropSug,     setShowDropSug]     = useState(false);
  const dropDebounceRef = useRef(null);

  const nominatimSearch = useCallback(async (query) => {
    // Bug #8 fix: bias results near ambulance / pickup coords
    const biasLat = pickupCoords?.latitude  ?? location?.latitude  ?? 12.9716;
    const biasLng = pickupCoords?.longitude ?? location?.longitude ?? 77.5946;
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
  }, [pickupCoords, location]);

  const fetchPickupSuggestions = useCallback(async (query) => {
    if (!query || query.length < 3) { setPickupSuggestions([]); return; }
    setPickupSugLoading(true);
    try { setPickupSuggestions(await nominatimSearch(query)); }
    catch (_) { setPickupSuggestions([]); }
    finally { setPickupSugLoading(false); }
  }, [nominatimSearch]);

  const handlePickupTextChange = (text) => {
    setPickupAddress(text);
    setPickupCoords(null); // coords invalidated until user picks suggestion
    setShowPickupSug(true);
    clearTimeout(pickupDebounceRef.current);
    pickupDebounceRef.current = setTimeout(() => fetchPickupSuggestions(text), 400);
  };

  const handleSelectPickupSuggestion = (s) => {
    setPickupAddress(s.shortLabel);
    setPickupCoords({ latitude: s.lat, longitude: s.lng });
    setPickupSuggestions([]);
    setShowPickupSug(false);
  };

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

  const typeConfig = ambulance ? getAmbulanceType(ambulance.type) : { label: 'Unknown', color: '#757575' };

  // Estimated fare calculation
  const distanceKm = ambulance?.distanceKm ?? 5;
  const fare = {
    base:  ambulance?.basePrice ?? 0,
    perKm: (ambulance?.pricePerKm ?? 0) * distanceKm,
    total: (ambulance?.basePrice ?? 0) + (ambulance?.pricePerKm ?? 0) * distanceKm,
  };

  // Once booking is created, move to tracking or confirmation
  useEffect(() => {
    if (booking && booking.status === 'pending') {
      navigation.replace('LiveTracking', { bookingId: booking._id });
    }
  }, [booking]);

  const doBooking = async () => {
    // Prefer user-selected/edited pickup coords over raw GPS fallback
    const resolvedPickup = pickupCoords || location;

    const result = await dispatch(
      createBooking({
        ambulanceId: ambulance._id,
        pickupLocation: {
          type: 'Point',
          coordinates: resolvedPickup ? [resolvedPickup.longitude, resolvedPickup.latitude] : [0, 0],
          address: displayAddress.trim() || 
                   (resolvedPickup ? `Current GPS Location (${resolvedPickup.latitude.toFixed(5)}, ${resolvedPickup.longitude.toFixed(5)})` : 'Current GPS Location'),
        },
        // Drop location is fully optional — only include it if coords were resolved from a suggestion
        dropLocation: (dropCoords && dropAddress)
          ? { type: 'Point', coordinates: [dropCoords.longitude, dropCoords.latitude], address: dropAddress }
          : undefined,
        emergencyType,
        requiredFacilities,
        patientConsent: {
          accepted: consentAccepted,
          acceptedAt: new Date().toISOString(),
          guardianName,
          relation,
          emergencyRiskAccepted: riskAccepted,
        },
        patientDetails: {
          name: patientDetails.name,
          age:  patientDetails.age ? parseInt(patientDetails.age) : undefined,
          condition: patientDetails.condition,
          bloodGroup: patientDetails.bloodGroup || undefined,
          emergencyContact: {
            name:  emergencyContact.name,
            phone: emergencyContact.phone,
          },
        },
        estimatedDistance: distanceKm,
        paymentMethod,
      })
    );

    if (createBooking.rejected.match(result)) {
      showAlert('Booking Failed', result.payload || 'Could not create booking. Please try again.');
    }
  };

  // Cross-platform alert helper
  const showAlert = (title, msg) => {
    if (Platform.OS === 'web') { window.alert(`${title}\n\n${msg}`); }
    else { Alert.alert(title, msg); }
  };

  const handleConfirm = () => {
    // Consent is still required
    if (!consentAccepted || !riskAccepted) {
      showAlert('Consent Required', 'Please scroll to the bottom and accept both the patient consent terms and emergency risk acknowledgement.');
      return;
    }
    setShowConfirmOverlay(true);
  };

  if (!ambulance) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg }}>
          <Text style={{ fontSize: 16, color: Colors.text, marginBottom: 16, textAlign: 'center' }}>
            No ambulance selected. Please go back and select an ambulance.
          </Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

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

        {/* Patient Details */}
        <Card shadow="light" style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Details (Optional)</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="Patient Name"
                value={patientDetails.name}
                onChangeText={(v) => setPatientDetails((p) => ({ ...p, name: v }))}
                placeholder="Full name"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="Age"
                value={patientDetails.age}
                onChangeText={(v) => setPatientDetails((p) => ({ ...p, age: v }))}
                placeholder="Age"
                keyboardType="numeric"
              />
            </View>
          </View>

          <Input
            label="Condition / Notes"
            value={patientDetails.condition}
            onChangeText={(v) => setPatientDetails((p) => ({ ...p, condition: v }))}
            placeholder="Briefly describe the condition…"
            multiline
            numberOfLines={3}
          />

          {/* Emergency Contact */}
          <Text style={[styles.inputLabel, { marginTop: Spacing.md, marginBottom: 8 }]}>Emergency Contact</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Input
                label="Contact Name"
                value={emergencyContact.name}
                onChangeText={(v) => setEmergencyContact((c) => ({ ...c, name: v }))}
                placeholder="Full name"
              />
            </View>
            <View style={styles.inputHalf}>
              <Input
                label="Contact Phone"
                value={emergencyContact.phone}
                onChangeText={(v) => setEmergencyContact((c) => ({ ...c, phone: v }))}
                placeholder="10-digit number"
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
              <Input
                style={{ marginBottom: 0 }}
                leftIcon={<MaterialCommunityIcons name="hospital-marker" size={18} color={Colors.secondary} />}
                value={dropAddress}
                onChangeText={handleDropTextChange}
                placeholder="Hospital name or address"
                onFocus={() => dropAddress.length >= 3 && setShowDropSug(true)}
                onBlur={() => setTimeout(() => setShowDropSug(false), 150)}
                returnKeyType="search"
                rightIcon={
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {dropSugLoading && <ActivityIndicator size="small" color={Colors.secondary} style={{ marginRight: 6 }} />}
                    {dropAddress.length > 0 && !dropSugLoading && (
                      <TouchableOpacity onPress={() => { setDropAddress(''); setDropCoords(null); setDropSuggestions([]); }}>
                        <MaterialCommunityIcons name="close-circle" size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                }
              />
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

          <Input
            placeholder="Guardian / Patient Name"
            value={guardianName}
            onChangeText={setGuardianName}
          />
          <Input
            placeholder="Relation (Father, Mother, Brother…)"
            value={relation}
            onChangeText={setRelation}
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
                {displayAddress.trim() || 'Current GPS Location'}
              </Text>
            </View>

            {location && (
              <Text style={styles.overlayCoords}>
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </Text>
            )}

            <Text style={styles.overlayQuestion}>Is this the correct pickup location?</Text>

            <View style={styles.overlayActions}>
              <TouchableOpacity
                style={styles.overlayEditBtn}
                onPress={() => {
                  setShowConfirmOverlay(false);
                  navigation.navigate('Home');
                }}
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
    ...Platform.select({ web: { outlineStyle: 'none' } })
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
  dropInput:  {
    flex: 1, fontSize: 14, color: Colors.text, paddingVertical: Spacing.sm,
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
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

