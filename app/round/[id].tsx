import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function RoundDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [round, setRound] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    loadRound();
  }, [id]);

  const loadRound = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('rounds')
        .select(`
          *,
          user:profiles!rounds_user_id_fkey(id, name, username, avatar_url),
          course:courses!rounds_course_id_fkey(id, name, location)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      setRound(data);

      // Check if liked
      if (user) {
        const { data: likeData } = await supabase
          .from('likes')
          .select('id')
          .eq('round_id', id)
          .eq('user_id', user.id)
          .single();

        setIsLiked(!!likeData);
      }

      // Get likes count
      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('round_id', id);

      setLikesCount(count || 0);
    } catch (error) {
      console.error('Error loading round:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!currentUserId) return;

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      if (wasLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('round_id', id)
          .eq('user_id', currentUserId);
      } else {
        await supabase.from('likes').insert({
          round_id: id,
          user_id: currentUserId,
        });
      }
    } catch (error) {
      setIsLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const handleShare = async () => {
    try {
      const userName = round?.user?.name || 'Someone';
      const courseName = round?.course?.name || 'a course';

      await Share.share({
        message: `Check out ${userName}'s round at ${courseName} on Linx! linx://round/${id}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Parse photos
  const photos: string[] = (() => {
    if (!round?.photos) return [];
    if (Array.isArray(round.photos)) return round.photos;
    if (typeof round.photos === 'string') {
      try {
        const parsed = JSON.parse(round.photos);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  })();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!round) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Round not found</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Round</Text>
        <TouchableOpacity onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#16a34a" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info */}
        <TouchableOpacity
          style={styles.userSection}
          onPress={() => router.push(`/user/${round.user.id}`)}
        >
          {round.user.avatar_url ? (
            <Image source={{ uri: round.user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{round.user.name?.[0] || '?'}</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{round.user.name}</Text>
            {round.user.username && (
              <Text style={styles.userUsername}>@{round.user.username}</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Course Info */}
        <TouchableOpacity
          style={styles.courseSection}
          onPress={() => router.push(`/course/${round.course.id}`)}
        >
          <View style={styles.courseIcon}>
            <Ionicons name="golf" size={24} color="#16a34a" />
          </View>
          <View style={styles.courseInfo}>
            <Text style={styles.courseName}>{round.course.name}</Text>
            <Text style={styles.courseLocation}>
              <Ionicons name="location-outline" size={14} color="#6b7280" />
              {' '}{round.course.location}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        {/* Rating */}
        <View style={styles.ratingSection}>
          <View style={styles.ratingBadge}>
            <Ionicons name="golf" size={32} color="#16a34a" />
            <Text style={styles.ratingNumber}>{round.rating.toFixed(1)}</Text>
            <Text style={styles.ratingOutOf}>/10</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(round.date_played)}</Text>
        </View>

        {/* Score */}
        {round.score && (
          <View style={styles.scoreSection}>
            <Text style={styles.scoreText}>
              Shot {[8, 11, 18].includes(round.score) || (round.score >= 80 && round.score <= 89) ? 'an' : 'a'}{' '}
              <Text style={styles.scoreNumber}>{round.score}</Text>
              {' '}on{' '}
              {round.holes === 'front9' ? 'the front 9' : round.holes === 'back9' ? 'the back 9' : '18 holes'}
            </Text>
          </View>
        )}

        {/* Notes */}
        {round.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesText}>{round.notes}</Text>
          </View>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photos.map((photo, index) => (
                <Image key={index} source={{ uri: photo }} style={styles.photo} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={24}
              color={isLiked ? '#16a34a' : '#6b7280'}
            />
            <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
              {likesCount} {likesCount === 1 ? 'like' : 'likes'}
            </Text>
          </TouchableOpacity>
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
  errorText: {
    fontSize: 18,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  backLink: {
    marginTop: 16,
  },
  backLinkText: {
    fontSize: 16,
    color: '#16a34a',
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
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  userUsername: {
    fontSize: 15,
    color: '#6b7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  courseSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  courseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  courseLocation: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  ratingSection: {
    alignItems: 'center',
    padding: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  ratingNumber: {
    fontSize: 64,
    fontWeight: '700',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  ratingOutOf: {
    fontSize: 24,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  dateText: {
    fontSize: 15,
    color: '#6b7280',
    fontFamily: 'Inter',
    marginTop: 8,
  },
  scoreSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  scoreText: {
    fontSize: 17,
    color: '#1a1a1a',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  scoreNumber: {
    fontWeight: '700',
    color: '#16a34a',
  },
  notesSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  notesText: {
    fontSize: 16,
    color: '#1a1a1a',
    lineHeight: 24,
    fontFamily: 'Inter',
  },
  photosSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginRight: 12,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 100,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  actionText: {
    fontSize: 16,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  actionTextActive: {
    color: '#16a34a',
  },
});
