import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getHolidays, HolidayItem } from '../api/holidayApi';

export default function HolidayListScreen() {
  const navigation = useNavigation();
  const { token } = useAuth();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UPCOMING' | 'PAST'>('ALL');
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHolidays = async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getHolidays(token, selectedYear);
      if (res.success && res.data) {
        setHolidays(res.data);
      } else {
        setError(res.error?.message || 'Failed to load holidays');
      }
    } catch {
      setError('Unable to fetch holiday calendar');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [token, selectedYear]);

  const upcomingCount = holidays.filter((h) => h.isUpcoming).length;
  const pastCount = holidays.filter((h) => h.isPast).length;
  const nextHoliday = holidays.find((h) => h.isUpcoming);

  const filteredHolidays = useMemo(() => {
    if (filterTab === 'UPCOMING') return holidays.filter((h) => h.isUpcoming);
    if (filterTab === 'PAST') return holidays.filter((h) => h.isPast);
    return holidays;
  }, [holidays, filterTab]);

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00+05:30');
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return dateStr;
    }
  };

  const getMonthAbbr = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00+05:30');
      return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase();
    } catch {
      return '';
    }
  };

  const getDayNum = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      return parts[2] || '';
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Company Holidays</Text>
          <Text style={styles.headerSubtitle}>Official corporate calendar</Text>
        </View>

        {/* Year Selector Pills */}
        <View style={styles.yearPillsWrap}>
          {[currentYear - 1, currentYear, currentYear + 1].map((yr) => {
            const isSelected = selectedYear === yr;
            return (
              <TouchableOpacity
                key={yr}
                onPress={() => setSelectedYear(yr)}
                style={[styles.yearPill, isSelected && styles.yearPillActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.yearPillText, isSelected && styles.yearPillTextActive]}>
                  {yr}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading company holiday list...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={42} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadHolidays()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredHolidays}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadHolidays(true)}
              colors={['#2563EB']}
            />
          }
          ListHeaderComponent={
            <>
              {/* Next Holiday Spotlight Card */}
              {nextHoliday ? (
                <View style={styles.spotlightCard}>
                  <View style={styles.spotlightTopRow}>
                    <View style={styles.spotlightBadge}>
                      <Ionicons name="sparkles" size={13} color="#2563EB" />
                      <Text style={styles.spotlightBadgeText}>NEXT UPCOMING HOLIDAY</Text>
                    </View>
                    <Text style={styles.spotlightCountdown}>
                      {nextHoliday.isToday
                        ? 'Today 🎉'
                        : nextHoliday.daysAway === 1
                        ? 'Tomorrow'
                        : `In ${nextHoliday.daysAway} days`}
                    </Text>
                  </View>

                  <Text style={styles.spotlightName}>{nextHoliday.name}</Text>
                  <Text style={styles.spotlightDate}>
                    {formatDateDisplay(nextHoliday.holidayDate)} &bull; {nextHoliday.day}
                  </Text>
                  {nextHoliday.description ? (
                    <Text style={styles.spotlightDesc} numberOfLines={2}>
                      {nextHoliday.description}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Filter Tabs */}
              <View style={styles.filterRow}>
                {[
                  { id: 'ALL', label: 'All', count: holidays.length },
                  { id: 'UPCOMING', label: 'Upcoming', count: upcomingCount },
                  { id: 'PAST', label: 'Past', count: pastCount },
                ].map((tab) => {
                  const isActive = filterTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={() => setFilterTab(tab.id as any)}
                      style={[styles.filterChip, isActive && styles.filterChipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filterChipLabel, isActive && styles.filterChipLabelActive]}>
                        {tab.label}
                      </Text>
                      <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                        <Text style={[styles.filterBadgeNum, isActive && styles.filterBadgeNumActive]}>
                          {tab.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionHeading}>
                {filterTab === 'UPCOMING'
                  ? 'Upcoming Holidays'
                  : filterTab === 'PAST'
                  ? 'Past Holidays'
                  : `All Holidays (${selectedYear})`}
              </Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={44} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Holidays Found</Text>
              <Text style={styles.emptySubtitle}>
                {filterTab === 'UPCOMING'
                  ? `No upcoming holidays remaining in ${selectedYear}.`
                  : filterTab === 'PAST'
                  ? `No past holidays recorded yet in ${selectedYear}.`
                  : `No holidays configured for ${selectedYear}.`}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            return (
              <View style={[styles.holidayCard, item.isPast && styles.holidayCardPast]}>
                {/* Date Tile */}
                <View
                  style={[
                    styles.dateBox,
                    item.isToday
                      ? styles.dateBoxToday
                      : item.isUpcoming
                      ? styles.dateBoxUpcoming
                      : styles.dateBoxPast,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateMonth,
                      item.isToday
                        ? styles.dateMonthToday
                        : item.isUpcoming
                        ? styles.dateMonthUpcoming
                        : styles.dateMonthPast,
                    ]}
                  >
                    {getMonthAbbr(item.holidayDate)}
                  </Text>
                  <Text
                    style={[
                      styles.dateDay,
                      item.isToday
                        ? styles.dateDayToday
                        : item.isUpcoming
                        ? styles.dateDayUpcoming
                        : styles.dateDayPast,
                    ]}
                  >
                    {getDayNum(item.holidayDate)}
                  </Text>
                </View>

                {/* Holiday Info */}
                <View style={styles.holidayInfo}>
                  <View style={styles.holidayNameRow}>
                    <Text style={[styles.holidayName, item.isPast && styles.holidayNamePast]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.isToday ? (
                      <View style={styles.todayPill}>
                        <Text style={styles.todayPillText}>Today</Text>
                      </View>
                    ) : item.isUpcoming ? (
                      <View style={styles.upcomingPill}>
                        <Text style={styles.upcomingPillText}>
                          {item.daysAway === 1 ? 'Tomorrow' : `In ${item.daysAway}d`}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.pastPill}>
                        <Text style={styles.pastPillText}>Past</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.holidayDayText}>{item.day}</Text>

                  {item.description ? (
                    <Text style={styles.holidayDescText} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  yearPillsWrap: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  yearPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  yearPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  yearPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  yearPillTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  spotlightCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  spotlightTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  spotlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spotlightBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  spotlightCountdown: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  spotlightName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  spotlightDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 4,
  },
  spotlightDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterChipLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterBadgeNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterBadgeNumActive: {
    color: '#FFFFFF',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
    marginTop: 4,
  },
  holidayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  holidayCardPast: {
    backgroundColor: '#FAFAFC',
    borderColor: '#EEF2F6',
    opacity: 0.78,
  },
  dateBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dateBoxToday: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1.2,
    borderColor: '#86EFAC',
  },
  dateBoxUpcoming: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.2,
    borderColor: '#BFDBFE',
  },
  dateBoxPast: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
  },
  dateMonth: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    lineHeight: 11,
  },
  dateMonthToday: { color: '#15803D' },
  dateMonthUpcoming: { color: '#2563EB' },
  dateMonthPast: { color: '#64748B' },
  dateDay: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 2,
  },
  dateDayToday: { color: '#15803D' },
  dateDayUpcoming: { color: '#0F172A' },
  dateDayPast: { color: '#64748B' },
  holidayInfo: {
    flex: 1,
  },
  holidayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  holidayName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 8,
  },
  holidayNamePast: {
    color: '#475569',
  },
  todayPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  todayPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#15803D',
  },
  upcomingPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  upcomingPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2563EB',
  },
  pastPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pastPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  holidayDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 3,
  },
  holidayDescText: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 15,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13.5,
    color: '#64748B',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
});
