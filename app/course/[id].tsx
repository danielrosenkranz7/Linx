import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function CourseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [course, setCourse] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [relevantRounds, setRelevantRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [allPhotos, setAllPhotos] = useState<string[]>([]);

  useEffect(() => {
    loadCourseDetails();
  }, [id]);

const loadCourseDetails = async () => {
    console.log('Loading course with ID:', id);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Load course info
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single();

    setCourse(courseData);
      console.log('Course data:', courseData);

      // Check if bookmarked

      // Check if bookmarked
      const { data: bookmarkData } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', id)
        .single();

      setIsBookmarked(!!bookmarkData);

      // Load all rounds for this course with user info
      const { data: roundsData } = await supabase
        .from('rounds')
        .select(`
          *,
          user:profiles(id, name, username, avatar_url)
        `)
        .eq('course_id', id)
        .order('rating', { ascending: false });

    setRounds(roundsData || []);
      console.log('Rounds data:', roundsData);

      // Get users I follow

      // Get users I follow
      const { data: followingData } = await supabase
        .from('friendships')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = new Set(followingData?.map(f => f.following_id) || []);

      // Sort rounds by relevance
      const sorted = [...(roundsData || [])].sort((a, b) => {
        const aIsFollowing = followingIds.has(a.user_id);
        const bIsFollowing = followingIds.has(b.user_id);

        // Friends first
        if (aIsFollowing && !bIsFollowing) return -1;
        if (!aIsFollowing && bIsFollowing) return 1;

        // Then by likes (if we had them - for now by rating)
        if (a.likes_count !== b.likes_count) return b.likes_count - a.likes_count;

        // Then by recency
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // Determine how many to show (5-10)
      const friendReviews = sorted.filter(r => followingIds.has(r.user_id)).length;
      const showCount = Math.min(10, Math.max(5, 5 + friendReviews));
      setRelevantRounds(sorted.slice(0, showCount));

      // Collect all photos
      const photos = roundsData
        ?.filter(r => r.photos)
        .flatMap(r => {
          try {
            return typeof r.photos === 'string' ? JSON.parse(r.photos) : r.photos;
          } catch {
            return [];
          }
        })
        .filter(Boolean) || [];

      setAllPhotos(photos);

      // Calculate and update average rating
      if (roundsData && roundsData.length > 0) {
        const avgRating = roundsData.reduce((sum, r) => sum + r.rating, 0) / roundsData.length;
        
        await supabase
          .from('courses')
          .update({ 
            average_rating: avgRating,
            total_reviews: roundsData.length 
          })
          .eq('id', id);

        setCourse({ ...courseData, average_rating: avgRating, total_reviews: roundsData.length });
      }

    } catch (error) {
      console.error('Error loading course details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookmarkToggle = async () => {
    try {
      if (isBookmarked) {
        await supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', currentUserId)
          .eq('course_id', id);
        setIsBookmarked(false);
      } else {
        await supabase
          .from('bookmarks')
          .insert([{ user_id: currentUserId, course_id: id }]);
        setIsBookmarked(true);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const handleUserPress = (userId: string) => {
    router.push(`/user/${userId}`);
  };

  const handleSeeAllReviews = () => {
    router.push({
      pathname: '/course/reviews',
      params: { id, name: course?.name },
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${course?.name} on Linx! linx://course/${id}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Get 6 random photos for preview
  const previewPhotos = allPhotos.length > 0 
    ? allPhotos.sort(() => 0.5 - Math.random()).slice(0, 6)
    : [];

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
        <Text style={styles.headerTitle}>Course</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleShare} style={styles.headerActionButton}>
            <Ionicons name="share-outline" size={24} color="#16a34a" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleBookmarkToggle} style={styles.headerActionButton}>
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color="#16a34a"
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Course Info */}
        <View style={styles.courseHeader}>
          <Text style={styles.courseName}>{course?.name}</Text>
          <Text style={styles.courseLocation}>
            <Ionicons name="location" size={16} color="#6b7280" />
            {' '}{course?.location}
          </Text>

          {/* Average Rating */}
          {course?.average_rating && (
            <View style={styles.ratingContainer}>
              <Ionicons name="golf" size={32} color="#16a34a" />
              <Text style={styles.ratingNumber}>
                {course.average_rating.toFixed(1)}
              </Text>
              <Text style={styles.ratingCount}>
                ({course.total_reviews || rounds.length})
              </Text>
            </View>
          )}
        </View>

        {/* Photo Gallery */}
        {previewPhotos.length > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.photoGrid}>
              {previewPhotos.map((photo, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.photoThumbnail}
                  onPress={() => setSelectedPhoto(photo)}
                >
                  <Image source={{ uri: photo }} style={styles.photoImage} />
                </TouchableOpacity>
              ))}
            </View>
            {allPhotos.length > 6 && (
              <TouchableOpacity style={styles.seeMorePhotos}>
                <Text style={styles.seeMorePhotosText}>
                  See all {allPhotos.length} photos
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Reviews */}
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          
          {relevantRounds.map((round) => (
            <View key={round.id} style={styles.reviewCard}>
              <TouchableOpacity 
                style={styles.reviewHeader}
                onPress={() => handleUserPress(round.user.id)}
              >
                {round.user.avatar_url ? (
                  <Image source={{ uri: round.user.avatar_url }} style={styles.reviewAvatar} />
                ) : (
                  <View style={styles.reviewAvatarPlaceholder}>
                    <Text style={styles.reviewAvatarText}>
                      {round.user.name?.[0] || '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.reviewUserInfo}>
                  <Text style={styles.reviewUserName}>{round.user.name}</Text>
                  <Text style={styles.reviewDate}>{formatDate(round.date_played)}</Text>
                </View>
                <View style={styles.reviewRating}>
                  <Ionicons name="golf" size={16} color="#16a34a" />
                  <Text style={styles.reviewRatingText}>{round.rating.toFixed(1)}</Text>
                </View>
              </TouchableOpacity>

              {round.score && (
                <Text style={styles.reviewScore}>
                  Shot {[8, 11, 18].includes(round.score) || (round.score >= 80 && round.score <= 89) ? 'an' : 'a'} {round.score} • {round.holes === 'front9' ? 'Front 9' : round.holes === 'back9' ? 'Back 9' : '18 holes'}
                </Text>
              )}

              {round.notes && (
                <Text style={styles.reviewNotes}>{round.notes}</Text>
              )}

              {/* Review Photos */}
              {round.photos && (() => {
                try {
                  const photos = typeof round.photos === 'string' ? JSON.parse(round.photos) : round.photos;
                  if (photos && photos.length > 0) {
                    return (
                      <View style={styles.reviewPhotos}>
                        {photos.slice(0, 3).map((photo: string, idx: number) => (
                          <TouchableOpacity
                            key={idx}
                            style={styles.reviewPhotoThumbnail}
                            onPress={() => setSelectedPhoto(photo)}
                          >
                            <Image source={{ uri: photo }} style={styles.reviewPhotoImage} />
                          </TouchableOpacity>
                        ))}
                        {photos.length > 3 && (
                          <View style={styles.reviewPhotoOverlay}>
                            <Text style={styles.reviewPhotoOverlayText}>+{photos.length - 3}</Text>
                          </View>
                        )}
                      </View>
                    );
                  }
                } catch {
                  return null;
                }
                return null;
              })()}
            </View>
          ))}

          {rounds.length > relevantRounds.length && (
            <TouchableOpacity style={styles.seeAllButton} onPress={handleSeeAllReviews}>
              <Text style={styles.seeAllButtonText}>See all reviews</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerActionButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  courseHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  courseName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  courseLocation: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  ratingNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  ratingCount: {
    fontSize: 18,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  photoSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumbnail: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  seeMorePhotos: {
    marginTop: 12,
    alignItems: 'center',
  },
  seeMorePhotosText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  reviewsSection: {
    padding: 20,
    paddingBottom: 100,
  },
  reviewCard: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reviewAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
  },
  reviewUserInfo: {
    flex: 1,
  },
  reviewUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  reviewDate: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  reviewRatingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  reviewScore: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  reviewNotes: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
    fontFamily: 'Inter',
  },
  reviewPhotos: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  reviewPhotoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  reviewPhotoImage: {
    width: '100%',
    height: '100%',
  },
  reviewPhotoOverlay: {
    position: 'absolute',
    width: 80,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  reviewPhotoOverlayText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  seeAllButton: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
  },
  seeAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
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