import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type Review = {
  id: string;
  rating: number;
  score?: number;
  holes?: string;
  notes?: string;
  photos?: string[];
  date_played: string;
  created_at: string;
  user: {
    id: string;
    name: string;
    username?: string;
    avatar_url?: string;
  };
};

export default function CourseReviewsScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest'>('recent');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadReviews();
  }, [id, sortBy]);

  const loadReviews = async () => {
    try {
      let query = supabase
        .from('rounds')
        .select(`
          id,
          rating,
          score,
          holes,
          notes,
          photos,
          date_played,
          created_at,
          user:profiles(id, name, username, avatar_url)
        `)
        .eq('course_id', id);

      // Apply sorting
      if (sortBy === 'recent') {
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'highest') {
        query = query.order('rating', { ascending: false });
      } else {
        query = query.order('rating', { ascending: true });
      }

      const { data, error } = await query;

      if (error) throw error;

      // Parse photos for each review
      const parsed = (data || []).map(review => ({
        ...review,
        user: review.user as any,
        photos: review.photos
          ? typeof review.photos === 'string'
            ? JSON.parse(review.photos)
            : review.photos
          : [],
      }));

      setReviews(parsed);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderReview = ({ item }: { item: Review }) => (
    <View style={styles.reviewCard}>
      <TouchableOpacity
        style={styles.reviewHeader}
        onPress={() => router.push(`/user/${item.user.id}`)}
      >
        {item.user.avatar_url ? (
          <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {item.user.name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.user.name}</Text>
          <Text style={styles.reviewDate}>{formatDate(item.date_played)}</Text>
        </View>
        <View style={styles.ratingBadge}>
          <Ionicons name="golf" size={16} color="#16a34a" />
          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
        </View>
      </TouchableOpacity>

      {item.score && (
        <Text style={styles.scoreText}>
          Shot a {item.score} •{' '}
          {item.holes === 'front9'
            ? 'Front 9'
            : item.holes === 'back9'
            ? 'Back 9'
            : '18 holes'}
        </Text>
      )}

      {item.notes && <Text style={styles.notes}>{item.notes}</Text>}

      {item.photos && item.photos.length > 0 && (
        <View style={styles.photoRow}>
          {item.photos.slice(0, 4).map((photo, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.photoThumb}
              onPress={() => setSelectedPhoto(photo)}
            >
              <Image source={{ uri: photo }} style={styles.photoImage} />
              {idx === 3 && item.photos!.length > 4 && (
                <View style={styles.photoOverlay}>
                  <Text style={styles.photoOverlayText}>
                    +{item.photos!.length - 4}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.sortContainer}>
      <Text style={styles.reviewCount}>{reviews.length} reviews</Text>
      <View style={styles.sortButtons}>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'recent' && styles.sortButtonActive]}
          onPress={() => setSortBy('recent')}
        >
          <Text
            style={[
              styles.sortButtonText,
              sortBy === 'recent' && styles.sortButtonTextActive,
            ]}
          >
            Recent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'highest' && styles.sortButtonActive]}
          onPress={() => setSortBy('highest')}
        >
          <Text
            style={[
              styles.sortButtonText,
              sortBy === 'highest' && styles.sortButtonTextActive,
            ]}
          >
            Highest
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'lowest' && styles.sortButtonActive]}
          onPress={() => setSortBy('lowest')}
        >
          <Text
            style={[
              styles.sortButtonText,
              sortBy === 'lowest' && styles.sortButtonTextActive,
            ]}
          >
            Lowest
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Reviews</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={reviews}
        renderItem={renderReview}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No reviews yet</Text>
            <Text style={styles.emptySubtext}>
              Be the first to review this course
            </Text>
          </View>
        }
      />

      {/* Photo Viewer Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.photoViewerOverlay}>
          <TouchableOpacity
            style={styles.photoViewerClose}
            onPress={() => setSelectedPhoto(null)}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto }}
              style={styles.photoViewerImage}
              resizeMode="contain"
            />
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  reviewCount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  sortButtonActive: {
    backgroundColor: '#16a34a',
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  reviewCard: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
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
    fontFamily: 'Inter',
  },
  reviewDate: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  scoreText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  notes: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
    fontFamily: 'Inter',
  },
  photoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  photoThumb: {
    width: 70,
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOverlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  emptyState: {
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
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    padding: 8,
  },
  photoViewerImage: {
    width: '100%',
    height: '100%',
  },
});
