import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import api from '../../api/index';
import { Colors, Spacing, BorderRadius, Shadow } from '../../theme';

export default function ReviewsScreen() {
  const { user } = useSelector((s) => s.auth);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    tagsSummary: {},
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReviews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await api.get(`/reviews/driver/${user._id}?limit=100`);
      if (response.data.success) {
        const data = response.data.data || [];
        setReviews(data);

        // Calculate statistics
        if (data.length > 0) {
          const avgRating =
            data.reduce((sum, r) => sum + r.rating, 0) / data.length;
          
          // Count tags
          const tagsSummary = {};
          data.forEach((review) => {
            if (review.tags && Array.isArray(review.tags)) {
              review.tags.forEach((tag) => {
                tagsSummary[tag] = (tagsSummary[tag] || 0) + 1;
              });
            }
          });

          setStats({
            averageRating: Math.round(avgRating * 10) / 10,
            totalReviews: data.length,
            tagsSummary,
          });
        } else {
          setStats({
            averageRating: 0,
            totalReviews: 0,
            tagsSummary: {},
          });
        }
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user._id]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const renderRatingStars = (rating) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <MaterialCommunityIcons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={14}
            color={star <= rating ? Colors.warning : Colors.border}
            style={{ marginRight: 2 }}
          />
        ))}
      </View>
    );
  };

  const topTags = Object.entries(stats.tagsSummary)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadReviews(true)}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="star-circle" size={28} color={Colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Your Reviews</Text>
            <Text style={styles.headerSubtitle}>Driver Performance</Text>
          </View>
        </View>

        {/* Rating Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.ratingBox}>
            <Text style={styles.ratingNumber}>{stats.averageRating.toFixed(1)}</Text>
            {renderRatingStars(Math.round(stats.averageRating))}
            <Text style={styles.ratingLabel}>Average Rating</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalReviews}</Text>
              <Text style={styles.statLabel}>Total Reviews</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{topTags.length}</Text>
              <Text style={styles.statLabel}>Top Tags</Text>
            </View>
          </View>
        </View>

        {/* Tags Summary */}
        {topTags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Common Feedback Tags</Text>
            <View style={styles.tagsGrid}>
              {topTags.map(([tag, count]) => (
                <View key={tag} style={styles.tagBadge}>
                  <Text style={styles.tagName}>{tag}</Text>
                  <Text style={styles.tagCount}>{count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Reviews</Text>
          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="inbox-outline" size={40} color={Colors.gray400} />
              <Text style={styles.emptyText}>No reviews yet</Text>
              <Text style={styles.emptySubtext}>Your first review will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={reviews.slice(0, 10)}
              keyExtractor={(review) => review._id}
              scrollEnabled={false}
              renderItem={({ item: review }) => (
                <View style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewUserInfo}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>
                          {review.userId?.name?.charAt(0) || 'U'}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.reviewerName}>
                          {review.userId?.name || 'Anonymous'}
                        </Text>
                        <Text style={styles.reviewDate}>
                          {new Date(review.createdAt).toLocaleDateString('en-IN')}
                        </Text>
                      </View>
                    </View>
                    {renderRatingStars(review.rating)}
                  </View>

                  {/* Tags */}
                  {review.tags && review.tags.length > 0 && (
                    <View style={styles.reviewTags}>
                      {review.tags.map((tag, idx) => (
                        <View key={idx} style={styles.reviewTag}>
                          <Text style={styles.reviewTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Feedback Text */}
                  {review.feedback && (
                    <Text style={styles.reviewText}>"{review.feedback}"</Text>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadow.medium,
  },
  ratingBox: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ratingNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  ratingLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tagBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    alignItems: 'center',
  },
  tagName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  tagCount: {
    fontSize: 10,
    color: Colors.primary,
    marginTop: 2,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: Spacing.xs,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    ...Shadow.light,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  reviewUserInfo: {
    flexDirection: 'row',
    flex: 1,
    marginRight: Spacing.md,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 2,
  },
  reviewTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  reviewTag: {
    backgroundColor: Colors.success + '22',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 0.5,
    borderColor: Colors.success,
  },
  reviewTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.success,
  },
  reviewText: {
    fontSize: 13,
    color: Colors.text,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
