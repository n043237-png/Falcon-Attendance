import React, { useState, useEffect } from 'react';
import { Form, Modal, Pagination, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  CalendarRange,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CalendarPlus,
  UserCheck,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import ImagePreviewModal from '../components/common/ImagePreviewModal';
import AdjustLeaveModal from '../components/common/AdjustLeaveModal';

export default function AdminLeave() {
  const { token, user } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewEmployee, setPreviewEmployee] = useState<any>(null);

  const [showAdjustLeave, setShowAdjustLeave] = useState(false);
  const [adjustLeaveEmployee, setAdjustLeaveEmployee] = useState<any>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (token) checkInit();
  }, [token]);

  useEffect(() => {
    if (token) fetchLeaves();
  }, [page, statusFilter, token]);

  const checkInit = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/leave/is-initialized`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.data.data.initialized) {
        navigate('/leave-init');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/leave?page=${page}&status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeaves(res.data.data.items || []);
      setTotalPages(res.data.data.pagination.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    if (!window.confirm('Are you sure you want to approve this leave request?')) return;
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/leave/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchLeaves();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!rejectReason || rejectReason.trim().length < 3) {
      setError('Please provide a valid reason for rejection (min 3 characters).');
      return;
    }
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/leave/${selectedLeave}/reject`, { comment: rejectReason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowRejectModal(false);
      setRejectReason('');
      fetchLeaves();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.error || 'Failed to reject leave');
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
          <h1 className="page-title">Leave Management</h1>
          <p className="text-muted mb-0">Review employee leave applications and balances</p>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card p-4 mb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <Filter size={16} className="text-muted" />
            <span className="fw-semibold text-dark" style={{ fontSize: '14px' }}>Filter Status:</span>
            <div className="d-flex gap-2 flex-wrap">
              {['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'All'].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                >
                  {st === 'All' ? 'All Requests' : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <div className="text-muted mt-2" style={{ fontSize: '14px' }}>Loading leave requests...</div>
          </div>
        ) : (
          <>
            <div className="table-responsive" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Employee ID</th>
                    <th>Leave Type</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Approving Manager</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-5 text-muted">
                        No leave requests found for the selected filter.
                      </td>
                    </tr>
                  ) : (
                    leaves.map((lr) => {
                      const isAssignedToOther = Boolean(
                        lr.assignedTo && user?.id && Number(lr.assignedTo) !== Number(user.id)
                      );

                      return (
                        <tr key={lr.id}>
                          <td>
                            <div className="d-flex align-items-center gap-3">
                              <Avatar
                                src={lr.profilePhotoUrl}
                                name={lr.employeeName}
                                size={36}
                                shape="rounded"
                                showBorder
                                borderColor="rgba(226, 232, 240, 0.8)"
                                onClick={() => {
                                  setPreviewEmployee(lr);
                                  setShowPreviewModal(true);
                                }}
                              />
                              <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
                                {lr.employeeName}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-secondary font-monospace" style={{ fontSize: '12px' }}>
                              {lr.employeeId}
                            </span>
                          </td>
                          <td>
                            <span className="badge bg-info">{lr.leaveType}</span>
                          </td>
                          <td style={{ color: '#475569', fontSize: '13.5px' }}>
                            {lr.startDate} to {lr.endDate}
                          </td>
                          <td>
                            <span className="fw-semibold text-dark">{lr.totalDays}</span> day(s)
                          </td>
                          <td style={{ maxWidth: '220px' }}>
                            <div className="text-truncate text-muted" title={lr.reason} style={{ fontSize: '13.5px' }}>
                              {lr.reason || '-'}
                            </div>
                          </td>
                          <td>
                            {lr.assignedToName ? (
                              <span
                                className={`badge d-inline-flex align-items-center gap-1 ${
                                  user?.id && Number(lr.assignedTo) === Number(user.id)
                                    ? 'bg-primary-subtle text-primary border border-primary'
                                    : 'bg-light text-dark border'
                                }`}
                                style={{ fontSize: '12px', padding: '5px 8px' }}
                              >
                                <UserCheck size={12} />
                                {lr.assignedToName}
                                {user?.id && Number(lr.assignedTo) === Number(user.id) && ' (You)'}
                              </span>
                            ) : (
                              <span
                                className="badge bg-light text-muted border d-inline-flex align-items-center gap-1"
                                style={{ fontSize: '12px', padding: '5px 8px' }}
                              >
                                All Admins
                              </span>
                            )}
                          </td>
                          <td>
                            <div>
                              <span
                                className={`badge ${
                                  lr.status === 'APPROVED'
                                    ? 'bg-success'
                                    : lr.status === 'REJECTED'
                                    ? 'bg-danger'
                                    : lr.status === 'PENDING'
                                    ? 'bg-warning'
                                    : 'bg-secondary'
                                }`}
                              >
                                {lr.status}
                              </span>
                              {lr.reviewerName && lr.status !== 'PENDING' && (
                                <div className="text-muted mt-1" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                                  by {lr.reviewerName}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="text-end">
                            <div className="d-inline-flex gap-2 align-items-center">
                              {lr.status === 'PENDING' && (
                                isAssignedToOther ? (
                                  <span
                                    className="badge bg-light text-secondary border px-2 py-1 d-inline-flex align-items-center gap-1"
                                    title={`Assigned to ${lr.assignedToName} for review`}
                                    style={{ fontSize: '11.5px', fontWeight: '500' }}
                                  >
                                    <Lock size={12} className="text-muted" /> Assigned to {lr.assignedToName}
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      className="btn btn-success btn-sm"
                                      onClick={() => handleApprove(lr.id)}
                                      title="Approve leave"
                                    >
                                      <CheckCircle2 size={14} />
                                      <span>Approve</span>
                                    </button>
                                    <button
                                      className="btn btn-outline-danger btn-sm"
                                      onClick={() => {
                                        setSelectedLeave(lr.id);
                                        setShowRejectModal(true);
                                      }}
                                      title="Reject leave"
                                    >
                                      <XCircle size={14} />
                                      <span>Reject</span>
                                    </button>
                                  </>
                                )
                              )}
                              <button
                                className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                              onClick={() => {
                                setAdjustLeaveEmployee({
                                  id: lr.userId,
                                  name: lr.employeeName,
                                  employee_code: lr.employeeId
                                });
                                setShowAdjustLeave(true);
                              }}
                              title="Adjust Employee Leave Balance"
                            >
                              <CalendarPlus size={13} />
                              <span>Adjust</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="d-flex align-items-center justify-content-between p-3 border-top bg-white">
                <span className="text-muted" style={{ fontSize: '13px' }}>
                  Showing page {page} of {totalPages}
                </span>
                <Pagination className="mb-0">
                  <Pagination.Prev disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft size={14} />
                  </Pagination.Prev>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <Pagination.Ellipsis disabled />}
                        <Pagination.Item active={page === p} onClick={() => setPage(p)}>
                          {p}
                        </Pagination.Item>
                      </React.Fragment>
                    ))}
                  <Pagination.Next disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight size={14} />
                  </Pagination.Next>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reject Reason Modal */}
      <Modal show={showRejectModal} onHide={() => { setShowRejectModal(false); setError(''); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>Reject Leave Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="d-flex align-items-center gap-2 mb-3">
              <AlertCircle size={15} />
              <span>{error}</span>
            </Alert>
          )}
          <Form.Group>
            <Form.Label>Reason for Rejection *</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="State why this leave request is being declined..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={handleReject}>
            Confirm Rejection
          </button>
        </Modal.Footer>
      </Modal>

      <ImagePreviewModal
        show={showPreviewModal}
        onHide={() => setShowPreviewModal(false)}
        src={previewEmployee?.profilePhotoUrl}
        name={previewEmployee?.employeeName}
        employeeId={previewEmployee?.employeeId}
        role="Employee"
      />

      <AdjustLeaveModal
        show={showAdjustLeave}
        onHide={() => setShowAdjustLeave(false)}
        employee={adjustLeaveEmployee}
        token={token}
        onSuccess={() => {
          fetchLeaves();
        }}
      />
    </div>
  );
}
