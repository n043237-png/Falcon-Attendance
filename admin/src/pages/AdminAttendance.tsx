import React, { useState, useEffect } from 'react';
import { Form, Row, Col, Spinner, Alert, Pagination, Modal, Button, Tabs, Tab, Badge } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarCheck,
  Search,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  MapPin,
  Building,
  Camera,
  ExternalLink,
  X,
  Monitor,
  Smartphone,
  History,
  Edit3,
  RotateCcw,
  FileText,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import ImagePreviewModal from '../components/common/ImagePreviewModal';

export default function AdminAttendance() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const normalizeStatus = (s: string | null) => {
    if (!s) return 'All';
    const upper = s.toUpperCase().trim();
    if (upper === 'ABSENT') return 'Absent';
    if (upper === 'LATE') return 'Late';
    if (upper === 'PRESENT') return 'Present';
    if (upper === 'HALF_DAY' || upper === 'HALF DAY') return 'Half Day';
    if (upper === 'ON_LEAVE' || upper === 'ON LEAVE') return 'On Leave';
    if (upper === 'CHECKED_IN' || upper === 'CHECKED IN') return 'Checked In';
    if (upper === 'CHECKED_OUT' || upper === 'CHECKED OUT') return 'Checked Out';
    if (upper === 'MISSING_CHECKOUT' || upper === 'MISSING CHECKOUT') return 'Missing Checkout';
    if (upper === 'INSUFFICIENT_HOURS' || upper === 'INSUFFICIENT HOURS') return 'Insufficient Hours';
    return s;
  };

  const initialDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const initialStatus = normalizeStatus(searchParams.get('status'));
  const initialSearch = searchParams.get('search') || '';

  const [date, setDate] = useState(initialDate);
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const [shiftFilter, setShiftFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [availableShifts, setAvailableShifts] = useState<any[]>([]);

  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewEmployee, setPreviewEmployee] = useState<any>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Timeline & Regularization State
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'regularize'>('timeline');

  // Regularization form fields
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editStatus, setEditStatus] = useState('AUTO');
  const [regReason, setRegReason] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);

  const openTimelineModal = async (record: any) => {
    setSelectedRecord(record);
    setShowTimelineModal(true);
    setActiveTab('timeline');
    setRegSuccess(null);
    setRegError(null);
    setRegReason('');
    setEditStatus('AUTO');

    const formatHHMM = (iso?: string | null) => {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
      } catch {
        return '';
      }
    };

    setEditCheckIn(formatHHMM(record.checkIn));
    setEditCheckOut(formatHHMM(record.checkOut));

    if (record.attendanceId) {
      fetchTimeline(record.attendanceId);
    }
  };

  const fetchTimeline = async (attendanceId: number) => {
    try {
      setTimelineLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/attendance/${attendanceId}/timeline`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setTimelineData(data.data);
      }
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleRegularize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord?.attendanceId) return;
    if (!regReason.trim()) {
      setRegError('Please provide a reason for modification.');
      return;
    }

    try {
      setRegLoading(true);
      setRegError(null);
      setRegSuccess(null);

      const payload = {
        checkIn: editCheckIn || null,
        checkOut: editCheckOut || null,
        reason: regReason.trim(),
        statusOverride: editStatus !== 'AUTO' ? editStatus : undefined
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/attendance/${selectedRecord.attendanceId}/regularize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setRegSuccess('Attendance regularized successfully! Working hours and status recalculated.');
        setRegReason('');
        fetchRecords(page);
        fetchSummary();
        await fetchTimeline(selectedRecord.attendanceId);
      } else {
        setRegError(data.error?.message || 'Failed to regularize attendance.');
      }
    } catch (err: any) {
      setRegError(err.message || 'Error occurred while saving regularization.');
    } finally {
      setRegLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/shifts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((d) => {
          if (d.success) setAvailableShifts(d.data);
        })
        .catch((err) => console.error('Failed to load shifts', err));
    }
  }, [token]);

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/attendance/summary?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSummary(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRecords = async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      let url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/attendance?page=${pageNum}&limit=20`;
      if (date) url += `&date=${date}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (status !== 'All') url += `&status=${status}`;
      if (shiftFilter !== 'All') url += `&shiftId=${shiftFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success) {
        setRecords(data.data.items);
        setPage(data.data.pagination.page);
        setTotalPages(data.data.pagination.totalPages || 1);
      } else {
        setError(data.error?.message || data.error || 'Failed to fetch attendance');
      }
    } catch (e: any) {
      setError(e.message || 'Network error fetching attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [date, token]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchRecords(1);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [date, search, status, shiftFilter, token]);

  useEffect(() => {
    const qStatus = searchParams.get('status');
    const qDate = searchParams.get('date');
    const qSearch = searchParams.get('search');

    const norm = normalizeStatus(qStatus);
    if (norm !== status) setStatus(norm);

    if (qDate && qDate !== date) {
      setDate(qDate);
    }
    const currentSearchVal = qSearch !== null ? qSearch : '';
    if (currentSearchVal !== search) {
      setSearch(currentSearchVal);
    }
  }, [searchParams]);

  const handleCardClick = (newStatus: string) => {
    setStatus(newStatus);
    const newParams = new URLSearchParams(searchParams);
    if (newStatus === 'All') {
      newParams.delete('status');
    } else {
      newParams.set('status', newStatus);
    }
    setSearchParams(newParams);
  };

  const formatHours = (minutes: number) => {
    if (!minutes && minutes !== 0) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const formatLateMinutes = (minutes: number) => {
    if (!minutes || minutes <= 0) return '';
    const totalMinutes = Math.round(minutes);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0) {
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${m}m`;
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchRecords(newPage);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div>
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="page-title">Attendance Management</h1>
          <p className="text-muted mb-0">Daily GPS-verified employee attendance records and summary</p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="row g-4 mb-4">
          <div className="col-sm-6 col-lg">
            <div
              className="card h-100 p-4 transition-all"
              onClick={() => handleCardClick('All')}
              style={{
                cursor: 'pointer',
                border: status === 'All' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                backgroundColor: status === 'All' ? '#F8FAFC' : '#FFFFFF',
                boxShadow: status === 'All' ? '0 4px 12px rgba(37, 99, 235, 0.12)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Click to view all employees"
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Total Staff</span>
                <div className="p-2 rounded-3 bg-light text-primary">
                  <Users size={16} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#0F172A' }}>
                {summary.totalEmployees}
              </div>
              <div className="caption-text mt-1">Enrolled personnel</div>
            </div>
          </div>

          <div className="col-sm-6 col-lg">
            <div
              className="card h-100 p-4 transition-all"
              onClick={() => handleCardClick('Present')}
              style={{
                cursor: 'pointer',
                border: status === 'Present' ? '2px solid #16A34A' : '1px solid #E2E8F0',
                backgroundColor: status === 'Present' ? '#F0FDF4' : '#FFFFFF',
                boxShadow: status === 'Present' ? '0 4px 12px rgba(22, 163, 74, 0.12)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Click to view present employees"
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Present</span>
                <div className="p-2 rounded-3" style={{ background: '#DCFCE7', color: '#15803D' }}>
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#15803D' }} className="d-flex align-items-baseline gap-2">
                <span>{summary.present}</span>
                {summary.late > 0 && (
                  <span
                    className="badge bg-warning text-dark fw-semibold"
                    style={{
                      fontSize: '12px',
                      cursor: 'pointer',
                      border: status === 'Late' ? '2px solid #B45309' : 'none'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick('Late');
                    }}
                    title="Click to view only late employees"
                  >
                    {summary.late} Late
                  </span>
                )}
              </div>
              <div className="caption-text mt-1 text-success">
                {summary.late > 0 ? `${summary.onTime ?? (summary.present - summary.late)} on time • ${summary.late} late` : 'Verified check-ins'}
              </div>
            </div>
          </div>

          <div className="col-sm-6 col-lg">
            <div
              className="card h-100 p-4 transition-all"
              onClick={() => handleCardClick('Absent')}
              style={{
                cursor: 'pointer',
                border: status === 'Absent' ? '2px solid #DC2626' : '1px solid #E2E8F0',
                backgroundColor: status === 'Absent' ? '#FEF2F2' : '#FFFFFF',
                boxShadow: status === 'Absent' ? '0 4px 12px rgba(220, 38, 38, 0.15)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Click to view absent employees"
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Absent</span>
                <div className="p-2 rounded-3" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                  <XCircle size={16} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#B91C1C' }}>
                {summary.absent}
              </div>
              <div className="caption-text mt-1 text-danger">Missing or on leave</div>
            </div>
          </div>

          <div className="col-sm-6 col-lg">
            <div
              className="card h-100 p-4 transition-all"
              onClick={() => handleCardClick('Checked In')}
              style={{
                cursor: 'pointer',
                border: status === 'Checked In' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                backgroundColor: status === 'Checked In' ? '#EFF6FF' : '#FFFFFF',
                boxShadow: status === 'Checked In' ? '0 4px 12px rgba(37, 99, 235, 0.12)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Click to view currently checked in employees"
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Checked In</span>
                <div className="p-2 rounded-3" style={{ background: '#DBEAFE', color: '#1D4ED8' }}>
                  <Clock size={16} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#1D4ED8' }}>
                {summary.checkedIn}
              </div>
              <div className="caption-text mt-1">Currently in office</div>
            </div>
          </div>

          <div className="col-sm-6 col-lg">
            <div
              className="card h-100 p-4 transition-all"
              onClick={() => handleCardClick('Checked Out')}
              style={{
                cursor: 'pointer',
                border: status === 'Checked Out' ? '2px solid #475569' : '1px solid #E2E8F0',
                backgroundColor: status === 'Checked Out' ? '#F8FAFC' : '#FFFFFF',
                boxShadow: status === 'Checked Out' ? '0 4px 12px rgba(71, 85, 105, 0.12)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Click to view employees who checked out"
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-muted fw-medium" style={{ fontSize: '13px' }}>Checked Out</span>
                <div className="p-2 rounded-3 bg-light text-secondary">
                  <LogOut size={16} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: '#475569' }}>
                {summary.checkedOut}
              </div>
              <div className="caption-text mt-1">Completed day</div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Notification Bar */}
      {status !== 'All' && (
        <div className="d-flex align-items-center justify-content-between p-2.5 px-3 mb-3 rounded-3 bg-white border shadow-sm">
          <div className="d-flex align-items-center gap-2">
            <span className="small text-muted fw-semibold">Filtered by status:</span>
            <span
              className={`badge ${
                status === 'Absent'
                  ? 'bg-danger text-white'
                  : status === 'Late'
                  ? 'bg-warning text-dark'
                  : status === 'Present'
                  ? 'bg-success text-white'
                  : 'bg-primary text-white'
              } px-2.5 py-1`}
              style={{ fontSize: '12px' }}
            >
              {status}
            </span>
            <span className="small text-muted d-none d-sm-inline">
              {status === 'Absent'
                ? 'Showing employees who have not marked attendance today'
                : status === 'Late'
                ? 'Showing employees who checked in past grace threshold'
                : `Showing ${status.toLowerCase()} records`}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 py-1 px-2.5"
            style={{ fontSize: '12px', borderRadius: '6px' }}
            onClick={() => handleCardClick('All')}
          >
            <X size={13} />
            <span>Show All</span>
          </button>
        </div>
      )}

      {/* Filter Toolbar Card */}
      <div className="card p-4 mb-4">
        <Row className="g-3 align-items-end">
          <Col md={2}>
            <Form.Group>
              <Form.Label className="d-flex align-items-center gap-2">
                <Calendar size={14} className="text-muted" />
                <span>Attendance Date</span>
              </Form.Label>
              <Form.Control
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Form.Group>
          </Col>

          <Col md={3}>
            <Form.Group>
              <Form.Label className="d-flex align-items-center gap-2">
                <Search size={14} className="text-muted" />
                <span>Search Employee</span>
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="Search by name or employee ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Form.Group>
          </Col>

          <Col md={2}>
            <Form.Group>
              <Form.Label className="d-flex align-items-center gap-2">
                <Clock size={14} className="text-muted" />
                <span>Shift</span>
              </Form.Label>
              <Form.Select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
                <option value="All">All Shifts</option>
                {availableShifts.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={1}>
            <Form.Group>
              <Form.Label className="d-flex align-items-center gap-2">
                <MapPin size={14} className="text-muted" />
                <span>Mode</span>
              </Form.Label>
              <Form.Select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="Office">Office</option>
                <option value="Field">Field</option>
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={2}>
            <Form.Group>
              <Form.Label className="d-flex align-items-center gap-2">
                <Monitor size={14} className="text-muted" />
                <span>Source</span>
              </Form.Label>
              <Form.Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="All">All Sources</option>
                <option value="Mobile App">Mobile App</option>
                <option value="Web Portal">Web Portal</option>
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={2}>
            <Form.Group>
              <Form.Label className="d-flex align-items-center gap-2">
                <Filter size={14} className="text-muted" />
                <span>Status Filter</span>
              </Form.Label>
              <Form.Select
                value={status}
                onChange={(e) => {
                  const val = e.target.value;
                  setStatus(val);
                  const newParams = new URLSearchParams(searchParams);
                  if (val === 'All') {
                    newParams.delete('status');
                  } else {
                    newParams.set('status', val);
                  }
                  setSearchParams(newParams);
                }}
              >
                <option value="All">All Statuses</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
                <option value="Late">Late</option>
                <option value="Checked In">Checked In</option>
                <option value="Checked Out">Checked Out</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="mb-4 d-flex align-items-center gap-2">
          <span>{error}</span>
        </Alert>
      )}

      {/* Records Table Card */}
      <div className="card p-0 overflow-hidden">
        {loading && records.length === 0 ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <div className="text-muted mt-2" style={{ fontSize: '14px' }}>Loading attendance records...</div>
          </div>
        ) : (
          <>
            <div className="table-responsive" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Employee ID</th>
                    <th>Shift</th>
                    <th>Date</th>
                    <th>Mode</th>
                    <th>Source</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Working Hours</th>
                    <th>Status</th>
                    <th>Location & GPS</th>
                    <th>Timeline & Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.filter(r => (modeFilter === 'All' || (r.attendanceMode || 'Office').toLowerCase() === modeFilter.toLowerCase()) && (sourceFilter === 'All' || (r.attendanceSource || 'Mobile App').toLowerCase() === sourceFilter.toLowerCase())).length > 0 ? (
                    records
                      .filter(r => (modeFilter === 'All' || (r.attendanceMode || 'Office').toLowerCase() === modeFilter.toLowerCase()) && (sourceFilter === 'All' || (r.attendanceSource || 'Mobile App').toLowerCase() === sourceFilter.toLowerCase()))
                      .map((r) => (
                      <tr key={r.attendanceId ? `att-${r.attendanceId}` : `emp-${r.employeeId || r.employeeCode}`}>
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <Avatar
                              src={r.profilePhotoUrl}
                              name={r.employeeName}
                              size={34}
                              shape="rounded"
                              showBorder
                              borderColor="rgba(226, 232, 240, 0.8)"
                              onClick={() => {
                                setPreviewEmployee(r);
                                setShowPreviewModal(true);
                              }}
                            />
                            <div>
                              <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
                                {r.employeeName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-secondary font-monospace" style={{ fontSize: '12px' }}>
                            {r.employeeId}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border font-monospace" style={{ fontSize: '11.5px' }}>
                            {r.shiftCode || 'DS'}
                          </span>
                        </td>
                        <td style={{ color: '#475569', fontSize: '13.5px' }}>
                          {new Date(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {r.attendanceMode === 'Field' ? (
                            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning fw-medium d-inline-flex align-items-center gap-1" style={{ fontSize: '11px', padding: '3px 8px' }}>
                              <MapPin size={11} /> Field
                            </span>
                          ) : (
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle fw-medium d-inline-flex align-items-center gap-1" style={{ fontSize: '11px', padding: '3px 8px' }}>
                              <Building size={11} /> Office
                            </span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {(r.attendanceSource || 'Mobile App') === 'Web Portal' ? (
                            <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle fw-medium d-inline-flex align-items-center gap-1" style={{ fontSize: '11px', padding: '3px 8px' }}>
                              <Monitor size={11} /> Web Portal
                            </span>
                          ) : (
                            <span className="badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle fw-medium d-inline-flex align-items-center gap-1" style={{ fontSize: '11px', padding: '3px 8px' }}>
                              <Smartphone size={11} /> Mobile App
                            </span>
                          )}
                        </td>
                        <td style={{ fontWeight: 500, color: '#1E293B' }}>
                          {r.status?.toUpperCase() === 'ABSENT' || r.status?.toUpperCase().includes('LEAVE') ? '--:--' : formatTime(r.checkIn)}
                        </td>
                        <td style={{ fontWeight: 500, color: '#1E293B' }}>
                          {r.status?.toUpperCase() === 'ABSENT' || r.status?.toUpperCase().includes('LEAVE') ? '--:--' : formatTime(r.checkOut)}
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: '13.5px' }}>
                            <Clock size={13} />
                            <span>{r.status?.toUpperCase() === 'ABSENT' || r.status?.toUpperCase().includes('LEAVE') ? '0h 0m' : formatHours(r.workingMinutes)}</span>
                          </div>
                          {r.checkOut && r.workingMinutes < 510 && !r.status?.toUpperCase().includes('LEAVE') && r.status?.toUpperCase() !== 'ABSENT' && (
                            <div className="mt-1">
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle fw-medium" style={{ fontSize: '10px', padding: '2px 6px' }} title="Completed less than required 510 minutes (8h 30m)">
                                Short ({510 - r.workingMinutes}m)
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              r.status?.toUpperCase() === 'INSUFFICIENT_HOURS' || r.status?.toUpperCase() === 'INSUFFICIENT HOURS'
                                ? 'bg-danger-subtle text-danger border border-danger fw-semibold'
                                : r.status?.toUpperCase() === 'LATE' || r.isLate
                                ? 'bg-warning text-dark'
                                : r.status?.toUpperCase() === 'PRESENT'
                                ? 'bg-success'
                                : r.status?.toUpperCase() === 'ABSENT'
                                ? 'bg-danger'
                                : 'bg-secondary'
                            }`}
                          >
                            {r.status?.toUpperCase() === 'INSUFFICIENT_HOURS' || r.status?.toUpperCase() === 'INSUFFICIENT HOURS' ? (
                              'Insufficient Working Hours'
                            ) : r.status?.toUpperCase() === 'LATE' || r.isLate ? (
                              <>
                                LATE{r.lateMinutes ? ` (${formatLateMinutes(r.lateMinutes)})` : ''}
                              </>
                            ) : (
                              r.status?.toUpperCase()
                            )}
                          </span>
                          {r.attendanceResumed && (
                            <div className="mt-1">
                              <span className="badge bg-info-subtle text-info border border-info-subtle d-inline-flex align-items-center gap-1" style={{ fontSize: '10px', padding: '2px 5px' }} title="Attendance session was resumed after accidental check-out">
                                <RotateCcw size={10} /> Resumed
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          {r.attendanceMode === 'Field' ? (
                            <div className="d-flex align-items-center gap-1.5 flex-wrap">
                              <span 
                                className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle d-inline-flex align-items-center gap-1"
                                style={{ fontSize: '11px', padding: '4px 7px', borderRadius: '6px' }}
                                title={r.address || 'Field Location'}
                              >
                                <MapPin size={11} className="text-warning-emphasis" />
                                <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {r.address || 'Field Location'}
                                </span>
                              </span>
                              {r.checkInLat && r.checkInLng && (
                                <a
                                  href={`https://www.google.com/maps?q=${r.checkInLat},${r.checkInLng}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-decoration-none text-muted"
                                  title="View GPS on Google Maps"
                                  style={{ padding: '2px 4px' }}
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                              {r.selfieUrl && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-warning p-0 px-1.5 d-inline-flex align-items-center gap-1"
                                  style={{ fontSize: '11px', height: '22px', borderRadius: '4px' }}
                                  title="View captured check-in selfie"
                                  onClick={() => {
                                    setPreviewEmployee({
                                      ...r,
                                      name: `${r.employeeName} (Selfie - Field Mode)`,
                                      profilePhotoUrl: r.selfieUrl
                                    });
                                    setShowPreviewModal(true);
                                  }}
                                >
                                  <Camera size={11} />
                                  <span>Selfie</span>
                                </button>
                              )}
                            </div>
                          ) : r.checkInLat && r.checkInLng ? (
                            <div className="d-flex align-items-center gap-1.5">
                              <span 
                                className="badge bg-light text-primary border d-inline-flex align-items-center gap-1"
                                style={{ fontSize: '11.5px', padding: '5px 8px', borderRadius: '6px' }}
                                title={`Check-in GPS: ${r.checkInLat.toFixed(5)}, ${r.checkInLng.toFixed(5)}${r.checkOutLat ? ` | Check-out: ${r.checkOutLat.toFixed(5)}, ${r.checkOutLng.toFixed(5)}` : ''}`}
                              >
                                <MapPin size={12} className="text-primary" />
                                <span>Within Geofence</span>
                              </span>
                              <a
                                href={`https://www.google.com/maps?q=${r.checkInLat},${r.checkInLng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-decoration-none text-muted"
                                title="View check-in GPS on Google Maps"
                                style={{ padding: '2px 4px' }}
                              >
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '12.5px' }}>-</span>
                          )}
                        </td>
                        <td>
                          {r.attendanceId ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5"
                              style={{ fontSize: '11.5px', padding: '4px 8px', borderRadius: '6px' }}
                              title="View complete attendance timeline and regularize times"
                              onClick={() => openTimelineModal(r)}
                            >
                              <History size={12} />
                              <span>Timeline & Edit</span>
                            </button>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '12px' }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="text-center py-5 text-muted">
                        No attendance records found for the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="d-flex align-items-center justify-content-between p-3 border-top bg-white">
                <span className="text-muted" style={{ fontSize: '13px' }}>
                  Showing page {page} of {totalPages}
                </span>
                <Pagination className="mb-0">
                  <Pagination.Prev
                    disabled={page === 1}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    <ChevronLeft size={14} />
                  </Pagination.Prev>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <Pagination.Ellipsis disabled />
                        )}
                        <Pagination.Item
                          active={page === p}
                          onClick={() => handlePageChange(p)}
                        >
                          {p}
                        </Pagination.Item>
                      </React.Fragment>
                    ))}
                  <Pagination.Next
                    disabled={page === totalPages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    <ChevronRight size={14} />
                  </Pagination.Next>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>


      {/* Attendance Timeline & Regularization Modal */}
      <Modal show={showTimelineModal} onHide={() => setShowTimelineModal(false)} size="lg" centered>
        <Modal.Header closeButton className="border-bottom pb-3">
          <Modal.Title className="d-flex align-items-center gap-2" style={{ fontSize: '18px', fontWeight: 600 }}>
            <History className="text-primary" size={20} />
            <span>Attendance Timeline & Regularization</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {selectedRecord && (
            <div className="d-flex align-items-center justify-content-between p-3 bg-light rounded-3 mb-4">
              <div className="d-flex align-items-center gap-3">
                <Avatar src={selectedRecord.profilePhotoUrl} name={selectedRecord.employeeName} size={42} shape="rounded" />
                <div>
                  <div className="fw-bold text-dark" style={{ fontSize: '15px' }}>{selectedRecord.employeeName}</div>
                  <div className="text-muted font-monospace" style={{ fontSize: '12px' }}>
                    {selectedRecord.employeeId} • Shift: {selectedRecord.shiftName || selectedRecord.shiftCode || 'Day Shift'}
                  </div>
                </div>
              </div>
              <div className="text-end">
                <span className="badge bg-secondary font-monospace" style={{ fontSize: '12px' }}>
                  {new Date(selectedRecord.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <div className="caption-text mt-1">Status: <strong>{selectedRecord.status}</strong></div>
              </div>
            </div>
          )}

          <Tabs activeKey={activeTab} onSelect={(k: any) => setActiveTab(k)} className="mb-4">
            <Tab eventKey="timeline" title={<span><History size={14} className="me-1.5" /> Attendance Timeline</span>}>
              {timelineLoading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" size="sm" />
                  <div className="text-muted mt-2" style={{ fontSize: '13px' }}>Loading timeline events...</div>
                </div>
              ) : (
                <div>
                  {/* Timeline events container */}
                  <div className="mb-4">
                    <h6 className="fw-semibold text-muted text-uppercase mb-3" style={{ fontSize: '11.5px', letterSpacing: '0.5px' }}>
                      PUNCH & RESUME TIMELINE
                    </h6>

                    {timelineData?.timeline && timelineData.timeline.length > 0 ? (
                      <div className="position-relative ps-4" style={{ borderLeft: '2px solid #E2E8F0', marginLeft: '12px' }}>
                        {timelineData.timeline.map((ev: any, idx: number) => {
                          const isCheckIn = ev.type === 'CHECK_IN';
                          const isAccidentalOut = ev.type === 'ACCIDENTAL_CHECK_OUT';
                          const isResume = ev.type === 'ATTENDANCE_RESUMED';
                          const isFinalOut = ev.type === 'FINAL_CHECK_OUT' || ev.type === 'CHECK_OUT';

                          const dotColor = isCheckIn ? '#16A34A' : isAccidentalOut ? '#DC2626' : isResume ? '#2563EB' : '#7C3AED';
                          const badgeBg = isCheckIn ? '#DCFCE7' : isAccidentalOut ? '#FEE2E2' : isResume ? '#DBEAFE' : '#F3E8FF';
                          const badgeText = isCheckIn ? '#15803D' : isAccidentalOut ? '#B91C1C' : isResume ? '#1D4ED8' : '#6B21A8';

                          const formattedTime = new Date(ev.timestamp).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: 'Asia/Kolkata'
                          });

                          return (
                            <div key={idx} className="mb-4 position-relative">
                              <span
                                style={{
                                  position: 'absolute',
                                  left: '-25px',
                                  top: '2px',
                                  width: '14px',
                                  height: '14px',
                                  borderRadius: '50%',
                                  backgroundColor: dotColor,
                                  border: '3px solid #FFFFFF',
                                  boxShadow: '0 0 0 1px #CBD5E1'
                                }}
                              />
                              <div className="d-flex align-items-center gap-2 mb-1">
                                <span className="fw-bold font-monospace text-dark" style={{ fontSize: '15px' }}>
                                  {formattedTime}
                                </span>
                                <span
                                  className="badge fw-semibold"
                                  style={{ backgroundColor: badgeBg, color: badgeText, fontSize: '12px', padding: '3px 8px' }}
                                >
                                  {ev.label}
                                </span>
                                {ev.isLate && (
                                  <span className="badge bg-warning text-dark" style={{ fontSize: '11px' }}>
                                    Late ({ev.lateMinutes ? Math.round(parseFloat(ev.lateMinutes)) : 0}m)
                                  </span>
                                )}
                              </div>
                              <div className="text-muted" style={{ fontSize: '13px' }}>
                                {ev.details} {ev.source ? `• ${ev.source}` : ''}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted" style={{ fontSize: '13px' }}>
                        No punch timeline events recorded.
                      </div>
                    )}
                  </div>

                  {/* Regularization Logs Section */}
                  {timelineData?.regularizations && timelineData.regularizations.length > 0 && (
                    <div className="mt-4 pt-3 border-top">
                      <h6 className="fw-semibold text-muted text-uppercase mb-3" style={{ fontSize: '11.5px', letterSpacing: '0.5px' }}>
                        ADMIN REGULARIZATION AUDIT TRAIL
                      </h6>
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered mb-0" style={{ fontSize: '12.5px' }}>
                          <thead className="table-light">
                            <tr>
                              <th>Modified By</th>
                              <th>Date & Time</th>
                              <th>Previous Timing</th>
                              <th>New Timing</th>
                              <th>Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {timelineData.regularizations.map((log: any) => (
                              <tr key={log.id}>
                                <td className="fw-semibold text-dark">{log.admin_name}</td>
                                <td className="text-muted">
                                  {new Date(log.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}
                                </td>
                                <td>
                                  <div>In: {log.previous_check_in ? new Date(log.previous_check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '--:--'}</div>
                                  <div>Out: {log.previous_check_out ? new Date(log.previous_check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '--:--'}</div>
                                </td>
                                <td>
                                  <div className="text-success fw-medium">In: {log.new_check_in ? new Date(log.new_check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '--:--'}</div>
                                  <div className="text-success fw-medium">Out: {log.new_check_out ? new Date(log.new_check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '--:--'}</div>
                                </td>
                                <td>
                                  <span className="badge bg-light text-dark border fw-normal" style={{ whiteSpace: 'normal', textAlign: 'left' }}>
                                    {log.reason}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Tab>

            <Tab eventKey="regularize" title={<span><Edit3 size={14} className="me-1.5" /> Regularize Attendance</span>}>
              <Form onSubmit={handleRegularize}>
                {regSuccess && <Alert variant="success" className="mb-3">{regSuccess}</Alert>}
                {regError && <Alert variant="danger" className="mb-3">{regError}</Alert>}

                <div className="bg-light p-3 rounded-3 mb-3 border">
                  <div className="small text-muted mb-2">
                    <strong>Admin Attendance Regularization Guidelines:</strong>
                  </div>
                  <ul className="mb-0 small text-muted ps-3">
                    <li>Edit check-in or check-out times to correct accidental attendance or missed punches.</li>
                    <li>Working hours, late arrivals, overtime, and final attendance status will be recalculated automatically using the assigned shift rules.</li>
                    <li>Your admin name, exact timestamp, and mandatory modification reason will be permanently archived in the compliance audit log.</li>
                  </ul>
                </div>

                <Row className="g-3 mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Check-In Time (HH:MM)</Form.Label>
                      <Form.Control
                        type="time"
                        value={editCheckIn}
                        onChange={(e) => setEditCheckIn(e.target.value)}
                        placeholder="09:30"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Check-Out Time (HH:MM)</Form.Label>
                      <Form.Control
                        type="time"
                        value={editCheckOut}
                        onChange={(e) => setEditCheckOut(e.target.value)}
                        placeholder="18:30"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Attendance Status</Form.Label>
                  <Form.Select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                    <option value="AUTO">Auto-calculate from working hours (Recommended)</option>
                    <option value="PRESENT">Force Present (Full Day)</option>
                    <option value="HALF_DAY">Force Half Day</option>
                    <option value="LATE">Force Late Check-In</option>
                    <option value="INSUFFICIENT_HOURS">Force Insufficient Hours</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>
                    Reason for Modification <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={regReason}
                    onChange={(e) => setRegReason(e.target.value)}
                    placeholder="E.g., Employee accidentally checked out at 10:47 AM, verified presence and completed full workday."
                    required
                  />
                  <Form.Text className="text-muted">
                    This reason will be recorded in the audit trail and visible in regularized reports.
                  </Form.Text>
                </Form.Group>

                <div className="d-flex justify-content-end gap-2">
                  <Button variant="outline-secondary" onClick={() => setShowTimelineModal(false)}>
                    Close
                  </Button>
                  <Button variant="primary" type="submit" disabled={regLoading}>
                    {regLoading ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        Saving & Recalculating...
                      </>
                    ) : (
                      'Recalculate & Save Regularization'
                    )}
                  </Button>
                </div>
              </Form>
            </Tab>
          </Tabs>
        </Modal.Body>
      </Modal>

      <ImagePreviewModal
        show={showPreviewModal}
        onHide={() => setShowPreviewModal(false)}
        src={previewEmployee?.profilePhotoUrl}
        name={previewEmployee?.employeeName}
        employeeId={previewEmployee?.employeeId}
      />
    </div>
  );
}
