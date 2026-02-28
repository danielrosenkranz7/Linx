import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';

export default function OnboardingHomeCourse() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const searchCourses = async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places:searchText`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY || '',
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.id',
          },
          body: JSON.stringify({
            textQuery: query + ' golf course',
          }),
        }
      );

      const data = await response.json();

      if (data.places) {
        const courses = data.places.map((place: any) => ({
          google_place_id: place.id,
          name: place.displayName?.text || place.displayName,
          location: place.formattedAddress,
          latitude: place.location?.latitude,
          longitude: place.location?.longitude,
        }));
        setSearchResults(courses);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCourse = (course: any) => {
    setSelectedCourse(course);
    setSearchQuery(course.name);
    setSearchResults([]);
  };

  const handleContinue = async () => {
    if (!selectedCourse) {
      router.push('/onboarding/follow');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if course exists or create it
      let courseId;
      const { data: existingCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('google_place_id', selectedCourse.google_place_id)
        .single();

      if (existingCourse) {
        courseId = existingCourse.id;
      } else {
        const { data: newCourse, error } = await supabase
          .from('courses')
          .insert([{
            name: selectedCourse.name,
            location: selectedCourse.location,
            google_place_id: selectedCourse.google_place_id,
            latitude: selectedCourse.latitude,
            longitude: selectedCourse.longitude,
          }])
          .select()
          .single();

        if (error) throw error;
        courseId = newCourse.id;
      }

      // Update profile with home course
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ home_course_id: courseId })
        .eq('id', user.id);

      if (updateError) throw updateError;

      router.push('/onboarding/follow');
    } catch (error) {
      console.error('Error saving home course:', error);
      toast.error('Failed to save home course');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.push('/onboarding/follow');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>Step 2 of 3</Text>
        </View>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="home" size={40} color="#16a34a" />
          </View>
          <Text style={styles.title}>Where do you play?</Text>
          <Text style={styles.subtitle}>
            Set your home course so friends can find you
          </Text>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a course..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setSelectedCourse(null);
                searchCourses(text);
              }}
            />
            {isSearching && <ActivityIndicator size="small" color="#16a34a" />}
          </View>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              {searchResults.map((course, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.resultItem}
                  onPress={() => handleSelectCourse(course)}
                >
                  <View style={styles.resultIcon}>
                    <Ionicons name="golf" size={24} color="#16a34a" />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{course.name}</Text>
                    <Text style={styles.resultLocation} numberOfLines={1}>
                      {course.location}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Selected Course */}
          {selectedCourse && (
            <View style={styles.selectedCourse}>
              <View style={styles.selectedIcon}>
                <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
              </View>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedName}>{selectedCourse.name}</Text>
                <Text style={styles.selectedLocation}>{selectedCourse.location}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setSelectedCourse(null);
                  setSearchQuery('');
                }}
              >
                <Ionicons name="close-circle" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, saving && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={saving}
        >
          <Text style={styles.continueButtonText}>
            {saving ? 'Saving...' : selectedCourse ? 'Continue' : 'Skip for now'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
  },
  stepIndicator: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  skipText: {
    fontSize: 16,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
    fontFamily: 'Inter',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#1a1a1a',
  },
  resultsContainer: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  resultLocation: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  selectedCourse: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  selectedIcon: {
    marginRight: 12,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  selectedLocation: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    padding: 18,
    borderRadius: 14,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter',
  },
});
