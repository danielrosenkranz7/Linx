import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import FeedCard from '../../components/FeedCard';
import LinxWordmark from '../../components/LinxWordmark';
import { handleError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

const PAGE_SIZE = 10;

export default function HomeScreen() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<'teesheet' | 'trending'>('teesheet');
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');

  // Search modal state
  const [showSearch, setShowSearch] = useState(false);
  const [searchMode, setSearchMode] = useState<'users' | 'courses'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRounds([]);
    setHasMore(true);
    setLoading(true);
    loadRounds(selectedTab, 0, true);
  }, [selectedTab]);

  // Search when query changes
  useEffect(() => {
    if (searchQuery.length >= 2) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchMode]);

  // Load following IDs when search modal opens
  useEffect(() => {
    if (showSearch && currentUserId) {
      loadFollowingIds();
    }
  }, [showSearch, currentUserId]);

  const loadFollowingIds = async () => {
    const { data } = await supabase
      .from('friendships')
      .select('following_id')
      .eq('follower_id', currentUserId);
    if (data) {
      setFollowingIds(new Set(data.map(f => f.following_id)));
    }
  };

  const performSearch = async () => {
    setIsSearching(true);
    try {
      if (searchMode === 'users') {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', currentUserId)
          .or(`name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
          .limit(20);
        setSearchResults(data || []);
      } else {
        const { data } = await supabase
          .from('courses')
          .select('*')
          .or(`name.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`)
          .limit(20);
        setSearchResults(data || []);
      }
    } catch (error) {
      handleError(error, 'Search');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFollowToggle = async (userId: string) => {
    const isFollowing = followingIds.has(userId);
    try {
      if (isFollowing) {
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
        await supabase
          .from('friendships')
          .insert([{ follower_id: currentUserId, following_id: userId }]);
        setFollowingIds(prev => new Set(prev).add(userId));
      }
    } catch (error) {
      handleError(error, 'Follow');
    }
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleUserPress = (userId: string) => {
    closeSearch();
    router.push(`/user/${userId}`);
  };

  const handleCoursePress = (courseId: string) => {
    closeSearch();
    router.push(`/course/${courseId}`);
  };

  const loadRounds = async (tab: 'teesheet' | 'trending', offset: number = 0, isInitial: boolean = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      let roundsData: any[] = [];

      if (tab === 'teesheet') {
        // Your Tee Sheet: rounds from followed users + own rounds
        const { data: followingData } = await supabase
          .from('friendships')
          .select('following_id')
          .eq('follower_id', user.id);

        const followingIds = followingData?.map(f => f.following_id) || [];
        const allUserIds = [user.id, ...followingIds];

        const { data } = await supabase
          .from('rounds')
          .select(`
            *,
            user:profiles!rounds_user_id_fkey(id, name, username, handicap, avatar_url),
            course:courses!rounds_course_id_fkey(id, name, location, latitude, longitude)
          `)
          .in('user_id', allUserIds)
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        roundsData = data || [];
      } else {
        // Trending Nearby: all rounds, sorted by likes_count desc
        const { data } = await supabase
          .from('rounds')
          .select(`
            *,
            user:profiles!rounds_user_id_fkey(id, name, username, handicap, avatar_url),
            course:courses!rounds_course_id_fkey(id, name, location, latitude, longitude)
          `)
          .order('likes_count', { ascending: false })
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        roundsData = data || [];
      }

      // Check if we have more data
      if (roundsData.length < PAGE_SIZE) {
        setHasMore(false);
      }

      if (roundsData.length === 0) {
        if (isInitial) {
          setRounds([]);
        }
        return;
      }

      // Get the round IDs to fetch likes/comments data
      const roundIds = roundsData.map(r => r.id);
      const courseIds = [...new Set(roundsData.map(r => r.course_id).filter(Boolean))];

      // Fetch user's likes, bookmarks, and counts in parallel
      const [userLikesResult, likesCountsResult, commentsCountsResult, userBookmarksResult] = await Promise.all([
        supabase
          .from('likes')
          .select('round_id')
          .eq('user_id', user.id)
          .in('round_id', roundIds),
        supabase
          .from('likes')
          .select('round_id')
          .in('round_id', roundIds),
        supabase
          .from('comments')
          .select('round_id')
          .in('round_id', roundIds),
        courseIds.length > 0
          ? supabase
              .from('bookmarks')
              .select('course_id')
              .eq('user_id', user.id)
              .in('course_id', courseIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Create sets/maps for efficient lookup
      const likedRoundIds = new Set(userLikesResult.data?.map(l => l.round_id) || []);
      const bookmarkedCourseIds = new Set(userBookmarksResult.data?.map(b => b.course_id) || []);

      // Count likes per round
      const likesCountMap: Record<string, number> = {};
      (likesCountsResult.data || []).forEach(l => {
        likesCountMap[l.round_id] = (likesCountMap[l.round_id] || 0) + 1;
      });

      // Count comments per round
      const commentsCountMap: Record<string, number> = {};
      (commentsCountsResult.data || []).forEach(c => {
        commentsCountMap[c.round_id] = (commentsCountMap[c.round_id] || 0) + 1;
      });

      // Combine everything
      const roundsWithData = roundsData.map(round => ({
        ...round,
        likes_count: likesCountMap[round.id] || 0,
        comments_count: commentsCountMap[round.id] || 0,
        is_liked: likedRoundIds.has(round.id),
        is_bookmarked: bookmarkedCourseIds.has(round.course_id),
      }));

      if (isInitial) {
        setRounds(roundsWithData);
      } else {
        setRounds(prev => [...prev, ...roundsWithData]);
      }
    } catch (error) {
      handleError(error, 'Loading feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    loadRounds(selectedTab, 0, true);
  }, [selectedTab]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadRounds(selectedTab, rounds.length, false);
  }, [loadingMore, hasMore, selectedTab, rounds.length]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <FeedCard
      round={item}
      currentUserId={currentUserId}
      isLiked={item.is_liked}
      isBookmarked={item.is_bookmarked}
      onUpdate={() => loadRounds(selectedTab, 0, true)}
    />
  ), [currentUserId, selectedTab]);

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: 100 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#16a34a" />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>No rounds yet</Text>
      <Text style={styles.emptyStateSubtext}>
        {selectedTab === 'teesheet'
          ? 'Follow friends or add your first round!'
          : 'Be the first to post a round!'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <LinxWordmark width={100} height={42} />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setShowSearch(true)}
            accessibilityLabel="Search users and courses"
            accessibilityRole="button"
          >
            <Ionicons name="search" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <LinxWordmark width={100} height={42} />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => setShowSearch(true)}
          accessibilityLabel="Search users and courses"
          accessibilityRole="button"
        >
          <Ionicons name="search" size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Toggle */}
      <View style={styles.toggleContainer}>
        <View style={styles.toggle}>
          <Text
            style={[styles.toggleOption, selectedTab === 'teesheet' && styles.toggleOptionActive]}
            onPress={() => setSelectedTab('teesheet')}
          >
            Your Tee Sheet
          </Text>
          <Text
            style={[styles.toggleOption, selectedTab === 'trending' && styles.toggleOptionActive]}
            onPress={() => setSelectedTab('trending')}
          >
            Trending Nearby
          </Text>
        </View>
      </View>

      {/* Feed */}
      <FlatList
        data={rounds}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={styles.feed}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
      />

      {/* Search Modal */}
      <Modal
        visible={showSearch}
        animationType="slide"
        transparent
        onRequestClose={closeSearch}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search</Text>
              <TouchableOpacity onPress={closeSearch} style={styles.modalClose}>
                <Ionicons name="close" size={28} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            {/* Segmented Control */}
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[styles.segment, searchMode === 'users' && styles.segmentActive]}
                onPress={() => {
                  setSearchMode('users');
                  setSearchResults([]);
                }}
              >
                <Ionicons
                  name="people"
                  size={18}
                  color={searchMode === 'users' ? '#fff' : '#6b7280'}
                />
                <Text style={[styles.segmentText, searchMode === 'users' && styles.segmentTextActive]}>
                  Users
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, searchMode === 'courses' && styles.segmentActive]}
                onPress={() => {
                  setSearchMode('courses');
                  setSearchResults([]);
                }}
              >
                <Ionicons
                  name="golf"
                  size={18}
                  color={searchMode === 'courses' ? '#fff' : '#6b7280'}
                />
                <Text style={[styles.segmentText, searchMode === 'courses' && styles.segmentTextActive]}>
                  Courses
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={searchMode === 'users' ? 'Search for golfers...' : 'Search for courses...'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                placeholderTextColor="#9ca3af"
              />
              {isSearching && <ActivityIndicator size="small" color="#16a34a" />}
            </View>

            {/* Search Results */}
            <ScrollView style={styles.searchResults} showsVerticalScrollIndicator={false}>
              {searchQuery === '' && (
                <View style={styles.searchEmptyState}>
                  <Ionicons
                    name={searchMode === 'users' ? 'people-outline' : 'golf-outline'}
                    size={48}
                    color="#d1d5db"
                  />
                  <Text style={styles.searchEmptyText}>
                    {searchMode === 'users' ? 'Search for golfers' : 'Search for courses'}
                  </Text>
                  <Text style={styles.searchEmptySubtext}>
                    {searchMode === 'users' ? 'Find friends by name or username' : 'Find courses by name or location'}
                  </Text>
                </View>
              )}

              {searchQuery !== '' && searchResults.length === 0 && !isSearching && (
                <View style={styles.searchEmptyState}>
                  <Ionicons name="search-outline" size={48} color="#d1d5db" />
                  <Text style={styles.searchEmptyText}>No results found</Text>
                  <Text style={styles.searchEmptySubtext}>Try a different search term</Text>
                </View>
              )}

              {/* User Results */}
              {searchMode === 'users' && searchResults.map((user) => {
                const isFollowing = followingIds.has(user.id);
                return (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.resultCard}
                    onPress={() => handleUserPress(user.id)}
                    activeOpacity={0.7}
                  >
                    {user.avatar_url ? (
                      <Image source={{ uri: user.avatar_url }} style={styles.resultAvatar} />
                    ) : (
                      <View style={styles.resultAvatarPlaceholder}>
                        <Text style={styles.resultAvatarText}>{user.name?.[0] || '?'}</Text>
                      </View>
                    )}
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultTitle}>{user.name || 'Anonymous'}</Text>
                      {user.username && (
                        <Text style={styles.resultSubtitle}>@{user.username}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.followButton, isFollowing && styles.followingButton]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleFollowToggle(user.id);
                      }}
                    >
                      <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}

              {/* Course Results */}
              {searchMode === 'courses' && searchResults.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={styles.resultCard}
                  onPress={() => handleCoursePress(course.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.courseIconContainer}>
                    <Ionicons name="golf" size={24} color="#16a34a" />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultTitle}>{course.name}</Text>
                    <Text style={styles.resultSubtitle}>
                      <Ionicons name="location-outline" size={12} color="#6b7280" />
                      {' '}{course.location}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  toggleOptionActive: {
    backgroundColor: '#fff',
    borderRadius: 6,
    color: '#1a1a1a',
  },
  feed: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  // Search Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    position: 'relative',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  modalClose: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: '#16a34a',
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  segmentTextActive: {
    color: '#fff',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
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
  searchResults: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchEmptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  searchEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
    fontFamily: 'Inter',
  },
  searchEmptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  resultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  resultAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
  },
  courseIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
    fontFamily: 'Inter',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  followButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
});
