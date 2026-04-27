import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FeedCard from '../components/FeedCard';
import { handleError } from '../lib/errors';
import { supabase } from '../lib/supabase';

export default function TaggedScreen() {
  const router = useRouter();
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    loadTaggedRounds();
  }, []);

  const loadTaggedRounds = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Get all rounds that might have partners
      const { data: roundsData, error } = await supabase
        .from('rounds')
        .select(`
          *,
          user:profiles!rounds_user_id_fkey(
            id,
            name,
            username,
            avatar_url
          ),
          course:courses(
            id,
            name,
            location
          )
        `)
        .not('partners', 'is', null)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter rounds where current user is tagged as a partner
      const taggedRounds = (roundsData || []).filter(round => {
        if (!round.partners) return false;

        try {
          const partners = typeof round.partners === 'string'
            ? JSON.parse(round.partners)
            : round.partners;

          // Check if current user's ID is in the partners list
          return Array.isArray(partners) && partners.some(
            (p: any) => p.user_id === user.id
          );
        } catch {
          return false;
        }
      });

      // Get likes count and user's like status for each round
      const roundsWithLikes = await Promise.all(
        taggedRounds.map(async (round) => {
          const { count: likesCount } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('round_id', round.id);

          const { data: userLike } = await supabase
            .from('likes')
            .select('id')
            .eq('round_id', round.id)
            .eq('user_id', user.id)
            .single();

          return {
            ...round,
            likes_count: likesCount || 0,
            user_has_liked: !!userLike,
          };
        })
      );

      setRounds(roundsWithLikes);
    } catch (error) {
      handleError(error, 'Loading tagged rounds');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTaggedRounds();
  }, []);

  const handleLike = async (roundId: string) => {
    const round = rounds.find(r => r.id === roundId);
    if (!round) return;

    const wasLiked = round.user_has_liked;

    // Optimistic update
    setRounds(prev =>
      prev.map(r =>
        r.id === roundId
          ? {
              ...r,
              user_has_liked: !wasLiked,
              likes_count: wasLiked ? r.likes_count - 1 : r.likes_count + 1,
            }
          : r
      )
    );

    try {
      if (wasLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('round_id', roundId)
          .eq('user_id', currentUserId);
      } else {
        await supabase
          .from('likes')
          .insert([{ round_id: roundId, user_id: currentUserId }]);
      }
    } catch (error) {
      // Revert on error
      setRounds(prev =>
        prev.map(r =>
          r.id === roundId
            ? {
                ...r,
                user_has_liked: wasLiked,
                likes_count: wasLiked ? r.likes_count + 1 : r.likes_count - 1,
              }
            : r
        )
      );
      handleError(error, 'Updating like');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tagged In</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#16a34a"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {rounds.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No tagged rounds yet</Text>
            <Text style={styles.emptySubtext}>
              When friends tag you in their rounds, they'll appear here
            </Text>
          </View>
        ) : (
          rounds.map((round) => (
            <FeedCard
              key={round.id}
              round={round}
              onLike={() => handleLike(round.id)}
              currentUserId={currentUserId}
            />
          ))
        )}
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    fontFamily: 'Inter',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Inter',
    lineHeight: 20,
  },
});
