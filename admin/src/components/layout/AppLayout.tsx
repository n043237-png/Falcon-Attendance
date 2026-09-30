import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Offcanvas, Dropdown } from 'react-bootstrap';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarRange,
  FileBarChart,
  Settings,
  FileText,
  Bell,
  UserCheck,
  LogOut,
  Menu,
  Calendar,
  User,
  ChevronDown,
  Briefcase,
  ArrowLeft,
  Clock,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import NotificationBell from '../common/NotificationBell';
import './Layout.css';

export default function AppLayout() {
  const { user, logout, activeView, setActiveView, isDualRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const isAdmin = activeView === 'admin';

  const handleSwitchView = (targetView: 'admin' | 'employee') => {
    setActiveView(targetView);
    navigate('/dashboard');
  };

  const adminLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Employees', path: '/employees', icon: Users },
    { name: 'Shifts', path: '/shifts', icon: Clock },
    { name: 'Attendance', path: '/attendance', icon: CalendarCheck },
    { name: 'My Attendance', path: '/my-attendance', icon: UserCheck },
    { name: 'Leave Management', path: '/leave', icon: CalendarRange },
    { name: 'Holidays', path: '/holidays', icon: CalendarDays },
    { name: 'Payroll', path: '/payroll', icon: Briefcase },
    { name: 'Reports', path: '/reports', icon: FileBarChart },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const employeeLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'My Attendance', path: '/my-attendance', icon: CalendarCheck },
    { name: 'My Leave', path: '/my-leave', icon: CalendarRange },
    { name: 'Holidays', path: '/holidays', icon: CalendarDays },
    { name: 'Salary Slips', path: '/salary-slips', icon: FileText },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'My Profile', path: '/profile', icon: UserCheck },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const links = isAdmin ? adminLinks : employeeLinks;

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="d-flex flex-column h-100">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <img
          src="/logo.png"
          alt="Falcon Logo"
          className="sidebar-brand-logo"
        />
        <div className="sidebar-brand-text">
          <h1>Falcon Office</h1>
          <span>{isAdmin ? 'Admin Console' : 'Employee Portal'}</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav-container">
        <div className="sidebar-section-label">Navigation</div>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.name}
              to={link.path}
              className={`sidebar-link-item ${isActive ? 'active' : ''}`}
              onClick={() => isMobile && setShowMobileSidebar(false)}
            >
              <Icon size={18} className="sidebar-icon" />
              <span>{link.name}</span>
            </Link>
          );
        })}
      </div>

      {/* User Footer */}
      <div className="sidebar-user-footer">
        <Avatar
          src={user?.profilePhotoUrl || user?.profile_photo_url}
          name={user?.name}
          size={38}
          shape="rounded"
          showBorder
          borderColor="rgba(59, 130, 246, 0.4)"
        />
        <div className="sidebar-user-info">
          <div className="sidebar-user-name" title={user?.name || 'User'}>
            {user?.name || 'User'}
          </div>
          <div className="sidebar-user-role">
            {isDualRole ? (isAdmin ? 'Admin (Dual Role)' : 'Employee (Dual Role)') : (isAdmin ? 'Administrator' : 'Employee')}
          </div>
        </div>
        <button
          className="sidebar-logout-btn"
          onClick={logout}
          title="Log out"
          aria-label="Log out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-layout-container">
      {/* Desktop Fixed Sidebar */}
      <aside className="d-none d-md-block sidebar-desktop">
        <SidebarContent />
      </aside>

      {/* Mobile Offcanvas Sidebar */}
      <Offcanvas
        show={showMobileSidebar}
        onHide={() => setShowMobileSidebar(false)}
        className="bg-dark text-white border-0"
        style={{ width: '280px', backgroundColor: '#0F172A' }}
      >
        <Offcanvas.Body className="p-0">
          <SidebarContent isMobile={true} />
        </Offcanvas.Body>
      </Offcanvas>

      {/* Main Content Area */}
      <div className="main-content-wrapper">
        {/* Mobile Header */}
        <header className="d-md-none top-navbar-mobile">
          <button
            className="btn btn-light btn-sm"
            onClick={() => setShowMobileSidebar(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="d-flex align-items-center gap-2">
            <img src="/logo.png" alt="Falcon Logo" width="28" height="28" style={{ objectFit: 'contain' }} />
            <span className="fw-bold fs-6">Falcon Portal</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            {isDualRole && (
              <button
                type="button"
                onClick={() => handleSwitchView(isAdmin ? 'employee' : 'admin')}
                className={`btn-view-switch btn-view-switch-mobile ${isAdmin ? 'admin-to-emp' : 'emp-to-admin'}`}
                title={isAdmin ? 'Switch to Employee View' : 'Back to Admin'}
              >
                {isAdmin ? (
                  <>
                    <UserCheck size={12} />
                    <span>Employee</span>
                  </>
                ) : (
                  <>
                    <ArrowLeft size={12} />
                    <span>Admin</span>
                  </>
                )}
              </button>
            )}
            <NotificationBell />
            <Avatar
              src={user?.profilePhotoUrl || user?.profile_photo_url}
              name={user?.name}
              size={32}
              shape="circle"
            />
          </div>
        </header>

        {/* Desktop Top Navbar */}
        <header className="d-none d-md-flex top-navbar-desktop">
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted fw-medium" style={{ fontSize: '13.5px' }}>Falcon Info Solutions</span>
            <span className="text-muted">/</span>
            <span className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
              {links.find((l) => l.path === location.pathname)?.name || 'Dashboard'}
            </span>
          </div>

          <div className="d-flex align-items-center gap-3">
            {isDualRole && (
              <button
                type="button"
                onClick={() => handleSwitchView(isAdmin ? 'employee' : 'admin')}
                className={`btn-view-switch ${isAdmin ? 'admin-to-emp' : 'emp-to-admin'}`}
                title={isAdmin ? 'Switch to Employee View' : 'Back to Admin'}
              >
                {isAdmin ? (
                  <>
                    <UserCheck size={14} />
                    <span>Employee View</span>
                  </>
                ) : (
                  <>
                    <ArrowLeft size={14} />
                    <span>Back to Admin</span>
                  </>
                )}
              </button>
            )}

            <div className="top-nav-date-badge">
              <Calendar size={14} className="text-primary" />
              <span>{formattedDate}</span>
            </div>

            <NotificationBell />

            <Dropdown align="end">
              <Dropdown.Toggle as="div" className="top-nav-user-toggle">
                <Avatar
                  src={user?.profilePhotoUrl || user?.profile_photo_url}
                  name={user?.name}
                  size={34}
                  shape="circle"
                  showBorder
                  borderColor="#E2E8F0"
                />
                <div className="d-flex flex-column text-start" style={{ lineHeight: 1.25 }}>
                  <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>{user?.name}</span>
                  <span className="text-muted" style={{ fontSize: '11px', letterSpacing: '0.01em' }}>
                    {user?.employee_id || (isAdmin ? 'ADMIN001' : 'EMP')}
                  </span>
                </div>
                <ChevronDown size={14} className="text-muted ms-1" />
              </Dropdown.Toggle>

              <Dropdown.Menu className="top-nav-user-menu shadow-lg" style={{ minWidth: '250px', padding: '8px' }}>
                {/* User Info Header Card */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    marginBottom: '8px',
                  }}
                >
                  <div className="d-flex align-items-center gap-2.5">
                    <Avatar
                      src={user?.profilePhotoUrl || user?.profile_photo_url}
                      name={user?.name}
                      size={40}
                      shape="circle"
                      showBorder
                      borderColor="#DBEAFE"
                    />
                    <div className="overflow-hidden flex-1">
                      <div className="d-flex align-items-center justify-content-between mb-0.5">
                        <span className="fw-bold text-dark text-truncate" style={{ fontSize: '13.5px', letterSpacing: '-0.01em' }}>
                          {user?.name || 'Administrator'}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            backgroundColor: '#EFF6FF',
                            color: '#2563EB',
                            border: '1px solid #BFDBFE',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {isDualRole ? (isAdmin ? 'ADMIN (DUAL)' : 'STAFF (DUAL)') : (isAdmin ? 'ADMIN' : 'STAFF')}
                        </span>
                      </div>
                      <div className="text-muted text-truncate" style={{ fontSize: '12px' }}>
                        {user?.email || 'admin@falconinfo.com'}
                      </div>
                    </div>
                  </div>
                </div>

                {isDualRole && (
                  <>
                    <div className="px-2 pt-1 pb-1 text-uppercase fw-bold text-muted" style={{ fontSize: '10.5px', letterSpacing: '0.06em' }}>
                      Role Switcher
                    </div>
                    <Dropdown.Item
                      onClick={() => handleSwitchView(isAdmin ? 'employee' : 'admin')}
                      className="top-nav-menu-item d-flex align-items-center justify-content-between"
                      style={{ color: '#2563EB', fontWeight: 600 }}
                    >
                      <div className="d-flex align-items-center gap-2.5">
                        {isAdmin ? <UserCheck size={15} /> : <ArrowLeft size={15} />}
                        <span>{isAdmin ? 'Switch to Employee View' : 'Back to Admin'}</span>
                      </div>
                    </Dropdown.Item>
                    <div style={{ height: '1px', background: '#E2E8F0', margin: '6px 0' }} />
                  </>
                )}

                <div className="px-2 pt-1 pb-1 text-uppercase fw-bold text-muted" style={{ fontSize: '10.5px', letterSpacing: '0.06em' }}>
                  Account
                </div>

                <Dropdown.Item as={Link} to="/profile" className="top-nav-menu-item d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2.5">
                    <User size={15} className="text-muted" />
                    <span>My Profile</span>
                  </div>
                </Dropdown.Item>

                <Dropdown.Item as={Link} to="/settings" className="top-nav-menu-item d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2.5">
                    <Settings size={15} className="text-muted" />
                    <span>Settings & Rules</span>
                  </div>
                </Dropdown.Item>

                <div style={{ height: '1px', background: '#E2E8F0', margin: '6px 0' }} />

                <Dropdown.Item
                  onClick={logout}
                  className="top-nav-menu-item logout-item d-flex align-items-center gap-2.5"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </header>

        {/* Inner Content Area with Minimal Aesthetic Background */}
        <div className="content-inner-wrapper position-relative overflow-hidden flex-1 d-flex flex-column">
          {/* Top-Right Large Glowing Blue Mesh Orb */}
          <div
            style={{
              position: 'absolute',
              top: '-15%',
              right: '-8%',
              width: '750px',
              height: '750px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.45) 0%, rgba(96, 165, 250, 0.22) 40%, rgba(191, 219, 254, 0.08) 65%, transparent 80%)',
              filter: 'blur(80px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* Bottom-Left Rich Ambient Blue Glow */}
          <div
            style={{
              position: 'absolute',
              bottom: '-18%',
              left: '-10%',
              width: '800px',
              height: '800px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.38) 0%, rgba(96, 165, 250, 0.18) 45%, rgba(191, 219, 254, 0.05) 70%, transparent 85%)',
              filter: 'blur(90px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* Geometric Orbit Arcs */}
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <circle
              cx="90%"
              cy="10%"
              r="400"
              fill="none"
              stroke="#93C5FD"
              strokeWidth="1.2"
              strokeOpacity="0.45"
            />
            <circle
              cx="8%"
              cy="90%"
              r="440"
              fill="none"
              stroke="#93C5FD"
              strokeWidth="1.2"
              strokeOpacity="0.4"
            />
          </svg>

          {/* Diagonal Glowing Tech Accent Capsules */}
          <div
            style={{
              position: 'absolute',
              top: '25%',
              right: '4%',
              width: '75px',
              height: '7px',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, rgba(96, 165, 250, 0.55) 0%, rgba(147, 197, 253, 0.15) 100%)',
              transform: 'rotate(-45deg)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '12%',
              left: '2%',
              width: '80px',
              height: '7px',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, rgba(96, 165, 250, 0.5) 0%, rgba(147, 197, 253, 0.1) 100%)',
              transform: 'rotate(-45deg)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* Inner Content Area */}
          <main className="content-inner-container position-relative" style={{ zIndex: 1 }}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
