import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Badge,
  Form,
  Modal,
  Spinner,
  Alert,
  Table,
  InputGroup
} from 'react-bootstrap';
import {
  Clock,
  Plus,
  Users,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Moon,
  Sun,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  Coffee,
  Timer,
  CalendarCheck,
  FileText
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface Shift {
  id: number;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  minimumWorkHours: number;
  lateAfter: string;
  halfDayMinutes: number;
  overtimeEnabled: boolean;
  description?: string;
  status: 'active' | 'inactive';
  isNightShift: boolean;
  assignedCount: number;
  createdAt?: string;
}

interface AssignedEmployee {
  id: number;
  name: string;
  employeeId: string;
  email: string;
  department: string;
  designation: string;
  status: string;
}

export default function AdminShifts() {
  const { token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal States
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Shift Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    startTime: '09:30',
    endTime: '18:30',
    graceMinutes: 15,
    breakMinutes: 60,
    minimumWorkHours: 8.0,
    halfDayMinutes: 240,
    overtimeEnabled: true,
    description: '',
    status: 'active' as 'active' | 'inactive'
  });

  // View Assigned Employees Modal
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);
  const [selectedShiftForEmployees, setSelectedShiftForEmployees] = useState<Shift | null>(null);
  const [assignedEmployees, setAssignedEmployees] = useState<AssignedEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  // Bulk Assign Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [bulkTargetShiftId, setBulkTargetShiftId] = useState<number | null>(null);
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkDeptFilter, setBulkDeptFilter] = useState('All');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_URL}/api/admin/shifts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setShifts(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchShifts();
  }, [token]);

  // Format HH:mm or HH:mm:ss to 12-hour AM/PM format
  const formatTime12 = (timeStr?: string) => {
    if (!timeStr) return '--:--';
    const parts = timeStr.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingShift(null);
    setFormData({
      name: '',
      code: '',
      startTime: '09:30',
      endTime: '18:30',
      graceMinutes: 15,
      breakMinutes: 60,
      minimumWorkHours: 8.0,
      halfDayMinutes: 240,
      overtimeEnabled: true,
      description: '',
      status: 'active'
    });
    setModalError(null);
    setShowShiftModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      code: shift.code,
      startTime: shift.startTime.substring(0, 5),
      endTime: shift.endTime.substring(0, 5),
      graceMinutes: shift.graceMinutes,
      breakMinutes: shift.breakMinutes,
      minimumWorkHours: shift.minimumWorkHours,
      halfDayMinutes: shift.halfDayMinutes,
      overtimeEnabled: shift.overtimeEnabled,
      description: shift.description || '',
      status: shift.status
    });
    setModalError(null);
    setShowShiftModal(true);
  };

  // Submit Shift Modal (Create / Update)
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);

    try {
      if (editingShift) {
        const res = await axios.put(
          `${API_URL}/api/admin/shifts/${editingShift.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setActionSuccess(res.data.message || 'Shift updated successfully');
      } else {
        const res = await axios.post(
          `${API_URL}/api/admin/shifts`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setActionSuccess(res.data.message || 'Shift created successfully');
      }
      setShowShiftModal(false);
      fetchShifts();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Failed to save shift');
    } finally {
      setModalLoading(false);
    }
  };

  // Delete Shift
  const handleDeleteShift = async (shift: Shift) => {
    if (shift.assignedCount > 0) {
      alert(`Cannot delete "${shift.name}" because ${shift.assignedCount} employee(s) are currently assigned to it. Please reassign them first.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete shift "${shift.name}" (${shift.code})?`)) {
      return;
    }

    try {
      const res = await axios.delete(`${API_URL}/api/admin/shifts/${shift.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionSuccess(res.data.message || 'Shift deleted successfully');
      fetchShifts();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to delete shift');
      setTimeout(() => setError(null), 5000);
    }
  };

  // Toggle Shift Status
  const handleToggleStatus = async (shift: Shift) => {
    const newStatus = shift.status === 'active' ? 'inactive' : 'active';
    try {
      await axios.put(
        `${API_URL}/api/admin/shifts/${shift.id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionSuccess(`Shift "${shift.name}" is now ${newStatus}`);
      fetchShifts();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update shift status');
      setTimeout(() => setError(null), 4000);
    }
  };

  // View Assigned Employees
  const handleViewEmployees = async (shift: Shift) => {
    setSelectedShiftForEmployees(shift);
    setShowEmployeesModal(true);
    setEmployeesLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/shifts/${shift.id}/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setAssignedEmployees(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch assigned employees:', err);
    } finally {
      setEmployeesLoading(false);
    }
  };

  // Open Bulk Assign Modal
  const handleOpenBulkAssign = async () => {
    setBulkError(null);
    setSelectedEmpIds([]);
    setBulkNotes('');
    setBulkTargetShiftId(shifts[0]?.id || null);
    setShowBulkModal(true);

    try {
      const res = await axios.get(`${API_URL}/api/admin/employees?limit=200`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setAllEmployees(res.data.data.items);
      }
    } catch (err) {
      console.error('Failed to fetch employee list for bulk assign:', err);
    }
  };

  // Submit Bulk Assign
  const handleSaveBulkAssign = async () => {
    if (!bulkTargetShiftId) {
      setBulkError('Please select a target shift.');
      return;
    }
    if (selectedEmpIds.length === 0) {
      setBulkError('Please select at least one employee.');
      return;
    }

    setBulkLoading(true);
    setBulkError(null);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/shifts/bulk-assign`,
        {
          shiftId: bulkTargetShiftId,
          employeeIds: selectedEmpIds,
          notes: bulkNotes || 'Bulk shift assignment'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionSuccess(res.data.message || `Successfully assigned ${selectedEmpIds.length} employee(s) to shift`);
      setShowBulkModal(false);
      fetchShifts();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setBulkError(err.response?.data?.error?.message || 'Failed to bulk assign shifts');
    } finally {
      setBulkLoading(false);
    }
  };

  // Filter Shifts
  const filteredShifts = shifts.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Overnight detection for modal preview
  const isFormNightShift =
    formData.startTime &&
    formData.endTime &&
    formData.endTime <= formData.startTime;

  // Metrics
  const totalShiftsCount = shifts.length;
  const activeShiftsCount = shifts.filter((s) => s.status === 'active').length;
  const nightShiftsCount = shifts.filter((s) => s.isNightShift).length;
  const dayShiftsCount = shifts.filter((s) => !s.isNightShift).length;
  const totalAssignedCount = shifts.reduce((acc, s) => acc + (s.assignedCount || 0), 0);

  // Departments list for bulk assign filter
  const departments = Array.from(new Set(allEmployees.map((e) => e.department).filter(Boolean)));

  const filteredBulkEmployees = allEmployees.filter((emp) => {
    const matchesSearch =
      (emp.name || '').toLowerCase().includes(bulkSearch.toLowerCase()) ||
      (emp.employeeId || '').toLowerCase().includes(bulkSearch.toLowerCase()) ||
      (emp.email || '').toLowerCase().includes(bulkSearch.toLowerCase());
    const matchesDept =
      bulkDeptFilter === 'All' || emp.department === bulkDeptFilter;
    return matchesSearch && matchesDept;
  });

  const handleSelectAllBulk = () => {
    if (selectedEmpIds.length === filteredBulkEmployees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(filteredBulkEmployees.map((e) => e.id));
    }
  };

  const handleToggleSelectEmp = (id: number) => {
    if (selectedEmpIds.includes(id)) {
      setSelectedEmpIds(selectedEmpIds.filter((item) => item !== id));
    } else {
      setSelectedEmpIds([...selectedEmpIds, id]);
    }
  };

  return (
    <div className="container-fluid py-3 px-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h2 className="fw-bold mb-0 text-dark" style={{ fontSize: '1.65rem' }}>
              Shift Management
            </h2>
            <Badge bg="primary" className="px-2 py-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
              ENTERPRISE
            </Badge>
          </div>
          <p className="text-muted mb-0 mt-1" style={{ fontSize: '13.5px' }}>
            Configure multi-shift schedules, grace periods, overnight rotations, break deductions, and assign shifts.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Button
            variant="outline-secondary"
            className="d-flex align-items-center gap-1.5 px-3 py-2 shadow-sm"
            onClick={fetchShifts}
            disabled={loading}
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </Button>

          <Button
            variant="outline-primary"
            className="d-flex align-items-center gap-1.5 px-3 py-2 shadow-sm"
            onClick={handleOpenBulkAssign}
            disabled={shifts.length === 0}
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            <Users size={16} />
            Bulk Assign
          </Button>

          <Button
            variant="primary"
            className="d-flex align-items-center gap-1.5 px-3.5 py-2 shadow-sm"
            onClick={handleOpenCreate}
            style={{ fontSize: '13px', fontWeight: 600, backgroundColor: '#2563EB', borderColor: '#2563EB' }}
          >
            <Plus size={16} />
            Create Shift
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <Alert variant="success" className="d-flex align-items-center gap-2 py-2.5 px-3 mb-4 shadow-sm" dismissible onClose={() => setActionSuccess(null)}>
          <CheckCircle size={18} className="text-success flex-shrink-0" />
          <span style={{ fontSize: '13.5px' }}>{actionSuccess}</span>
        </Alert>
      )}

      {error && (
        <Alert variant="danger" className="d-flex align-items-center gap-2 py-2.5 px-3 mb-4 shadow-sm" dismissible onClose={() => setError(null)}>
          <ShieldAlert size={18} className="text-danger flex-shrink-0" />
          <span style={{ fontSize: '13.5px' }}>{error}</span>
        </Alert>
      )}

      {/* Metrics Row */}
      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} lg={3}>
          <Card className="border-0 shadow-sm rounded-3 h-100" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted text-uppercase fw-semibold" style={{ fontSize: '11.5px', letterSpacing: '0.5px' }}>
                  Total Shifts
                </span>
                <h3 className="fw-bold mb-0 mt-1 text-dark" style={{ fontSize: '1.75rem' }}>
                  {totalShiftsCount}
                </h3>
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  {activeShiftsCount} active shifts
                </span>
              </div>
              <div
                className="rounded-3 p-3 d-flex align-items-center justify-content-center"
                style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
              >
                <Clock size={24} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <Card className="border-0 shadow-sm rounded-3 h-100" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted text-uppercase fw-semibold" style={{ fontSize: '11.5px', letterSpacing: '0.5px' }}>
                  Day Shifts
                </span>
                <h3 className="fw-bold mb-0 mt-1 text-dark" style={{ fontSize: '1.75rem' }}>
                  {dayShiftsCount}
                </h3>
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  Standard daytime schedules
                </span>
              </div>
              <div
                className="rounded-3 p-3 d-flex align-items-center justify-content-center"
                style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}
              >
                <Sun size={24} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <Card className="border-0 shadow-sm rounded-3 h-100" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted text-uppercase fw-semibold" style={{ fontSize: '11.5px', letterSpacing: '0.5px' }}>
                  Night / Overnight
                </span>
                <h3 className="fw-bold mb-0 mt-1 text-dark" style={{ fontSize: '1.75rem' }}>
                  {nightShiftsCount}
                </h3>
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  Crosses midnight
                </span>
              </div>
              <div
                className="rounded-3 p-3 d-flex align-items-center justify-content-center"
                style={{ backgroundColor: '#EDE9FE', color: '#7C3AED' }}
              >
                <Moon size={24} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} lg={3}>
          <Card className="border-0 shadow-sm rounded-3 h-100" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Card.Body className="p-3 d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted text-uppercase fw-semibold" style={{ fontSize: '11.5px', letterSpacing: '0.5px' }}>
                  Assigned Employees
                </span>
                <h3 className="fw-bold mb-0 mt-1 text-dark" style={{ fontSize: '1.75rem' }}>
                  {totalAssignedCount}
                </h3>
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  Across all active shifts
                </span>
              </div>
              <div
                className="rounded-3 p-3 d-flex align-items-center justify-content-center"
                style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}
              >
                <UserCheck size={24} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filter & Search Bar */}
      <Card className="border-0 shadow-sm rounded-3 mb-4" style={{ border: '1px solid #E2E8F0' }}>
        <Card.Body className="p-3">
          <Row className="g-3 align-items-center">
            <Col xs={12} md={7} lg={8}>
              <InputGroup>
                <InputGroup.Text className="bg-white border-end-0 text-muted">
                  <Search size={16} />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search shifts by name or code (e.g. Day Shift, DS, NS)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-start-0 ps-0"
                  style={{ fontSize: '13.5px' }}
                />
              </InputGroup>
            </Col>

            <Col xs={12} md={5} lg={4}>
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted text-nowrap" style={{ fontSize: '13px' }}>
                  Status:
                </span>
                <Form.Select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </Form.Select>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Shifts Grid */}
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="text-muted mt-2 mb-0" style={{ fontSize: '13.5px' }}>
            Loading shifts and assignments...
          </p>
        </div>
      ) : filteredShifts.length === 0 ? (
        <Card className="border-0 shadow-sm rounded-3 text-center py-5">
          <Card.Body>
            <Clock size={48} className="text-muted mb-3 opacity-50" />
            <h5 className="fw-bold text-dark">No Shifts Found</h5>
            <p className="text-muted mb-3" style={{ fontSize: '13.5px' }}>
              {searchTerm || statusFilter !== 'all'
                ? 'No shifts match your current filters. Try changing or clearing your search.'
                : 'Get started by creating your first company work shift.'}
            </p>
            {searchTerm || statusFilter !== 'all' ? (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
              >
                Clear Filters
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={handleOpenCreate}>
                + Create New Shift
              </Button>
            )}
          </Card.Body>
        </Card>
      ) : (
        <Row className="g-3">
          {filteredShifts.map((shift) => (
            <Col xs={12} lg={6} xl={4} key={shift.id}>
              <Card
                className="border-0 shadow-sm rounded-3 h-100"
                style={{
                  border: '1px solid #E2E8F0',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <Card.Header
                  className="bg-white border-bottom-0 pt-3.5 px-3.5 pb-2 d-flex justify-content-between align-items-start"
                >
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <Badge
                        style={{
                          backgroundColor: shift.isNightShift ? '#7C3AED' : '#2563EB',
                          fontSize: '11px',
                          fontWeight: 700,
                          letterSpacing: '0.5px'
                        }}
                      >
                        {shift.code}
                      </Badge>
                      <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '15.5px' }}>
                        {shift.name}
                      </h5>
                    </div>
                    {shift.isNightShift ? (
                      <Badge bg="dark" className="d-inline-flex align-items-center gap-1 px-2 py-0.5" style={{ fontSize: '10.5px' }}>
                        <Moon size={11} /> Overnight Shift
                      </Badge>
                    ) : (
                      <Badge bg="light" text="dark" className="border d-inline-flex align-items-center gap-1 px-2 py-0.5" style={{ fontSize: '10.5px' }}>
                        <Sun size={11} className="text-warning" /> Standard Day
                      </Badge>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-1">
                    <Badge
                      bg={shift.status === 'active' ? 'success' : 'secondary'}
                      className="px-2 py-1"
                      style={{ fontSize: '11px' }}
                    >
                      {shift.status.toUpperCase()}
                    </Badge>
                  </div>
                </Card.Header>

                <Card.Body className="px-3.5 py-2">
                  {shift.description && (
                    <p className="text-muted mb-3" style={{ fontSize: '12.5px', lineHeight: 1.4 }}>
                      {shift.description}
                    </p>
                  )}

                  {/* Timings Highlight Box */}
                  <div
                    className="p-2.5 rounded-3 mb-3 d-flex align-items-center justify-content-between"
                    style={{
                      background: shift.isNightShift ? '#F5F3FF' : '#F0F9FF',
                      border: `1px solid ${shift.isNightShift ? '#DDD6FE' : '#BAE6FD'}`
                    }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <Clock size={18} style={{ color: shift.isNightShift ? '#7C3AED' : '#0284C7' }} />
                      <div>
                        <div className="fw-bold" style={{ fontSize: '13.5px', color: '#0F172A' }}>
                          {formatTime12(shift.startTime)} – {formatTime12(shift.endTime)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {shift.isNightShift ? 'Crosses midnight into next morning' : 'Daily working hours'}
                        </div>
                      </div>
                    </div>
                    <Badge bg="white" text="dark" className="border shadow-none py-1 px-2" style={{ fontSize: '11px', fontWeight: 600 }}>
                      Min {shift.minimumWorkHours} hrs
                    </Badge>
                  </div>

                  {/* Shift Specifications Grid */}
                  <div className="p-2.5 rounded-2 bg-light mb-3" style={{ border: '1px solid #E2E8F0', fontSize: '12px' }}>
                    <div className="row g-2">
                      <div className="col-6">
                        <span className="text-muted d-block">Grace Period:</span>
                        <span className="fw-semibold text-dark">
                          {shift.graceMinutes} mins (Cutoff: {formatTime12(shift.lateAfter)})
                        </span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block">Break Deduction:</span>
                        <span className="fw-semibold text-dark">{shift.breakMinutes} mins auto-deduct</span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block">Half Day Rule:</span>
                        <span className="fw-semibold text-dark">{shift.halfDayMinutes / 60} hrs ({shift.halfDayMinutes}m)</span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block">Overtime Status:</span>
                        <span className={`fw-semibold ${shift.overtimeEnabled ? 'text-success' : 'text-secondary'}`}>
                          {shift.overtimeEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Employees Button / Counter */}
                  <div className="d-flex align-items-center justify-content-between p-2 rounded-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="d-flex align-items-center gap-2">
                      <Users size={16} className="text-primary" />
                      <span className="fw-semibold" style={{ fontSize: '12.5px', color: '#1E293B' }}>
                        {shift.assignedCount} {shift.assignedCount === 1 ? 'Employee' : 'Employees'} Assigned
                      </span>
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 text-decoration-none fw-semibold"
                      style={{ fontSize: '12px', color: '#2563EB' }}
                      onClick={() => handleViewEmployees(shift)}
                    >
                      View List &rarr;
                    </Button>
                  </div>
                </Card.Body>

                <Card.Footer className="bg-white border-top px-3.5 py-2.5 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-1">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="d-flex align-items-center gap-1 px-2.5 py-1"
                      style={{ fontSize: '12px' }}
                      onClick={() => handleOpenEdit(shift)}
                    >
                      <Edit2 size={13} /> Edit
                    </Button>

                    <Button
                      variant={shift.status === 'active' ? 'outline-warning' : 'outline-success'}
                      size="sm"
                      className="d-flex align-items-center gap-1 px-2.5 py-1"
                      style={{ fontSize: '12px' }}
                      onClick={() => handleToggleStatus(shift)}
                    >
                      {shift.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>

                  <Button
                    variant="outline-danger"
                    size="sm"
                    className="p-1 px-2 border-0"
                    title={shift.assignedCount > 0 ? 'Cannot delete shift with assigned employees' : 'Delete Shift'}
                    onClick={() => handleDeleteShift(shift)}
                    disabled={shift.assignedCount > 0}
                  >
                    <Trash2 size={15} />
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* CREATE / EDIT SHIFT MODAL */}
      <Modal show={showShiftModal} onHide={() => setShowShiftModal(false)} size="lg" centered backdrop="static">
        <Modal.Header closeButton className="border-bottom pb-3">
          <Modal.Title className="fw-bold d-flex align-items-center gap-2" style={{ fontSize: '1.25rem' }}>
            <Clock size={20} className="text-primary" />
            {editingShift ? `Edit Shift: ${editingShift.name}` : 'Create New Work Shift'}
          </Modal.Title>
        </Modal.Header>

        <Form onSubmit={handleSaveShift}>
          <Modal.Body className="py-3 px-4">
            {modalError && (
              <Alert variant="danger" className="py-2 px-3 mb-3 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                <ShieldAlert size={16} />
                <span>{modalError}</span>
              </Alert>
            )}

            <Row className="g-3 mb-3">
              <Col md={7}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                    Shift Name <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    required
                    placeholder="e.g. Standard Day Shift, Night Support Shift"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ fontSize: '13.5px' }}
                  />
                </Form.Group>
              </Col>

              <Col md={5}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                    Shift Code <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. DS, NS, MS"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    style={{ fontSize: '13.5px', textTransform: 'uppercase' }}
                  />
                  <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                    Unique 2-5 letter code for badges & reports
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            {/* Timing Inputs */}
            <div className="p-3 rounded-3 mb-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div className="fw-semibold text-dark mb-2 d-flex align-items-center gap-1.5" style={{ fontSize: '13px' }}>
                <Clock size={15} className="text-primary" /> Shift Working Hours
              </div>

              <Row className="g-3 align-items-center">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="text-muted" style={{ fontSize: '12.5px' }}>
                      Start Time (Check-In) <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      style={{ fontSize: '13.5px' }}
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="text-muted" style={{ fontSize: '12.5px' }}>
                      End Time (Check-Out) <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      style={{ fontSize: '13.5px' }}
                    />
                  </Form.Group>
                </Col>
              </Row>

              {/* Real-time Overnight Alert */}
              {isFormNightShift && (
                <div className="mt-3 p-2.5 rounded-2 d-flex align-items-start gap-2" style={{ background: '#EDE9FE', border: '1px solid #DDD6FE' }}>
                  <Moon size={16} className="text-purple flex-shrink-0 mt-0.5" style={{ color: '#7C3AED' }} />
                  <div style={{ fontSize: '12px', color: '#5B21B6' }}>
                    <strong>Overnight Shift Detected:</strong> End time ({formData.endTime}) is earlier than start time ({formData.startTime}). Falcon will automatically group attendance across midnight into a single working session under the shift's starting calendar date.
                  </div>
                </div>
              )}
            </div>

            {/* Grace, Break & Hours Rules */}
            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                    Grace Period (Minutes)
                  </Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={120}
                    value={formData.graceMinutes}
                    onChange={(e) => setFormData({ ...formData, graceMinutes: parseInt(e.target.value, 10) || 0 })}
                    style={{ fontSize: '13.5px' }}
                  />
                  <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                    Check-in beyond {formData.startTime} + {formData.graceMinutes}m is flagged as LATE.
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                    Break Deduction (Minutes)
                  </Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={180}
                    value={formData.breakMinutes}
                    onChange={(e) => setFormData({ ...formData, breakMinutes: parseInt(e.target.value, 10) || 0 })}
                    style={{ fontSize: '13.5px' }}
                  />
                  <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                    Lunch/rest time automatically subtracted from gross working hours.
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                    Minimum Work Hours (For Full Day)
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.5"
                    min={1}
                    max={24}
                    value={formData.minimumWorkHours}
                    onChange={(e) => setFormData({ ...formData, minimumWorkHours: parseFloat(e.target.value) || 8.0 })}
                    style={{ fontSize: '13.5px' }}
                  />
                  <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                    Net hours required to mark employee full day PRESENT.
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                    Half Day Threshold (Minutes)
                  </Form.Label>
                  <Form.Control
                    type="number"
                    min={60}
                    max={600}
                    value={formData.halfDayMinutes}
                    onChange={(e) => setFormData({ ...formData, halfDayMinutes: parseInt(e.target.value, 10) || 240 })}
                    style={{ fontSize: '13.5px' }}
                  />
                  <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                    e.g. 240 minutes = 4.0 hours for half day.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col md={12}>
                <Form.Group>
                  <Form.Label className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                    Description & Purpose
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    placeholder="e.g. Core office schedule for headquarters engineering & operations teams"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    style={{ fontSize: '13px' }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex align-items-center justify-content-between p-2.5 rounded-2 bg-light border">
              <div>
                <Form.Check
                  type="switch"
                  id="overtime-switch"
                  label={<span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>Allow Overtime Calculation</span>}
                  checked={formData.overtimeEnabled}
                  onChange={(e) => setFormData({ ...formData, overtimeEnabled: e.target.checked })}
                />
                <span className="text-muted d-block ps-4" style={{ fontSize: '11.5px' }}>
                  Hours worked beyond minimum work hours ({formData.minimumWorkHours}h) will be logged as overtime.
                </span>
              </div>

              <div className="d-flex align-items-center gap-2">
                <span className="text-muted" style={{ fontSize: '12.5px' }}>Shift Status:</span>
                <Form.Select
                  size="sm"
                  value={formData.status}
                  onChange={(e: any) => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: '110px', fontSize: '12.5px' }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Form.Select>
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer className="border-top py-2.5 px-4 d-flex justify-content-between">
            <Button variant="outline-secondary" size="sm" onClick={() => setShowShiftModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={modalLoading}
              className="px-4"
              style={{ backgroundColor: '#2563EB', borderColor: '#2563EB' }}
            >
              {modalLoading ? <Spinner size="sm" animation="border" /> : editingShift ? 'Update Shift' : 'Create Shift'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* VIEW ASSIGNED EMPLOYEES MODAL */}
      <Modal show={showEmployeesModal} onHide={() => setShowEmployeesModal(false)} size="lg" centered>
        <Modal.Header closeButton className="border-bottom pb-3">
          <Modal.Title className="fw-bold d-flex align-items-center gap-2" style={{ fontSize: '1.2rem' }}>
            <Users size={20} className="text-primary" />
            Employees in {selectedShiftForEmployees?.name} ({selectedShiftForEmployees?.code})
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="p-0">
          {employeesLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="text-muted mt-2 mb-0" style={{ fontSize: '13px' }}>
                Fetching assigned team members...
              </p>
            </div>
          ) : assignedEmployees.length === 0 ? (
            <div className="text-center py-5">
              <Users size={40} className="text-muted mb-2 opacity-50" />
              <p className="text-muted mb-0" style={{ fontSize: '13.5px' }}>
                No employees are currently assigned to this shift.
              </p>
            </div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: '420px' }}>
              <Table hover className="align-middle mb-0" style={{ fontSize: '13px' }}>
                <thead className="table-light sticky-top">
                  <tr>
                    <th className="ps-3">Employee</th>
                    <th>Employee ID</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td className="ps-3">
                        <div className="fw-semibold text-dark">{emp.name}</div>
                        <div className="text-muted" style={{ fontSize: '11.5px' }}>{emp.email}</div>
                      </td>
                      <td>
                        <Badge bg="light" text="dark" className="border font-monospace">
                          {emp.employeeId}
                        </Badge>
                      </td>
                      <td>{emp.department || '—'}</td>
                      <td>{emp.designation || '—'}</td>
                      <td>
                        <Badge bg={emp.status === 'active' ? 'success' : 'secondary'} style={{ fontSize: '10.5px' }}>
                          {emp.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="border-top py-2 px-3 d-flex justify-content-between">
          <span className="text-muted" style={{ fontSize: '12px' }}>
            Total: {assignedEmployees.length} employee(s)
          </span>
          <Button variant="secondary" size="sm" onClick={() => setShowEmployeesModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* BULK ASSIGN SHIFT MODAL */}
      <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="lg" centered backdrop="static">
        <Modal.Header closeButton className="border-bottom pb-3">
          <Modal.Title className="fw-bold d-flex align-items-center gap-2" style={{ fontSize: '1.25rem' }}>
            <Users size={20} className="text-primary" />
            Bulk Shift Assignment
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="py-3 px-4">
          {bulkError && (
            <Alert variant="danger" className="py-2 px-3 mb-3 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
              <ShieldAlert size={16} />
              <span>{bulkError}</span>
            </Alert>
          )}

          {/* Target Shift Selector */}
          <div className="p-3 rounded-3 mb-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Form.Group>
              <Form.Label className="fw-bold text-dark mb-1" style={{ fontSize: '13px' }}>
                Select Target Shift to Assign
              </Form.Label>
              <Form.Select
                value={bulkTargetShiftId || ''}
                onChange={(e) => setBulkTargetShiftId(parseInt(e.target.value, 10))}
                style={{ fontSize: '13.5px' }}
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) — {formatTime12(s.startTime)} to {formatTime12(s.endTime)} {s.isNightShift ? '(Overnight)' : ''}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </div>

          {/* Filter Employees */}
          <Row className="g-2 mb-2 align-items-center">
            <Col md={7}>
              <InputGroup size="sm">
                <InputGroup.Text className="bg-white border-end-0 text-muted">
                  <Search size={14} />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Filter employees by name, ID or email..."
                  value={bulkSearch}
                  onChange={(e) => setBulkSearch(e.target.value)}
                  className="border-start-0 ps-0"
                  style={{ fontSize: '12.5px' }}
                />
              </InputGroup>
            </Col>

            <Col md={5}>
              <Form.Select
                size="sm"
                value={bulkDeptFilter}
                onChange={(e) => setBulkDeptFilter(e.target.value)}
                style={{ fontSize: '12.5px' }}
              >
                <option value="All">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </Form.Select>
            </Col>
          </Row>

          {/* Employee Selection List */}
          <div className="border rounded-2 p-0 mb-3" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <Table hover size="sm" className="mb-0 align-middle" style={{ fontSize: '12.5px' }}>
              <thead className="table-light sticky-top">
                <tr>
                  <th style={{ width: '40px' }} className="text-center">
                    <Form.Check
                      type="checkbox"
                      checked={
                        filteredBulkEmployees.length > 0 &&
                        selectedEmpIds.length === filteredBulkEmployees.length
                      }
                      onChange={handleSelectAllBulk}
                    />
                  </th>
                  <th>Employee</th>
                  <th>ID</th>
                  <th>Current Shift</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {filteredBulkEmployees.map((emp) => {
                  const isSelected = selectedEmpIds.includes(emp.id);
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => handleToggleSelectEmp(emp.id)}
                      style={{ cursor: 'pointer', background: isSelected ? '#EFF6FF' : undefined }}
                    >
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Form.Check
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectEmp(emp.id)}
                        />
                      </td>
                      <td className="fw-semibold text-dark">{emp.name}</td>
                      <td>
                        <span className="font-monospace text-muted">{emp.employeeId}</span>
                      </td>
                      <td>
                        <Badge bg="light" text="dark" className="border">
                          {emp.shiftCode || 'DS'}
                        </Badge>
                      </td>
                      <td>{emp.department || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <div className="d-flex align-items-center justify-content-between mb-3 text-muted" style={{ fontSize: '12px' }}>
            <span>{selectedEmpIds.length} employee(s) selected</span>
            <Button
              variant="link"
              size="sm"
              className="p-0 text-decoration-none"
              onClick={handleSelectAllBulk}
            >
              {selectedEmpIds.length === filteredBulkEmployees.length ? 'Deselect All' : 'Select All Filtered'}
            </Button>
          </div>

          <Form.Group>
            <Form.Label className="fw-semibold text-dark" style={{ fontSize: '12.5px' }}>
              Assignment Reason / Notes
            </Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. Q4 Rotational Shift Change or Promotion"
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              style={{ fontSize: '12.5px' }}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer className="border-top py-2.5 px-4 d-flex justify-content-between">
          <Button variant="outline-secondary" size="sm" onClick={() => setShowBulkModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveBulkAssign}
            disabled={bulkLoading || selectedEmpIds.length === 0}
            className="px-4"
            style={{ backgroundColor: '#2563EB', borderColor: '#2563EB' }}
          >
            {bulkLoading ? (
              <Spinner size="sm" animation="border" />
            ) : (
              `Assign to ${selectedEmpIds.length} Employee(s)`
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
