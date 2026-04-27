import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../lib/colors';
import { handleError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

type Notification = {
  id: string;
  type: 'follow' | 'like' | 'comment';
  read: boolean;
  created_at: string;
  actor: {
    id: string;
    name: string;
    username: string;
    avatar_url?: string;
  };
  round?: {
    id: string;
    course: {
      name: string;
    };
  };
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          read,
          created_at,
          actor:profiles!notifications_actor_id_fkey(
            id,
            name,
            username,
            avatar_url
          ),
          round:rounds(
            id,
            course:courses(name)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formatted = (data || []).map(n => ({
        id: n.id,
        type: n.type as 'follow' | 'like' | 'comment',
        read: n.read,
        created_at: n.created_at,
        actor: n.actor as any,
        round: n.round as any,
      }));

      setNotifications(formatted);
    } catch (error) {
      handleError(error, 'Loading notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, []);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);

    if (notification.type === 'follow') {
      router.push(`/user/${notification.actor.id}`);
    } else if (notification.round) {
      // Navigate to the round detail page
      router.push(`/round/${notification.round.id}`);
    }
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'follow':
        return 'started following you';
      case 'like':
        return `liked your round at ${notification.round?.course?.name || 'a course'}`;
      case 'comment':
        return `commented on your round at ${notification.round?.course?.name || 'a course'}`;
      default:
        return '';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow':
        return 'person-add';
      case 'like':
        return 'heart';
      case 'comment':
        return 'chatbubble';
      default:
        return 'notifications';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'follow':
        return colors.info;      // Blue - informational
      case 'like':
        return colors.error;     // Red - heart/love
      case 'comment':
        return colors.success;   // Green - engagement
      default:
        return colors.textSecondary;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Minimal header - just mark all read when needed */}
      {unreadCount > 0 && (
        <View style={styles.markAllHeader}>
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={unreadCount === 0 ? styles.contentWithPadding : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              When someone follows you or interacts with your rounds, you'll see it here
            </Text>
          </View>
        ) : (
          notifications.map(notification => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.read && styles.notificationUnread,
              ]}
              onPress={() => handleNotificationPress(notification)}
            >
              <View style={styles.notificationLeft}>
                {notification.actor?.avatar_url ? (
                  <Image
                    source={{ uri: notification.actor.avatar_url }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {notification.actor?.name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: getIconColor(notification.type) },
                  ]}
                >
                  <Ionicons
                    name={getNotificationIcon(notification.type) as any}
                    size={12}
                    color="#fff"
                  />
                </View>
              </View>

              <View style={styles.notificationContent}>
                <Text style={styles.notificationText}>
                  <Text style={styles.actorName}>
                    {notification.actor?.name || 'Someone'}
                  </Text>{' '}
                  {getNotificationText(notification)}
                </Text>
                <Text style={styles.notificationTime}>
                  {formatTime(notification.created_at)}
                </Text>
              </View>

              {!notification.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
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
  markAllHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  markAllRead: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    fontFamily: 'Inter',
  },
  content: {
    flex: 1,
  },
  contentWithPadding: {
    paddingTop: 60,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
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
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  notificationUnread: {
    backgroundColor: '#f0fdf4',
  },
  notificationLeft: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 20,
    fontFamily: 'Inter',
  },
  actorName: {
    fontWeight: '600',
  },
  notificationTime: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16a34a',
    marginLeft: 8,
  },
});
