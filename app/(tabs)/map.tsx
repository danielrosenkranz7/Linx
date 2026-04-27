import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, Region } from 'react-native-maps';
import { handleError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

type Course = {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  avg_rating?: number;
  user_rating?: number;
  distance?: number;
  isFromDatabase?: boolean;
};

const DEFAULT_DELTA = {
  latitudeDelta: 0.3,
  longitudeDelta: 0.3,
};

// Multiple Overpass API endpoints for redundancy
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// Calculate distance between two coordinates in miles
const getDistanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Fetch golf courses from Overpass API with retry logic
const fetchCoursesFromOverpass = async (
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<Course[]> => {
  const query = `
    [out:json][timeout:25];
    (
      way["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
      relation["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
      node["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});
    );
    out center tags;
  `;

  // Try each endpoint until one works
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Overpass endpoint ${endpoint} returned ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (!data.elements || !Array.isArray(data.elements)) {
        continue;
      }

      const courses: Course[] = data.elements
        .filter((el: any) => el.tags?.name)
        .map((el: any) => {
          const courseLat = el.center?.lat || el.lat;
          const courseLng = el.center?.lon || el.lon;

          if (!courseLat || !courseLng) return null;

          // Build location string from address tags
          const city = el.tags['addr:city'] || '';
          const state = el.tags['addr:state'] || '';
          const location = [city, state].filter(Boolean).join(', ') || 'Golf Course';

          return {
            id: `osm-${el.id}`,
            name: el.tags.name,
            location,
            latitude: courseLat,
            longitude: courseLng,
            distance: getDistanceMiles(lat, lng, courseLat, courseLng),
            isFromDatabase: false,
          };
        })
        .filter(Boolean) as Course[];

      return courses;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn(`Overpass endpoint ${endpoint} timed out`);
      } else {
        console.warn(`Overpass endpoint ${endpoint} failed:`, error.message);
      }
      continue;
    }
  }

  // All endpoints failed
  return [];
};

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [showSearchHere, setShowSearchHere] = useState(false);
  const [lastSearchedRegion, setLastSearchedRegion] = useState<Region | null>(null);
  const [currentMapRegion, setCurrentMapRegion] = useState<Region | null>(null);

  useEffect(() => {
    initializeMap();
  }, []);

  const initializeMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied');
        const defaultRegion = {
          latitude: 37.7749,
          longitude: -122.4194,
          ...DEFAULT_DELTA,
        };
        setRegion(defaultRegion);
        setLastSearchedRegion(defaultRegion);
        setCurrentMapRegion(defaultRegion);
        setLoading(false);
        loadCourses(37.7749, -122.4194);
        return;
      }

      // Try to get last known location first (instant)
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const quickRegion = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
          ...DEFAULT_DELTA,
        };
        setRegion(quickRegion);
        setLastSearchedRegion(quickRegion);
        setCurrentMapRegion(quickRegion);
        setLocation(lastKnown);
        setLoading(false);
        loadCourses(lastKnown.coords.latitude, lastKnown.coords.longitude);
      }

      // Get accurate location in background
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation(currentLocation);

      if (!lastKnown) {
        const newRegion = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          ...DEFAULT_DELTA,
        };
        setRegion(newRegion);
        setLastSearchedRegion(newRegion);
        setCurrentMapRegion(newRegion);
        setLoading(false);
        loadCourses(currentLocation.coords.latitude, currentLocation.coords.longitude);
      }
    } catch (error) {
      handleError(error, 'Getting location');
      setErrorMsg('Failed to get location');
      const defaultRegion = {
        latitude: 37.7749,
        longitude: -122.4194,
        ...DEFAULT_DELTA,
      };
      setRegion(defaultRegion);
      setLastSearchedRegion(defaultRegion);
      setCurrentMapRegion(defaultRegion);
      setLoading(false);
      loadCourses(37.7749, -122.4194);
    }
  };

  const loadCourses = async (lat: number, lng: number, radiusMiles: number = 25) => {
    try {
      const radiusMeters = radiusMiles * 1609.34;

      // Fetch from OpenStreetMap
      const osmCourses = await fetchCoursesFromOverpass(lat, lng, radiusMeters);

      // Also fetch from our database (for user-added courses with ratings)
      const { data: dbCourses } = await supabase
        .from('courses')
        .select('id, name, location, latitude, longitude')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Get ratings for database courses
      let ratingsMap: Record<string, { total: number; count: number }> = {};
      let userRatingsMap: Record<string, number> = {};
      if (dbCourses && dbCourses.length > 0) {
        const courseIds = dbCourses.map(c => c.id);
        const { data: roundsData } = await supabase
          .from('rounds')
          .select('course_id, rating, user_id')
          .in('course_id', courseIds);

        (roundsData || []).forEach(round => {
          if (!ratingsMap[round.course_id]) {
            ratingsMap[round.course_id] = { total: 0, count: 0 };
          }
          ratingsMap[round.course_id].total += round.rating;
          ratingsMap[round.course_id].count += 1;

          // Track current user's rating
          if (user && round.user_id === user.id && !userRatingsMap[round.course_id]) {
            userRatingsMap[round.course_id] = round.rating;
          }
        });
      }

      // Process database courses
      const dbCoursesProcessed: Course[] = (dbCourses || [])
        .filter(course => course.latitude && course.longitude)
        .map(course => ({
          ...course,
          distance: getDistanceMiles(lat, lng, course.latitude, course.longitude),
          avg_rating: ratingsMap[course.id]
            ? ratingsMap[course.id].total / ratingsMap[course.id].count
            : undefined,
          user_rating: userRatingsMap[course.id],
          isFromDatabase: true,
        }))
        .filter(course => course.distance <= radiusMiles);

      // Merge: prefer database courses (they have ratings), add OSM courses that aren't duplicates
      const mergedCourses: Course[] = [...dbCoursesProcessed];
      const dbNames = new Set(dbCoursesProcessed.map(c => c.name.toLowerCase()));

      osmCourses.forEach(osmCourse => {
        // Check if this course is already in our database (by name similarity)
        const isDuplicate = dbCoursesProcessed.some(dbCourse => {
          const nameSimilar = dbCourse.name.toLowerCase().includes(osmCourse.name.toLowerCase()) ||
            osmCourse.name.toLowerCase().includes(dbCourse.name.toLowerCase());
          const distanceClose = getDistanceMiles(
            dbCourse.latitude,
            dbCourse.longitude,
            osmCourse.latitude,
            osmCourse.longitude
          ) < 0.5; // Within 0.5 miles
          return nameSimilar && distanceClose;
        });

        if (!isDuplicate && osmCourse.distance <= radiusMiles) {
          mergedCourses.push(osmCourse);
        }
      });

      // Sort by distance
      mergedCourses.sort((a, b) => (a.distance || 0) - (b.distance || 0));

      setCourses(mergedCourses);

      if (mergedCourses.length === 0 && osmCourses.length === 0) {
        setErrorMsg('Could not load courses. Try again later.');
      } else {
        setErrorMsg(null);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      setErrorMsg('Failed to load courses');
      setCourses([]);
    }
  };

  const onRegionChangeComplete = (newRegion: Region) => {
    setCurrentMapRegion(newRegion);

    if (lastSearchedRegion) {
      const distanceMoved = getDistanceMiles(
        lastSearchedRegion.latitude,
        lastSearchedRegion.longitude,
        newRegion.latitude,
        newRegion.longitude
      );
      if (distanceMoved > 5) {
        setShowSearchHere(true);
      } else {
        setShowSearchHere(false);
      }
    }
  };

  const searchHere = async () => {
    if (!currentMapRegion) return;

    setSearching(true);
    setShowSearchHere(false);
    setErrorMsg(null);

    // Calculate radius based on zoom level
    const zoomBasedRadius = Math.max(currentMapRegion.latitudeDelta * 40, 15);
    const radiusMiles = Math.min(zoomBasedRadius, 50);

    await loadCourses(
      currentMapRegion.latitude,
      currentMapRegion.longitude,
      radiusMiles
    );

    setLastSearchedRegion(currentMapRegion);
    setSearching(false);
  };

  const centerOnUser = async () => {
    if (location && mapRef.current) {
      const userRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        ...DEFAULT_DELTA,
      };
      mapRef.current.animateToRegion(userRegion);

      await loadCourses(location.coords.latitude, location.coords.longitude);
      setLastSearchedRegion(userRegion);
      setShowSearchHere(false);
    }
  };

  const handleCoursePress = (course: Course) => {
    // Only navigate to detail if it's a database course
    if (course.isFromDatabase) {
      router.push(`/course/${course.id}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Finding courses near you...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region || {
            latitude: 37.7749,
            longitude: -122.4194,
            ...DEFAULT_DELTA,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          onRegionChangeComplete={onRegionChangeComplete}
        >
          {courses.map((course) => (
            <Marker
              key={course.id}
              coordinate={{
                latitude: course.latitude,
                longitude: course.longitude,
              }}
              pinColor={course.user_rating ? '#16a34a' : '#3b82f6'}
            >
              <Callout
                tooltip
                onPress={() => handleCoursePress(course)}
              >
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{course.name}</Text>
                  <View style={styles.calloutDetails}>
                    <Ionicons name="location-outline" size={12} color="#6b7280" />
                    <Text style={styles.calloutLocation} numberOfLines={2}>
                      {course.location}
                    </Text>
                  </View>
                  {course.user_rating ? (
                    <View style={styles.calloutRating}>
                      <Ionicons name="golf" size={14} color="#16a34a" />
                      <Text style={styles.calloutRatingText}>
                        {course.user_rating.toFixed(1)}
                      </Text>
                    </View>
                  ) : course.avg_rating ? (
                    <View style={styles.calloutRating}>
                      <Ionicons name="golf" size={14} color="#16a34a" />
                      <Text style={styles.calloutRatingText}>
                        {course.avg_rating.toFixed(1)} (avg)
                      </Text>
                    </View>
                  ) : null}
                  {course.distance !== undefined && (
                    <Text style={styles.calloutDistance}>
                      {course.distance.toFixed(1)} miles away
                    </Text>
                  )}
                  {course.isFromDatabase ? (
                    <Text style={styles.calloutTap}>Tap for details</Text>
                  ) : (
                    <Text style={styles.calloutHint}>Log a round to add ratings</Text>
                  )}
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        {/* Search Here button */}
        {showSearchHere && (
          <TouchableOpacity
            style={styles.searchHereButton}
            onPress={searchHere}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="search" size={16} color="#fff" />
                <Text style={styles.searchHereText}>Search This Area</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Center on user button */}
        {location && (
          <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
            <Ionicons name="locate" size={24} color="#16a34a" />
          </TouchableOpacity>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#16a34a' }]} />
            <Text style={styles.legendText}>You've Played</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.legendText}>Discover</Text>
          </View>
        </View>
      </View>

      {/* Error message */}
      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity onPress={() => searchHere()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    fontFamily: 'Inter',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  searchHereButton: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  searchHereText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  centerButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  legend: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  callout: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    minWidth: 180,
    maxWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  calloutDetails: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 6,
  },
  calloutLocation: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: 'Inter',
    flex: 1,
  },
  calloutRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  calloutRatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  calloutDistance: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'Inter',
    marginBottom: 6,
  },
  calloutTap: {
    fontSize: 12,
    color: '#16a34a',
    fontFamily: 'Inter',
    textAlign: 'center',
    fontWeight: '500',
  },
  calloutHint: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'Inter',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorBanner: {
    position: 'absolute',
    top: 130,
    left: 20,
    right: 20,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    fontFamily: 'Inter',
    flex: 1,
  },
  retryText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
    fontFamily: 'Inter',
    marginLeft: 12,
  },
});
