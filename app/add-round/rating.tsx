import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { decode } from 'base64-arraybuffer';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { handleError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';

type RatedCourse = {
  id: string;
  name: string;
  rating: number;
  location: string;
};

export default function RatingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [rating, setRating] = useState(7.5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [similarCourses, setSimilarCourses] = useState<RatedCourse[]>([]);
  const [userRatedCourses, setUserRatedCourses] = useState<RatedCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  useEffect(() => {
    loadUserRatedCourses();
  }, []);

  const loadUserRatedCourses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's rounds with course info
      let query = supabase
        .from('rounds')
        .select(`
          id,
          rating,
          course_id,
          course:courses(
            id,
            name,
            location
          )
        `)
        .eq('user_id', user.id)
        .not('rating', 'is', null);

      // Exclude current course if we have an ID
      if (params.courseId) {
        query = query.neq('course_id', params.courseId as string);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform and dedupe by course (keep highest rating per course)
      const courseMap = new Map<string, RatedCourse>();

      (data || []).forEach(round => {
        if (round.course && round.rating) {
          const course = round.course as any;
          const existing = courseMap.get(course.id);
          if (!existing || round.rating > existing.rating) {
            courseMap.set(course.id, {
              id: course.id,
              name: course.name,
              rating: round.rating,
              location: course.location || '',
            });
          }
        }
      });

      setUserRatedCourses(Array.from(courseMap.values()));
    } catch (error) {
      console.error('Error loading rated courses:', error);
    } finally {
      setLoadingCourses(false);
    }
  };

  useEffect(() => {
    // Find courses within 0.2 rating range
    const filtered = userRatedCourses.filter(course => {
      const diff = Math.abs(course.rating - rating);
      return diff <= 0.2;
    });
    setSimilarCourses(filtered);
  }, [rating, userRatedCourses]);

  const uploadPhotos = async (photoUris: string[], userId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const uri of photoUris) {
      try {
        // Read the file as base64
        const base64 = await readAsStringAsync(uri, {
          encoding: 'base64',
        });

        // Generate unique filename
        const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('round-photos')
          .upload(fileName, decode(base64), {
            contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          });

        if (error) {
          console.error('Upload error:', error);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('round-photos')
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      } catch (err) {
        console.error('Error uploading photo:', err);
      }
    }

    return uploadedUrls;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('You must be logged in to post a round');
        setIsSubmitting(false);
        return;
      }

      // Parse params
      const partners = params.partners ? JSON.parse(params.partners as string) : { selectedFriends: [], manualNames: '' };
      const localPhotos = params.photos ? JSON.parse(params.photos as string) : [];
      const tees = params.tees ? JSON.parse(params.tees as string) : null;

      // Upload photos to Supabase Storage
      let uploadedPhotoUrls: string[] = [];
      if (localPhotos.length > 0) {
        uploadedPhotoUrls = await uploadPhotos(localPhotos, user.id);
      }

      // Create round object
      const roundData = {
        user_id: user.id,
        course_id: params.courseId,
        rating: rating,
        score: params.score ? parseInt(params.score as string) : null,
        date_played: params.datePlayed ? new Date(params.datePlayed as string).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        notes: params.notes || null,
        partners: partners.manualNames || null,
        photos: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : null,
      };

      console.log('Submitting round:', roundData);

      // Insert into database
      const { data, error } = await supabase
        .from('rounds')
        .insert([roundData])
        .select();

      if (error) {
        handleError(error, 'Posting round');
        setIsSubmitting(false);
        return;
      }

      // Success!
      toast.success('Round posted!');
      router.replace('/(tabs)');
    } catch (err) {
      handleError(err, 'Posting round');
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate the Course</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        {/* Course Info */}
        <View style={styles.courseInfo}>
          <Text style={styles.courseName}>{params.courseName}</Text>
          <Text style={styles.courseLocation}>
            <Ionicons name="location-outline" size={14} color="#6b7280" />
            {' '}{params.courseLocation}
          </Text>
        </View>

        {/* Rating Display */}
        <View style={styles.ratingDisplay}>
          <Ionicons name="golf" size={40} color="#16a34a" />
          <Text style={styles.ratingNumber}>{rating.toFixed(1)}</Text>
          <Text style={styles.ratingOutOf}>/10</Text>
        </View>

        {/* Slider */}
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            step={0.1}
            value={rating}
            onValueChange={setRating}
            minimumTrackTintColor="#16a34a"
            maximumTrackTintColor="#e5e7eb"
            thumbTintColor="#16a34a"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>1.0</Text>
            <Text style={styles.sliderLabel}>10.0</Text>
          </View>
        </View>

        {/* Similar Courses */}
        <View style={styles.similarContainer}>
          {loadingCourses ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color="#16a34a" />
              <Text style={styles.emptyStateText}>Loading your rated courses...</Text>
            </View>
          ) : similarCourses.length > 0 ? (
            <>
              <Text style={styles.similarTitle}>
                You also rated these courses around {rating.toFixed(1)}
              </Text>
              <ScrollView
                style={styles.similarScroll}
                showsVerticalScrollIndicator={false}
              >
                {similarCourses.map((course) => (
                  <View key={course.id} style={styles.similarCourse}>
                    <View style={styles.similarCourseInfo}>
                      <Text style={styles.similarCourseName}>{course.name}</Text>
                      <Text style={styles.similarCourseLocation}>{course.location}</Text>
                    </View>
                    <View style={styles.similarCourseRating}>
                      <Ionicons name="golf" size={16} color="#16a34a" />
                      <Text style={styles.similarCourseRatingText}>{course.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </>
          ) : userRatedCourses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="golf-outline" size={40} color="#d1d5db" />
              <Text style={styles.emptyStateText}>
                This will be your first rated course!
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color="#d1d5db" />
              <Text style={styles.emptyStateText}>
                No courses rated around {rating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Post Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.postButton, isSubmitting && styles.postButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Text style={styles.postButtonText}>Posting...</Text>
          ) : (
            <>
              <Text style={styles.postButtonText}>Post Round</Text>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  courseInfo: {
    marginBottom: 40,
    alignItems: 'center',
  },
  courseName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#16a34a',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  courseLocation: {
    fontSize: 15,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 40,
  },
  ratingNumber: {
    fontSize: 80,
    fontWeight: '700',
    color: '#16a34a',
    marginHorizontal: 16,
    fontFamily: 'Inter',
  },
  ratingOutOf: {
    fontSize: 32,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  sliderContainer: {
    marginBottom: 40,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#9ca3af',
    fontFamily: 'Inter',
  },
  similarContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: 280,
  },
  similarScroll: {
    maxHeight: 200,
  },
  similarTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  similarCourse: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  similarCourseInfo: {
    flex: 1,
  },
  similarCourseName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
    fontFamily: 'Inter',
  },
  similarCourseLocation: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  similarCourseRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  similarCourseRatingText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
    fontFamily: 'Inter',
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    padding: 18,
    borderRadius: 12,
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  postButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
  },
});