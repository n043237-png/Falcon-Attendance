import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markAsRead, markAllAsRead, Notification } from '../api/notificationApi';
import { sendTestNotification } from '../services/pushNotificationService';

export default function NotificationsScreen() {
  const { token } = useAuth();
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await getNotifications(token);
      if (res && res.success) {
        // Support both { items: [...] } structure and direct array
        const rawItems = res.data?.items ?? (Array.isArray(res.data) ? res.data : []);
        setNotifications(Array.isArray(rawItems) ? rawItems : []);
      } else {
        setNotifications([]);
      }
    } catch (e) {
      console.error('fetchNotifications error:', e);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [token])
  );

  const checkIsUnread = (item: Notification) => {
    if (item.isRead === false) return true;
    if (item.read_at === null || item.read_at === undefined) {
      return item.isRead !== true;
    }
    return false;
  };

  const handleMarkAsRead = async (id: number) => {
    if (!token) return;
    try {
      const res = await markAsRead(id, token);
      if (res.success) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, isRead: true, read_at: new Date().toISOString() } : n))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!token) return;
    try {
      const res = await markAllAsRead(token);
      if (res.success) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true, read_at: new Date().toISOString() }))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatNotificationDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}`;
    } catch {
      return '';
    }
  };

  const getTypeTheme = (type?: string, priority?: string) => {
    const p = (priority || '').toLowerCase();
    if (p === 'critical') return { color: '#EF4444', bg: '#FEE2E2', icon: 'alert-circle' as const };
    if (p === 'high') return { color: '#F97316', bg: '#FFEDD5', icon: 'warning' as const };

    const t = (type || '').toUpperCase();
    switch (t) {
      case 'CHECK_IN':
      case 'CHECK_OUT':
      case 'ATTENDANCE':
        return { color: '#2563EB', bg: '#EFF6FF', icon: 'calendar' as const };
      case 'LEAVE':
        return { color: '#7C3AED', bg: '#F5F3FF', icon: 'airplane' as const };
      case 'PAYROLL':
      case 'SALARY':
        return { color: '#059669', bg: '#ECFDF5', icon: 'cash' as const };
      case 'ABSENCE':
      case 'ADMIN_DAILY_ABSENCE':
        return { color: '#DC2626', bg: '#FEF2F2', icon: 'close-circle' as const };
      case 'MISSING_CHECKOUT':
        return { color: '#D97706', bg: '#FEF3C7', icon: 'time' as const };
      default:
        return { color: '#2563EB', bg: '#EFF6FF', icon: 'notifications' as const };
    }
  };

  const handleNotificationPress = async (item: Notification) => {
    if (checkIsUnread(item)) {
      await handleMarkAsRead(item.id);
    }

    const t = (item.type || '').toUpperCase();
    if (t === 'MISSING_CHECKOUT' || t === 'CHECK_IN' || t === 'ATTENDANCE') {
      navigation.navigate('Home' as never);
    } else if (t === 'ABSENT' || t === 'ADMIN_DAILY_ABSENCE') {
      navigation.navigate('History' as never);
    }
  };

  const unreadCount = notifications.filter(checkIsUnread).length;

  const renderItem = ({ item }: { item: Notification }) => {
    const isUnread = checkIsUnread(item);
    const theme = getTypeTheme(item.type, item.priority);
    const dateText = formatNotificationDate(item.sentAt || item.sent_at || item.createdAt || item.created_at);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.card, isUnread && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconBox, { backgroundColor: theme.bg }]}>
          <Ionicons name={theme.icon} size={22} color={theme.color} />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, isUnread && styles.unreadTitle]} numberOfLines={1}>
              {item.title || item.type || 'Notification'}
            </Text>
            {dateText ? <Text style={styles.timeText}>{dateText}</Text> : null}
          </View>

          <Text style={[styles.messageText, isUnread && styles.unreadMessage]} numberOfLines={3}>
            {item.message}
          </Text>

          {item.priority && (
            <View style={styles.cardFooter}>
              <View style={[styles.priorityPill, { backgroundColor: theme.bg }]}>
                <Text style={[styles.priorityText, { color: theme.color }]}>{item.priority}</Text>
              </View>
            </View>
          )}
        </View>

        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Executive Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={styles.testAlertBtn}
            onPress={async () => {
              const res = await sendTestNotification();
              Alert.alert(res.success ? 'Notification Sent! 🔔' : 'Notification Alert', res.message);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={15} color="#2563EB" style={{ marginRight: 4 }} />
            <Text style={styles.testAlertText}>Test Alert</Text>
          </TouchableOpacity>

          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllAsRead} activeOpacity={0.7}>
              <Ionicons name="checkmark-done" size={15} color="#2563EB" style={{ marginRight: 4 }} />
              <Text style={styles.markAllText}>Mark all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main List / State */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="notifications-off-outline" size={42} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>
            We'll notify you here about attendance alerts, shift updates, and important announcements.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications(true)}
              colors={['#2563EB']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 20) : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  testAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  testAlertText: {
    color: '#0284C7',
    fontSize: 12.5,
    fontWeight: '700',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  markAllText: {
    color: '#2563EB',
    fontSize: 12.5,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#BFDBFE',
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#0F172A',
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  messageText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  unreadMessage: {
    color: '#1E293B',
  },
  cardFooter: {
    marginTop: 8,
    flexDirection: 'row',
  },
  priorityPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    marginTop: 6,
    marginLeft: 6,
  },
});

