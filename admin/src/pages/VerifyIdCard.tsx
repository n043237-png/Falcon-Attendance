import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Badge, Spinner, Alert } from 'react-bootstrap';
import { ShieldCheck, CheckCircle2, XCircle, Building2, Calendar, UserCheck, HeartPulse } from 'lucide-react';
import axios from 'axios';

export default function VerifyIdCard() {
  const { verificationId } = useParams<{ verificationId: string }>();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get(`${API_URL}/api/verify/id-card/${verificationId}`);
        if (res.data.success && res.data.verified) {
          setData(res.data.data);
        } else {
          setError(res.data.message || 'Unable to verify ID card credentials');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Invalid or expired employee verification token');
      } finally {
        setLoading(false);
      }
    };

    if (verificationId) {
      verify();
    }
  }, [verificationId]);

  return (
    <div
      className="min-vh-100 d-flex flex-column align-items-center justify-content-center p-3"
      style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
        color: '#FFFFFF'
      }}
    >
      <div className="w-100" style={{ maxWidth: '440px' }}>
        {/* Brand Header */}
        <div className="text-center mb-4">
          <div className="d-inline-flex align-items-center gap-2 mb-2">
            <img src="/logo.png" alt="Falcon Logo" style={{ width: '38px', height: '38px' }} />
            <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.5px' }}>
              FALCON INFO SOLUTIONS
            </span>
          </div>
          <p className="text-muted mb-0" style={{ fontSize: '13px', color: '#94A3B8' }}>
            Official Credential Verification Portal
          </p>
        </div>

        {/* Verification Card */}
        <Card className="border-0 shadow-lg rounded-4 overflow-hidden" style={{ background: '#FFFFFF', color: '#0F172A' }}>
          {loading ? (
            <Card.Body className="p-5 text-center">
              <Spinner animation="border" variant="primary" />
              <p className="text-muted mt-3 mb-0" style={{ fontSize: '13.5px' }}>
                Verifying digital credential against company directory...
              </p>
            </Card.Body>
          ) : error ? (
            <Card.Body className="p-4 p-md-5 text-center">
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto'
                }}
              >
                <XCircle size={36} />
              </div>
              <h5 className="fw-bold text-danger mb-2">Verification Failed</h5>
              <p className="text-muted mb-4" style={{ fontSize: '13.5px' }}>
                {error}
              </p>
              <div className="p-2.5 rounded-3 bg-light text-muted" style={{ fontSize: '12px' }}>
                If you suspect this card is counterfeit, please contact{' '}
                <strong>hr@falconinfosolutions.com</strong>.
              </div>
            </Card.Body>
          ) : data ? (
            <>
              {/* Verified Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
                  padding: '16px',
                  color: '#FFFFFF',
                  textAlign: 'center'
                }}
              >
                <div className="d-flex align-items-center justify-content-center gap-1.5 mb-1">
                  <CheckCircle2 size={20} />
                  <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.4px' }}>
                    OFFICIALLY VERIFIED
                  </span>
                </div>
                <div style={{ fontSize: '11px', opacity: 0.9 }}>
                  Authentic Employee of Falcon Info Solutions Pvt. Ltd.
                </div>
              </div>

              {/* Employee Summary */}
              <Card.Body className="p-4">
                <div className="text-center mb-4">
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      margin: '0 auto 12px auto',
                      border: '3px solid #2563EB',
                      boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.25)',
                      background: '#F1F5F9'
                    }}
                  >
                    {data.profilePhotoUrl ? (
                      <img
                        src={
                          data.profilePhotoUrl.startsWith('http')
                            ? data.profilePhotoUrl
                            : `${API_URL}${data.profilePhotoUrl.startsWith('/') ? '' : '/'}${data.profilePhotoUrl}`
                        }
                        alt={data.employeeName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="w-100 h-100 d-flex align-items-center justify-content-center fw-bold text-primary" style={{ fontSize: '24px' }}>
                        {data.employeeName?.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <h5 className="fw-bold mb-1 text-dark" style={{ fontSize: '18px' }}>
                    {data.employeeName}
                  </h5>
                  <div className="text-primary fw-semibold" style={{ fontSize: '13px' }}>
                    {data.designation}
                  </div>
                  <div className="mt-1">
                    <Badge bg={data.attendanceMode === 'Field' ? 'warning' : 'success'} className="px-2.5 py-1">
                      {data.attendanceMode} Employee
                    </Badge>
                  </div>
                </div>

                {/* Details List */}
                <div className="p-3 rounded-3 bg-light" style={{ fontSize: '12.5px' }}>
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Employee ID:</span>
                    <strong className="text-dark">{data.employeeId}</strong>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Department:</span>
                    <strong className="text-dark">{data.department}</strong>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Joining Date:</span>
                    <strong className="text-dark">{data.joiningDate}</strong>
                  </div>
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted">Organization:</span>
                    <strong className="text-dark">{data.companyName}</strong>
                  </div>
                </div>

                <div className="text-center mt-3 text-muted" style={{ fontSize: '11px' }}>
                  Verification ID: <code>{verificationId}</code>
                </div>
              </Card.Body>
            </>
          ) : null}
        </Card>

        {/* Footer */}
        <div className="text-center mt-3 text-muted" style={{ fontSize: '11px', color: '#64748B' }}>
          Falcon Info Solutions Pvt. Ltd. &copy; {new Date().getFullYear()} • All Rights Reserved
        </div>
      </div>
    </div>
  );
}
