import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CustomAlertProvider } from './context/CustomAlertContext';
import {
  Users,
  CalendarCheck,
  CalendarRange,
  FileBarChart,
  Settings as SettingsIcon,
  ShieldCheck,
  ArrowUpRight,
  UserCheck,
  Mail,
  BadgeCheck,
  Clock,
  Briefcase
} from 'lucide-react';
import axios from 'axios';

import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

// Admin Pages
import AdminAttendance from './pages/AdminAttendance';
import AdminEmployees from './pages/AdminEmployees';
import AdminShifts from './pages/AdminShifts';
import AdminSettings from './pages/AdminSettings';
import AdminReports from './pages/AdminReports';
import AdminLeave from './pages/AdminLeave';
import LeaveInitialization from './pages/LeaveInitialization';
import AdminPayroll from './pages/payroll/AdminPayroll';

// Employee Pages
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import MyAttendance from './pages/employee/MyAttendance';
import MyLeave from './pages/employee/MyLeave';
import SalarySlips from './pages/employee/SalarySlips';
import HolidayList from './pages/employee/HolidayList';

import NotificationsPage from './pages/NotificationsPage';
import MyProfile from './pages/MyProfile';
import Avatar from './components/common/Avatar';
import ImagePreviewModal from './components/common/ImagePreviewModal';


// Enterprise Admin Dashboard View
function AdminDashboardView() {
  const { user, token } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showImagePreview, setShowImagePreview] = useState(false);

  useEffect(() => {
    const fetchTodaySummary = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/attendance/summary?date=${today}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          setSummary(res.data.data);
        }
      } catch (e) {
        // Quiet fallback if not available
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchTodaySummary();
  }, [token]);

  const quickModules = [
    {
      title: 'Employees Directory',
      desc: 'Add, view, edit status, and reset employee credentials.',
      path: '/employees',
      icon: Users,
      color: '#2563EB',
      badge: 'Manage'
    },
    {
      title: 'Attendance Records',
      desc: 'Real-time GPS attendance logs, daily summaries, and filters.',
      path: '/attendance',
      icon: CalendarCheck,
      color: '#16A34A',
      badge: 'Real-time'
    },
    {
      title: 'Leave Requests',
      desc: 'Review, approve, or reject employee leave applications.',
      path: '/leave',
      icon: CalendarRange,
      color: '#F59E0B',
      badge: 'Pending'
    },
    {
      title: 'Reports & Analytics',
      desc: 'Generate monthly summaries and export employee attendance.',
      path: '/reports',
      icon: FileBarChart,
      color: '#6366F1',
      badge: 'Reports'
    },
    {
      title: 'Payroll Engine',
      desc: 'Calculate monthly salaries, generate slips, and export PF/ESIC.',
      path: '/payroll',
      icon: Briefcase,
      color: '#0284C7',
      badge: 'Payroll'
    },
    {
      title: 'Shift Management',
      desc: 'Multi-shift schedules, grace periods, overnight rotations, and assignments.',
      path: '/shifts',
      icon: Clock,
      color: '#0D9488',
      badge: 'Shifts'
    },
    {
      title: 'System Settings',
      desc: 'Configure office hours, late thresholds, and official holidays.',
      path: '/settings',
      icon: SettingsIcon,
      color: '#475569',
      badge: 'Config'
    },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const turnoutPercent = summary?.totalEmployees && summary.totalEmployees > 0
    ? Math.round(((summary.present || 0) / summary.totalEmployees) * 100)
    : 0;

  return (
    <div>
      {/* Executive Welcome Hero Banner (Light Aesthetic) */}
      <div className="dashboard-hero-banner mb-4">
        {/* Decorative background watermark */}
        <div className="dashboard-hero-watermark">
          <ShieldCheck size={260} strokeWidth={1} />
        </div>

        <div className="dashboard-hero-content">
          {/* Top Row: Date Chip */}
          <div className="d-flex align-items-center justify-content-end mb-2">
            <div className="hero-date-chip">
              <Clock size={13} className="text-primary" />
              <span>{currentDateFormatted}</span>
            </div>
          </div>

          {/* Main Title, Avatar & Action Buttons */}
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <Avatar
                src={user?.profile_photo_url || user?.profilePhotoUrl}
                name={user?.name}
                size={100}
                showBorder={true}
                borderColor="#FFFFFF"
                style={{ 
                  boxShadow: '0 8px 26px rgba(37, 99, 235, 0.25), 0 0 0 3.5px #FFFFFF', 
                  cursor: 'pointer' 
                }}
                onClick={() => setShowImagePreview(true)}
                alt="Click to view full photo"
              />
              <div>
                <h1 className="hero-title mb-1">
                  {getGreeting()}, {user?.name || 'Admin User'} <span style={{ display: 'inline-block' }}>👋</span>
                </h1>
                <div className="d-flex flex-wrap align-items-center gap-2 text-muted" style={{ fontSize: '13px' }}>
                  <span className="badge bg-light text-secondary border">
                    ID: #{user?.employee_id || 'ADMIN001'}
                  </span>
                </div>
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2.5 flex-shrink-0">
              <Link to="/attendance" className="btn-hero-primary d-inline-flex align-items-center gap-2">
                <span>View Today's Attendance</span>
                <ArrowUpRight size={16} />
              </Link>
              <Link to="/employees" className="btn-hero-secondary d-inline-flex align-items-center gap-2">
                <UserCheck size={15} />
                <span>Manage Staff</span>
              </Link>
              <Link to="/reports" className="btn-hero-secondary d-inline-flex align-items-center gap-2">
                <FileBarChart size={15} />
                <span>Reports</span>
              </Link>
            </div>
          </div>

          {/* Bottom Live Metrics Strip */}
          <div className="hero-stats-strip">
            <div className="hero-stat-chip">
              <span className="stat-label">Today's Turnout:</span>
              <span className="stat-value" style={{ color: turnoutPercent > 0 ? '#10B981' : '#64748B' }}>
                {turnoutPercent}%
              </span>
            </div>
            <div className="hero-stat-chip">
              <span className="stat-label">Currently In Office:</span>
              <span className="stat-value text-primary">
                {loading ? '...' : (summary?.checkedIn ?? 0)} Active
              </span>
            </div>
            <div className="hero-stat-chip">
              <span className="stat-label">Total Verified:</span>
              <span className="stat-value text-success">
                {loading ? '...' : (summary?.present ?? 0)} Staff
              </span>
            </div>
            <div className="hero-stat-chip">
              <span className="stat-label">On Approved Leave:</span>
              <span className="stat-value" style={{ color: '#D97706' }}>
                {loading ? '...' : (summary?.onLeave ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards (Real Data from Attendance Summary) */}
      <div className="row g-4 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="card card-interactive h-100 p-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted fw-medium" style={{ fontSize: '13.5px' }}>Total Employees</span>
              <div className="p-2 rounded-3 bg-light text-primary">
                <Users size={18} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
              {loading ? '-' : (summary?.totalEmployees ?? '0')}
            </div>
            <div className="caption-text mt-1">Enrolled organization staff</div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="card card-interactive h-100 p-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted fw-medium" style={{ fontSize: '13.5px' }}>Present Today</span>
              <div className="p-2 rounded-3" style={{ background: '#DCFCE7', color: '#15803D' }}>
                <BadgeCheck size={18} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#15803D', letterSpacing: '-0.02em' }}>
              {loading ? '-' : (summary?.present ?? '0')}
            </div>
            <div className="caption-text mt-1 text-success">Verified check-ins</div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="card card-interactive h-100 p-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted fw-medium" style={{ fontSize: '13.5px' }}>Currently Active</span>
              <div className="p-2 rounded-3" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                <Clock size={18} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#1D4ED8', letterSpacing: '-0.02em' }}>
              {loading ? '-' : (summary?.checkedIn ?? '0')}
            </div>
            <div className="caption-text mt-1">In office now</div>
          </div>
        </div>

        <div className="col-sm-6 col-lg-3">
          <div className="card card-interactive h-100 p-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted fw-medium" style={{ fontSize: '13.5px' }}>Absent Today</span>
              <div className="p-2 rounded-3" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                <CalendarCheck size={18} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#B91C1C', letterSpacing: '-0.02em' }}>
              {loading ? '-' : (summary?.absent ?? '0')}
            </div>
            <div className="caption-text mt-1 text-danger">Unaccounted or on leave</div>
          </div>
        </div>
      </div>

      {/* Quick Access Modules */}
      <div className="mb-4">
        <h2 className="section-title">System Modules</h2>
        <div className="row g-4">
          {quickModules.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.title} className="col-md-6 col-lg-4">
                <Link to={m.path} className="text-decoration-none">
                  <div className="card card-interactive h-100 p-4">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div
                        className="p-3 rounded-3"
                        style={{ background: `${m.color}15`, color: m.color }}
                      >
                        <Icon size={22} />
                      </div>
                      <span className="badge bg-secondary">{m.badge}</span>
                    </div>
                    <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#0F172A', marginBottom: '6px' }}>
                      {m.title}
                    </h3>
                    <p className="text-muted mb-0" style={{ fontSize: '13.5px', lineHeight: 1.5 }}>
                      {m.desc}
                    </p>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {showImagePreview && (
        <ImagePreviewModal
          show={showImagePreview}
          onHide={() => setShowImagePreview(false)}
          src={user?.profile_photo_url || user?.profilePhotoUrl}
          name={user?.name}
          employeeId={user?.employee_id}
          role={user?.role}
          department={user?.department}
        />
      )}
    </div>
  );
}

function DashboardRouter() {
  const { activeView } = useAuth();
  if (activeView === 'admin') {
    return <AdminDashboardView />;
  } else {
    return <EmployeeDashboard />;
  }
}

function SettingsRouter() {
  const { activeView } = useAuth();
  if (activeView === 'admin') {
    return <AdminSettings />;
  } else {
    return (
      <div>
        <div className="mb-4">
          <h1 className="page-title">Employee Settings</h1>
          <p className="text-muted mb-0">Account preferences, sync options, and mobile device settings</p>
        </div>

        <div className="card p-4 border-0" style={{ maxWidth: '840px', boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)', borderRadius: '20px' }}>
          <div className="d-flex align-items-center gap-3 pb-3 mb-3 border-bottom" style={{ borderColor: '#F1F5F9' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #DBEAFE',
              }}
            >
              <SettingsIcon size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#0F172A', margin: 0 }}>System Preferences & Access</h3>
              <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Your active attendance configuration</p>
            </div>
          </div>

          <div className="row g-3 pt-2">
            <div className="col-md-6">
              <div className="p-3.5 rounded-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="d-flex align-items-center justify-content-between mb-1.5">
                  <span className="fw-semibold text-dark" style={{ fontSize: '13.5px' }}>GPS Geofencing</span>
                  <span className="badge" style={{ backgroundColor: '#DCFCE7', color: '#15803D', fontSize: '11px', fontWeight: 600 }}>Active</span>
                </div>
                <p className="text-muted mb-0" style={{ fontSize: '12.5px', lineHeight: 1.4 }}>
                  Verified automatically through your official Falcon Office mobile client.
                </p>
              </div>
            </div>

            <div className="col-md-6">
              <div className="p-3.5 rounded-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="d-flex align-items-center justify-content-between mb-1.5">
                  <span className="fw-semibold text-dark" style={{ fontSize: '13.5px' }}>Push Notifications</span>
                  <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#2563EB', fontSize: '11px', fontWeight: 600 }}>Enabled</span>
                </div>
                <p className="text-muted mb-0" style={{ fontSize: '12.5px', lineHeight: 1.4 }}>
                  Checkout reminder notifications are sent daily at the company reminder time.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-3 d-flex align-items-center gap-3" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <ShieldCheck size={20} className="text-primary flex-shrink-0" />
            <span style={{ fontSize: '13px', color: '#1E40AF' }}>
              Detailed device permissions, biometric unlock, and notification toggles are configured directly on your smartphone in the Falcon Office Mobile App.
            </span>
          </div>
        </div>
      </div>
    );
  }
}

function App() {
  return (
    <AuthProvider>
      <CustomAlertProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                {/* Shared Routes */}
                <Route path="/dashboard" element={<DashboardRouter />} />
                <Route path="/settings" element={<SettingsRouter />} />
                <Route path="/profile" element={<MyProfile />} />
                <Route path="/notifications" element={<NotificationsPage />} />

                {/* Admin Routes */}
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/employees" element={<AdminEmployees />} />
                  <Route path="/shifts" element={<AdminShifts />} />
                  <Route path="/attendance" element={<AdminAttendance />} />
                  <Route path="/payroll" element={<AdminPayroll />} />
                  <Route path="/reports" element={<AdminReports />} />
                  <Route path="/leave" element={<AdminLeave />} />
                  <Route path="/leave-init" element={<LeaveInitialization />} />
                </Route>

                {/* Personal Self-Service Routes (Available to Employees & Admins) */}
                <Route element={<ProtectedRoute allowedRoles={['employee', 'admin']} />}>
                  <Route path="/my-attendance" element={<MyAttendance />} />
                  <Route path="/my-leave" element={<MyLeave />} />
                  <Route path="/salary-slips" element={<SalarySlips />} />
                  <Route path="/holidays" element={<HolidayList />} />
                </Route>
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </CustomAlertProvider>
    </AuthProvider>
  );
}

export default App;
