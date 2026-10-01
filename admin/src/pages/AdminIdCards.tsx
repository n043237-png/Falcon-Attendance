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
  Dropdown
} from 'react-bootstrap';
import {
  Users,
  Search,
  RefreshCw,
  Download,
  Printer,
  ShieldCheck,
  Building2,
  Eye,
  CheckSquare,
  Square,
  FileArchive,
  FileText,
  Filter,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import IdCardModal from '../components/idcard/IdCardModal';
import Avatar from '../components/common/Avatar';

interface EmployeeItem {
  id: number;
  name: string;
  employeeId: string;
  department: string;
  designation: string;
  attendanceMode: string;
  profilePhotoUrl: string | null;
}

export default function AdminIdCards() {
  const { token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');

  // Multi-Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  // Modal Preview
  const [selectedEmpIdForModal, setSelectedEmpIdForModal] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_URL}/api/admin/id-cards/bulk-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setEmployees(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load employee list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchEmployees();
  }, [token]);

  // Unique departments for filter dropdown
  const departments = ['All', ...Array.from(new Set(employees.map((e) => e.department).filter(Boolean)))];

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.employeeId && emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.designation && emp.designation.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDept = deptFilter === 'All' || emp.department === deptFilter;
    const matchesMode = modeFilter === 'All' || emp.attendanceMode === modeFilter;

    return matchesSearch && matchesDept && matchesMode;
  });

  // Select all toggle
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmployees.map((e) => e.id));
    }
  };

  const handleToggleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Open Preview Modal
  const handleOpenPreview = (empId: number) => {
    setSelectedEmpIdForModal(empId);
    setShowModal(true);
  };

  // Single PDF Download
  const handleDownloadSinglePdf = async (empId: number, empCode: string) => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/employees/${empId}/id-card/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Falcon_ID_Card_${empCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download employee ID card PDF');
    }
  };

  // Bulk PDF Download
  const handleBulkDownloadPdf = async () => {
    const targetIds = selectedIds.length > 0 ? selectedIds : filteredEmployees.map((e) => e.id);
    if (targetIds.length === 0) return;

    setBulkDownloading(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/id-cards/bulk-pdf`,
        { userIds: targetIds },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Falcon_Bulk_ID_Cards_${targetIds.length}_Employees.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMsg(`Successfully generated bulk PDF for ${targetIds.length} employee(s).`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert('Failed to generate bulk ID cards PDF');
    } finally {
      setBulkDownloading(false);
    }
  };

  // Bulk ZIP Download
  const handleBulkDownloadZip = async () => {
    const targetIds = selectedIds.length > 0 ? selectedIds : filteredEmployees.map((e) => e.id);
    if (targetIds.length === 0) return;

    setBulkDownloading(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/id-cards/bulk-zip`,
        { userIds: targetIds },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Falcon_Bulk_ID_Cards_Archive_${targetIds.length}_Employees.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMsg(`Successfully generated ZIP archive for ${targetIds.length} employee(s).`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert('Failed to generate bulk ID cards ZIP archive');
    } finally {
      setBulkDownloading(false);
    }
  };

  // Stats calculation
  const totalCount = employees.length;
  const officeCount = employees.filter((e) => e.attendanceMode === 'Office').length;
  const fieldCount = employees.filter((e) => e.attendanceMode === 'Field').length;

  return (
    <div className="container-fluid py-3 px-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h2 className="fw-bold mb-0 text-dark" style={{ fontSize: '1.65rem' }}>
              Employee ID Cards
            </h2>
            <Badge bg="primary" className="px-2 py-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
              ENTERPRISE HRMS
            </Badge>
          </div>
          <p className="text-muted mb-0 mt-1" style={{ fontSize: '13.5px' }}>
            Generate, preview, print, and bulk-download official Falcon Info Solutions digital ID cards with secure verification QR codes.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Button
            variant="outline-secondary"
            className="d-flex align-items-center gap-1.5 px-3 py-2 shadow-sm"
            onClick={fetchEmployees}
            disabled={loading}
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </Button>

          <Dropdown>
            <Dropdown.Toggle
              variant="primary"
              className="d-flex align-items-center gap-1.5 px-3.5 py-2 shadow-sm"
              disabled={bulkDownloading || employees.length === 0}
              style={{ fontSize: '13px', fontWeight: 600, backgroundColor: '#2563EB', borderColor: '#2563EB' }}
            >
              {bulkDownloading ? <Spinner size="sm" animation="border" /> : <Download size={15} />}
              <span>
                {selectedIds.length > 0
                  ? `Bulk Download (${selectedIds.length})`
                  : 'Bulk Download All'}
              </span>
            </Dropdown.Toggle>

            <Dropdown.Menu className="shadow border-0 rounded-3">
              <Dropdown.Item onClick={handleBulkDownloadPdf} className="py-2 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                <FileText size={16} className="text-primary" />
                <span>Download Multi-Page PDF ({selectedIds.length || filteredEmployees.length} Cards)</span>
              </Dropdown.Item>
              <Dropdown.Item onClick={handleBulkDownloadZip} className="py-2 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                <FileArchive size={16} className="text-warning" />
                <span>Download ZIP Archive ({selectedIds.length || filteredEmployees.length} PDFs)</span>
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

      {/* Metrics Row */}
      <Row className="g-3 mb-4">
        <Col xs={12} sm={4}>
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
                <Users size={22} />
              </div>
              <div>
                <span className="text-muted d-block" style={{ fontSize: '12px', fontWeight: 500 }}>
                  Active Employees
                </span>
                <h4 className="fw-bold mb-0 text-dark">{totalCount}</h4>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={4}>
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
                <ShieldCheck size={22} />
              </div>
              <div>
                <span className="text-muted d-block" style={{ fontSize: '12px', fontWeight: 500 }}>
                  Office Mode
                </span>
                <h4 className="fw-bold mb-0 text-dark">{officeCount}</h4>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={4}>
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
                <Building2 size={22} />
              </div>
              <div>
                <span className="text-muted d-block" style={{ fontSize: '12px', fontWeight: 500 }}>
                  Field Mode
                </span>
                <h4 className="fw-bold mb-0 text-dark">{fieldCount}</h4>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filter & Search Bar */}
      <Card className="border-0 shadow-sm rounded-3 mb-4">
        <Card.Body className="p-3">
          <Row className="g-2 align-items-center">
            <Col xs={12} md={5}>
              <InputGroup>
                <InputGroup.Text className="bg-light border-end-0">
                  <Search size={16} className="text-muted" />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search by employee name, ID, or designation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-start-0 bg-light"
                  style={{ fontSize: '13.5px' }}
                />
              </InputGroup>
            </Col>

            <Col xs={6} md={3}>
              <Form.Select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                style={{ fontSize: '13px' }}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d === 'All' ? 'All Departments' : d}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col xs={6} md={2}>
              <Form.Select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                style={{ fontSize: '13px' }}
              >
                <option value="All">All Modes</option>
                <option value="Office">Office</option>
                <option value="Field">Field</option>
              </Form.Select>
            </Col>

            <Col xs={12} md={2} className="text-md-end">
              <Button
                variant="outline-secondary"
                size="sm"
                className="d-inline-flex align-items-center gap-1.5 w-100 justify-content-center py-2"
                onClick={handleToggleSelectAll}
                style={{ fontSize: '12.5px' }}
              >
                {selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0 ? (
                  <>
                    <CheckSquare size={15} className="text-primary" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square size={15} />
                    <span>Select All ({filteredEmployees.length})</span>
                  </>
                )}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Employees ID Cards Table */}
      <Card className="border-0 shadow-sm rounded-3 overflow-hidden">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="text-muted mt-2 mb-0" style={{ fontSize: '13px' }}>
                Loading employee ID card directory...
              </p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-5">
              <Users size={44} className="text-muted opacity-40 mb-2" />
              <h5 className="fw-semibold text-dark">No Employees Found</h5>
              <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                Try modifying your search or filter options.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0" style={{ fontSize: '13px' }}>
                <thead className="table-light text-muted fw-semibold">
                  <tr>
                    <th style={{ width: '44px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                        onChange={handleToggleSelectAll}
                      />
                    </th>
                    <th>Employee</th>
                    <th>Employee ID</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Attendance Mode</th>
                    <th style={{ textAlign: 'center' }}>QR Status</th>
                    <th style={{ textAlign: 'end', paddingRight: '20px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const isSelected = selectedIds.includes(emp.id);
                    return (
                      <tr key={emp.id} className={isSelected ? 'table-primary' : ''}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(emp.id)}
                          />
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2.5">
                            <Avatar
                              src={emp.profilePhotoUrl}
                              name={emp.name}
                              size={36}
                              shape="rounded"
                            />
                            <div>
                              <div className="fw-bold text-dark">{emp.name}</div>
                              <span className="text-muted" style={{ fontSize: '11.5px' }}>
                                Falcon Employee
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border fw-semibold" style={{ fontSize: '12px' }}>
                            {emp.employeeId || `EMP${emp.id}`}
                          </span>
                        </td>
                        <td>{emp.department || 'General'}</td>
                        <td>{emp.designation || 'Staff'}</td>
                        <td>
                          {emp.attendanceMode === 'Field' ? (
                            <Badge bg="warning" className="text-dark px-2 py-1" style={{ fontSize: '11px' }}>
                              Field
                            </Badge>
                          ) : (
                            <Badge bg="success" className="px-2 py-1" style={{ fontSize: '11px', backgroundColor: '#16A34A' }}>
                              Office
                            </Badge>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style={{ fontSize: '11px' }}>
                            ✓ Verified QR
                          </span>
                        </td>
                        <td style={{ textAlign: 'end', paddingRight: '20px' }}>
                          <div className="d-flex align-items-center justify-content-end gap-1.5">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="d-flex align-items-center gap-1 px-2.5 py-1"
                              onClick={() => handleOpenPreview(emp.id)}
                              style={{ fontSize: '12px', fontWeight: 500 }}
                            >
                              <Eye size={13} />
                              <span>View ID Card</span>
                            </Button>

                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="d-flex align-items-center gap-1 px-2 py-1"
                              onClick={() => handleDownloadSinglePdf(emp.id, emp.employeeId || `EMP${emp.id}`)}
                              title="Download PDF"
                              style={{ fontSize: '12px' }}
                            >
                              <Download size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* ID Card Modal */}
      <IdCardModal
        show={showModal}
        onHide={() => setShowModal(false)}
        employeeId={selectedEmpIdForModal}
        token={token || undefined}
        apiBaseUrl={API_URL}
      />
    </div>
  );
}
