import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Spinner, Modal, Badge, Pagination, Alert } from 'react-bootstrap';
import axios from 'axios';
import {
  FileBarChart,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function AdminReports() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reportData, setReportData] = useState<any>(null);
  const [employeesList, setEmployeesList] = useState<any[]>([]);

  // Filters
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedShift, setSelectedShift] = useState('All');
  const [search, setSearch] = useState('');
  const [shiftsList, setShiftsList] = useState<any[]>([]);

  // Pagination & Sort
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [activeEmpReport, setActiveEmpReport] = useState<any>(null);

  useEffect(() => {
    if (token) {
      fetchEmployees();
      fetchShifts();
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchReport();
  }, [page, sortField, sortOrder, token]);

  const fetchShifts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/shifts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setShiftsList(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch shifts', e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setEmployeesList(res.data.data.items || res.data.data.employees || (Array.isArray(res.data.data) ? res.data.data : []));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_URL}/api/admin/reports/attendance?page=${page}&limit=20&sort=${sortField}&order=${sortOrder}`;

      if (filterMode === 'month') {
        url += `&month=${month}&year=${year}`;
      } else {
        if (!fromDate || !toDate) {
          setError('Please select valid From and To dates');
          setLoading(false);
          return;
        }
        url += `&from=${fromDate}&to=${toDate}`;
      }

      if (selectedEmployee) url += `&employeeId=${selectedEmployee}`;
      if (selectedStatus && selectedStatus !== 'All') url += `&status=${selectedStatus}`;
      if (selectedShift && selectedShift !== 'All') url += `&shiftId=${selectedShift}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setReportData(res.data.data);
      } else {
        setError(res.data.error?.message || res.data.error || 'Error loading report');
      }
    } catch (err: any) {
      setError('Unable to load attendance report.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setPage(1);
    fetchReport();
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleExport = (type: 'excel' | 'pdf') => {
    try {
      let url = `${API_URL}/api/admin/reports/attendance?export=${type}&sort=${sortField}&order=${sortOrder}&token=${token}`;
      if (filterMode === 'month') {
        url += `&month=${month}&year=${year}`;
      } else {
        url += `&from=${fromDate}&to=${toDate}`;
      }
      if (selectedEmployee) url += `&employeeId=${selectedEmployee}`;
      if (selectedStatus && selectedStatus !== 'All') url += `&status=${selectedStatus}`;
      if (selectedShift && selectedShift !== 'All') url += `&shiftId=${selectedShift}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      window.open(url, '_blank');
    } catch (err) {
      alert(`Unable to export ${type.toUpperCase()}`);
    }
  };

  const formatHours = (minutes: number) => {
    if (!minutes && minutes !== 0) return '-';
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
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

  const formatTime = (isoString: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <span className="badge badge-success">PRESENT</span>;
      case 'ABSENT':
        return <span className="badge badge-danger">ABSENT</span>;
      case 'INSUFFICIENT_HOURS':
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#FFEDD5', color: '#C2410C', border: '1px solid #FED7AA' }}
          >
            INSUFFICIENT HRS
          </span>
        );
      case 'CHECKOUT_MISSING':
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#F3E8FF', color: '#7E22CE', border: '1px solid #E9D5FF' }}
          >
            MISSING CHECKOUT
          </span>
        );
      case 'HALF_DAY':
        return <span className="badge badge-warning">HALF DAY</span>;
      case 'ON_LEAVE':
        return <span className="badge badge-info">ON LEAVE</span>;
      case 'HOLIDAY':
        return <span className="badge badge-primary">HOLIDAY</span>;
      case 'SUNDAY':
        return <span className="badge badge-neutral">SUNDAY</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
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
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="page-title">Attendance Reports</h1>
          <p className="text-muted mb-0">Export comprehensive monthly reports and analyze attendance metrics</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-secondary" onClick={() => handleExport('excel')}>
            <Download size={15} />
            <span>Export Excel</span>
          </button>
          <button className="btn btn-primary" onClick={() => handleExport('pdf')}>
            <Download size={15} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card p-4 mb-4">
        <Row className="g-3">
          <Col md={3}>
            <Form.Group>
              <Form.Label>Filter Mode</Form.Label>
              <Form.Select value={filterMode} onChange={(e: any) => setFilterMode(e.target.value)}>
                <option value="month">By Month</option>
                <option value="range">Custom Date Range</option>
              </Form.Select>
            </Form.Group>
          </Col>

          {filterMode === 'month' ? (
            <>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>Month</Form.Label>
                  <Form.Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>Year</Form.Label>
                  <Form.Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </>
          ) : (
            <>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>From Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>To Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </>
          )}

          <Col md={2}>
            <Form.Group>
              <Form.Label>Employee</Form.Label>
              <Form.Select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                <option value="">All Employees</option>
                {employeesList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={2}>
            <Form.Group>
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="INSUFFICIENT_HOURS">Insufficient Hours</option>
                <option value="CHECKOUT_MISSING">Checkout Missing</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="ON_LEAVE">On Leave</option>
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={2}>
            <Form.Group>
              <Form.Label>Shift</Form.Label>
              <Form.Select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
              >
                <option value="All">All Shifts</option>
                {shiftsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={3}>
            <Form.Group>
              <Form.Label>Search Employee</Form.Label>
              <Form.Control
                type="text"
                placeholder="Employee ID, Name, Dept, or Email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Form.Group>
          </Col>

          <Col md={12} className="d-flex justify-content-end pt-2">
            <button className="btn btn-primary" onClick={handleApplyFilters}>
              <Filter size={15} />
              <span>Apply Filters</span>
            </button>
          </Col>
        </Row>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div className="text-muted mt-2" style={{ fontSize: '14px' }}>Compiling report data...</div>
        </div>
      ) : error ? (
        <Alert variant="danger" className="mb-4 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={handleApplyFilters}>Retry</button>
        </Alert>
      ) : reportData && (
        <>
          {/* Metrics Grid */}
          <div className="row g-3 mb-4 text-center">
            {[
              { label: 'Total Expected', val: `${reportData.summary.totalExpectedDays || 0} Days` },
              { label: 'Present', val: reportData.summary.present, color: '#15803D' },
              { label: 'Absent', val: reportData.summary.absent, color: '#B91C1C' },
              { label: 'Insufficient', val: reportData.summary.insufficientHours || 0, color: '#C2410C' },
              { label: 'Missing Out', val: reportData.summary.checkoutMissing || 0, color: '#7E22CE' },
              { label: 'Half Day', val: reportData.summary.halfDay, color: '#B45309' },
              { label: 'On Leave', val: reportData.summary.onLeave, color: '#1D4ED8' },
              { label: 'Late', val: reportData.summary.late, color: '#D97706' },
              { label: 'Total Hours', val: formatHours(reportData.summary.totalWorkingMinutes) },
              { label: 'Attendance %', val: `${reportData.summary.attendancePercentage}%`, color: '#2563EB', isBold: true }
            ].map((stat, idx) => (
              <Col key={idx} xs={6} md={3} lg={true}>
                <div className="card h-100 p-3">
                  <div className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {stat.label}
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: stat.isBold ? 700 : 600,
                      color: stat.color || '#0F172A',
                      marginTop: '4px'
                    }}
                  >
                    {stat.val}
                  </div>
                </div>
              </Col>
            ))}
          </div>

          {/* Table Card */}
          <div className="card p-0 overflow-hidden mb-4">
            <div className="table-responsive" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                      <div className="d-flex align-items-center gap-1">
                        <span>Employee</span>
                        <ArrowUpDown size={13} className="text-muted" />
                      </div>
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('present')}>
                      <div className="d-flex align-items-center gap-1">
                        <span>Present</span>
                        <ArrowUpDown size={13} className="text-muted" />
                      </div>
                    </th>
                    <th>Absent</th>
                    <th>Insufficient</th>
                    <th>Missing Out</th>
                    <th>Half Day</th>
                    <th>Leave</th>
                    <th>Late</th>
                    <th>Total Hours</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('attendancePercentage')}>
                      <div className="d-flex align-items-center gap-1">
                        <span>Att %</span>
                        <ArrowUpDown size={13} className="text-muted" />
                      </div>
                    </th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.employees.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-5 text-muted">
                        No attendance records found for the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    reportData.employees.map((emp: any) => (
                      <tr key={emp.id}>
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: '#EFF6FF',
                                color: 'var(--primary-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600,
                                fontSize: '13px',
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(emp.name)}
                            </div>
                            <div>
                              <div className="fw-semibold text-dark d-flex align-items-center gap-1.5" style={{ fontSize: '14px' }}>
                                <span>{emp.name}</span>
                                {(emp.employeeCode || emp.empId) && (
                                  <span className="badge bg-light text-secondary border font-monospace" style={{ fontSize: '11px', fontWeight: 600 }}>
                                    {emp.employeeCode || emp.empId}
                                  </span>
                                )}
                                {emp.shiftCode && (
                                  <span className="badge bg-primary text-white font-monospace" style={{ fontSize: '10.5px' }}>
                                    {emp.shiftCode}
                                  </span>
                                )}
                              </div>
                              <div className="text-muted" style={{ fontSize: '12.5px' }}>
                                {emp.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="fw-semibold text-success">{emp.summary.present}</td>
                        <td className="text-danger">{emp.summary.absent}</td>
                        <td style={{ color: '#C2410C', fontWeight: 600 }}>{emp.summary.insufficientHours || 0}</td>
                        <td style={{ color: '#7E22CE', fontWeight: 600 }}>{emp.summary.checkoutMissing || 0}</td>
                        <td className="text-warning">{emp.summary.halfDay}</td>
                        <td>{emp.summary.onLeave}</td>
                        <td>{emp.summary.late}</td>
                        <td>{formatHours(emp.summary.totalWorkingMinutes)}</td>
                        <td>
                          <span className="fw-bold text-primary">{emp.summary.attendancePercentage}%</span>
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setActiveEmpReport(emp);
                              setShowModal(true);
                            }}
                          >
                            <Eye size={13} />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {reportData.pagination?.totalPages > 1 && (
              <div className="d-flex align-items-center justify-content-between p-3 border-top bg-white">
                <span className="text-muted" style={{ fontSize: '13px' }}>
                  Showing page {page} of {reportData.pagination.totalPages}
                </span>
                <Pagination className="mb-0">
                  <Pagination.Prev disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft size={14} />
                  </Pagination.Prev>
                  {Array.from({ length: reportData.pagination.totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === reportData.pagination.totalPages || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <Pagination.Ellipsis disabled />}
                        <Pagination.Item active={page === p} onClick={() => setPage(p)}>
                          {p}
                        </Pagination.Item>
                      </React.Fragment>
                    ))}
                  <Pagination.Next
                    disabled={page === reportData.pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight size={14} />
                  </Pagination.Next>
                </Pagination>
              </div>
            )}
          </div>
        </>
      )}

      {/* Drill-down Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{activeEmpReport?.name} — Daily Breakdown</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          <div className="table-responsive" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Status</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Working Hours</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {activeEmpReport?.daily?.map((d: any, idx: number) => (
                  <tr key={idx}>
                    <td>{d.date}</td>
                    <td className="text-muted">{d.day}</td>
                    <td>
                      <div className="d-flex align-items-center gap-1">
                        {getStatusBadge(d.status)}
                        {d.isLate && (
                          <span className="badge bg-warning">
                            LATE{d.lateMinutes ? ` (${formatLateMinutes(d.lateMinutes)})` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{formatTime(d.checkIn)}</td>
                    <td>{formatTime(d.checkOut)}</td>
                    <td>{formatHours(d.workingMinutes)}</td>
                    <td className="text-muted small">{d.leaveType || d.holidayName || '-'}</td>
                  </tr>
                ))}
                {activeEmpReport?.daily?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      No records matched the filter criteria for this employee.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
            Close
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
