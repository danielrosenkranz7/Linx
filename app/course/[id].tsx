import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getRatingColor } from '../../lib/colors';
import { supabase } from '../../lib/supabase';

export default function CourseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [course, setCourse] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [relevantRounds, setRelevantRounds] = useState<any[]>([]);
  const [userRounds, setUserRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [allPhotos, setAllPhotos] = useState<string[]>([]);
  const [courseExperts, setCourseExperts] = useState<Array<{
    user: { id: string; name: string; username: string; avatar_url?: string };
    roundCount: number;
  }>>([]);

  useEffect(() => {
    loadCourseDetails();
  }, [id]);

const loadCourseDetails = async () => {
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

      // Find all current user's rounds for this course (sorted by date, most recent first)
      const myRounds = (roundsData || [])
        .filter(r => r.user_id === user.id)
        .sort((a, b) => new Date(b.date_played).getTime() - new Date(a.date_played).getTime());
      setUserRounds(myRounds);

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

      // Calculate course experts (most rounds this year)
      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;

      const { data: expertsData } = await supabase
        .from('rounds')
        .select(`
          user_id,
          user:profiles(id, name, username, avatar_url)
        `)
        .eq('course_id', id)
        .gte('date_played', yearStart);

      if (expertsData && expertsData.length > 0) {
        // Count rounds per user
        const userCounts = new Map<string, { user: any; count: number }>();

        for (const round of expertsData) {
          const existing = userCounts.get(round.user_id);
          if (existing) {
            existing.count++;
          } else {
            userCounts.set(round.user_id, { user: round.user, count: 1 });
          }
        }

        // Sort by count and take top 5
        const sortedExperts = Array.from(userCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map(e => ({ user: e.user, roundCount: e.count }));

        setCourseExperts(sortedExperts);
      }

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

    } catch {
      // Error loading course details
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
    } catch {
      // Bookmark toggle failed silently
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

  const handleEditRound = (round: any) => {
    if (!round || !course) return;

    // Parse photos
    let photos: string[] = [];
    if (round.photos) {
      try {
        photos = typeof round.photos === 'string' ? JSON.parse(round.photos) : round.photos;
      } catch {
        photos = [];
      }
    }

    // Navigate to edit round flow starting with date selection
    router.push({
      pathname: '/edit-round/date-selection',
      params: {
        roundId: round.id,
        courseId: course.id,
        courseName: course.name,
        courseLocation: course.location,
        score: round.score?.toString() || '',
        holes: round.holes || '18',
        notes: round.notes || '',
        rating: round.rating?.toString() || '7.5',
        photos: JSON.stringify(photos),
        partners: round.partners || '',
        datePlayed: round.date_played || '',
      },
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
    } catch {
      // Share cancelled or failed
    }
  };

  const handleAddRound = () => {
    if (!course) return;

    // Skip course search and go directly to date selection
    router.push({
      pathname: '/add-round/date-selection',
      params: {
        courseId: course.id,
        courseName: course.name,
        courseLocation: course.location,
      },
    });
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
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleAddRound} style={styles.addRoundButton}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
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

        {/* Your Rating */}
        {userRounds.length > 0 && (
          <View style={styles.yourRatingSection}>
            <Text style={styles.yourRatingSectionTitle}>Your Rating</Text>
            <View style={styles.yourRatingContent}>
              {/* Fixed Rating Box */}
              <View style={[
                styles.yourRatingBox,
                {
                  backgroundColor: getRatingColor(userRounds[0].rating).background,
                  borderColor: getRatingColor(userRounds[0].rating).border,
                }
              ]}>
                <Ionicons name="golf" size={20} color="#4b5563" />
                <Text style={styles.yourRatingNumber}>{userRounds[0].rating.toFixed(1)}</Text>
              </View>

              {/* Horizontal Scroll of Rounds */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.roundsScrollContent}
              >
                {userRounds.map((round) => {
                  // Parse partners
                  let partners: any[] = [];
                  if (round.partners) {
                    try {
                      partners = typeof round.partners === 'string' ? JSON.parse(round.partners) : round.partners;
                    } catch {}
                  }

                  // Parse photos
                  let photos: string[] = [];
                  if (round.photos) {
                    try {
                      photos = typeof round.photos === 'string' ? JSON.parse(round.photos) : round.photos;
                    } catch {}
                  }

                  return (
                    <TouchableOpacity
                      key={round.id}
                      style={styles.yourRoundCard}
                      onPress={() => handleEditRound(round)}
                    >
                      <Text style={styles.yourRoundDate}>{formatDate(round.date_played)}</Text>

                      {round.score && (
                        <Text style={styles.yourRoundScore}>Shot {round.score}</Text>
                      )}

                      {/* Partners preview */}
                      {partners.length > 0 && (
                        <View style={styles.yourRoundPartners}>
                          {partners.slice(0, 3).map((partner, idx) => (
                            <View key={idx} style={styles.yourRoundPartnerBubble}>
                              <Text style={styles.yourRoundPartnerText}>
                                {partner.name?.[0]?.toUpperCase() || '?'}
                              </Text>
                            </View>
                          ))}
                          {partners.length > 3 && (
                            <Text style={styles.yourRoundMorePartners}>+{partners.length - 3}</Text>
                          )}
                        </View>
                      )}

                      {/* Photo preview */}
                      {photos.length > 0 && (
                        <View style={styles.yourRoundPhotos}>
                          <Ionicons name="image" size={12} color="#6b7280" />
                          <Text style={styles.yourRoundPhotoCount}>{photos.length}</Text>
                        </View>
                      )}

                      <Ionicons name="chevron-forward" size={14} color="#9ca3af" style={styles.yourRoundChevron} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Course Experts */}
        {courseExperts.length > 0 && (
          <View style={styles.expertsSection}>
            <View style={styles.expertsTitleRow}>
              <Ionicons name="trophy" size={14} color="#f59e0b" />
              <Text style={styles.expertsTitle}>Course Experts ({new Date().getFullYear()})</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.expertsScrollContent}
            >
              {courseExperts.map((expert, index) => (
                <TouchableOpacity
                  key={expert.user.id}
                  style={styles.expertItem}
                  onPress={() => handleUserPress(expert.user.id)}
                >
                  {index === 0 && (
                    <View style={styles.expertTrophyBadge}>
                      <Ionicons name="trophy" size={10} color="#f59e0b" />
                    </View>
                  )}
                  {expert.user.avatar_url ? (
                    <Image source={{ uri: expert.user.avatar_url }} style={styles.expertAvatar} />
                  ) : (
                    <View style={styles.expertAvatarPlaceholder}>
                      <Text style={styles.expertAvatarText}>
                        {expert.user.name?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.expertName} numberOfLines={1}>{expert.user.name?.split(' ')[0]}</Text>
                  <Text style={styles.expertRounds}>{expert.roundCount}x</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
                <View style={[
                  styles.reviewRating,
                  {
                    backgroundColor: getRatingColor(round.rating).background,
                    borderColor: getRatingColor(round.rating).border,
                  }
                ]}>
                  <Ionicons name="golf" size={16} color="#4b5563" />
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerActionButton: {
    padding: 4,
  },
  addRoundButton: {
    backgroundColor: '#16a34a',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  expertsSection: {
    paddingVertical: 12,
    paddingLeft: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  expertsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  expertsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
    fontFamily: 'Inter',
  },
  expertsScrollContent: {
    paddingRight: 20,
    gap: 12,
  },
  expertItem: {
    alignItems: 'center',
    position: 'relative',
  },
  expertTrophyBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    zIndex: 1,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 2,
  },
  expertAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 4,
  },
  expertAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  expertAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter',
  },
  expertName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Inter',
    maxWidth: 50,
    textAlign: 'center',
  },
  expertRounds: {
    fontSize: 10,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  photoSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  yourRatingSection: {
    paddingVertical: 12,
    paddingLeft: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f0fdf4',
  },
  yourRatingSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  yourRatingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yourRatingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 12,
  },
  yourRatingNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4b5563',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  roundsScrollContent: {
    paddingRight: 20,
    gap: 10,
  },
  yourRoundCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#86efac',
    minWidth: 100,
  },
  yourRoundDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  yourRoundScore: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  yourRoundPartners: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  yourRoundPartnerBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  yourRoundPartnerText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6b7280',
  },
  yourRoundMorePartners: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 6,
    fontFamily: 'Inter',
  },
  yourRoundPhotos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  yourRoundPhotoCount: {
    fontSize: 10,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  yourRoundChevron: {
    position: 'absolute',
    right: 6,
    top: 10,
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
    borderRadius: 12,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  reviewRatingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4b5563',
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
    borderRadius: 12,
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
    borderRadius: 12,
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