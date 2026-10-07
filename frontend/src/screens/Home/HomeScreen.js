import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import BikeRecommendationBanner from '../../components/BikeRecommendationBanner';
import { getNearbyBikeAmbulances, getBikeRecommendation, assignBikeAmbulance } from '../../api/bikeAmbulances';
import { Colors, Spacing, Shadow, BorderRadius } from '../../theme';
import { API_BASE_URL, DEFAULT_REGION, FACILITIES } from '../../utils/constants';

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

  // Bike Ambulance state
  const [bikeRec, setBikeRec] = useState(null);
  const [bikeRecDismissed, setBikeRecDismissed] = useState(false);
  const [requestingBike, setRequestingBike] = useState(false);
  const [nearbyBikes, setNearbyBikes] = useState([]);

  const toggleFacility = (id) => {
    setSelectedFacilities((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const removeFacility = (id) => {
    setSelectedFacilities((prev) => prev.filter((f) => f !== id));
  };

  // Build individual facility query params for the backend (e.g. { oxygen: 'true', doctor: 'true' })
  const buildFacilityParams = (facilities) => {
    const params = {};
    facilities.forEach((f) => { params[f] = 'true'; });
    return params;
  };

  // The effective location: manual selection takes priority over GPS
  const effectiveLocation = manualLocation || location;

  const fetchPlaceDetails = useCallback(async (placeId) => {
    if (!placeId) return null;

    const detailsUrl = `${API_BASE_URL}/maps/details?place_id=${encodeURIComponent(placeId)}`;
    const res = await fetch(detailsUrl);
    const data = await res.json();

    if (data.status !== 'OK' || !data.result?.geometry?.location) return null;

    return {
      label: data.result.formatted_address || data.result.name,
      shortLabel: data.result.formatted_address || data.result.name,
      lat: data.result.geometry.location.lat,
      lng: data.result.geometry.location.lng,
    };
  }, []);

  const fetchSuggestions = useCallback(async (query) => {
    const trimmed = (query || '').trim();
    if (!trimmed || trimmed.length < 2) { setSuggestions([]); return; }
    setSugLoading(true);

    try {
      const loc = effectiveLocation || { latitude: 12.9716, longitude: 77.5946 };
      const lat = loc.coords ? loc.coords.latitude : loc.latitude;
      const lng = loc.coords ? loc.coords.longitude : loc.longitude;

      const autocompleteUrl = `${API_BASE_URL}/maps/autocomplete?input=${encodeURIComponent(trimmed)}&lat=${lat}&lng=${lng}`;
      const res = await fetch(autocompleteUrl);
      const data = await res.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(data.status || 'Google Places autocomplete failed');
      }

      const mapped = (data.predictions || []).map((item) => ({
        key: item.place_id,
        label: item.description,
        shortLabel: item.structured_formatting?.main_text || item.description,
        placeId: item.place_id,
      }));

      setSuggestions(mapped);
    } catch (err) {
      console.warn('Google Places search error:', err);
      setSuggestions([]);
    } finally {
      setSugLoading(false);
    }
  }, [effectiveLocation]);

  const handleSearchTextChange = (text) => {
    const nextText = text || '';
    setSearchText(nextText);

    if (nextText.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      clearTimeout(debounceRef.current);
      return;
    }

    setShowSuggestions(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(nextText), 300);
  };

  const handleSelectSuggestion = async (s) => {
    let resolved = { ...s };

    if (s.placeId) {
      const details = await fetchPlaceDetails(s.placeId);
      if (details) {
        resolved = { ...resolved, ...details };
      }
    }

    const newLoc = { latitude: resolved.lat, longitude: resolved.lng };
    setManualLocation(newLoc); // Lock in the user's choice (GPS won't overwrite this)
    setSearchText(resolved.shortLabel || resolved.label || s.shortLabel || s.label);
    setSuggestions([]);
    setShowSuggestions(false);
    setIsFocused(false);
    setLocation(newLoc);
    setAddress(resolved.shortLabel || resolved.label || s.shortLabel || s.label);
    setMapRegion({ latitude: resolved.lat, longitude: resolved.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 });
  };

  const handleUseCurrentLocation = () => {
    setManualLocation(null); // Clear manual selection so GPS takes over again
    setShowSuggestions(false);
    setIsFocused(false);
    getCurrentLocation();
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (searchText.trim().length >= 2) {
      setShowSuggestions(true);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(searchText), 200);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      // If the user typed a valid search and there are suggestions, keep the dropdown visible
      // instead of silently forcing the first result to be selected on blur.
      if (searchText.trim().length >= 2 && suggestions.length > 0) {
        setShowSuggestions(true);
        setIsFocused(true);
        return;
      }
      setShowSuggestions(false);
      setIsFocused(false);
    }, 200);
  };

  // Fetch ambulances based on location and filters
  useEffect(() => {
    const lat = effectiveLocation?.coords?.latitude  ?? effectiveLocation?.latitude;
    const lng = effectiveLocation?.coords?.longitude ?? effectiveLocation?.longitude;
    const params = { available: 'true', limit: 20, ...buildFacilityParams(selectedFacilities) };
    
    // Include location if available for accurate distance calculation
    if (lat && lng) { 
      console.log('Fetching ambulances for location:', { lat, lng });
      params.lat = lat; 
      params.lng = lng; 
      params.maxDistance = 50000; 
      
      // Update map region when location is available
      setMapRegion({
        latitude:       lat,
        longitude:      lng,
        latitudeDelta:  0.05,
        longitudeDelta: 0.05,
      });
    }
    
    dispatch(fetchAmbulances(params));
  }, [manualLocation?.latitude, manualLocation?.longitude, location?.latitude, location?.longitude, selectedFacilities, dispatch]);

  // Sync GPS address to search text (only if user hasn't manually selected)
  useEffect(() => {
    if (address && !manualLocation) setSearchText(address);
  }, [address, manualLocation]);

  // Fetch nearby bike ambulances based on pickup location
  useEffect(() => {
    const lat = effectiveLocation?.coords?.latitude  ?? effectiveLocation?.latitude;
    const lng = effectiveLocation?.coords?.longitude ?? effectiveLocation?.longitude;
    
    // Only fetch if we have a valid location
    if (!lat || !lng) {
      setNearbyBikes([]);
      return;
    }
    
    console.log('Fetching bike ambulances for location:', { lat, lng });
    const params = { lat, lng, maxDistance: 5000, limit: 10 };
    (async () => {
      try {
        const res = await getNearbyBikeAmbulances(params);
        if (res.data?.bikes) {
          const mapped = res.data.bikes.map((b) => ({ 
            ...b, 
            isBike: true, 
            type: 'bike',
            basePrice: b.basePrice || 200, // Default base price for bike ambulances
          }));
          setNearbyBikes(mapped);
        } else setNearbyBikes([]);
      } catch (err) {
        console.warn('getNearbyBikeAmbulances error', err);
        setNearbyBikes([]);
      }
    })();
  }, [manualLocation?.latitude, manualLocation?.longitude, location?.latitude, location?.longitude]);

  // Fetch bike recommendation based on pickup location
  useEffect(() => {
    if (isLoading || bikeRecDismissed) return;
    
    const lat = effectiveLocation?.coords?.latitude  ?? effectiveLocation?.latitude;
    const lng = effectiveLocation?.coords?.longitude ?? effectiveLocation?.longitude;
    
    // Only fetch recommendation if we have a valid location
    if (!lat || !lng) {
      setBikeRec(null);
      return;
    }
    
    // Best ETA from regular ambulances
    const bestETA = ambulances.length > 0
      ? Math.min(...ambulances.map((a) => a.estimatedArrivalMin ?? 9999))
      : undefined;
      
    (async () => {
      try {
        const res = await getBikeRecommendation({ 
          lat, 
          lng, 
          ...(bestETA && bestETA < 9999 ? { regularETA: bestETA } : {}) 
        });
        if (res.data?.recommended) setBikeRec(res.data);
        else setBikeRec(null);
      } catch (err) {
        console.warn('getBikeRecommendation error', err);
      }
    })();
  }, [isLoading, ambulances.length, manualLocation?.latitude, manualLocation?.longitude, location?.latitude, location?.longitude, bikeRecDismissed]);

  const handleSearch = useCallback(() => {
    navigation.navigate('AmbulanceList', { location: effectiveLocation, searchText, selectedFacilities });
  }, [navigation, effectiveLocation, searchText, selectedFacilities]);

  const handleRequestBike = async () => {
    if (!bikeRec?.bikeAmbulance) return;
    setRequestingBike(true);
    try {
      const lat = effectiveLocation?.coords?.latitude  ?? effectiveLocation?.latitude  ?? DEFAULT_REGION.latitude;
      const lng = effectiveLocation?.coords?.longitude ?? effectiveLocation?.longitude ?? DEFAULT_REGION.longitude;
      const res = await assignBikeAmbulance({
        bikeAmbulanceId:       bikeRec.bikeAmbulance._id,
        pickupCoordinates:     [lng, lat],
        pickupAddress:         address || '',
        regularAmbulanceETA:   bikeRec.regularAmbulanceETA,
        bikeAmbulanceETA:      bikeRec.bikeETA,
        distanceKm:            bikeRec.bikeDistanceKm,
        recommendationReasons: bikeRec.reasons,
      });
      if (res.data?.success) {
        setBikeRec(null);
        if (Platform.OS === 'web') {
          window.alert(`✅ Bike Ambulance ${bikeRec.bikeAmbulance.vehicleNumber} assigned!\nETA: ${bikeRec.bikeETA} minutes\nDriver: ${bikeRec.bikeAmbulance.driverName}`);
        } else {
          Alert.alert(
            '🏍️ Bike Ambulance Assigned',
            `${bikeRec.bikeAmbulance.vehicleNumber} is on its way!\nDriver: ${bikeRec.bikeAmbulance.driverName}\nETA: ${bikeRec.bikeETA} min`,
          );
        }
      }
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to assign bike ambulance.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setRequestingBike(false);
    }
  };

  // Merge regular ambulances with nearby bikes
  const mergedAmbulances = useMemo(() => {
    return [...ambulances, ...nearbyBikes];
  }, [ambulances, nearbyBikes]);


  const handleAmbulancePress = (amb) => {
    navigation.navigate('AmbulanceDetails', { ambulanceId: amb._id, location: effectiveLocation, searchText, selectedFacilities });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subtitle}>Find ambulance help nearby</Text>
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
                      onPress={() => removeFacility(facility.key)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons name="close-circle" size={14} color={Colors.white} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

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
                  userLocation={effectiveLocation}
                  ambulances={mergedAmbulances}
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
          
          {/* Bike Ambulance Recommendation Banner */}
          {bikeRec && !bikeRecDismissed && (
            <BikeRecommendationBanner
              recommendation={bikeRec}
              onRequest={handleRequestBike}
              onDismiss={() => setBikeRecDismissed(true)}
              requesting={requestingBike}
            />
          )}

          {isLoading ? (
            <LoadingSpinner message="Finding ambulances near you…" />
          ) : mergedAmbulances.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>No ambulances found nearby</Text>
              <TouchableOpacity onPress={() => dispatch(fetchAmbulances({
                lat: DEFAULT_REGION.latitude, lng: DEFAULT_REGION.longitude,
                maxDistance: 100000, limit: 20,
                ...buildFacilityParams(selectedFacilities),
              }))}>
                <Text style={styles.retryText}>Show all ambulances</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {mergedAmbulances.slice(0, 3).map((amb) => (
                <AmbulanceCard
                  key={amb._id}
                  ambulance={amb}
                  onPress={() => handleAmbulancePress(amb)}
                />
              ))}
              {mergedAmbulances.length > 3 && (
                <TouchableOpacity
                  style={styles.viewAllBtn}
                  onPress={() => navigation.navigate('AmbulanceList', { location: effectiveLocation, selectedFacilities, limit: 100 })}
                >
                  <Text style={styles.viewAllText}>View all {mergedAmbulances.length} ambulances →</Text>
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
    position: 'relative',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.xs,
    zIndex: 20,
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
  searchInput: {
    flex: 1, fontSize: 15, color: Colors.text, height: '100%', alignSelf: 'stretch',
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
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
  facilityChipClose: {
    marginLeft: Spacing.xs,
  },
});
