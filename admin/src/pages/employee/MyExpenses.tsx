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
  Modal,
  Nav
} from 'react-bootstrap';
import {
  Receipt,
  Plus,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Upload,
  Paperclip,
  Trash2,
  Eye,
  Calendar,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ReceiptViewerModal from '../../components/expenses/ReceiptViewerModal';

export default function MyExpenses() {
  const { token, user } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const [activeTab, setActiveTab] = useState<'expenses' | 'advances'>('expenses');

  const [myExpenses, setMyExpenses] = useState<any[]>([]);
  const [myAdvances, setMyAdvances] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [projectsData, setProjectsData] = useState<{ projects: string[]; categories: string[]; clientMap: Record<string, string> }>({
    projects: [],
    categories: [],
    clientMap: {}
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Advance Modal State
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advProject, setAdvProject] = useState('');
  const [advClient, setAdvClient] = useState('');
  const [advPurpose, setAdvPurpose] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advDate, setAdvDate] = useState('');
  const [advRemarks, setAdvRemarks] = useState('');
  const [advSubmitting, setAdvSubmitting] = useState(false);

  // Expense Claim Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expProject, setExpProject] = useState('');
  const [expClient, setExpClient] = useState('');
  const [expCategory, setExpCategory] = useState('Travel');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expMethod, setExpMethod] = useState('UPI');
  const [expAdvanceId, setExpAdvanceId] = useState('');
  const [expRemarks, setExpRemarks] = useState('');
  const [expFiles, setExpFiles] = useState<File[]>([]);
  const [expSubmitting, setExpSubmitting] = useState(false);

  // Receipt Viewer
  const [receiptViewerUrl, setReceiptViewerUrl] = useState<string | null>(null);
  const [receiptViewerMeta, setReceiptViewerMeta] = useState<any>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [expRes, advRes, metRes, projRes] = await Promise.all([
        axios.get(`${API_URL}/api/expenses/claims`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/expenses/advances`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/expenses/metrics`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/expenses/projects`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (expRes.data.success) setMyExpenses(expRes.data.data);
      if (advRes.data.success) setMyAdvances(advRes.data.data);
      if (metRes.data.success) setMetrics(metRes.data.data);
      if (projRes.data.success) setProjectsData(projRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load your expenses and advances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  // Handle Create Advance
  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advProject.trim() || !advPurpose.trim() || !advAmount || !advDate) {
      alert('Please fill in all required fields.');
      return;
    }

    setAdvSubmitting(true);
    try {
      await axios.post(
        `${API_URL}/api/expenses/advances`,
        {
          projectName: advProject.trim(),
          clientName: advClient.trim() || undefined,
          purpose: advPurpose.trim(),
          amountRequested: parseFloat(advAmount),
          requiredDate: advDate,
          employeeRemarks: advRemarks.trim() || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowAdvanceModal(false);
      setAdvProject('');
      setAdvClient('');
      setAdvPurpose('');
      setAdvAmount('');
      setAdvDate('');
      setAdvRemarks('');
      setSuccessMsg('Project advance request submitted successfully!');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to submit advance request');
    } finally {
      setAdvSubmitting(false);
    }
  };

  // Handle Create Expense Claim
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expProject.trim() || !expCategory || !expDate || !expAmount || !expDesc.trim()) {
      alert('Please fill in all required fields.');
      return;
    }

    setExpSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('projectName', expProject.trim());
      if (expClient.trim()) formData.append('clientName', expClient.trim());
      formData.append('expenseCategory', expCategory);
      formData.append('expenseDate', expDate);
      formData.append('amount', expAmount);
      formData.append('description', expDesc.trim());
      formData.append('paymentMethod', expMethod);
      if (expRemarks.trim()) formData.append('employeeRemarks', expRemarks.trim());
      if (expAdvanceId) formData.append('advanceId', expAdvanceId);

      for (let i = 0; i < expFiles.length; i++) {
        formData.append('receipts', expFiles[i]);
      }

      await axios.post(`${API_URL}/api/expenses/claims`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setShowExpenseModal(false);
      setExpProject('');
      setExpClient('');
      setExpCategory('Travel');
      setExpAmount('');
      setExpDesc('');
      setExpRemarks('');
      setExpAdvanceId('');
      setExpFiles([]);
      setSuccessMsg('Expense claim submitted successfully with receipts!');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to submit expense claim');
    } finally {
      setExpSubmitting(false);
    }
  };

  // Cancel Advance
  const handleCancelAdvance = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this pending advance request?')) return;
    try {
      await axios.delete(`${API_URL}/api/expenses/advances/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccessMsg('Advance request cancelled.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to cancel advance');
    }
  };

  // Cancel Expense
  const handleCancelExpense = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this pending expense claim?')) return;
    try {
      await axios.delete(`${API_URL}/api/expenses/claims/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccessMsg('Expense claim cancelled.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to cancel expense');
    }
  };

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
              My Project Expenses & Advances
            </h2>
            <Badge bg="primary" className="px-2 py-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
              SELF SERVICE
            </Badge>
          </div>
          <p className="text-muted mb-0 mt-1" style={{ fontSize: '13.5px' }}>
            Request project advances before site mobilization and submit expense claims with digital receipts for approval.
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

          <Button
            variant="outline-primary"
            className="d-flex align-items-center gap-1.5 px-3 py-2 shadow-sm"
            onClick={() => setShowAdvanceModal(true)}
            style={{ fontSize: '13px', fontWeight: 600 }}
          >
            <CreditCard size={15} />
            <span>Request Advance</span>
          </Button>

          <Button
            variant="primary"
            className="d-flex align-items-center gap-1.5 px-3.5 py-2 shadow-sm"
            onClick={() => setShowExpenseModal(true)}
            style={{ fontSize: '13px', fontWeight: 600, backgroundColor: '#2563EB', borderColor: '#2563EB' }}
          >
            <Plus size={16} />
            <span>Submit Expense Claim</span>
          </Button>
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

      {/* Personal KPI Cards */}
      {metrics && (
        <Row className="g-3 mb-4">
          <Col xs={12} sm={6} md={3}>
            <Card className="border-0 shadow-sm rounded-3">
              <Card.Body className="p-3">
                <span className="text-muted d-block" style={{ fontSize: '12px', fontWeight: 500 }}>
                  Advances Received
                </span>
                <h4 className="fw-bold mb-0 text-dark">
                  ₹{metrics.advances.paidAmount.toLocaleString('en-IN')}
                </h4>
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  {metrics.advances.paidCount} advance(s) disbursed
                </span>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} sm={6} md={3}>
            <Card className="border-0 shadow-sm rounded-3">
              <Card.Body className="p-3">
                <span className="text-muted d-block" style={{ fontSize: '12px', fontWeight: 500 }}>
                  Expenses Reimbursed
                </span>
                <h4 className="fw-bold mb-0 text-success">
                  ₹{metrics.expenses.reimbursedAmount.toLocaleString('en-IN')}
                </h4>
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  {metrics.expenses.reimbursedCount} claim(s) settled
                </span>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} sm={6} md={3}>
            <Card className="border-0 shadow-sm rounded-3">
              <Card.Body className="p-3">
                <span className="text-muted d-block" style={{ fontSize: '12px', fontWeight: 500 }}>
                  Pending Advance Requests
                </span>
                <h4 className="fw-bold mb-0 text-warning">
                  ₹{metrics.advances.pendingAmount.toLocaleString('en-IN')}
                </h4>
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  {metrics.advances.pendingCount} request(s) awaiting review
                </span>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} sm={6} md={3}>
            <Card className="border-0 shadow-sm rounded-3">
              <Card.Body className="p-3">
                <span className="text-muted d-block" style={{ fontSize: '12px', fontWeight: 500 }}>
                  Pending Expense Claims
                </span>
                <h4 className="fw-bold mb-0 text-primary">
                  ₹{metrics.expenses.pendingAmount.toLocaleString('en-IN')}
                </h4>
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  {metrics.expenses.pendingCount} claim(s) awaiting approval
                </span>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Tabs */}
      <Card className="border-0 shadow-sm rounded-3 overflow-hidden">
        <Card.Header className="bg-white border-bottom p-0 px-3">
          <Nav variant="tabs" className="border-bottom-0">
            <Nav.Item>
              <Nav.Link
                active={activeTab === 'expenses'}
                onClick={() => setActiveTab('expenses')}
                className="py-3 px-4 d-flex align-items-center gap-2 fw-semibold"
                style={{ fontSize: '13.5px', cursor: 'pointer' }}
              >
                <Receipt size={16} />
                <span>My Expense Claims ({myExpenses.length})</span>
              </Nav.Link>
            </Nav.Item>

            <Nav.Item>
              <Nav.Link
                active={activeTab === 'advances'}
                onClick={() => setActiveTab('advances')}
                className="py-3 px-4 d-flex align-items-center gap-2 fw-semibold"
                style={{ fontSize: '13.5px', cursor: 'pointer' }}
              >
                <CreditCard size={16} />
                <span>My Advance Requests ({myAdvances.length})</span>
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Card.Header>

        {/* Tab 1: My Expenses Table */}
        {activeTab === 'expenses' && (
          <Card.Body className="p-0">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="text-muted mt-2 mb-0" style={{ fontSize: '13px' }}>Loading your expense claims...</p>
              </div>
            ) : myExpenses.length === 0 ? (
              <div className="text-center py-5">
                <Receipt size={40} className="text-muted opacity-40 mb-2" />
                <h5 className="fw-semibold text-dark">No Expense Claims Yet</h5>
                <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
                  Have you incurred expenses during a site visit or project?
                </p>
                <Button variant="primary" size="sm" onClick={() => setShowExpenseModal(true)}>
                  Submit Your First Claim
                </Button>
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle mb-0" style={{ fontSize: '13px' }}>
                  <thead className="table-light text-muted fw-semibold">
                    <tr>
                      <th>Project / Client</th>
                      <th>Category</th>
                      <th>Expense Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Receipt</th>
                      <th>Admin Remarks</th>
                      <th style={{ textAlign: 'end', paddingRight: '20px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myExpenses.map((exp) => (
                      <tr key={exp.id}>
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
                        <td><span className="text-muted" style={{ fontSize: '12px' }}>{exp.payment_method || 'Cash'}</span></td>
                        <td>{getStatusBadge(exp.status)}</td>
                        <td>
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
                                  category: exp.expense_category
                                });
                              }}
                            >
                              <Paperclip size={12} />
                              <span>View Bill</span>
                            </Button>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '11px' }}>No Receipt</span>
                          )}
                        </td>
                        <td>
                          {exp.admin_remarks ? (
                            <span className="text-muted" style={{ fontSize: '11.5px' }}>{exp.admin_remarks}</span>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'end', paddingRight: '20px' }}>
                          {exp.status === 'PENDING' && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="d-inline-flex align-items-center gap-1 px-2 py-1"
                              style={{ fontSize: '11.5px' }}
                              onClick={() => handleCancelExpense(exp.id)}
                            >
                              <Trash2 size={12} />
                              <span>Cancel</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        )}

        {/* Tab 2: My Advances Table */}
        {activeTab === 'advances' && (
          <Card.Body className="p-0">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="text-muted mt-2 mb-0" style={{ fontSize: '13px' }}>Loading your advance requests...</p>
              </div>
            ) : myAdvances.length === 0 ? (
              <div className="text-center py-5">
                <CreditCard size={40} className="text-muted opacity-40 mb-2" />
                <h5 className="fw-semibold text-dark">No Advance Requests Yet</h5>
                <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
                  Planning field work or travel? Request advance funds before departure.
                </p>
                <Button variant="primary" size="sm" onClick={() => setShowAdvanceModal(true)}>
                  Request Project Advance
                </Button>
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle mb-0" style={{ fontSize: '13px' }}>
                  <thead className="table-light text-muted fw-semibold">
                    <tr>
                      <th>Project / Client</th>
                      <th>Purpose</th>
                      <th>Required Date</th>
                      <th>Amount Requested</th>
                      <th>Status</th>
                      <th>Payment Reference</th>
                      <th>Admin Remarks</th>
                      <th style={{ textAlign: 'end', paddingRight: '20px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAdvances.map((adv) => (
                      <tr key={adv.id}>
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
                        <td>
                          {adv.admin_remarks ? (
                            <span className="text-muted" style={{ fontSize: '11.5px' }}>{adv.admin_remarks}</span>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'end', paddingRight: '20px' }}>
                          {adv.status === 'PENDING' && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="d-inline-flex align-items-center gap-1 px-2 py-1"
                              style={{ fontSize: '11.5px' }}
                              onClick={() => handleCancelAdvance(adv.id)}
                            >
                              <Trash2 size={12} />
                              <span>Cancel</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        )}
      </Card>

      {/* Modal 1: Request Advance Modal */}
      <Modal show={showAdvanceModal} onHide={() => setShowAdvanceModal(false)} centered size="lg">
        <Form onSubmit={handleCreateAdvance}>
          <Modal.Header closeButton>
            <Modal.Title style={{ fontSize: '16px', fontWeight: 700 }}>
              Request Project Advance
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="py-3">
            <Row className="g-3">
              <Col md={8}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Project Name *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. LiDAR Survey Phase 1 or Highway Mapping"
                    value={advProject}
                    onChange={(e) => {
                      setAdvProject(e.target.value);
                      if (projectsData.clientMap[e.target.value]) {
                        setAdvClient(projectsData.clientMap[e.target.value]);
                      }
                    }}
                    required
                    list="project-list"
                    style={{ fontSize: '13.5px' }}
                  />
                  <datalist id="project-list">
                    {projectsData.projects.map((p) => <option key={p} value={p} />)}
                  </datalist>
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Client Name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. NHAI or Government Site"
                    value={advClient}
                    onChange={(e) => setAdvClient(e.target.value)}
                    style={{ fontSize: '13.5px' }}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Amount Requested (₹) *</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 15000"
                    value={advAmount}
                    onChange={(e) => setAdvAmount(e.target.value)}
                    required
                    style={{ fontSize: '13.5px' }}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Required By Date *</Form.Label>
                  <Form.Control
                    type="date"
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                    required
                    style={{ fontSize: '13.5px' }}
                  />
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Purpose / Justification *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    placeholder="Explain the work purpose, team members traveling, and expense breakdown..."
                    value={advPurpose}
                    onChange={(e) => setAdvPurpose(e.target.value)}
                    required
                    style={{ fontSize: '13px' }}
                  />
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Additional Remarks (Optional)</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Any additional notes for finance or admin..."
                    value={advRemarks}
                    onChange={(e) => setAdvRemarks(e.target.value)}
                    style={{ fontSize: '13px' }}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setShowAdvanceModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" disabled={advSubmitting}>
              {advSubmitting ? <Spinner size="sm" animation="border" /> : 'Submit Advance Request'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal 2: Submit Expense Claim Modal */}
      <Modal show={showExpenseModal} onHide={() => setShowExpenseModal(false)} centered size="lg">
        <Form onSubmit={handleCreateExpense}>
          <Modal.Header closeButton>
            <Modal.Title style={{ fontSize: '16px', fontWeight: 700 }}>
              Submit Project Expense Claim
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="py-3">
            <Row className="g-3">
              <Col md={8}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Project Name *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. LiDAR Survey Phase 1"
                    value={expProject}
                    onChange={(e) => {
                      setExpProject(e.target.value);
                      if (projectsData.clientMap[e.target.value]) {
                        setExpClient(projectsData.clientMap[e.target.value]);
                      }
                    }}
                    required
                    list="project-list-exp"
                    style={{ fontSize: '13.5px' }}
                  />
                  <datalist id="project-list-exp">
                    {projectsData.projects.map((p) => <option key={p} value={p} />)}
                  </datalist>
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Client Name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. NHAI Authority"
                    value={expClient}
                    onChange={(e) => setExpClient(e.target.value)}
                    style={{ fontSize: '13.5px' }}
                  />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Expense Category *</Form.Label>
                  <Form.Select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    style={{ fontSize: '13.5px' }}
                  >
                    {projectsData.categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Expense Date *</Form.Label>
                  <Form.Control
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    required
                    style={{ fontSize: '13.5px' }}
                  />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Amount Incurred (₹) *</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 2450.00"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    required
                    style={{ fontSize: '13.5px' }}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Payment Method</Form.Label>
                  <Form.Select
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value)}
                    style={{ fontSize: '13.5px' }}
                  >
                    <option value="UPI">UPI / Google Pay / PhonePe</option>
                    <option value="Cash">Cash</option>
                    <option value="Personal Card">Personal Credit/Debit Card</option>
                    <option value="Company Card">Company Card</option>
                    <option value="Net Banking">Net Banking / Transfer</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Offset from Advance (Optional)</Form.Label>
                  <Form.Select
                    value={expAdvanceId}
                    onChange={(e) => setExpAdvanceId(e.target.value)}
                    style={{ fontSize: '13.5px' }}
                  >
                    <option value="">None (Independent Expense)</option>
                    {myAdvances
                      .filter((a) => a.status === 'PAID' || a.status === 'APPROVED')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          Advance #{a.id} - {a.project_name} (₹{parseFloat(a.amount_requested).toLocaleString('en-IN')})
                        </option>
                      ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Description *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    placeholder="Itemized description of the expense, vendor name, vehicle number, or location..."
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    required
                    style={{ fontSize: '13px' }}
                  />
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Upload Receipts / Bills (PDF, JPG, PNG)</Form.Label>
                  <Form.Control
                    type="file"
                    multiple
                    accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e: any) => {
                      if (e.target.files) {
                        setExpFiles(Array.from(e.target.files));
                      }
                    }}
                    style={{ fontSize: '13px' }}
                  />
                  <Form.Text className="text-muted" style={{ fontSize: '11.5px' }}>
                    Upload fuel receipts, toll tickets, hotel bills, or vendor invoices (up to 5 files, 10MB each).
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label className="fw-semibold" style={{ fontSize: '13px' }}>Additional Remarks (Optional)</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Any special remarks or payment instructions..."
                    value={expRemarks}
                    onChange={(e) => setExpRemarks(e.target.value)}
                    style={{ fontSize: '13px' }}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setShowExpenseModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" disabled={expSubmitting}>
              {expSubmitting ? <Spinner size="sm" animation="border" /> : 'Submit Expense Claim'}
            </Button>
          </Modal.Footer>
        </Form>
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
