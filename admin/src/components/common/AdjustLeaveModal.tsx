import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner, Alert, Badge } from 'react-bootstrap';
import {
  CalendarPlus,
  PlusCircle,
  MinusCircle,
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  ArrowRight
} from 'lucide-react';
import axios from 'axios';

interface AdjustLeaveModalProps {
  show: boolean;
  onHide: () => void;
  employee: {
    id: number;
    name: string;
    employeeId?: string;
    employee_code?: string;
    employee_id?: string;
    department?: string;
  } | null;
  currentBalance?: number;
  token?: string | null;
  onSuccess: (data: any) => void;
}

const PRESET_REASONS = [
  'Compensatory Off (Comp-Off)',
  'Weekend / Holiday Working Credit',
  'Attendance Discrepancy Correction',
  'Bonus Leave Approved',
  'Unrecorded Leave Deduction',
  'Policy Exception',
  'Other / Custom'
];

export default function AdjustLeaveModal({
  show,
  onHide,
  employee,
  currentBalance = 0,
  token,
  onSuccess
}: AdjustLeaveModalProps) {
  const [activeTab, setActiveTab] = useState<'adjust' | 'history'>('adjust');
  const [actionType, setActionType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [days, setDays] = useState<number>(1.0);
  const [customDays, setCustomDays] = useState<string>('1.0');
  const [presetReason, setPresetReason] = useState<string>(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live balance state
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (show) {
      setActiveTab('adjust');
      setActionType('ADD');
      setDays(1.0);
      setCustomDays('1.0');
      setPresetReason(PRESET_REASONS[0]);
      setCustomReason('');
      setError(null);
      setSuccessMsg(null);
      
      const initBal = (currentBalance !== undefined && currentBalance !== null && !isNaN(Number(currentBalance)))
        ? Number(currentBalance)
        : null;
      setLiveBalance(initBal);

      if (employee?.id) {
        fetchLiveBalance(employee.id);
        fetchHistory(employee.id);
      }
    }
  }, [show, employee, currentBalance]);

  const fetchLiveBalance = async (empId: number) => {
    if (!token) return;
    try {
      setLoadingBalance(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await axios.get(`${baseUrl}/api/admin/leave/balance/${empId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success && res.data.data) {
        setLiveBalance(Number(res.data.data.currentBalance || 0));
      }
    } catch (err: any) {
      console.warn('Failed to fetch live balance:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  const fetchHistory = async (empId: number) => {
    if (!token) return;
    try {
      setLoadingHistory(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await axios.get(`${baseUrl}/api/admin/leave/adjust-history/${empId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setHistory(res.data.data || []);
      }
    } catch (err: any) {
      console.warn('Failed to fetch leave adjustment history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleQuickDays = (d: number) => {
    setDays(d);
    setCustomDays(String(d));
  };

  const handleCustomDaysChange = (val: string) => {
    setCustomDays(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setDays(parsed);
    }
  };

  const currentBalNum = liveBalance !== null ? liveBalance : (Number(currentBalance) || 0);
  const newBalance =
    actionType === 'ADD'
      ? Math.round((currentBalNum + (Number(days) || 0)) * 100) / 100
      : Math.max(0, Math.round((currentBalNum - (Number(days) || 0)) * 100) / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee?.id || !token) return;

    const numDays = parseFloat(customDays);
    if (isNaN(numDays) || numDays <= 0) {
      setError('Please specify a positive number of days (e.g. 0.5, 1, 2).');
      return;
    }

    if (actionType === 'DEDUCT' && numDays > currentBalNum) {
      setError(`Cannot deduct ${numDays} days. Employee only has ${currentBalNum} days available.`);
      return;
    }

    const finalReason = presetReason === 'Other / Custom'
      ? customReason.trim()
      : (customReason.trim() ? `${presetReason} - ${customReason.trim()}` : presetReason);

    if (finalReason.length < 3) {
      setError('Please provide a reason or remarks (minimum 3 characters).');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await axios.post(
        `${baseUrl}/api/admin/leave/adjust-balance`,
        {
          employeeId: employee.id,
          actionType,
          days: numDays,
          reason: finalReason
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setSuccessMsg(res.data.message || 'Leave balance updated successfully.');
        if (res.data.data?.newBalance !== undefined) {
          setLiveBalance(Number(res.data.data.newBalance));
        }
        onSuccess(res.data.data);
        fetchHistory(employee.id);
        setTimeout(() => {
          onHide();
        }, 1200);
      } else {
        setError(res.data.error?.message || 'Failed to adjust balance.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Network error while updating leave balance.');
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static" size="lg">
      <Modal.Header closeButton className="border-bottom pb-3">
        <div className="d-flex align-items-center gap-2">
          <div
            className="d-flex align-items-center justify-content-center rounded-circle"
            style={{ width: '38px', height: '38px', backgroundColor: '#EFF6FF', color: '#2563EB' }}
          >
            <CalendarPlus size={20} />
          </div>
          <div>
            <Modal.Title className="h5 mb-0 fw-bold" style={{ fontSize: '17px' }}>
              Adjust Leave Balance
            </Modal.Title>
            <span className="text-muted small">
              Official HR Leave Ledger Credit / Debit for Employee
            </span>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-4">
        {/* Employee Banner */}
        <div
          className="p-3 rounded-3 mb-4 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3"
          style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-flex align-items-center justify-content-center rounded-circle bg-primary text-white fw-bold"
              style={{ width: '42px', height: '42px', fontSize: '16px' }}
            >
              {employee.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="fw-bold text-dark" style={{ fontSize: '15px' }}>
                {employee.name}
              </div>
              <div className="text-muted small font-monospace">
                {employee.employee_code || employee.employeeId || employee.employee_id || 'ID On File'} &bull; {employee.department || 'Operations'}
              </div>
            </div>
          </div>

          <div className="text-sm-end bg-white px-3 py-2 rounded-2 border">
            <div className="text-muted" style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Current Paid Leave
            </div>
            <div className="fw-bold text-primary d-flex align-items-center justify-content-end gap-1.5" style={{ fontSize: '18px' }}>
              {loadingBalance && liveBalance === null ? (
                <Spinner size="sm" animation="border" variant="primary" style={{ width: '1rem', height: '1rem' }} />
              ) : (
                <>
                  <span>{currentBalNum.toFixed(1)}</span>
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>days</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="d-flex border-bottom mb-4">
          <button
            type="button"
            className={`btn btn-link text-decoration-none px-3 py-2 fw-semibold border-bottom border-2 ${
              activeTab === 'adjust' ? 'border-primary text-primary' : 'border-transparent text-muted'
            }`}
            onClick={() => setActiveTab('adjust')}
            style={{ borderRadius: 0 }}
          >
            Adjust Balance
          </button>
          <button
            type="button"
            className={`btn btn-link text-decoration-none px-3 py-2 fw-semibold border-bottom border-2 d-flex align-items-center gap-1.5 ${
              activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted'
            }`}
            onClick={() => setActiveTab('history')}
            style={{ borderRadius: 0 }}
          >
            <History size={15} />
            <span>Adjustment History ({history.length})</span>
          </button>
        </div>

        {error && (
          <Alert variant="danger" className="d-flex align-items-center gap-2 mb-3 py-2">
            <AlertCircle size={16} />
            <span style={{ fontSize: '13.5px' }}>{error}</span>
          </Alert>
        )}

        {successMsg && (
          <Alert variant="success" className="d-flex align-items-center gap-2 mb-3 py-2">
            <CheckCircle2 size={16} />
            <span style={{ fontSize: '13.5px' }}>{successMsg}</span>
          </Alert>
        )}

        {activeTab === 'adjust' ? (
          <Form onSubmit={handleSubmit}>
            {/* Action Type */}
            <div className="mb-3">
              <Form.Label className="fw-bold text-dark small mb-2">Adjustment Action</Form.Label>
              <div className="row g-2">
                <div className="col-6">
                  <div
                    onClick={() => setActionType('ADD')}
                    className={`p-3 rounded-3 border text-center cursor-pointer transition-all ${
                      actionType === 'ADD'
                        ? 'border-success bg-success-subtle shadow-sm'
                        : 'border-light bg-light hover-bg'
                    }`}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex align-items-center justify-content-center gap-2 text-success fw-bold mb-1">
                      <PlusCircle size={18} />
                      <span>Credit / Add Days (+)</span>
                    </div>
                    <span className="text-muted" style={{ fontSize: '11.5px' }}>
                      Comp-off, bonus, or manual credit
                    </span>
                  </div>
                </div>

                <div className="col-6">
                  <div
                    onClick={() => setActionType('DEDUCT')}
                    className={`p-3 rounded-3 border text-center cursor-pointer transition-all ${
                      actionType === 'DEDUCT'
                        ? 'border-danger bg-danger-subtle shadow-sm'
                        : 'border-light bg-light hover-bg'
                    }`}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex align-items-center justify-content-center gap-2 text-danger fw-bold mb-1">
                      <MinusCircle size={18} />
                      <span>Debit / Deduct Days (-)</span>
                    </div>
                    <span className="text-muted" style={{ fontSize: '11.5px' }}>
                      Corrections or unrecorded leave
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Days Selection */}
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <Form.Label className="fw-bold text-dark small mb-0">Days to Adjust</Form.Label>
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  Half-days supported (e.g. 0.5)
                </span>
              </div>

              {/* Quick Pills */}
              <div className="d-flex flex-wrap gap-2 mb-2">
                {[0.5, 1.0, 1.5, 2.0, 3.0, 5.0].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`btn btn-sm ${
                      days === d && customDays === String(d)
                        ? actionType === 'ADD' ? 'btn-success' : 'btn-danger'
                        : 'btn-outline-secondary'
                    }`}
                    onClick={() => handleQuickDays(d)}
                    style={{ minWidth: '55px', fontWeight: 600 }}
                  >
                    {actionType === 'ADD' ? `+${d}` : `-${d}`}
                  </button>
                ))}
              </div>

              <Form.Control
                type="number"
                step="0.5"
                min="0.5"
                value={customDays}
                onChange={(e) => handleCustomDaysChange(e.target.value)}
                placeholder="Enter number of days"
                required
              />
            </div>

            {/* Live Calculation Preview Banner */}
            <div
              className={`p-3 rounded-3 mb-3 d-flex align-items-center justify-content-between border ${
                actionType === 'ADD' ? 'bg-success-subtle border-success-subtle' : 'bg-warning-subtle border-warning-subtle'
              }`}
            >
              <div>
                <span className="text-muted small d-block">Resulting Leave Balance:</span>
                <span className="fw-bold text-dark" style={{ fontSize: '14px' }}>
                  {currentBalNum} days {actionType === 'ADD' ? '+' : '-'} {days || 0} days
                </span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <ArrowRight size={18} className="text-muted" />
                <Badge
                  bg={actionType === 'ADD' ? 'success' : 'danger'}
                  className="px-3 py-2"
                  style={{ fontSize: '15px', fontWeight: 700 }}
                >
                  {newBalance.toFixed(1)} Days
                </Badge>
              </div>
            </div>

            {/* Reason */}
            <div className="mb-3">
              <Form.Label className="fw-bold text-dark small mb-1">Reason / Category</Form.Label>
              <Form.Select
                value={presetReason}
                onChange={(e) => setPresetReason(e.target.value)}
                className="mb-2"
              >
                {PRESET_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Form.Select>

              <Form.Control
                as="textarea"
                rows={2}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder={
                  presetReason === 'Other / Custom'
                    ? 'Please specify exact reason (mandatory)...'
                    : 'Additional remarks / reference notes (optional)...'
                }
                required={presetReason === 'Other / Custom'}
              />
            </div>

            <div className="d-flex justify-content-end gap-2 pt-2 border-top">
              <Button variant="secondary" size="sm" onClick={onHide} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant={actionType === 'ADD' ? 'success' : 'danger'}
                size="sm"
                type="submit"
                disabled={loading}
                className="d-flex align-items-center gap-1.5 px-3"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" animation="border" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    {actionType === 'ADD' ? <PlusCircle size={15} /> : <MinusCircle size={15} />}
                    <span>Confirm {actionType === 'ADD' ? 'Credit' : 'Debit'} ({days} Day{days !== 1 ? 's' : ''})</span>
                  </>
                )}
              </Button>
            </div>
          </Form>
        ) : (
          <div>
            {loadingHistory ? (
              <div className="text-center py-4 text-muted">
                <Spinner size="sm" animation="border" className="me-2" />
                <span>Loading balance adjustment history...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <History size={32} className="text-secondary opacity-50 mb-2" />
                <p className="mb-0 small">No manual adjustments recorded for this employee yet.</p>
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '12.5px' }}>
                  <thead className="table-light">
                    <tr>
                      <th>Date</th>
                      <th>Admin</th>
                      <th>Action</th>
                      <th>Balance Change</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="text-muted font-monospace" style={{ whiteSpace: 'nowrap' }}>
                          {new Date(h.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td>
                          <span className="fw-semibold text-dark">{h.adminName || 'Admin'}</span>
                        </td>
                        <td>
                          <Badge bg={h.actionType === 'ADD' ? 'success' : 'danger'} className="fw-semibold">
                            {h.actionType === 'ADD' ? `+${h.days}` : `-${h.days}`} days
                          </Badge>
                        </td>
                        <td className="font-monospace">
                          <span className="text-muted">{h.previousBalance}</span>
                          <span className="mx-1 text-muted">&rarr;</span>
                          <strong className={h.actionType === 'ADD' ? 'text-success' : 'text-danger'}>
                            {h.newBalance}
                          </strong>
                        </td>
                        <td style={{ maxWidth: '240px' }} className="text-truncate" title={h.reason}>
                          {h.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="d-flex justify-content-end pt-3 mt-3 border-top">
              <Button variant="secondary" size="sm" onClick={() => setActiveTab('adjust')}>
                Back to Adjustment
              </Button>
            </div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
