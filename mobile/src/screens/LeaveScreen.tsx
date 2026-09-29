import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import {
  getLeaveBalances,
  getLeaveHistory,
  applyLeave,
  cancelLeaveRequest,
  validateLeave,
  getAdminLeaves,
  approveLeaveRequest,
  rejectLeaveRequest,
  LeaveBalance,
  LeaveRequest,
  LeaveValidationData,
} from '../api/leaveApi';

export default function LeaveScreen() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.roles?.includes('admin');

  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [history, setHistory] = useState<LeaveRequest[]>([]);
  const [adminLeaves, setAdminLeaves] = useState<LeaveRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL_REQUESTS' | 'MY_REQUESTS'>(isAdmin ? 'ALL_REQUESTS' : 'MY_REQUESTS');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [validation, setValidation] = useState<LeaveValidationData | null>(null);
  const [validating, setValidating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // Form states
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const promises: Promise<any>[] = [
        getLeaveBalances(token),
        getLeaveHistory(token, 1),
      ];
      if (isAdmin) {
        promises.push(getAdminLeaves(token));
      }

      const results = await Promise.all(promises);
      const balRes = results[0];
      const histRes = results[1];
      const adminRes = isAdmin ? results[2] : null;

      if (balRes?.success) setBalance(balRes.data);
      if (histRes?.success && histRes.data?.items) setHistory(histRes.data.items);
      if (adminRes?.success && adminRes.data?.items) {
        setAdminLeaves(adminRes.data.items);
      }
    } catch (e) {
      console.error('fetchData error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDateYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (d: Date) => {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Run Smart Leave Validation
  const runValidation = useCallback(async (start: Date, end: Date) => {
    if (!token) return;
    const sStr = formatDateYMD(start);
    const eStr = formatDateYMD(end);
    if (start > end) {
      setValidation(null);
      return;
    }
    setValidating(true);
    try {
      const res = await validateLeave(token, { startDate: sStr, endDate: eStr });
      if (res.success && res.data) {
        setValidation(res.data);
      } else {
        setValidation(null);
      }
    } catch (err) {
      console.warn('Smart leave validation error:', err);
      setValidation(null);
    } finally {
      setValidating(false);
    }
  }, [token]);

  useEffect(() => {
    if (showApplyModal && token) {
      runValidation(startDate, endDate);
    }
  }, [showApplyModal, startDate, endDate, token, runValidation]);

  // Calculate fallback requested days if validation is not available
  const calculateDays = (start: Date, end: Date) => {
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (s > e) return 0;
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const requestedDays = validation ? validation.totalDays : calculateDays(startDate, endDate);
  const availableBalance = balance?.currentBalance ?? 0;
  const isLwpRequired = validation ? validation.isLwpRequired : requestedDays > availableBalance;
  const lwpDays = validation ? validation.lwpDays : (isLwpRequired ? requestedDays - availableBalance : 0);

  const handleApply = async () => {
    if (!token) return;

    if (reason.trim().length < 3) {
      Alert.alert('Reason Required', 'Please enter a valid reason (at least 3 characters).');
      return;
    }

    if (startDate > endDate) {
      Alert.alert('Invalid Dates', 'Start date must be on or before end date.');
      return;
    }

    // Overlap validation check
    if (validation && (validation.hasApprovedOverlap || !validation.canSubmit)) {
      Alert.alert(
        'Submission Blocked',
        validation.blockReason || 'You already have approved leave on these dates.'
      );
      return;
    }

    // Show Impact Analysis Confirmation Dialog
    if (validation) {
      setShowImpactModal(true);
    } else if (isLwpRequired) {
      Alert.alert(
        'Leave Without Pay Notice',
        `You have ${availableBalance} paid days available. ${lwpDays} day(s) will be submitted as Leave Without Pay. Do you wish to proceed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed', onPress: () => submitLeave() },
        ]
      );
    } else {
      submitLeave();
    }
  };

  const submitLeave = async () => {
    if (!token) return;
    setApplying(true);
    try {
      const res = await applyLeave(token, {
        startDate: formatDateYMD(startDate),
        endDate: formatDateYMD(endDate),
        reason: reason.trim(),
      });

      if (res.success) {
        Alert.alert('Success 🎉', 'Your leave request has been submitted successfully.');
        setShowApplyModal(false);
        setReason('');
        setStartDate(new Date());
        setEndDate(new Date());
        fetchData(true);
      } else {
        Alert.alert('Submission Failed', res.error?.message || 'Failed to submit leave request.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An unexpected error occurred.');
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = (id: number) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this leave application?', [
      { text: 'Keep Request', style: 'cancel' },
      {
        text: 'Cancel Request',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          const res = await cancelLeaveRequest(token, id);
          if (res.success) {
            Alert.alert('Cancelled', 'Leave request cancelled.');
            fetchData(true);
          } else {
            Alert.alert('Error', res.error?.message || 'Failed to cancel request.');
          }
        },
      },
    ]);
  };

  const handleApproveLeave = (id: number, name?: string) => {
    Alert.alert(
      'Approve Leave',
      `Are you sure you want to approve leave for ${name || 'this employee'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            if (!token) return;
            setActionLoading(id);
            try {
              const res = await approveLeaveRequest(token, id);
              if (res.success) {
                Alert.alert('Approved', 'Leave request approved successfully.');
                fetchData(true);
              } else {
                Alert.alert('Error', res.error?.message || 'Failed to approve leave.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Error approving leave.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleRejectLeave = (id: number, name?: string) => {
    Alert.alert(
      'Reject Leave',
      `Are you sure you want to reject leave for ${name || 'this employee'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            setActionLoading(id);
            try {
              const res = await rejectLeaveRequest(token, id);
              if (res.success) {
                Alert.alert('Rejected', 'Leave request rejected.');
                fetchData(true);
              } else {
                Alert.alert('Error', res.error?.message || 'Failed to reject leave.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Error rejecting leave.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const currentList = (isAdmin && activeTab === 'ALL_REQUESTS') ? adminLeaves : history;

  const filteredHistory = currentList.filter((item) => {
    if (statusFilter === 'ALL') return true;
    return item.status?.toUpperCase() === statusFilter;
  });

  const getStatusBadgeStyle = (statusStr: string) => {
    switch (statusStr?.toUpperCase()) {
      case 'APPROVED':
        return { bg: '#DCFCE7', text: '#15803D', icon: 'checkmark-circle' as const, label: 'Approved' };
      case 'PENDING':
        return { bg: '#FEF3C7', text: '#B45309', icon: 'time' as const, label: 'Pending' };
      case 'REJECTED':
        return { bg: '#FEE2E2', text: '#B91C1C', icon: 'close-circle' as const, label: 'Rejected' };
      default:
        return { bg: '#F1F5F9', text: '#64748B', icon: 'help-circle' as const, label: statusStr || 'Unknown' };
    }
  };

  const renderHistoryItem = ({ item }: { item: LeaveRequest }) => {
    const badge = getStatusBadgeStyle(item.status);
    const startStr = item.startDate ? new Date(item.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const endStr = item.endDate ? new Date(item.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const applicantName = item.employeeName || (activeTab === 'MY_REQUESTS' ? `${user?.name} (You)` : 'Employee');
    const applicantCode = item.employeeId || (activeTab === 'MY_REQUESTS' ? (user?.employee_id || user?.employeeId) : '');
    const firstLetter = (applicantName || 'E').replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase() || 'E';

    return (
      <View style={styles.historyCard}>
        {/* Applicant Header: Name, Employee ID, Status Badge */}
        <View style={styles.applicantRow}>
          <View style={styles.applicantAvatarWrap}>
            <Text style={styles.applicantAvatarText}>{firstLetter}</Text>
          </View>
          <View style={styles.applicantInfo}>
            <Text style={styles.applicantName} numberOfLines={1}>{applicantName}</Text>
            {!!applicantCode && <Text style={styles.applicantId}>{applicantCode}</Text>}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon} size={12} color={badge.text} style={{ marginRight: 4 }} />
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Leave Type Tag & Duration */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.leaveTypeTag}>
            <Ionicons
              name={item.leaveType?.toLowerCase().includes('without') ? 'remove-circle-outline' : 'shield-checkmark-outline'}
              size={13}
              color="#2563EB"
            />
            <Text style={styles.leaveTypeTagText}>{item.leaveType || 'Leave'}</Text>
          </View>

          <View style={styles.daysPill}>
            <Text style={styles.daysPillText}>
              {item.totalDays} {item.totalDays === 1 ? 'day' : 'days'}
            </Text>
          </View>
        </View>

        {/* Date Range */}
        <View style={styles.cardDatesRow}>
          <Ionicons name="calendar-outline" size={15} color="#475569" style={{ marginRight: 6 }} />
          <Text style={styles.cardDatesText}>
            {startStr} {startStr !== endStr && `— ${endStr}`}
          </Text>
        </View>

        {/* Reason Box */}
        {!!item.reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonText} numberOfLines={3}>
              "{item.reason}"
            </Text>
          </View>
        )}

        {/* Reviewer & Decision Details */}
        {(!!item.reviewerName || !!item.adminComment) && (
          <View
            style={[
              styles.reviewerBox,
              item.status?.toUpperCase() === 'REJECTED'
                ? styles.reviewerBoxRejected
                : styles.reviewerBoxApproved,
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <Ionicons
                name={
                  item.status?.toUpperCase() === 'REJECTED'
                    ? 'close-circle-outline'
                    : 'checkmark-circle-outline'
                }
                size={14}
                color={item.status?.toUpperCase() === 'REJECTED' ? '#DC2626' : '#16A34A'}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.reviewerTitle,
                  {
                    color: item.status?.toUpperCase() === 'REJECTED' ? '#DC2626' : '#16A34A',
                  },
                ]}
              >
                {item.status?.toUpperCase() === 'REJECTED' ? 'Rejected by ' : 'Approved by '}
                <Text style={{ fontWeight: '700' }}>{item.reviewerName || 'Admin'}</Text>
              </Text>
            </View>
            {!!item.adminComment && (
              <Text style={styles.reviewerRemarks}>
                Remarks: "{item.adminComment}"
              </Text>
            )}
          </View>
        )}

        {/* Action row: Approve / Reject for Admin on pending, or Cancel for Employee on pending */}
        {isAdmin && activeTab === 'ALL_REQUESTS' && item.status?.toUpperCase() === 'PENDING' ? (
          <View style={styles.adminActionRow}>
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => handleApproveLeave(item.id, item.employeeName)}
              disabled={actionLoading === item.id}
              activeOpacity={0.8}
            >
              {actionLoading === item.id ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.approveButtonText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleRejectLeave(item.id, item.employeeName)}
              disabled={actionLoading === item.id}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        ) : (
          item.status?.toUpperCase() === 'PENDING' && (
            <View style={styles.cardFooterRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => handleCancel(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                <Text style={styles.cancelButtonText}>Withdraw Request</Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Top Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.headerTitle}>Leave Portal</Text>
          <Text style={styles.headerSubtitle}>Apply for time-off and track request status</Text>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading leave balances...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              colors={['#2563EB']}
            />
          }
          ListHeaderComponent={
            <>
              {/* Admin Segmented Control: All Requests vs My Applications */}
              {isAdmin && (
                <View style={styles.segmentedContainer}>
                  <TouchableOpacity
                    style={[styles.segmentedBtn, activeTab === 'ALL_REQUESTS' && styles.segmentedBtnActive]}
                    onPress={() => setActiveTab('ALL_REQUESTS')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="people"
                      size={16}
                      color={activeTab === 'ALL_REQUESTS' ? '#FFFFFF' : '#64748B'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.segmentedText,
                        activeTab === 'ALL_REQUESTS' && styles.segmentedTextActive,
                      ]}
                    >
                      All Requests
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.segmentedBtn, activeTab === 'MY_REQUESTS' && styles.segmentedBtnActive]}
                    onPress={() => setActiveTab('MY_REQUESTS')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="person"
                      size={16}
                      color={activeTab === 'MY_REQUESTS' ? '#FFFFFF' : '#64748B'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.segmentedText,
                        activeTab === 'MY_REQUESTS' && styles.segmentedTextActive,
                      ]}
                    >
                      My Applications
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Balances Overview Card (Shown for employees, or admin under My Applications) */}
              {(!isAdmin || activeTab === 'MY_REQUESTS') && (
                <View style={styles.balanceSummaryCard}>
                  <View style={styles.balanceMainRow}>
                    <View>
                      <Text style={styles.balanceCardLabel}>AVAILABLE PAID BALANCE</Text>
                      <View style={styles.balanceNumberRow}>
                        <Text style={styles.balanceBigNumber}>
                          {balance?.currentBalance ?? 0}
                        </Text>
                        <Text style={styles.balanceUnit}>Days</Text>
                      </View>
                    </View>
                    <View style={styles.balanceIconWrap}>
                      <Ionicons name="calendar" size={26} color="#2563EB" />
                    </View>
                  </View>

                  <View style={styles.balanceGrid}>
                    <View style={styles.balanceGridItem}>
                      <Text style={styles.gridLabel}>Accrued</Text>
                      <Text style={styles.gridValue}>{balance?.accruedLeave ?? 0}d</Text>
                    </View>
                    <View style={styles.balanceGridDivider} />
                    <View style={styles.balanceGridItem}>
                      <Text style={styles.gridLabel}>Used Paid</Text>
                      <Text style={styles.gridValue}>{balance?.usedPaidLeave ?? 0}d</Text>
                    </View>
                    <View style={styles.balanceGridDivider} />
                    <View style={styles.balanceGridItem}>
                      <Text style={styles.gridLabel}>Without Pay</Text>
                      <Text style={[styles.gridValue, { color: '#DC2626' }]}>
                        {balance?.leaveWithoutPay ?? 0}d
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Primary Action Button */}
              {(!isAdmin || activeTab === 'MY_REQUESTS') && (
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={() => setShowApplyModal(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.applyButtonText}>Apply for Leave</Text>
                </TouchableOpacity>
              )}

              {/* Filter Tabs Header */}
              <View style={styles.historySectionHeader}>
                <Text style={styles.sectionTitle}>
                  {isAdmin && activeTab === 'ALL_REQUESTS' ? 'All Employee Requests' : 'Leave History'}
                </Text>
                {isAdmin && activeTab === 'ALL_REQUESTS' && (
                  <Text style={styles.sectionSubtitle}>
                    {adminLeaves.length} total request{adminLeaves.length === 1 ? '' : 's'}
                  </Text>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filtersScroll}
                contentContainerStyle={styles.filtersContent}
              >
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((filter) => {
                  const isActive = statusFilter === filter;
                  return (
                    <TouchableOpacity
                      key={filter}
                      style={[styles.filterChip, isActive && styles.filterChipActive]}
                      onPress={() => setStatusFilter(filter)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                        {filter.charAt(0) + filter.slice(1).toLowerCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          }
          renderItem={renderHistoryItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="calendar-outline" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No Leave Requests</Text>
              <Text style={styles.emptySubtitle}>
                {statusFilter === 'ALL'
                  ? (isAdmin && activeTab === 'ALL_REQUESTS'
                      ? 'No employee leave requests found.'
                      : "You haven't submitted any leave requests yet.")
                  : `No requests with status "${statusFilter}".`}
              </Text>
            </View>
          }
        />
      )}

      {/* Apply Leave Modal */}
      <Modal visible={showApplyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Request Time Off</Text>
                <Text style={styles.modalSubtitle}>Fill details below for approval</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowApplyModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Balance Summary in Modal */}
              <View style={styles.modalBalanceInfo}>
                <Ionicons name="information-circle-outline" size={16} color="#2563EB" />
                <Text style={styles.modalBalanceText}>
                  Available Balance: <Text style={{ fontWeight: '700' }}>{availableBalance} day(s)</Text>
                </Text>
              </View>

              {/* Date Selectors */}
              <View style={styles.dateRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.fieldLabel}>Start Date</Text>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowStartPicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#2563EB" style={{ marginRight: 6 }} />
                    <Text style={styles.datePickerText}>{formatDateDisplay(startDate)}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.dateCol}>
                  <Text style={styles.fieldLabel}>End Date</Text>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowEndPicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#2563EB" style={{ marginRight: 6 }} />
                    <Text style={styles.datePickerText}>{formatDateDisplay(endDate)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Validating indicator */}
              {validating && (
                <View style={styles.validatingRow}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.validatingText}>Analyzing selected dates & leave balance...</Text>
                </View>
              )}

              {/* Overlapping Leave Warning */}
              {validation?.hasApprovedOverlap && (
                <View style={styles.overlapBlock}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.overlapTitle}>Leave Conflict Detected</Text>
                    <Text style={styles.overlapText}>
                      {validation.blockReason || 'You already have approved leave on these dates. Submission is blocked.'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Special Notice Banner */}
              {validation?.specialNotice && !validation.hasApprovedOverlap && (
                <View
                  style={[
                    styles.specialNoticeBox,
                    validation.specialNotice.type === 'WARNING'
                      ? styles.specialNoticeWarning
                      : styles.specialNoticeInfo,
                  ]}
                >
                  <Ionicons
                    name={validation.specialNotice.type === 'WARNING' ? 'alert-circle' : 'information-circle'}
                    size={17}
                    color={validation.specialNotice.type === 'WARNING' ? '#B45309' : '#1D4ED8'}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.specialNoticeTitle,
                        { color: validation.specialNotice.type === 'WARNING' ? '#92400E' : '#1E40AF' },
                      ]}
                    >
                      {validation.specialNotice.title}
                    </Text>
                    <Text
                      style={[
                        styles.specialNoticeMsg,
                        { color: validation.specialNotice.type === 'WARNING' ? '#B45309' : '#1E40AF' },
                      ]}
                    >
                      {validation.specialNotice.message}
                    </Text>
                  </View>
                </View>
              )}

              {/* Smart Leave Summary Card (6 metrics) */}
              {validation ? (
                <View style={styles.smartSummaryCard}>
                  <View style={styles.smartSummaryHeader}>
                    <Ionicons name="sparkles" size={15} color="#4F46E5" />
                    <Text style={styles.smartSummaryTitle}>Smart Leave Impact</Text>
                  </View>
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryGridItem}>
                      <Text style={styles.summaryGridLabel}>Total Selected</Text>
                      <Text style={styles.summaryGridValue}>{validation.totalDays} Days</Text>
                    </View>
                    <View style={styles.summaryGridItem}>
                      <Text style={styles.summaryGridLabel}>Working Days</Text>
                      <Text style={[styles.summaryGridValue, { color: '#2563EB' }]}>
                        {validation.workingDays} Days
                      </Text>
                    </View>
                    <View style={styles.summaryGridItem}>
                      <Text style={styles.summaryGridLabel}>Weekly Offs</Text>
                      <Text style={[styles.summaryGridValue, { color: '#16A34A' }]}>
                        {validation.weeklyOffDays} Days
                      </Text>
                    </View>
                    <View style={styles.summaryGridItem}>
                      <Text style={styles.summaryGridLabel}>Company Holidays</Text>
                      <Text style={[styles.summaryGridValue, { color: '#EA580C' }]}>
                        {validation.companyHolidays} Days
                      </Text>
                    </View>
                    <View style={styles.summaryGridItem}>
                      <Text style={styles.summaryGridLabel}>Paid Leave Req.</Text>
                      <Text style={[styles.summaryGridValue, { color: '#4F46E5' }]}>
                        {validation.paidLeaveRequired} Days
                      </Text>
                    </View>
                    <View style={styles.summaryGridItem}>
                      <Text style={styles.summaryGridLabel}>Balance Impact</Text>
                      <Text style={[styles.summaryGridValue, { color: '#0F172A' }]}>
                        {validation.balanceBefore} → {validation.balanceAfter}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                /* Fallback Duration Notice */
                <View style={styles.durationNotice}>
                  <Text style={styles.durationNoticeLabel}>Total Requested Days:</Text>
                  <Text style={styles.durationNoticeValue}>
                    {requestedDays} {requestedDays === 1 ? 'Day' : 'Days'}
                  </Text>
                </View>
              )}

              {/* Day-by-Day Timeline / Breakdown */}
              {validation?.daysBreakdown && validation.daysBreakdown.length > 0 && (
                <View style={styles.breakdownSection}>
                  <Text style={styles.breakdownSectionTitle}>Day-by-Day Classification</Text>
                  <View style={styles.breakdownList}>
                    {validation.daysBreakdown.map((day, idx) => {
                      let badgeBg = '#EFF6FF';
                      let badgeBorder = '#BFDBFE';
                      let badgeText = '#1D4ED8';
                      let iconName: any = 'briefcase-outline';

                      if (day.category === 'WEEKLY_OFF') {
                        badgeBg = '#F0FDF4';
                        badgeBorder = '#BBF7D0';
                        badgeText = '#15803D';
                        iconName = 'leaf-outline';
                      } else if (day.category === 'COMPANY_HOLIDAY') {
                        badgeBg = '#FFF7ED';
                        badgeBorder = '#FED7AA';
                        badgeText = '#C2410C';
                        iconName = 'gift-outline';
                      } else if (day.category === 'CONFLICT') {
                        badgeBg = '#FEF2F2';
                        badgeBorder = '#FECACA';
                        badgeText = '#DC2626';
                        iconName = 'alert-circle-outline';
                      }

                      return (
                        <View key={idx} style={[styles.breakdownItem, { borderColor: badgeBorder, backgroundColor: badgeBg }]}>
                          <View style={styles.breakdownItemLeft}>
                            <Ionicons name={iconName} size={14} color={badgeText} style={{ marginRight: 6 }} />
                            <Text style={[styles.breakdownDateText, { color: badgeText }]}>
                              {day.formattedDate}
                            </Text>
                          </View>
                          <Text style={[styles.breakdownBadgeText, { color: badgeText }]}>
                            {day.category === 'COMPANY_HOLIDAY' && day.holidayName
                              ? `${day.holidayName} (Exempt)`
                              : day.deductionText}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* LWP Warning Notice */}
              {isLwpRequired && (
                <View style={styles.lwpNotice}>
                  <Ionicons name="alert-circle" size={16} color="#D97706" style={{ marginRight: 6 }} />
                  <Text style={styles.lwpNoticeText}>
                    Exceeds balance by {lwpDays} day(s). These will be marked as Leave Without Pay.
                  </Text>
                </View>
              )}

              {/* Reason */}
              <View style={{ marginTop: 14 }}>
                <Text style={styles.fieldLabel}>Reason for Absence *</Text>
                <TextInput
                  style={styles.reasonInput}
                  placeholder="Provide reason for leave (medical, vacation, personal, etc.)..."
                  placeholderTextColor="#94A3B8"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* DateTimePickers */}
              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_e: any, date?: Date) => {
                    setShowStartPicker(false);
                    if (date) {
                      setStartDate(date);
                      if (date > endDate) setEndDate(date);
                    }
                  }}
                />
              )}

              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={startDate}
                  onChange={(_e: any, date?: Date) => {
                    setShowEndPicker(false);
                    if (date) setEndDate(date);
                  }}
                />
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowApplyModal(false)}
                disabled={applying}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  (applying || validation?.hasApprovedOverlap || validation?.canSubmit === false) && { opacity: 0.65 },
                ]}
                onPress={handleApply}
                disabled={applying || validation?.hasApprovedOverlap || validation?.canSubmit === false}
              >
                {applying ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalSubmitText}>
                      {validation?.hasApprovedOverlap ? 'Blocked' : 'Review & Submit'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Leave Impact Analysis Confirmation Modal */}
      <Modal visible={showImpactModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: '#EEF2FF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="analytics" size={18} color="#4F46E5" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {validation?.confirmationDialog?.title || 'Leave Impact Analysis'}
                  </Text>
                  <Text style={styles.modalSubtitle}>Review quota impact before confirmation</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowImpactModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.impactSummaryText}>
                {validation?.confirmationDialog?.summaryMessage}
              </Text>

              {/* Bullet Points */}
              <View style={styles.impactBulletsContainer}>
                {validation?.confirmationDialog?.breakdownBulletPoints?.map((point, idx) => (
                  <View key={idx} style={styles.bulletRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#2563EB" style={{ marginTop: 2 }} />
                    <Text style={styles.bulletText}>{point}</Text>
                  </View>
                ))}
              </View>

              {/* Quota Impact Box */}
              <View style={styles.quotaImpactBox}>
                <View style={styles.quotaImpactRow}>
                  <Text style={styles.quotaImpactLabel}>Paid Leave Required</Text>
                  <Text style={styles.quotaImpactValue}>
                    {validation?.confirmationDialog?.paidLeaveRequiredText}
                  </Text>
                </View>
                <View style={[styles.quotaImpactRow, { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8, marginTop: 8 }]}>
                  <Text style={styles.quotaImpactLabel}>Remaining Balance After Approval</Text>
                  <Text style={[styles.quotaImpactValue, { color: '#16A34A', fontWeight: '800' }]}>
                    {validation?.confirmationDialog?.balanceAfterText}
                  </Text>
                </View>
                {validation?.confirmationDialog?.lwpWarningText && (
                  <View style={[styles.quotaImpactRow, { borderTopWidth: 1, borderTopColor: '#FED7AA', paddingTop: 8, marginTop: 8 }]}>
                    <Text style={[styles.quotaImpactLabel, { color: '#B45309' }]}>LWP Notice</Text>
                    <Text style={[styles.quotaImpactValue, { color: '#B45309' }]}>
                      {validation.confirmationDialog.lwpWarningText}
                    </Text>
                  </View>
                )}
              </View>

              {/* Policy Note */}
              <View style={styles.policyNoteBox}>
                <Ionicons name="shield-checkmark" size={16} color="#475569" style={{ marginTop: 2 }} />
                <Text style={styles.policyNoteText}>
                  {validation?.confirmationDialog?.policyNote ||
                    'Official company policy excludes designated weekly offs and official holidays from consuming employee paid leave quota.'}
                </Text>
              </View>
            </ScrollView>

            {/* 3 Confirmation Actions: Continue, Modify Leave, Cancel */}
            <View style={styles.impactActions}>
              <TouchableOpacity
                style={styles.impactContinueBtn}
                onPress={() => {
                  setShowImpactModal(false);
                  submitLeave();
                }}
                disabled={applying}
              >
                {applying ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.impactContinueText}>Continue & Submit</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={styles.impactModifyBtn}
                  onPress={() => setShowImpactModal(false)}
                  disabled={applying}
                >
                  <Ionicons name="create-outline" size={15} color="#2563EB" style={{ marginRight: 4 }} />
                  <Text style={styles.impactModifyText}>Modify Leave</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.impactCancelBtn}
                  onPress={() => {
                    setShowImpactModal(false);
                    setShowApplyModal(false);
                  }}
                  disabled={applying}
                >
                  <Text style={styles.impactCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 10) : 0,
  },
  topHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  balanceSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
  },
  balanceMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  balanceNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  balanceBigNumber: {
    fontSize: 34,
    fontWeight: '800',
    color: '#2563EB',
  },
  balanceUnit: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 6,
    fontWeight: '600',
  },
  balanceIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  balanceGridItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceGridDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  gridLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  applyButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  segmentedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentedBtnActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentedTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  historySectionHeader: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  filtersScroll: {
    marginBottom: 12,
  },
  filtersContent: {
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  leaveTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  leaveTypeTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardDatesText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  daysPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  daysPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  reasonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 2,
  },
  reasonText: {
    fontSize: 12.5,
    color: '#64748B',
    fontStyle: 'italic',
  },
  cardFooterRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  applicantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  applicantAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  applicantAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  applicantInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  applicantName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  applicantId: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  adminActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reviewerBox: {
    marginTop: 8,
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  reviewerBoxRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  reviewerBoxApproved: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  reviewerTitle: {
    fontSize: 12,
  },
  reviewerRemarks: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
    marginTop: 2,
    marginLeft: 19,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    marginBottom: 14,
  },
  modalBalanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  modalBalanceText: {
    fontSize: 12.5,
    color: '#1E40AF',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#F8FAFC',
  },
  datePickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  durationNotice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  durationNoticeLabel: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '500',
  },
  durationNoticeValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  lwpNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  lwpNoticeText: {
    fontSize: 12,
    color: '#B45309',
    flex: 1,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    minHeight: 70,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Smart Validation & Impact Styles
  validatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 9,
    borderRadius: 8,
    marginTop: 10,
  },
  validatingText: {
    fontSize: 12.5,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  overlapBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  overlapTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 2,
  },
  overlapText: {
    fontSize: 12,
    color: '#DC2626',
    lineHeight: 16,
  },
  specialNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
  },
  specialNoticeInfo: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  specialNoticeWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  specialNoticeTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  specialNoticeMsg: {
    fontSize: 12,
    lineHeight: 16,
  },
  smartSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  smartSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  smartSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  summaryGridItem: {
    width: '33.33%',
    paddingRight: 4,
  },
  summaryGridLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
  },
  summaryGridValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  breakdownSection: {
    marginTop: 12,
  },
  breakdownSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownList: {
    gap: 6,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  breakdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownDateText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  breakdownBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },

  // Impact Analysis Dialog Modal
  impactSummaryText: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 19,
    marginBottom: 12,
  },
  impactBulletsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    fontSize: 12.5,
    color: '#1E293B',
    lineHeight: 17,
    flex: 1,
  },
  quotaImpactBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  quotaImpactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quotaImpactLabel: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '500',
  },
  quotaImpactValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  policyNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  policyNoteText: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
    flex: 1,
  },
  impactActions: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  impactContinueBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactContinueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  impactModifyBtn: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactModifyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  impactCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
});
