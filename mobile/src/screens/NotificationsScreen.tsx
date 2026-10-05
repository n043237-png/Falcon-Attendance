import React, { useState, useCallback, useMemo } from 'react';
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
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markAsRead, markAllAsRead, Notification } from '../api/notificationApi';

interface ParsedEmployee {
  name: string;
  code: string;
}

interface ParsedNotificationData {
  isRoster: boolean;
  rosterType: 'ABSENT' | 'MISSING_CHECKOUT' | 'GENERIC';
  intro: string;
  employees: ParsedEmployee[];
}

/**
 * Extracts individual employees and employee codes from consolidated absent/missing check-out roster notifications.
 * Preserves colons in timestamps (e.g. "11:00 AM", "7:00 PM") and prevents personal notifications from being misclassified.
 */
const parseNotificationEmployees = (
  message?: string,
  title?: string,
  type?: string
): ParsedNotificationData => {
  if (!message) return { isRoster: false, rosterType: 'GENERIC', intro: '', employees: [] };

  const rawTitle = (title || '').toLowerCase();
  const rawType = (type || '').toLowerCase();
  const rawMsg = message.toLowerCase();

  // 1. Immediately exclude non-roster / personal / leave / announcement notifications
  if (
    rawTitle.includes('late check-in') ||
    rawTitle.includes('leave') ||
    rawTitle.includes('announcement') ||
    rawTitle.includes('check-in successful') ||
    rawTitle.includes('check-out successful') ||
    rawTitle.includes('reminder') ||
    rawTitle.includes('profile updated') ||
    rawType.includes('leave') ||
    rawType.includes('announcement') ||
    rawMsg.startsWith('your attendance has been marked') ||
    rawMsg.startsWith('checkout recorded for') ||
    rawMsg.includes('has requested') ||
    rawMsg.includes('applied for') ||
    rawMsg.includes('checked in at')
  ) {
    return { isRoster: false, rosterType: 'GENERIC', intro: message, employees: [] };
  }

  // 2. Identify if this is a true consolidated broadcast roster
  const isAbsentRoster =
    rawMsg.includes('considered absent:') ||
    ((rawTitle.includes('absent notification') || rawType === 'admin_daily_absence') && rawMsg.includes(':'));

  const isMissingCheckoutRoster =
    rawMsg.includes('have not marked check-out') && rawMsg.includes(':');

  if (!isAbsentRoster && !isMissingCheckoutRoster) {
    return { isRoster: false, rosterType: 'GENERIC', intro: message, employees: [] };
  }

  const rosterType: 'ABSENT' | 'MISSING_CHECKOUT' = isMissingCheckoutRoster ? 'MISSING_CHECKOUT' : 'ABSENT';

  // 3. Find the exact boundary before the employee list
  let intro = message;
  let listPart = '';

  const absentMarker = 'considered absent:';
  const checkoutMarkerMatch = message.match(/have not marked check-out for [^:]+:/i);

  if (message.includes(absentMarker)) {
    const splitIdx = message.indexOf(absentMarker) + absentMarker.length;
    intro = message.substring(0, splitIdx).trim();
    listPart = message.substring(splitIdx).trim();
  } else if (checkoutMarkerMatch && checkoutMarkerMatch.index !== undefined) {
    const splitIdx = checkoutMarkerMatch.index + checkoutMarkerMatch[0].length;
    intro = message.substring(0, splitIdx).trim();
    listPart = message.substring(splitIdx).trim();
  } else {
    // Look for the last colon before the first "Name (EMPCODE)" pattern
    const match = message.match(/:\s*([A-Za-z\s.'-]+\s*\([A-Za-z0-9_-]{3,20}\))/);
    if (match && match.index !== undefined) {
      intro = message.substring(0, match.index + 1).trim();
      listPart = message.substring(match.index + 1).trim();
    }
  }

  if (!listPart) {
    return { isRoster: false, rosterType, intro: message, employees: [] };
  }

  // 4. Parse employees from listPart
  // Pattern: Name (CODE) where CODE is 3-20 characters without spaces
  const empRegex = /([A-Za-z\s.'-]+?)\s*\(([A-Za-z0-9_-]{3,20})\)/g;
  const employees: ParsedEmployee[] = [];
  let m;
  while ((m = empRegex.exec(listPart)) !== null) {
    let name = m[1]
      .replace(/^\s*and\s+/i, '')
      .replace(/^[,.\s]+|[,.\s]+$/g, '')
      .trim();
    const code = m[2].trim();

    if (name.toLowerCase().startsWith('considered absent:')) {
      name = name.substring('considered absent:'.length).trim();
    }

    if (name && code && name.length >= 2) {
      employees.push({ name, code });
    }
  }

  if (employees.length === 0) {
    return { isRoster: false, rosterType, intro: message, employees: [] };
  }

  return { isRoster: true, rosterType, intro, employees };
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name.slice(0, 2) || 'EM').toUpperCase();
};

export default function NotificationsScreen() {
  const { token, user } = useAuth();
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Card expansion state per notification ID
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});

  // Full detail modal state
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [modalSearch, setModalSearch] = useState('');

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const fetchNotifications = async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await getNotifications(token);
      if (res && res.success) {
        const rawItems = res.data?.items ?? (Array.isArray(res.data) ? res.data : []);
        const list = Array.isArray(rawItems) ? rawItems : [];
        // Client-side deduplication safeguard: suppress rapid duplicate notifications
        const deduped: Notification[] = [];
        const seen = new Set<string>();
        for (const item of list) {
          const timeBucket = item.createdAt ? Math.floor(new Date(item.createdAt).getTime() / (3 * 60 * 1000)) : 0;
          const key = `${item.title}_${item.message}_${timeBucket}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(item);
          }
        }
        setNotifications(deduped);
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

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNotificationPress = async (item: Notification) => {
    if (checkIsUnread(item)) {
      await handleMarkAsRead(item.id);
    }
    setSelectedNotification(item);
    setModalSearch('');
  };

  const handleModalNavigateToAttendance = (item: Notification) => {
    setSelectedNotification(null);
    if (isAdmin) {
      navigation.navigate('Admin' as never, { screen: 'AdvancedAttendance' } as never);
    } else {
      navigation.navigate('History' as never);
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

      // Calculate calendar days difference (midnight-to-midnight)
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfItemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const calendarDaysDiff = Math.round((startOfToday - startOfItemDay) / (1000 * 60 * 60 * 24));

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateDisplay = `${months[d.getMonth()]} ${d.getDate()}`;

      // Today
      if (calendarDaysDiff <= 0) {
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        return `${diffHours}h ago`;
      }

      // Yesterday
      if (calendarDaysDiff === 1) {
        return 'Yesterday';
      }

      // 2 or more days ago: show exact date (e.g. "Oct 1")
      return dateDisplay;
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

  const unreadCount = notifications.filter(checkIsUnread).length;

  // Filtered employees for selected notification modal
  const selectedParsed = useMemo(() => {
    if (!selectedNotification) {
      return { isRoster: false, rosterType: 'GENERIC' as const, intro: '', employees: [] };
    }
    return parseNotificationEmployees(
      selectedNotification.message,
      selectedNotification.title,
      selectedNotification.type
    );
  }, [selectedNotification]);

  const filteredModalEmployees = useMemo(() => {
    if (!selectedParsed.isRoster || !selectedParsed.employees.length) return [];
    if (!modalSearch.trim()) return selectedParsed.employees;
    const q = modalSearch.toLowerCase().trim();
    return selectedParsed.employees.filter(
      emp => emp.name.toLowerCase().includes(q) || emp.code.toLowerCase().includes(q)
    );
  }, [selectedParsed, modalSearch]);

  const renderItem = ({ item }: { item: Notification }) => {
    const isUnread = checkIsUnread(item);
    const theme = getTypeTheme(item.type, item.priority);
    const dateText = formatNotificationDate(item.sentAt || item.sent_at || item.createdAt || item.created_at);

    const parsed = parseNotificationEmployees(item.message, item.title, item.type);
    const isExpanded = !!expandedIds[item.id];
    const hasEmployees = parsed.isRoster && parsed.employees.length > 0;
    const isLongText = (item.message || '').length > 90 || (item.message || '').includes('\n');
    const isMissingCheckout = parsed.rosterType === 'MISSING_CHECKOUT';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
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

          {hasEmployees ? (
            <View style={styles.employeeNotificationBlock}>
              <Text style={[styles.messageText, isUnread && styles.unreadMessage]}>
                {parsed.intro}
              </Text>

              {/* Renders employee chips */}
              <View style={styles.chipsContainer}>
                {(isExpanded ? parsed.employees : parsed.employees.slice(0, 3)).map((emp, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.employeeChip,
                      isMissingCheckout && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                    ]}
                  >
                    <Ionicons
                      name="person-circle"
                      size={15}
                      color={isMissingCheckout ? '#D97706' : '#DC2626'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[styles.chipEmpName, isMissingCheckout && { color: '#B45309' }]}
                      numberOfLines={1}
                    >
                      {emp.name}
                    </Text>
                    <Text
                      style={[styles.chipEmpCode, isMissingCheckout && { color: '#D97706' }]}
                    >
                      ({emp.code})
                    </Text>
                  </View>
                ))}

                {!isExpanded && parsed.employees.length > 3 && (
                  <View style={styles.moreCountChip}>
                    <Text style={styles.moreCountText}>+{parsed.employees.length - 3} more</Text>
                  </View>
                )}
              </View>

              {/* Expand / Collapse Action */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.expandToggleBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleExpand(item.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.expandToggleText}>
                    {isExpanded ? 'Show less' : `Show all ${parsed.employees.length} employees`}
                  </Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#2563EB"
                    style={{ marginLeft: 3 }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.viewDetailBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleNotificationPress(item);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewDetailText}>Full Roster</Text>
                  <Ionicons name="open-outline" size={13} color="#475569" style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <Text
                style={[styles.messageText, isUnread && styles.unreadMessage]}
                numberOfLines={isExpanded ? undefined : 3}
              >
                {item.message}
              </Text>

              {isLongText && (
                <TouchableOpacity
                  style={styles.expandToggleBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleExpand(item.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.expandToggleText}>
                    {isExpanded ? 'Show less' : 'Read more'}
                  </Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#2563EB"
                    style={{ marginLeft: 3 }}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

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

        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllAsRead} activeOpacity={0.7}>
            <Ionicons name="checkmark-done" size={15} color="#2563EB" style={{ marginRight: 4 }} />
            <Text style={styles.markAllText}>Mark all</Text>
          </TouchableOpacity>
        )}
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

      {/* Notification Full Detail Modal */}
      <Modal
        visible={!!selectedNotification}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedNotification(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                {selectedNotification && (
                  <View
                    style={[
                      styles.modalIconBox,
                      { backgroundColor: getTypeTheme(selectedNotification.type, selectedNotification.priority).bg },
                    ]}
                  >
                    <Ionicons
                      name={getTypeTheme(selectedNotification.type, selectedNotification.priority).icon}
                      size={20}
                      color={getTypeTheme(selectedNotification.type, selectedNotification.priority).color}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selectedNotification?.title || selectedNotification?.type || 'Notification'}
                  </Text>
                  <Text style={styles.modalTimeText}>
                    {formatNotificationDate(
                      selectedNotification?.sentAt ||
                        selectedNotification?.sent_at ||
                        selectedNotification?.createdAt ||
                        selectedNotification?.created_at
                    )}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedNotification(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              {selectedParsed.isRoster && selectedParsed.employees.length > 0 ? (
                <View>
                  {/* Summary Banner */}
                  {(() => {
                    const isMissingCheckout = selectedParsed.rosterType === 'MISSING_CHECKOUT';
                    const bannerBadgeBg = isMissingCheckout ? '#FEF3C7' : '#FEE2E2';
                    const bannerBadgeText = isMissingCheckout ? '#B45309' : '#B91C1C';
                    const bannerIcon = isMissingCheckout ? 'time' : 'warning';
                    const bannerTitle = isMissingCheckout
                      ? `${selectedParsed.employees.length} Missing Check-Out`
                      : `${selectedParsed.employees.length} Employees Absent`;

                    return (
                      <View style={[styles.summaryBanner, isMissingCheckout && styles.summaryBannerMissing]}>
                        <View style={styles.bannerTopRow}>
                          <View style={[styles.bannerBadge, { backgroundColor: bannerBadgeBg }]}>
                            <Ionicons name={bannerIcon} size={14} color={bannerBadgeText} style={{ marginRight: 4 }} />
                            <Text style={[styles.bannerBadgeText, { color: bannerBadgeText }]}>
                              {bannerTitle}
                            </Text>
                          </View>
                          {selectedNotification?.priority && (
                            <View style={styles.modalPriorityPill}>
                              <Text style={styles.modalPriorityText}>{selectedNotification.priority}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.bannerIntroText, isMissingCheckout && { color: '#92400E' }]}>
                          {selectedParsed.intro}
                        </Text>
                      </View>
                    );
                  })()}

                  {/* Search Bar for List */}
                  {selectedParsed.employees.length > 4 && (
                    <View style={styles.modalSearchRow}>
                      <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                      <TextInput
                        style={styles.modalSearchInput}
                        placeholder="Search employee by name or ID..."
                        placeholderTextColor="#94A3B8"
                        value={modalSearch}
                        onChangeText={setModalSearch}
                        autoCapitalize="none"
                      />
                      {modalSearch.length > 0 && (
                        <TouchableOpacity onPress={() => setModalSearch('')}>
                          <Ionicons name="close-circle" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Employee List */}
                  {(() => {
                    const isMissingCheckout = selectedParsed.rosterType === 'MISSING_CHECKOUT';
                    const sectionTitle = isMissingCheckout
                      ? `Missing Check-Out Roster (${filteredModalEmployees.length} of ${selectedParsed.employees.length})`
                      : `Absent Roster (${filteredModalEmployees.length} of ${selectedParsed.employees.length})`;

                    return (
                      <View style={styles.employeeListContainer}>
                        <Text style={styles.sectionHeading}>{sectionTitle}</Text>

                        {filteredModalEmployees.map((emp, index) => (
                          <View key={index} style={styles.employeeCardRow}>
                            <View
                              style={[
                                styles.empAvatarCircle,
                                isMissingCheckout && { backgroundColor: '#FEF3C7' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.empAvatarText,
                                  isMissingCheckout && { color: '#B45309' },
                                ]}
                              >
                                {getInitials(emp.name)}
                              </Text>
                            </View>
                            <View style={styles.empDetails}>
                              <Text style={styles.empFullName}>{emp.name}</Text>
                              <Text style={styles.empCodeBadge}>{emp.code}</Text>
                            </View>
                            <View
                              style={[
                                styles.absentPill,
                                isMissingCheckout && { backgroundColor: '#FEF3C7' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.absentPillText,
                                  isMissingCheckout && { color: '#B45309' },
                                ]}
                              >
                                {isMissingCheckout ? 'NO CHECK-OUT' : 'ABSENT'}
                              </Text>
                            </View>
                          </View>
                        ))}

                        {filteredModalEmployees.length === 0 && (
                          <View style={styles.noMatchBox}>
                            <Text style={styles.noMatchText}>No employees matching "{modalSearch}"</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
              ) : (
                <View style={styles.standardMessageContainer}>
                  <View style={styles.standardMessageCard}>
                    <View
                      style={[
                        styles.standardMessageHeader,
                        {
                          backgroundColor: getTypeTheme(
                            selectedNotification?.type,
                            selectedNotification?.priority
                          ).bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={getTypeTheme(selectedNotification?.type, selectedNotification?.priority).icon}
                        size={22}
                        color={getTypeTheme(selectedNotification?.type, selectedNotification?.priority).color}
                      />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text
                          style={[
                            styles.standardMessageTitle,
                            {
                              color: getTypeTheme(
                                selectedNotification?.type,
                                selectedNotification?.priority
                              ).color,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {selectedNotification?.title || selectedNotification?.type || 'Notification'}
                        </Text>
                        {selectedNotification?.priority && (
                          <Text style={styles.standardMessagePrioText}>
                            Priority: {selectedNotification.priority.toUpperCase()}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.standardMessageContent}>
                      <Text style={styles.standardMessageBodyText}>{selectedNotification?.message}</Text>
                    </View>

                    {(selectedNotification?.sentAt ||
                      selectedNotification?.sent_at ||
                      selectedNotification?.createdAt ||
                      selectedNotification?.created_at) && (
                      <View style={styles.standardMessageMetaRow}>
                        <Ionicons name="time-outline" size={13} color="#94A3B8" />
                        <Text style={styles.standardMessageMetaTime}>
                          {formatNotificationDate(
                            selectedNotification?.sentAt ||
                              selectedNotification?.sent_at ||
                              selectedNotification?.createdAt ||
                              selectedNotification?.created_at
                          )}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              {(() => {
                const notifType = (selectedNotification?.type || '').toLowerCase();
                const notifTitle = (selectedNotification?.title || '').toLowerCase();
                const isLeaveNotif = notifType === 'leave' || notifTitle.includes('leave');
                const isAnnouncement = notifType === 'announcement' || notifTitle.includes('announcement');

                if (isAnnouncement) return null;

                if (isLeaveNotif) {
                  return (
                    <TouchableOpacity
                      style={styles.actionPrimaryBtn}
                      onPress={() => {
                        setSelectedNotification(null);
                        navigation.navigate('Leave' as never);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="document-text-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.actionPrimaryText}>
                        {isAdmin ? 'View Leave Requests' : 'View My Leaves'}
                      </Text>
                    </TouchableOpacity>
                  );
                }

                if (isAdmin || selectedNotification?.actionUrl) {
                  return (
                    <TouchableOpacity
                      style={styles.actionPrimaryBtn}
                      onPress={() => selectedNotification && handleModalNavigateToAttendance(selectedNotification)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.actionPrimaryText}>
                        {isAdmin ? 'View Admin Attendance' : 'View Attendance History'}
                      </Text>
                    </TouchableOpacity>
                  );
                }

                return null;
              })()}

              <TouchableOpacity
                style={styles.actionCloseBtn}
                onPress={() => setSelectedNotification(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.actionCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Chip-based employee display
  employeeNotificationBlock: {
    marginTop: 2,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  employeeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  chipEmpName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
    maxWidth: 130,
  },
  chipEmpCode: {
    fontSize: 11,
    fontWeight: '500',
    color: '#DC2626',
    marginLeft: 3,
  },
  moreCountChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
    justifyContent: 'center',
  },
  moreCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  expandToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  expandToggleText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#2563EB',
  },
  viewDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    minHeight: '40%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  modalIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalTimeText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  summaryBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  bannerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
  },
  modalPriorityPill: {
    backgroundColor: '#FFEDD5',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  modalPriorityText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#C2410C',
    textTransform: 'uppercase',
  },
  bannerIntroText: {
    fontSize: 13.5,
    color: '#7F1D1D',
    lineHeight: 19,
    fontWeight: '500',
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    padding: 0,
  },
  employeeListContainer: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  employeeCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  empAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  empAvatarText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#B91C1C',
  },
  empDetails: {
    flex: 1,
  },
  empFullName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  empCodeBadge: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  absentPill: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  absentPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#B91C1C',
  },
  noMatchBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noMatchText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  summaryBannerMissing: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  standardMessageContainer: {
    paddingVertical: 10,
    marginBottom: 10,
  },
  standardMessageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  standardMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  standardMessageTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  standardMessagePrioText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  standardMessageContent: {
    padding: 18,
  },
  standardMessageBodyText: {
    fontSize: 15,
    color: '#1E293B',
    lineHeight: 23,
    fontWeight: '500',
  },
  standardMessageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 4,
  },
  standardMessageMetaTime: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    gap: 10,
  },
  actionPrimaryBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionCloseBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCloseText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
});
