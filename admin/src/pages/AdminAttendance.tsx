import React, { useState, useEffect } from 'react';
import { Form, Row, Col, Spinner, Alert, Pagination } from 'react-bootstrap';
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
  ExternalLink,
  X
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
  const [availableShifts, setAvailableShifts] = useState<any[]>([]);

  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewEmployee, setPreviewEmployee] = useState<any>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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
          <Col md={3}>
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

          <Col md={3}>
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

          <Col md={3}>
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
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Working Hours</th>
                    <th>Status</th>
                    <th>Location & GPS</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length > 0 ? (
                    records.map((r) => (
                      <tr key={r.attendanceId}>
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
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              r.status?.toUpperCase() === 'LATE' || r.isLate
                                ? 'bg-warning text-dark'
                                : r.status?.toUpperCase() === 'PRESENT'
                                ? 'bg-success'
                                : r.status?.toUpperCase() === 'ABSENT'
                                ? 'bg-danger'
                                : 'bg-secondary'
                            }`}
                          >
                            {r.status?.toUpperCase() === 'LATE' || r.isLate ? (
                              <>
                                LATE{r.lateMinutes ? ` (${formatLateMinutes(r.lateMinutes)})` : ''}
                              </>
                            ) : (
                              r.status?.toUpperCase()
                            )}
                          </span>
                        </td>
                        <td>
                          {r.checkInLat && r.checkInLng ? (
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-5 text-muted">
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
