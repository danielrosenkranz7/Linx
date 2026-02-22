import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AddFriendScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchUsers(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      loadFollowing(user.id);
    }
  };

  const loadFollowing = async (userId: string) => {
    const { data } = await supabase
      .from('friendships')
      .select('following_id')
      .eq('follower_id', userId);

    if (data) {
      setFollowingIds(new Set(data.map(f => f.following_id)));
    }
  };

  const searchUsers = async (query: string) => {
    setIsSearching(true);

    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUserId) // Exclude current user
        .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(20);

      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFollowToggle = async (userId: string) => {
    const isFollowing = followingIds.has(userId);

    try {
      if (isFollowing) {
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
          .insert([
            {
              follower_id: currentUserId,
              following_id: userId,
            },
          ]);

        setFollowingIds(prev => new Set(prev).add(userId));
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const handleUserPress = (userId: string) => {
    router.push(`/user/${userId}`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="close" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Friends</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for golfers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
        />
        {isSearching && (
          <ActivityIndicator size="small" color="#16a34a" />
        )}
      </View>

      {/* Results */}
      <ScrollView style={styles.content}>
        {searchQuery === '' && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyStateText}>Search for golfers to follow</Text>
            <Text style={styles.emptyStateSubtext}>
              Find friends by name or username
            </Text>
          </View>
        )}

        {searchQuery !== '' && searchResults.length === 0 && !isSearching && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyStateText}>No users found</Text>
            <Text style={styles.emptyStateSubtext}>
              Try a different search term
            </Text>
          </View>
        )}

        {searchResults.map((user) => {
          const isFollowing = followingIds.has(user.id);
          
          return (
            <TouchableOpacity
              key={user.id}
              style={styles.userCard}
              onPress={() => handleUserPress(user.id)}
              activeOpacity={0.7}
            >
              {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>
                    {user.name?.[0] || '?'}
                  </Text>
                </View>
              )}

              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name || 'Anonymous'}</Text>
                {user.username && (
                  <Text style={styles.userUsername}>@{user.username}</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followingButton]}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent card press
                  handleFollowToggle(user.id);
                }}
              >
                <Ionicons 
                  name={isFollowing ? "checkmark" : "person-add"} 
                  size={18} 
                  color={isFollowing ? "#16a34a" : "#fff"} 
                />
                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
  avatarPlaceholderText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
    fontFamily: 'Inter',
  },
  userUsername: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
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
});