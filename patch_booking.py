import re

with open('frontend/src/screens/Booking/BookingConfirmationScreen.js', 'r') as f:
    content = f.read()

# 1. Add FACILITIES import
content = content.replace(
    "import { EMERGENCY_TYPES, PAYMENT_METHODS } from '../../utils/constants';",
    "import { EMERGENCY_TYPES, PAYMENT_METHODS, FACILITIES } from '../../utils/constants';"
)

# 2. Add state hooks
hook_replacement = """  const [showConfirmOverlay, setShowConfirmOverlay] = useState(false);
  const [requiredFacilities, setRequiredFacilities] = useState([]);
  const [guardianName, setGuardianName] = useState('');
  const [relation, setRelation] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);"""
content = content.replace("  const [showConfirmOverlay, setShowConfirmOverlay] = useState(false);", hook_replacement)

# 3. Add to doBooking payload
payload_original = """      paymentMethod,
    };"""
payload_replacement = """      paymentMethod,
      requiredFacilities,
      patientConsent: {
        accepted: consentAccepted,
        acceptedAt: new Date().toISOString(),
        guardianName,
        relation,
        emergencyRiskAccepted: riskAccepted,
      },
    };"""
content = content.replace(payload_original, payload_replacement)

# 4. Add validation
validation_original = """    if (!dropCoords) {
      Alert.alert('Validation Error', 'Please select a valid drop location.');
      return;
    }"""
validation_replacement = """    if (!dropCoords) {
      Alert.alert('Validation Error', 'Please select a valid drop location.');
      return;
    }
    if (!consentAccepted || !riskAccepted) {
      Alert.alert('Consent Required', 'Please accept the patient consent and emergency risk terms to proceed.');
      return;
    }"""
content = content.replace(validation_original, validation_replacement)

# 5. Add required facilities UI (after Emergency Type picker)
facilities_ui = """
          <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>Required Facilities (Optional)</Text>
          <View style={styles.facilityChips}>
            {FACILITIES.map((fac) => (
              <TouchableOpacity
                key={fac.key}
                style={[
                  styles.facilityChip,
                  { backgroundColor: requiredFacilities.includes(fac.key) ? Colors.primary : Colors.background },
                ]}
                onPress={() => {
                  setRequiredFacilities((prev) =>
                    prev.includes(fac.key) ? prev.filter((k) => k !== fac.key) : [...prev, fac.key]
                  );
                }}
              >
                <MaterialCommunityIcons
                  name={fac.icon}
                  size={16}
                  color={requiredFacilities.includes(fac.key) ? Colors.white : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.facilityChipText,
                    { color: requiredFacilities.includes(fac.key) ? Colors.white : Colors.textSecondary },
                  ]}
                >
                  {fac.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
"""
content = content.replace("          {/* Payment Method */}", facilities_ui + "          {/* Payment Method */}")

# 6. Add Consent UI (before ScrollView closing)
consent_ui = """
        {/* Patient Consent & Risk Acknowledgement */}
        <Card shadow="medium" style={styles.consentCard}>
          <Text style={styles.consentTitle}>
            Patient Consent & Risk Acknowledgement
          </Text>

          <Text style={styles.consentText}>
            I understand that ambulance transportation and emergency medical services may involve risks depending on patient condition, traffic, delays, or medical emergencies.
          </Text>

          <Text style={styles.consentText}>
            I confirm that the patient details provided are correct and I accept emergency transportation risks and medical support conditions.
          </Text>

          <TextInput
            placeholder="Guardian / Patient Name"
            value={guardianName}
            onChangeText={setGuardianName}
            style={styles.input}
          />

          <TextInput
            placeholder="Relation (Father, Brother, etc.)"
            value={relation}
            onChangeText={setRelation}
            style={styles.input}
          />

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setConsentAccepted(!consentAccepted)}
          >
            <MaterialCommunityIcons
              name={consentAccepted ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={Colors.primary}
            />
            <Text style={styles.checkboxText}>
              I agree to patient consent terms.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setRiskAccepted(!riskAccepted)}
          >
            <MaterialCommunityIcons
              name={riskAccepted ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={Colors.primary}
            />
            <Text style={styles.checkboxText}>
              I understand emergency transportation risks.
            </Text>
          </TouchableOpacity>
        </Card>
"""
content = content.replace("        <View style={{ height: 160 }} />", consent_ui + "        <View style={{ height: 160 }} />")

# 7. Add Styles
styles_injection = """
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
  },
  consentTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: Colors.text,
  },
  consentText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 10,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  checkboxText: {
    marginLeft: 10,
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
});
"""

parts = content.rsplit("});", 1)
content = styles_injection.join(parts)

with open('frontend/src/screens/Booking/BookingConfirmationScreen.js', 'w') as f:
    f.write(content)

