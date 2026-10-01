import React, { useState, useEffect } from 'react';
import { Card, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import { ShieldCheck, RefreshCw, Sparkles, UserCheck } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import DigitalIdCard, { IdCardEmployeeData, IdCardCompanyData, defaultCompany } from '../../components/idcard/DigitalIdCard';

export default function MyIdCard() {
  const { token, user } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const [cardData, setCardData] = useState<{
    employee: IdCardEmployeeData;
    company: IdCardCompanyData;
    qrCodeDataUrl: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyIdCard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_URL}/api/profile/id-card`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setCardData(res.data.data);
      } else {
        setError(res.data.error?.message || 'Failed to load ID card');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to retrieve your digital ID card');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchMyIdCard();
  }, [token]);

  return (
    <div className="container-fluid py-3 px-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h2 className="fw-bold mb-0 text-dark" style={{ fontSize: '1.65rem' }}>
              Digital ID Card
            </h2>
            <Badge bg="primary" className="px-2 py-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
              OFFICIAL CREDENTIAL
            </Badge>
          </div>
          <p className="text-muted mb-0 mt-1" style={{ fontSize: '13.5px' }}>
            Your official Falcon Info Solutions company ID card. Automatically synchronized with your latest profile information.
          </p>
        </div>

        <div>
          <Button
            variant="outline-secondary"
            className="d-flex align-items-center gap-1.5 px-3 py-2 shadow-sm"
            onClick={fetchMyIdCard}
            disabled={loading}
            style={{ fontSize: '13px', fontWeight: 500 }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh Card
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="d-flex justify-content-center">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="text-muted mt-2 mb-0" style={{ fontSize: '13.5px' }}>
              Generating your high-resolution digital ID card...
            </p>
          </div>
        ) : error ? (
          <Card className="border-0 shadow-sm rounded-4 p-4 text-center" style={{ maxWidth: '420px' }}>
            <Alert variant="danger" className="text-start mb-3" style={{ fontSize: '13px' }}>
              {error}
            </Alert>
            <Button variant="primary" size="sm" onClick={fetchMyIdCard}>
              Try Again
            </Button>
          </Card>
        ) : cardData ? (
          <Card className="border-0 shadow-sm rounded-4 p-4 p-md-5" style={{ maxWidth: '520px', width: '100%', background: '#F8FAFC' }}>
            <div className="text-center mb-3">
              <div
                className="d-inline-flex align-items-center gap-1.5 px-3 py-1 rounded-pill bg-white border shadow-xs mb-2"
                style={{ fontSize: '12px', fontWeight: 600, color: '#2563EB' }}
              >
                <Sparkles size={13} />
                <span>Interactive Enterprise ID Card</span>
              </div>
              <p className="text-muted mb-0" style={{ fontSize: '12.5px' }}>
                Tap the card or click the button below to view the back side with your verification QR code.
              </p>
            </div>

            <DigitalIdCard
              employee={cardData.employee}
              company={cardData.company}
              qrCodeDataUrl={cardData.qrCodeDataUrl}
              apiBaseUrl={API_URL}
              token={token || undefined}
            />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
