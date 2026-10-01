import React, { useState, useEffect } from 'react';
import { Modal, Spinner, Alert, Button } from 'react-bootstrap';
import axios from 'axios';
import DigitalIdCard, { IdCardEmployeeData, IdCardCompanyData, defaultCompany } from './DigitalIdCard';
import { ShieldCheck, X } from 'lucide-react';

interface IdCardModalProps {
  show: boolean;
  onHide: () => void;
  employeeId?: number | null;
  initialData?: IdCardEmployeeData | null;
  token?: string;
  apiBaseUrl?: string;
}

export default function IdCardModal({
  show,
  onHide,
  employeeId,
  initialData,
  token,
  apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
}: IdCardModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardData, setCardData] = useState<{
    employee: IdCardEmployeeData;
    company: IdCardCompanyData;
    qrCodeDataUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!show) {
      setCardData(null);
      setError(null);
      return;
    }

    if (initialData) {
      setCardData({
        employee: initialData,
        company: defaultCompany,
        qrCodeDataUrl: ''
      });
    }

    if (employeeId && token) {
      fetchEmployeeCard(employeeId);
    }
  }, [show, employeeId, initialData, token]);

  const fetchEmployeeCard = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${apiBaseUrl}/api/admin/employees/${id}/id-card`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setCardData(res.data.data);
      } else {
        setError(res.data.error?.message || 'Failed to load ID card');
      }
    } catch (err: any) {
      // Fallback: if not admin endpoint, try self profile endpoint if id matches
      try {
        const selfRes = await axios.get(`${apiBaseUrl}/api/profile/id-card`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (selfRes.data.success) {
          setCardData(selfRes.data.data);
          return;
        }
      } catch {}
      setError(err.response?.data?.error?.message || 'Failed to retrieve employee ID card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      backdrop="static"
      contentClassName="border-0 shadow-lg rounded-4 overflow-hidden"
    >
      <Modal.Header className="bg-light border-0 py-3 px-4 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2">
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ShieldCheck size={18} />
          </div>
          <div>
            <Modal.Title style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Official Employee ID Card
            </Modal.Title>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Falcon Info Solutions Enterprise Credential
            </span>
          </div>
        </div>
        <button
          onClick={onHide}
          className="btn btn-sm btn-light border-0 p-1.5 rounded-circle text-muted"
          style={{ width: '30px', height: '30px' }}
        >
          <X size={18} />
        </button>
      </Modal.Header>

      <Modal.Body className="p-4 d-flex flex-column align-items-center bg-white">
        {loading ? (
          <div className="py-5 text-center">
            <Spinner animation="border" variant="primary" />
            <p className="text-muted mt-2 mb-0" style={{ fontSize: '13px' }}>
              Generating secure digital ID card...
            </p>
          </div>
        ) : error ? (
          <div className="w-100 py-4 text-center">
            <Alert variant="danger" className="text-start mb-3" style={{ fontSize: '13px' }}>
              {error}
            </Alert>
            <Button variant="outline-primary" size="sm" onClick={() => employeeId && fetchEmployeeCard(employeeId)}>
              Retry
            </Button>
          </div>
        ) : cardData ? (
          <DigitalIdCard
            employee={cardData.employee}
            company={cardData.company}
            qrCodeDataUrl={cardData.qrCodeDataUrl}
            apiBaseUrl={apiBaseUrl}
            token={token}
          />
        ) : null}
      </Modal.Body>
    </Modal>
  );
}
