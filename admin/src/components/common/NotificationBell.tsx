import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dropdown } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Bell,
  CheckCheck,
  Clock,
  AlertTriangle,
  AlertCircle,
  Info,
  Calendar,
  ShieldAlert,
  FileText,
  User,
  Settings,
  ChevronRight,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationPreferencesModal from './NotificationPreferencesModal';

export interface NotificationItem {
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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function NotificationBell() {
  const { token, activeView } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [showPrefModal, setShowPrefModal] = useState<boolean>(false);
  const [activeToasts, setActiveToasts] = useState<(NotificationItem & { toastId: string })[]>([]);
  const seenNotificationIdsRef = useRef<Set<number>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimerRef = useRef<any>(null);

  // Helper: Play gentle notification audio chime
  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Quiet fail if audio blocked by browser policy
    }
  };

  // Helper: Pop up real-time floating message banner
  const triggerPopUpMessage = useCallback((item: NotificationItem) => {
    if (!item || !item.id) return;

    // Strict role/view separation:
    const itemRole = (item as any).role?.toLowerCase();
    if (activeView === 'admin') {
      if (itemRole === 'employee') return;
      if (item.title === 'Attendance Marked Absent' && item.message?.includes('You have been marked absent')) return;
    } else {
      if (itemRole === 'admin') return;
      if (item.title === 'Absent Alert') return;
    }

    if (seenNotificationIdsRef.current.has(item.id)) return;
    seenNotificationIdsRef.current.add(item.id);

    playNotificationChime();

    const toastId = `toast-${item.id}-${Date.now()}`;
    const toastObj = { ...item, toastId };

    setActiveToasts((prev) => [toastObj, ...prev.slice(0, 2)]);

    // Auto dismiss after 8 seconds
    setTimeout(() => {
      setActiveToasts((prev) => prev.filter((t) => t.toastId !== toastId));
    }, 8000);

    // Native browser desktop notification if granted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(item.title, {
            body: item.message,
            icon: '/favicon.ico',
          });
        } catch {
          // Quiet fail
        }
      } else if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [activeView]);

  // Helper: Format relative time
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

  // Helper: Get icon based on category/type
  const getTypeIcon = (type?: string, priority?: string) => {
    const p = (priority || '').toLowerCase();
    if (p === 'critical') return <AlertCircle size={15} className="text-danger" />;
    if (p === 'high') return <AlertTriangle size={15} className="text-warning" />;

    const t = (type || '').toLowerCase();
    switch (t) {
      case 'attendance':
        return <Clock size={15} className="text-primary" />;
      case 'leave':
        return <Calendar size={15} className="text-warning" />;
      case 'payroll':
        return <FileText size={15} className="text-success" />;
      case 'security':
        return <ShieldAlert size={15} className="text-danger" />;
      case 'profile':
      case 'employee':
        return <User size={15} className="text-info" />;
      default:
        return <Info size={15} className="text-primary" />;
    }
  };

  // Helper: Get icon background based on category
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

  // Fetch unread count & recent notifications
  const fetchUnread = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/api/notifications/unread`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'x-active-view': activeView 
        },
        params: { view: activeView }
      });
      if (res.data?.success && res.data?.data) {
        setUnreadCount(res.data.data.unreadCount ?? 0);
        const list: NotificationItem[] = res.data.data.items || res.data.data.latest || [];
        setNotifications(list);

        // Check if there is an unread attendance / late alert in the latest items that we haven't popped up yet
        list.forEach((item) => {
          const createdAt = new Date(item.createdAt || item.created_at || 0).getTime();
          const isRecent = Date.now() - createdAt < 30 * 60 * 1000; // within last 30 minutes
          const isLateOrAttendance = item.title?.toLowerCase().includes('late') || item.type?.toLowerCase() === 'attendance';
          if (!item.isRead && !item.is_read && isRecent && isLateOrAttendance && !seenNotificationIdsRef.current.has(item.id)) {
            triggerPopUpMessage(item);
          }
        });
      }
    } catch (err) {
      // Quiet fail
    }
  }, [token, activeView, triggerPopUpMessage]);

  // Setup SSE stream with fallback polling
  useEffect(() => {
    if (!token) return;

    fetchUnread();

    try {
      const sseUrl = `${API_BASE}/api/notifications/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const notif = data.notification || (data.event === 'notification' ? data.data : null);

          if (notif && (data.type === 'new_notification' || data.event === 'notification')) {
            const notifRole = (notif.role || '').toLowerCase();
            const matchesView = activeView === 'admin'
              ? (notifRole === 'admin' || notifRole === 'all')
              : (notifRole === 'employee' || notifRole === 'all');

            // Explicit safeguard: never show employee attendance alerts in admin view
            if (activeView === 'admin' && (notifRole === 'employee' || notif.title === 'Attendance Marked Absent')) {
              return;
            }

            if (matchesView) {
              setUnreadCount((prev) => prev + 1);
              setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id).slice(0, 9)]);
              triggerPopUpMessage(notif);
            }
          } else if (data.type === 'unread_count_updated') {
            fetchUnread();
          }
        } catch (parseErr) {
          console.error('Failed to parse SSE payload', parseErr);
        }
      };

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          es.close();
        }
      };
    } catch (sseErr) {
      console.warn('SSE error, fallback to polling:', sseErr);
    }

    // Active polling fallback
    pollingTimerRef.current = setInterval(() => {
      fetchUnread();
    }, 15000);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [token, activeView, fetchUnread, triggerPopUpMessage]);

  // Mark single notification as read
  const handleMarkAsRead = async (item: NotificationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isCurrentlyRead = item.isRead || item.is_read;
    if (isCurrentlyRead) {
      if (item.actionUrl || item.action_url) {
        navigate(item.actionUrl || item.action_url!);
        setDropdownOpen(false);
      }
      return;
    }

    try {
      await axios.put(`${API_BASE}/api/notifications/${item.id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true, is_read: true } : n))
      );
    } catch (err) {
      console.error('Error marking as read:', err);
    }

    const targetUrl = item.actionUrl || item.action_url;
    if (targetUrl) {
      navigate(targetUrl);
      setDropdownOpen(false);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await axios.put(`${API_BASE}/api/notifications/read-all`, {}, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'x-active-view': activeView 
        },
        params: { view: activeView }
      });
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, is_read: true }))
      );
    } catch (err) {
      console.error('Error marking all as read:', err);
    } finally {
      setLoading(false);
    }
  };

  // Double-layer role separation safeguard
  const displayedNotifications = notifications.filter((item) => {
    const itemRole = (item as any).role?.toLowerCase();
    if (activeView === 'admin') {
      if (itemRole === 'employee') return false;
      if (item.title === 'Attendance Marked Absent' && item.message?.includes('You have been marked absent')) return false;
      return true;
    } else {
      if (itemRole === 'admin') return false;
      if (item.title === 'Absent Alert') return false;
      return true;
    }
  });

  return (
    <>
    <Dropdown
      show={dropdownOpen}
      onToggle={(isOpen) => {
        setDropdownOpen(isOpen);
        if (isOpen) fetchUnread();
      }}
      align="end"
      className="notification-bell-dropdown"
    >
      <Dropdown.Toggle
        as="button"
        className="btn p-0 border-0 bg-transparent position-relative d-flex align-items-center justify-content-center"
        aria-label="Notifications"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          backgroundColor: dropdownOpen ? '#EEF2F6' : '#F8FAFC',
          border: '1px solid #E2E8F0',
          transition: 'all 0.15s ease',
          color: '#334155',
          cursor: 'pointer'
        }}
      >
        <Bell size={18} className={unreadCount > 0 ? 'text-primary' : 'text-secondary'} />
        {unreadCount > 0 && (
          <span
            className="position-absolute badge rounded-pill"
            style={{
              top: '-4px',
              right: '-4px',
              fontSize: '10px',
              fontWeight: 700,
              padding: '2.5px 5.5px',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              boxShadow: '0 0 0 2px #FFFFFF, 0 2px 4px rgba(239, 68, 68, 0.35)',
              lineHeight: 1
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu
        className="shadow-xl border-0 p-0 overflow-hidden"
        style={{
          width: '380px',
          maxWidth: '92vw',
          borderRadius: '14px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 40px -12px rgba(15, 23, 42, 0.18), 0 0 1px 1px rgba(15, 23, 42, 0.05)',
          marginTop: '10px',
          zIndex: 1050
        }}
      >
        {/* Header */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2.5"
          style={{
            borderBottom: '1px solid #F1F5F9',
            background: '#FAFBFD'
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold text-dark" style={{ fontSize: '14px', letterSpacing: '-0.01em' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: '10px',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  border: '1px solid #DBEAFE'
                }}
              >
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="d-flex align-items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="btn btn-link text-decoration-none p-0 d-flex align-items-center gap-1"
                style={{ fontSize: '12px', color: '#2563EB', fontWeight: 500 }}
                title="Mark all as read"
              >
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div
          style={{
            maxHeight: '360px',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          {displayedNotifications.length === 0 ? (
            <div className="text-center py-5 px-3">
              <div
                className="d-inline-flex p-3 rounded-circle mb-2"
                style={{ backgroundColor: '#F8FAFC', color: '#94A3B8' }}
              >
                <Bell size={22} />
              </div>
              <div className="fw-semibold text-dark" style={{ fontSize: '13.5px' }}>
                All caught up!
              </div>
              <div className="text-muted small mt-0.5">
                No new alerts or notifications at this time.
              </div>
            </div>
          ) : (
            displayedNotifications.map((item) => {
              const isRead = item.isRead || item.is_read;
              const dateStr = item.createdAt || item.created_at || '';
              return (
                <div
                  key={item.id}
                  onClick={(e) => handleMarkAsRead(item, e)}
                  className="d-flex align-items-start gap-2.5 px-3 py-2.5"
                  style={{
                    backgroundColor: isRead ? '#FFFFFF' : '#F0F7FF',
                    borderBottom: '1px solid #F1F5F9',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isRead ? '#F8FAFC' : '#E6F0FA';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isRead ? '#FFFFFF' : '#F0F7FF';
                  }}
                >
                  {/* Category / Status Icon */}
                  <div
                    className="flex-shrink-0 d-flex align-items-center justify-content-center mt-0.5"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: getTypeBg(item.type, item.priority)
                    }}
                  >
                    {getTypeIcon(item.type, item.priority)}
                  </div>

                  {/* Body */}
                  <div className="flex-grow-1 min-width-0">
                    <div className="d-flex align-items-center justify-content-between gap-1 mb-0.5">
                      <span
                        className={`text-truncate ${isRead ? 'text-secondary fw-semibold' : 'text-dark fw-bold'}`}
                        style={{ fontSize: '13px' }}
                      >
                        {item.title}
                      </span>
                      <span className="text-muted flex-shrink-0" style={{ fontSize: '11px' }}>
                        {formatTimeAgo(dateStr)}
                      </span>
                    </div>

                    <p
                      className="text-muted mb-1 text-truncate"
                      style={{
                        fontSize: '12px',
                        lineHeight: 1.4,
                        whiteSpace: 'normal',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {item.message}
                    </p>

                    <div className="d-flex align-items-center gap-1.5 mt-1">
                      {item.priority && item.priority !== 'Low' && item.priority !== 'Medium' && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: item.priority === 'Critical' ? '#FEF2F2' : '#FFFBEB',
                            color: item.priority === 'Critical' ? '#DC2626' : '#D97706',
                            border: `1px solid ${item.priority === 'Critical' ? '#FECACA' : '#FDE68A'}`
                          }}
                        >
                          {item.priority}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#64748B',
                          background: '#F1F5F9',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {item.type}
                      </span>
                    </div>
                  </div>

                  {/* Unread Indicator Dot */}
                  {!isRead && (
                    <div
                      className="flex-shrink-0 mt-2"
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#2563EB',
                        boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.2)'
                      }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2"
          style={{
            borderTop: '1px solid #F1F5F9',
            background: '#FAFBFD'
          }}
        >
          <Link
            to="/notifications"
            onClick={() => setDropdownOpen(false)}
            className="text-decoration-none fw-semibold d-flex align-items-center gap-1"
            style={{ fontSize: '12.5px', color: '#2563EB' }}
          >
            <span>View all notifications</span>
            <ChevronRight size={13} />
          </Link>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropdownOpen(false);
              setShowPrefModal(true);
            }}
            className="btn btn-link text-muted text-decoration-none d-flex align-items-center gap-1 p-0"
            style={{ fontSize: '11.5px' }}
            title="Notification Preferences"
          >
            <Settings size={12} />
            <span>Preferences</span>
          </button>
        </div>
      </Dropdown.Menu>
    </Dropdown>

    <NotificationPreferencesModal
      show={showPrefModal}
      onHide={() => setShowPrefModal(false)}
    />

    {/* Floating Real-Time Pop-Up Messages (Toasts) */}
    {activeToasts.length > 0 && (
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '420px',
          width: 'calc(100vw - 32px)',
          pointerEvents: 'none',
        }}
      >
        {activeToasts.map((toast) => {
          const action = toast.actionUrl || toast.action_url;
          const tTitle = (toast.title || '').toLowerCase();
          
          let toastStyle = {
            badge: '🔔 REAL-TIME NOTIFICATION',
            badgeBg: '#EFF6FF',
            badgeColor: '#1D4ED8',
            badgeBorder: '#BFDBFE',
            border: '1.5px solid #E2E8F0',
            shadow: '0 12px 32px -4px rgba(15, 23, 42, 0.16)',
            iconBg: '#EFF6FF',
            iconColor: '#2563EB',
            progressBg: '#2563EB',
            icon: <Bell size={19} />,
            actionText: 'View Details',
            actionColor: '#2563EB',
          };

          if (tTitle.includes('absent')) {
            toastStyle = {
              badge: '🚨 ABSENT ALERT',
              badgeBg: '#FEE2E2',
              badgeColor: '#B91C1C',
              badgeBorder: '#FECACA',
              border: '2px solid #EF4444',
              shadow: '0 12px 36px -4px rgba(239, 68, 68, 0.3), 0 4px 16px rgba(15, 23, 42, 0.1)',
              iconBg: '#FEF2F2',
              iconColor: '#DC2626',
              progressBg: '#EF4444',
              icon: <AlertCircle size={19} />,
              actionText: 'Review in Attendance',
              actionColor: '#DC2626',
            };
          } else if (tTitle.includes('late')) {
            toastStyle = {
              badge: '⚠️ LATE CHECK-IN',
              badgeBg: '#FEF3C7',
              badgeColor: '#B45309',
              badgeBorder: '#FDE68A',
              border: '2px solid #F59E0B',
              shadow: '0 12px 36px -4px rgba(245, 158, 11, 0.3), 0 4px 16px rgba(15, 23, 42, 0.1)',
              iconBg: '#FFFBEB',
              iconColor: '#D97706',
              progressBg: '#F59E0B',
              icon: <Clock size={19} />,
              actionText: 'Review in Attendance',
              actionColor: '#D97706',
            };
          } else if (tTitle.includes('missing') || tTitle.includes('check-out')) {
            toastStyle = {
              badge: '⏰ MISSING CHECK-OUT',
              badgeBg: '#FFEDD5',
              badgeColor: '#C2410C',
              badgeBorder: '#FED7AA',
              border: '2px solid #EA580C',
              shadow: '0 12px 36px -4px rgba(234, 88, 12, 0.3), 0 4px 16px rgba(15, 23, 42, 0.1)',
              iconBg: '#FFF7ED',
              iconColor: '#EA580C',
              progressBg: '#EA580C',
              icon: <AlertTriangle size={19} />,
              actionText: 'Review in Attendance',
              actionColor: '#EA580C',
            };
          } else if (tTitle.includes('leave')) {
            toastStyle = {
              badge: '📅 NEW LEAVE REQUEST',
              badgeBg: '#EEF2FF',
              badgeColor: '#4338CA',
              badgeBorder: '#C7D2FE',
              border: '2px solid #6366F1',
              shadow: '0 12px 36px -4px rgba(99, 102, 241, 0.3), 0 4px 16px rgba(15, 23, 42, 0.1)',
              iconBg: '#EEF2FF',
              iconColor: '#4F46E5',
              progressBg: '#6366F1',
              icon: <Calendar size={19} />,
              actionText: 'Review Leave Request',
              actionColor: '#4F46E5',
            };
          }

          return (
            <div
              key={toast.toastId}
              className="toast-popup-card"
              style={{
                pointerEvents: 'auto',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: toastStyle.border,
                boxShadow: toastStyle.shadow,
                padding: '16px',
                animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center gap-2">
                  <span
                    className="badge rounded-pill d-inline-flex align-items-center gap-1"
                    style={{
                      backgroundColor: toastStyle.badgeBg,
                      color: toastStyle.badgeColor,
                      border: `1px solid ${toastStyle.badgeBorder}`,
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {toastStyle.badge}
                  </span>
                  <span className="text-muted" style={{ fontSize: '11px' }}>
                    Just now
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveToasts((prev) => prev.filter((t) => t.toastId !== toast.toastId))}
                  className="btn btn-sm border-0 p-0 text-muted"
                  style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Body */}
              <div className="d-flex align-items-start gap-3">
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: toastStyle.iconBg,
                    color: toastStyle.iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: `1px solid ${toastStyle.badgeBorder}`,
                  }}
                >
                  {toastStyle.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fw-bold text-dark" style={{ fontSize: '13.5px', lineHeight: 1.3 }}>
                    {toast.title}
                  </div>
                  <div className="text-secondary mt-1" style={{ fontSize: '12.5px', lineHeight: 1.45 }}>
                    {toast.message}
                  </div>

                  {/* Action Link */}
                  {action && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveToasts((prev) => prev.filter((t) => t.toastId !== toast.toastId));
                        handleMarkAsRead(toast);
                      }}
                      className="btn btn-sm btn-link p-0 text-decoration-none fw-semibold d-inline-flex align-items-center gap-1 mt-2"
                      style={{ fontSize: '12.5px', color: toastStyle.actionColor }}
                    >
                      <span>{toastStyle.actionText}</span>
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar counting down */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '3px',
                  backgroundColor: toastStyle.progressBg,
                  width: '100%',
                  animation: 'toastProgress 8s linear forwards',
                }}
              />
            </div>
          );
        })}
      </div>
    )}
    </>
  );
}
