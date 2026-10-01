import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { Download, ExternalLink, FileText, Image as ImageIcon, X } from 'lucide-react';

interface ReceiptViewerModalProps {
  show: boolean;
  onHide: () => void;
  receiptUrl?: string | null;
  title?: string;
  amount?: number | string;
  category?: string;
  employeeName?: string;
}

export default function ReceiptViewerModal({
  show,
  onHide,
  receiptUrl,
  title = 'Receipt / Invoice Preview',
  amount,
  category,
  employeeName
}: ReceiptViewerModalProps) {
  if (!receiptUrl) return null;

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const fullUrl = receiptUrl.startsWith('http') ? receiptUrl : `${API_URL}${receiptUrl.startsWith('/') ? '' : '/'}${receiptUrl}`;
  const isPdf = receiptUrl.toLowerCase().endsWith('.pdf');

  return (
    <Modal show={show} onHide={onHide} size="lg" centered contentClassName="border-0 shadow-lg rounded-4 overflow-hidden">
      <Modal.Header className="bg-light border-0 py-3 px-4 d-flex align-items-center justify-content-between">
        <div>
          <Modal.Title style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            {title}
          </Modal.Title>
          <div className="d-flex align-items-center gap-2 mt-0.5" style={{ fontSize: '12px', color: '#64748B' }}>
            {employeeName && <span>Employee: <strong>{employeeName}</strong></span>}
            {category && <span>• Category: <strong>{category}</strong></span>}
            {amount && <span>• Amount: <strong className="text-primary">₹{Number(amount).toLocaleString('en-IN')}</strong></span>}
          </div>
        </div>

        <div className="d-flex align-items-center gap-1.5">
          <a
            href={fullUrl}
            target="_blank"
            rel="noreferrer"
            download
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 px-2.5 py-1"
            style={{ fontSize: '12px' }}
          >
            <Download size={14} />
            <span>Download</span>
          </a>

          <button
            onClick={onHide}
            className="btn btn-sm btn-light border-0 p-1.5 rounded-circle text-muted ms-1"
            style={{ width: '30px', height: '30px' }}
          >
            <X size={18} />
          </button>
        </div>
      </Modal.Header>

      <Modal.Body className="p-0 bg-dark d-flex align-items-center justify-content-center" style={{ minHeight: '450px', maxHeight: '75vh' }}>
        {isPdf ? (
          <iframe
            src={fullUrl}
            title="Receipt Document"
            style={{ width: '100%', height: '70vh', border: 'none' }}
          />
        ) : (
          <div className="p-3 text-center w-100 h-100 overflow-auto d-flex align-items-center justify-content-center">
            <img
              src={fullUrl}
              alt="Receipt"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            />
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
