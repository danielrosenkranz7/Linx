import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function FollowersScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [selectedTab, setSelectedTab] = useState<'followers' | 'following'>(
    tab === 'following' ? 'following' : 'followers'
  );
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tab === 'followers' || tab === 'following') {
      setSelectedTab(tab);
    }
  }, [tab]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Load followers (people who follow me)
      const { data: followersData } = await supabase
        .from('friendships')
        .select(`
          id,
          created_at,
          follower:profiles!friendships_follower_id_fkey(
            id,
            name,
            username,
            avatar_url,
            handicap
          )
        `)
        .eq('following_id', user.id)
        .order('created_at', { ascending: false });

      setFollowers(followersData || []);

      // Load following (people I follow)
      const { data: followingData } = await supabase
        .from('friendships')
        .select(`
          id,
          created_at,
          following:profiles!friendships_following_id_fkey(
            id,
            name,
            username,
            avatar_url,
            handicap
          )
        `)
        .eq('follower_id', user.id)
        .order('created_at', { ascending: false });

      setFollowing(followingData || []);
    } catch (error) {
      console.error('Error loading followers/following:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (friendshipId: string) => {
    try {
      await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      setFollowing(prev => prev.filter(f => f.id !== friendshipId));
    } catch (error) {
      console.error('Error unfollowing:', error);
    }
  };

  const handleRemoveFollower = async (friendshipId: string) => {
    try {
      await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      setFollowers(prev => prev.filter(f => f.id !== friendshipId));
    } catch (error) {
      console.error('Error removing follower:', error);
    }
  };

  const renderUser = (item: any, isFollowing: boolean) => {
    const user = isFollowing ? item.following : item.follower;
    if (!user) return null;

    return (
      <View key={item.id} style={styles.userCard}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => router.push(`/user/${user.id}`)}
        >
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{user.name?.[0] || '?'}</Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user.name}</Text>
            {user.username && (
              <Text style={styles.userUsername}>@{user.username}</Text>
            )}
            {user.handicap && (
              <Text style={styles.userHandicap}>Handicap: {user.handicap}</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => isFollowing ? handleUnfollow(item.id) : handleRemoveFollower(item.id)}
        >
          <Text style={styles.actionButtonText}>
            {isFollowing ? 'Unfollow' : 'Remove'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const currentList = selectedTab === 'followers' ? followers : following;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {selectedTab === 'followers' ? 'Followers' : 'Following'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'followers' && styles.tabActive]}
          onPress={() => setSelectedTab('followers')}
        >
          <Text style={[styles.tabText, selectedTab === 'followers' && styles.tabTextActive]}>
            Followers ({followers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'following' && styles.tabActive]}
          onPress={() => setSelectedTab('following')}
        >
          <Text style={[styles.tabText, selectedTab === 'following' && styles.tabTextActive]}>
            Following ({following.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {currentList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={selectedTab === 'followers' ? 'people-outline' : 'person-add-outline'}
              size={64}
              color="#d1d5db"
            />
            <Text style={styles.emptyStateText}>
              {selectedTab === 'followers' ? 'No followers yet' : 'Not following anyone'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {selectedTab === 'followers'
                ? 'Share your profile to get followers'
                : 'Find golfers to follow'}
            </Text>
          </View>
        ) : (
          currentList.map(item => renderUser(item, selectedTab === 'following'))
        )}
        <View style={{ height: 40 }} />
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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#16a34a',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  tabTextActive: {
    color: '#16a34a',
  },
  content: {
    flex: 1,
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  userUsername: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  userHandicap: {
    fontSize: 13,
    color: '#16a34a',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
});
