import React, { useState, useEffect } from 'react';
import { Row, Col, Form, Alert, Spinner } from 'react-bootstrap';
import {
  Settings,
  Clock,
  Calendar,
  Trash2,
  Plus,
  Save,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  BellRing,
  MapPin,
  Navigation,
  ExternalLink,
  Compass,
  Sparkles,
  CalendarCheck,
  CalendarDays,
  Search,
  PartyPopper,
  LayoutGrid,
  List,
  X,
  Tag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminSettings() {
  const { token } = useAuth();

  const [settings, setSettings] = useState<any>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [officeSettings, setOfficeSettings] = useState<{
    id?: number;
    name: string;
    latitude: number | string;
    longitude: number | string;
    radiusMeters: number | string;
    status?: string;
  }>({
    name: 'Falcon Info Solutions HQ',
    latitude: 28.623160,
    longitude: 77.378843,
    radiusMeters: 25,
    status: 'active'
  });
  const [leaveSettings, setLeaveSettings] = useState<{
    enableHolidayValidation: boolean;
    enableSundayValidation: boolean;
    enableWeeklyOffValidation: boolean;
    showLeaveImpactSummary: boolean;
    weeklyOffDays: number[];
  }>({
    enableHolidayValidation: true,
    enableSundayValidation: true,
    enableWeeklyOffValidation: true,
    showLeaveImpactSummary: true,
    weeklyOffDays: [0]
  });
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [officeSaveLoading, setOfficeSaveLoading] = useState(false);
  const [leaveSaveLoading, setLeaveSaveLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // New holiday form
  const [newHolDate, setNewHolDate] = useState('');
  const [newHolName, setNewHolName] = useState('');
  const [newHolDesc, setNewHolDesc] = useState('');
  const [holidaySearch, setHolidaySearch] = useState('');
  const [holidayTab, setHolidayTab] = useState<'ALL' | 'UPCOMING' | 'PAST'>('ALL');
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [holidayViewMode, setHolidayViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  const getMonthAbbr = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00+05:30');
      return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase();
    } catch {
      return '';
    }
  };

  const getDayNumber = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      return parts[2] || '';
    } catch {
      return '';
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00+05:30');
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return dateStr;
    }
  };

  const getHolidayTheme = (name: string, isPast: boolean, isToday: boolean) => {
    const lower = (name || '').toLowerCase();

    if (isToday) {
      return {
        headerBg: 'linear-gradient(135deg, #10B981, #059669)',
        headerSolid: '#059669',
        border: '#86EFAC',
        cardBg: '#F0FDF4',
        badgeBg: '#DCFCE7',
        badgeColor: '#15803D',
        emoji: '🎉',
        accentColor: '#059669',
      };
    }

    if (isPast) {
      return {
        headerBg: 'linear-gradient(135deg, #94A3B8, #64748B)',
        headerSolid: '#64748B',
        border: '#E2E8F0',
        cardBg: '#FAFAFA',
        badgeBg: '#F1F5F9',
        badgeColor: '#64748B',
        emoji: '🗓️',
        accentColor: '#64748B',
      };
    }

    // National / Saffron-Navy theme
    if (lower.includes('republic') || lower.includes('independence') || lower.includes('gandhi')) {
      return {
        headerBg: 'linear-gradient(135deg, #F59E0B, #D97706)',
        headerSolid: '#D97706',
        border: '#FDE68A',
        cardBg: '#FFFDF5',
        badgeBg: '#FEF3C7',
        badgeColor: '#B45309',
        emoji: '🇮🇳',
        accentColor: '#D97706',
      };
    }

    // Diwali / Dussehra / Janmashtami
    if (lower.includes('diwali') || lower.includes('deepavali') || lower.includes('dussehra') || lower.includes('janmashtami')) {
      return {
        headerBg: 'linear-gradient(135deg, #F97316, #EA580C)',
        headerSolid: '#EA580C',
        border: '#FED7AA',
        cardBg: '#FFF8F2',
        badgeBg: '#FFEDD5',
        badgeColor: '#C2410C',
        emoji: '🪔',
        accentColor: '#EA580C',
      };
    }

    // Holi
    if (lower.includes('holi')) {
      return {
        headerBg: 'linear-gradient(135deg, #EC4899, #A855F7)',
        headerSolid: '#A855F7',
        border: '#F5D0FE',
        cardBg: '#FDF7FF',
        badgeBg: '#FDF4FF',
        badgeColor: '#9333EA',
        emoji: '🎨',
        accentColor: '#9333EA',
      };
    }

    // Eid
    if (lower.includes('eid') || lower.includes('ramadan')) {
      return {
        headerBg: 'linear-gradient(135deg, #10B981, #047857)',
        headerSolid: '#047857',
        border: '#A7F3D0',
        cardBg: '#F5FEF9',
        badgeBg: '#D1FAE5',
        badgeColor: '#047857',
        emoji: '🌙',
        accentColor: '#047857',
      };
    }

    // Christmas
    if (lower.includes('christmas')) {
      return {
        headerBg: 'linear-gradient(135deg, #EF4444, #DC2626)',
        headerSolid: '#DC2626',
        border: '#FECACA',
        cardBg: '#FFF5F5',
        badgeBg: '#FEE2E2',
        badgeColor: '#B91C1C',
        emoji: '🎄',
        accentColor: '#DC2626',
      };
    }

    // New Year
    if (lower.includes('new year')) {
      return {
        headerBg: 'linear-gradient(135deg, #6366F1, #4F46E5)',
        headerSolid: '#4F46E5',
        border: '#C7D2FE',
        cardBg: '#F7F8FF',
        badgeBg: '#E0E7FF',
        badgeColor: '#4338CA',
        emoji: '✨',
        accentColor: '#4F46E5',
      };
    }

    // Raksha Bandhan
    if (lower.includes('raksha') || lower.includes('bandhan')) {
      return {
        headerBg: 'linear-gradient(135deg, #F43F5E, #E11D48)',
        headerSolid: '#E11D48',
        border: '#FECDD3',
        cardBg: '#FFF1F2',
        badgeBg: '#FFE4E6',
        badgeColor: '#BE123C',
        emoji: '🎁',
        accentColor: '#E11D48',
      };
    }

    // Default Upcoming: Sapphire Blue
    return {
      headerBg: 'linear-gradient(135deg, #3B82F6, #2563EB)',
      headerSolid: '#2563EB',
      border: '#BFDBFE',
      cardBg: '#F8FAFC',
      badgeBg: '#EFF6FF',
      badgeColor: '#1D4ED8',
      emoji: '🌟',
      accentColor: '#2563EB',
    };
  };

  const loadData = async () => {
    try {
      const [setRes, holRes, offRes, leaveRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/settings`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/holidays`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/office`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/settings/leave`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const setJson = await setRes.json();
      const holJson = await holRes.json();
      const offJson = await offRes.json();

      if (setJson.success) {
        setSettings({
          officeStart: setJson.data.office_start,
          officeEnd: setJson.data.office_end,
          lateThreshold: setJson.data.late_threshold,
          absenceCutoff: setJson.data.absence_cutoff,
          halfDayMinutes: setJson.data.half_day_minutes,
          fullDayMinutes: setJson.data.full_day_minutes,
          checkoutReminderTime: setJson.data.checkout_reminder_time
        });
      }
      if (holJson.success) setHolidays(holJson.data);
      if (offJson.success && offJson.data) {
        setOfficeSettings({
          id: offJson.data.id,
          name: offJson.data.name,
          latitude: offJson.data.latitude,
          longitude: offJson.data.longitude,
          radiusMeters: offJson.data.radiusMeters,
          status: offJson.data.status
        });
      }
      if (leaveRes.ok) {
        const leaveJson = await leaveRes.json();
        if (leaveJson.success && leaveJson.data) {
          setLeaveSettings(leaveJson.data);
        }
      }
    } catch (e: any) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const handleSaveLeaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveSaveLoading(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/settings/leave`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(leaveSettings)
      });
      const data = await res.json();
      if (data.success) {
        setMsg('Smart Leave Validation rules updated successfully.');
        if (data.data) {
          setLeaveSettings(data.data);
        }
      } else {
        setError(data.error?.message || data.error || 'Failed to update leave settings');
      }
    } catch (e) {
      setError('Network error saving leave settings');
    } finally {
      setLeaveSaveLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setMsg('System settings updated successfully.');
      } else {
        setError(data.error?.message || data.error || 'Update failed');
      }
    } catch (e) {
      setError('Network error saving settings');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    setOfficeSaveLoading(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/office`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: officeSettings.name,
          latitude: Number(officeSettings.latitude),
          longitude: Number(officeSettings.longitude),
          radiusMeters: Number(officeSettings.radiusMeters)
        })
      });
      const data = await res.json();
      if (data.success) {
        setMsg('Office location and 25-metre geo-fence radius updated successfully.');
        if (data.data) {
          setOfficeSettings({
            id: data.data.id,
            name: data.data.name,
            latitude: data.data.latitude,
            longitude: data.data.longitude,
            radiusMeters: data.data.radiusMeters,
            status: data.data.status
          });
        }
      } else {
        setError(data.error?.message || data.error || 'Failed to update office location');
      }
    } catch (e) {
      setError('Network error saving office settings');
    } finally {
      setOfficeSaveLoading(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficeSettings(prev => ({
          ...prev,
          latitude: Math.round(pos.coords.latitude * 1000000) / 1000000,
          longitude: Math.round(pos.coords.longitude * 1000000) / 1000000
        }));
        setLocating(false);
        setMsg(`Current browser coordinates detected (±${Math.round(pos.coords.accuracy)}m accuracy).`);
      },
      (err) => {
        setLocating(false);
        alert('Could not retrieve current location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ holidayDate: newHolDate, name: newHolName, description: newHolDesc })
      });
      const data = await res.json();
      if (data.success) {
        setNewHolDate('');
        setNewHolName('');
        setNewHolDesc('');
        setMsg('Holiday added successfully.');
        loadData();
      } else {
        setError(data.error?.message || data.error || 'Failed to add holiday');
      }
    } catch (e) {
      setError('Network error adding holiday');
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!window.confirm('Delete this official holiday?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/admin/holidays/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMsg('Holiday removed.');
        loadData();
      }
    } catch (e) {
      setError('Network error deleting holiday');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <div className="text-muted mt-2" style={{ fontSize: '14px' }}>Loading system settings...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="page-title">System Settings & Rules</h1>
          <p className="text-muted mb-0">Configure attendance policies, shift timings, and official company holidays</p>
        </div>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4 d-flex align-items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </Alert>
      )}

      {msg && (
        <Alert variant="success" className="mb-4 d-flex align-items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{msg}</span>
        </Alert>
      )}

      {/* Office Location & Geo-Fence Radius Card */}
      <div className="card p-4 border-0 mb-4" style={{ boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)', borderRadius: '20px' }}>
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between pb-3 mb-4 border-bottom gap-2" style={{ borderColor: '#F1F5F9' }}>
          <div className="d-flex align-items-center gap-2.5">
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #DBEAFE',
              }}
            >
              <MapPin size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16.5px', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                Attendance Geo-Fence & Office Coordinates
              </h3>
              <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                Set the physical office GPS coordinates and configured perimeter radius for mobile Check-In/Check-Out
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="badge px-3 py-2" style={{ backgroundColor: '#DCFCE7', color: '#15803D', fontSize: '12px', fontWeight: 600, borderRadius: '8px' }}>
              ✓ {officeSettings.radiusMeters}m Radius Enforced
            </span>
          </div>
        </div>

        <div className="p-3 mb-4 rounded-3 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <div className="d-flex align-items-center gap-2">
            <ShieldCheck size={18} className="text-primary flex-shrink-0" />
            <span style={{ fontSize: '13px', color: '#334155' }}>
              <strong>Strict Geo-Fence:</strong> Employees can only mark Check-In and Check-Out when physically within <strong>{officeSettings.radiusMeters} metres</strong> of this location. Attempts outside this radius are automatically blocked.
            </span>
          </div>
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1.5"
              onClick={handleDetectLocation}
              disabled={locating}
              style={{ borderRadius: '8px', fontSize: '12.5px', fontWeight: 500 }}
            >
              {locating ? <Spinner size="sm" animation="border" /> : <Compass size={14} />}
              <span>{locating ? 'Detecting GPS...' : 'Detect Current Location'}</span>
            </button>
            <a
              href={`https://www.google.com/maps?q=${officeSettings.latitude},${officeSettings.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5"
              style={{ borderRadius: '8px', fontSize: '12.5px', fontWeight: 500 }}
            >
              <ExternalLink size={14} />
              <span>Preview on Maps</span>
            </a>
          </div>
        </div>

        <Form onSubmit={handleSaveOffice}>
          <Row className="g-3 mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-medium text-dark" style={{ fontSize: '13.5px' }}>Office / Headquarters Name</Form.Label>
                <Form.Control
                  type="text"
                  value={officeSettings.name}
                  onChange={(e) => setOfficeSettings({ ...officeSettings, name: e.target.value })}
                  placeholder="e.g. Falcon Info Solutions HQ"
                  style={{ height: '44px', borderRadius: '10px', fontSize: '14px' }}
                  required
                />
                <span className="text-muted mt-1 d-block" style={{ fontSize: '12px' }}>Assigned facility name displayed to employees</span>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-medium text-dark" style={{ fontSize: '13.5px' }}>
                  Geo-Fence Radius (Metres)
                </Form.Label>
                <Form.Control
                  type="number"
                  min={5}
                  max={500}
                  value={officeSettings.radiusMeters}
                  onChange={(e) => setOfficeSettings({ ...officeSettings, radiusMeters: Number(e.target.value) })}
                  style={{ height: '44px', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}
                  required
                />
                <span className="text-muted mt-1 d-block" style={{ fontSize: '12px' }}>
                  Required: <strong>25 metres</strong> (physical presence perimeter)
                </span>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-medium text-dark" style={{ fontSize: '13.5px' }}>Latitude (Decimal Degrees)</Form.Label>
                <Form.Control
                  type="number"
                  step="any"
                  value={officeSettings.latitude}
                  onChange={(e) => setOfficeSettings({ ...officeSettings, latitude: e.target.value })}
                  placeholder="e.g. 28.623160"
                  style={{ height: '44px', borderRadius: '10px', fontSize: '14px' }}
                  required
                />
                <span className="text-muted mt-1 d-block" style={{ fontSize: '12px' }}>GPS Latitude coordinate</span>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-medium text-dark" style={{ fontSize: '13.5px' }}>Longitude (Decimal Degrees)</Form.Label>
                <Form.Control
                  type="number"
                  step="any"
                  value={officeSettings.longitude}
                  onChange={(e) => setOfficeSettings({ ...officeSettings, longitude: e.target.value })}
                  placeholder="e.g. 77.378843"
                  style={{ height: '44px', borderRadius: '10px', fontSize: '14px' }}
                  required
                />
                <span className="text-muted mt-1 d-block" style={{ fontSize: '12px' }}>GPS Longitude coordinate</span>
              </Form.Group>
            </Col>
          </Row>

          <div className="pt-2 d-flex justify-content-end">
            <button
              className="btn btn-primary px-4"
              type="submit"
              disabled={officeSaveLoading}
              style={{ height: '44px', borderRadius: '10px', fontWeight: 600 }}
            >
              {officeSaveLoading ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  <span>Saving Office Coordinates...</span>
                </>
              ) : (
                <>
                  <Save size={16} className="me-2" />
                  <span>Save Office & Geo-Fence Radius</span>
                </>
              )}
            </button>
          </div>
        </Form>
      </div>
 
      {/* Smart Leave Validation & Policy Rules Card */}
      <div className="card p-4 border-0 mb-4" style={{ boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)', borderRadius: '20px' }}>
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between pb-3 mb-4 border-bottom gap-2" style={{ borderColor: '#F1F5F9' }}>
          <div className="d-flex align-items-center gap-2.5">
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#EEF2FF',
                color: '#4F46E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #E0E7FF',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16.5px', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                Smart Leave Validation & Rules Configuration
              </h3>
              <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                Automate real-time date evaluation, weekend and holiday exclusions, and employee quota impact previews
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="badge px-3 py-2" style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', fontSize: '12px', fontWeight: 600, borderRadius: '8px' }}>
              ✓ Engine Active & Enforcing
            </span>
          </div>
        </div>

        <Form onSubmit={handleSaveLeaveSettings}>
          <Row className="g-4 mb-4">
            <Col md={6}>
              <div className="p-3.5 rounded-3 h-100" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="d-flex align-items-start justify-content-between gap-3">
                  <div>
                    <span className="fw-semibold text-dark d-block mb-1" style={{ fontSize: '14px' }}>
                      Enable Company Holiday Validation
                    </span>
                    <span className="text-muted d-block" style={{ fontSize: '12.5px', lineHeight: 1.45 }}>
                      Official company holidays falling inside requested leave ranges are categorized as <strong>Company Holiday (Orange)</strong> and automatically exempted from paid leave deduction.
                    </span>
                  </div>
                  <Form.Check
                    type="switch"
                    id="switch-holiday-validation"
                    checked={leaveSettings.enableHolidayValidation}
                    onChange={(e) => setLeaveSettings({ ...leaveSettings, enableHolidayValidation: e.target.checked })}
                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </Col>

            <Col md={6}>
              <div className="p-3.5 rounded-3 h-100" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="d-flex align-items-start justify-content-between gap-3">
                  <div>
                    <span className="fw-semibold text-dark d-block mb-1" style={{ fontSize: '14px' }}>
                      Enable Sunday Validation
                    </span>
                    <span className="text-muted d-block" style={{ fontSize: '12.5px', lineHeight: 1.45 }}>
                      Sundays falling within requested leave ranges are categorized as <strong>Weekly Off (Green)</strong> and will not consume paid leave balance.
                    </span>
                  </div>
                  <Form.Check
                    type="switch"
                    id="switch-sunday-validation"
                    checked={leaveSettings.enableSundayValidation}
                    onChange={(e) => setLeaveSettings({ ...leaveSettings, enableSundayValidation: e.target.checked })}
                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </Col>

            <Col md={6}>
              <div className="p-3.5 rounded-3 h-100" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="d-flex align-items-start justify-content-between gap-3">
                  <div>
                    <span className="fw-semibold text-dark d-block mb-1" style={{ fontSize: '14px' }}>
                      Enable Weekly Off Validation
                    </span>
                    <span className="text-muted d-block" style={{ fontSize: '12.5px', lineHeight: 1.45 }}>
                      Days matching the company's designated weekly off schedule are flagged as <strong>Weekly Off (Green)</strong> and exempt from paid deduction.
                    </span>
                  </div>
                  <Form.Check
                    type="switch"
                    id="switch-weeklyoff-validation"
                    checked={leaveSettings.enableWeeklyOffValidation}
                    onChange={(e) => setLeaveSettings({ ...leaveSettings, enableWeeklyOffValidation: e.target.checked })}
                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </Col>

            <Col md={6}>
              <div className="p-3.5 rounded-3 h-100" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="d-flex align-items-start justify-content-between gap-3">
                  <div>
                    <span className="fw-semibold text-dark d-block mb-1" style={{ fontSize: '14px' }}>
                      Show Leave Impact Summary Card
                    </span>
                    <span className="text-muted d-block" style={{ fontSize: '12.5px', lineHeight: 1.45 }}>
                      Renders the 6-metric summary panel, color-coded day-by-day badges, and impact confirmation modal before leave application submission.
                    </span>
                  </div>
                  <Form.Check
                    type="switch"
                    id="switch-impact-summary"
                    checked={leaveSettings.showLeaveImpactSummary}
                    onChange={(e) => setLeaveSettings({ ...leaveSettings, showLeaveImpactSummary: e.target.checked })}
                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </Col>

            {/* Configured Weekly Off Days */}
            <Col md={12}>
              <div className="p-3.5 rounded-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="mb-2">
                  <span className="fw-semibold text-dark d-block" style={{ fontSize: '14px' }}>
                    Configured Weekly Off Days
                  </span>
                  <span className="text-muted" style={{ fontSize: '12.5px' }}>
                    Select which day(s) of the week are considered company non-working days for leave calculation:
                  </span>
                </div>
                <div className="d-flex flex-wrap gap-2 pt-1">
                  {[
                    { label: 'Sunday', idx: 0 },
                    { label: 'Monday', idx: 1 },
                    { label: 'Tuesday', idx: 2 },
                    { label: 'Wednesday', idx: 3 },
                    { label: 'Thursday', idx: 4 },
                    { label: 'Friday', idx: 5 },
                    { label: 'Saturday', idx: 6 }
                  ].map((day) => {
                    const isSelected = (leaveSettings.weeklyOffDays || []).includes(day.idx);
                    return (
                      <button
                        key={day.idx}
                        type="button"
                        onClick={() => {
                          const currentDays = [...(leaveSettings.weeklyOffDays || [])];
                          if (isSelected) {
                            if (currentDays.length === 1) {
                              alert('At least one weekly off day must remain selected.');
                              return;
                            }
                            setLeaveSettings({
                              ...leaveSettings,
                              weeklyOffDays: currentDays.filter(d => d !== day.idx)
                            });
                          } else {
                            setLeaveSettings({
                              ...leaveSettings,
                              weeklyOffDays: [...currentDays, day.idx].sort((a, b) => a - b)
                            });
                          }
                        }}
                        className="btn btn-sm d-flex align-items-center gap-1.5"
                        style={{
                          borderRadius: '8px',
                          padding: '6px 14px',
                          fontSize: '13px',
                          fontWeight: 500,
                          border: isSelected ? '1px solid #4F46E5' : '1px solid #CBD5E1',
                          backgroundColor: isSelected ? '#EEF2FF' : '#FFFFFF',
                          color: isSelected ? '#4338CA' : '#475569',
                          transition: 'all 0.15s ease-in-out'
                        }}
                      >
                        {isSelected && <span style={{ color: '#4F46E5' }}>✓</span>}
                        <span>{day.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Col>
          </Row>

          <div className="pt-2 d-flex justify-content-end">
            <button
              className="btn btn-primary px-4"
              type="submit"
              disabled={leaveSaveLoading}
              style={{ height: '44px', borderRadius: '10px', fontWeight: 600, backgroundColor: '#4F46E5', borderColor: '#4F46E5' }}
            >
              {leaveSaveLoading ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  <span>Saving Validation Rules...</span>
                </>
              ) : (
                <>
                  <Save size={16} className="me-2" />
                  <span>Save Leave Validation Rules</span>
                </>
              )}
            </button>
          </div>
        </Form>
      </div>

      <Row className="g-4">
        {/* Attendance Rules Form Card */}
        <Col lg={7}>
          <div className="card p-4 border-0" style={{ boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)', borderRadius: '20px' }}>
            <div className="d-flex align-items-center justify-content-between pb-3 mb-4 border-bottom" style={{ borderColor: '#F1F5F9' }}>
              <div className="d-flex align-items-center gap-2.5">
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #DBEAFE',
                  }}
                >
                  <Clock size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16.5px', fontWeight: 600, color: '#0F172A', margin: 0 }}>Shift Timings & Rules</h3>
                  <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Define default office working hours, grace periods, and work policies</p>
                </div>
              </div>
            </div>

            {settings ? (
              <Form onSubmit={handleSaveSettings}>
                {/* Timing Blocks */}
                <div className="mb-4">
                  <span className="text-uppercase fw-bold text-muted d-block mb-3" style={{ fontSize: '11px', letterSpacing: '0.06em' }}>
                    Standard Daily Working Hours
                  </span>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-medium text-dark" style={{ fontSize: '13.5px' }}>Office Start Time</Form.Label>
                        <Form.Control
                          type="text"
                          value={settings.officeStart}
                          onChange={(e) => setSettings({ ...settings, officeStart: e.target.value })}
                          placeholder="10:00:00"
                          style={{ height: '44px', borderRadius: '10px', fontSize: '14px' }}
                          required
                        />
                        <span className="text-muted mt-1 d-block" style={{ fontSize: '12px' }}>Formal office start time</span>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-medium text-dark" style={{ fontSize: '13.5px' }}>Office End Time</Form.Label>
                        <Form.Control
                          type="text"
                          value={settings.officeEnd}
                          onChange={(e) => setSettings({ ...settings, officeEnd: e.target.value })}
                          placeholder="18:30:00"
                          style={{ height: '44px', borderRadius: '10px', fontSize: '14px' }}
                          required
                        />
                        <span className="text-muted mt-1 d-block" style={{ fontSize: '12px' }}>Standard shift conclusion</span>
                      </Form.Group>
                    </Col>
                  </Row>
                </div>

                {/* Grace & Cutoff Blocks */}
                <div className="mb-4 pt-3 border-top" style={{ borderColor: '#F8FAFC' }}>
                  <span className="text-uppercase fw-bold text-muted d-block mb-3" style={{ fontSize: '11px', letterSpacing: '0.06em' }}>
                    Grace Periods & Thresholds
                  </span>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-medium text-dark" style={{ fontSize: '13.5px' }}>Late Threshold</Form.Label>
                        <Form.Control
                          type="text"
                          value={settings.lateThreshold}
                          onChange={(e) => setSettings({ ...settings, lateThreshold: e.target.value })}
                          placeholder="10:15:00"
                          style={{ height: '44px', borderRadius: '10px', fontSize: '14px' }}
                          required
                        />
                        <span className="text-muted mt-1 d-block" style={{ fontSize: '12px' }}>Check-in after this is flagged Late</span>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-medium text-dark" style={{ fontSize: '13.5px' }}>Absence Cutoff</Form.Label>
                        <Form.Control
                          type="text"
                          value={settings.absenceCutoff}
                          onChange={(e) => setSettings({ ...settings, absenceCutoff: e.target.value })}
                          placeholder="11:00:00"
                          style={{ height: '44px', borderRadius: '10px', fontSize: '14px' }}
                          required
                        />
                        <span className="text-muted mt-1 d-block" style={{ fontSize: '12px' }}>No check-in by this time is marked Absent</span>
                      </Form.Group>
                    </Col>
                  </Row>
                </div>

                {/* Working Minutes & Reminder */}
                <div className="mb-4 pt-3 border-top" style={{ borderColor: '#F8FAFC' }}>
                  <span className="text-uppercase fw-bold text-muted d-block mb-3" style={{ fontSize: '11px', letterSpacing: '0.06em' }}>
                    Duration Requirements & Automation
                  </span>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-medium text-dark" style={{ fontSize: '13.5px' }}>Half Day Requirement (Min)</Form.Label>
                        <Form.Control
                          type="number"
                          value={settings.halfDayMinutes}
                          onChange={(e) => setSettings({ ...settings, halfDayMinutes: Number(e.target.value) })}
                          style={{ height: '44px', borderRadius: '10px', fontSize: '14px' }}
                          required
                        />
                        <span className="text-muted mt-1 d-block" style={{ fontSize: '12px' }}>E.g. 240 mins (4 hours)</span>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-medium text-dark" style={{ fontSize: '13.5px' }}>Full Day Requirement (Min)</Form.Label>
                        <Form.Control
                          type="number"
                          value={settings.fullDayMinutes}
                          onChange={(e) => setSettings({ ...settings, fullDayMinutes: Number(e.target.value) })}
                          style={{ height: '44px', borderRadius: '10px', fontSize: '14px' }}
                          required
                        />
                        <span className="text-muted mt-1 d-block" style={{ fontSize: '12px' }}>E.g. 480 mins (8 hours)</span>
                      </Form.Group>
                    </Col>

                    <Col md={12}>
                      <Form.Group>
                        <Form.Label className="fw-medium text-dark d-flex align-items-center gap-2" style={{ fontSize: '13.5px' }}>
                          <BellRing size={14} className="text-primary" />
                          <span>Checkout Reminder Time</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={settings.checkoutReminderTime}
                          onChange={(e) => setSettings({ ...settings, checkoutReminderTime: e.target.value })}
                          placeholder="18:45:00"
                          style={{ height: '44px', borderRadius: '10px', fontSize: '14px' }}
                          required
                        />
                        <span className="text-muted mt-1 d-block" style={{ fontSize: '12px' }}>
                          Automated push notification prompt sent to employees who haven't checked out
                        </span>
                      </Form.Group>
                    </Col>
                  </Row>
                </div>

                <div className="pt-2 d-flex justify-content-end">
                  <button
                    className="btn btn-primary px-4"
                    type="submit"
                    disabled={saveLoading}
                    style={{ height: '44px', borderRadius: '10px', fontWeight: 600 }}
                  >
                    {saveLoading ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} className="me-2" />
                        <span>Save Rules & Policies</span>
                      </>
                    )}
                  </button>
                </div>
              </Form>
            ) : (
              <div className="text-muted py-4 text-center">No settings configuration available.</div>
            )}
          </div>
        </Col>

        {/* Holidays Card */}
        <Col lg={5}>
          <div
            className="card p-4 border-0 h-100"
            style={{
              boxShadow: '0 8px 30px -4px rgba(15, 23, 42, 0.07), 0 2px 6px rgba(15, 23, 42, 0.04)',
              borderRadius: '24px',
              background: '#FFFFFF',
              border: '1px solid #EEF2F6',
            }}
          >
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom" style={{ borderColor: '#F1F5F9' }}>
              <div className="d-flex align-items-center gap-2.5">
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.28)',
                  }}
                >
                  <CalendarDays size={20} />
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                      Official Holidays
                    </h3>
                    <span
                      className="badge rounded-pill"
                      style={{
                        backgroundColor: '#EFF6FF',
                        color: '#1D4ED8',
                        border: '1px solid #BFDBFE',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                      }}
                    >
                      {holidays.length} Total
                    </span>
                  </div>
                  <p className="text-muted mb-0" style={{ fontSize: '12.5px', marginTop: '1px' }}>
                    Corporate calendar & paid official leaves
                  </p>
                </div>
              </div>

              {/* Add Toggle Button */}
              <button
                type="button"
                onClick={() => setShowAddHoliday(!showAddHoliday)}
                className="btn btn-sm d-flex align-items-center gap-1.5"
                style={{
                  borderRadius: '12px',
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  background: showAddHoliday ? '#F1F5F9' : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  color: showAddHoliday ? '#475569' : '#FFFFFF',
                  border: showAddHoliday ? '1px solid #CBD5E1' : 'none',
                  boxShadow: showAddHoliday ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {showAddHoliday ? (
                  <>
                    <X size={14} />
                    <span>Close</span>
                  </>
                ) : (
                  <>
                    <Plus size={15} />
                    <span>+ Add Holiday</span>
                  </>
                )}
              </button>
            </div>

            {/* Spotlight Banner: Next Immediate Holiday */}
            {(() => {
              const nextUpcoming = holidays.find((h) => !h.isPast);
              if (!nextUpcoming) return null;
              const nextTheme = getHolidayTheme(nextUpcoming.name, false, nextUpcoming.isToday);

              return (
                <div
                  className="p-3 mb-3 position-relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 55%, #1E3A8A 100%)',
                    borderRadius: '16px',
                    color: '#FFFFFF',
                    boxShadow: '0 6px 20px -3px rgba(15, 23, 42, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {/* Subtle Background Glow */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-20px',
                      right: '-20px',
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(59, 130, 246, 0.35) 0%, transparent 70%)',
                      pointerEvents: 'none',
                    }}
                  />

                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-1.5" style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#93C5FD' }}>
                      <Sparkles size={13} className="text-warning" />
                      <span>UPCOMING SPOTLIGHT</span>
                    </div>

                    <span
                      className="badge rounded-pill d-inline-flex align-items-center gap-1"
                      style={{
                        backgroundColor: nextUpcoming.isToday
                          ? '#10B981'
                          : nextUpcoming.daysAway === 1
                          ? '#F59E0B'
                          : 'rgba(59, 130, 246, 0.25)',
                        color: '#FFFFFF',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        backdropFilter: 'blur(6px)',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 9px',
                      }}
                    >
                      {nextUpcoming.isToday
                        ? '🎉 TODAY!'
                        : nextUpcoming.daysAway === 1
                        ? '⚡ TOMORROW'
                        : `IN ${nextUpcoming.daysAway} DAYS`}
                    </span>
                  </div>

                  <div className="d-flex align-items-center gap-3">
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.12)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px',
                        flexShrink: 0,
                      }}
                    >
                      {nextTheme.emoji}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="fw-bold text-white text-truncate" style={{ fontSize: '15px', letterSpacing: '-0.01em' }}>
                        {nextUpcoming.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#CBD5E1', marginTop: '1px' }}>
                        {formatDateDisplay(nextUpcoming.holidayDate)} ({nextUpcoming.day})
                        {nextUpcoming.description ? ` • ${nextUpcoming.description}` : ' • Official Paid Holiday'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Add Holiday Form (Collapsible Card) */}
            {showAddHoliday && (
              <div
                className="p-3 mb-3 rounded-3"
                style={{
                  background: '#F8FAFC',
                  border: '1.5px solid #BFDBFE',
                  borderRadius: '16px',
                  boxShadow: '0 4px 16px -2px rgba(37, 99, 235, 0.08)',
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-2.5">
                  <span className="fw-bold text-dark d-flex align-items-center gap-1.5" style={{ fontSize: '13.5px' }}>
                    <Sparkles size={14} className="text-primary" />
                    <span>Create New Official Holiday</span>
                  </span>
                  {detectedNewHolDay && (
                    <span
                      className="badge rounded-pill"
                      style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontSize: '11px', fontWeight: 700 }}
                    >
                      🗓️ {detectedNewHolDay}
                    </span>
                  )}
                </div>

                {/* Popular Quick Presets */}
                <div className="mb-2.5">
                  <div className="text-muted small fw-semibold mb-1.5" style={{ fontSize: '11.5px' }}>
                    Quick Presets (1-Click Auto Fill):
                  </div>
                  <div className="d-flex flex-wrap gap-1.5">
                    {[
                      { emoji: '🎊', name: 'New Year', desc: 'First day of the Gregorian calendar' },
                      { emoji: '🇮🇳', name: 'Republic Day', desc: 'Constitution of India came into effect' },
                      { emoji: '🎨', name: 'Holi', desc: 'Festival of Colours and spring' },
                      { emoji: '🇮🇳', name: 'Independence Day', desc: 'National Independence Day celebration' },
                      { emoji: '🇮🇳', name: 'Gandhi Jayanti', desc: 'Mahatma Gandhi Jayanti' },
                      { emoji: '🪔', name: 'Diwali', desc: 'Festival of Lights' },
                      { emoji: '🎄', name: 'Christmas', desc: 'Christmas Day Celebration' },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setNewHolName(preset.name);
                          setNewHolDesc(preset.desc);
                        }}
                        className="btn btn-sm py-1 px-2.5 d-inline-flex align-items-center gap-1"
                        style={{
                          fontSize: '11.5px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          backgroundColor: newHolName === preset.name ? '#EFF6FF' : '#FFFFFF',
                          color: newHolName === preset.name ? '#1D4ED8' : '#334155',
                          border: newHolName === preset.name ? '1px solid #93C5FD' : '1px solid #E2E8F0',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                      >
                        <span>{preset.emoji}</span>
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Form onSubmit={handleAddHoliday}>
                  <Row className="g-2">
                    <Col sm={6}>
                      <Form.Label className="text-muted small fw-bold mb-1" style={{ fontSize: '11.5px' }}>
                        Holiday Date *
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={newHolDate}
                        onChange={(e) => setNewHolDate(e.target.value)}
                        style={{ height: '38px', fontSize: '13px', borderRadius: '10px', border: '1px solid #CBD5E1' }}
                        required
                      />
                    </Col>
                    <Col sm={6}>
                      <Form.Label className="text-muted small fw-bold mb-1" style={{ fontSize: '11.5px' }}>
                        Holiday Name *
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="e.g. Diwali, Holi"
                        value={newHolName}
                        onChange={(e) => setNewHolName(e.target.value)}
                        style={{ height: '38px', fontSize: '13px', borderRadius: '10px', border: '1px solid #CBD5E1' }}
                        required
                      />
                    </Col>
                    <Col sm={12}>
                      <Form.Label className="text-muted small fw-bold mb-1" style={{ fontSize: '11.5px' }}>
                        Description (Optional)
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Optional description (e.g. Festival of Lights)..."
                        value={newHolDesc}
                        onChange={(e) => setNewHolDesc(e.target.value)}
                        style={{ height: '38px', fontSize: '13px', borderRadius: '10px', border: '1px solid #CBD5E1' }}
                      />
                    </Col>
                    <Col sm={12}>
                      <button
                        type="submit"
                        className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-1.5"
                        style={{
                          height: '40px',
                          fontSize: '13px',
                          borderRadius: '10px',
                          fontWeight: 700,
                          marginTop: '4px',
                          background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                        }}
                      >
                        <Plus size={16} />
                        <span>Save to Company Calendar</span>
                      </button>
                    </Col>
                  </Row>
                </Form>
              </div>
            )}

            {/* Filter & Search Bar */}
            <div className="d-flex flex-column gap-2 mb-3">
              <div className="d-flex align-items-center justify-content-between gap-2">
                {/* Search Box with Non-Overlapping Padding */}
                <div className="position-relative flex-grow-1">
                  <Search
                    size={15}
                    className="position-absolute text-muted"
                    style={{ top: '11px', left: '13px', pointerEvents: 'none', color: '#94A3B8' }}
                  />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search holiday, day, date..."
                    value={holidaySearch}
                    onChange={(e) => setHolidaySearch(e.target.value)}
                    style={{
                      paddingLeft: '38px',
                      paddingRight: holidaySearch ? '32px' : '12px',
                      height: '38px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      borderColor: '#E2E8F0',
                      backgroundColor: '#F8FAFC',
                      transition: 'all 0.15s ease',
                    }}
                  />
                  {holidaySearch && (
                    <button
                      type="button"
                      onClick={() => setHolidaySearch('')}
                      className="btn btn-sm position-absolute border-0 p-0 text-muted"
                      style={{ top: '9px', right: '12px' }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* View Mode Toggle */}
                <div
                  className="d-flex align-items-center p-1 rounded-3"
                  style={{ backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0' }}
                >
                  <button
                    type="button"
                    onClick={() => setHolidayViewMode('CARDS')}
                    className="btn btn-sm p-1.5"
                    style={{
                      borderRadius: '8px',
                      backgroundColor: holidayViewMode === 'CARDS' ? '#FFFFFF' : 'transparent',
                      color: holidayViewMode === 'CARDS' ? '#1D4ED8' : '#64748B',
                      boxShadow: holidayViewMode === 'CARDS' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      lineHeight: 1,
                    }}
                    title="Card feed view"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setHolidayViewMode('TABLE')}
                    className="btn btn-sm p-1.5"
                    style={{
                      borderRadius: '8px',
                      backgroundColor: holidayViewMode === 'TABLE' ? '#FFFFFF' : 'transparent',
                      color: holidayViewMode === 'TABLE' ? '#1D4ED8' : '#64748B',
                      boxShadow: holidayViewMode === 'TABLE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      lineHeight: 1,
                    }}
                    title="Table view"
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>

              {/* iOS-Style Segmented Status Tabs */}
              <div
                className="d-flex align-items-center p-1 rounded-3"
                style={{ backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0' }}
              >
                {[
                  { id: 'ALL', label: 'All Holidays', count: holidays.length },
                  { id: 'UPCOMING', label: 'Upcoming', count: holidays.filter((h) => !h.isPast).length },
                  { id: 'PAST', label: 'Past', count: holidays.filter((h) => h.isPast).length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHolidayTab(tab.id as any)}
                    className="btn btn-sm flex-fill d-flex align-items-center justify-content-center gap-1.5"
                    style={{
                      borderRadius: '8px',
                      padding: '5px 10px',
                      fontSize: '12.5px',
                      fontWeight: holidayTab === tab.id ? 700 : 500,
                      backgroundColor: holidayTab === tab.id ? '#FFFFFF' : 'transparent',
                      color: holidayTab === tab.id ? '#0F172A' : '#64748B',
                      boxShadow: holidayTab === tab.id ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                      transition: 'all 0.15s ease',
                      border: 'none',
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      className="badge rounded-pill"
                      style={{
                        backgroundColor: holidayTab === tab.id ? '#EFF6FF' : '#E2E8F0',
                        color: holidayTab === tab.id ? '#1D4ED8' : '#475569',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '2px 6px',
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Holidays List / Content */}
            {(() => {
              const filteredList = holidays.filter((h) => {
                if (holidayTab === 'UPCOMING' && h.isPast) return false;
                if (holidayTab === 'PAST' && !h.isPast) return false;
                if (holidaySearch.trim()) {
                  const q = holidaySearch.toLowerCase().trim();
                  const matchName = h.name?.toLowerCase().includes(q);
                  const matchDesc = h.description?.toLowerCase().includes(q);
                  const matchDay = h.day?.toLowerCase().includes(q);
                  const matchDate = h.holidayDate?.includes(q);
                  if (!matchName && !matchDesc && !matchDay && !matchDate) return false;
                }
                return true;
              });

              if (filteredList.length === 0) {
                return (
                  <div
                    className="text-center py-5 px-3 rounded-4"
                    style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1' }}
                  >
                    <CalendarDays size={36} className="text-muted mb-2 opacity-50" />
                    <div className="fw-bold text-dark" style={{ fontSize: '14.5px' }}>
                      No holidays found
                    </div>
                    <div className="text-muted small mt-1" style={{ fontSize: '12.5px' }}>
                      {holidaySearch
                        ? `No holidays match "${holidaySearch}"`
                        : holidayTab === 'UPCOMING'
                        ? 'No upcoming holidays left for this calendar year.'
                        : 'No official company holidays configured.'}
                    </div>
                    {holidaySearch && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-primary p-0 mt-2"
                        onClick={() => setHolidaySearch('')}
                        style={{ fontSize: '12.5px', textDecoration: 'none', fontWeight: 600 }}
                      >
                        Clear search filter
                      </button>
                    )}
                  </div>
                );
              }

              if (holidayViewMode === 'CARDS') {
                return (
                  <div
                    style={{
                      maxHeight: '420px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      paddingRight: '2px',
                    }}
                  >
                    <div className="d-flex flex-column gap-2.5">
                      {filteredList.map((h) => {
                        const theme = getHolidayTheme(h.name, h.isPast, h.isToday);

                        return (
                          <div
                            key={h.id}
                            className="d-flex align-items-center justify-content-between p-3 rounded-3"
                            style={{
                              background: theme.cardBg,
                              border: `1.5px solid ${theme.border}`,
                              boxShadow: h.isPast ? 'none' : '0 2px 8px -2px rgba(15, 23, 42, 0.05)',
                              borderRadius: '16px',
                              opacity: h.isPast ? 0.78 : 1,
                              transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                          >
                            {/* Left: Physical Style Calendar Leaf + Info */}
                            <div className="d-flex align-items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
                              {/* Apple/Physical Luxury Calendar Tile */}
                              <div
                                style={{
                                  width: '48px',
                                  height: '52px',
                                  borderRadius: '12px',
                                  overflow: 'hidden',
                                  boxShadow: '0 3px 8px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
                                  border: `1px solid ${theme.border}`,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  flexShrink: 0,
                                  background: '#FFFFFF',
                                }}
                              >
                                {/* Saturated Month Header Strip */}
                                <div
                                  style={{
                                    background: theme.headerBg,
                                    color: '#FFFFFF',
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    letterSpacing: '0.08em',
                                    textAlign: 'center',
                                    padding: '2.5px 0',
                                    lineHeight: 1,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {getMonthAbbr(h.holidayDate)}
                                </div>
                                {/* Clean White Day Number Body */}
                                <div
                                  style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '17px',
                                    fontWeight: 800,
                                    color: h.isPast ? '#64748B' : '#0F172A',
                                    lineHeight: 1,
                                    background: '#FFFFFF',
                                  }}
                                >
                                  {getDayNumber(h.holidayDate)}
                                </div>
                              </div>

                              {/* Holiday Information */}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                  <span style={{ fontSize: '15px' }}>{theme.emoji}</span>
                                  <span
                                    className="fw-bold text-dark text-truncate"
                                    style={{ fontSize: '14px', letterSpacing: '-0.01em' }}
                                  >
                                    {h.name}
                                  </span>

                                  {/* Vibrant Status Tag */}
                                  {h.isToday ? (
                                    <span
                                      className="badge d-inline-flex align-items-center gap-1"
                                      style={{
                                        backgroundColor: '#DCFCE7',
                                        color: '#15803D',
                                        border: '1px solid #86EFAC',
                                        fontSize: '10.5px',
                                        fontWeight: 800,
                                        padding: '2.5px 7px',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      <PartyPopper size={11} />
                                      <span>TODAY</span>
                                    </span>
                                  ) : h.daysAway !== undefined && h.daysAway >= 0 && !h.isPast ? (
                                    <span
                                      className="badge"
                                      style={{
                                        backgroundColor: h.daysAway === 1 ? '#FEF3C7' : '#EFF6FF',
                                        color: h.daysAway === 1 ? '#B45309' : '#1D4ED8',
                                        border: `1px solid ${h.daysAway === 1 ? '#FDE68A' : '#BFDBFE'}`,
                                        fontSize: '10.5px',
                                        fontWeight: 700,
                                        padding: '2.5px 7px',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      {h.daysAway === 1 ? '⚡ Tomorrow' : `In ${h.daysAway}d`}
                                    </span>
                                  ) : h.isPast ? (
                                    <span
                                      className="badge"
                                      style={{
                                        backgroundColor: '#F1F5F9',
                                        color: '#64748B',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        padding: '2px 6px',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      Past
                                    </span>
                                  ) : null}
                                </div>

                                <div
                                  className="d-flex align-items-center gap-2 text-muted mt-1"
                                  style={{ fontSize: '12px' }}
                                >
                                  <span className="fw-semibold text-secondary">{h.day}</span>
                                  <span style={{ color: '#CBD5E1' }}>&bull;</span>
                                  <span className="text-truncate" style={{ maxWidth: '220px', color: '#64748B' }}>
                                    {h.description || 'Official Paid Holiday'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Action Button: Refined Delete */}
                            <button
                              type="button"
                              className="btn btn-sm border-0 p-0"
                              onClick={() => handleDeleteHoliday(h.id)}
                              title="Delete holiday"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '10px',
                                color: '#94A3B8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transition: 'all 0.15s ease',
                                backgroundColor: 'transparent',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#EF4444';
                                e.currentTarget.style.backgroundColor = '#FEE2E2';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#94A3B8';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Clean Table View
              return (
                <div
                  style={{
                    maxHeight: '420px',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    borderRadius: '16px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <table className="table table-hover align-middle mb-0" style={{ tableLayout: 'auto' }}>
                    <thead style={{ background: '#F8FAFC' }}>
                      <tr>
                        <th style={{ fontSize: '11px', padding: '12px 14px', fontWeight: 700, color: '#475569' }}>DATE</th>
                        <th style={{ fontSize: '11px', padding: '12px 14px', fontWeight: 700, color: '#475569' }}>HOLIDAY NAME</th>
                        <th className="text-end" style={{ fontSize: '11px', padding: '12px 14px', fontWeight: 700, color: '#475569' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.map((h) => {
                        const theme = getHolidayTheme(h.name, h.isPast, h.isToday);

                        return (
                          <tr key={h.id} style={{ opacity: h.isPast ? 0.75 : 1 }}>
                            <td style={{ padding: '12px 14px', width: '120px' }}>
                              <div className="d-flex align-items-center gap-2.5">
                                <div
                                  style={{
                                    width: '38px',
                                    height: '42px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: `1px solid ${theme.border}`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    flexShrink: 0,
                                    background: '#FFFFFF',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                  }}
                                >
                                  <div
                                    style={{
                                      background: theme.headerBg,
                                      color: '#FFFFFF',
                                      fontSize: '9px',
                                      fontWeight: 800,
                                      textAlign: 'center',
                                      padding: '1.5px 0',
                                      lineHeight: 1,
                                    }}
                                  >
                                    {getMonthAbbr(h.holidayDate)}
                                  </div>
                                  <div
                                    style={{
                                      flex: 1,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '14px',
                                      fontWeight: 800,
                                      color: '#0F172A',
                                      lineHeight: 1,
                                    }}
                                  >
                                    {getDayNumber(h.holidayDate)}
                                  </div>
                                </div>
                                <div className="text-muted fw-semibold" style={{ fontSize: '11.5px' }}>
                                  {h.day}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div className="d-flex align-items-center gap-1.5">
                                <span>{theme.emoji}</span>
                                <span className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>
                                  {h.name}
                                </span>
                                {h.isToday && (
                                  <span className="badge" style={{ backgroundColor: '#DCFCE7', color: '#15803D', fontSize: '10px', padding: '2px 6px' }}>
                                    Today
                                  </span>
                                )}
                              </div>
                              {h.description && (
                                <div className="text-muted text-truncate" style={{ fontSize: '11.5px', maxWidth: '200px', marginTop: '2px' }}>
                                  {h.description}
                                </div>
                              )}
                            </td>
                            <td className="text-end" style={{ padding: '12px 14px' }}>
                              <button
                                type="button"
                                className="btn btn-sm border-0 p-1"
                                onClick={() => handleDeleteHoliday(h.id)}
                                title="Delete holiday"
                                style={{ width: '30px', height: '30px', borderRadius: '8px', color: '#94A3B8' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#EF4444';
                                  e.currentTarget.style.backgroundColor = '#FEE2E2';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#94A3B8';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </Col>
      </Row>
    </div>
  );
}
