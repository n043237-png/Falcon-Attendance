import React, { useState, useEffect } from 'react';
import { 
  Camera, ShieldCheck, Mail, Phone, Briefcase, Eye, CheckCircle2, User as UserIcon, 
  Calendar, MapPin, Building, CreditCard, FileText, AlertCircle, Upload, Trash2, 
  Download, Edit3, Save, X, History, UserCheck, HeartHandshake, FileCheck, Clock
} from 'lucide-react';
import { ProgressBar, Badge, Modal, Form, Button, Alert, Spinner, InputGroup } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import PhotoUploadModal from '../components/common/PhotoUploadModal';
import ImagePreviewModal from '../components/common/ImagePreviewModal';

export default function MyProfile() {
  const { user, token, updateUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [assignedShift, setAssignedShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals & Photos
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Active section tab
  const [activeTab, setActiveTab] = useState<'personal' | 'contact' | 'emergency' | 'professional' | 'bank' | 'documents' | 'activity'>('personal');

  // Self-Service Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: '',
    personalEmail: '',
    currentAddress: '',
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactPhone: '',
    emergencyContactAltPhone: ''
  });

  // Document Upload Modal State
  const [showDocModal, setShowDocModal] = useState(false);
  const [docType, setDocType] = useState('RESUME');
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Activity logs
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setProfile(data.data);
        setEditForm({
          phone: data.data.phone || '',
          personalEmail: data.data.personalEmail ? data.data.personalEmail.replace(/@gmail\.com$/i, '') : '',
          currentAddress: data.data.currentAddress || '',
          emergencyContactName: data.data.emergencyContactName || '',
          emergencyContactRelationship: data.data.emergencyContactRelationship || '',
          emergencyContactPhone: data.data.emergencyContactPhone || '',
          emergencyContactAltPhone: data.data.emergencyContactAltPhone || ''
        });

        // Also fetch assigned shift
        try {
          const shiftRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/employee/shift`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const shiftData = await shiftRes.json();
          if (shiftData.success && shiftData.data) {
            setAssignedShift(shiftData.data);
          }
        } catch (shiftErr) {
          console.warn('Failed to load employee shift:', shiftErr);
        }
      } else {
        setError(data.error?.message || 'Failed to fetch profile details');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    try {
      setLoadingActivity(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/profile/activity`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActivityLogs(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load profile activity:', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivity();
    }
  }, [activeTab]);

  const handlePhotoSuccess = (newUrl: string | null) => {
    updateUser({
      profilePhotoUrl: newUrl || undefined,
      profile_photo_url: newUrl || undefined,
    });
    setProfile((prev: any) => ({ ...prev, profilePhotoUrl: newUrl }));
    setSuccessMessage(newUrl ? 'Profile photo updated successfully!' : 'Profile photo removed.');
    setTimeout(() => setSuccessMessage(null), 4000);
    fetchProfile();
  };

  const handleSaveSelfService = async () => {
    try {
      setSaving(true);
      setError(null);
      let emailToSend = (editForm.personalEmail || '').trim().toLowerCase();
      if (emailToSend && !emailToSend.includes('@')) {
        emailToSend = `${emailToSend}@gmail.com`;
      }
      const payload = {
        ...editForm,
        personalEmail: emailToSend || null
      };
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage('Your profile details were updated successfully!');
        setIsEditing(false);
        setTimeout(() => setSuccessMessage(null), 4000);
        fetchProfile();
      } else {
        setError(data.error?.message || 'Failed to update profile');
      }
    } catch (err: any) {
      setError(err.message || 'Network error saving changes');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) {
      setDocError('Please select a file to upload (PDF, JPG, PNG up to 10MB).');
      return;
    }
    try {
      setUploadingDoc(true);
      setDocError(null);
      const formData = new FormData();
      formData.append('file', docFile);
      formData.append('documentType', docType);
      formData.append('documentTitle', docTitle || docFile.name);

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/profile/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setShowDocModal(false);
        setDocFile(null);
        setDocTitle('');
        setSuccessMessage('Document uploaded successfully!');
        setTimeout(() => setSuccessMessage(null), 4000);
        fetchProfile();
      } else {
        setDocError(data.error?.message || 'Failed to upload document');
      }
    } catch (err: any) {
      setDocError(err.message || 'Network error uploading document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/profile/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage('Document deleted.');
        setTimeout(() => setSuccessMessage(null), 3000);
        fetchProfile();
      } else {
        alert(data.error?.message || 'Failed to delete document');
      }
    } catch (err: any) {
      alert('Error deleting document: ' + err.message);
    }
  };

  const photoUrl = profile?.profilePhotoUrl || user?.profilePhotoUrl || null;
  const completeness = profile?.completeness || { percentage: 0, missingFields: [] };

  const getCompletenessVariant = (pct: number) => {
    if (pct >= 80) return 'success';
    if (pct >= 50) return 'warning';
    return 'danger';
  };

  if (loading && !profile) {
    return (
      <div className="d-flex align-items-center justify-content-center p-5 text-muted">
        <Spinner animation="border" size="sm" className="me-2" />
        <span>Loading employee profile...</span>
      </div>
    );
  }

  return (
    <div className="pb-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="page-title mb-1">Employee Profile</h1>
          <p className="text-muted mb-0" style={{ fontSize: '13.5px' }}>
            Enterprise HRMS Record &bull; Official Employee Master File
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {isEditing ? (
            <>
              <button
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1.5 px-3"
                onClick={() => {
                  setIsEditing(false);
                  setEditForm({
                    phone: profile?.phone || '',
                    personalEmail: profile?.personalEmail ? profile.personalEmail.replace(/@gmail\.com$/i, '') : '',
                    currentAddress: profile?.currentAddress || '',
                    emergencyContactName: profile?.emergencyContactName || '',
                    emergencyContactRelationship: profile?.emergencyContactRelationship || '',
                    emergencyContactPhone: profile?.emergencyContactPhone || '',
                    emergencyContactAltPhone: profile?.emergencyContactAltPhone || ''
                  });
                }}
                disabled={saving}
              >
                <X size={15} />
                <span>Cancel</span>
              </button>
              <button
                className="btn btn-primary btn-sm d-flex align-items-center gap-1.5 px-3"
                onClick={handleSaveSelfService}
                disabled={saving}
              >
                {saving ? <Spinner animation="border" size="sm" /> : <Save size={15} />}
                <span>Save Changes</span>
              </button>
            </>
          ) : (
            <button
              className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1.5 px-3"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 size={15} />
              <span>Edit Contact Info</span>
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <Alert variant="success" className="d-flex align-items-center gap-2 py-2.5 px-3 mb-4 rounded-3 shadow-sm" style={{ fontSize: '13.5px' }}>
          <CheckCircle2 size={16} className="text-success flex-shrink-0" />
          <span>{successMessage}</span>
        </Alert>
      )}

      {error && (
        <Alert variant="danger" className="d-flex align-items-center gap-2 py-2.5 px-3 mb-4 rounded-3 shadow-sm" style={{ fontSize: '13.5px' }}>
          <AlertCircle size={16} className="text-danger flex-shrink-0" />
          <span>{error}</span>
        </Alert>
      )}

      {/* Top Banner: Profile Completeness Score */}
      <div className="card p-3 p-md-4 border-0 shadow-sm mb-4" style={{ borderRadius: '16px', background: '#FFFFFF' }}>
        <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-2">
          <div className="d-flex align-items-center gap-2">
            <ShieldCheck size={20} className="text-primary" />
            <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: '15px' }}>Profile Completeness</h5>
            <Badge bg={getCompletenessVariant(completeness.percentage)} className="px-2.5 py-1" style={{ fontSize: '12px' }}>
              {completeness.percentage}% Complete
            </Badge>
          </div>
          <span className="text-muted" style={{ fontSize: '12.5px' }}>
            {completeness.percentage >= 100 
              ? 'All required HR records verified & up to date.' 
              : `${completeness.missingFields.length} missing field${completeness.missingFields.length > 1 ? 's' : ''} to reach 100%`}
          </span>
        </div>

        <ProgressBar 
          now={completeness.percentage} 
          variant={getCompletenessVariant(completeness.percentage)} 
          style={{ height: '8px', borderRadius: '4px' }} 
          className="mb-2"
        />

        {completeness.missingFields && completeness.missingFields.length > 0 && (
          <div className="d-flex flex-wrap align-items-center gap-1.5 pt-2">
            <span className="text-muted small me-1">Missing items:</span>
            {completeness.missingFields.slice(0, 6).map((field: string, idx: number) => (
              <Badge key={idx} bg="light" text="dark" className="border fw-normal" style={{ fontSize: '11px' }}>
                {field}
              </Badge>
            ))}
            {completeness.missingFields.length > 6 && (
              <span className="text-muted small">+{completeness.missingFields.length - 6} more</span>
            )}
          </div>
        )}
      </div>

      <div className="row g-4">
        {/* Left Column: Avatar & Core Identity */}
        <div className="col-lg-4">
          <div className="card text-center p-4 border-0 shadow-sm" style={{ borderRadius: '16px', background: '#FFFFFF' }}>
            {/* Avatar with Camera Overlay */}
            <div className="d-flex justify-content-center mb-3">
              <div className="position-relative d-inline-block">
                <Avatar
                  src={photoUrl}
                  name={profile?.name || user?.name}
                  size={110}
                  shape="circle"
                  showBorder
                  borderColor="#3B82F6"
                  onClick={() => photoUrl && setShowPreviewModal(true)}
                  style={{
                    boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.25)',
                    cursor: photoUrl ? 'pointer' : 'default',
                  }}
                />
                <button
                  className="btn btn-primary rounded-circle position-absolute bottom-0 end-0 p-0 d-flex align-items-center justify-content-center shadow"
                  style={{
                    width: '36px',
                    height: '36px',
                    border: '3px solid #FFFFFF',
                    transform: 'translate(4px, 4px)',
                  }}
                  onClick={() => setShowUploadModal(true)}
                  title="Upload / Change Photo"
                >
                  <Camera size={16} />
                </button>
              </div>
            </div>

            <h2 style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 4px 0', color: '#0F172A' }}>
              {profile?.name || user?.name || 'Employee'}
            </h2>
            <div className="font-monospace text-primary fw-bold mb-2" style={{ fontSize: '13px' }}>
              {profile?.employeeCode || profile?.employeeId || '-'}
            </div>
            <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
              {profile?.designation || 'Staff Member'} &bull; {profile?.department || 'Operations'}
            </p>

            <div className="d-flex justify-content-center gap-2 mb-3">
              <Badge bg="primary" className="fw-semibold px-2.5 py-1.5" style={{ fontSize: '11px' }}>
                {profile?.role?.toUpperCase() || 'EMPLOYEE'}
              </Badge>
              <Badge 
                bg={profile?.jobStatus === 'Provisional' ? 'warning' : 'success'} 
                className={`fw-semibold px-2.5 py-1.5 ${profile?.jobStatus === 'Provisional' ? 'text-dark' : ''}`}
                style={{ fontSize: '11px' }}
              >
                {profile?.jobStatus?.toUpperCase() || 'PERMANENT'}
              </Badge>
              <Badge bg={profile?.status === 'active' ? 'success' : 'secondary'} className="fw-semibold px-2.5 py-1.5" style={{ fontSize: '11px' }}>
                {(profile?.status || 'active').toUpperCase()}
              </Badge>
            </div>

            <div className="d-flex flex-column gap-2 pt-3 border-top text-start" style={{ fontSize: '13px' }}>
              <div className="d-flex align-items-center justify-content-between py-1">
                <span className="text-muted d-flex align-items-center gap-1.5">
                  <Mail size={14} /> Official Email:
                </span>
                <span className="fw-semibold text-truncate ms-2" style={{ maxWidth: '180px' }} title={profile?.email}>
                  {profile?.email || '-'}
                </span>
              </div>
              <div className="d-flex align-items-center justify-content-between py-1">
                <span className="text-muted d-flex align-items-center gap-1.5">
                  <Phone size={14} /> Mobile Phone:
                </span>
                <span className="fw-semibold">{profile?.phone || 'Not set'}</span>
              </div>
              <div className="d-flex align-items-center justify-content-between py-1">
                <span className="text-muted d-flex align-items-center gap-1.5">
                  <Calendar size={14} /> Joining Date:
                </span>
                <span className="fw-semibold">{profile?.joiningDate || '-'}</span>
              </div>
              <div className="d-flex align-items-center justify-content-between py-1">
                <span className="text-muted d-flex align-items-center gap-1.5">
                  <Briefcase size={14} /> Employment Type:
                </span>
                <span className="fw-semibold">{profile?.employmentType || 'Full-Time'}</span>
              </div>
            </div>

            <div className="pt-3 border-top mt-3">
              <button
                className="btn btn-outline-primary btn-sm w-100 rounded-pill py-2 d-flex align-items-center justify-content-center gap-1.5"
                onClick={() => setShowUploadModal(true)}
              >
                <Camera size={14} />
                <span>{photoUrl ? 'Change Profile Picture' : 'Upload Profile Picture'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed HRMS Sections */}
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm overflow-hidden" style={{ borderRadius: '16px', background: '#FFFFFF' }}>
            {/* Tabs Navigation */}
            <div className="border-bottom bg-light px-3 pt-2 d-flex gap-1 overflow-auto" style={{ scrollbarWidth: 'none' }}>
              <button
                type="button"
                className={`btn btn-sm py-2 px-3 fw-semibold border-0 rounded-top ${activeTab === 'personal' ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}
                onClick={() => setActiveTab('personal')}
              >
                Personal Details
              </button>
              <button
                type="button"
                className={`btn btn-sm py-2 px-3 fw-semibold border-0 rounded-top ${activeTab === 'contact' ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}
                onClick={() => setActiveTab('contact')}
              >
                Contact & Address
              </button>
              <button
                type="button"
                className={`btn btn-sm py-2 px-3 fw-semibold border-0 rounded-top ${activeTab === 'emergency' ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}
                onClick={() => setActiveTab('emergency')}
              >
                Emergency
              </button>
              <button
                type="button"
                className={`btn btn-sm py-2 px-3 fw-semibold border-0 rounded-top ${activeTab === 'professional' ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}
                onClick={() => setActiveTab('professional')}
              >
                Employment
              </button>
              <button
                type="button"
                className={`btn btn-sm py-2 px-3 fw-semibold border-0 rounded-top ${activeTab === 'bank' ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}
                onClick={() => setActiveTab('bank')}
              >
                Bank & Financial
              </button>
              <button
                type="button"
                className={`btn btn-sm py-2 px-3 fw-semibold border-0 rounded-top ${activeTab === 'documents' ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}
                onClick={() => setActiveTab('documents')}
              >
                Documents ({profile?.documents?.length || 0})
              </button>
              <button
                type="button"
                className={`btn btn-sm py-2 px-3 fw-semibold border-0 rounded-top ${activeTab === 'activity' ? 'bg-white text-primary shadow-sm' : 'text-muted'}`}
                onClick={() => setActiveTab('activity')}
              >
                Activity History
              </button>
            </div>

            <div className="p-4">
              {/* TAB 1: PERSONAL DETAILS */}
              {activeTab === 'personal' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '15px' }}>Personal Information & Identity</h5>
                    <span className="text-muted small">Managed officially by HR / Administration</span>
                  </div>

                  <div className="row g-3">
                    <div className="col-sm-4">
                      <label className="text-muted small fw-semibold">First Name</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.firstName || '-'}</div>
                    </div>
                    <div className="col-sm-4">
                      <label className="text-muted small fw-semibold">Middle Name</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.middleName || '-'}</div>
                    </div>
                    <div className="col-sm-4">
                      <label className="text-muted small fw-semibold">Last Name</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.lastName || '-'}</div>
                    </div>

                    <div className="col-sm-4">
                      <label className="text-muted small fw-semibold">Date of Birth</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.dateOfBirth || 'Not configured'}</div>
                    </div>
                    <div className="col-sm-4">
                      <label className="text-muted small fw-semibold">Gender</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.gender || 'Not configured'}</div>
                    </div>
                    <div className="col-sm-4">
                      <label className="text-muted small fw-semibold">Blood Group</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium text-danger fw-bold">{profile?.bloodGroup || 'Not set'}</div>
                    </div>

                    <div className="col-sm-4">
                      <label className="text-muted small fw-semibold">Marital Status</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.maritalStatus || 'Not configured'}</div>
                    </div>
                    <div className="col-sm-4">
                      <label className="text-muted small fw-semibold">Nationality</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.nationality || 'Indian'}</div>
                    </div>
                    <div className="col-sm-4">
                      <label className="text-muted small fw-semibold">PAN Card (Masked)</label>
                      <div className="p-2.5 rounded-3 bg-light border font-monospace fw-bold">{profile?.panNumber || 'Not configured'}</div>
                    </div>

                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Aadhaar Number (Masked)</label>
                      <div className="p-2.5 rounded-3 bg-light border font-monospace fw-bold">{profile?.aadhaarNumber || 'Not configured'}</div>
                    </div>

                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Mother Name</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.motherName || 'Not configured'}</div>
                    </div>

                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Father Name</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.fatherName || 'Not configured'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CONTACT & ADDRESS */}
              {activeTab === 'contact' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <div>
                      <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '15px' }}>Contact & Address Details</h5>
                      <span className="text-muted small">You can update your personal mobile, email, and current residence.</span>
                    </div>
                    {!isEditing && (
                      <button className="btn btn-outline-primary btn-sm" onClick={() => setIsEditing(true)}>
                        <Edit3 size={13} className="me-1" /> Edit
                      </button>
                    )}
                  </div>

                  <div className="row g-3">
                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Official Work Email (Read-Only)</label>
                      <div className="p-2.5 rounded-3 bg-light border text-muted">{profile?.email}</div>
                    </div>

                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Mobile Number {isEditing && <span className="text-primary">(Self-Editable)</span>}</label>
                      {isEditing ? (
                        <Form.Control
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                          placeholder="10-digit mobile number"
                        />
                      ) : (
                        <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.phone || 'Not configured'}</div>
                      )}
                    </div>

                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold mb-1 d-block">Personal Email {isEditing && <span className="text-primary">(Self-Editable)</span>}</label>
                      {isEditing ? (
                        <div>
                          <InputGroup>
                            <Form.Control
                              type="text"
                              value={editForm.personalEmail}
                              onChange={(e) => {
                                let val = e.target.value.toLowerCase().trim();
                                if (val.endsWith('@gmail.com')) {
                                  val = val.replace(/@gmail\.com$/i, '');
                                }
                                setEditForm({ ...editForm, personalEmail: val });
                              }}
                              placeholder="username"
                            />
                            {!editForm.personalEmail.includes('@') && (
                              <InputGroup.Text className="bg-light text-muted fw-semibold" style={{ fontSize: '13px' }}>
                                @gmail.com
                              </InputGroup.Text>
                            )}
                          </InputGroup>
                          {editForm.personalEmail && editForm.personalEmail.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.personalEmail) && (
                            <div className="text-danger small mt-1" style={{ fontSize: '11px' }}>
                              Please enter a valid email address
                            </div>
                          )}
                          {editForm.personalEmail && !editForm.personalEmail.includes('@') && !/^[a-zA-Z0-9._-]+$/.test(editForm.personalEmail) && (
                            <div className="text-danger small mt-1" style={{ fontSize: '11px' }}>
                              Invalid username (only letters, numbers, dots, hyphens allowed)
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.personalEmail || 'Not configured'}</div>
                      )}
                    </div>

                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">City, State & PIN</label>
                      <div className="p-2.5 rounded-3 bg-light border text-muted">
                        {[profile?.city, profile?.state, profile?.pinCode].filter(Boolean).join(', ') || 'Not configured'}
                      </div>
                    </div>

                    <div className="col-12">
                      <label className="text-muted small fw-semibold">Current Residential Address {isEditing && <span className="text-primary">(Self-Editable)</span>}</label>
                      {isEditing ? (
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={editForm.currentAddress}
                          onChange={(e) => setEditForm({ ...editForm, currentAddress: e.target.value })}
                          placeholder="Enter your current residential address"
                        />
                      ) : (
                        <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.currentAddress || 'Not configured'}</div>
                      )}
                    </div>

                    <div className="col-12">
                      <label className="text-muted small fw-semibold">Permanent Address (Official Record)</label>
                      <div className="p-2.5 rounded-3 bg-light border text-muted">{profile?.permanentAddress || 'Not configured'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: EMERGENCY CONTACT */}
              {activeTab === 'emergency' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <div>
                      <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '15px' }}>Emergency Contact Information</h5>
                      <span className="text-muted small">In case of an urgent incident or medical emergency.</span>
                    </div>
                    {!isEditing && (
                      <button className="btn btn-outline-primary btn-sm" onClick={() => setIsEditing(true)}>
                        <Edit3 size={13} className="me-1" /> Edit
                      </button>
                    )}
                  </div>

                  <div className="row g-3">
                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Contact Person Name</label>
                      {isEditing ? (
                        <Form.Control
                          type="text"
                          value={editForm.emergencyContactName}
                          onChange={(e) => setEditForm({ ...editForm, emergencyContactName: e.target.value })}
                          placeholder="e.g. John Doe"
                        />
                      ) : (
                        <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.emergencyContactName || 'Not configured'}</div>
                      )}
                    </div>

                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Relationship</label>
                      {isEditing ? (
                        <Form.Select
                          value={editForm.emergencyContactRelationship}
                          onChange={(e) => setEditForm({ ...editForm, emergencyContactRelationship: e.target.value })}
                        >
                          <option value="">Select Relationship</option>
                          <option value="Spouse">Spouse</option>
                          <option value="Parent">Parent</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Child">Child</option>
                          <option value="Friend">Friend</option>
                          <option value="Other">Other</option>
                        </Form.Select>
                      ) : (
                        <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.emergencyContactRelationship || 'Not configured'}</div>
                      )}
                    </div>

                    <div className="col-sm-12">
                      <label className="text-muted small fw-semibold">Emergency Contact Phone</label>
                      {isEditing ? (
                        <Form.Control
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={editForm.emergencyContactPhone}
                          onChange={(e) => setEditForm({ ...editForm, emergencyContactPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                          placeholder="10-digit phone number"
                        />
                      ) : (
                        <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.emergencyContactPhone || 'Not configured'}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: EMPLOYMENT & PROFESSIONAL */}
              {activeTab === 'professional' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '15px' }}>Official Employment Records</h5>
                    <span className="text-muted small">Managed officially by HR / System Admins</span>
                  </div>

                  <div className="row g-3">
                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Employee ID</label>
                      <div className="p-2.5 rounded-3 bg-light border font-monospace fw-bold text-primary">{profile?.employeeId}</div>
                    </div>
                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Reporting Manager</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">
                        {profile?.reportingManager || profile?.reportingManagerName ? (
                          <span>
                            {profile.reportingManager || profile.reportingManagerName}{' '}
                            {profile?.reportingManagerEmail && <small className="text-muted">({profile.reportingManagerEmail})</small>}
                          </span>
                        ) : (
                          'Not assigned'
                        )}
                      </div>
                    </div>

                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Department</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.department || 'General Administration'}</div>
                    </div>
                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Designation</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.designation || 'Staff'}</div>
                    </div>

                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Employment Type</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.employmentType || 'Full-Time'}</div>
                    </div>
                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Work Mode</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.workMode || 'Office'}</div>
                    </div>

                    <div className="col-12">
                      <label className="text-muted small fw-semibold">Assigned Work Shift</label>
                      <div className="p-3 rounded-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <div className="d-flex align-items-center gap-2">
                            <Clock size={16} className="text-primary" />
                            <span className="fw-bold text-dark" style={{ fontSize: '14px' }}>
                              {assignedShift?.name || profile?.shiftAssignment || 'Day Shift'}
                            </span>
                            <Badge bg="primary" style={{ fontSize: '11px' }}>
                              {assignedShift?.code || 'DS'}
                            </Badge>
                            {assignedShift?.isNightShift && (
                              <Badge bg="dark" style={{ fontSize: '10.5px' }}>Overnight</Badge>
                            )}
                          </div>
                          <span className="badge bg-success">Active</span>
                        </div>
                        <div className="row g-2 text-muted mt-1" style={{ fontSize: '12px' }}>
                          <div className="col-sm-3">
                            <span className="d-block text-dark fw-semibold">
                              {assignedShift ? `${assignedShift.startTime?.substring(0, 5)} - ${assignedShift.endTime?.substring(0, 5)}` : '09:30 - 18:30'}
                            </span>
                            <span>Working Timings</span>
                          </div>
                          <div className="col-sm-3">
                            <span className="d-block text-dark fw-semibold">{assignedShift?.graceMinutes ?? 15} mins</span>
                            <span>Grace Period (Cutoff: {assignedShift?.lateAfter ? assignedShift.lateAfter.substring(0, 5) : '09:45'})</span>
                          </div>
                          <div className="col-sm-3">
                            <span className="d-block text-dark fw-semibold">{assignedShift?.breakMinutes ?? 60} mins</span>
                            <span>Auto Break Deduction</span>
                          </div>
                          <div className="col-sm-3">
                            <span className="d-block text-dark fw-semibold">{assignedShift?.minimumWorkHours ?? 8.0} hrs</span>
                            <span>Full Day Minimum</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Office Location</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.officeLocationName || 'Headquarters'}</div>
                    </div>

                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Joining Date</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.joiningDate || '-'}</div>
                    </div>
                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Confirmation Date</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.confirmationDate || 'Not confirmed'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: BANK & FINANCIAL */}
              {activeTab === 'bank' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '15px' }}>Disbursement & Banking Details</h5>
                    <span className="text-muted small">Masked for privacy &bull; Synced with Payroll Engine</span>
                  </div>

                  <div className="row g-3">
                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Bank Name</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.bankName || 'Not configured'}</div>
                    </div>
                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Account Holder Name</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.accountHolderName || profile?.name || 'Not configured'}</div>
                    </div>

                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Bank Account Number (Masked)</label>
                      <div className="p-2.5 rounded-3 bg-light border font-monospace fw-bold">{profile?.accountNumber || 'Not configured'}</div>
                    </div>
                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">IFSC Code</label>
                      <div className="p-2.5 rounded-3 bg-light border font-monospace fw-bold">{profile?.ifscCode || 'Not configured'}</div>
                    </div>

                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">Branch Name</label>
                      <div className="p-2.5 rounded-3 bg-light border fw-medium">{profile?.branchName || 'Not configured'}</div>
                    </div>
                    <div className="col-sm-6">
                      <label className="text-muted small fw-semibold">UPI ID</label>
                      <div className="p-2.5 rounded-3 bg-light border font-monospace">{profile?.upiId || 'Not configured'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: DOCUMENTS */}
              {activeTab === 'documents' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <div>
                      <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '15px' }}>Official Employee Documents</h5>
                      <span className="text-muted small">Secure storage for Resume, ID proofs, and certifications (PDF, JPG, PNG up to 10MB)</span>
                    </div>
                    <button className="btn btn-primary btn-sm d-flex align-items-center gap-1.5" onClick={() => setShowDocModal(true)}>
                      <Upload size={14} />
                      <span>Upload Document</span>
                    </button>
                  </div>

                  {(!profile?.documents || profile.documents.length === 0) ? (
                    <div className="text-center py-5 border rounded-3 bg-light">
                      <FileText size={40} className="text-muted mb-2" />
                      <div className="fw-semibold text-dark">No documents uploaded yet</div>
                      <p className="text-muted small mb-3">Upload your Resume/CV, Aadhaar, PAN or Educational Certificates.</p>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => setShowDocModal(true)}>
                        <Upload size={14} className="me-1" /> Upload First Document
                      </button>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0" style={{ fontSize: '13.5px' }}>
                        <thead className="table-light">
                          <tr>
                            <th>Document Title</th>
                            <th>Type</th>
                            <th>File Size</th>
                            <th>Uploaded On</th>
                            <th className="text-end">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.documents.map((doc: any) => (
                            <tr key={doc.id}>
                              <td className="fw-semibold text-dark">
                                <div className="d-flex align-items-center gap-2">
                                  <FileText size={16} className="text-primary flex-shrink-0" />
                                  <span>{doc.documentTitle}</span>
                                </div>
                              </td>
                              <td>
                                <Badge bg="light" text="dark" className="border">
                                  {doc.documentType}
                                </Badge>
                              </td>
                              <td className="text-muted">
                                {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : '-'}
                              </td>
                              <td className="text-muted">
                                {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '-'}
                              </td>
                              <td className="text-end">
                                <div className="btn-group">
                                  <a
                                    href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${doc.fileUrl}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-outline-secondary btn-sm"
                                    title="View / Download"
                                  >
                                    <Download size={13} />
                                  </a>
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => handleDeleteDocument(doc.id)}
                                    title="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: ACTIVITY HISTORY */}
              {activeTab === 'activity' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '15px' }}>Profile Activity & Audit Log</h5>
                    <span className="text-muted small">Full audit trail of all profile adjustments</span>
                  </div>

                  {loadingActivity ? (
                    <div className="text-center py-4 text-muted">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading activity trail...
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="text-center py-4 text-muted small">No profile updates recorded yet.</div>
                  ) : (
                    <div className="timeline ps-2">
                      {activityLogs.map((log: any) => (
                        <div key={log.id} className="d-flex align-items-start gap-3 mb-3 pb-2 border-bottom">
                          <div className="p-1.5 rounded-circle bg-light border text-primary mt-1">
                            <History size={14} />
                          </div>
                          <div className="flex-fill">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                                {log.metadata?.field 
                                  ? `Field "${log.metadata.field}" updated`
                                  : log.action}
                              </span>
                              <span className="text-muted small">
                                {new Date(log.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-muted small">
                              {log.metadata?.oldValue !== undefined && log.metadata?.newValue !== undefined ? (
                                <span>
                                  Changed from <code className="text-muted">{String(log.metadata.oldValue || 'none')}</code> to{' '}
                                  <code className="text-success">{String(log.metadata.newValue || 'none')}</code>
                                </span>
                              ) : (
                                <span>{log.metadata?.documentTitle || log.metadata?.documentType || 'Profile modification'}</span>
                              )}
                            </div>
                            <div className="text-muted" style={{ fontSize: '11.5px' }}>
                              Modified by: <strong>{log.performedByName || 'System'}</strong> ({log.performedByRole || 'Staff'})
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document Upload Modal */}
      <Modal show={showDocModal} onHide={() => setShowDocModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '16px', fontWeight: 700 }}>Upload Employee Document</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUploadDocument}>
          <Modal.Body>
            {docError && (
              <Alert variant="danger" className="py-2 px-3 small mb-3">
                {docError}
              </Alert>
            )}

            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">Document Category *</Form.Label>
              <Form.Select value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="RESUME">Resume / Curriculum Vitae (CV)</option>
                <option value="AADHAAR">Aadhaar Card (National ID)</option>
                <option value="PAN">PAN Card</option>
                <option value="OFFER_LETTER">Offer / Appointment Letter</option>
                <option value="EXPERIENCE_LETTER">Experience / Relieving Certificate</option>
                <option value="EDUCATION_CERTIFICATE">Educational Degree / Certificate</option>
                <option value="OTHER">Other Official Document</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">Document Title</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Updated Resume 2026 or B.Tech Certificate"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Choose File (PDF, JPG, PNG max 10MB) *</Form.Label>
              <Form.Control
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e: any) => {
                  if (e.target.files && e.target.files[0]) {
                    setDocFile(e.target.files[0]);
                    if (!docTitle) {
                      setDocTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                    }
                  }
                }}
              />
              <Form.Text className="text-muted" style={{ fontSize: '11.5px' }}>
                Securely encrypted and stored on the Falcon Attendance Master server.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setShowDocModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={uploadingDoc || !docFile}>
              {uploadingDoc ? <Spinner animation="border" size="sm" className="me-1" /> : <Upload size={14} className="me-1" />}
              <span>Upload Document</span>
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Photo Upload Modal */}
      <PhotoUploadModal
        show={showUploadModal}
        onHide={() => setShowUploadModal(false)}
        currentPhotoUrl={photoUrl}
        userName={profile?.name || user?.name}
        uploadUrl="/api/profile/photo"
        deleteUrl="/api/profile/photo"
        token={token}
        onSaveSuccess={handlePhotoSuccess}
      />

      {/* Full Size Preview Modal */}
      <ImagePreviewModal
        show={showPreviewModal}
        onHide={() => setShowPreviewModal(false)}
        src={photoUrl}
        name={profile?.name || user?.name}
        employeeId={profile?.employeeCode || profile?.employeeId}
        role={profile?.role}
        department={profile?.department}
      />
    </div>
  );
}
