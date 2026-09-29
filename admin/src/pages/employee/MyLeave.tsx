import React, { useEffect, useState } from 'react';
import { Form, Modal, Alert, Spinner, Badge, Button, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import {
  CalendarRange,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  ShieldAlert,
  CalendarDays,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function MyLeave() {
  const { token } = useAuth();
  const [balances, setBalances] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [formData, setFormData] = useState({
    leave_type_id: 'Paid Leave',
    start_date: '',
    end_date: '',
    total_days: 1,
    reason: ''
  });

  // Smart Leave Validation State
  const [validation, setValidation] = useState<any | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [alert, setAlert] = useState({ show: false, message: '', variant: 'success' });

  const fetchData = async () => {
    try {
      const [balRes, reqRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/employee/leave-balances`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/employee/leave-requests`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setBalances(balRes.data);
      setRequests(reqRes.data);
    } catch (err) {
      console.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  // Real-time Smart Leave Validation on date change
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      if (formData.start_date > formData.end_date) {
        setValidation(null);
        setValidationError('Start date must be before or equal to end date.');
        return;
      }
      setValidationError(null);
      setValidating(true);

      axios
        .get(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/employee/validate-leave?startDate=${formData.start_date}&endDate=${formData.end_date}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        .then((res) => {
          if (res.data?.success && res.data.data) {
            setValidation(res.data.data);
            setFormData((prev) => ({ ...prev, total_days: res.data.data.totalDays }));
          }
        })
        .catch((err) => {
          const msg =
            err.response?.data?.error ||
            err.response?.data?.error?.message ||
            'Failed to validate leave dates';
          setValidationError(msg);
          setValidation(null);
        })
        .finally(() => {
          setValidating(false);
        });
    } else {
      setValidation(null);
      setValidationError(null);
    }
  }, [formData.start_date, formData.end_date, token]);

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validation) {
      setAlert({ show: true, message: 'Please select valid leave dates.', variant: 'danger' });
      return;
    }

    if (!validation.canSubmit) {
      setAlert({
        show: true,
        message: validation.blockReason || 'Cannot submit leave request.',
        variant: 'danger'
      });
      return;
    }

    // Open confirmation impact dialog before final submission
    setShowConfirmModal(true);
  };

  const handleConfirmedSubmit = async () => {
    setSubmitting(true);
    setShowConfirmModal(false);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/employee/leave-requests`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowApply(false);
      setAlert({ show: true, message: 'Leave request submitted successfully.', variant: 'success' });
      setFormData({ leave_type_id: 'Paid Leave', start_date: '', end_date: '', total_days: 1, reason: '' });
      setValidation(null);
      fetchData();
    } catch (err: any) {
      setAlert({
        show: true,
        message: err.response?.data?.error || err.response?.data?.error?.message || 'Failed to submit leave request.',
        variant: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryBadge = (category: string, label: string) => {
    switch (category) {
      case 'WORKING_DAY':
        return (
          <span className="badge" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF', fontSize: '11.5px', fontWeight: 600 }}>
            {label}
          </span>
        );
      case 'WEEKLY_OFF':
        return (
          <span className="badge" style={{ backgroundColor: '#DCFCE7', color: '#15803D', fontSize: '11.5px', fontWeight: 600 }}>
            {label}
          </span>
        );
      case 'COMPANY_HOLIDAY':
        return (
          <span className="badge" style={{ backgroundColor: '#FEF3C7', color: '#B45309', fontSize: '11.5px', fontWeight: 600 }}>
            {label}
          </span>
        );
      default:
        return (
          <span className="badge" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C', fontSize: '11.5px', fontWeight: 600 }}>
            {label}
          </span>
        );
    }
  };

  return (
    <div className="pb-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="page-title mb-1">My Leaves</h1>
          <p className="text-muted mb-0" style={{ fontSize: '13.5px' }}>
            Track available leave balances, preview leave consumption, and submit time-off requests
          </p>
        </div>
        <div>
          <button className="btn btn-primary d-flex align-items-center gap-1.5 px-3 py-2" onClick={() => setShowApply(true)}>
            <Plus size={16} />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {alert.show && (
        <Alert
          variant={alert.variant}
          dismissible
          onClose={() => setAlert({ ...alert, show: false })}
          className="mb-4 d-flex align-items-center gap-2 rounded-3 shadow-sm py-2.5 px-3"
          style={{ fontSize: '13.5px' }}
        >
          {alert.variant === 'success' ? <CheckCircle2 size={16} className="flex-shrink-0" /> : <AlertCircle size={16} className="flex-shrink-0" />}
          <span>{alert.message}</span>
        </Alert>
      )}

      {/* Leave Balances Cards */}
      <div className="row g-3 mb-4">
        {balances.map((b, idx) => (
          <div key={idx} className="col-sm-6 col-md-4">
            <div className="card p-3 border-0 shadow-sm rounded-3 h-100" style={{ background: '#FFFFFF' }}>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <span className="text-muted fw-semibold small text-uppercase" style={{ letterSpacing: '0.04em' }}>
                  {b.name}
                </span>
                <span className="p-1.5 rounded-circle bg-light text-primary">
                  <CalendarRange size={16} />
                </span>
              </div>
              <div className="d-flex align-items-baseline gap-2">
                <span className="fs-3 fw-bold text-dark">{b.allocated_days ?? 0}</span>
                <span className="text-muted small">days available</span>
              </div>
              <div className="text-muted small mt-2 pt-2 border-top d-flex justify-content-between">
                <span>Used this cycle:</span>
                <strong>{b.used_days ?? 0} day(s)</strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Leave Requests Table */}
      <div className="card border-0 shadow-sm rounded-3 overflow-hidden" style={{ background: '#FFFFFF' }}>
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between">
          <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: '15px' }}>Leave Applications History</h5>
          <span className="text-muted small">{requests.length} record{requests.length === 1 ? '' : 's'}</span>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: '13.5px' }}>
            <thead className="table-light">
              <tr>
                <th>Leave Type</th>
                <th>Dates</th>
                <th>Total Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actioned By</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted">
                    No leave requests on record.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="badge bg-light text-dark border fw-medium">{r.leave_type_name || 'Leave'}</span>
                    </td>
                    <td style={{ color: '#334155' }}>
                      {new Date(r.start_date).toLocaleDateString()} &mdash; {new Date(r.end_date).toLocaleDateString()}
                    </td>
                    <td>
                      <span className="fw-semibold text-dark">{r.total_days}</span> day(s)
                    </td>
                    <td style={{ maxWidth: '240px' }}>
                      <div className="text-truncate text-muted" title={r.reason}>
                        {r.reason}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          r.status === 'APPROVED'
                            ? 'bg-success'
                            : r.status === 'REJECTED'
                            ? 'bg-danger'
                            : 'bg-warning text-dark'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={{ minWidth: '180px' }}>
                      {r.status === 'REJECTED' ? (
                        <div>
                          <div className="fw-semibold text-danger d-flex align-items-center gap-1" style={{ fontSize: '13px' }}>
                            <span>Rejected by {r.reviewed_by_name || 'Admin'}</span>
                          </div>
                          {r.admin_remarks && (
                            <div className="text-secondary small mt-0.5" style={{ fontSize: '12px' }}>
                              <span className="fw-semibold">Reason:</span> "{r.admin_remarks}"
                            </div>
                          )}
                          {r.reviewed_at && (
                            <div className="text-muted" style={{ fontSize: '11px' }}>
                              {new Date(r.reviewed_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : r.status === 'APPROVED' ? (
                        <div>
                          <div className="fw-semibold text-success d-flex align-items-center gap-1" style={{ fontSize: '13px' }}>
                            <span>Approved by {r.reviewed_by_name || 'Admin'}</span>
                          </div>
                          {r.reviewed_at && (
                            <div className="text-muted" style={{ fontSize: '11px' }}>
                              {new Date(r.reviewed_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted small fst-italic">Pending Review</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal with Smart Validation Engine */}
      <Modal show={showApply} onHide={() => setShowApply(false)} size="lg" centered>
        <Form onSubmit={handlePreSubmit}>
          <Modal.Header closeButton className="border-bottom">
            <div>
              <Modal.Title style={{ fontSize: '17px', fontWeight: 700 }}>Apply for Leave</Modal.Title>
              <div className="text-muted small">Smart Leave Validation Engine analyzes dates before submission</div>
            </div>
          </Modal.Header>

          <Modal.Body className="p-4" style={{ maxHeight: 'calc(85vh - 120px)', overflowY: 'auto' }}>
            <div className="d-flex flex-column gap-3">
              <Form.Group>
                <Form.Label className="small fw-semibold">Leave Category *</Form.Label>
                <Form.Select
                  required
                  value={formData.leave_type_id}
                  onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
                >
                  <option value="Paid Leave">Paid Leave</option>
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Leave Without Pay">Leave Without Pay (LWP)</option>
                </Form.Select>
              </Form.Group>

              <Row className="g-3">
                <Col sm={6}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">Start Date *</Form.Label>
                    <Form.Control
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </Form.Group>
                </Col>
                <Col sm={6}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">End Date *</Form.Label>
                    <Form.Control
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </Form.Group>
                </Col>
              </Row>

              {validating && (
                <div className="d-flex align-items-center gap-2 p-2.5 rounded-3 bg-light text-muted small">
                  <Spinner animation="border" size="sm" />
                  <span>Analyzing requested dates against company calendar, weekly offs, and holidays...</span>
                </div>
              )}

              {validationError && (
                <Alert variant="danger" className="py-2 px-3 small mb-0 d-flex align-items-center gap-2">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  <span>{validationError}</span>
                </Alert>
              )}

              {/* SMART VALIDATION SUMMARY CARD & TIMELINE */}
              {validation && validation.isValid && (
                <div className="p-3 rounded-3 border bg-light mt-1">
                  {/* Summary Metric Counters */}
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <span className="fw-bold text-dark d-flex align-items-center gap-1.5" style={{ fontSize: '14px' }}>
                      <CalendarDays size={16} className="text-primary" />
                      <span>Leave Impact Summary</span>
                    </span>
                    <Badge bg="primary" className="fw-normal">
                      {validation.totalDays} Total Day{validation.totalDays === 1 ? '' : 's'} Selected
                    </Badge>
                  </div>

                  <div className="row g-2 mb-3 text-center">
                    <div className="col-4 col-sm-2">
                      <div className="p-2 rounded bg-white border">
                        <div className="text-muted" style={{ fontSize: '11px' }}>Total Days</div>
                        <div className="fw-bold fs-6 text-dark">{validation.totalDays}</div>
                      </div>
                    </div>
                    <div className="col-4 col-sm-2">
                      <div className="p-2 rounded bg-white border">
                        <div className="text-primary" style={{ fontSize: '11px' }}>Working Days</div>
                        <div className="fw-bold fs-6 text-primary">{validation.workingDays}</div>
                      </div>
                    </div>
                    <div className="col-4 col-sm-2">
                      <div className="p-2 rounded bg-white border">
                        <div className="text-success" style={{ fontSize: '11px' }}>Weekly Off</div>
                        <div className="fw-bold fs-6 text-success">{validation.weeklyOffDays}</div>
                      </div>
                    </div>
                    <div className="col-4 col-sm-2">
                      <div className="p-2 rounded bg-white border">
                        <div className="text-warning" style={{ fontSize: '11px' }}>Holidays</div>
                        <div className="fw-bold fs-6 text-warning">{validation.companyHolidays}</div>
                      </div>
                    </div>
                    <div className="col-4 col-sm-2">
                      <div className="p-2 rounded bg-white border">
                        <div className="text-muted" style={{ fontSize: '11px' }}>Paid Needed</div>
                        <div className="fw-bold fs-6 text-danger">{validation.paidLeaveRequired}</div>
                      </div>
                    </div>
                    <div className="col-4 col-sm-2">
                      <div className="p-2 rounded bg-white border">
                        <div className="text-muted" style={{ fontSize: '11px' }}>Balance After</div>
                        <div className="fw-bold fs-6 text-success">{validation.balanceAfter}</div>
                      </div>
                    </div>
                  </div>

                  {/* Special Notice Banner if any */}
                  {validation.specialNotice && (
                    <Alert
                      variant={
                        validation.specialNotice.type === 'ERROR'
                          ? 'danger'
                          : validation.specialNotice.type === 'WARNING'
                          ? 'warning'
                          : 'info'
                      }
                      className="py-2 px-3 small mb-3 d-flex align-items-start gap-2"
                    >
                      {validation.specialNotice.type === 'ERROR' ? (
                        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                      ) : validation.specialNotice.type === 'WARNING' ? (
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                      ) : (
                        <Info size={16} className="mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <strong>{validation.specialNotice.title}:</strong> {validation.specialNotice.message}
                      </div>
                    </Alert>
                  )}

                  {/* Timeline / Calendar Breakdown */}
                  <div className="mb-2">
                    <span className="text-muted small fw-semibold d-block mb-2">Day-by-Day Analysis</span>
                    <div className="d-flex flex-column gap-1.5" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {validation.daysBreakdown.map((d: any, i: number) => (
                        <div
                          key={i}
                          className="d-flex align-items-center justify-content-between p-2 rounded bg-white border"
                          style={{ fontSize: '12.5px' }}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-semibold text-dark">{d.formattedDate}</span>
                            {getCategoryBadge(d.category, d.categoryLabel)}
                          </div>
                          <span className={`small fw-medium ${d.consumesPaidLeave ? 'text-primary' : 'text-muted'}`}>
                            {d.deductionText}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Form.Group>
                <Form.Label className="small fw-semibold">Reason for Absence *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  required
                  placeholder="Provide reason regarding your leave request..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </Form.Group>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowApply(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm d-flex align-items-center gap-1.5"
              type="submit"
              disabled={validating || (validation && !validation.canSubmit)}
            >
              <span>Submit Request</span>
            </button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Confirmation Dialog: Leave Impact Analysis */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '16.5px', fontWeight: 700 }} className="d-flex align-items-center gap-2">
            <CalendarDays size={18} className="text-primary" />
            <span>Leave Impact Analysis</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {validation && (
            <div>
              <p className="text-dark mb-2" style={{ fontSize: '14px', fontWeight: 600 }}>
                Your leave request includes:
              </p>
              <ul className="mb-3 ps-3 text-dark" style={{ fontSize: '13.5px' }}>
                {validation.confirmationDialog.breakdownBulletPoints.map((pt: string, idx: number) => (
                  <li key={idx} className="mb-1">{pt}</li>
                ))}
              </ul>

              <div className="p-2.5 rounded-3 bg-light border text-muted small mb-3">
                {validation.confirmationDialog.policyNote}
              </div>

              <div className="d-flex justify-content-between p-2 rounded bg-light border mb-2" style={{ fontSize: '13.5px' }}>
                <span className="text-muted">Paid Leave Required:</span>
                <span className="fw-bold text-primary">{validation.confirmationDialog.paidLeaveRequiredText}</span>
              </div>

              <div className="d-flex justify-content-between p-2 rounded bg-light border mb-3" style={{ fontSize: '13.5px' }}>
                <span className="text-muted">Remaining Leave After Approval:</span>
                <span className="fw-bold text-success">{validation.confirmationDialog.balanceAfterText}</span>
              </div>

              {validation.confirmationDialog.lwpWarningText && (
                <Alert variant="warning" className="small py-2 px-3 mb-0">
                  {validation.confirmationDialog.lwpWarningText}
                </Alert>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-between">
          <Button variant="outline-secondary" size="sm" onClick={() => { setShowConfirmModal(false); setShowApply(false); }}>
            Cancel
          </Button>
          <div className="d-flex gap-2">
            <Button variant="outline-primary" size="sm" onClick={() => setShowConfirmModal(false)}>
              Modify Leave
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmedSubmit} disabled={submitting}>
              {submitting ? <Spinner size="sm" animation="border" className="me-1" /> : null}
              <span>Continue</span>
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
