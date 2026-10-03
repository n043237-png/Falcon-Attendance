import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  StatusBar,
  FlatList,
  RefreshControl,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getAttendanceSummary, getAttendanceCalendar } from '../api/attendanceApi';
import { getAdminAttendance } from '../api/adminApi';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const { user, token } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const [adminTab, setAdminTab] = useState<'my' | 'all'>('my');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Employee states
  const [summary, setSummary] = useState<any>(null);
  const [calendar, setCalendar] = useState<any[]>([]);

  // Admin states
  const [adminRecords, setAdminRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  const loadData = async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const dateStr = currentDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      if (isAdmin && adminTab === 'all') {
        const records = await getAdminAttendance(dateStr);
        setAdminRecords(records.items || []);
      } else {
        const [sumRes, calRes] = await Promise.all([
          getAttendanceSummary(token, year, month),
          getAttendanceCalendar(token, year, month),
        ]);

        if (sumRes.success) setSummary(sumRes.data?.summary || null);
        if (calRes.success) setCalendar(calRes.data || []);
        else setError(calRes.error?.message || 'Failed to load calendar');
      }
    } catch {
      setError('Unable to fetch attendance history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [currentDate, token, adminTab])
  );

  const handlePrevMonth = () => {
    const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const minPastYear = new Date().getFullYear() - 3;
    if (prevMonthDate.getFullYear() < minPastYear) {
      return;
    }
    setCurrentDate(prevMonthDate);
  };

  const handleNextMonth = () => {
    const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const today = new Date();
    // Allow navigation up to the end of next calendar year so users can access future holidays and calendar
    const maxFutureYear = today.getFullYear() + 1;
    if (nextMonthDate.getFullYear() > maxFutureYear) {
      return;
    }
    setCurrentDate(nextMonthDate);
  };

  const formatHours = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0h 0m';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    try {
      return new Date(isoString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return '--:--';
    }
  };

  const getStatusDetails = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return { color: '#15803D', bg: '#DCFCE7', label: 'Present', icon: 'checkmark-circle' };
      case 'ABSENT':
        return { color: '#B91C1C', bg: '#FEE2E2', label: 'Absent', icon: 'close-circle' };
      case 'HALF_DAY':
        return { color: '#B45309', bg: '#FEF3C7', label: 'Half Day', icon: 'star-half' };
      case 'ON_LEAVE':
      case 'HALF_DAY_LEAVE':
        return { color: '#1D4ED8', bg: '#DBEAFE', label: 'On Leave', icon: 'airplane' };
      case 'HOLIDAY':
        return { color: '#0F766E', bg: '#CCFBF1', label: 'Holiday', icon: 'cafe' };
      case 'SUNDAY':
        return { color: '#64748B', bg: '#F1F5F9', label: 'Sunday', icon: 'calendar' };
      case 'CHECKOUT_MISSING':
        return { color: '#D97706', bg: '#FEF3C7', label: 'Missing Out', icon: 'alert-circle' };
      case 'INSUFFICIENT_HOURS':
        return { color: '#DC2626', bg: '#FEF2F2', label: 'Low Hours', icon: 'time' };
      case 'NOT_MARKED':
        return { color: '#94A3B8', bg: '#F8FAFC', label: 'Upcoming', icon: 'time-outline' };
      default:
        return { color: '#94A3B8', bg: '#F8FAFC', label: 'Not Marked', icon: 'ellipse-outline' };
    }
  };

  const isCurrentDateToday = () => {
    const t = new Date();
    return (
      currentDate.getDate() === t.getDate() &&
      currentDate.getMonth() === t.getMonth() &&
      currentDate.getFullYear() === t.getFullYear()
    );
  };

  const renderAdminAllStaff = () => (
    <>
      <View style={styles.monthHeader}>
        <TouchableOpacity
          onPress={() => {
            const d = new Date(currentDate);
            d.setDate(d.getDate() - 1);
            setCurrentDate(d);
          }}
          style={styles.navButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#334155" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={styles.monthTitleBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar" size={16} color="#2563EB" style={{ marginRight: 7 }} />
          <Text style={styles.monthTitle}>
            {currentDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          <Ionicons name="chevron-down" size={15} color="#64748B" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const d = new Date(currentDate);
            d.setDate(d.getDate() + 1);
            setCurrentDate(d);
          }}
          style={styles.navButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-forward" size={20} color="#334155" />
        </TouchableOpacity>
      </View>

      {!isCurrentDateToday() && (
        <View style={styles.todayBar}>
          <TouchableOpacity
            onPress={() => setCurrentDate(new Date())}
            style={styles.todayBadge}
            activeOpacity={0.7}
          >
            <Ionicons name="today" size={13} color="#2563EB" style={{ marginRight: 4 }} />
            <Text style={styles.todayBadgeText}>Jump to Today</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadData()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={adminRecords}
          keyExtractor={item => item.employeeId + item.date}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#2563EB']} />
          }
          renderItem={({ item }) => {
            const st = getStatusDetails(item.status);
            return (
              <View style={[styles.adminCard, { borderLeftColor: st.color }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminEmpName}>{item.employeeName}</Text>
                  <Text style={styles.adminEmpId}>ID: {item.employeeId}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                  {(item.checkIn || item.checkOut) && (
                    <Text style={styles.adminTimeText}>
                      {formatTime(item.checkIn)} - {formatTime(item.checkOut)}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="documents-outline" size={44} color="#94A3B8" />
              <Text style={styles.emptyText}>No records for this date</Text>
            </View>
          }
        />
      )}
    </>
  );

  const renderGrid = () => {
    if (calendar.length === 0) return null;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calDayEmpty} />);
    }

    calendar.forEach((dayData, i) => {
      const dNum = i + 1;
      const st = getStatusDetails(dayData.status);
      const isMarked = dayData.status && dayData.status !== 'NOT_MARKED';

      days.push(
        <TouchableOpacity
          key={dNum}
          style={[
            styles.calDay,
            isMarked
              ? {
                  borderColor: st.color + '55',
                  backgroundColor: st.bg,
                }
              : styles.calDayUnmarked,
          ]}
          onPress={() => setSelectedDay(dayData)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.calDayNum,
              isMarked && { fontWeight: '700', color: '#0F172A' },
            ]}
          >
            {dNum}
          </Text>
          {isMarked && <View style={[styles.calDot, { backgroundColor: st.color }]} />}
        </TouchableOpacity>
      );
    });

    return (
      <View style={styles.calendarGrid}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <Text key={d} style={styles.calHeaderDay}>
            {d}
          </Text>
        ))}
        {days}
      </View>
    );
  };

  const renderModal = () => {
    if (!selectedDay) return null;
    const st = getStatusDetails(selectedDay.status);
    const dateFormatted = new Date(selectedDay.date).toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });

    return (
      <Modal visible={!!selectedDay} transparent animationType="fade" onRequestClose={() => setSelectedDay(null)}>
        <TouchableWithoutFeedback onPress={() => setSelectedDay(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalDate}>{dateFormatted}</Text>
                  <TouchableOpacity
                    onPress={() => setSelectedDay(null)}
                    style={styles.modalCloseBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.modalStatusBadge, { backgroundColor: st.bg }]}>
                  <Ionicons name={st.icon as any} size={18} color={st.color} />
                  <Text style={[styles.modalStatusText, { color: st.color }]}>{st.label}</Text>
                </View>

                {selectedDay.status === 'HOLIDAY' && (
                  <Text style={styles.modalInfoText}>Holiday: {selectedDay.holiday_name}</Text>
                )}

                {selectedDay.status === 'ON_LEAVE' && (
                  <Text style={styles.modalInfoText}>Leave: {selectedDay.leave_type}</Text>
                )}

                {selectedDay.status === 'SUNDAY' && (
                  <Text style={styles.modalInfoText}>Weekly Off (Sunday)</Text>
                )}

                {selectedDay.status === 'NOT_MARKED' && (
                  <Text style={styles.modalInfoText}>Regular working day (upcoming)</Text>
                )}

                {['PRESENT', 'HALF_DAY', 'CHECKOUT_MISSING', 'INSUFFICIENT_HOURS'].includes(selectedDay.status) && (
                  <View style={styles.modalDetailsRow}>
                    <View style={styles.modalDetailCol}>
                      <Text style={styles.modalLabel}>Check-in</Text>
                      <Text style={styles.modalVal}>{formatTime(selectedDay.check_in)}</Text>
                    </View>
                    <View style={styles.modalDetailCol}>
                      <Text style={styles.modalLabel}>Check-out</Text>
                      <Text style={styles.modalVal}>{formatTime(selectedDay.check_out)}</Text>
                    </View>
                    <View style={styles.modalDetailCol}>
                      <Text style={styles.modalLabel}>Working</Text>
                      <Text style={styles.modalVal}>{formatHours(selectedDay.working_minutes)}</Text>
                    </View>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  const renderMonthYearPickerModal = () => {
    if (!showPickerModal) return null;

    const currentYear = new Date().getFullYear();
    const availableYears = [];
    for (let y = currentYear - 3; y <= currentYear + 2; y++) {
      availableYears.push(y);
    }

    return (
      <Modal
        visible={showPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPickerModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPickerModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalCard, { maxWidth: 360, width: '92%', alignSelf: 'center', padding: 20 }]}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#0F172A' }}>Select Month & Year</Text>
                  <TouchableOpacity
                    onPress={() => setShowPickerModal(false)}
                    style={{ padding: 4 }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Year Navigation Bar */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#F8FAFC',
                    borderRadius: 12,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setPickerYear(prev => prev - 1)}
                    style={{ padding: 6, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1' }}
                  >
                    <Ionicons name="chevron-back" size={18} color="#334155" />
                  </TouchableOpacity>

                  <Text style={{ fontSize: 19, fontWeight: '800', color: '#0F172A' }}>{pickerYear}</Text>

                  <TouchableOpacity
                    onPress={() => setPickerYear(prev => prev + 1)}
                    style={{ padding: 6, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1' }}
                  >
                    <Ionicons name="chevron-forward" size={18} color="#334155" />
                  </TouchableOpacity>
                </View>

                {/* Quick Year Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
                  {availableYears.map(yr => {
                    const isSelected = yr === pickerYear;
                    return (
                      <TouchableOpacity
                        key={yr}
                        onPress={() => setPickerYear(yr)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 8,
                          backgroundColor: isSelected ? '#2563EB' : '#F1F5F9',
                          borderWidth: 1,
                          borderColor: isSelected ? '#2563EB' : '#CBD5E1',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: isSelected ? '#FFFFFF' : '#475569',
                          }}
                        >
                          {yr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Months Grid (3 columns x 4 rows) */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
                  {MONTH_NAMES.map((name, idx) => {
                    const isCurrent =
                      pickerYear === currentDate.getFullYear() && idx === currentDate.getMonth();
                    return (
                      <TouchableOpacity
                        key={name}
                        onPress={() => {
                          const updated = new Date(currentDate);
                          updated.setFullYear(pickerYear);
                          updated.setMonth(idx);
                          updated.setDate(1);
                          setCurrentDate(updated);
                          setShowPickerModal(false);
                        }}
                        style={{
                          width: '31%',
                          paddingVertical: 12,
                          borderRadius: 12,
                          alignItems: 'center',
                          backgroundColor: isCurrent ? '#2563EB' : '#F8FAFC',
                          borderWidth: 1.2,
                          borderColor: isCurrent ? '#2563EB' : '#E2E8F0',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: isCurrent ? '700' : '600',
                            color: isCurrent ? '#FFFFFF' : '#334155',
                          }}
                        >
                          {name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Quick Return to Current Month */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                  <TouchableOpacity
                    onPress={() => {
                      const todayDate = new Date();
                      setCurrentDate(todayDate);
                      setShowPickerModal(false);
                    }}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 8,
                      backgroundColor: '#EFF6FF',
                      borderWidth: 1,
                      borderColor: '#BFDBFE',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563EB' }}>This Month</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  const today = new Date();
  const isFutureMonth =
    currentDate.getFullYear() > today.getFullYear() ||
    (currentDate.getFullYear() === today.getFullYear() && currentDate.getMonth() > today.getMonth());

  const futureHolidaysCount = calendar.filter(d => d.status === 'HOLIDAY').length;
  const futureSundaysCount = calendar.filter(d => d.status === 'SUNDAY' || d.is_sunday).length;
  const futureLeavesCount = calendar.filter(d => d.status === 'ON_LEAVE' || d.status === 'HALF_DAY_LEAVE').length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Admin Toggle between My Attendance and All Staff */}
      {isAdmin && (
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, adminTab === 'my' && styles.segmentBtnActive]}
            onPress={() => setAdminTab('my')}
            activeOpacity={0.8}
          >
            <Ionicons name="person" size={14} color={adminTab === 'my' ? '#2563EB' : '#64748B'} style={{ marginRight: 6 }} />
            <Text style={[styles.segmentBtnText, adminTab === 'my' && styles.segmentBtnTextActive]}>
              My Attendance
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, adminTab === 'all' && styles.segmentBtnActive]}
            onPress={() => setAdminTab('all')}
            activeOpacity={0.8}
          >
            <Ionicons name="people" size={14} color={adminTab === 'all' ? '#2563EB' : '#64748B'} style={{ marginRight: 6 }} />
            <Text style={[styles.segmentBtnText, adminTab === 'all' && styles.segmentBtnTextActive]}>
              All Staff Records
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isAdmin && adminTab === 'all' ? (
        renderAdminAllStaff()
      ) : (
        <>
          {/* Month Selector Bar */}
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="#334155" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setPickerYear(currentDate.getFullYear());
                setShowPickerModal(true);
              }}
              style={styles.monthTitleBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.monthTitle}>
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#64748B" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNextMonth} style={styles.navButton} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color="#334155" />
            </TouchableOpacity>
          </View>

          {loading && !refreshing ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Loading attendance record...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => loadData()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#2563EB']} />
              }
            >
              {/* Executive Overview Card */}
              {isFutureMonth ? (
                <View style={styles.summaryCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                      <Ionicons name="calendar" size={18} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>Upcoming Month</Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>Company calendar & scheduled holidays</Text>
                    </View>
                  </View>

                  <View style={styles.chipsRow}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('HolidayList')}
                      style={[styles.statChip, { backgroundColor: '#CCFBF1', borderColor: '#99F6E4' }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipVal, { color: '#0F766E' }]}>{futureHolidaysCount}</Text>
                      <Text style={[styles.chipLabel, { color: '#0F766E' }]}>Holidays ›</Text>
                    </TouchableOpacity>

                    <View style={[styles.statChip, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}>
                      <Text style={[styles.chipVal, { color: '#334155' }]}>{futureSundaysCount}</Text>
                      <Text style={[styles.chipLabel, { color: '#475569' }]}>Sundays</Text>
                    </View>

                    <View style={[styles.statChip, { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }]}>
                      <Text style={[styles.chipVal, { color: '#1D4ED8' }]}>{futureLeavesCount}</Text>
                      <Text style={[styles.chipLabel, { color: '#1E40AF' }]}>Leaves</Text>
                    </View>
                  </View>
                </View>
              ) : summary ? (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryTopRow}>
                    <View style={styles.heroStatBox}>
                      <Text style={styles.heroStatNumber}>{summary.attendancePercentage}%</Text>
                      <Text style={styles.heroStatLabel}>Monthly Rate</Text>
                    </View>
                    <View style={styles.heroStatDivider} />
                    <View style={styles.heroStatBox}>
                      <Text style={styles.heroStatNumber}>{formatHours(summary.totalWorkingHours * 60)}</Text>
                      <Text style={styles.heroStatLabel}>Total Hours</Text>
                    </View>
                  </View>

                  <View style={styles.chipsRow}>
                    <View style={[styles.statChip, { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }]}>
                      <Text style={[styles.chipVal, { color: '#15803D' }]}>{summary.present}</Text>
                      <Text style={[styles.chipLabel, { color: '#166534' }]}>Present</Text>
                    </View>

                    <View style={[styles.statChip, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                      <Text style={[styles.chipVal, { color: '#B91C1C' }]}>{summary.absent}</Text>
                      <Text style={[styles.chipLabel, { color: '#991B1B' }]}>Absent</Text>
                    </View>

                    <View style={[styles.statChip, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                      <Text style={[styles.chipVal, { color: '#B45309' }]}>{summary.halfDays}</Text>
                      <Text style={[styles.chipLabel, { color: '#92400E' }]}>Half Day</Text>
                    </View>

                    <View style={[styles.statChip, { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }]}>
                      <Text style={[styles.chipVal, { color: '#1D4ED8' }]}>{summary.onLeave}</Text>
                      <Text style={[styles.chipLabel, { color: '#1E40AF' }]}>Leave</Text>
                    </View>

                    <View style={[styles.statChip, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}>
                      <Text style={[styles.chipVal, { color: '#334155' }]}>{summary.late}</Text>
                      <Text style={[styles.chipLabel, { color: '#475569' }]}>Late</Text>
                    </View>

                    {summary.checkoutMissing > 0 && (
                      <View style={[styles.statChip, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                        <Text style={[styles.chipVal, { color: '#C2410C' }]}>{summary.checkoutMissing}</Text>
                        <Text style={[styles.chipLabel, { color: '#EA580C' }]}>Missing Out</Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : null}

              {/* Calendar Card */}
              <View style={styles.calendarCard}>
                <Text style={styles.calendarTitle}>Daily Breakdown</Text>
                {renderGrid()}
              </View>

              <View style={{ height: 30 }} />
            </ScrollView>
          )}

          {renderModal()}
        </>
      )}
      {renderMonthYearPickerModal()}
      {showDatePicker && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event: any, selectedDate?: Date) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setCurrentDate(selectedDate);
            }
          }}
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  monthTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  todayBar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 15,
    marginBottom: 12,
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  heroStatBox: {
    alignItems: 'center',
  },
  heroStatNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: -0.5,
  },
  heroStatLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 6,
  },
  statChip: {
    flex: 1,
    minWidth: '18%',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipVal: {
    fontSize: 17,
    fontWeight: '800',
  },
  chipLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  calendarCard: {
    marginHorizontal: 16,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calHeaderDay: {
    width: '14.28%',
    textAlign: 'center',
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 12,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  calDayEmpty: {
    width: '14.28%',
    height: 46,
  },
  calDay: {
    width: '14.28%',
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: 'transparent',
    marginBottom: 5,
  },
  calDayUnmarked: {
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  calDayNum: {
    fontSize: 14.5,
    color: '#475569',
    fontWeight: '600',
  },
  calDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 2.75,
    marginTop: 2.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalDate: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  modalStatusText: {
    marginLeft: 8,
    fontWeight: '700',
    fontSize: 14,
  },
  modalInfoText: {
    fontSize: 15,
    color: '#334155',
    marginBottom: 16,
    fontWeight: '500',
  },
  modalDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  modalDetailCol: {
    alignItems: 'center',
  },
  modalLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  modalVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  adminCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  adminEmpName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  adminEmpId: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  adminTimeText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
});

