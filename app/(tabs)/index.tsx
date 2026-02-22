import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import FeedCard from '../../components/FeedCard';
import { handleError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

const PAGE_SIZE = 10;

export default function HomeScreen() {
  const [selectedTab, setSelectedTab] = useState<'teesheet' | 'trending'>('teesheet');
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    setRounds([]);
    setHasMore(true);
    setLoading(true);
    loadRounds(selectedTab, 0, true);
  }, [selectedTab]);

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
          <Text style={styles.logo}>Linx</Text>
          <Text style={styles.slogan}>Your Golf Community</Text>
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
        <Text style={styles.logo}>Linx</Text>
        <Text style={styles.slogan}>Your Golf Community</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  slogan: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  toggleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
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
});
