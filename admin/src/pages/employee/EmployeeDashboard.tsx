import React, { useEffect, useState } from 'react';
import { Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Clock,
  CalendarCheck,
  CalendarRange,
  Bell,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  MapPin,
  ExternalLink,
  ChevronRight,
  Briefcase,
  FileText,
  User,
  LogOut,
  Sparkles,
  ArrowUpRight,
  Sun,
  Coffee,
  Check,
  FileCheck,
  CalendarDays,
  Monitor,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/common/Avatar';
import ImagePreviewModal from '../../components/common/ImagePreviewModal';

interface MonthStats {
  present: number;
  late: number;
  half_day: number;
  absent: number;
  leave: number;
  total_working_minutes: number;
  total_days_worked: number;
}

interface AssignedShift {
  id?: number;
  name?: string;
  code?: string;
  shift_code?: string;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  lateAfter?: string;
  late_grace_time?: string;
  halfDayMinutes?: number;
  half_day_hours?: number;
  full_day_hours?: number;
  minimumWorkHours?: number;
  breakMinutes?: number;
}

interface LeaveBalance {
  name: string;
  allocated_days: number;
  used_days: number;
}

interface NotificationItem {
  id: number;
  title?: string;
  type: string;
  message: string;
  sent_at?: string;
}

interface LatestPayslip {
  month: number;
  year: number;
  fileUrl?: string;
  generatedDate?: string;
}

interface DashboardData {
  today_status: any;
  leave_balances: LeaveBalance[];
  recent_notifications: NotificationItem[];
  assigned_shift?: AssignedShift | null;
  profile?: any;
  month_stats?: MonthStats;
  latest_payslip?: LatestPayslip | null;
}

export default function EmployeeDashboard() {
  const { user, token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showImagePreview, setShowImagePreview] = useState(false);

  // Real-time ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [punchLoading, setPunchLoading] = useState(false);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [punchSuccess, setPunchSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/employee/dashboard`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const handleWebPunch = (action: 'check-in' | 'check-out') => {
    if (!navigator.geolocation) {
      setPunchError('Location access is required to mark attendance. Please enable location services and try again.');
      return;
    }

    setPunchLoading(true);
    setPunchError(null);
    setPunchSuccess(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          const endpoint = action === 'check-in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
          const res = await axios.post(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${endpoint}`,
            {
              latitude,
              longitude,
              accuracy,
              source: 'Web Portal'
            },
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );

          if (res.data.success) {
            setPunchSuccess(action === 'check-in' ? 'Attendance marked successfully via Web Portal!' : 'Checked out successfully via Web Portal!');
            fetchData();
          } else {
            setPunchError(res.data.error?.message || 'Failed to record attendance.');
          }
        } catch (err: any) {
          const errRes = err.response?.data?.error;
          if (errRes?.code === 'OUTSIDE_OFFICE') {
            setPunchError('You are outside the authorized office location. Attendance cannot be marked.');
          } else if (errRes?.code === 'WEB_ATTENDANCE_NOT_ALLOWED') {
            setPunchError(errRes.message || 'You are not authorized to mark attendance from the Web Portal. Only authorized employees can mark attendance from a PC.');
          } else if (errRes?.message) {
            setPunchError(errRes.message);
          } else {
            setPunchError('Failed to record attendance. Please try again.');
          }
        } finally {
          setPunchLoading(false);
        }
      },
      (geoError) => {
        setPunchLoading(false);
        setPunchError('Location access is required to mark attendance. Please enable location services and try again.');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // Greeting helper
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center py-5" style={{ minHeight: '60vh' }}>
        <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
        <span className="text-muted mt-3 fw-medium" style={{ fontSize: '15px' }}>
          Loading your personalized workspace...
        </span>
      </div>
    );
  }

  const profile = data?.profile || user;
  const allowWebAttendance = !!((profile as any)?.allowWebAttendance || (profile as any)?.allow_web_attendance);
  const todayAtt = data?.today_status;
  const isPresent = !!todayAtt && (todayAtt.status === 'PRESENT' || todayAtt.status === 'LATE');
  const isLate = todayAtt?.status === 'LATE';
  const shift = data?.assigned_shift;
  const monthStats = data?.month_stats;
  const payslip = data?.latest_payslip;

  // Time formatter (converts "10:00:00" or "18:30" to "10:00 AM" / "06:30 PM")
  const formatTime12 = (timeStr?: string) => {
    if (!timeStr) return '--:--';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  };

  const shiftStartTime = shift?.startTime || shift?.start_time || '10:00:00';
  const shiftEndTime = shift?.endTime || shift?.end_time || '18:30:00';
  const shiftCode = shift?.code || shift?.shift_code || 'DS';
  const shiftLateAfter = shift?.lateAfter || shift?.late_grace_time || '10:15:00';
  const halfDayHours = shift?.halfDayMinutes ? (shift.halfDayMinutes / 60) : (shift?.half_day_hours || 4);

  // Format hours and minutes from total working minutes
  const formatMinutesToHours = (totalMins: number = 0) => {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs === 0) return `${mins}m`;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs} hrs`;
  };

  // Elapsed time today if checked in
  const getTodayElapsed = () => {
    if (!todayAtt?.check_in) return null;
    try {
      const checkInTime = new Date(todayAtt.check_in).getTime();
      const endTime = todayAtt.check_out ? new Date(todayAtt.check_out).getTime() : currentTime.getTime();
      const diffMins = Math.max(0, Math.floor((endTime - checkInTime) / 60000));
      return formatMinutesToHours(diffMins);
    } catch {
      return null;
    }
  };

  const todayElapsedStr = getTodayElapsed();

  return (
    <div>
      {/* Executive Welcome Hero Banner */}
      <div className="dashboard-hero-banner mb-4">
        {/* Background decorative watermark */}
        <div className="dashboard-hero-watermark">
          <ShieldCheck size={280} strokeWidth={1} />
        </div>

        <div className="dashboard-hero-content">
          {/* Top Status Strip: Live Time & Geofence Badge */}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div className="d-flex align-items-center gap-2">
              <span className="badge" style={{ background: '#EFF6FF', color: '#1E40AF', fontSize: '12px', fontWeight: 600, padding: '5px 10px', borderRadius: '8px' }}>
                EMPLOYEE PORTAL
              </span>
              <div className="d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill" style={{ background: 'rgba(255, 255, 255, 0.85)', border: '1px solid #E2E8F0', fontSize: '12px' }}>
                <span className="pulse-dot"></span>
                <span className="fw-semibold text-dark">Office Geofence Active</span>
              </div>
            </div>

            <div className="hero-date-chip">
              <Clock size={13} className="text-primary" />
              <span className="fw-bold" style={{ letterSpacing: '0.02em' }}>
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-muted" style={{ fontWeight: 400 }}>•</span>
              <span>
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Profile & Personalized Greeting Row */}
          <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <Avatar
                src={profile?.profile_photo_url || user?.profile_photo_url || user?.profilePhotoUrl}
                name={profile?.name || user?.name}
                size={100}
                showBorder={true}
                borderColor="#FFFFFF"
                style={{ 
                  boxShadow: '0 8px 26px rgba(37, 99, 255, 0.25), 0 0 0 3.5px #FFFFFF', 
                  cursor: 'pointer' 
                }}
                onClick={() => setShowImagePreview(true)}
                alt="Click to view full photo"
              />
              <div>
                <h1 className="hero-title mb-1">
                  {getGreeting()}, {profile?.name || user?.name || 'Colleague'} <span style={{ display: 'inline-block' }}>👋</span>
                </h1>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  {profile?.employee_code && (
                    <span className="badge bg-white text-secondary border fw-medium" style={{ fontSize: '12px' }}>
                      ID: #{profile.employee_code}
                    </span>
                  )}
                  {profile?.designation && (
                    <span className="fw-semibold text-dark" style={{ fontSize: '13.5px' }}>
                      {profile.designation}
                    </span>
                  )}
                  {profile?.department && (
                    <>
                      <span className="text-muted">•</span>
                      <span className="badge" style={{ background: '#E0F2FE', color: '#0369A1', fontSize: '12px', fontWeight: 600 }}>
                        {profile.department}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Navigation Buttons */}
            <div className="d-flex flex-wrap align-items-center gap-2 flex-shrink-0">
              <Link to="/my-leave" className="btn-hero-primary d-inline-flex align-items-center gap-2">
                <CalendarRange size={16} />
                <span>Apply for Leave</span>
              </Link>
              <Link to="/my-attendance" className="btn-hero-secondary d-inline-flex align-items-center gap-2">
                <CalendarCheck size={15} />
                <span>Attendance Log</span>
              </Link>
              <Link to="/salary-slips" className="btn-hero-secondary d-inline-flex align-items-center gap-2">
                <FileText size={15} />
                <span>Payslips</span>
              </Link>
              <Link to="/profile" className="btn-hero-secondary d-inline-flex align-items-center gap-2">
                <User size={15} />
                <span>Profile</span>
              </Link>
            </div>
          </div>

          {/* Quick Stats Strip */}
          <div className="hero-stats-strip">
            <div className="hero-stat-chip">
              <span className="stat-label">Shift Schedule:</span>
              <span className="stat-value text-primary">
                {shift?.name || 'Day Shift'} ({formatTime12(shiftStartTime)} - {formatTime12(shiftEndTime)})
              </span>
            </div>
            <div className="hero-stat-chip">
              <span className="stat-label">Today's Status:</span>
              <span
                className="stat-value fw-bold"
                style={{
                  color: isPresent ? (isLate ? '#D97706' : '#15803D') : '#64748B'
                }}
              >
                {isPresent ? (isLate ? 'Marked Late' : 'Present') : 'Not Checked In'}
              </span>
            </div>
            <div className="hero-stat-chip">
              <span className="stat-label">This Month Worked:</span>
              <span className="stat-value text-dark">
                {monthStats?.total_days_worked ?? 0} Days
              </span>
            </div>
            <div className="hero-stat-chip">
              <span className="stat-label">Hours Logged:</span>
              <span className="stat-value text-success">
                {formatMinutesToHours(monthStats?.total_working_minutes || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4 d-flex align-items-center gap-2 rounded-3 border-danger shadow-sm">
          <AlertCircle size={18} className="text-danger flex-shrink-0" />
          <span className="fw-medium">{error}</span>
        </Alert>
      )}

      {/* Main Grid: Status & Work Shift Cards */}
      <div className="row g-4 mb-4">
        {/* Card 1: Today's Punch & Status Card */}
        <div className="col-lg-4">
          <div className="card h-100 p-4 d-flex flex-column justify-content-between">
            {/* Header row */}
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <h2 className="card-title mb-1">Today's Attendance</h2>
                  <div className="caption-text">Daily punch record & GPS verification</div>
                </div>
                <div
                  className="p-2 rounded-3"
                  style={{
                    background: isPresent ? '#DCFCE7' : '#F1F5F9',
                    color: isPresent ? '#15803D' : '#64748B'
                  }}
                >
                  {isPresent ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                </div>
              </div>

              {/* Status Banner Block */}
              <div
                className="p-3 rounded-3 mb-3"
                style={{
                  background: isPresent
                    ? (isLate ? '#FFFBEB' : '#F0FDF4')
                    : '#F8FAFC',
                  border: isPresent
                    ? (isLate ? '1px solid #FDE68A' : '1px solid #BBF7D0')
                    : '1px solid #E2E8F0'
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-1.5">
                  <span
                    className={`badge ${
                      isPresent
                        ? (isLate ? 'bg-warning text-dark' : 'bg-success')
                        : 'bg-secondary'
                    }`}
                    style={{ fontSize: '11px', fontWeight: 600, padding: '4px 8px' }}
                  >
                    {isPresent
                      ? (isLate ? 'MARKED LATE' : 'MARKED PRESENT')
                      : 'NOT CHECKED IN'}
                  </span>
                  <span className="caption-text text-muted" style={{ fontSize: '11.5px' }}>
                    {currentTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>

                <div
                  className="fw-bold mb-1"
                  style={{
                    fontSize: '20px',
                    color: isPresent
                      ? (isLate ? '#B45309' : '#15803D')
                      : '#0F172A'
                  }}
                >
                  {isPresent
                    ? (isLate ? 'Checked In (Late)' : 'Checked In (On Time)')
                    : 'Ready to Check In'}
                </div>

                <p className="text-muted mb-0" style={{ fontSize: '13px', lineHeight: 1.45 }}>
                  {isPresent
                    ? (todayAtt?.attendance_source === 'Web Portal' || todayAtt?.attendanceSource === 'Web Portal'
                        ? 'Attendance verified with geolocation and office geofence via Web Portal.'
                        : 'Attendance successfully verified with geolocation and mobile device.')
                    : (allowWebAttendance
                        ? 'You are authorized to punch in from the Web Portal using office GPS verification.'
                        : 'Please use your Falcon Office mobile app to punch in upon arrival at the office.')}
                </p>
              </div>

              {/* Punch In / Punch Out Grid */}
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <div
                    className="p-2.5 rounded-3 text-center"
                    style={{
                      background: isPresent ? '#EFF6FF' : '#F8FAFC',
                      border: isPresent ? '1px solid #BFDBFE' : '1px solid #E2E8F0'
                    }}
                  >
                    <div className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Punch In
                    </div>
                    <div
                      className="fw-bold mt-1"
                      style={{
                        fontSize: '18px',
                        color: todayAtt?.check_in ? '#1D4ED8' : '#64748B'
                      }}
                    >
                      {todayAtt?.check_in
                        ? new Date(todayAtt.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--:--'}
                    </div>
                    <div className="caption-text" style={{ fontSize: '11px', color: todayAtt?.check_in ? '#2563EB' : '#94A3B8' }}>
                      {todayAtt?.check_in ? 'Verified' : 'Pending'}
                    </div>
                  </div>
                </div>

                <div className="col-6">
                  <div
                    className="p-2.5 rounded-3 text-center"
                    style={{
                      background: todayAtt?.check_out ? '#EFF6FF' : '#F8FAFC',
                      border: todayAtt?.check_out ? '1px solid #BFDBFE' : '1px solid #E2E8F0'
                    }}
                  >
                    <div className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Punch Out
                    </div>
                    <div
                      className="fw-bold mt-1"
                      style={{
                        fontSize: '18px',
                        color: todayAtt?.check_out ? '#1D4ED8' : (isPresent ? '#10B981' : '#64748B')
                      }}
                    >
                      {todayAtt?.check_out
                        ? new Date(todayAtt.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : (isPresent ? 'In Office' : '--:--')}
                    </div>
                    <div className="caption-text" style={{ fontSize: '11px', color: todayAtt?.check_out ? '#2563EB' : (isPresent ? '#15803D' : '#94A3B8') }}>
                      {todayAtt?.check_out ? 'Completed' : (isPresent ? 'Active Session' : 'Pending')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

              {/* Web Attendance Action Controls */}
              <div className="mb-3">
                {punchError && (
                  <Alert variant="danger" className="py-2 px-3 mb-2 rounded-3 d-flex align-items-center gap-2" style={{ fontSize: '12.5px' }} onClose={() => setPunchError(null)} dismissible>
                    <AlertCircle size={15} className="flex-shrink-0" />
                    <span>{punchError}</span>
                  </Alert>
                )}
                {punchSuccess && (
                  <Alert variant="success" className="py-2 px-3 mb-2 rounded-3 d-flex align-items-center gap-2" style={{ fontSize: '12.5px' }} onClose={() => setPunchSuccess(null)} dismissible>
                    <CheckCircle2 size={15} className="flex-shrink-0" />
                    <span>{punchSuccess}</span>
                  </Alert>
                )}

                {allowWebAttendance ? (
                  !todayAtt?.check_in ? (
                    <button
                      className="btn btn-primary w-100 py-2.5 rounded-3 d-flex align-items-center justify-content-center gap-2 fw-semibold shadow-sm"
                      onClick={() => handleWebPunch('check-in')}
                      disabled={punchLoading}
                      style={{ fontSize: '13.5px' }}
                    >
                      {punchLoading ? (
                        <>
                          <Spinner animation="border" size="sm" />
                          <span>Verifying Location & Punching In...</span>
                        </>
                      ) : (
                        <>
                          <Monitor size={16} />
                          <span>Punch In (Web Portal)</span>
                        </>
                      )}
                    </button>
                  ) : !todayAtt?.check_out ? (
                    <button
                      className="btn btn-outline-danger w-100 py-2.5 rounded-3 d-flex align-items-center justify-content-center gap-2 fw-semibold"
                      onClick={() => handleWebPunch('check-out')}
                      disabled={punchLoading}
                      style={{ fontSize: '13.5px' }}
                    >
                      {punchLoading ? (
                        <>
                          <Spinner animation="border" size="sm" />
                          <span>Verifying Location & Punching Out...</span>
                        </>
                      ) : (
                        <>
                          <LogOut size={16} />
                          <span>Punch Out (Web Portal)</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-3 bg-success-subtle text-success border border-success-subtle d-flex align-items-center justify-content-between" style={{ fontSize: '12px' }}>
                      <div className="d-flex align-items-center gap-1.5 fw-medium">
                        <CheckCircle2 size={14} />
                        <span>Today's Attendance Completed</span>
                      </div>
                      <span className="badge bg-white text-success border border-success-subtle">
                        {todayAtt?.attendance_source || todayAtt?.attendanceSource || 'Web Portal'}
                      </span>
                    </div>
                  )
                ) : (
                  <div className="p-2.5 rounded-3 bg-light border text-muted" style={{ fontSize: '12px' }}>
                    <div className="d-flex align-items-center gap-1.5 fw-semibold text-secondary mb-1">
                      <Lock size={13} />
                      <span>Web Attendance Restricted</span>
                    </div>
                    <div>Only authorized employees can mark attendance from a PC. Please use the Falcon Mobile App.</div>
                  </div>
                )}
              </div>

            {/* Footer Strip */}
            <div
              className="d-flex align-items-center justify-content-between p-2.5 rounded-3"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
            >
              <div className="d-flex align-items-center gap-1.5" style={{ fontSize: '12.5px', color: '#475569' }}>
                <MapPin size={14} className="text-primary" />
                <span>Office Geofence Active</span>
              </div>
              <span className="fw-semibold text-dark" style={{ fontSize: '12.5px' }}>
                {todayElapsedStr ? `${todayElapsedStr} Logged` : '0h 0m'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Work Shift Policy Card */}
        <div className="col-lg-4">
          <div className="card h-100 p-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h2 className="card-title mb-1">Work Shift & Schedule</h2>
                <div className="caption-text">Assigned working policy and grace limits</div>
              </div>
              <div className="p-2 rounded-3 bg-light text-primary">
                <Briefcase size={20} />
              </div>
            </div>

            <div className="p-3 rounded-3 mb-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="fw-bold text-dark" style={{ fontSize: '16px' }}>
                  {shift?.name || 'Day Shift (General)'}
                </span>
                <span className="badge" style={{ background: '#EFF6FF', color: '#2563EB', fontWeight: 600 }}>
                  {shiftCode}
                </span>
              </div>
              <div className="d-flex align-items-baseline gap-2">
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>
                  {formatTime12(shiftStartTime)}
                </span>
                <span className="text-muted" style={{ fontSize: '14px' }}>to</span>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>
                  {formatTime12(shiftEndTime)}
                </span>
              </div>
            </div>

            <div className="d-flex flex-column gap-2 mb-3">
              <div className="d-flex align-items-center justify-content-between py-1 border-bottom" style={{ fontSize: '13px' }}>
                <span className="text-muted">Late Grace Cutoff</span>
                <span className="fw-semibold text-warning" style={{ color: '#D97706' }}>
                  {formatTime12(shiftLateAfter)}
                </span>
              </div>
              <div className="d-flex align-items-center justify-content-between py-1 border-bottom" style={{ fontSize: '13px' }}>
                <span className="text-muted">Min Half-Day Requirement</span>
                <span className="fw-semibold text-dark">
                  {halfDayHours} Hours
                </span>
              </div>
              <div className="d-flex align-items-center justify-content-between py-1" style={{ fontSize: '13px' }}>
                <span className="text-muted">Weekly Off</span>
                <span className="badge bg-light text-dark border">Sunday</span>
              </div>
            </div>

            <div className="mt-auto pt-2">
              <Link
                to="/my-attendance"
                className="d-flex align-items-center justify-content-between p-2.5 rounded-3 text-decoration-none"
                style={{ background: '#F1F5F9', color: '#1E40AF', fontSize: '13px', fontWeight: 600 }}
              >
                <span>Check full monthly shift calendar</span>
                <ChevronRight size={15} />
              </Link>
            </div>
          </div>
        </div>

        {/* Card 3: Monthly Attendance Scorecard */}
        <div className="col-lg-4">
          <div className="card h-100 p-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h2 className="card-title mb-1">
                  {monthNames[new Date().getMonth()]} Summary
                </h2>
                <div className="caption-text">Attendance metrics for this month</div>
              </div>
              <div className="p-2 rounded-3 bg-light text-success">
                <TrendingUp size={20} />
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <div className="p-3 rounded-3 text-center" style={{ background: '#F0FDF4', border: '1px solid #DCFCE7' }}>
                  <div className="text-muted" style={{ fontSize: '12px', fontWeight: 500 }}>Days Present</div>
                  <div className="fw-bold mt-1" style={{ fontSize: '24px', color: '#15803D' }}>
                    {monthStats?.present ?? 0}
                  </div>
                  <div className="caption-text" style={{ fontSize: '11px', color: '#16A34A' }}>Verified On-Time</div>
                </div>
              </div>
              <div className="col-6">
                <div className="p-3 rounded-3 text-center" style={{ background: '#FFFBEB', border: '1px solid #FEF3C7' }}>
                  <div className="text-muted" style={{ fontSize: '12px', fontWeight: 500 }}>Late Marks</div>
                  <div className="fw-bold mt-1" style={{ fontSize: '24px', color: '#B45309' }}>
                    {monthStats?.late ?? 0}
                  </div>
                  <div className="caption-text" style={{ fontSize: '11px', color: '#D97706' }}>After Grace Time</div>
                </div>
              </div>
              <div className="col-6">
                <div className="p-3 rounded-3 text-center" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div className="text-muted" style={{ fontSize: '12px', fontWeight: 500 }}>Half Days</div>
                  <div className="fw-bold mt-1" style={{ fontSize: '22px', color: '#0F172A' }}>
                    {monthStats?.half_day ?? 0}
                  </div>
                  <div className="caption-text" style={{ fontSize: '11px' }}>Recorded</div>
                </div>
              </div>
              <div className="col-6">
                <div className="p-3 rounded-3 text-center" style={{ background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
                  <div className="text-muted" style={{ fontSize: '12px', fontWeight: 500 }}>Total Logged</div>
                  <div className="fw-bold mt-1" style={{ fontSize: '18px', color: '#1D4ED8' }}>
                    {formatMinutesToHours(monthStats?.total_working_minutes || 0)}
                  </div>
                  <div className="caption-text" style={{ fontSize: '11px', color: '#2563EB' }}>Productive Time</div>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-2">
              <Link
                to="/my-attendance"
                className="btn btn-light w-100 justify-content-between"
                style={{ fontSize: '13px' }}
              >
                <span>View Full Calendar Record</span>
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Leave Balances & Latest Payslip */}
      <div className="row g-4 mb-4">
        {/* Leave Balances Card */}
        <div className="col-lg-8">
          <div className="card h-100 p-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h2 className="card-title mb-1">Leave Balances & Annual Quotas</h2>
                <div className="caption-text">Year {new Date().getFullYear()} accrued leave allowances and usage</div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Link to="/holidays" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5" style={{ borderRadius: '8px', fontWeight: 600 }}>
                  <CalendarDays size={14} />
                  <span>Holidays</span>
                </Link>
                <Link to="/my-leave" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5" style={{ borderRadius: '8px', fontWeight: 600 }}>
                  <CalendarRange size={14} />
                  <span>Apply Leave</span>
                </Link>
              </div>
            </div>

            <div className="row g-3">
              {data?.leave_balances && data.leave_balances.length > 0 ? (
                data.leave_balances.map((lb) => {
                  const remaining = Math.max(0, lb.allocated_days - lb.used_days);
                  const percentUsed = lb.allocated_days > 0
                    ? Math.min(100, Math.round((lb.used_days / lb.allocated_days) * 100))
                    : 0;
                  const isPaid = lb.name.toLowerCase().includes('paid');

                  return (
                    <div key={lb.name} className="col-md-6">
                      <div
                        className="p-3.5 rounded-3 h-100 d-flex flex-column justify-content-between"
                        style={{
                          background: isPaid ? '#F0FDF4' : '#F8FAFC',
                          border: isPaid ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                          padding: '18px'
                        }}
                      >
                        <div>
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="fw-bold text-dark" style={{ fontSize: '15px' }}>
                              {lb.name}
                            </span>
                            <span
                              className={`badge ${
                                isPaid ? 'bg-success' : 'bg-secondary'
                              }`}
                              style={{ fontSize: '11.5px', padding: '4px 8px' }}
                            >
                              {isPaid ? `${remaining} Available` : `${lb.used_days} Days Used`}
                            </span>
                          </div>

                          <div className="d-flex align-items-baseline gap-2 mb-2">
                            <span style={{ fontSize: '30px', fontWeight: 800, color: '#0F172A' }}>
                              {isPaid ? remaining : lb.used_days}
                            </span>
                            <span className="text-muted" style={{ fontSize: '13.5px' }}>
                              {isPaid ? `/ ${lb.allocated_days} days annual quota` : 'days consumed'}
                            </span>
                          </div>

                          {/* Modern progress bar for paid leave */}
                          {lb.allocated_days > 0 && (
                            <div className="mb-2">
                              <div className="leave-progress-bg">
                                <div
                                  className="leave-progress-fill"
                                  style={{
                                    width: `${100 - percentUsed}%`,
                                    background: isPaid
                                      ? 'linear-gradient(90deg, #10B981, #059669)'
                                      : 'linear-gradient(90deg, #64748B, #475569)'
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="d-flex justify-content-between text-muted pt-2 border-top" style={{ fontSize: '12px' }}>
                          <span>Used: <strong className="text-dark">{lb.used_days}</strong> days</span>
                          {lb.allocated_days > 0 && (
                            <span>Remaining: <strong className="text-success">{remaining}</strong> days</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-12 text-center py-4 text-muted">
                  No leave quotas configured for this year.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Latest Payslip Quick Access Card */}
        <div className="col-lg-4">
          <div className="card h-100 p-4 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <h2 className="card-title mb-1">Salary & Payslips</h2>
                  <div className="caption-text">Monthly compensation records</div>
                </div>
                <div className="p-2 rounded-3 bg-light text-primary">
                  <FileText size={20} />
                </div>
              </div>

              {payslip ? (
                <div className="p-3.5 rounded-3 mb-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="badge" style={{ background: '#DCFCE7', color: '#15803D', fontWeight: 600 }}>
                      DISBURSED
                    </span>
                    <span className="caption-text">
                      {payslip.generatedDate ? new Date(payslip.generatedDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                  </div>
                  <div className="fw-bold text-dark mb-1" style={{ fontSize: '18px' }}>
                    {monthNames[payslip.month - 1]} {payslip.year}
                  </div>
                  <p className="text-muted mb-0" style={{ fontSize: '12.5px' }}>
                    Official digitally verified salary slip. Generated and approved by Finance.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-3 mb-3 text-center" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <FileCheck size={28} className="text-muted mb-2" />
                  <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>No Slips Generated Yet</div>
                  <p className="caption-text mb-0 mt-1">
                    Your monthly salary slips will appear here as soon as payroll is run.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <Link
                to="/salary-slips"
                className="btn btn-light w-100 d-flex align-items-center justify-content-between"
                style={{ fontSize: '13.5px' }}
              >
                <span>View All Salary Slips</span>
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Full Size Image Preview Modal */}
      <ImagePreviewModal
        show={showImagePreview}
        onHide={() => setShowImagePreview(false)}
        src={profile?.profile_photo_url}
        name={profile?.name || user?.name}
        employeeId={profile?.employee_code || user?.employee_id}
        department={profile?.department}
        role={profile?.designation || 'Employee'}
      />
    </div>
  );
}


