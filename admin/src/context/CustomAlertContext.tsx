import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertButton {
  text: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface AlertConfig {
  title: string;
  message?: string;
  type?: AlertType;
  badge?: string;
  buttons?: AlertButton[];
  onClose?: () => void;
}

interface CustomAlertContextType {
  showAlert: (config: AlertConfig) => void;
  hideAlert: () => void;
}

const CustomAlertContext = createContext<CustomAlertContextType | undefined>(undefined);

let globalAlert: ((config: AlertConfig) => void) | null = null;

function inferAlertType(title: string, message?: string): { type: AlertType; badge: string } {
  const combined = `${title || ''} ${message || ''}`.toLowerCase();

  if (combined.includes('success') || combined.includes('approved') || combined.includes('updated') || combined.includes('saved') || combined.includes('confirmed')) {
    return { type: 'success', badge: 'Success' };
  }

  if (combined.includes('error') || combined.includes('failed') || combined.includes('could not') || combined.includes('network error') || combined.includes('cannot')) {
    return { type: 'error', badge: 'Notice' };
  }

  if (combined.includes('warning') || combined.includes('required') || combined.includes('must') || combined.includes('please') || combined.includes('invalid') || combined.includes('are you sure')) {
    return { type: 'warning', badge: 'Attention' };
  }

  return { type: 'info', badge: 'Information' };
}

export const CustomAlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AlertConfig | null>(null);

  const showAlert = useCallback((newConfig: AlertConfig) => {
    setConfig(newConfig);
  }, []);

  const hideAlert = useCallback(() => {
    setConfig(null);
  }, []);

  useEffect(() => {
    globalAlert = showAlert;

    // Safely override window.alert so all native browser popups become custom white modals
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      const messageStr = String(msg ?? '');
      const inferred = inferAlertType('Notification', messageStr);
      showAlert({
        title: inferred.type === 'error' ? 'Notice' : (inferred.type === 'success' ? 'Success' : 'Notice'),
        message: messageStr,
        type: inferred.type,
        badge: inferred.badge,
        buttons: [{ text: 'OK', variant: inferred.type === 'success' ? 'primary' : (inferred.type === 'error' ? 'danger' : 'primary') }]
      });
    };

    return () => {
      globalAlert = null;
      window.alert = originalAlert;
    };
  }, [showAlert]);

  const handleClose = () => {
    if (config?.onClose) {
      config.onClose();
    }
    hideAlert();
  };

  const inferred = config ? inferAlertType(config.title, config.message) : { type: 'info' as AlertType, badge: 'Info' };
  const finalType = config?.type || inferred.type;
  const finalBadge = config?.badge || inferred.badge;

  const getBadgeDetails = () => {
    switch (finalType) {
      case 'success':
        return {
          bg: '#DCFCE7',
          color: '#15803D',
          border: '#BBF7D0',
          icon: <CheckCircle2 size={16} color="#15803D" className="me-1.5" />,
        };
      case 'error':
        return {
          bg: '#FEE2E2',
          color: '#B91C1C',
          border: '#FECACA',
          icon: <XCircle size={16} color="#B91C1C" className="me-1.5" />,
        };
      case 'warning':
        return {
          bg: '#FEF3C7',
          color: '#B45309',
          border: '#FDE68A',
          icon: <AlertCircle size={16} color="#B45309" className="me-1.5" />,
        };
      case 'info':
      default:
        return {
          bg: '#DBEAFE',
          color: '#1D4ED8',
          border: '#BFDBFE',
          icon: <Info size={16} color="#1D4ED8" className="me-1.5" />,
        };
    }
  };

  const badgeDetails = getBadgeDetails();
  const buttons = config?.buttons && config.buttons.length > 0
    ? config.buttons
    : [{ text: 'OK', variant: 'primary' as const }];

  return (
    <CustomAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}

      {config && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.15s ease-out',
          }}
          onClick={handleClose}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '24px',
              width: '100%',
              maxWidth: '390px',
              boxShadow: '0 20px 35px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
              animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Title + Close Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <h5 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>
                {config.title}
              </h5>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Status Pill Badge (Identical to Mobile Custom Alert) */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: badgeDetails.bg,
                color: badgeDetails.color,
                border: `1px solid ${badgeDetails.border}`,
                borderRadius: '10px',
                padding: '5px 12px',
                fontSize: '13px',
                fontWeight: 700,
                marginBottom: '14px',
                gap: '6px',
              }}
            >
              {badgeDetails.icon}
              <span>{finalBadge}</span>
            </div>

            {/* Message Body */}
            {config.message && (
              <p
                style={{
                  fontSize: '14.5px',
                  color: '#475569',
                  lineHeight: '1.5',
                  marginBottom: '22px',
                  whiteSpace: 'pre-line',
                }}
              >
                {config.message}
              </p>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: buttons.length === 1 ? 'stretch' : 'flex-end' }}>
              {buttons.map((btn, idx) => {
                const isSingle = buttons.length === 1;
                const isDanger = btn.variant === 'danger';
                const isSecondary = btn.variant === 'secondary';

                let bg = '#2563EB';
                let color = '#FFFFFF';
                let border = 'none';

                if (isSecondary) {
                  bg = '#F1F5F9';
                  color = '#475569';
                  border = '1px solid #CBD5E1';
                } else if (isDanger) {
                  bg = '#DC2626';
                  color = '#FFFFFF';
                } else if (finalType === 'success') {
                  bg = '#16A34A';
                  color = '#FFFFFF';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    style={{
                      flex: isSingle ? 1 : '0 1 auto',
                      minWidth: isSingle ? '100%' : '100px',
                      backgroundColor: bg,
                      color: color,
                      border: border,
                      borderRadius: '12px',
                      padding: '11px 18px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                    }}
                    onClick={() => {
                      hideAlert();
                      if (btn.onClick) {
                        btn.onClick();
                      }
                    }}
                  >
                    {btn.text}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </CustomAlertContext.Provider>
  );
};

export const useCustomAlert = () => {
  const ctx = useContext(CustomAlertContext);
  if (!ctx) throw new Error('useCustomAlert must be used within CustomAlertProvider');
  return ctx;
};

export const CustomAlert = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => {
    if (globalAlert) {
      globalAlert({ title, message, buttons });
    } else {
      window.alert(`${title}\n\n${message || ''}`);
    }
  },
  show: (config: AlertConfig) => {
    if (globalAlert) {
      globalAlert(config);
    }
  },
};
