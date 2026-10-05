import React, { useEffect, useState } from 'react';
import { Form, Row, Col, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { CalendarCheck, Calendar, Clock, AlertCircle, Monitor, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function MyAttendance() {
  const { token } = useAuth();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/employee/attendance`, {
          params: { month, year },
          headers: { Authorization: `Bearer ${token}` }
        });
        setAttendance(response.data);
      } catch (err) {
        console.error('Failed to load attendance');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchAttendance();
  }, [token, month, year]);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatHours = (mins: number) => {
    if (!mins && mins !== 0) return '-';
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const getStatusBadge = (status: string, isLate: boolean) => {
    if (status === 'NOT_MARKED') return <span className="text-muted">-</span>;

    let badgeClass = 'bg-secondary';
    if (status === 'PRESENT') badgeClass = 'bg-success';
    else if (status === 'ABSENT') badgeClass = 'bg-danger';
    else if (status === 'HALF_DAY') badgeClass = 'bg-warning';
    else if (status === 'ON_LEAVE' || status === 'HALF_DAY_LEAVE') badgeClass = 'bg-info';
    else if (status === 'HOLIDAY') badgeClass = 'bg-primary';
    else if (status === 'SUNDAY') badgeClass = 'bg-secondary';
    else if (status === 'CHECKOUT_MISSING') badgeClass = 'bg-warning';

    return (
      <div className="d-flex align-items-center gap-1 flex-wrap">
        <span className={`badge ${badgeClass}`}>
          {status.replace(/_/g, ' ')}
        </span>
        {isLate && <span className="badge bg-warning">LATE</span>}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="page-title">My Attendance Records</h1>
        <p className="text-muted">Review your personal daily check-in logs and work hours</p>
      </div>

      {/* Filter Card */}
      <div className="card p-4 mb-4">
        <Row className="g-3 align-items-end">
          <Col md={4} sm={6}>
            <Form.Group>
              <Form.Label className="d-flex align-items-center gap-2">
                <Calendar size={14} className="text-muted" />
                <span>Month</span>
              </Form.Label>
              <Form.Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={4} sm={6}>
            <Form.Group>
              <Form.Label>Year</Form.Label>
              <Form.Control
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </Form.Group>
          </Col>
        </Row>
      </div>

      {/* Records Table Card */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <div className="text-muted mt-2">Loading attendance log...</div>
          </div>
        ) : (
          <div className="table-responsive" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Source</th>
                  <th>Working Hours</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-5 text-muted">
                      No attendance records found for this period.
                    </td>
                  </tr>
                ) : (
                  attendance.map((a, idx) => (
                    <tr key={idx}>
                      <td className="fw-semibold text-dark">{a.date}</td>
                      <td className="text-muted">{a.day}</td>
                      <td>{getStatusBadge(a.status, a.isLate)}</td>
                      <td style={{ fontWeight: 500 }}>{formatTime(a.checkIn)}</td>
                      <td style={{ fontWeight: 500 }}>{formatTime(a.checkOut)}</td>
                      <td>
                        {a.attendanceSource ? (
                          a.attendanceSource === 'Web Portal' ? (
                            <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle fw-medium d-inline-flex align-items-center gap-1" style={{ fontSize: '11px', padding: '3px 8px' }}>
                              <Monitor size={11} /> Web Portal
                            </span>
                          ) : (
                            <span className="badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle fw-medium d-inline-flex align-items-center gap-1" style={{ fontSize: '11px', padding: '3px 8px' }}>
                              <Smartphone size={11} /> Mobile App
                            </span>
                          )
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: '13.5px' }}>
                          <Clock size={13} />
                          <span>{a.status !== 'NOT_MARKED' ? formatHours(a.workingMinutes || 0) : '-'}</span>
                        </div>
                      </td>
                      <td className="text-muted small">{a.leaveType || a.holidayName || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
