import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, FlatList, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAmbulances } from '../../store/ambulanceSlice';
import { useLocation } from '../../hooks/useLocation';
import MapComponent from '../../components/MapComponent';
import AmbulanceCard from '../../components/AmbulanceCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Colors, Spacing, Shadow, BorderRadius } from '../../theme';
import { DEFAULT_REGION, EMERGENCY_TYPES, FACILITIES } from '../../utils/constants';

export default function HomeScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user }    = useSelector((s) => s.auth);
  const { list: ambulances, isLoading } = useSelector((s) => s.ambulance);

  const { location, address, isLoading: locLoading, getCurrentLocation, setLocation, setAddress } = useLocation();

  const [searchText, setSearchText]         = useState('');
  const [suggestions, setSuggestions]       = useState([]);
  const [sugLoading, setSugLoading]         = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused]           = useState(false);
  const [manualLocation, setManualLocation] = useState(null); // User-selected location (takes priority over GPS)
  const debounceRef = useRef(null);
  const [mapRegion, setMapRegion]     = useState(DEFAULT_REGION);
  const [showMap, setShowMap]         = useState(true);
  const [selectedFacilities, setSelectedFacilities] = useState([]);

  const toggleFacility = (id) => {
    setSelectedFacilities((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  // The effective location: manual selection takes priority over GPS
  const effectiveLocation = manualLocation || location;

  // Fetch address suggestions from Nominatim (OpenStreetMap)
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 3) { setSuggestions([]); return; }
    setSugLoading(true);
    try {
      // Bug #8 fix: bias results toward the user's current location
      const loc = effectiveLocation || { latitude: 12.9716, longitude: 77.5946 };
      const lat = loc.coords ? loc.coords.latitude  : loc.latitude;
      const lng = loc.coords ? loc.coords.longitude : loc.longitude;
      const viewbox = `${lng - 0.5},${lat + 0.5},${lng + 0.5},${lat - 0.5}`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&countrycodes=in&viewbox=${viewbox}&bounded=0`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      setSuggestions(data.map((r) => ({
        label:     r.display_name,
        shortLabel: [r.address?.road, r.address?.suburb, r.address?.city || r.address?.town || r.address?.village]
                      .filter(Boolean).join(', ') || r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      })));
    } catch (_) {
      setSuggestions([]);
    } finally {
      setSugLoading(false);
    }
  }, []);

  const handleSearchTextChange = (text) => {
    setSearchText(text);
    setShowSuggestions(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 400);
  };

  const handleSelectSuggestion = (s) => {
    const newLoc = { latitude: s.lat, longitude: s.lng };
    setManualLocation(newLoc); // Lock in the user's choice (GPS won't overwrite this)
    setSearchText(s.shortLabel);
    setSuggestions([]);
    setShowSuggestions(false);
    setIsFocused(false);
    setLocation(newLoc);
    setAddress(s.shortLabel);
    setMapRegion({ latitude: s.lat, longitude: s.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 });
    // Fetch ambulances for the manually selected location
    dispatch(fetchAmbulances({
      lat: s.lat, lng: s.lng, maxDistance: 50000, available: 'true', limit: 20,
      facilities: selectedFacilities.length > 0 ? selectedFacilities.join(',') : undefined,
    }));
  };

  const handleUseCurrentLocation = () => {
    setManualLocation(null); // Clear manual selection so GPS takes over again
    setShowSuggestions(false);
    setIsFocused(false);
    getCurrentLocation();
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (searchText.length >= 3) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
      setIsFocused(false);
    }, 200);
  };

  // Fetch ambulances on mount immediately with fallback Bangalore coords
  useEffect(() => {
    const loc = manualLocation || location || { coords: { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude } };
    const lat = loc.coords ? loc.coords.latitude : loc.latitude;
    const lng = loc.coords ? loc.coords.longitude : loc.longitude;

    dispatch(fetchAmbulances({
      lat,
      lng,
      maxDistance: 50000,
      available: 'true',
      limit: 20,
      facilities: selectedFacilities.length > 0 ? selectedFacilities.join(',') : undefined,
    }));
  }, [dispatch, selectedFacilities]);

  // Re-fetch with actual GPS when available (only if user hasn't manually selected a location)
  useEffect(() => {
    if (!location || manualLocation) return;
    setMapRegion({
      latitude:       location.latitude,
      longitude:      location.longitude,
      latitudeDelta:  0.05,
      longitudeDelta: 0.05,
    });
    dispatch(fetchAmbulances({
      lat: location.latitude,
      lng: location.longitude,
      maxDistance: 50000,
      available: 'true',
      limit: 20,
      facilities: selectedFacilities.length > 0 ? selectedFacilities.join(',') : undefined,
    }));
  }, [location, dispatch, manualLocation, selectedFacilities]);

  // Sync GPS address to search text (only if user hasn't manually selected)
  useEffect(() => {
    if (address && !manualLocation) setSearchText(address);
  }, [address, manualLocation]);

  const handleSearch = useCallback(() => {
    navigation.navigate('AmbulanceList', { location: effectiveLocation, searchText });
  }, [navigation, effectiveLocation, searchText]);

  const handleQuickBook = () => {
    navigation.navigate('AmbulanceList', { location: effectiveLocation || { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude }, searchText });
  };

  const handleAmbulancePress = (amb) => {
    navigation.navigate('AmbulanceDetails', { ambulanceId: amb._id, location: effectiveLocation, searchText });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subtitle}>Find emergency help nearby</Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Bookings')}
        >
          <MaterialCommunityIcons name="clipboard-list-outline" size={26} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>
        {/* Search bar with autocomplete */}
        <View style={styles.searchWrapper}>
          <View style={[styles.searchBar, Shadow.medium]}>
            <MaterialCommunityIcons name="map-marker" size={20} color={Colors.primary} />
          <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={handleSearchTextChange}
              placeholder="Enter pickup location…"
              placeholderTextColor={Colors.textMuted}
              onSubmitEditing={handleSearch}
              onFocus={handleFocus}
              onBlur={handleBlur}
              returnKeyType="search"
            />
            {sugLoading || locLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <TouchableOpacity onPress={handleUseCurrentLocation}>
                <MaterialCommunityIcons name="crosshairs-gps" size={20} color={Colors.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Dropdown: Suggestions OR History + Current Location */}
          {(showSuggestions && suggestions.length > 0) ? (
            <View style={[styles.suggestionsBox, Shadow.medium]}>
              {suggestions.map((s, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.suggestionItem, idx < suggestions.length - 1 && styles.suggestionBorder]}
                  onPress={() => handleSelectSuggestion(s)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="map-marker-outline" size={16} color={Colors.primary} style={styles.suggestionIcon} />
                  <View style={styles.suggestionTexts}>
                    <Text style={styles.suggestionShort} numberOfLines={1}>{s.shortLabel}</Text>
                    <Text style={styles.suggestionFull}  numberOfLines={1}>{s.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : isFocused && searchText.length < 3 ? (
            <View style={[styles.suggestionsBox, Shadow.medium]}>
              {/* Use Current Location */}
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={handleUseCurrentLocation}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="crosshairs-gps" size={16} color={Colors.secondary} style={styles.suggestionIcon} />
                <View style={styles.suggestionTexts}>
                  <Text style={[styles.suggestionShort, { color: Colors.secondary }]}>Use Current Location</Text>
                  <Text style={styles.suggestionFull}>Detect your GPS location automatically</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>


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

        {/* Emergency type quick selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
            {EMERGENCY_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={styles.typeChip}
                onPress={() => navigation.navigate('AmbulanceList', { location: effectiveLocation, emergencyType: t.value, searchText })}
              >
                <MaterialCommunityIcons name={t.icon} size={22} color={Colors.primary} />
                <Text style={styles.typeLabel}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Quick Book Button */}
        <TouchableOpacity style={styles.quickBookBtn} onPress={handleQuickBook} activeOpacity={0.85}>
          <MaterialCommunityIcons name="ambulance" size={26} color={Colors.white} />
          <Text style={styles.quickBookText}>🚨  Quick Emergency Book</Text>
        </TouchableOpacity>

        {/* Map */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Ambulances</Text>
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => setShowMap((p) => !p)}
            >
              <MaterialCommunityIcons
                name={showMap ? 'view-list' : 'map'}
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.toggleText}>{showMap ? 'List' : 'Map'}</Text>
            </TouchableOpacity>
          </View>

          {showMap ? (
            <View style={styles.mapContainer}>
              {locLoading ? (
                <LoadingSpinner message="Getting your location…" />
              ) : (
                <MapComponent
                  region={mapRegion}
                  userLocation={location}
                  ambulances={ambulances}
                  onAmbulancePress={handleAmbulancePress}
                  style={styles.map}
                />
              )}
            </View>
          ) : null}
        </View>

        {/* Nearby ambulance list */}
        <View style={styles.section}>
          {!showMap && <Text style={styles.sectionTitle}>Available Ambulances</Text>}
          {isLoading ? (
            <LoadingSpinner message="Finding ambulances near you…" />
          ) : ambulances.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>No ambulances found nearby</Text>
              <TouchableOpacity onPress={() => dispatch(fetchAmbulances({
                lat: DEFAULT_REGION.latitude, lng: DEFAULT_REGION.longitude,
                maxDistance: 100000, limit: 20,
                facilities: selectedFacilities.length > 0 ? selectedFacilities.join(',') : undefined,
              }))}>
                <Text style={styles.retryText}>Show all ambulances</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {ambulances.slice(0, 3).map((amb) => (
                <AmbulanceCard
                  key={amb._id}
                  ambulance={amb}
                  onPress={() => handleAmbulancePress(amb)}
                />
              ))}
              {ambulances.length > 3 && (
                <TouchableOpacity
                  style={styles.viewAllBtn}
                  onPress={() => navigation.navigate('AmbulanceList', { location })}
                >
                  <Text style={styles.viewAllText}>View all {ambulances.length} ambulances →</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
  },
  greeting: { fontSize: 20, fontWeight: '700', color: Colors.white },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  notifBtn: { padding: 4 },
  body:     { flex: 1, backgroundColor: Colors.background },
  searchWrapper: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    height: 50,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text, height: '100%', alignSelf: 'stretch' },
  section:     { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: Colors.text },
  toggleBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toggleText:    { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  typeScroll:    { marginBottom: Spacing.sm },
  typeChip: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginRight: Spacing.sm,
    minWidth: 72,
    ...Shadow.light,
  },
  typeLabel: { fontSize: 11, color: Colors.text, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  quickBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    ...Shadow.medium,
  },
  quickBookText: { fontSize: 17, fontWeight: '800', color: Colors.white, letterSpacing: 0.5 },
  mapContainer:  { height: 260, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.medium },
  map:           { flex: 1 },
  emptyBox:      { alignItems: 'center', padding: Spacing.xl },
  emptyEmoji:    { fontSize: 40 },
  emptyText:     { fontSize: 15, color: Colors.textSecondary, marginTop: Spacing.sm },
  retryText:     { fontSize: 14, color: Colors.primary, fontWeight: '600', marginTop: Spacing.sm },
  viewAllBtn:    { alignItems: 'center', paddingVertical: Spacing.md },
  viewAllText:   { fontSize: 14, color: Colors.primary, fontWeight: '700' },

  // Autocomplete suggestions
  suggestionsBox: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    zIndex: 999,
    elevation: 10,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.white,
  },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestionIcon:   { marginRight: 8, marginTop: 2 },
  suggestionTexts:  { flex: 1 },
  suggestionShort:  { fontSize: 13, fontWeight: '600', color: Colors.text },
  suggestionFull:   { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

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
});
