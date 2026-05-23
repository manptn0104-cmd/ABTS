import re

with open('frontend/src/screens/Home/HomeScreen.js', 'r') as f:
    content = f.read()

# UI
ui_injection = """
        {/* CCTV Safety Card */}
        <View style={styles.cctvCardContainer}>
          <View style={styles.cctvCard}>
            <MaterialCommunityIcons name="cctv" size={28} color={Colors.white} />
            <View style={styles.cctvCardContent}>
              <Text style={styles.cctvCardTitle}>🛡 CCTV Protected Ambulances</Text>
              <Text style={styles.cctvCardSubtitle}>24/7 Safety Monitoring Enabled</Text>
            </View>
            <MaterialCommunityIcons name="shield-check" size={24} color={Colors.white} />
          </View>
        </View>

        {/* Facilities & Equipment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Facilities & Equipment</Text>
          <View style={styles.facilitiesContainer}>
            {FACILITIES.map((facility) => {
              const isSelected = selectedFacilities.includes(facility.key);
              return (
                <TouchableOpacity
                  key={facility.key}
                  style={[
                    styles.facilityChip,
                    isSelected && styles.facilityChipSelected,
                  ]}
                  onPress={() => toggleFacility(facility.key)}
                  activeOpacity={isSelected ? 1 : 0.7}
                >
                  <MaterialCommunityIcons
                    name={facility.icon}
                    size={16}
                    color={isSelected ? Colors.white : Colors.primary}
                  />
                  <Text
                    style={[
                      styles.facilityChipText,
                      isSelected && styles.facilityChipTextSelected,
                    ]}
                  >
                    {facility.label}
                  </Text>
                  {isSelected && (
                    <TouchableOpacity
                      style={{ marginLeft: 4 }}
                      onPress={() => toggleFacility(facility.key)}
                    >
                      <MaterialCommunityIcons name="close-circle" size={14} color={Colors.white} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
"""
content = content.replace("        {/* Emergency type quick selector */}", ui_injection + "\n        {/* Emergency type quick selector */}")

# Styles
styles_injection = """
  // CCTV Safety Card
  cctvCardContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cctvCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.medium,
  },
  cctvCardContent: {
    flex: 1,
  },
  cctvCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  cctvCardSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // Facilities
  facilitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  facilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.light,
  },
  facilityChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  facilityChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  facilityChipTextSelected: {
    color: Colors.white,
  },
});"""
# Replace ONLY the very last "});" in the file using rsplit
parts = content.rsplit("});", 1)
content = styles_injection.join(parts)

with open('frontend/src/screens/Home/HomeScreen.js', 'w') as f:
    f.write(content)

