import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CustomAlert as Alert } from './CustomAlert';
import { getIdCard, resolvePhotoUrl, getDownloadIdCardPdfUrl } from '../api/profileApi';

interface DigitalIdCardModalProps {
  visible: boolean;
  onClose: () => void;
  token?: string | null;
}

export const DigitalIdCardModal: React.FC<DigitalIdCardModalProps> = ({
  visible,
  onClose,
  token
}) => {
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (visible && token) {
      loadCardData();
    }
  }, [visible, token]);

  const loadCardData = async () => {
    if (!token) return;
    setLoading(true);
    const res = await getIdCard(token);
    if (res.success && res.data) {
      setCardData(res.data);
    } else {
      Alert.alert('Error', res.error?.message || 'Failed to load ID card.');
    }
    setLoading(false);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleDownloadSharePdf = async () => {
    if (!token || !cardData) return;
    setDownloading(true);
    try {
      const pdfUrl = getDownloadIdCardPdfUrl();
      const filename = `Falcon_ID_Card_${cardData.employee?.employeeId || 'EMP'}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (downloadResult.status === 200) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Download / Share Falcon ID Card'
          });
        } else {
          Alert.alert('Download Complete', `ID Card saved to: ${downloadResult.uri}`);
        }
      } else {
        Alert.alert('Download Failed', 'Could not generate official ID card PDF.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Network error while downloading ID card.');
    } finally {
      setDownloading(false);
    }
  };

  const employee = cardData?.employee;
  const company = cardData?.company;
  const photoUri = employee?.profilePhotoUrl ? resolvePhotoUrl(employee.profilePhotoUrl) : null;
  const initials = employee?.name
    ? employee.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'EMP';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.badgeIcon}>
                <Ionicons name="card" size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Official Employee ID Card</Text>
                <Text style={styles.modalSubtitle}>Falcon Info Solutions Enterprise</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Modal Body */}
          <ScrollView
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Generating secure digital credential...</Text>
              </View>
            ) : employee ? (
              <>
                {/* ID Card Container */}
                <View style={styles.cardContainer}>
                  {!isFlipped ? (
                    /* ======================================================== */
                    /* FRONT SIDE                                               */
                    /* ======================================================== */
                    <View style={styles.cardFace}>
                      {/* Top Header */}
                      <View style={styles.cardHeaderNavy}>
                        <View style={styles.cardHeaderContent}>
                          <Image
                            source={require('../../assets/icon.png')}
                            style={styles.logoImage}
                            resizeMode="contain"
                          />
                          <View>
                            <Text style={styles.companyNameText}>FALCON INFO SOLUTIONS</Text>
                            <Text style={styles.companySubText}>ENTERPRISE IDENTIFICATION</Text>
                          </View>
                        </View>
                      </View>

                      {/* Photo & Name Section */}
                      <View style={styles.photoSection}>
                        <View style={styles.photoBorder}>
                          {photoUri ? (
                            <Image source={{ uri: photoUri }} style={styles.photoImage} />
                          ) : (
                            <View style={styles.photoPlaceholder}>
                              <Text style={styles.initialsText}>{initials}</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.employeeNameText}>{employee.name}</Text>
                        <Text style={styles.designationText}>{employee.designation || 'Staff'}</Text>

                        {/* Attendance Mode Badge */}
                        <View style={[
                          styles.modeBadge,
                          employee.attendanceMode === 'Field' ? styles.modeBadgeField : styles.modeBadgeOffice
                        ]}>
                          <Ionicons
                            name={employee.attendanceMode === 'Field' ? 'navigate' : 'business'}
                            size={11}
                            color={employee.attendanceMode === 'Field' ? '#92400E' : '#166534'}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[
                            styles.modeBadgeText,
                            employee.attendanceMode === 'Field' ? styles.modeBadgeTextField : styles.modeBadgeTextOffice
                          ]}>
                            {employee.attendanceMode === 'Field' ? 'FIELD EMPLOYEE' : 'OFFICE EMPLOYEE'}
                          </Text>
                        </View>
                      </View>

                      {/* Details Box */}
                      <View style={styles.detailsBox}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>EMPLOYEE ID</Text>
                          <Text style={styles.detailValueBold}>{employee.employeeId}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>DESIGNATION</Text>
                          <Text style={styles.detailValue}>{employee.designation || 'Staff'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>DEPARTMENT</Text>
                          <Text style={styles.detailValue}>{employee.department || 'General'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>MOBILE NO.</Text>
                          <Text style={styles.detailValue}>{employee.phone || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>BLOOD GROUP</Text>
                          <Text style={styles.detailValue}>{employee.bloodGroup && employee.bloodGroup !== 'Not Specified' ? employee.bloodGroup : (employee.bloodGroup || 'N/A')}</Text>
                        </View>
                        <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                          <Text style={styles.detailLabel}>JOINING DATE</Text>
                          <Text style={styles.detailValue}>{employee.joiningDate || 'N/A'}</Text>
                        </View>
                      </View>

                      {/* Card Footer */}
                      <View style={styles.cardFooter}>
                        <Text style={styles.cardFooterText}>Falcon Info Solutions Pvt. Ltd.</Text>
                      </View>
                    </View>
                  ) : (
                    /* ======================================================== */
                    /* BACK SIDE                                                */
                    /* ======================================================== */
                    <View style={styles.cardFace}>
                      {/* Back Header */}
                      <View style={styles.cardHeaderNavy}>
                        <Text style={styles.backHeaderTitle}>OFFICIAL VERIFICATION</Text>
                        <Text style={styles.backHeaderSub}>SECURE QR CREDENTIAL</Text>
                      </View>

                      {/* Back Body */}
                      <View style={styles.backBody}>
                        {/* QR Code Container */}
                        <View style={styles.qrContainer}>
                          {cardData?.qrCodeDataUrl ? (
                            <Image
                              source={{ uri: cardData.qrCodeDataUrl }}
                              style={styles.qrImage}
                              resizeMode="contain"
                            />
                          ) : (
                            <Ionicons name="qr-code-outline" size={80} color="#64748B" />
                          )}
                          <Text style={styles.qrInstruction}>SCAN TO VERIFY CREDENTIALS</Text>
                          <Text style={styles.verificationCodeText}>{employee.verificationId}</Text>
                        </View>

                        {/* Company Details Box */}
                        <View style={styles.backDetailsBox}>
                          <View style={styles.backDetailRow}>
                            <Ionicons name="globe-outline" size={13} color="#2563EB" style={{ marginRight: 6 }} />
                            <Text style={styles.backDetailText}>{company?.website || 'www.falconinfosolutions.com'}</Text>
                          </View>
                          <View style={styles.backDetailRow}>
                            <Ionicons name="mail-outline" size={13} color="#2563EB" style={{ marginRight: 6 }} />
                            <Text style={styles.backDetailText}>{company?.email || 'hr@falconinfosolutions.com'}</Text>
                          </View>
                          <View style={styles.backDetailRow}>
                            <Ionicons name="call-outline" size={13} color="#DC2626" style={{ marginRight: 6 }} />
                            <Text style={styles.backDetailText}>
                              Emergency: <Text style={{ color: '#DC2626', fontWeight: '700' }}>{employee.emergencyContactPhone || company?.phone || '+91 98765 43210'}</Text>
                            </Text>
                          </View>
                          <View style={styles.backDetailRow}>
                            <Ionicons name="business-outline" size={13} color="#2563EB" style={{ marginRight: 6 }} />
                            <Text style={[styles.backDetailText, { fontSize: 10 }]}>
                              {company?.officeAddress || 'Falcon Info Solutions HQ, Sector 62, Noida, UP - 201309'}
                            </Text>
                          </View>
                        </View>

                        {/* Emergency Return Notice */}
                        <View style={styles.returnNoticeBox}>
                          <Text style={styles.returnNoticeText}>
                            "{company?.emergencyMessage || 'If found, please return this card to Falcon Info Solutions Pvt. Ltd.'}"
                          </Text>
                        </View>
                      </View>

                      {/* Card Footer */}
                      <View style={styles.cardFooter}>
                        <Text style={styles.cardFooterText}>Property of Falcon Info Solutions Pvt. Ltd.</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Flip & Download Controls */}
                <View style={styles.controlsRow}>
                  <TouchableOpacity
                    style={styles.flipBtn}
                    onPress={handleFlip}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="sync-outline" size={17} color="#2563EB" style={{ marginRight: 6 }} />
                    <Text style={styles.flipBtnText}>
                      {isFlipped ? 'Show Front Side' : 'Show Back Side'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.downloadBtn}
                    onPress={handleDownloadSharePdf}
                    disabled={downloading}
                    activeOpacity={0.8}
                  >
                    {downloading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.downloadBtnText}>Share / Save PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    width: '100%',
    maxWidth: 360,
    maxHeight: '92%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  scrollBody: {
    padding: 16,
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 12,
  },
  cardContainer: {
    width: 300,
    minHeight: 476,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardFace: {
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  cardHeaderNavy: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 3,
    borderBottomColor: '#2563EB',
    alignItems: 'center',
  },
  cardHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 24,
    height: 24,
  },
  companyNameText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  companySubText: {
    color: '#94A3B8',
    fontSize: 7.5,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  photoSection: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  photoBorder: {
    width: 84,
    height: 84,
    borderRadius: 16,
    padding: 3,
    backgroundColor: '#2563EB',
    marginBottom: 8,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2563EB',
  },
  employeeNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  designationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 2,
    textAlign: 'center',
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
  },
  modeBadgeOffice: {
    backgroundColor: '#DCFCE7',
  },
  modeBadgeField: {
    backgroundColor: '#FEF3C7',
  },
  modeBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modeBadgeTextOffice: {
    color: '#166534',
  },
  modeBadgeTextField: {
    color: '#92400E',
  },
  detailsBox: {
    marginHorizontal: 14,
    marginVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#0F172A',
  },
  detailValueBold: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardFooter: {
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: '#2563EB',
  },
  cardFooterText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Back Side Styles
  backHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  backHeaderSub: {
    color: '#94A3B8',
    fontSize: 7.5,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  backBody: {
    padding: 12,
    alignItems: 'center',
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 8,
  },
  qrImage: {
    width: 95,
    height: 95,
  },
  qrInstruction: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
  },
  verificationCodeText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  backDetailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  backDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backDetailText: {
    fontSize: 10,
    color: '#334155',
    flex: 1,
  },
  returnNoticeBox: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    padding: 6,
    marginTop: 6,
    alignItems: 'center',
  },
  returnNoticeText: {
    color: '#1E40AF',
    fontSize: 8.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 12,
  },

  // Controls
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    width: 300,
  },
  flipBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 12,
  },
  flipBtnText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 12,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
