import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Badge,
  Form,
  Spinner,
  Alert,
  Table,
  InputGroup,
  Dropdown,
  Modal,
  Nav
} from 'react-bootstrap';
import {
  Receipt,
  Search,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  FileCheck,
  Check,
  X,
  Eye,
  AlertCircle,
  Tag,
  Paperclip
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/common/Avatar';
import ReceiptViewerModal from '../../components/expenses/ReceiptViewerModal';

export default function AdminExpenses() {
  const { token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Active Tab: 'expenses' | 'advances' | 'reports'
  const [activeTab, setActiveTab] = useState<'expenses' | 'advances' | 'reports'>('expenses');

  // Data states
  const [expenses, setExpenses] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [projectsData, setProjectsData] = useState<{ projects: string[]; categories: string[]; clientMap: Record<string, string> }>({
    projects: [],
    categories: [],
    clientMap: {}
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Action Modals State
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'PAY_ADVANCE' | 'REIMBURSE_EXPENSE' | null>(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // View Details Modal
  const [detailItem, setDetailItem] = useState<any>(null);
  const [detailType, setDetailType] = useState<'expense' | 'advance'>('expense');

  // Receipt Viewer
  const [receiptViewerUrl, setReceiptViewerUrl] = useState<string | null>(null);
  const [receiptViewerMeta, setReceiptViewerMeta] = useState<any>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [expRes, advRes, metRes, projRes] = await Promise.all([
        axios.get(`${API_URL}/api/expenses/admin/claims`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/expenses/admin/advances`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/expenses/admin/metrics`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/expenses/projects`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (expRes.data.success) setExpenses(expRes.data.data);
      if (advRes.data.success) setAdvances(advRes.data.data);
      if (metRes.data.success) setMetrics(metRes.data.data);
      if (projRes.data.success) setProjectsData(projRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load expense and advance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  // Handle Export Excel
  const handleExportExcel = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/expenses/admin/export/excel`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Falcon_Expenses_Advances_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to export Excel report');
    }
  };

  // Handle Export PDF
  const handleExportPdf = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/expenses/admin/export/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Falcon_Expenses_Advances_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to export PDF report');
    }
  };

  // Open Action Modal
  const openActionModal = (item: any, type: 'APPROVE' | 'REJECT' | 'PAY_ADVANCE' | 'REIMBURSE_EXPENSE') => {
    setSelectedItem(item);
    setActionType(type);
    setAdminRemarks('');
    setPaymentRef(
      type === 'PAY_ADVANCE'
        ? `NEFT-${Date.now().toString().slice(-6)}`
        : type === 'REIMBURSE_EXPENSE'
        ? `REIMB-${Date.now().toString().slice(-6)}`
        : ''
    );
  };

  // Submit Action Modal
  const handleSubmitAction = async () => {
    if (!selectedItem || !actionType) return;
    setActionLoading(true);

    try {
      if (activeTab === 'advances') {
        let status = 'APPROVED';
        if (actionType === 'REJECT') status = 'REJECTED';
        if (actionType === 'PAY_ADVANCE') status = 'PAID';

        await axios.patch(
          `${API_URL}/api/expenses/admin/advances/${selectedItem.id}/status`,
          {
            status,
            adminRemarks,
            paymentReference: paymentRef
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setSuccessMsg(`Advance request marked as ${status}.`);
      } else {
        let status = 'APPROVED';
        if (actionType === 'REJECT') status = 'REJECTED';
        if (actionType === 'REIMBURSE_EXPENSE') status = 'REIMBURSED';

        await axios.patch(
          `${API_URL}/api/expenses/admin/claims/${selectedItem.id}/status`,
          {
            status,
            adminRemarks,
            reimbursementReference: paymentRef
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setSuccessMsg(`Expense claim marked as ${status}.`);
      }

      setActionType(null);
      setSelectedItem(null);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update request');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Expense Claims
  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      !searchTerm ||
      e.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.expense_category?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' || e.status === statusFilter;
    const matchesProject = projectFilter === 'All' || e.project_name === projectFilter;
    const matchesCategory = categoryFilter === 'All' || e.expense_category === categoryFilter;

    return matchesSearch && matchesStatus && matchesProject && matchesCategory;
  });

  // Filtered Advances
  const filteredAdvances = advances.filter((a) => {
    const matchesSearch =
      !searchTerm ||
      a.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.purpose?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
    const matchesProject = projectFilter === 'All' || a.project_name === projectFilter;

    return matchesSearch && matchesStatus && matchesProject;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge bg="success">Approved</Badge>;
      case 'PAID':
        return <Badge bg="primary">Disbursed (Paid)</Badge>;
      case 'REIMBURSED':
        return <Badge bg="primary">Reimbursed</Badge>;
      case 'REJECTED':
        return <Badge bg="danger">Rejected</Badge>;
      case 'CANCELLED':
        return <Badge bg="secondary">Cancelled</Badge>;
      default:
        return <Badge bg="warning" text="dark">Pending Approval</Badge>;
    }
  };

  return (
    <div className="container-fluid py-3 px-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h2 className="fw-bold mb-0 text-dark" style={{ fontSize: '1.65rem' }}>
              Project Expenses & Advances
            </h2>
            <Badge bg="primary" className="px-2 py-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
              FINANCE & ADVANCES
            </Badge>
          </div>
          <p className="text-muted mb-0 mt-1" style={{ fontSize: '13.5px' }}>
            Review, approve, disburse project advances, and process expense reimbursements with invoice verification.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Button
            variant="outline-secondary"
            className="d-flex align-items-center gap-1.5 px-3 py-2 shadow-sm"
            onClick={fetchData}
            disabled={loading}
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </Button>

          <Dropdown>
            <Dropdown.Toggle
              variant="outline-primary"
              className="d-flex align-items-center gap-1.5 px-3 py-2 shadow-sm"
              style={{ fontSize: '13px', fontWeight: 500 }}
            >
              <Download size={15} />
              <span>Export Report</span>
            </Dropdown.Toggle>
            <Dropdown.Menu className="shadow border-0 rounded-3">
              <Dropdown.Item onClick={handleExportExcel} className="d-flex align-items-center gap-2 py-2" style={{ fontSize: '13px' }}>
                <FileSpreadsheet size={16} className="text-success" />
                <span>Export Excel Workbook (.xlsx)</span>
              </Dropdown.Item>
              <Dropdown.Item onClick={handleExportPdf} className="d-flex align-items-center gap-2 py-2" style={{ fontSize: '13px' }}>
                <FileText size={16} className="text-danger" />
                <span>Export PDF Summary Report</span>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="shadow-sm">
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert variant="success" dismissible onClose={() => setSuccessMsg(null)} className="shadow-sm d-flex align-items-center gap-2">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </Alert>
      )}

      {/* Metric Cards Row */}
      {metrics && (
        <Row className="g-3 mb-4">
          <Col xs={12} sm={6} lg={3}>
            <Card className="border-0 shadow-sm rounded-3">
              <Card.Body className="p-3 d-flex align-items-center gap-3">
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <CreditCard size={22} />
                </div>
                <div>
                  <span className="text-muted d-block" style={{ fontSize: '12px', fontWeight: 500 }}>
                    Advances Disbursed
                  </span>
                  <h5 className="fw-bold mb-0 text-dark">
                    ₹{metrics.advances.paidAmount.toLocaleString('en-IN')}
                  </h5>
                  <span className="text-muted" style={{ fontSize: '11px' }}>
                    {metrics.advances.paidCount} of {metrics.advances.totalCount} advances paid
                  </span>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} sm={6} lg={3}>
            <Card className="border-0 shadow-sm rounded-3">
              <Card.Body className="p-3 d-flex align-items-center gap-3">
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: '#DCFCE7',
                    color: '#15803D',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Receipt size={22} />
                </div>
                <div>
                  <span className="text-muted d-block" style={{ fontSize: '12px', fontWeight: 500 }}>
                    Expenses Reimbursed
                  </span>
                  <h5 className="fw-bold mb-0 text-dark">
                    ₹{metrics.expenses.reimbursedAmount.toLocaleString('en-IN')}
                  </h5>
                  <span className="text-muted" style={{ fontSize: '11px' }}>
                    {metrics.expenses.reimbursedCount} of {metrics.expenses.totalCount} claims
                  </span>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} sm={6} lg={3}>
            <Card className="border-0 shadow-sm rounded-3">
              <Card.Body className="p-3 d-flex align-items-center gap-3">
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: '#FEF3C7',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Clock size={22} />
                </div>
                <div>
                  <span className="text-muted d-block" style={{ fontSize: '12px', fontWeight: 500 }}>
                    Pending Approvals
                  </span>
                  <h5 className="fw-bold mb-0 text-dark">
                    {metrics.advances.pendingCount + metrics.expenses.pendingCount} Requests
                  </h5>
                  <span className="text-warning fw-semibold" style={{ fontSize: '11px' }}>
                    ₹{(metrics.advances.pendingAmount + metrics.expenses.pendingAmount).toLocaleString('en-IN')} waiting
                  </span>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} sm={6} lg={3}>
            <Card className="border-0 shadow-sm rounded-3">
              <Card.Body className="p-3 d-flex align-items-center gap-3">
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: '#F1F5F9',
                    color: '#0F172A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <TrendingUp size={22} />
                </div>
                <div>
                  <span className="text-muted d-block" style={{ fontSize: '12px', fontWeight: 500 }}>
                    Total Project Claims
                  </span>
                  <h5 className="fw-bold mb-0 text-dark">
                    ₹{(metrics.advances.totalAmount + metrics.expenses.totalAmount).toLocaleString('en-IN')}
                  </h5>
                  <span className="text-muted" style={{ fontSize: '11px' }}>
                    All time project expenses
                  </span>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Navigation Tabs */}
      <Card className="border-0 shadow-sm rounded-3 mb-4">
        <Card.Header className="bg-white border-bottom p-0 px-3">
          <Nav variant="tabs" className="border-bottom-0">
            <Nav.Item>
              <Nav.Link
                active={activeTab === 'expenses'}
                onClick={() => { setActiveTab('expenses'); setStatusFilter('All'); }}
                className="py-3 px-4 d-flex align-items-center gap-2 fw-semibold"
                style={{ fontSize: '13.5px', cursor: 'pointer' }}
              >
                <Receipt size={16} />
                <span>Expense Claims</span>
                {metrics?.expenses?.pendingCount > 0 && (
                  <Badge bg="warning" text="dark" pill style={{ fontSize: '10px' }}>
                    {metrics.expenses.pendingCount}
                  </Badge>
                )}
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                active={activeTab === 'advances'}
                onClick={() => { setActiveTab('advances'); setStatusFilter('All'); }}
                className="py-3 px-4 d-flex align-items-center gap-2 fw-semibold"
                style={{ fontSize: '13.5px', cursor: 'pointer' }}
              >
                <CreditCard size={16} />
                <span>Advance Requests</span>
                {metrics?.advances?.pendingCount > 0 && (
                  <Badge bg="warning" text="dark" pill style={{ fontSize: '10px' }}>
                    {metrics.advances.pendingCount}
                  </Badge>
                )}
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                active={activeTab === 'reports'}
                onClick={() => setActiveTab('reports')}
                className="py-3 px-4 d-flex align-items-center gap-2 fw-semibold"
                style={{ fontSize: '13.5px', cursor: 'pointer' }}
              >
                <TrendingUp size={16} />
                <span>Categories & Reports</span>
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Card.Header>

        {activeTab !== 'reports' && (
          <Card.Body className="p-3 bg-light border-bottom">
            <Row className="g-2 align-items-center">
              <Col xs={12} md={4}>
                <InputGroup>
                  <InputGroup.Text className="bg-white border-end-0">
                    <Search size={15} className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Search by employee, project, description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-start-0 bg-white"
                    style={{ fontSize: '13px' }}
                  />
                </InputGroup>
              </Col>

              <Col xs={6} md={3}>
                <Form.Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="All">All Statuses</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  {activeTab === 'expenses' ? (
                    <option value="REIMBURSED">Reimbursed</option>
                  ) : (
                    <option value="PAID">Disbursed (Paid)</option>
                  )}
                  <option value="REJECTED">Rejected</option>
                </Form.Select>
              </Col>

              <Col xs={6} md={3}>
                <Form.Select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="All">All Projects</option>
                  {projectsData.projects.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Form.Select>
              </Col>

              {activeTab === 'expenses' && (
                <Col xs={12} md={2}>
                  <Form.Select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    style={{ fontSize: '13px' }}
                  >
                    <option value="All">All Categories</option>
                    {projectsData.categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Form.Select>
                </Col>
              )}
            </Row>
          </Card.Body>
        )}

        {/* Tab 1: Expense Claims Table */}
        {activeTab === 'expenses' && (
          <Card.Body className="p-0">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="text-muted mt-2 mb-0" style={{ fontSize: '13px' }}>Loading expense claims...</p>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-5">
                <Receipt size={40} className="text-muted opacity-40 mb-2" />
                <h5 className="fw-semibold text-dark">No Expense Claims Found</h5>
                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>No records match your filter criteria.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle mb-0" style={{ fontSize: '13px' }}>
                  <thead className="table-light text-muted fw-semibold">
                    <tr>
                      <th>Employee</th>
                      <th>Project / Client</th>
                      <th>Category</th>
                      <th>Expense Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Receipt</th>
                      <th style={{ textAlign: 'end', paddingRight: '20px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <Avatar name={exp.employee_name} size={32} shape="rounded" />
                            <div>
                              <div className="fw-bold text-dark">{exp.employee_name}</div>
                              <span className="text-muted" style={{ fontSize: '11px' }}>{exp.employee_code || `EMP#${exp.employee_id}`}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="fw-semibold text-dark">{exp.project_name}</div>
                          {exp.client_name && <span className="text-muted" style={{ fontSize: '11px' }}>{exp.client_name}</span>}
                        </td>
                        <td>
                          <Badge bg="light" text="dark" className="border px-2 py-1" style={{ fontSize: '11px' }}>
                            {exp.expense_category}
                          </Badge>
                        </td>
                        <td>{new Date(exp.expense_date).toLocaleDateString('en-GB')}</td>
                        <td>
                          <strong className="text-dark">₹{parseFloat(exp.amount).toLocaleString('en-IN')}</strong>
                        </td>
                        <td>
                          <span className="text-muted" style={{ fontSize: '12px' }}>{exp.payment_method || 'Cash'}</span>
                        </td>
                        <td>{getStatusBadge(exp.status)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {exp.receipt_url ? (
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="d-inline-flex align-items-center gap-1 px-2 py-0.5"
                              style={{ fontSize: '11px' }}
                              onClick={() => {
                                setReceiptViewerUrl(exp.receipt_url);
                                setReceiptViewerMeta({
                                  title: `Receipt for ${exp.expense_category}`,
                                  amount: exp.amount,
                                  category: exp.expense_category,
                                  employeeName: exp.employee_name
                                });
                              }}
                            >
                              <Paperclip size={12} />
                              <span>View</span>
                            </Button>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '11px' }}>None</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'end', paddingRight: '20px' }}>
                          <div className="d-flex align-items-center justify-content-end gap-1">
                            {exp.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="success"
                                  size="sm"
                                  className="d-flex align-items-center gap-1 px-2 py-1"
                                  style={{ fontSize: '11.5px', backgroundColor: '#16A34A', borderColor: '#16A34A' }}
                                  onClick={() => openActionModal(exp, 'APPROVE')}
                                >
                                  <Check size={13} />
                                  <span>Approve</span>
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  className="d-flex align-items-center gap-1 px-2 py-1"
                                  style={{ fontSize: '11.5px' }}
                                  onClick={() => openActionModal(exp, 'REJECT')}
                                >
                                  <X size={13} />
                                  <span>Reject</span>
                                </Button>
                              </>
                            )}

                            {exp.status === 'APPROVED' && (
                              <Button
                                variant="primary"
                                size="sm"
                                className="d-flex align-items-center gap-1 px-2 py-1"
                                style={{ fontSize: '11.5px', backgroundColor: '#2563EB', borderColor: '#2563EB' }}
                                onClick={() => openActionModal(exp, 'REIMBURSE_EXPENSE')}
                              >
                                <DollarSign size={13} />
                                <span>Reimburse</span>
                              </Button>
                            )}

                            <Button
                              variant="light"
                              size="sm"
                              className="d-flex align-items-center gap-1 px-2 py-1 text-muted border"
                              style={{ fontSize: '11.5px' }}
                              onClick={() => { setDetailItem(exp); setDetailType('expense'); }}
                              title="Details"
                            >
                              <Eye size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        )}

        {/* Tab 2: Advance Requests Table */}
        {activeTab === 'advances' && (
          <Card.Body className="p-0">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="text-muted mt-2 mb-0" style={{ fontSize: '13px' }}>Loading advance requests...</p>
              </div>
            ) : filteredAdvances.length === 0 ? (
              <div className="text-center py-5">
                <CreditCard size={40} className="text-muted opacity-40 mb-2" />
                <h5 className="fw-semibold text-dark">No Advance Requests Found</h5>
                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>No records match your filter criteria.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle mb-0" style={{ fontSize: '13px' }}>
                  <thead className="table-light text-muted fw-semibold">
                    <tr>
                      <th>Employee</th>
                      <th>Project / Client</th>
                      <th>Purpose</th>
                      <th>Required Date</th>
                      <th>Amount Requested</th>
                      <th>Status</th>
                      <th>Payment Ref</th>
                      <th style={{ textAlign: 'end', paddingRight: '20px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdvances.map((adv) => (
                      <tr key={adv.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <Avatar name={adv.employee_name} size={32} shape="rounded" />
                            <div>
                              <div className="fw-bold text-dark">{adv.employee_name}</div>
                              <span className="text-muted" style={{ fontSize: '11px' }}>{adv.employee_code || `EMP#${adv.employee_id}`}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="fw-semibold text-dark">{adv.project_name}</div>
                          {adv.client_name && <span className="text-muted" style={{ fontSize: '11px' }}>{adv.client_name}</span>}
                        </td>
                        <td>
                          <span className="text-truncate d-inline-block" style={{ maxWidth: '240px' }} title={adv.purpose}>
                            {adv.purpose}
                          </span>
                        </td>
                        <td>{new Date(adv.required_date).toLocaleDateString('en-GB')}</td>
                        <td>
                          <strong className="text-dark">₹{parseFloat(adv.amount_requested).toLocaleString('en-IN')}</strong>
                        </td>
                        <td>{getStatusBadge(adv.status)}</td>
                        <td>
                          <span className="text-muted" style={{ fontSize: '11.5px' }}>{adv.payment_reference || '-'}</span>
                        </td>
                        <td style={{ textAlign: 'end', paddingRight: '20px' }}>
                          <div className="d-flex align-items-center justify-content-end gap-1">
                            {adv.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="success"
                                  size="sm"
                                  className="d-flex align-items-center gap-1 px-2 py-1"
                                  style={{ fontSize: '11.5px', backgroundColor: '#16A34A', borderColor: '#16A34A' }}
                                  onClick={() => openActionModal(adv, 'APPROVE')}
                                >
                                  <Check size={13} />
                                  <span>Approve</span>
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  className="d-flex align-items-center gap-1 px-2 py-1"
                                  style={{ fontSize: '11.5px' }}
                                  onClick={() => openActionModal(adv, 'REJECT')}
                                >
                                  <X size={13} />
                                  <span>Reject</span>
                                </Button>
                              </>
                            )}

                            {adv.status === 'APPROVED' && (
                              <Button
                                variant="primary"
                                size="sm"
                                className="d-flex align-items-center gap-1 px-2 py-1"
                                style={{ fontSize: '11.5px', backgroundColor: '#2563EB', borderColor: '#2563EB' }}
                                onClick={() => openActionModal(adv, 'PAY_ADVANCE')}
                              >
                                <DollarSign size={13} />
                                <span>Disburse (Pay)</span>
                              </Button>
                            )}

                            <Button
                              variant="light"
                              size="sm"
                              className="d-flex align-items-center gap-1 px-2 py-1 text-muted border"
                              style={{ fontSize: '11.5px' }}
                              onClick={() => { setDetailItem(adv); setDetailType('advance'); }}
                              title="Details"
                            >
                              <Eye size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        )}

        {/* Tab 3: Reports & Category Analytics */}
        {activeTab === 'reports' && metrics && (
          <Card.Body className="p-4">
            <h5 className="fw-bold text-dark mb-3">Expense Category Breakdown</h5>
            <Row className="g-3">
              {metrics.categories.map((cat: any) => (
                <Col xs={12} sm={6} md={4} lg={3} key={cat.category}>
                  <div className="p-3 rounded-3 bg-light border">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>{cat.category}</span>
                      <Badge bg="secondary" style={{ fontSize: '10px' }}>{cat.count} Claims</Badge>
                    </div>
                    <h5 className="fw-bold text-primary mb-0">₹{cat.amount.toLocaleString('en-IN')}</h5>
                  </div>
                </Col>
              ))}
            </Row>

            <div className="mt-4 p-4 rounded-3 border d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 bg-light">
              <div>
                <h6 className="fw-bold mb-1 text-dark">Need formal corporate financial reports?</h6>
                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                  Download complete multi-sheet Excel files or audit-ready PDF summaries formatted with tax and payment records.
                </p>
              </div>
              <div className="d-flex gap-2">
                <Button variant="success" className="d-flex align-items-center gap-2 px-3 py-2" onClick={handleExportExcel}>
                  <FileSpreadsheet size={16} />
                  <span>Download Excel</span>
                </Button>
                <Button variant="danger" className="d-flex align-items-center gap-2 px-3 py-2" onClick={handleExportPdf}>
                  <FileText size={16} />
                  <span>Download PDF</span>
                </Button>
              </div>
            </div>
          </Card.Body>
        )}
      </Card>

      {/* Action Confirmation Modal (Approve, Reject, Disburse, Reimburse) */}
      <Modal show={Boolean(actionType)} onHide={() => setActionType(null)} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title style={{ fontSize: '16px', fontWeight: 700 }}>
            {actionType === 'APPROVE' && 'Approve Request'}
            {actionType === 'REJECT' && 'Reject Request'}
            {actionType === 'PAY_ADVANCE' && 'Disburse Advance Payment'}
            {actionType === 'REIMBURSE_EXPENSE' && 'Process Expense Reimbursement'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          {selectedItem && (
            <div className="p-2.5 rounded-2 bg-light border mb-3" style={{ fontSize: '12.5px' }}>
              <div><strong>Employee:</strong> {selectedItem.employee_name}</div>
              <div><strong>Project:</strong> {selectedItem.project_name}</div>
              <div><strong>Amount:</strong> ₹{parseFloat(selectedItem.amount_requested || selectedItem.amount).toLocaleString('en-IN')}</div>
            </div>
          )}

          {(actionType === 'PAY_ADVANCE' || actionType === 'REIMBURSE_EXPENSE') && (
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                Payment / Transaction Reference
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. NEFT-TXN-98472918 or UTR Number"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                style={{ fontSize: '13.5px' }}
              />
            </Form.Group>
          )}

          <Form.Group>
            <Form.Label className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
              {actionType === 'REJECT' ? 'Rejection Reason *' : 'Admin Remarks (Optional)'}
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              placeholder={actionType === 'REJECT' ? 'Please explain why this request is rejected...' : 'Optional approval or payment notes...'}
              value={adminRemarks}
              onChange={(e) => setAdminRemarks(e.target.value)}
              style={{ fontSize: '13px' }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="secondary" size="sm" onClick={() => setActionType(null)}>Cancel</Button>
          <Button
            variant={actionType === 'REJECT' ? 'danger' : 'primary'}
            size="sm"
            onClick={handleSubmitAction}
            disabled={actionLoading || (actionType === 'REJECT' && !adminRemarks.trim())}
          >
            {actionLoading ? <Spinner size="sm" animation="border" /> : 'Confirm Action'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Details Modal */}
      <Modal show={Boolean(detailItem)} onHide={() => setDetailItem(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '15px', fontWeight: 700 }}>
            {detailType === 'expense' ? 'Expense Claim Details' : 'Advance Request Details'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailItem && (
            <div className="d-flex flex-column gap-2" style={{ fontSize: '13px' }}>
              <div className="d-flex justify-content-between border-bottom pb-1.5">
                <span className="text-muted">Employee:</span>
                <strong>{detailItem.employee_name} ({detailItem.employee_code || detailItem.employee_id})</strong>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-1.5">
                <span className="text-muted">Project:</span>
                <strong>{detailItem.project_name}</strong>
              </div>
              {detailItem.client_name && (
                <div className="d-flex justify-content-between border-bottom pb-1.5">
                  <span className="text-muted">Client:</span>
                  <span>{detailItem.client_name}</span>
                </div>
              )}
              <div className="d-flex justify-content-between border-bottom pb-1.5">
                <span className="text-muted">Amount:</span>
                <strong className="text-primary" style={{ fontSize: '15px' }}>
                  ₹{parseFloat(detailItem.amount_requested || detailItem.amount).toLocaleString('en-IN')}
                </strong>
              </div>
              <div className="d-flex justify-content-between border-bottom pb-1.5">
                <span className="text-muted">Status:</span>
                {getStatusBadge(detailItem.status)}
              </div>
              {detailType === 'expense' && (
                <>
                  <div className="d-flex justify-content-between border-bottom pb-1.5">
                    <span className="text-muted">Category:</span>
                    <span>{detailItem.expense_category}</span>
                  </div>
                  <div className="d-flex justify-content-between border-bottom pb-1.5">
                    <span className="text-muted">Expense Date:</span>
                    <span>{new Date(detailItem.expense_date).toLocaleDateString('en-GB')}</span>
                  </div>
                  <div className="d-flex justify-content-between border-bottom pb-1.5">
                    <span className="text-muted">Payment Method:</span>
                    <span>{detailItem.payment_method}</span>
                  </div>
                  <div className="border-bottom pb-1.5">
                    <span className="text-muted d-block mb-1">Description:</span>
                    <p className="mb-0 bg-light p-2 rounded">{detailItem.description}</p>
                  </div>
                </>
              )}
              {detailType === 'advance' && (
                <>
                  <div className="d-flex justify-content-between border-bottom pb-1.5">
                    <span className="text-muted">Required Date:</span>
                    <span>{new Date(detailItem.required_date).toLocaleDateString('en-GB')}</span>
                  </div>
                  <div className="border-bottom pb-1.5">
                    <span className="text-muted d-block mb-1">Purpose:</span>
                    <p className="mb-0 bg-light p-2 rounded">{detailItem.purpose}</p>
                  </div>
                </>
              )}
              {detailItem.admin_remarks && (
                <div className="border-bottom pb-1.5">
                  <span className="text-muted d-block mb-1">Admin Remarks:</span>
                  <p className="mb-0 bg-warning-subtle p-2 rounded text-dark">{detailItem.admin_remarks}</p>
                </div>
              )}
              {detailItem.payment_reference && (
                <div className="d-flex justify-content-between border-bottom pb-1.5">
                  <span className="text-muted">Payment Ref:</span>
                  <code>{detailItem.payment_reference}</code>
                </div>
              )}
              {detailItem.reimbursement_reference && (
                <div className="d-flex justify-content-between border-bottom pb-1.5">
                  <span className="text-muted">Reimbursement Ref:</span>
                  <code>{detailItem.reimbursement_reference}</code>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Receipt Viewer Modal */}
      <ReceiptViewerModal
        show={Boolean(receiptViewerUrl)}
        onHide={() => setReceiptViewerUrl(null)}
        receiptUrl={receiptViewerUrl}
        {...receiptViewerMeta}
      />
    </div>
  );
}
