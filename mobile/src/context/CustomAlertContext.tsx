import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface CustomAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface CustomAlertOptions {
  cancelable?: boolean;
  type?: AlertType;
  badge?: string;
}

export interface CustomAlertConfig {
  title: string;
  message?: string;
  buttons?: CustomAlertButton[];
  type?: AlertType;
  badge?: string;
  cancelable?: boolean;
}

interface CustomAlertContextType {
  showAlert: (config: CustomAlertConfig) => void;
  hideAlert: () => void;
}

const CustomAlertContext = createContext<CustomAlertContextType | undefined>(undefined);

// Global static reference so CustomAlert.alert(...) can be called from anywhere without hooks
let globalAlertController: {
  show: (config: CustomAlertConfig) => void;
  hide: () => void;
} | null = null;

function inferAlertType(title: string, message?: string, buttons?: CustomAlertButton[]): { type: AlertType; badge: string } {
  const t = (title || '').toLowerCase();
  const m = (message || '').toLowerCase();

  // If there's a destructive button or multi-button question
  const hasDestructive = buttons?.some(b => b.style === 'destructive');

  if (t.includes('success') || t.includes('approved') || t.includes('confirmed') || t.includes('saved') || t.includes('reset')) {
    return { type: 'success', badge: 'Success' };
  }

  if (hasDestructive || t.includes('cancel request') || t.includes('delete') || t.includes('reject leave') || t.includes('are you sure')) {
    return { type: 'warning', badge: 'Confirmation' };
  }

  if (t.includes('cancelled') || t.includes('rejected') || t.includes('failed') || t.includes('error') || t.includes('denied')) {
    return { type: 'error', badge: t.includes('cancelled') ? 'Cancelled' : 'Notice' };
  }

  if (t.includes('warning') || t.includes('required') || t.includes('invalid') || t.includes('blocked') || t.includes('notice') || t.includes('incomplete') || t.includes('permission')) {
    return { type: 'warning', badge: 'Required' };
  }

  return { type: 'info', badge: 'Information' };
}

export function CustomAlertProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CustomAlertConfig | null>(null);

  const showAlert = useCallback((newConfig: CustomAlertConfig) => {
    setConfig(newConfig);
  }, []);

  const hideAlert = useCallback(() => {
    setConfig(null);
  }, []);

  useEffect(() => {
    globalAlertController = {
      show: showAlert,
      hide: hideAlert,
    };
    return () => {
      globalAlertController = null;
    };
  }, [showAlert, hideAlert]);

  const handleDismiss = () => {
    if (config?.cancelable !== false) {
      // If there is a cancel button, trigger its callback
      const cancelBtn = config?.buttons?.find(b => b.style === 'cancel');
      if (cancelBtn?.onPress) {
        cancelBtn.onPress();
      }
      hideAlert();
    }
  };

  const handleButtonPress = (btn: CustomAlertButton) => {
    hideAlert();
    if (btn.onPress) {
      // Delay slightly so modal dismiss animation doesn't conflict with subsequent actions
      setTimeout(() => {
        btn.onPress?.();
      }, 50);
    }
  };

  const renderedConfig = config;
  const inferred = renderedConfig
    ? inferAlertType(renderedConfig.title, renderedConfig.message, renderedConfig.buttons)
    : { type: 'info' as AlertType, badge: 'Info' };

  const finalType = renderedConfig?.type || inferred.type;
  const finalBadge = renderedConfig?.badge || inferred.badge;

  const getBadgeStyle = () => {
    switch (finalType) {
      case 'success':
        return {
          bg: '#DCFCE7',
          color: '#15803D',
          icon: 'checkmark-circle' as const,
        };
      case 'error':
        return {
          bg: '#FEE2E2',
          color: '#B91C1C',
          icon: 'close-circle' as const,
        };
      case 'warning':
        return {
          bg: '#FEF3C7',
          color: '#B45309',
          icon: 'alert-circle' as const,
        };
      case 'info':
      default:
        return {
          bg: '#DBEAFE',
          color: '#1D4ED8',
          icon: 'information-circle' as const,
        };
    }
  };

  const badgeStyle = getBadgeStyle();
  const buttons = renderedConfig?.buttons && renderedConfig.buttons.length > 0
    ? renderedConfig.buttons
    : [{ text: 'OK', style: 'default' as const }];

  return (
    <CustomAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {renderedConfig && (
        <Modal
          visible={!!renderedConfig}
          transparent
          animationType="fade"
          onRequestClose={handleDismiss}
        >
          <TouchableWithoutFeedback onPress={handleDismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalCard}>
                  {/* Top Header Row with Title and Close X Button */}
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle} numberOfLines={2}>
                      {renderedConfig.title}
                    </Text>
                    <TouchableOpacity
                      onPress={handleDismiss}
                      style={styles.modalCloseBtn}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={22} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  {/* Status Pill Badge (Identical to History Screen Popup) */}
                  <View style={[styles.modalStatusBadge, { backgroundColor: badgeStyle.bg }]}>
                    <Ionicons name={badgeStyle.icon} size={17} color={badgeStyle.color} />
                    <Text style={[styles.modalStatusText, { color: badgeStyle.color }]}>
                      {finalBadge}
                    </Text>
                  </View>

                  {/* Message Body */}
                  {!!renderedConfig.message && (
                    <Text style={styles.modalMessage}>{renderedConfig.message}</Text>
                  )}

                  {/* Action Buttons Row */}
                  <View
                    style={[
                      styles.buttonsContainer,
                      buttons.length > 2 && styles.buttonsStacked,
                    ]}
                  >
                    {buttons.map((btn, index) => {
                      const isCancel = btn.style === 'cancel';
                      const isDestructive = btn.style === 'destructive';
                      const isSingle = buttons.length === 1;

                      let btnBg = '#2563EB';
                      let textColor = '#FFFFFF';
                      let borderStyle = {};

                      if (isCancel) {
                        btnBg = '#F1F5F9';
                        textColor = '#475569';
                        borderStyle = { borderWidth: 1, borderColor: '#E2E8F0' };
                      } else if (isDestructive) {
                        btnBg = '#DC2626';
                        textColor = '#FFFFFF';
                      } else if (finalType === 'success') {
                        btnBg = '#16A34A';
                        textColor = '#FFFFFF';
                      }

                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.actionBtn,
                            isSingle && styles.actionBtnSingle,
                            !isSingle && buttons.length <= 2 && { flex: 1 },
                            { backgroundColor: btnBg },
                            borderStyle,
                          ]}
                          onPress={() => handleButtonPress(btn)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.actionBtnText,
                              { color: textColor },
                              isDestructive && { fontWeight: '700' },
                            ]}
                          >
                            {btn.text}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </CustomAlertContext.Provider>
  );
}

export function useCustomAlert(): CustomAlertContextType {
  const context = useContext(CustomAlertContext);
  if (!context) {
    throw new Error('useCustomAlert must be used within a CustomAlertProvider');
  }
  return context;
}

/**
 * Drop-in replacement for React Native's Alert.alert(...)
 * Can be called anywhere synchronously!
 */
export const CustomAlert = {
  alert: (
    title: string,
    message?: string,
    buttons?: CustomAlertButton[],
    options?: CustomAlertOptions
  ) => {
    if (globalAlertController) {
      globalAlertController.show({
        title,
        message,
        buttons,
        type: options?.type,
        badge: options?.badge,
        cancelable: options?.cancelable ?? true,
      });
    } else {
      console.warn('CustomAlertProvider is not mounted yet.');
    }
  },
  show: (config: CustomAlertConfig) => {
    if (globalAlertController) {
      globalAlertController.show(config);
    }
  },
  hide: () => {
    if (globalAlertController) {
      globalAlertController.hide();
    }
  },
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginRight: 10,
  },
  modalCloseBtn: {
    padding: 2,
    marginTop: -2,
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  modalStatusText: {
    marginLeft: 7,
    fontWeight: '700',
    fontSize: 13,
  },
  modalMessage: {
    fontSize: 14.5,
    color: '#475569',
    lineHeight: 21,
    marginBottom: 20,
    fontWeight: '400',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  buttonsStacked: {
    flexDirection: 'column',
  },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSingle: {
    width: '100%',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
