import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [bookmarkedCourses, setBookmarkedCourses] = useState<any[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedRatings, setEditedRatings] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load profile with home course info
      const { data: profileData } = await supabase
        .from('profiles')
        .select(`
          *,
          home_course:courses(name, location)
        `)
        .eq('id', user.id)
        .single();

      setProfile(profileData);

      // Load follower count (people who follow this user)
      const { count: followerCount } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      setFollowersCount(followerCount || 0);

      // Load following count (people this user follows)
      const { count: followingCountResult } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      setFollowingCount(followingCountResult || 0);

      // Load rounds with course info, sorted by rating (desc) then created_at (desc) for tiebreaker
      const { data: roundsData } = await supabase
        .from('rounds')
        .select(`
          *,
          courses (
            id,
            name,
            location
          )
        `)
        .eq('user_id', user.id)
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false });

      setRounds(roundsData || []);

      // Initialize edited ratings
      const ratingsMap: { [key: string]: number } = {};
      roundsData?.forEach(round => {
        ratingsMap[round.id] = round.rating;
      });
      setEditedRatings(ratingsMap);

      // Load bookmarked courses
      const { data: bookmarksData } = await supabase
        .from('bookmarks')
        .select(`
          id,
          course:courses (
            id,
            name,
            location
          ),
          created_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setBookmarkedCourses(bookmarksData || []);

    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickProfileImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const imageUri = result.assets[0].uri;
      const base64 = result.assets[0].base64;

      // Show local preview immediately
      setProfile({
        ...profile,
        avatar_url: imageUri,
      });

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Create unique filename
        const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;

        // Decode base64 to Uint8Array
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, bytes, {
            contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        const publicUrl = urlData.publicUrl;

        // Update profile in database
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', user.id);

        if (updateError) throw updateError;

        // Update local state with server URL
        setProfile({
          ...profile,
          avatar_url: publicUrl,
        });

      } catch (error) {
        console.error('Error uploading avatar:', error);
        Alert.alert('Upload Failed', 'Could not upload profile picture. Please try again.');
        // Revert to original avatar
        loadProfile();
      }
    }
  };

  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out ${profile?.name || 'my'} golf profile on Linx!`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const updateRating = (roundId: string, newRating: number) => {
    setEditedRatings({
      ...editedRatings,
      [roundId]: newRating,
    });
  };

  const saveRankings = async () => {
    try {
      for (const roundId in editedRatings) {
        const round = rounds.find(r => r.id === roundId);
        if (round && editedRatings[roundId] !== round.rating) {
          await supabase
            .from('rounds')
            .update({ rating: editedRatings[roundId] })
            .eq('id', roundId);
        }
      }

      Alert.alert('Success', 'Rankings updated!');
      setIsEditMode(false);
      loadProfile();
    } catch (error) {
      console.error('Error updating rankings:', error);
      Alert.alert('Error', 'Failed to update rankings.');
    }
  };

  const deleteRound = async (roundId: string) => {
    Alert.alert(
      'Delete Round',
      'Are you sure you want to delete this round?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('rounds')
                .delete()
                .eq('id', roundId);

              loadProfile();
            } catch (error) {
              console.error('Error deleting round:', error);
              Alert.alert('Error', 'Failed to delete round.');
            }
          },
        },
      ]
    );
  };

  const removeBookmark = async (bookmarkId: string) => {
    try {
      await supabase
        .from('bookmarks')
        .delete()
        .eq('id', bookmarkId);

      setBookmarkedCourses(prev => prev.filter(b => b.id !== bookmarkId));
    } catch (error) {
      console.error('Error removing bookmark:', error);
      Alert.alert('Error', 'Failed to remove bookmark.');
    }
  };

  const totalCourses = new Set(rounds.map(r => r.course_id)).size;

  // Get top 3 unique courses (highest rating, most recent wins ties)
  const getTop3Courses = () => {
    const seen = new Set<string>();
    const top3: typeof rounds = [];

    for (const round of rounds) {
      if (!seen.has(round.course_id) && top3.length < 3) {
        seen.add(round.course_id);
        top3.push(round);
      }
    }
    return top3;
  };

  const top3Courses = getTop3Courses();

  const getMedalIcon = (position: number) => {
    switch (position) {
      case 0: return { icon: 'medal', color: '#FFD700' }; // Gold
      case 1: return { icon: 'medal', color: '#C0C0C0' }; // Silver
      case 2: return { icon: 'medal', color: '#CD7F32' }; // Bronze
      default: return { icon: 'medal', color: '#6b7280' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={pickProfileImage} style={styles.avatarContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {profile?.name?.[0] || '?'}
                </Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>{profile?.name || 'Anonymous'}</Text>
          {profile?.username && (
            <Text style={styles.username}>@{profile.username}</Text>
          )}
          {profile?.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}
          {profile?.handicap && (
            <Text style={styles.handicap}>Handicap: {profile.handicap}</Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.editProfileButton} onPress={handleEditProfile}>
              <Ionicons name="create-outline" size={20} color="#16a34a" />
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={handleShareProfile}>
              <Ionicons name="share-outline" size={20} color="#16a34a" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <TouchableOpacity style={styles.statBox} onPress={() => router.push('/followers?tab=followers')}>
            <Text style={styles.statNumber}>{followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statBox} onPress={() => router.push('/followers?tab=following')}>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{rounds.length}</Text>
            <Text style={styles.statLabel}>Rounds</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalCourses}</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </View>
        </View>

        {/* Top 3 Courses */}
        {top3Courses.length > 0 && (
          <View style={styles.top3Section}>
            <Text style={styles.sectionTitle}>Top Courses</Text>
            {top3Courses.map((round, index) => {
              const medal = getMedalIcon(index);
              return (
                <View key={round.id} style={styles.top3Card}>
                  <View style={styles.medalContainer}>
                    <Ionicons name={medal.icon as any} size={28} color={medal.color} />
                  </View>
                  <View style={styles.top3Info}>
                    <Text style={styles.top3CourseName}>{round.courses.name}</Text>
                    <Text style={styles.top3Location}>{round.courses.location}</Text>
                  </View>
                  <View style={styles.top3Rating}>
                    <Text style={styles.top3RatingText}>{round.rating.toFixed(1)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Home Course */}
        <View style={styles.homeCourseSection}>
          <Text style={styles.sectionTitle}>Home Course</Text>
          {profile?.home_course ? (
            <View style={styles.homeCourseCard}>
              <View style={styles.homeCourseInfo}>
                <Text style={styles.homeCourseName}>{profile.home_course.name}</Text>
                <Text style={styles.homeCourseLocation}>
                  <Ionicons name="location-outline" size={14} color="#6b7280" />
                  {' '}{profile.home_course.location}
                </Text>
              </View>
              <TouchableOpacity onPress={handleEditProfile}>
                <Ionicons name="create-outline" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addHomeCourseButton} onPress={handleEditProfile}>
              <Ionicons name="add-circle-outline" size={20} color="#16a34a" />
              <Text style={styles.addHomeCourseText}>Add Home Course</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bookmarked Courses Section */}
        <View style={styles.bookmarkedSection}>
          <View style={styles.bookmarkedHeader}>
            <Text style={styles.sectionTitle}>Bookmarked Courses</Text>
            {bookmarkedCourses.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/bookmarks')}>
                <Text style={styles.seeAllButton}>See All</Text>
              </TouchableOpacity>
            )}
          </View>
          {bookmarkedCourses.length === 0 ? (
            <View style={styles.emptyBookmarks}>
              <Ionicons name="bookmark-outline" size={32} color="#d1d5db" />
              <Text style={styles.emptyBookmarksText}>No bookmarked courses yet</Text>
              <Text style={styles.emptyBookmarksSubtext}>
                Tap the bookmark icon on a course to save it here
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bookmarkedScrollContent}
            >
              {bookmarkedCourses.slice(0, 3).map((bookmark) => {
                const course = Array.isArray(bookmark.course) ? bookmark.course[0] : bookmark.course;
                if (!course) return null;
                return (
                  <TouchableOpacity
                    key={bookmark.id}
                    style={styles.bookmarkedCourseCard}
                    onPress={() => router.push(`/course/${course.id}`)}
                  >
                    <View style={styles.bookmarkedCourseInfo}>
                      <Text style={styles.bookmarkedCourseName} numberOfLines={1}>{course.name}</Text>
                      <Text style={styles.bookmarkedCourseLocation} numberOfLines={1}>
                        <Ionicons name="location-outline" size={12} color="#6b7280" />
                        {' '}{course.location}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeBookmark(bookmark.id)}
                      style={styles.removeBookmarkButton}
                    >
                      <Ionicons name="bookmark" size={18} color="#16a34a" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Rounds Section */}
        <View style={styles.roundsSection}>
          <View style={styles.roundsHeader}>
            <Text style={styles.roundsTitle}>My Rankings</Text>
            {rounds.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  if (isEditMode) {
                    saveRankings();
                  } else {
                    setIsEditMode(true);
                  }
                }}
              >
                <Text style={styles.editButton}>
                  {isEditMode ? 'Save' : 'Edit'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {rounds.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="golf-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyStateText}>No rounds yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Tap the + button to add your first round
              </Text>
            </View>
          ) : (
            rounds.map((round, index) => (
              <View key={round.id} style={styles.roundCard}>
                <View style={styles.roundRank}>
                  <Text style={styles.roundRankNumber}>#{index + 1}</Text>
                </View>

                <View style={styles.roundInfo}>
                  <Text style={styles.roundCourseName}>{round.courses.name}</Text>
                  <Text style={styles.roundLocation}>{round.courses.location}</Text>
                </View>

                {!isEditMode ? (
                  <View style={styles.roundRating}>
                    <Ionicons name="golf" size={16} color="#16a34a" />
                    <Text style={styles.roundRatingText}>
                      {round.rating.toFixed(1)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.editControls}>
                    <View style={styles.sliderContainer}>
                      <Text style={styles.sliderValue}>
                        {editedRatings[round.id]?.toFixed(1) || round.rating.toFixed(1)}
                      </Text>
                      <Slider
                        style={styles.slider}
                        minimumValue={1}
                        maximumValue={10}
                        step={0.1}
                        value={editedRatings[round.id] || round.rating}
                        onValueChange={(value) => updateRating(round.id, value)}
                        minimumTrackTintColor="#16a34a"
                        maximumTrackTintColor="#e5e7eb"
                        thumbTintColor="#16a34a"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteRound(round.id)}
                      style={styles.deleteButton}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
    fontFamily: 'Inter',
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  username: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  bio: {
    fontSize: 15,
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 40,
    fontFamily: 'Inter',
  },
  handicap: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  editProfileButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsSection: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  top3Section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  top3Card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  medalContainer: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  top3Info: {
    flex: 1,
  },
  top3CourseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
    fontFamily: 'Inter',
  },
  top3Location: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  top3Rating: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  top3RatingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  homeCourseSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  homeCourseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  homeCourseInfo: {
    flex: 1,
  },
  homeCourseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  homeCourseLocation: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  addHomeCourseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  addHomeCourseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  bookmarkedSection: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  bookmarkedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  seeAllButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  bookmarkedScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyBookmarks: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  emptyBookmarksText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  emptyBookmarksSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  bookmarkedCourseCard: {
    width: 160,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bookmarkedCourseInfo: {
    marginBottom: 8,
  },
  bookmarkedCourseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  bookmarkedCourseLocation: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  removeBookmarkButton: {
    alignSelf: 'flex-end',
  },
  roundsSection: {
    padding: 20,
    paddingBottom: 100,
  },
  roundsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  roundsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  editButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
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
  roundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  roundRank: {
    width: 40,
    marginRight: 12,
  },
  roundRankNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  roundInfo: {
    flex: 1,
  },
  roundCourseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  roundLocation: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  roundRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roundRatingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  editControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderContainer: {
    alignItems: 'center',
    width: 120,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  slider: {
    width: 120,
    height: 40,
  },
  deleteButton: {
    padding: 8,
  },
});