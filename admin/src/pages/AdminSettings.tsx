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
  CalendarCheck
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
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16.5px', fontWeight: 600, color: '#0F172A', margin: 0 }}>Official Holidays</h3>
                  <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Manage paid annual holidays</p>
                </div>
              </div>
              <span className="badge" style={{ backgroundColor: '#F1F5F9', color: '#475569', fontSize: '11px', fontWeight: 600 }}>
                {holidays.length} configured
              </span>
            </div>

            {/* Add Holiday Form */}
            <div className="p-3 mb-4 rounded-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span className="fw-semibold text-dark d-block mb-2.5" style={{ fontSize: '13px' }}>
                Add New Holiday
              </span>
              <Form onSubmit={handleAddHoliday}>
                <Row className="g-2">
                  <Col sm={6}>
                    <Form.Control
                      type="date"
                      value={newHolDate}
                      onChange={(e) => setNewHolDate(e.target.value)}
                      style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                      required
                    />
                  </Col>
                  <Col sm={6}>
                    <Form.Control
                      type="text"
                      placeholder="e.g. Diwali, Christmas"
                      value={newHolName}
                      onChange={(e) => setNewHolName(e.target.value)}
                      style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                      required
                    />
                  </Col>
                  <Col sm={12}>
                    <Form.Control
                      type="text"
                      placeholder="Optional description (e.g. Festival of Lights)..."
                      value={newHolDesc}
                      onChange={(e) => setNewHolDesc(e.target.value)}
                      style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
                    />
                  </Col>
                  <Col sm={12}>
                    <button type="submit" className="btn btn-primary w-100" style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}>
                      <Plus size={15} />
                      <span>Add to Calendar</span>
                    </button>
                  </Col>
                </Row>
              </Form>
            </div>

            {/* Holidays List */}
            <div className="table-responsive" style={{ maxHeight: '360px', overflowY: 'auto', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <table className="table table-hover mb-0">
                <thead style={{ background: '#F8FAFC' }}>
                  <tr>
                    <th style={{ fontSize: '11.5px', padding: '12px 14px' }}>Date</th>
                    <th style={{ fontSize: '11.5px', padding: '12px 14px' }}>Day</th>
                    <th style={{ fontSize: '11.5px', padding: '12px 14px' }}>Holiday Name & Description</th>
                    <th className="text-end" style={{ fontSize: '11.5px', padding: '12px 14px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-muted" style={{ fontSize: '13.5px' }}>
                        No official holidays configured yet.
                      </td>
                    </tr>
                  ) : (
                    holidays.map((h) => (
                      <tr key={h.id}>
                        <td style={{ padding: '12px 14px' }}>
                          <span className="badge" style={{ backgroundColor: '#F1F5F9', color: '#1E293B', fontFamily: 'monospace', fontSize: '12px', fontWeight: 600 }}>
                            {h.holidayDate}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span className="text-muted small fw-medium">{h.day || '-'}</span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div className="fw-medium text-dark" style={{ fontSize: '13.5px' }}>{h.name}</div>
                          {h.description && (
                            <div className="text-muted" style={{ fontSize: '11.5px', marginTop: '2px' }}>{h.description}</div>
                          )}
                        </td>
                        <td className="text-end" style={{ padding: '12px 14px' }}>
                          <button
                            className="btn btn-outline-danger btn-sm p-1"
                            onClick={() => handleDeleteHoliday(h.id)}
                            title="Delete holiday"
                            style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
}
