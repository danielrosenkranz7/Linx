import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FeedCardProps = {
  round: any;
  currentUserId: string;
  isLiked: boolean;
  isBookmarked?: boolean;
  onUpdate?: () => void;
};

export default function FeedCard({ round, currentUserId, isLiked: initialIsLiked, isBookmarked: initialIsBookmarked = false, onUpdate }: FeedCardProps) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [likesCount, setLikesCount] = useState(round.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(round.comments_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [keyboardHeight] = useState(new Animated.Value(0));

  // Handle keyboard for comments modal
  useEffect(() => {
    if (!showComments) return;

    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(keyboardHeight, {
          toValue: e.endCoordinates.height,
          duration: Platform.OS === 'ios' ? e.duration : 200,
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => {
        Animated.timing(keyboardHeight, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? e.duration : 200,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [showComments]);

  // Parse photos - handle array, JSON string, or null
  const photos: string[] = (() => {
    if (!round.photos) return [];
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

  // Sync with parent prop when it changes
  useEffect(() => {
    setIsLiked(initialIsLiked);
  }, [initialIsLiked]);

  useEffect(() => {
    setIsBookmarked(initialIsBookmarked);
  }, [initialIsBookmarked]);

  const handleLike = async () => {
    if (!currentUserId) return;

    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount((prev: number) => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      if (wasLiked) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('round_id', round.id)
          .eq('user_id', currentUserId);

        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase.from('likes').insert({
          round_id: round.id,
          user_id: currentUserId,
        });

        if (error) throw error;
      }
    } catch (error) {
      // Revert on error
      console.error('Error toggling like:', error);
      setIsLiked(wasLiked);
      setLikesCount((prev: number) => wasLiked ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const handleBookmark = async () => {
    if (!currentUserId || !round.course?.id) return;

    // Optimistic update
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);

    try {
      if (wasBookmarked) {
        // Remove bookmark
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('course_id', round.course.id)
          .eq('user_id', currentUserId);

        if (error) throw error;
      } else {
        // Add bookmark
        const { error } = await supabase.from('bookmarks').insert({
          course_id: round.course.id,
          user_id: currentUserId,
        });

        if (error) throw error;
      }
    } catch (error) {
      // Revert on error
      console.error('Error toggling bookmark:', error);
      setIsBookmarked(wasBookmarked);
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const { data } = await supabase
        .from('comments')
        .select(`
          *,
          user:profiles!comments_user_id_fkey(id, name, username, avatar_url)
        `)
        .eq('round_id', round.id)
        .order('created_at', { ascending: true });

      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleOpenComments = () => {
    setShowComments(true);
    loadComments();
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUserId || submittingComment) return;

    setSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          round_id: round.id,
          user_id: currentUserId,
          content: newComment.trim(),
        })
        .select(`
          *,
          user:profiles!comments_user_id_fkey(id, name, username, avatar_url)
        `)
        .single();

      if (error) throw error;

      setComments((prev) => [...prev, data]);
      setCommentsCount((prev: number) => prev + 1);
      setNewComment('');
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await supabase.from('comments').delete().eq('id', commentId);

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentsCount((prev: number) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h`;
    if (diffHours < 48) return '1d';
    return `${Math.floor(diffHours / 24)}d`;
  };

  const formatCommentDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const handleMoreOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Report'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            setShowReportModal(true);
          }
        }
      );
    } else {
      // Android fallback
      Alert.alert(
        'Options',
        '',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Report', style: 'destructive', onPress: () => setShowReportModal(true) },
        ]
      );
    }
  };

  const reportReasons = [
    'Inappropriate content',
    'Spam',
    'Fake or misleading',
    'Harassment',
    'Other',
  ];

  const handleSubmitReport = async () => {
    if (!reportReason) {
      toast.error('Please select a reason');
      return;
    }

    setSubmittingReport(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: currentUserId,
        content_type: 'round',
        content_id: round.id,
        reason: reportReason,
        details: reportDetails.trim() || null,
      });

      if (error) throw error;

      toast.success('Report submitted');
      setShowReportModal(false);
      setReportReason('');
      setReportDetails('');
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleShare = async () => {
    try {
      const userName = round.user?.name || 'Someone';
      const courseName = round.course?.name || 'a course';

      await Share.share({
        message: `Check out ${userName}'s round at ${courseName} on Linx! linx://round/${round.id}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <View style={styles.card}>
      {/* User Info */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => router.push(`/user/${round.user.id}`)}
        >
          {round.user.avatar_url ? (
            <Image source={{ uri: round.user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{round.user.name?.[0] || '?'}</Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{round.user.name}</Text>
            <View style={styles.actionRow}>
              <Text style={styles.actionText}>ranked </Text>
              <TouchableOpacity onPress={() => router.push(`/course/${round.course.id}`)}>
                <Text style={styles.courseName}>{round.course.name}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.location}>
              <Ionicons name="location-outline" size={12} color="#6b7280" />
              {' '}{round.course.location}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <Text style={styles.timestamp}>{formatDate(round.created_at)}</Text>
          <TouchableOpacity onPress={handleMoreOptions} style={styles.moreButton}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Row: Info on left, Photos on right */}
      <View style={styles.contentRow}>
        <View style={styles.contentLeft}>
          {/* Rating */}
          <View style={styles.ratingContainer}>
            <View style={styles.rating}>
              <Ionicons name="golf" size={24} color="#16a34a" />
              <Text style={styles.ratingNumber}>{round.rating.toFixed(1)}</Text>
            </View>
          </View>

          {/* Score Info */}
          {round.score && (
            <Text style={styles.scoreText}>
              Shot {[8, 11, 18].includes(round.score) || (round.score >= 80 && round.score <= 89) ? 'an' : 'a'} {round.score} •{' '}
              {round.holes === 'front9' ? 'Front 9' : round.holes === 'back9' ? 'Back 9' : '18 holes'}
            </Text>
          )}

          {/* Notes */}
          {round.notes && (
            <Text style={styles.notes} numberOfLines={3}>
              {round.notes}
            </Text>
          )}
        </View>

        {/* Photo Previews */}
        {photos.length > 0 && (
          <TouchableOpacity
            style={styles.photoPreviewContainer}
            onPress={() => {
              setSelectedPhotoIndex(0);
              setShowPhotoModal(true);
            }}
          >
            <Image source={{ uri: photos[0] }} style={styles.photoPreview} />
            {photos.length > 1 && (
              <View style={styles.photoCount}>
                <Ionicons name="images" size={12} color="#fff" />
                <Text style={styles.photoCountText}>{photos.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={20}
            color={isLiked ? '#16a34a' : '#6b7280'}
          />
          <Text style={[styles.actionCount, isLiked && styles.likedCount]}>{likesCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleOpenComments}>
          <Ionicons name="chatbubble-outline" size={20} color="#6b7280" />
          <Text style={styles.actionCount}>{commentsCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="paper-plane-outline" size={20} color="#6b7280" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleBookmark}>
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={isBookmarked ? '#16a34a' : '#6b7280'}
          />
        </TouchableOpacity>
      </View>

      {/* Comments Modal */}
      <Modal
        visible={showComments}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowComments(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setShowComments(false);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-down" size={28} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalHeaderCenter}>
              <Text style={styles.modalTitle}>Comments</Text>
              <Text style={styles.modalSubtitle}>{round.course?.name}</Text>
            </View>
            <View style={styles.modalHeaderRight} />
          </View>

          {/* Comments List */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.commentsList}
            contentContainerStyle={styles.commentsListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => {
              if (comments.length > 0) {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }
            }}
          >
            {loadingComments ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <View style={styles.emptyCommentsIcon}>
                  <Ionicons name="chatbubble-outline" size={32} color="#16a34a" />
                </View>
                <Text style={styles.emptyCommentsText}>Start the conversation</Text>
                <Text style={styles.emptyCommentsSubtext}>
                  Share your thoughts on this round
                </Text>
              </View>
            ) : (
              comments.map((comment, index) => (
                <View
                  key={comment.id}
                  style={[
                    styles.commentItem,
                    index === comments.length - 1 && styles.commentItemLast,
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowComments(false);
                      router.push(`/user/${comment.user.id}`);
                    }}
                  >
                    {comment.user.avatar_url ? (
                      <Image source={{ uri: comment.user.avatar_url }} style={styles.commentAvatar} />
                    ) : (
                      <View style={styles.commentAvatarPlaceholder}>
                        <Text style={styles.commentAvatarText}>
                          {comment.user.name?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.commentContent}>
                    <View style={styles.commentBubble}>
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          setShowComments(false);
                          router.push(`/user/${comment.user.id}`);
                        }}
                      >
                        <Text style={styles.commentUserName}>{comment.user.name}</Text>
                      </TouchableOpacity>
                      <Text style={styles.commentText}>{comment.content}</Text>
                    </View>
                    <View style={styles.commentMeta}>
                      <Text style={styles.commentTime}>{formatCommentDate(comment.created_at)}</Text>
                      {comment.user_id === currentUserId && (
                        <TouchableOpacity
                          onPress={() => handleDeleteComment(comment.id)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={styles.deleteText}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Comment Input */}
          <Animated.View
            style={[
              styles.commentInputContainer,
              { marginBottom: keyboardHeight },
            ]}
          >
            <View style={styles.commentInputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor="#9ca3af"
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  newComment.trim() && !submittingComment && styles.sendButtonActive,
                ]}
                onPress={handleSubmitComment}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={newComment.trim() && !submittingComment ? '#fff' : '#9ca3af'}
                />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Photo Gallery Modal */}
      <Modal
        visible={showPhotoModal}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.photoModalContainer}>
          {/* Header */}
          <View style={styles.photoModalHeader}>
            <TouchableOpacity
              onPress={() => setShowPhotoModal(false)}
              style={styles.photoModalClose}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.photoModalCount}>
              {selectedPhotoIndex + 1} / {photos.length}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Photo Carousel */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setSelectedPhotoIndex(index);
            }}
            contentOffset={{ x: selectedPhotoIndex * SCREEN_WIDTH, y: 0 }}
          >
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoSlide}>
                <Image
                  source={{ uri: photo }}
                  style={styles.fullPhoto}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          {/* Thumbnail Strip */}
          {photos.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbnailStrip}
              contentContainerStyle={styles.thumbnailContent}
            >
              {photos.map((photo, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedPhotoIndex(index)}
                  style={[
                    styles.thumbnail,
                    selectedPhotoIndex === index && styles.thumbnailActive,
                  ]}
                >
                  <Image source={{ uri: photo }} style={styles.thumbnailImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportModalContent}>
            <View style={styles.reportModalHeader}>
              <Text style={styles.reportModalTitle}>Report Content</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Ionicons name="close" size={28} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            <Text style={styles.reportModalSubtitle}>
              Why are you reporting this post?
            </Text>

            <View style={styles.reportReasons}>
              {reportReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reportReasonButton,
                    reportReason === reason && styles.reportReasonButtonActive,
                  ]}
                  onPress={() => setReportReason(reason)}
                >
                  <Text
                    style={[
                      styles.reportReasonText,
                      reportReason === reason && styles.reportReasonTextActive,
                    ]}
                  >
                    {reason}
                  </Text>
                  {reportReason === reason && (
                    <Ionicons name="checkmark" size={20} color="#16a34a" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reportDetailsInput}
              placeholder="Additional details (optional)"
              placeholderTextColor="#9ca3af"
              value={reportDetails}
              onChangeText={setReportDetails}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              style={[
                styles.reportSubmitButton,
                (!reportReason || submittingReport) && styles.reportSubmitButtonDisabled,
              ]}
              onPress={handleSubmitReport}
              disabled={!reportReason || submittingReport}
            >
              <Text style={styles.reportSubmitButtonText}>
                {submittingReport ? 'Submitting...' : 'Submit Report'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contentLeft: {
    flex: 1,
    marginRight: 12,
  },
  photoPreviewContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoCount: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  photoCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
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
    color: '#fff',
    fontSize: 18,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  actionText: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  courseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  location: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timestamp: {
    fontSize: 13,
    color: '#9ca3af',
    fontFamily: 'Inter',
  },
  moreButton: {
    padding: 4,
  },
  ratingContainer: {
    marginBottom: 12,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingNumber: {
    fontSize: 28,
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
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  likedCount: {
    color: '#16a34a',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalHeaderLeft: {
    width: 44,
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  modalHeaderRight: {
    width: 44,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Inter',
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyCommentsIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCommentsText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 6,
    fontFamily: 'Inter',
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  commentItemLast: {
    borderBottomWidth: 0,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  commentAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  commentAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentUserName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Inter',
    marginBottom: 3,
  },
  commentText: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
    fontFamily: 'Inter',
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  commentTime: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'Inter',
  },
  deleteText: {
    fontSize: 12,
    color: '#ef4444',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  commentInputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  commentInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
  },
  commentInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    paddingVertical: 8,
    fontSize: 15,
    fontFamily: 'Inter',
    color: '#1a1a1a',
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  sendButtonActive: {
    backgroundColor: '#16a34a',
  },
  // Photo Modal styles
  photoModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  photoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  photoModalClose: {
    padding: 4,
  },
  photoModalCount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  photoSlide: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPhoto: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
  },
  thumbnailStrip: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
  },
  thumbnailContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: '#16a34a',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  // Report Modal styles
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reportModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  reportModalSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 20,
    fontFamily: 'Inter',
  },
  reportReasons: {
    gap: 8,
    marginBottom: 16,
  },
  reportReasonButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reportReasonButtonActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
  },
  reportReasonText: {
    fontSize: 16,
    color: '#1a1a1a',
    fontFamily: 'Inter',
  },
  reportReasonTextActive: {
    color: '#16a34a',
    fontWeight: '600',
  },
  reportDetailsInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter',
    color: '#1a1a1a',
    backgroundColor: '#f9fafb',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  reportSubmitButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  reportSubmitButtonDisabled: {
    opacity: 0.5,
  },
  reportSubmitButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter',
  },
});
