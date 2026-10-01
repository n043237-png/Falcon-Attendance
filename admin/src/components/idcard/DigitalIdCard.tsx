import React, { useState, useRef } from 'react';
import { Badge, Button, Spinner, Dropdown } from 'react-bootstrap';
import {
  RotateCw,
  Download,
  Printer,
  ShieldCheck,
  Building2,
  Mail,
  Globe,
  Phone,
  Calendar,
  HeartPulse,
  ExternalLink,
  CheckCircle2,
  Copy,
  Sparkles,
  QrCode as QrIcon
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface IdCardEmployeeData {
  id: number;
  employeeId: string;
  employeeCode?: string;
  name: string;
  email?: string;
  phone?: string;
  department: string;
  designation: string;
  attendanceMode: string;
  bloodGroup: string;
  joiningDate: string;
  profilePhotoUrl: string | null;
  emergencyContactPhone?: string;
  emergencyContactName?: string;
  verificationId?: string;
}

export interface IdCardCompanyData {
  name: string;
  shortName: string;
  website: string;
  email: string;
  phone: string;
  officeAddress: string;
  emergencyMessage: string;
  logoUrl?: string;
}

interface DigitalIdCardProps {
  employee: IdCardEmployeeData;
  company?: IdCardCompanyData;
  qrCodeDataUrl?: string;
  apiBaseUrl?: string;
  token?: string;
  showActions?: boolean;
}

export const defaultCompany: IdCardCompanyData = {
  name: 'Falcon Info Solutions Pvt. Ltd.',
  shortName: 'Falcon Info Solutions',
  website: 'www.falconinfosolutions.com',
  email: 'hr@falconinfosolutions.com',
  phone: '+91 120 4567890',
  officeAddress: 'Falcon Info Solutions HQ, Sector 62, Noida, UP - 201309',
  emergencyMessage: 'If found, please return this card to Falcon Info Solutions Pvt. Ltd.',
  logoUrl: '/logo.png'
};

export default function DigitalIdCard({
  employee,
  company = defaultCompany,
  qrCodeDataUrl,
  apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000',
  token,
  showActions = true
}: DigitalIdCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  const verificationId =
    employee.verificationId ||
    `FALCON-VERIFY-${employee.id}-${(employee.employeeId || 'EMP').toUpperCase()}`;

  const verifyUrl = `${window.location.origin}/verify-id/${verificationId}`;

  // Image source resolution
  const photoUrl = employee.profilePhotoUrl
    ? employee.profilePhotoUrl.startsWith('http')
      ? employee.profilePhotoUrl
      : `${apiBaseUrl}${employee.profilePhotoUrl.startsWith('/') ? '' : '/'}${employee.profilePhotoUrl}`
    : null;

  const initials = employee.name
    ? employee.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'EMP';

  // Flip card
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  // Copy Verification Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(verifyUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Download PNG (Front or Back or Both)
  const handleDownloadPNG = async (side: 'front' | 'back' | 'both' = 'both') => {
    setDownloading(true);
    try {
      if (side === 'front' && frontRef.current) {
        const canvas = await html2canvas(frontRef.current, { scale: 3, useCORS: true, backgroundColor: null });
        triggerDownload(canvas.toDataURL('image/png'), `ID_Card_${employee.employeeId}_Front.png`);
      } else if (side === 'back' && backRef.current) {
        const canvas = await html2canvas(backRef.current, { scale: 3, useCORS: true, backgroundColor: null });
        triggerDownload(canvas.toDataURL('image/png'), `ID_Card_${employee.employeeId}_Back.png`);
      } else if (frontRef.current && backRef.current) {
        // Render both side-by-side onto a composite canvas
        const canvasFront = await html2canvas(frontRef.current, { scale: 3, useCORS: true, backgroundColor: null });
        const canvasBack = await html2canvas(backRef.current, { scale: 3, useCORS: true, backgroundColor: null });

        const combinedCanvas = document.createElement('canvas');
        const gap = 40;
        combinedCanvas.width = canvasFront.width + canvasBack.width + gap;
        combinedCanvas.height = Math.max(canvasFront.height, canvasBack.height);
        const ctx = combinedCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvasFront, 0, 0);
          ctx.drawImage(canvasBack, canvasFront.width + gap, 0);
          triggerDownload(combinedCanvas.toDataURL('image/png'), `ID_Card_${employee.employeeId}_Complete.png`);
        }
      }
    } catch (err) {
      console.error('Failed to export ID Card PNG:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Download PDF (Server official PDF or client fallback)
  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      // Attempt backend high-resolution vector PDF download if token available
      if (token) {
        const downloadUrl = `${apiBaseUrl}/api/profile/id-card/pdf`;
        const res = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Falcon_ID_Card_${employee.employeeId}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          setDownloading(false);
          return;
        }
      }

      // Client-side fallback using jsPDF
      if (frontRef.current && backRef.current) {
        const canvasFront = await html2canvas(frontRef.current, { scale: 3, useCORS: true });
        const canvasBack = await html2canvas(backRef.current, { scale: 3, useCORS: true });

        // CR80 dimensions in mm: 54mm x 85.6mm portrait
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [54, 86]
        });

        const imgFront = canvasFront.toDataURL('image/png');
        pdf.addImage(imgFront, 'PNG', 0, 0, 54, 86);

        pdf.addPage([54, 86], 'portrait');
        const imgBack = canvasBack.toDataURL('image/png');
        pdf.addImage(imgBack, 'PNG', 0, 0, 54, 86);

        pdf.save(`Falcon_ID_Card_${employee.employeeId}.pdf`);
      }
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Direct Print
  const handlePrint = () => {
    window.print();
  };

  const triggerDownload = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="digital-id-card-wrapper d-flex flex-column align-items-center">
      {/* 3D Flip Card Container */}
      <div
        className="id-card-perspective-container"
        style={{
          perspective: '1200px',
          width: '320px',
          height: '500px',
          position: 'relative'
        }}
      >
        <div
          className="id-card-flipper"
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.65s cubic-bezier(0.4, 0.2, 0.2, 1)',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
        >
          {/* ============================================================== */}
          {/* FRONT SIDE                                                     */}
          {/* ============================================================== */}
          <div
            ref={frontRef}
            className="id-card-face id-card-front shadow-lg"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              borderRadius: '20px',
              overflow: 'hidden',
              background: '#FFFFFF',
              boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Top Navy Header with Gradient & Hologram Accent */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 70%, #0F172A 100%)',
                padding: '16px 14px 12px 14px',
                position: 'relative',
                textAlign: 'center',
                borderBottom: '3px solid #2563EB'
              }}
            >
              {/* Subtle background security pattern */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.06,
                  backgroundImage: 'radial-gradient(#FFFFFF 1px, transparent 1px)',
                  backgroundSize: '10px 10px',
                  pointerEvents: 'none'
                }}
              />

              {/* Company Logo & Name */}
              <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                <img
                  src={company.logoUrl || '/logo.png'}
                  alt="Falcon Logo"
                  style={{ width: '28px', height: '28px', objectFit: 'contain' }}
                  onError={(e: any) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div style={{ textAlign: 'left' }}>
                  <div
                    style={{
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 800,
                      letterSpacing: '0.8px',
                      lineHeight: 1.1,
                      textTransform: 'uppercase'
                    }}
                  >
                    Falcon Info Solutions
                  </div>
                  <div
                    style={{
                      color: '#94A3B8',
                      fontSize: '8px',
                      letterSpacing: '1px',
                      fontWeight: 600
                    }}
                  >
                    ENTERPRISE IDENTIFICATION
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Photo & Name Section */}
            <div
              className="d-flex flex-column align-items-center"
              style={{ padding: '16px 16px 8px 16px', position: 'relative' }}
            >
              {/* Profile Photo */}
              <div
                style={{
                  width: '92px',
                  height: '92px',
                  borderRadius: '16px',
                  padding: '3px',
                  background: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)',
                  boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.35)',
                  marginBottom: '10px'
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '13px',
                    overflow: 'hidden',
                    background: '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={employee.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e: any) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `<span style="font-size:24px;font-weight:700;color:#2563EB;">${initials}</span>`;
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '26px', fontWeight: 800, color: '#2563EB' }}>
                      {initials}
                    </span>
                  )}
                </div>
              </div>

              {/* Employee Name */}
              <h5
                className="fw-bold mb-0 text-center"
                style={{
                  color: '#0F172A',
                  fontSize: '16px',
                  letterSpacing: '-0.3px',
                  lineHeight: 1.2
                }}
              >
                {employee.name}
              </h5>

              {/* Designation */}
              <div
                style={{
                  color: '#2563EB',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  marginTop: '2px',
                  textAlign: 'center'
                }}
              >
                {employee.designation || 'Staff'}
              </div>

              {/* Attendance Mode Pill Badge */}
              <div className="mt-1">
                {employee.attendanceMode === 'Field' ? (
                  <Badge
                    bg="warning"
                    className="text-dark px-2.5 py-1"
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.4px',
                      borderRadius: '12px'
                    }}
                  >
                    FIELD EMPLOYEE
                  </Badge>
                ) : (
                  <Badge
                    bg="success"
                    className="px-2.5 py-1"
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.4px',
                      borderRadius: '12px',
                      backgroundColor: '#16A34A'
                    }}
                  >
                    OFFICE EMPLOYEE
                  </Badge>
                )}
              </div>
            </div>

            {/* Specifications Table */}
            <div
              style={{
                flex: 1,
                padding: '4px 18px 8px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  background: '#F8FAFC',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  border: '1px solid #E2E8F0'
                }}
              >
                <div className="row g-1.5" style={{ fontSize: '11.5px' }}>
                  <div className="col-5 text-muted fw-semibold">Employee ID</div>
                  <div className="col-7 text-dark fw-bold text-end" style={{ letterSpacing: '0.3px' }}>
                    {employee.employeeId || `EMP${employee.id}`}
                  </div>

                  <div className="col-5 text-muted fw-semibold">Department</div>
                  <div className="col-7 text-dark fw-semibold text-end text-truncate" title={employee.department}>
                    {employee.department || 'General'}
                  </div>

                  <div className="col-5 text-muted fw-semibold">Blood Group</div>
                  <div className="col-7 fw-bold text-end" style={{ color: '#DC2626' }}>
                    <HeartPulse size={12} className="me-1 inline" style={{ display: 'inline', verticalAlign: '-1px' }} />
                    {employee.bloodGroup && employee.bloodGroup !== 'Not Specified' ? employee.bloodGroup : 'N/A'}
                  </div>

                  <div className="col-5 text-muted fw-semibold">Joining Date</div>
                  <div className="col-7 text-dark fw-semibold text-end">
                    {employee.joiningDate || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Front Card Footer */}
            <div
              style={{
                background: '#0F172A',
                padding: '9px 12px',
                textAlign: 'center',
                borderTop: '2px solid #2563EB',
                marginTop: 'auto'
              }}
            >
              <div
                style={{
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.5px'
                }}
              >
                {company.name}
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* BACK SIDE                                                      */}
          {/* ============================================================== */}
          <div
            ref={backRef}
            className="id-card-face id-card-back shadow-lg"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              borderRadius: '20px',
              overflow: 'hidden',
              background: '#FFFFFF',
              boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)',
              transform: 'rotateY(180deg)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Back Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                padding: '12px 14px',
                textAlign: 'center',
                borderBottom: '3px solid #2563EB'
              }}
            >
              <div
                style={{
                  color: '#FFFFFF',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase'
                }}
              >
                Official Verification
              </div>
              <div
                style={{
                  color: '#94A3B8',
                  fontSize: '8px',
                  letterSpacing: '0.5px'
                }}
              >
                SECURE QR CREDENTIAL
              </div>
            </div>

            {/* Back Body Content */}
            <div
              className="d-flex flex-column align-items-center"
              style={{ padding: '12px 16px', flex: 1, justifyContent: 'space-between' }}
            >
              {/* QR Code Container */}
              <div
                style={{
                  padding: '8px',
                  borderRadius: '12px',
                  background: '#FFFFFF',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Employee Verification QR Code"
                    style={{ width: '110px', height: '110px', objectFit: 'contain' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '110px',
                      height: '110px',
                      background: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <QrIcon size={44} className="text-muted" />
                  </div>
                )}
                <div
                  style={{
                    fontSize: '8px',
                    fontWeight: 700,
                    color: '#64748B',
                    letterSpacing: '0.3px',
                    marginTop: '4px'
                  }}
                >
                  SCAN TO VERIFY EMPLOYEE
                </div>
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#0F172A',
                    fontFamily: 'monospace'
                  }}
                >
                  {verificationId}
                </div>
              </div>

              {/* Company & Emergency Details Box */}
              <div
                style={{
                  width: '100%',
                  background: '#F8FAFC',
                  borderRadius: '12px',
                  padding: '9px 12px',
                  border: '1px solid #E2E8F0',
                  marginTop: '8px'
                }}
              >
                <div className="d-flex flex-column gap-1.5" style={{ fontSize: '10.5px' }}>
                  <div className="d-flex align-items-center gap-2">
                    <Globe size={12} className="text-primary flex-shrink-0" />
                    <span className="text-dark fw-medium text-truncate">{company.website}</span>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <Mail size={12} className="text-primary flex-shrink-0" />
                    <span className="text-dark fw-medium text-truncate">{company.email}</span>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <Phone size={12} className="text-danger flex-shrink-0" />
                    <div className="text-truncate">
                      <span className="text-muted">Emergency: </span>
                      <strong className="text-danger">
                        {employee.emergencyContactPhone || company.phone}
                      </strong>
                    </div>
                  </div>

                  <div className="d-flex align-items-start gap-2">
                    <Building2 size={12} className="text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted" style={{ fontSize: '9.5px', lineHeight: 1.3 }}>
                      {company.officeAddress}
                    </span>
                  </div>
                </div>
              </div>

              {/* Emergency Return Notice */}
              <div
                style={{
                  width: '100%',
                  background: '#EFF6FF',
                  border: '1px dashed #93C5FD',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  textAlign: 'center',
                  marginTop: '6px'
                }}
              >
                <p
                  className="mb-0 fw-semibold"
                  style={{
                    color: '#1E40AF',
                    fontSize: '9px',
                    lineHeight: 1.3
                  }}
                >
                  "{company.emergencyMessage}"
                </p>
              </div>
            </div>

            {/* Back Card Footer */}
            <div
              style={{
                background: '#0F172A',
                padding: '7px 12px',
                textAlign: 'center',
                borderTop: '2px solid #2563EB',
                marginTop: 'auto'
              }}
            >
              <div
                style={{
                  color: '#94A3B8',
                  fontSize: '8.5px',
                  fontWeight: 500
                }}
              >
                Property of Falcon Info Solutions Pvt. Ltd.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Actions */}
      {showActions && (
        <div className="id-card-actions-panel mt-3 d-flex flex-column align-items-center gap-2 w-100" style={{ maxWidth: '340px' }}>
          {/* Flip Toggle Button */}
          <Button
            variant="outline-primary"
            className="d-flex align-items-center justify-content-center gap-2 w-100 py-2 shadow-sm rounded-3"
            onClick={handleFlip}
            style={{ fontWeight: 600, fontSize: '13.5px' }}
          >
            <RotateCw size={16} />
            <span>{isFlipped ? 'Flip to Front Side' : 'Flip to Back Side'}</span>
          </Button>

          {/* Download & Print Buttons Row */}
          <div className="d-flex gap-2 w-100">
            <Dropdown className="flex-fill">
              <Dropdown.Toggle
                variant="primary"
                className="w-100 d-flex align-items-center justify-content-center gap-1.5 py-2 shadow-sm rounded-3"
                disabled={downloading}
                style={{ fontWeight: 600, fontSize: '13px', backgroundColor: '#2563EB', borderColor: '#2563EB' }}
              >
                {downloading ? <Spinner size="sm" animation="border" /> : <Download size={15} />}
                <span>Download</span>
              </Dropdown.Toggle>

              <Dropdown.Menu className="shadow border-0 rounded-3">
                <Dropdown.Item onClick={() => handleDownloadPNG('both')} className="py-2" style={{ fontSize: '13px' }}>
                  Download Complete PNG (Front & Back)
                </Dropdown.Item>
                <Dropdown.Item onClick={() => handleDownloadPNG('front')} className="py-2" style={{ fontSize: '13px' }}>
                  Download Front Side PNG
                </Dropdown.Item>
                <Dropdown.Item onClick={() => handleDownloadPNG('back')} className="py-2" style={{ fontSize: '13px' }}>
                  Download Back Side PNG
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleDownloadPDF} className="py-2 fw-semibold text-primary" style={{ fontSize: '13px' }}>
                  Download Print-Ready PDF
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>

            <Button
              variant="outline-secondary"
              className="d-flex align-items-center justify-content-center gap-1.5 px-3 py-2 shadow-sm rounded-3"
              onClick={handlePrint}
              style={{ fontWeight: 500, fontSize: '13px' }}
              title="Print ID Card"
            >
              <Printer size={16} />
              <span>Print</span>
            </Button>
          </div>

          {/* Copy Verification Link */}
          <Button
            variant="light"
            size="sm"
            className="d-flex align-items-center justify-content-center gap-1.5 text-muted border py-1.5 px-3 w-100 rounded-2"
            onClick={handleCopyLink}
            style={{ fontSize: '11.5px' }}
          >
            {copiedLink ? <CheckCircle2 size={13} className="text-success" /> : <Copy size={13} />}
            <span>{copiedLink ? 'Verification Link Copied!' : 'Copy Verification Link'}</span>
          </Button>
        </div>
      )}

      {/* Print CSS specific styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .id-card-face,
          .id-card-face * {
            visibility: visible;
          }
          .id-card-perspective-container {
            perspective: none !important;
            width: 100% !important;
            height: auto !important;
          }
          .id-card-flipper {
            transform: none !important;
          }
          .id-card-front, .id-card-back {
            position: relative !important;
            page-break-after: always;
            margin: 20px auto;
            transform: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .id-card-actions-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
