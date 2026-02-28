import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';

export default function OnboardingFollow() {
  const router = useRouter();
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Get users with the most rounds (active users)
      const { data: activeUsers } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          username,
          avatar_url,
          handicap
        `)
        .neq('id', user.id)
        .not('name', 'is', null)
        .limit(10);

      // Sort by those with most activity (we'll just show top profiles for now)
      setSuggestedUsers(activeUsers || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    try {
      if (followingIds.has(userId)) {
        // Unfollow
        await supabase
          .from('friendships')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', userId);

        setFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      } else {
        // Follow
        await supabase
          .from('friendships')
          .insert([{ follower_id: currentUserId, following_id: userId }]);

        setFollowingIds(prev => new Set(prev).add(userId));
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Mark onboarding as completed
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      toast.success('Welcome to Linx!');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>Step 3 of 3</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="people" size={40} color="#16a34a" />
          </View>
          <Text style={styles.title}>Find golfers to follow</Text>
          <Text style={styles.subtitle}>
            Connect with the community and see their rounds in your feed
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#16a34a" />
              <Text style={styles.loadingText}>Finding golfers...</Text>
            </View>
          ) : suggestedUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No suggestions yet</Text>
              <Text style={styles.emptySubtext}>
                You can find golfers to follow later
              </Text>
            </View>
          ) : (
            <View style={styles.usersList}>
              {suggestedUsers.map((user) => {
                const isFollowing = followingIds.has(user.id);
                return (
                  <View key={user.id} style={styles.userCard}>
                    {user.avatar_url ? (
                      <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>
                          {user.name?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{user.name}</Text>
                      {user.username && (
                        <Text style={styles.userUsername}>@{user.username}</Text>
                      )}
                      {user.handicap && (
                        <Text style={styles.userHandicap}>
                          Handicap: {user.handicap}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.followButton,
                        isFollowing && styles.followingButton,
                      ]}
                      onPress={() => handleFollow(user.id)}
                    >
                      <Text
                        style={[
                          styles.followButtonText,
                          isFollowing && styles.followingButtonText,
                        ]}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {followingIds.size > 0 && (
          <Text style={styles.followingCount}>
            Following {followingIds.size} {followingIds.size === 1 ? 'golfer' : 'golfers'}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.completeButton, completing && styles.completeButtonDisabled]}
          onPress={handleComplete}
          disabled={completing}
        >
          <Text style={styles.completeButtonText}>
            {completing ? 'Getting ready...' : "Let's Go!"}
          </Text>
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    fontFamily: 'Inter',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    fontFamily: 'Inter',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  usersList: {
    gap: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  userUsername: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  userHandicap: {
    fontSize: 13,
    color: '#16a34a',
    fontFamily: 'Inter',
    marginTop: 4,
  },
  followButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#16a34a',
  },
  followingButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  followButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter',
  },
  followingButtonText: {
    color: '#16a34a',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  followingCount: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    padding: 18,
    borderRadius: 14,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter',
  },
});
