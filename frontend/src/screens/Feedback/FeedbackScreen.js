import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/index';
import { Colors, Spacing, Shadow, BorderRadius, Typography } from '../../theme';

const FEEDBACK_TAGS = [
  // Positive tags
  { label: 'Fast Arrival', icon: 'flash', type: 'positive' },
  { label: 'Professional Driver', icon: 'person', type: 'positive' },
  { label: 'Clean Ambulance', icon: 'car', type: 'positive' },
  { label: 'Good Medical Support', icon: 'medkit', type: 'positive' },
  { label: 'Smooth Navigation', icon: 'navigate', type: 'positive' },
  // Negative tags
  { label: 'Late Arrival', icon: 'time', type: 'negative' },
  { label: 'Missing Equipment', icon: 'alert-circle', type: 'negative' },
  { label: 'Poor Communication', icon: 'chatbubbles', type: 'negative' },
];

export default function FeedbackScreen({ route, navigation }) {
  const { bookingId } = route.params || {};
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleStarPress = (starRating) => {
    setRating(starRating);
  };

  const handleTagToggle = (tag) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }

    if (!bookingId) {
      Alert.alert('Error', 'Booking ID is missing.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post('/reviews', {
        bookingId,
        rating,
        feedback: feedback.trim(),
        tags: selectedTags,
      });

      if (response.data.success) {
        Alert.alert(
          'Thank You!',
          'Your feedback has been submitted successfully.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Home'),
            },
          ]
        );
      } else {
        Alert.alert('Error', response.data.message || 'Failed to submit feedback.');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to submit feedback. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderStar = (index) => {
    const isFilled = index <= rating;
    return (
      <TouchableOpacity
        key={index}
        onPress={() => handleStarPress(index)}
        style={styles.starButton}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isFilled ? 'star' : 'star-outline'}
          size={40}
          color={isFilled ? Colors.primary : Colors.gray300}
        />
      </TouchableOpacity>
    );
  };

  const renderTag = (tag) => {
    const isSelected = selectedTags.includes(tag.label);
    return (
      <TouchableOpacity
        key={tag.label}
        onPress={() => handleTagToggle(tag.label)}
        style={[
          styles.tagChip,
          isSelected && tag.type === 'positive' && styles.tagChipPositive,
          isSelected && tag.type === 'negative' && styles.tagChipNegative,
        ]}
        activeOpacity={0.7}
      >
        <Ionicons
          name={tag.icon}
          size={16}
          color={isSelected ? Colors.white : Colors.gray600}
          style={styles.tagIcon}
        />
        <Text
          style={[
            styles.tagLabel,
            isSelected && styles.tagLabelSelected,
          ]}
        >
          {tag.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rate Your Experience</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Rating Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How was your ambulance service?</Text>
          <View style={styles.starContainer}>
            {[1, 2, 3, 4, 5].map(renderStar)}
          </View>
          <Text style={styles.ratingText}>
            {rating === 0 ? 'Tap to rate' : `${rating} star${rating > 1 ? 's' : ''}`}
          </Text>
        </View>

        {/* Feedback Tags */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What did you like or dislike?</Text>
          <View style={styles.tagsContainer}>
            {FEEDBACK_TAGS.map(renderTag)}
          </View>
        </View>

        {/* Feedback Text */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Feedback (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Share your experience..."
            placeholderTextColor={Colors.gray400}
            multiline
            numberOfLines={4}
            value={feedback}
            onChangeText={setFeedback}
            maxLength={500}
          />
          <Text style={styles.characterCount}>
            {feedback.length}/500
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Review</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  starContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  starButton: {
    marginHorizontal: Spacing.sm,
  },
  ratingText: {
    fontSize: 14,
    color: Colors.gray600,
    textAlign: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gray300,
  },
  tagChipPositive: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  tagChipNegative: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  tagIcon: {
    marginRight: Spacing.xs,
  },
  tagLabel: {
    fontSize: 14,
    color: Colors.gray600,
    fontWeight: '500',
  },
  tagLabelSelected: {
    color: Colors.white,
  },
  textInput: {
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.text,
    textAlignVertical: 'top',
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.gray300,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.gray500,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    ...Shadow.medium,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.gray300,
    ...Shadow.none,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
};
