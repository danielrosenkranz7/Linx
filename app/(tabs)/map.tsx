import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, Region } from 'react-native-maps';
import { handleError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';

type Course = {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  avg_rating?: number;
  distance?: number;
  osm_id?: string;
  isFromOSM?: boolean;
};

const DEFAULT_DELTA = {
  latitudeDelta: 0.3,
  longitudeDelta: 0.3,
};

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
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied');
        // Still load courses with a default location
        await loadCourses(37.7749, -122.4194); // Default to SF
        return;
      }

      // Get current location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(currentLocation);

      const newRegion = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        ...DEFAULT_DELTA,
      };
      setRegion(newRegion);
      setLastSearchedRegion(newRegion);
      setCurrentMapRegion(newRegion);

      // Load courses near user
      await loadCourses(currentLocation.coords.latitude, currentLocation.coords.longitude);
    } catch (error) {
      handleError(error, 'Getting location');
      setErrorMsg('Failed to get location');
      await loadCourses(37.7749, -122.4194);
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async (lat: number, lng: number, radiusMiles: number = 15) => {
    try {
      // Convert miles to meters for Overpass API (cap at 50km for speed)
      const radiusMeters = Math.min(Math.round(radiusMiles * 1609.34), 50000);

      console.log('Fetching golf courses for location:', lat, lng, 'radius:', radiusMeters);

      // Overpass API query - only ways and relations (nodes are rarely golf courses)
      const overpassQuery = `[out:json][timeout:15];(way["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});relation["leisure"="golf_course"](around:${radiusMeters},${lat},${lng}););out center tags;`;

      // Use a faster Overpass mirror
      const response = await fetch('https://overpass.kumi.systems/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });

      if (!response.ok) {
        console.error('Overpass API HTTP error:', response.status);
        await loadCoursesFromDatabase(lat, lng, radiusMiles);
        return;
      }

      const data = await response.json();

      console.log('Overpass results:', data.elements?.length || 0);

      if (!data.elements || data.elements.length === 0) {
        console.log('No golf courses found in this area');
        setCourses([]);
        return;
      }

      // Log sample
      if (data.elements.length > 0) {
        console.log('Sample:', data.elements.slice(0, 3).map((e: any) => e.tags?.name || 'Unnamed'));
      }

      // Parse OSM results
      const osmCourses: Course[] = data.elements
        .filter((element: any) => {
          // Must have coordinates (center for ways/relations, or direct lat/lon for nodes)
          const hasCoords = (element.center?.lat && element.center?.lon) || (element.lat && element.lon);
          return hasCoords;
        })
        .map((element: any) => {
          const latitude = element.center?.lat || element.lat;
          const longitude = element.center?.lon || element.lon;
          const name = element.tags?.name || 'Golf Course';
          const city = element.tags?.['addr:city'] || '';
          const state = element.tags?.['addr:state'] || '';
          const location = [city, state].filter(Boolean).join(', ') || 'Location unavailable';

          return {
            id: `osm_${element.type}_${element.id}`,
            osm_id: `${element.type}/${element.id}`,
            name,
            location,
            latitude,
            longitude,
            distance: getDistanceMiles(lat, lng, latitude, longitude),
            isFromOSM: true,
          };
        });

      console.log('Golf courses found:', osmCourses.length);

      // Also load courses from our database to get ratings
      const { data: localCourses } = await supabase
        .from('courses')
        .select('id, name, location, latitude, longitude, osm_id')
        .not('latitude', 'is', null);

      // Get ratings for local courses
      const localCourseIds = (localCourses || []).map(c => c.id);
      const { data: roundsData } = await supabase
        .from('rounds')
        .select('course_id, rating')
        .in('course_id', localCourseIds);

      // Calculate average ratings
      const ratingsMap: Record<string, { total: number; count: number }> = {};
      (roundsData || []).forEach(round => {
        if (!ratingsMap[round.course_id]) {
          ratingsMap[round.course_id] = { total: 0, count: 0 };
        }
        ratingsMap[round.course_id].total += round.rating;
        ratingsMap[round.course_id].count += 1;
      });

      // Add ratings to local courses
      const localCoursesWithRatings = (localCourses || []).map(course => ({
        ...course,
        avg_rating: ratingsMap[course.id]
          ? ratingsMap[course.id].total / ratingsMap[course.id].count
          : undefined,
      }));

      console.log('Local courses with ratings:', localCoursesWithRatings.map(c => ({ name: c.name, avg: c.avg_rating })));

      // Helper to normalize course names for comparison
      const normalizeName = (name: string) => {
        return name.toLowerCase()
          .replace(/golf course/g, '')
          .replace(/golf club/g, '')
          .replace(/country club/g, '')
          .replace(/golf/g, '')
          .replace(/club/g, '')
          .replace(/&/g, 'and')
          .replace(/[^a-z0-9]/g, '')
          .trim();
      };

      // Merge OSM results with local data (ratings)
      const mergedCourses = osmCourses.map(course => {
        // First try exact osm_id match
        let localData = localCoursesWithRatings.find(lc => lc.osm_id === course.osm_id);

        // If no osm_id match, try matching by normalized name
        if (!localData) {
          const osmNormalized = normalizeName(course.name);
          localData = localCoursesWithRatings.find(lc => {
            const localNormalized = normalizeName(lc.name);
            return localNormalized === osmNormalized ||
                   localNormalized.includes(osmNormalized) ||
                   osmNormalized.includes(localNormalized);
          });
        }

        // If still no match, try matching by coordinates (within 0.3 miles)
        if (!localData) {
          localData = localCoursesWithRatings.find(lc => {
            if (!lc.latitude || !lc.longitude) return false;
            const dist = getDistanceMiles(course.latitude, course.longitude, lc.latitude, lc.longitude);
            return dist < 0.3;
          });
        }

        if (localData) {
          console.log('Matched:', course.name, '→', localData.name, 'rating:', localData.avg_rating);
          return {
            ...course,
            id: localData.id,
            avg_rating: localData.avg_rating,
            isFromOSM: false,
          };
        }
        return course;
      });

      // Sort by distance
      mergedCourses.sort((a, b) => (a.distance || 0) - (b.distance || 0));

      // Deduplicate by ID (keep first occurrence which has shortest distance)
      const seen = new Set<string>();
      const uniqueCourses = mergedCourses.filter(course => {
        if (seen.has(course.id)) return false;
        seen.add(course.id);
        return true;
      });

      setCourses(uniqueCourses);
    } catch (error) {
      handleError(error, 'Loading courses');
      // Fall back to local database
      await loadCoursesFromDatabase(lat, lng, radiusMiles);
    }
  };

  const loadCoursesFromDatabase = async (lat: number, lng: number, radiusMiles: number) => {
    try {
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, name, location, latitude, longitude, osm_id')
        .not('latitude', 'is', null);

      if (!coursesData || coursesData.length === 0) {
        setCourses([]);
        return;
      }

      const nearbyCourses = coursesData
        .map(course => ({
          ...course,
          distance: getDistanceMiles(lat, lng, course.latitude, course.longitude),
        }))
        .filter(course => course.distance <= radiusMiles)
        .sort((a, b) => a.distance - b.distance);

      const courseIds = nearbyCourses.map(c => c.id);
      const { data: roundsData } = await supabase
        .from('rounds')
        .select('course_id, rating')
        .in('course_id', courseIds);

      const ratingsMap: Record<string, { total: number; count: number }> = {};
      (roundsData || []).forEach(round => {
        if (!ratingsMap[round.course_id]) {
          ratingsMap[round.course_id] = { total: 0, count: 0 };
        }
        ratingsMap[round.course_id].total += round.rating;
        ratingsMap[round.course_id].count += 1;
      });

      const coursesWithRatings = nearbyCourses.map(course => ({
        ...course,
        avg_rating: ratingsMap[course.id]
          ? ratingsMap[course.id].total / ratingsMap[course.id].count
          : undefined,
      }));

      setCourses(coursesWithRatings);
    } catch (error) {
      console.error('Error loading from database:', error);
      setCourses([]);
    }
  };

  const onRegionChangeComplete = (newRegion: Region) => {
    setCurrentMapRegion(newRegion);

    // Show "Search Here" button if user has moved significantly from last search
    if (lastSearchedRegion) {
      const distanceMoved = getDistanceMiles(
        lastSearchedRegion.latitude,
        lastSearchedRegion.longitude,
        newRegion.latitude,
        newRegion.longitude
      );
      // Show button if moved more than 5 miles
      if (distanceMoved > 5) {
        setShowSearchHere(true);
      }
    }
  };

  const searchHere = async () => {
    if (!currentMapRegion) return;

    setSearching(true);
    setShowSearchHere(false);

    // Calculate radius based on zoom level - smaller when zoomed in
    const zoomBasedRadius = currentMapRegion.latitudeDelta * 40; // tighter radius
    const radiusMiles = Math.min(Math.max(zoomBasedRadius, 5), 15); // 5-15 mile range

    await loadCourses(currentMapRegion.latitude, currentMapRegion.longitude, radiusMiles);
    setLastSearchedRegion(currentMapRegion);
    setSearching(false);
  };

  const centerOnUser = async () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        ...DEFAULT_DELTA,
      });
    }
  };

  const handleCoursePress = async (course: Course) => {
    if (course.isFromOSM && course.osm_id) {
      // Course is from OSM and not in our DB yet - save it first
      try {
        const { data, error } = await supabase
          .from('courses')
          .insert({
            name: course.name,
            location: course.location,
            latitude: course.latitude,
            longitude: course.longitude,
            osm_id: course.osm_id,
          })
          .select('id')
          .single();

        if (error) {
          // Might already exist, try to fetch it
          const { data: existing } = await supabase
            .from('courses')
            .select('id')
            .eq('osm_id', course.osm_id)
            .single();

          if (existing) {
            router.push(`/course/${existing.id}`);
            return;
          }
          console.error('Error saving course:', error);
          return;
        }

        router.push(`/course/${data.id}`);
      } catch (error) {
        console.error('Error handling course press:', error);
      }
    } else {
      // Course is already in our DB
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore Courses</Text>
        <Text style={styles.headerSubtitle}>{courses.length} courses nearby</Text>
      </View>

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
              pinColor="#16a34a"
            >
              <Callout
                tooltip
                onPress={() => handleCoursePress(course)}
              >
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{course.name}</Text>
                  <View style={styles.calloutDetails}>
                    <Ionicons name="location-outline" size={12} color="#6b7280" />
                    <Text style={styles.calloutLocation}>{course.location}</Text>
                  </View>
                  {course.avg_rating && (
                    <View style={styles.calloutRating}>
                      <Ionicons name="golf" size={14} color="#16a34a" />
                      <Text style={styles.calloutRatingText}>
                        {course.avg_rating.toFixed(1)} avg
                      </Text>
                    </View>
                  )}
                  <Text style={styles.calloutTap}>Tap for details</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        {/* Search Here button */}
        {showSearchHere && (
          <TouchableOpacity style={styles.searchHereButton} onPress={searchHere} disabled={searching}>
            {searching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="search" size={16} color="#fff" />
                <Text style={styles.searchHereText}>Search Here</Text>
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
      </View>

      {/* Error message */}
      {errorMsg && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
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
    top: 16,
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
    alignItems: 'center',
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
    marginBottom: 8,
  },
  calloutRatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  calloutTap: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  errorBanner: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
});
