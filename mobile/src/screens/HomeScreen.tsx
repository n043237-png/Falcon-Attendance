import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import { CustomAlert as Alert } from '../components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { getCurrentLocation, getReadableAddress } from '../services/locationService';
import { getTodayAttendance, checkIn, checkOut, AttendanceRecord } from '../api/attendanceApi';
import { resolvePhotoUrl } from '../api/profileApi';
import {
  scheduleLocalShiftReminders,
  cancelLateMarkReminder,
  cancelShiftEndReminder,
} from '../services/pushNotificationService';
import { FullImageModal } from '../components/FullImageModal';

export default function HomeScreen() {
  const { user, token, logout, refreshUser } = useAuth();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [attendanceMode, setAttendanceMode] = useState<string>('Office');
  const [shiftInfo, setShiftInfo] = useState<{
    name?: string;
    startTime?: string;
    endTime?: string;
  } | null>(null);
  const [officeInfo, setOfficeInfo] = useState<{
    id?: number;
    name?: string;
    radiusMeters?: number;
  } | null>(null);
  const [homeImageError, setHomeImageError] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Real-time ticking clock for live hours calculation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  // Auto-resolve raw GPS coordinates to readable location name if needed
  useEffect(() => {
    if (!attendance?.checkInAddress) {
      setResolvedAddress(null);
      return;
    }
    const raw = attendance.checkInAddress.trim();
    const gpsMatch = raw.match(/^(?:GPS\s*\(\s*)?(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)?$/i);
    if (gpsMatch) {
      const lat = parseFloat(gpsMatch[1]);
      const lon = parseFloat(gpsMatch[2]);
      if (!isNaN(lat) && !isNaN(lon)) {
        getReadableAddress(lat, lon).then((name) => {
          if (name && !name.startsWith('GPS')) {
            setResolvedAddress(name);
          }
        }).catch(() => {});
      }
    } else {
      setResolvedAddress(null);
    }
  }, [attendance?.checkInAddress]);

  const hour = currentTime.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const loadAttendance = async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await getTodayAttendance(token);
      if (res.success && res.data?.attendance) {
        setAttendance(res.data.attendance);
      } else {
        setAttendance(null);
      }

      if (res.success && res.data?.attendanceMode) {
        setAttendanceMode(res.data.attendanceMode);
      } else if (res.success && res.data?.attendance?.attendanceMode) {
        setAttendanceMode(res.data.attendance.attendanceMode);
      } else if (user?.attendanceMode) {
        setAttendanceMode(user.attendanceMode);
      }

      if (res.success && res.data?.office) {
        setOfficeInfo(res.data.office);
      }

      const isCheckedIn = Boolean(res.data?.attendance?.checkIn);
      const isCheckedOut = Boolean(res.data?.attendance?.checkOut);

      if (isCheckedIn) {
        cancelLateMarkReminder();
      }
      if (isCheckedOut) {
        cancelShiftEndReminder();
      }

      const attStatus = res.data?.attendance?.status;
      const isHolidayOrSunday = attStatus === 'HOLIDAY' || attStatus === 'SUNDAY' || attStatus === 'ON_LEAVE' || new Date().getDay() === 0;

      if (isHolidayOrSunday) {
        cancelLateMarkReminder();
        cancelShiftEndReminder();
      } else if (res.success && res.data?.shift) {
        setShiftInfo(res.data.shift);
        scheduleLocalShiftReminders(
          res.data.shift.startTime,
          res.data.shift.endTime,
          res.data.shift.graceMinutes,
          res.data.shift.lateAfter,
          isCheckedIn,
          isCheckedOut
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAttendance();
      refreshUser?.();
      setHomeImageError(false);
    }, [token])
  );

  const effectiveMode = attendance?.attendanceMode || attendanceMode || user?.attendanceMode || 'Office';
  const isFieldMode = effectiveMode.toLowerCase() === 'field';

  const handleAction = async (action: 'check-in' | 'check-out') => {
    setActionLoading(true);
    try {
      const locData = await getCurrentLocation();

      let liveAddress: string | undefined;

      if (isFieldMode) {
        // Fetch live address via reverse geocoding
        try {
          liveAddress = await getReadableAddress(locData.latitude, locData.longitude);
        } catch (addrErr) {
          console.warn('Reverse geocoding error:', addrErr);
        }
      }

      const result =
        action === 'check-in'
          ? await checkIn(locData.latitude, locData.longitude, locData.accuracy, token!, liveAddress)
          : await checkOut(locData.latitude, locData.longitude, locData.accuracy, token!, liveAddress);

      if (result.success) {
        if (action === 'check-in') {
          cancelLateMarkReminder();
        } else {
          cancelShiftEndReminder();
        }
        const successMsg = isFieldMode && liveAddress
          ? (action === 'check-in' ? `Check-in marked successfully from ${liveAddress}!` : `Check-out marked successfully from ${liveAddress}!`)
          : (action === 'check-in' ? 'Attendance marked successfully!' : 'Checked out successfully!');
        Alert.alert('Success', successMsg);
        loadAttendance();
      } else {
        const configuredRadius = officeInfo?.radiusMeters || result.data?.allowedRadiusMeters || 20;
        const errorTitle = action === 'check-in' ? 'Check-In Verification' : 'Check-Out Verification';
        const serverError = (typeof result.error === 'string' ? result.error : result.error?.message) || result.message;
        const errorMsg = serverError || (
          result.data?.distanceMeters !== undefined
            ? `You are outside the permitted office location (${result.data.distanceMeters}m away). Attendance is only allowed within ${result.data.allowedRadiusMeters || configuredRadius} metres of the office.`
            : `Verification failed. Please ensure you are physically within the ${configuredRadius}-metre office radius.`
        );
        Alert.alert(errorTitle, errorMsg);
      }
    } catch (err: any) {
      Alert.alert(
        'Location Verification Failed',
        err.message || 'Unable to fetch your current GPS position. Please ensure location services and high-accuracy GPS are enabled.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return '--:--';
    }
  };

  const formatDuration = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0h 0m';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  };

  const formatTime12 = (timeStr?: string | null) => {
    if (!timeStr) return '';
    try {
      const parts = timeStr.split(':');
      if (parts.length < 2) return timeStr;
      let h = parseInt(parts[0], 10);
      const m = parts[1];
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      const hStr = h < 10 ? `0${h}` : `${h}`;
      return `${hStr}:${m} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const status = attendance?.status || 'NOT_MARKED';
  const hasCheckedIn = !!attendance?.checkIn;
  const hasCheckedOut = !!attendance?.checkOut;

  const getStatusBadge = () => {
    if (hasCheckedOut) {
      if (status === 'INSUFFICIENT_HOURS' || (attendance?.workingMinutes !== undefined && attendance.workingMinutes < 255)) {
        return { label: 'Insufficient Hours', color: '#DC2626', bg: '#FEE2E2', icon: 'alert-circle' as const };
      }
      if (status === 'HALF_DAY' || (attendance?.workingMinutes !== undefined && attendance.workingMinutes < 510)) {
        return { label: 'Half Day', color: '#B45309', bg: '#FEF3C7', icon: 'time' as const };
      }
      return { label: 'Completed', color: '#15803D', bg: '#DCFCE7', icon: 'checkmark-circle' as const };
    }
    if (hasCheckedIn) {
      return { label: 'Checked In', color: '#1D4ED8', bg: '#DBEAFE', icon: 'time' as const };
    }
    if (status === 'ABSENT') {
      return { label: 'Absent', color: '#B91C1C', bg: '#FEE2E2', icon: 'close-circle' as const };
    }
    if (status === 'HALF_DAY') {
      return { label: 'Half Day', color: '#B45309', bg: '#FEF3C7', icon: 'alert-circle' as const };
    }
    if (status === 'ON_LEAVE') {
      return { label: 'On Leave', color: '#1D4ED8', bg: '#EFF6FF', icon: 'airplane' as const };
    }
    if (status === 'SUNDAY' || status === 'HOLIDAY') {
      return { label: status === 'SUNDAY' ? 'Sunday' : 'Holiday', color: '#0F766E', bg: '#CCFBF1', icon: 'cafe' as const };
    }
    return { label: 'Not Marked', color: '#64748B', bg: '#F1F5F9', icon: 'ellipse-outline' as const };
  };

  const badge = getStatusBadge();
  const isWeekendOrHoliday = status === 'SUNDAY' || status === 'HOLIDAY';
  const showCompleted = status === 'ON_LEAVE' || isWeekendOrHoliday || hasCheckedOut;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const currentTimeFormatted = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  const getRealtimeWorkDuration = () => {
    if (!attendance?.checkIn) {
      return '0h 0m';
    }
    try {
      const checkInMs = new Date(attendance.checkIn).getTime();
      const endMs = attendance.checkOut
        ? new Date(attendance.checkOut).getTime()
        : currentTime.getTime();
      const diffMinutes = Math.max(0, Math.floor((endMs - checkInMs) / (1000 * 60)));
      return formatDuration(diffMinutes);
    } catch {
      return formatDuration(attendance?.workingMinutes || 0);
    }
  };

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAttendance(true)}
            colors={['#2563EB']}
          />
        }
      >
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <View style={styles.userRow}>
            {(() => {
              const photoUri = resolvePhotoUrl(user?.profilePhotoUrl || (user as any)?.profile_photo_url);
              if (photoUri && !homeImageError) {
                return (
                  <TouchableOpacity
                    style={styles.avatarRing}
                    activeOpacity={0.8}
                    onPress={() => setShowFullPhoto(true)}
                  >
                    <Image
                      key={photoUri}
                      source={{ uri: photoUri }}
                      style={styles.avatarPhoto}
                      onError={() => setHomeImageError(true)}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  style={styles.avatarRing}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('Profile')}
                >
                  <Text style={styles.avatarLetter}>
                    {user?.name?.charAt(0).toUpperCase() || (isAdmin ? 'A' : 'E')}
                  </Text>
                </TouchableOpacity>
              );
            })()}
            <View>
              <Text style={styles.greetingText}>{greeting},</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.userNameText}>{user?.name || (isAdmin ? 'Administrator' : 'Employee')}</Text>
                {isAdmin && (
                  <View style={{ marginLeft: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563EB' }}>ADMIN</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={20} color="#334155" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconButton, { marginLeft: 8 }]} onPress={logout} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Quick Console Bar */}
        {isAdmin && (
          <View style={styles.adminBanner}>
            <View style={styles.adminBannerLeft}>
              <Ionicons name="shield-checkmark" size={16} color="#2563EB" />
              <Text style={styles.adminBannerText}>Admin Attendance Enabled</Text>
            </View>
            <TouchableOpacity
              style={styles.adminBannerBtn}
              onPress={() => navigation.navigate('Admin')}
              activeOpacity={0.8}
            >
              <Text style={styles.adminBannerBtnText}>Admin Console</Text>
              <Ionicons name="chevron-forward" size={12} color="#FFFFFF" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        )}

        {/* Date & Shift Pill Banner */}
        <View style={styles.bannerRow}>
          <View style={styles.datePill}>
            <Ionicons name="calendar-outline" size={14} color="#2563EB" />
            <Text style={styles.datePillText}>{todayFormatted}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon} size={13} color={badge.color} style={{ marginRight: 4 }} />
            <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Hero Interactive Attendance Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroClockRow}>
            <View>
              <Text style={styles.heroClockTime}>{currentTimeFormatted}</Text>
              <Text style={styles.heroClockLabel}>
                Office Hours: {shiftInfo?.startTime && shiftInfo?.endTime
                  ? `${formatTime12(shiftInfo.startTime)} - ${formatTime12(shiftInfo.endTime)}`
                  : '09:30 AM - 06:30 PM'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={styles.gpsIndicator}>
                <View style={styles.gpsDot} />
                <Text style={styles.gpsText}>GPS Active</Text>
              </View>
              {isFieldMode ? (
                <View style={[styles.geoFenceBadge, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                  <Ionicons name="navigate-circle" size={11} color="#D97706" />
                  <Text style={[styles.geoFenceBadgeText, { color: '#B45309' }]}>📍 Field Mode</Text>
                </View>
              ) : (
                <View style={styles.geoFenceBadge}>
                  <Ionicons name="navigate-outline" size={10} color="#1D4ED8" />
                  <Text style={styles.geoFenceBadgeText}>{officeInfo?.radiusMeters || 20}m Radius</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.heroDivider} />

          {/* Action Button or Completed Card */}
          {loading && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Syncing status...</Text>
            </View>
          ) : showCompleted ? (
            <View style={styles.completedContainer}>
              <View style={[styles.completedIconCircle, { backgroundColor: badge.bg }]}>
                <Ionicons name={badge.icon} size={36} color={badge.color} />
              </View>
              <Text style={[styles.completedTitle, { color: badge.color }]}>
                {hasCheckedOut
                  ? (status === 'INSUFFICIENT_HOURS' || (attendance?.workingMinutes !== undefined && attendance.workingMinutes < 255)
                    ? 'Insufficient Hours'
                    : (status === 'HALF_DAY' || (attendance?.workingMinutes !== undefined && attendance.workingMinutes < 510)
                      ? 'Half Day Complete'
                      : 'Day Complete'))
                  : badge.label}
              </Text>
              <Text style={styles.completedSubtitle}>
                {hasCheckedOut
                  ? (status === 'INSUFFICIENT_HOURS' || (attendance?.workingMinutes !== undefined && attendance.workingMinutes < 255)
                    ? `You checked out at ${formatTime(attendance?.checkOut || null)} (${formatDuration(attendance?.workingMinutes || 0)}). Less than the minimum half day requirement (4h 15m).`
                    : (status === 'HALF_DAY' || (attendance?.workingMinutes !== undefined && attendance.workingMinutes < 510)
                      ? `You checked out at ${formatTime(attendance?.checkOut || null)} (${formatDuration(attendance?.workingMinutes || 0)}). Half Day marked (Required for Full Day: 8h 30m).`
                      : `You checked out at ${formatTime(attendance?.checkOut || null)}. Great work today!`))
                  : status === 'ON_LEAVE'
                  ? `Approved Leave: ${attendance?.leaveType || 'Annual Leave'}`
                  : status === 'HOLIDAY'
                  ? `Public Holiday: ${attendance?.holidayName || 'Holiday'}`
                  : 'Enjoy your restful Sunday off!'}
              </Text>
            </View>
          ) : (
            <View style={styles.actionSection}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.punchButton,
                  hasCheckedIn ? styles.punchCheckoutBtn : styles.punchCheckinBtn,
                  actionLoading && styles.btnDisabled,
                ]}
                onPress={() => handleAction(!hasCheckedIn ? 'check-in' : 'check-out')}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="large" color="#FFFFFF" />
                ) : (
                  <>
                    <View style={styles.punchIconCircle}>
                      <Ionicons
                        name={!hasCheckedIn ? 'finger-print' : 'log-out'}
                        size={32}
                        color={!hasCheckedIn ? '#2563EB' : '#DC2626'}
                      />
                    </View>
                    <Text style={styles.punchButtonTitle}>
                      {!hasCheckedIn ? 'PUNCH IN' : 'PUNCH OUT'}
                    </Text>
                    <Text style={styles.punchButtonSubtitle}>
                      {!hasCheckedIn ? 'Tap to mark your arrival' : 'Tap to end your workday'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {attendance?.isLate && !hasCheckedIn && (
                <View style={styles.lateNotice}>
                  <Ionicons name="warning-outline" size={14} color="#B45309" />
                  <Text style={styles.lateNoticeText}>
                    You are checking in past the morning cutoff time.
                  </Text>
                </View>
              )}

              {isFieldMode ? (
                <View style={styles.fieldModeFootnoteBox}>
                  <Ionicons name="navigate-outline" size={15} color="#D97706" style={{ marginRight: 6 }} />
                  <Text style={styles.fieldModeFootnoteText}>
                    Field Mode Active: Punch from any location with live GPS & address verification.
                  </Text>
                </View>
              ) : (
                <Text style={styles.geoFenceFootnote}>
                  📍 Attendance permitted within {officeInfo?.radiusMeters || 20} metres of {officeInfo?.name || 'Falcon office'}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Attendance Metrics Grid (Web-style cards) */}
        <Text style={styles.sectionHeader}>Today's Overview</Text>
        <View style={styles.metricsGrid}>
          {/* Check In */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="log-in-outline" size={18} color="#2563EB" />
            </View>
            <Text style={styles.metricLabel}>CHECK-IN</Text>
            <Text style={styles.metricValue}>{formatTime(attendance?.checkIn || null)}</Text>
            {attendance?.isLate ? (
              <Text style={styles.lateBadge}>Late</Text>
            ) : attendance?.checkIn ? (
              <Text style={styles.onTimeBadge}>On Time</Text>
            ) : null}
          </View>

          {/* Check Out */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#FDF2F8' }]}>
              <Ionicons name="log-out-outline" size={18} color="#DB2777" />
            </View>
            <Text style={styles.metricLabel}>CHECK-OUT</Text>
            <Text style={styles.metricValue}>{formatTime(attendance?.checkOut || null)}</Text>
            <Text style={styles.metricSubtext}>{hasCheckedOut ? 'Recorded' : 'Pending'}</Text>
          </View>

          {/* Working Hours */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="hourglass-outline" size={18} color="#059669" />
            </View>
            <Text style={styles.metricLabel}>WORK DURATION</Text>
            <Text style={styles.metricValue}>{getRealtimeWorkDuration()}</Text>
            <Text style={styles.metricSubtext}>
              {hasCheckedIn && !hasCheckedOut ? 'Live • Target: 8h 30m' : 'Target: 8h 30m'}
            </Text>
          </View>

          {/* Shift Status */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="briefcase-outline" size={18} color="#D97706" />
            </View>
            <Text style={styles.metricLabel}>SHIFT STATUS</Text>
            <Text style={[styles.metricValue, { fontSize: 15 }]}>{badge.label}</Text>
            <Text style={styles.metricSubtext}>{shiftInfo?.name || 'Day Shift'}</Text>
          </View>
        </View>

        {/* Recorded Field Location Card */}
        {attendance?.checkInAddress && (
          <View style={styles.locationBannerCard}>
            <View style={styles.locationBannerHeader}>
              <Ionicons name="location" size={16} color="#2563EB" />
              <Text style={styles.locationBannerTitle}>Recorded Punch-In Location</Text>
              <View style={styles.fieldModeTag}>
                <Text style={styles.fieldModeTagText}>{attendance.attendanceMode || 'Field'}</Text>
              </View>
            </View>
            <Text style={styles.locationBannerAddress}>
              {resolvedAddress || attendance.checkInAddress}
            </Text>
            {Boolean(resolvedAddress && resolvedAddress !== attendance.checkInAddress) && (
              <Text style={styles.locationBannerGpsSubtext}>{attendance.checkInAddress}</Text>
            )}
          </View>
        )}

        {/* Quick Navigation Cards */}
        <Text style={styles.sectionHeader}>Quick Services</Text>
        <View style={styles.servicesRow}>
          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => navigation.navigate('Leave')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="calendar-clear" size={22} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceTitle}>Leave Requests</Text>
              <Text style={styles.serviceDesc}>Apply for leaves & track balances</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => navigation.navigate('History')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="calendar" size={22} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceTitle}>Monthly History</Text>
              <Text style={styles.serviceDesc}>View attendance calendar & hours</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => navigation.navigate('HolidayList')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#CCFBF1' }]}>
              <Ionicons name="calendar-outline" size={22} color="#0F766E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceTitle}>Company Holidays</Text>
              <Text style={styles.serviceDesc}>Official calendar & holiday schedule</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <View style={[styles.serviceIconCircle, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="person" size={22} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceTitle}>Employee Profile</Text>
              <Text style={styles.serviceDesc}>Designation, ID & credentials</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Full Screen Image Preview Modal */}
      <FullImageModal
        visible={showFullPhoto}
        onClose={() => setShowFullPhoto(false)}
        imageUrl={resolvePhotoUrl(user?.profilePhotoUrl || (user as any)?.profile_photo_url)}
        name={user?.name || (isAdmin ? 'Admin User' : 'Employee')}
        subtitle={`${user?.employeeId || (user as any)?.employee_code || ''}${isAdmin ? ' • Administrator' : ''}`}
        onEditPhoto={() => navigation.navigate('Profile')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 20) : 0,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#BFDBFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
    overflow: 'hidden',
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  greetingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  datePillText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 24,
  },
  heroClockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroClockTime: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  heroClockLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  gpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 5,
  },
  gpsText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
  },
  geoFenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  geoFenceBadgeText: {
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '700',
    marginLeft: 3,
  },
  geoFenceFootnote: {
    textAlign: 'center',
    fontSize: 11,
    color: '#64748B',
    marginTop: 10,
    fontWeight: '500',
  },
  fieldModeFootnoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  fieldModeFootnoteText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 16,
  },
  locationBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  locationBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 6,
    flex: 1,
  },
  fieldModeTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  fieldModeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  locationBannerAddress: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
    fontWeight: '600',
  },
  locationBannerGpsSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 18,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  completedContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  completedIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  completedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  completedSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  actionSection: {
    alignItems: 'center',
  },
  punchButton: {
    width: '100%',
    paddingVertical: 20,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  punchCheckinBtn: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
  },
  punchCheckoutBtn: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  punchIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  punchButtonTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  punchButtonSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    marginTop: 2,
  },
  lateNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  lateNoticeText: {
    marginLeft: 6,
    color: '#B45309',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  metricSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  lateBadge: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
    marginTop: 2,
  },
  onTimeBadge: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
    marginTop: 2,
  },
  servicesRow: {
    gap: 10,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  serviceIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  serviceDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  adminBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  adminBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1D4ED8',
    marginLeft: 6,
  },
  adminBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  adminBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
});

