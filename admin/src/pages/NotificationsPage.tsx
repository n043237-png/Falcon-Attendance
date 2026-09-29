import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Form, Spinner } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import NotificationPreferencesModal from '../components/common/NotificationPreferencesModal';
import {
  Bell,
  Search,
  CheckCheck,
  Trash2,
  SlidersHorizontal,
  Clock,
  Calendar,
  FileText,
  ShieldAlert,
  AlertCircle,
  AlertTriangle,
  Info,
  User,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Mail,
  Smartphone,
  Eye,
  EyeOff,
  Megaphone,
  Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  actionUrl?: string;
  action_url?: string;
  isRead: boolean;
  is_read?: boolean;
  createdAt: string;
  created_at?: string;
}

interface PreferencesData {
  in_app_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  attendance_alerts: boolean;
  leave_alerts: boolean;
  payroll_alerts: boolean;
  announcements: boolean;
}

export default function NotificationsPage() {
  const { token, activeView, hasAdminRole } = useAuth();
  const isAdminConsole = activeView === 'admin' && hasAdminRole;
  const navigate = useNavigate();

  // State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [timeframe, setTimeframe] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [searchParams, setSearchParams] = useSearchParams();

  // Preferences Modal
  const [showPrefModal, setShowPrefModal] = useState<boolean>(false);

  // Broadcast Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [broadcastTitle, setBroadcastTitle] = useState<string>('📢 Company Announcement');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('The office will remain closed on 2 October due to Gandhi Jayanti.');
  const [broadcastPriority, setBroadcastPriority] = useState<'Medium' | 'High' | 'Critical'>('High');
  const [broadcasting, setBroadcasting] = useState<boolean>(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<boolean>(false);

  // Auto-open preferences modal if URL has ?preferences=true
  useEffect(() => {
    if (searchParams.get('preferences') === 'true') {
      setShowPrefModal(true);
      searchParams.delete('preferences');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch Notifications
  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!token) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params: any = {
        page,
        limit
      };

      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (timeframe !== 'all') params.timeframe = timeframe;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (typeFilter !== 'all') params.type = typeFilter;

      const res = await axios.get(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      if (res.data.success) {
        setNotifications(res.data.data.items || []);
        setTotalCount(res.data.data.pagination.total || 0);
        setTotalPages(res.data.data.pagination.totalPages || 1);
        setUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, page, limit, debouncedSearch, timeframe, statusFilter, priorityFilter, typeFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleOpenPreferences = () => {
    setShowPrefModal(true);
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim() || !token) return;

    try {
      setBroadcasting(true);
      await axios.post(`${API_BASE}/api/notifications/broadcast`, {
        title: broadcastTitle.trim() || '📢 Company Announcement',
        message: broadcastMessage.trim(),
        priority: broadcastPriority,
        target: 'employee'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBroadcastSuccess(true);
      fetchNotifications(true);
      setTimeout(() => {
        setBroadcastSuccess(false);
        setShowBroadcastModal(false);
      }, 1200);
    } catch (err: any) {
      console.error('Broadcast failed:', err);
    } finally {
      setBroadcasting(false);
    }
  };

  // Mark single notification read / unread toggle
  const toggleReadStatus = async (item: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentlyRead = item.isRead || item.is_read;
    try {
      if (isCurrentlyRead) {
        // Toggle to unread
        await axios.patch(`${API_BASE}/api/notifications/${item.id}/read`, { isRead: false }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: false, is_read: false } : n))
        );
        setUnreadCount((c) => c + 1);
      } else {
        // Mark as read
        await axios.put(`${API_BASE}/api/notifications/${item.id}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error('Error toggling read status:', err);
    }
  };

  // Mark all notifications read
  const handleMarkAllRead = async () => {
    if (!token) return;
    try {
      await axios.put(`${API_BASE}/api/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, is_read: true }))
      );
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  // Delete notification (soft delete)
  const handleDeleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    try {
      await axios.delete(`${API_BASE}/api/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  // Helper: Format relative or full time
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Helper: Icon per category
  const getTypeIcon = (type?: string, priority?: string) => {
    const p = (priority || '').toLowerCase();
    if (p === 'critical') return <AlertCircle size={18} className="text-danger" />;
    if (p === 'high') return <AlertTriangle size={18} className="text-warning" />;

    const t = (type || '').toLowerCase();
    switch (t) {
      case 'attendance':
        return <Clock size={18} className="text-primary" />;
      case 'leave':
        return <Calendar size={18} className="text-warning" />;
      case 'payroll':
        return <FileText size={18} className="text-success" />;
      case 'security':
        return <ShieldAlert size={18} className="text-danger" />;
      case 'profile':
      case 'employee':
        return <User size={18} className="text-info" />;
      default:
        return <Info size={18} className="text-primary" />;
    }
  };

  const getTypeBg = (type?: string, priority?: string) => {
    const p = (priority || '').toLowerCase();
    if (p === 'critical') return 'rgba(239, 68, 68, 0.12)';
    if (p === 'high') return 'rgba(245, 158, 11, 0.12)';

    const t = (type || '').toLowerCase();
    switch (t) {
      case 'attendance':
        return 'rgba(37, 99, 235, 0.1)';
      case 'leave':
        return 'rgba(245, 158, 11, 0.1)';
      case 'payroll':
        return 'rgba(16, 185, 129, 0.1)';
      case 'security':
        return 'rgba(239, 68, 68, 0.1)';
      case 'profile':
      case 'employee':
        return 'rgba(14, 165, 233, 0.1)';
      default:
        return 'rgba(99, 102, 241, 0.1)';
    }
  };

  const getPriorityBadgeStyle = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' };
      case 'High':
        return { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' };
      case 'Medium':
        return { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' };
      default:
        return { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' };
    }
  };

  // Stats calculation
  const criticalOrHighCount = notifications.filter(
    (n) => n.priority === 'Critical' || n.priority === 'High'
  ).length;

  return (
    <div className="content-inner-container">
      {/* Header Banner */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h1 className="page-title mb-0" style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A' }}>
              Notifications Hub
            </h1>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  border: '1px solid #BFDBFE'
                }}
              >
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-muted mb-0" style={{ fontSize: '13.5px' }}>
            Real-time corporate updates, attendance alerts, leave requests, and administrative notifications.
          </p>
        </div>

        {/* Top Header Actions */}
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            onClick={() => fetchNotifications(true)}
            disabled={refreshing}
            className="btn btn-light d-flex align-items-center gap-1.5"
            style={{
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#334155',
              borderRadius: '8px',
              padding: '7px 12px'
            }}
            title="Refresh notifications"
          >
            <RefreshCw size={14} className={refreshing ? 'spin-animation' : ''} />
            <span className="d-none d-sm-inline">Refresh</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="btn btn-light d-flex align-items-center gap-1.5"
              style={{
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#2563EB',
                borderRadius: '8px',
                padding: '7px 12px'
              }}
            >
              <CheckCheck size={14} />
              <span>Mark all read</span>
            </button>
          )}

          {isAdminConsole && (
            <button
              type="button"
              onClick={() => setShowBroadcastModal(true)}
              className="btn btn-dark d-flex align-items-center gap-1.5 text-white"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
                padding: '7px 14px',
                backgroundColor: '#0F172A',
                borderColor: '#0F172A'
              }}
            >
              <Megaphone size={14} />
              <span>Broadcast</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenPreferences}
            className="btn btn-primary d-flex align-items-center gap-1.5"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              padding: '7px 14px'
            }}
          >
            <SlidersHorizontal size={14} />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div
            className="p-3 rounded-3 bg-white"
            style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Records
              </span>
              <Bell size={16} className="text-primary" />
            </div>
            <div className="fw-bold text-dark" style={{ fontSize: '22px' }}>
              {totalCount}
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div
            className="p-3 rounded-3 bg-white"
            style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                Unread Alerts
              </span>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: unreadCount > 0 ? '#2563EB' : '#94A3B8'
                }}
              />
            </div>
            <div className="fw-bold" style={{ fontSize: '22px', color: unreadCount > 0 ? '#2563EB' : '#0F172A' }}>
              {unreadCount}
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div
            className="p-3 rounded-3 bg-white"
            style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                High & Critical
              </span>
              <AlertTriangle size={16} className="text-warning" />
            </div>
            <div className="fw-bold text-dark" style={{ fontSize: '22px' }}>
              {criticalOrHighCount}
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div
            className="p-3 rounded-3 bg-white"
            style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                Real-Time Push
              </span>
              <Smartphone size={16} className="text-success" />
            </div>
            <div className="fw-bold text-success" style={{ fontSize: '22px' }}>
              Active
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card border-0 mb-4 p-3 bg-white rounded-3"
        style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
      >
        <div className="row g-2 align-items-center">
          {/* Search Box */}
          <div className="col-12 col-md-4">
            <div className="position-relative">
              <Search
                size={16}
                className="position-absolute text-muted"
                style={{ top: '50%', transform: 'translateY(-50%)', left: '12px' }}
              />
              <input
                type="text"
                placeholder="Search title, content or details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-control"
                style={{
                  paddingLeft: '36px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  borderColor: '#E2E8F0'
                }}
              />
            </div>
          </div>

          {/* Timeframe Tabs */}
          <div className="col-12 col-md-3">
            <div className="btn-group w-100" role="group">
              {[
                { label: 'All', val: 'all' },
                { label: 'Today', val: 'today' },
                { label: 'Week', val: 'week' },
                { label: 'Month', val: 'month' }
              ].map((t) => (
                <button
                  key={t.val}
                  type="button"
                  onClick={() => {
                    setTimeframe(t.val as any);
                    setPage(1);
                  }}
                  className={`btn btn-sm ${timeframe === t.val ? 'btn-primary' : 'btn-light'}`}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    borderColor: '#E2E8F0'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Select */}
          <div className="col-6 col-md-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="form-select form-select-sm"
              style={{ fontSize: '12.5px', borderRadius: '8px', borderColor: '#E2E8F0' }}
            >
              <option value="all">Status: All</option>
              <option value="unread">Unread Only</option>
              <option value="read">Read Only</option>
            </select>
          </div>

          {/* Priority Select */}
          <div className="col-6 col-md-1.5 col-lg-1.5">
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="form-select form-select-sm"
              style={{ fontSize: '12.5px', borderRadius: '8px', borderColor: '#E2E8F0' }}
            >
              <option value="all">Priority: All</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Category Select */}
          <div className="col-12 col-md-1.5 col-lg-1.5">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="form-select form-select-sm"
              style={{ fontSize: '12.5px', borderRadius: '8px', borderColor: '#E2E8F0' }}
            >
              <option value="all">Category: All</option>
              <option value="Attendance">Attendance</option>
              <option value="Leave">Leave</option>
              <option value="Payroll">Payroll</option>
              <option value="Profile">Profile</option>
              <option value="Employee">Employee</option>
              <option value="Security">Security</option>
              <option value="Announcement">Announcement</option>
              <option value="System">System</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications List Card */}
      <div
        className="card border-0 bg-white rounded-3 shadow-sm overflow-hidden"
        style={{ border: '1px solid #E2E8F0' }}
      >
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <div className="text-muted mt-2 small">Loading notifications...</div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-5 px-3">
            <div
              className="d-inline-flex p-3 rounded-circle mb-3"
              style={{ backgroundColor: '#F8FAFC', color: '#94A3B8' }}
            >
              <Bell size={28} />
            </div>
            <h2 className="fw-bold text-dark h5 mb-1">No notifications found</h2>
            <p className="text-muted small mb-3">
              {search || timeframe !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your filters or search keywords.'
                : "You don't have any notifications right now."}
            </p>
            {(search || timeframe !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setTimeframe('all');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setTypeFilter('all');
                  setPage(1);
                }}
                className="btn btn-sm btn-outline-primary"
                style={{ borderRadius: '6px' }}
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="d-flex flex-column">
            {notifications.map((item) => {
              const isRead = item.isRead || item.is_read;
              const dateStr = item.createdAt || item.created_at || '';
              const prioStyle = getPriorityBadgeStyle(item.priority);
              const targetUrl = item.actionUrl || item.action_url;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (targetUrl) {
                      if (!isRead) {
                        axios.put(`${API_BASE}/api/notifications/${item.id}/read`, {}, {
                          headers: { Authorization: `Bearer ${token}` }
                        }).catch(() => {});
                        setNotifications((prev) =>
                          prev.map((n) => (n.id === item.id ? { ...n, isRead: true, is_read: true } : n))
                        );
                        setUnreadCount((c) => Math.max(0, c - 1));
                      }
                      navigate(targetUrl);
                    }
                  }}
                  className="d-flex flex-column flex-md-row align-items-md-center justify-content-between p-3.5 transition-all"
                  style={{
                    backgroundColor: isRead ? '#FFFFFF' : '#F8FAFC',
                    borderBottom: '1px solid #F1F5F9',
                    borderLeft: isRead ? '3px solid transparent' : '3px solid #2563EB',
                    transition: 'all 0.15s ease',
                    cursor: targetUrl ? 'pointer' : 'default'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isRead ? '#F8FAFC' : '#F1F5F9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isRead ? '#FFFFFF' : '#F8FAFC';
                  }}
                >
                  {/* Left: Icon and Details */}
                  <div className="d-flex align-items-start gap-3 flex-grow-1 min-width-0 pe-md-3">
                    {/* Icon */}
                    <div
                      className="flex-shrink-0 d-flex align-items-center justify-content-center rounded-3 mt-1"
                      style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: getTypeBg(item.type, item.priority)
                      }}
                    >
                      {getTypeIcon(item.type, item.priority)}
                    </div>

                    {/* Content */}
                    <div className="flex-grow-1 min-width-0">
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <span
                          className={`text-truncate ${isRead ? 'fw-semibold text-secondary' : 'fw-bold text-dark'}`}
                          style={{ fontSize: '14.5px' }}
                        >
                          {item.title}
                        </span>

                        {/* Priority Badge */}
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1.5px 7px',
                            borderRadius: '5px',
                            backgroundColor: prioStyle.bg,
                            color: prioStyle.color,
                            border: `1px solid ${prioStyle.border}`,
                            letterSpacing: '0.02em'
                          }}
                        >
                          {item.priority}
                        </span>

                        {/* Category Badge */}
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            padding: '1.5px 7px',
                            borderRadius: '5px',
                            backgroundColor: '#F1F5F9',
                            color: '#475569'
                          }}
                        >
                          {item.type}
                        </span>

                        {/* Relative time */}
                        <span className="text-muted ms-auto small" style={{ fontSize: '12px' }}>
                          {formatTimeAgo(dateStr)}
                        </span>
                      </div>

                      <p
                        className="text-muted mb-2"
                        style={{ fontSize: '13px', lineHeight: 1.5, wordBreak: 'break-word' }}
                      >
                        {item.message}
                      </p>

                      <div className="d-flex flex-wrap align-items-center gap-3">
                        <span className="text-muted" style={{ fontSize: '11.5px' }}>
                          {formatDateTime(dateStr)}
                        </span>

                        {targetUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(targetUrl);
                            }}
                            className="btn btn-link text-decoration-none p-0 d-inline-flex align-items-center gap-1"
                            style={{ fontSize: '12px', color: '#2563EB', fontWeight: 600 }}
                          >
                            <span>Open Link</span>
                            <ExternalLink size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="d-flex align-items-center gap-2 mt-2 mt-md-0 flex-shrink-0 ms-auto">
                    <button
                      type="button"
                      onClick={(e) => toggleReadStatus(item, e)}
                      className="btn btn-sm btn-light border-0 d-flex align-items-center gap-1"
                      style={{
                        fontSize: '12px',
                        color: isRead ? '#64748B' : '#2563EB',
                        backgroundColor: isRead ? '#F1F5F9' : '#EFF6FF',
                        padding: '6px 10px',
                        borderRadius: '6px'
                      }}
                      title={isRead ? 'Mark as unread' : 'Mark as read'}
                    >
                      {isRead ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span className="d-none d-lg-inline">{isRead ? 'Unread' : 'Read'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteNotification(item.id, e)}
                      className="btn btn-sm btn-light border-0 text-danger d-flex align-items-center justify-content-center"
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: '#FEF2F2',
                        borderRadius: '6px'
                      }}
                      title="Delete notification"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div
            className="d-flex align-items-center justify-content-between px-3.5 py-3 bg-white"
            style={{ borderTop: '1px solid #F1F5F9' }}
          >
            <div className="text-muted small">
              Showing page <strong className="text-dark">{page}</strong> of{' '}
              <strong className="text-dark">{totalPages}</strong> ({totalCount} total)
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-sm btn-light d-flex align-items-center gap-1"
                style={{ borderRadius: '6px', fontSize: '12.5px' }}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn btn-sm btn-light d-flex align-items-center gap-1"
                style={{ borderRadius: '6px', fontSize: '12.5px' }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notification Preferences Modal */}
      <NotificationPreferencesModal
        show={showPrefModal}
        onHide={() => setShowPrefModal(false)}
      />

      {/* Broadcast Announcement Modal */}
      {isAdminConsole && (
        <Modal show={showBroadcastModal} onHide={() => setShowBroadcastModal(false)} centered>
          <Modal.Header closeButton style={{ borderBottom: '1px solid #E2E8F0' }}>
            <Modal.Title style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
              Broadcast Company Announcement
            </Modal.Title>
          </Modal.Header>

          <form onSubmit={handleBroadcast}>
            <Modal.Body className="p-4">
              <p className="text-muted small mb-3">
                Send an instant push notification and announcement to all employee mobile devices and web consoles.
              </p>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-dark">Announcement Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="e.g. 📢 Company Announcement"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-dark">Message</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="The office will remain closed on 2 October due to Gandhi Jayanti."
                  required
                />
              </div>

              <div className="mb-2">
                <label className="form-label small fw-semibold text-dark">Priority</label>
                <select
                  className="form-select"
                  value={broadcastPriority}
                  onChange={(e) => setBroadcastPriority(e.target.value as any)}
                >
                  <option value="Medium">Medium</option>
                  <option value="High">High (Recommended)</option>
                  <option value="Critical">Critical (Bypasses category filters)</option>
                </select>
              </div>

              {broadcastSuccess && (
                <div
                  className="alert alert-success d-flex align-items-center gap-2 mt-3 mb-0 p-2.5"
                  style={{ fontSize: '12.5px' }}
                >
                  <CheckCircle2 size={16} />
                  <span>Announcement broadcasted and sent to all devices!</span>
                </div>
              )}
            </Modal.Body>

            <Modal.Footer style={{ borderTop: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="btn btn-light"
                style={{ borderRadius: '8px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={broadcasting || !broadcastMessage.trim()}
                className="btn btn-primary d-flex align-items-center gap-1.5"
                style={{ borderRadius: '8px', fontSize: '13px', fontWeight: 600, backgroundColor: '#2563EB' }}
              >
                {broadcasting ? <Spinner animation="border" size="sm" /> : <Send size={14} />}
                <span>Send Broadcast</span>
              </button>
            </Modal.Footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
