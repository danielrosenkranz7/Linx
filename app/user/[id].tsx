import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    loadUserProfile();
  }, [id]);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Load user's profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select(`
          *,
          home_course:courses(name, location)
        `)
        .eq('id', id)
        .single();

      setProfile(profileData);

      // Load user's rounds
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
        .eq('user_id', id)
        .order('rating', { ascending: false });

      setRounds(roundsData || []);

      // Load follower count (people who follow this user)
      const { count: followerCount } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', id);

      setFollowersCount(followerCount || 0);

      // Load following count (people this user follows)
      const { count: followingCountResult } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', id);

      setFollowingCount(followingCountResult || 0);

      // Check if current user is following this user
      const { data: followData } = await supabase
        .from('friendships')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', id)
        .single();

      setIsFollowing(!!followData);

    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    try {
      if (isFollowing) {
        // Unfollow
        await supabase
          .from('friendships')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', id);

        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        // Follow
        await supabase
          .from('friendships')
          .insert([
            {
              follower_id: currentUserId,
              following_id: id,
            },
          ]);

        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status.');
    }
  };

  const totalCourses = new Set(rounds.map(r => r.course_id)).size;

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
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {profile?.name?.[0] || '?'}
              </Text>
            </View>
          )}

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

          {/* Follow Button */}
          <TouchableOpacity 
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={handleFollowToggle}
          >
            <Ionicons 
              name={isFollowing ? "checkmark" : "person-add"} 
              size={20} 
              color={isFollowing ? "#16a34a" : "#fff"} 
            />
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{rounds.length}</Text>
            <Text style={styles.statLabel}>Rounds</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalCourses}</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </View>
        </View>

        {/* Home Course */}
        {profile?.home_course && (
          <View style={styles.homeCourseSection}>
            <Text style={styles.sectionTitle}>Home Course</Text>
            <View style={styles.homeCourseCard}>
              <View style={styles.homeCourseInfo}>
                <Text style={styles.homeCourseName}>{profile.home_course.name}</Text>
                <Text style={styles.homeCourseLocation}>
                  <Ionicons name="location-outline" size={14} color="#6b7280" />
                  {' '}{profile.home_course.location}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Rounds Section */}
        <View style={styles.roundsSection}>
          <Text style={styles.roundsTitle}>Rankings</Text>

          {rounds.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="golf-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyStateText}>No rounds yet</Text>
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

                <View style={styles.roundRating}>
                  <Ionicons name="golf" size={16} color="#16a34a" />
                  <Text style={styles.roundRatingText}>
                    {round.rating.toFixed(1)}
                  </Text>
                </View>
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
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarPlaceholderText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
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
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#16a34a',
  },
  followingButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter',
  },
  followingButtonText: {
    color: '#16a34a',
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
  roundsSection: {
    padding: 20,
    paddingBottom: 100,
  },
  roundsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
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
});