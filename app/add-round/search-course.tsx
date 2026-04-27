import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';

type QuickCourse = {
  id: string;
  name: string;
  location: string;
  roundCount?: number;
  lastPlayed?: string;
};

export default function SearchCourseScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentCourses, setRecentCourses] = useState<QuickCourse[]>([]);
  const [loadingQuickPicks, setLoadingQuickPicks] = useState(true);

  const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadQuickPicks();
  }, []);

  // Trigger search when debounced query changes
  useEffect(() => {
    searchCourses(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  const loadQuickPicks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all user's rounds with course info
      const { data: rounds } = await supabase
        .from('rounds')
        .select(`
          course_id,
          date_played,
          course:courses(id, name, location)
        `)
        .eq('user_id', user.id)
        .order('date_played', { ascending: false });

      if (!rounds || rounds.length === 0) {
        setLoadingQuickPicks(false);
        return;
      }

      // Get recent courses (last 3 unique courses played)
      const seen = new Set<string>();
      const recent: QuickCourse[] = [];
      for (const round of rounds) {
        if (round.course && !seen.has(round.course_id)) {
          seen.add(round.course_id);
          recent.push({
            id: (round.course as any).id,
            name: (round.course as any).name,
            location: (round.course as any).location,
            lastPlayed: round.date_played,
          });
          if (recent.length >= 3) break;
        }
      }
      setRecentCourses(recent);
    } catch {
      // Silent fail - quick picks are optional
    } finally {
      setLoadingQuickPicks(false);
    }
  };

const searchCourses = async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      // Use new Places API (Text Search)
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

      if (data.error) {
        toast.error('Search failed. Please try again.');
        return;
      }

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
    } catch {
      toast.error('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleQuickPickSelect = (course: QuickCourse) => {
    router.push({
      pathname: '/add-round/date-selection',
      params: {
        courseId: course.id,
        courseName: course.name,
        courseLocation: course.location,
      },
    });
  };

  const handleCourseSelect = async (course: any) => {
    try {
      const { data: existingCourse } = await supabase
        .from('courses')
        .select('*')
        .eq('google_place_id', course.google_place_id)
        .single();

      let courseId;

      if (existingCourse) {
        courseId = existingCourse.id;
      } else {
        const { data: newCourse, error } = await supabase
          .from('courses')
          .insert([
            {
              name: course.name,
              location: course.location,
              google_place_id: course.google_place_id,
              latitude: course.latitude,
              longitude: course.longitude,
            },
          ])
          .select()
          .single();

        if (error) {
          toast.error('Failed to add course. Please try again.');
          return;
        }

        courseId = newCourse.id;
      }

      router.push({
        pathname: '/add-round/date-selection',
        params: {
          courseId: courseId,
          courseName: course.name,
          courseLocation: course.location,
        },
      });
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="close" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Round</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a golf course..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
        />
        {isSearching && (
          <ActivityIndicator size="small" color="#16a34a" />
        )}
      </View>

      <ScrollView style={styles.content}>
        {searchQuery === '' && (
          <>
            {loadingQuickPicks ? (
              <View style={styles.loadingQuickPicks}>
                <ActivityIndicator size="small" color="#16a34a" />
              </View>
            ) : recentCourses.length > 0 ? (
              <>
                {/* Recent Courses */}
                <View style={styles.quickPickSection}>
                  <View style={styles.quickPickHeader}>
                    <Ionicons name="time-outline" size={18} color="#6b7280" />
                    <Text style={styles.quickPickTitle}>Recently Played</Text>
                  </View>
                  {recentCourses.map((course) => (
                    <TouchableOpacity
                      key={course.id}
                      style={styles.quickPickCard}
                      onPress={() => handleQuickPickSelect(course)}
                    >
                      <View style={styles.quickPickIcon}>
                        <Ionicons name="golf" size={20} color="#16a34a" />
                      </View>
                      <View style={styles.quickPickInfo}>
                        <Text style={styles.quickPickName} numberOfLines={1}>{course.name}</Text>
                        <Text style={styles.quickPickLocation} numberOfLines={1}>
                          {course.location}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Search hint */}
                <View style={styles.searchHint}>
                  <Text style={styles.searchHintText}>
                    Or search for a new course above
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="golf-outline" size={64} color="#d1d5db" />
                <Text style={styles.emptyStateText}>Search for any golf course</Text>
                <Text style={styles.emptyStateSubtext}>
                  Start typing to find courses worldwide
                </Text>
              </View>
            )}
          </>
        )}

        {searchQuery !== '' && searchResults.length === 0 && !isSearching && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyStateText}>No courses found</Text>
            <Text style={styles.emptyStateSubtext}>
              Try a different search term
            </Text>
          </View>
        )}

        {searchResults.map((course, index) => (
          <TouchableOpacity
            key={index}
            style={styles.courseCard}
            onPress={() => handleCourseSelect(course)}
          >
            <View style={styles.courseIcon}>
              <Ionicons name="golf" size={24} color="#16a34a" />
            </View>
            <View style={styles.courseInfo}>
              <Text style={styles.courseName}>{course.name}</Text>
              <Text style={styles.courseLocation}>
                <Ionicons name="location-outline" size={14} color="#6b7280" />
                {' '}{course.location}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    fontFamily: 'Inter',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  courseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  courseLocation: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  loadingQuickPicks: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  quickPickSection: {
    marginBottom: 24,
  },
  quickPickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  quickPickTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  quickPickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quickPickIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickPickInfo: {
    flex: 1,
  },
  quickPickName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
    fontFamily: 'Inter',
  },
  quickPickLocation: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  searchHint: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  searchHintText: {
    fontSize: 14,
    color: '#9ca3af',
    fontFamily: 'Inter',
  },
});