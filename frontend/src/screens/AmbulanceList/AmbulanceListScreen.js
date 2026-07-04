import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAmbulances } from '../../store/ambulanceSlice';
import AmbulanceCard from '../../components/AmbulanceCard';
import FilterModal   from '../../components/FilterModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';
import { DEFAULT_REGION } from '../../utils/constants';

export default function AmbulanceListScreen({ route, navigation }) {
  const { location, emergencyType, searchText, selectedFacilities } = route.params || {};
  const dispatch = useDispatch();
  const { list, isLoading, total, filters } = useSelector((s) => s.ambulance);

  const [showFilter, setShowFilter] = useState(false);
  const [sort, setSort]             = useState('distance'); // distance | rating | price
  const [page, setPage]             = useState(1);

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'available') return v !== 'true';
    if (typeof v === 'boolean') return v;
    return !!v;
  }).length;

  const buildParams = useCallback(() => {
    const params = { page, limit: 15, ...filters };
    // Always send coordinates — use actual GPS or fall back to Bangalore centre
    const lat = location?.latitude  ?? DEFAULT_REGION.latitude;
    const lng = location?.longitude ?? DEFAULT_REGION.longitude;
    params.lat         = lat;
    params.lng         = lng;
    params.maxDistance = 50000; // 50 km radius
    if (emergencyType) params.emergencyType = emergencyType;
    return params;
  }, [page, filters, location, emergencyType]);

  useEffect(() => {
    dispatch(fetchAmbulances(buildParams()));
  }, [dispatch, buildParams]);

  const handleRefresh = () => {
    setPage(1);
    dispatch(fetchAmbulances({ ...buildParams(), page: 1 }));
  };

  const sortedList = [...list].sort((a, b) => {
    if (sort === 'rating')   return (b.rating?.average ?? 0) - (a.rating?.average ?? 0);
    if (sort === 'price')    return a.basePrice - b.basePrice;
    return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
  });

  const renderHeader = () => (
    <View>
      {/* Result count */}
      <View style={styles.resultRow}>
        <Text style={styles.resultText}>
          {total} ambulance{total !== 1 ? 's' : ''} found
          {location ? ' nearby' : ''}
        </Text>
      </View>

      {/* Sort chips */}
      <View style={styles.sortRow}>
        {[
          { label: 'Nearest',    value: 'distance' },
          { label: 'Top Rated',  value: 'rating'   },
          { label: 'Cheapest',   value: 'price'    },
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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
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
          data={sortedList}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <AmbulanceCard
              ambulance={item}
              onPress={() =>
                navigation.navigate('AmbulanceDetails', {
                  ambulanceId: item._id,
                  location,
                  searchText,
                  selectedFacilities,
                })
              }
              style={styles.card}
            />
          )}
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
