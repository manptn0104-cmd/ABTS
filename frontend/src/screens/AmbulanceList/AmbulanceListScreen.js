import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAmbulances } from '../../store/ambulanceSlice';
import AmbulanceCard from '../../components/AmbulanceCard';
import FilterModal   from '../../components/FilterModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import BikeRecommendationBanner from '../../components/BikeRecommendationBanner';
import { getNearbyBikeAmbulances, getBikeRecommendation, assignBikeAmbulance } from '../../api/bikeAmbulances';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';
import { DEFAULT_REGION } from '../../utils/constants';

export default function AmbulanceListScreen({ route, navigation }) {
  const { location, searchText, selectedFacilities, limit: routeLimit } = route.params || {};
  const dispatch = useDispatch();
  const { list, isLoading, total, filters } = useSelector((s) => s.ambulance);

  const [showFilter, setShowFilter] = useState(false);
  const [sort, setSort]             = useState('distance');
  const [page, setPage]             = useState(1);

  // ── Bike Ambulance Recommendation ────────────────────────────────────────
  const [bikeRec,        setBikeRec]        = useState(null);
  const [bikeRecDismissed, setBikeRecDismissed] = useState(false);
  const [requestingBike, setRequestingBike] = useState(false);
  const [nearbyBikes, setNearbyBikes] = useState([]);
  const [renderError, setRenderError] = useState(null);

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'available') return v !== 'true';
    if (typeof v === 'boolean') return v;
    return !!v;
  }).length;

  const buildParams = useCallback(() => {
    const params = { page, limit: routeLimit ?? 15, ...filters };
    const lat = location?.latitude ?? location?.coords?.latitude ?? DEFAULT_REGION.latitude;
    const lng = location?.longitude ?? location?.coords?.longitude ?? DEFAULT_REGION.longitude;
    params.lat         = lat;
    params.lng         = lng;
    params.maxDistance = 50000;
    return params;
  }, [page, filters, location]);

  useEffect(() => {
    dispatch(fetchAmbulances(buildParams()));
  }, [dispatch, buildParams]);

  // Fetch nearby bike ambulances to show in the list
  useEffect(() => {
    const lat = location?.latitude  ?? location?.coords?.latitude;
    const lng = location?.longitude ?? location?.coords?.longitude;
    
    // Only fetch if we have a valid location
    if (!lat || !lng) {
      setNearbyBikes([]);
      return;
    }
    
    const params = { lat, lng, maxDistance: 5000, limit: 10 };
    (async () => {
      try {
        const res = await getNearbyBikeAmbulances(params);
        console.debug('getNearbyBikeAmbulances response:', res?.data);
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
  }, [location?.latitude, location?.longitude]);

  // Check for bike recommendation once ambulances are loaded
  useEffect(() => {
    if (isLoading || bikeRecDismissed) return;
    
    const lat = location?.latitude  ?? location?.coords?.latitude;
    const lng = location?.longitude ?? location?.coords?.longitude;
    
    // Only fetch recommendation if we have a valid location
    if (!lat || !lng) {
      setBikeRec(null);
      return;
    }
    
    // Best ETA from regular ambulances
    const bestETA = list.length > 0
      ? Math.min(...list.map((a) => a.estimatedArrivalMin ?? 9999))
      : undefined;
      
    (async () => {
      try {
        const res = await getBikeRecommendation({ 
          lat, 
          lng, 
          ...(bestETA && bestETA < 9999 ? { regularETA: bestETA } : {}) 
        });
        console.debug('getBikeRecommendation response:', res?.data);
        if (res.data?.recommended) setBikeRec(res.data);
        else setBikeRec(null);
      } catch (err) {
        console.warn('getBikeRecommendation error', err);
      }
    })();
  // Re-run when loading/list changes or when user location updates
  }, [isLoading, list.length, location?.latitude, location?.longitude, bikeRecDismissed]);

  const handleRefresh = () => {
    setPage(1);
    setBikeRec(null);
    setBikeRecDismissed(false);
    dispatch(fetchAmbulances({ ...buildParams(), page: 1 }));
  };

  const handleRequestBike = async () => {
    if (!bikeRec?.bikeAmbulance) return;
    setRequestingBike(true);
    try {
      const lat = location?.latitude  ?? DEFAULT_REGION.latitude;
      const lng = location?.longitude ?? DEFAULT_REGION.longitude;
      const res = await assignBikeAmbulance({
        bikeAmbulanceId:       bikeRec.bikeAmbulance._id,
        pickupCoordinates:     [lng, lat],
        pickupAddress:         location?.address || '',
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

  // Merge regular ambulances with nearby bikes (bikes appended) — memoized
  const mergedList = useMemo(() => {
    try {
      const merged = [...list, ...nearbyBikes];
      const sorted = [...merged].sort((a, b) => {
        if (sort === 'rating') return (b.rating?.average ?? 0) - (a.rating?.average ?? 0);
        if (sort === 'price')  return (a.basePrice ?? 0) - (b.basePrice ?? 0);
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      });
      return sorted;
    } catch (err) {
      console.error('AmbulanceList compute error', err);
      setTimeout(() => setRenderError(err?.message || String(err)), 0);
      return [];
    }
  }, [list, nearbyBikes, sort]);
  const mergedCount = (list?.length ?? 0) + (nearbyBikes?.length ?? 0);

  const renderHeader = () => (
    <View>
      {/* Bike Ambulance Recommendation Banner */}
      {bikeRec && !bikeRecDismissed && (
        <BikeRecommendationBanner
          recommendation={bikeRec}
          onRequest={handleRequestBike}
          onDismiss={() => setBikeRecDismissed(true)}
          requesting={requestingBike}
        />
      )}

      {/* Result count */}
      <View style={styles.resultRow}>
          <Text style={styles.resultText}>
          {mergedCount} ambulance{mergedCount !== 1 ? 's' : ''} found
          {location ? ' nearby' : ''}
        </Text>
      </View>

      {/* Sort chips */}
      <View style={styles.sortRow}>
        {[
          { label: 'Nearest',   value: 'distance' },
          { label: 'Top Rated', value: 'rating'   },
          { label: 'Cheapest',  value: 'price'    },
        ].map((s) => (
          <TouchableOpacity
            key={s.value}
            style={[styles.sortChip, sort === s.value && styles.sortChipActive]}
            onPress={() => setSort(s.value)}
          >
            <Text style={[styles.sortText, sort === s.value && styles.sortTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (renderError) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}> 
        <Text style={{ color: Colors.error, padding: 16 }}>Error loading ambulances: {renderError}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={Platform.OS === 'web' ? undefined : ['bottom']}>
      {/* Top search / filter bar */}
      <View style={styles.topBar}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={Colors.textMuted} />
          <Text style={styles.searchPlaceholder}>
            {location ? `Near your location` : 'All ambulances'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setShowFilter(true)}
        >
          <MaterialCommunityIcons
            name="filter-variant"
            size={22}
            color={activeFilterCount > 0 ? Colors.white : Colors.primary}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {isLoading && list.length === 0 ? (
        <LoadingSpinner message="Finding ambulances…" fullscreen />
      ) : (
        <FlatList
          data={mergedList}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            const handlePress = () => {
              if (item.isBike) {
                // For bike items, trigger direct request flow
                Alert.alert(
                  'Request Bike Ambulance',
                  `Request bike ${item.vehicleNumber} (ETA: ${item.estimatedArrivalMin} min)?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Request', onPress: async () => {
                      try {
                        setRequestingBike(true);
                        const lat = location?.latitude  ?? DEFAULT_REGION.latitude;
                        const lng = location?.longitude ?? DEFAULT_REGION.longitude;
                        const res = await assignBikeAmbulance({
                          bikeAmbulanceId: item._id,
                          pickupCoordinates: [lng, lat],
                          pickupAddress: location?.address || '',
                          regularAmbulanceETA: null,
                          bikeAmbulanceETA: item.estimatedArrivalMin,
                          distanceKm: item.distanceKm,
                          recommendationReasons: ['BIKE_SELECTED_BY_USER'],
                        });
                        if (res.data?.success) {
                          if (Platform.OS === 'web') window.alert('✅ Bike requested');
                          else Alert.alert('Requested', 'Bike ambulance requested — driver will respond shortly.');
                        }
                      } catch (e) {
                        const msg = e?.response?.data?.message || 'Failed to request bike.';
                        if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Error', msg);
                      } finally { setRequestingBike(false); }
                    } },
                  ],
                );
              } else {
                navigation.navigate('AmbulanceDetails', {
                  ambulanceId: item._id,
                  location,
                  searchText,
                  selectedFacilities,
                });
              }
            };

            return (
              <AmbulanceCard
                ambulance={item}
                onPress={handlePress}
                style={styles.card}
              />
            );
          }}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🚑</Text>
              <Text style={styles.emptyTitle}>No ambulances found</Text>
              <Text style={styles.emptySubtitle}>Try changing your filters</Text>
            </View>
          }
          ListFooterComponent={
            isLoading ? <ActivityIndicator color={Colors.primary} style={{ padding: 16 }} /> : null
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} colors={[Colors.primary]} />
          }
          onEndReached={() => {
            if (!isLoading && list.length > 0 && list.length < total) {
              setPage((p) => p + 1);
            }
          }}
          onEndReachedThreshold={0.5}
        />
      )}

      <FilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={() => { setPage(1); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 6,
  },
  searchPlaceholder: { fontSize: 14, color: Colors.textMuted },
  filterBtn: {
    padding: 10, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.error, borderRadius: 8,
    width: 16, height: 16, justifyContent: 'center', alignItems: 'center',
  },
  filterBadgeText: { fontSize: 10, color: Colors.white, fontWeight: '700' },
  listContent: { padding: Spacing.md, paddingBottom: 32 },
  resultRow: { marginBottom: Spacing.sm },
  resultText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  sortChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortText:       { fontSize: 13, color: Colors.text, fontWeight: '500' },
  sortTextActive: { color: Colors.white },
  card: { marginBottom: 0 },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyEmoji:    { fontSize: 48 },
  emptyTitle:    { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: Spacing.md },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
});
