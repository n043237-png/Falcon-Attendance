import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile, changePassword, resolvePhotoUrl } from '../api/profileApi';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { token, logout, updateUser } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  // Modals
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forms
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const loadProfile = async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) {
      setRefreshing(true);
    } else if (!profile) {
      setLoading(true);
    }
    const res = await getProfile(token);
    if (res.success && res.data) {
      setProfile(res.data);
      setPhone(res.data.phone || '');
      setPhotoUrl(res.data.profilePhotoUrl || '');
      setImageError(false);
      if (res.data.profilePhotoUrl) {
        updateUser({
          profilePhotoUrl: res.data.profilePhotoUrl,
          profile_photo_url: res.data.profilePhotoUrl,
        });
      }
    }
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [token])
  );

  const handleSaveProfile = async () => {
    if (!token) return;
    setSaving(true);
    const res = await updateProfile(token, { phone, profilePhotoUrl: photoUrl });
    setSaving(false);
    if (res.success) {
      Alert.alert('Success', 'Profile updated successfully.');
      setShowEdit(false);
      loadProfile();
    } else {
      Alert.alert('Error', res.error?.message || 'Failed to update.');
    }
  };

  const handleChangePassword = async () => {
    if (!token) return;
    if (newPassword.length < 6) return Alert.alert('Error', 'New password must be at least 6 characters.');
    if (newPassword !== confirmPassword) return Alert.alert('Error', 'Passwords do not match.');

    setSaving(true);
    const res = await changePassword(token, { currentPassword, newPassword });
    setSaving(false);
    if (res.success) {
      Alert.alert('Success', 'Password changed successfully.');
      setShowPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      Alert.alert('Error', res.error?.message || 'Failed to change password.');
    }
  };

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProfile(true)}
            colors={['#2563EB']}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        {profile && (
          <View style={styles.card}>
            {(() => {
              const photoUri = resolvePhotoUrl(profile.profilePhotoUrl);
              if (photoUri && !imageError) {
                return (
                  <View style={styles.photoContainer}>
                    <Image
                      key={photoUri}
                      source={{ uri: photoUri }}
                      style={styles.photo}
                      onLoadStart={() => setImageLoading(true)}
                      onLoadEnd={() => setImageLoading(false)}
                      onError={(e) => {
                        console.warn('Profile photo load error from:', photoUri, e.nativeEvent?.error);
                        setImageError(true);
                      }}
                      resizeMode="cover"
                    />
                    {imageLoading && (
                      <View style={[styles.photo, styles.photoLoadingOverlay]}>
                        <ActivityIndicator size="small" color="#2563EB" />
                      </View>
                    )}
                  </View>
                );
              }
              return (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoText}>{profile.name?.[0]?.toUpperCase() || 'U'}</Text>
                </View>
              );
            })()}

            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.designation}>
              {profile.designation || 'Staff'} • {profile.department || 'Falcon Operations'}
            </Text>

            <View style={styles.badgeRow}>
              <View style={styles.roleBadge}>
                <Ionicons name="shield-outline" size={12} color="#2563EB" style={{ marginRight: 4 }} />
                <Text style={styles.roleBadgeText}>{(profile.role || 'EMPLOYEE').toUpperCase()}</Text>
              </View>

              {profile.jobStatus === 'Provisional' ? (
                <View style={styles.provisionalBadge}>
                  <Ionicons name="time-outline" size={12} color="#D97706" style={{ marginRight: 4 }} />
                  <Text style={styles.provisionalBadgeText}>PROVISIONAL</Text>
                </View>
              ) : (
                <View style={styles.permanentBadge}>
                  <Ionicons name="checkmark-circle-outline" size={12} color="#059669" style={{ marginRight: 4 }} />
                  <Text style={styles.permanentBadgeText}>PERMANENT</Text>
                </View>
              )}
            </View>

            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <View style={styles.iconLabel}>
                  <Ionicons name="id-card-outline" size={16} color="#64748B" />
                  <Text style={styles.label}>Employee ID</Text>
                </View>
                <Text style={styles.value}>{profile.employeeId}</Text>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconLabel}>
                  <Ionicons name="briefcase-outline" size={16} color="#64748B" />
                  <Text style={styles.label}>Job Status</Text>
                </View>
                <Text style={[styles.value, { fontWeight: '700', color: profile.jobStatus === 'Provisional' ? '#D97706' : '#059669' }]}>
                  {profile.jobStatus || 'Permanent'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconLabel}>
                  <Ionicons name="mail-outline" size={16} color="#64748B" />
                  <Text style={styles.label}>Email</Text>
                </View>
                <Text style={styles.value}>{profile.email}</Text>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconLabel}>
                  <Ionicons name="call-outline" size={16} color="#64748B" />
                  <Text style={styles.label}>Phone</Text>
                </View>
                <Text style={styles.value}>{profile.phone || 'Not provided'}</Text>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconLabel}>
                  <Ionicons name="calendar-outline" size={16} color="#64748B" />
                  <Text style={styles.label}>Joined On</Text>
                </View>
                <Text style={styles.value}>{profile.joiningDate || 'N/A'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Probation Period Timeline Card */}
        {profile && profile.jobStatus === 'Provisional' && (
          <View style={styles.probationCard}>
            <View style={styles.probationHeader}>
              <View style={styles.probationTitleRow}>
                <Ionicons name="time" size={18} color="#D97706" />
                <Text style={styles.probationTitle}>Provisional Probation Stage</Text>
              </View>
              {profile.daysRemaining !== null && (
                <View style={[styles.daysBadge, { backgroundColor: profile.daysRemaining > 0 ? '#FEF3C7' : '#FEE2E2' }]}>
                  <Text style={[styles.daysBadgeText, { color: profile.daysRemaining > 0 ? '#B45309' : '#DC2626' }]}>
                    {profile.daysRemaining > 0 ? `${profile.daysRemaining} days left` : 'Probation Ended'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.probationSubtitle}>
              You are currently under provisional probation. Your stage will be transitioned to permanent upon HR review.
            </Text>

            <View style={styles.probationDatesRow}>
              <View style={styles.probationDateBox}>
                <Text style={styles.probationDateLabel}>PROVISIONAL START</Text>
                <Text style={styles.probationDateValue}>{profile.provisionalStartDate || profile.joiningDate || '-'}</Text>
              </View>
              <View style={styles.probationDateBox}>
                <Text style={styles.probationDateLabel}>PROVISIONAL END</Text>
                <Text style={styles.probationDateValue}>{profile.provisionalEndDate || 'Under Review'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowEdit(true)} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.btnTextPrimary}>Edit Profile Details</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnOutline} onPress={() => setShowPassword(true)} activeOpacity={0.8}>
          <Ionicons name="key-outline" size={18} color="#2563EB" style={{ marginRight: 8 }} />
          <Text style={styles.btnTextOutline}>Change Account Password</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnLogout} onPress={logout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
          <Text style={styles.btnTextLogout}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEdit} animationType="slide" transparent onRequestClose={() => setShowEdit(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Phone Number (10 digits)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="10-digit mobile number"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Profile Photo URL</Text>
            <TextInput
              style={styles.input}
              value={photoUrl}
              onChangeText={setPhotoUrl}
              autoCapitalize="none"
              placeholder="https://..."
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowEdit(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveProfile} style={styles.saveBtn} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showPassword} animationType="slide" transparent onRequestClose={() => setShowPassword(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPassword(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              placeholder="Enter current password"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>New Password (min 6 chars)</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Enter new password"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Confirm new password"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowPassword(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleChangePassword} style={styles.saveBtn} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 20) : 0,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  headerRow: {
    marginBottom: 20,
    marginTop: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
    alignItems: 'center',
  },
  photoContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  photo: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  photoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 246, 255, 0.6)',
  },
  photoPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#BFDBFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  photoText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  designation: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  roleBadgeText: {
    color: '#1E40AF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  permanentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  permanentBadgeText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  provisionalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  provisionalBadgeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  probationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  probationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  probationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  probationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  daysBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  daysBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  probationSubtitle: {
    fontSize: 12.5,
    color: '#78350F',
    lineHeight: 18,
    marginBottom: 14,
  },
  probationDatesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  probationDateBox: {
    flex: 1,
    backgroundColor: '#FFFDF5',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
  },
  probationDateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 3,
  },
  probationDateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  infoSection: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  iconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  value: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
  btnPrimary: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  btnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  btnOutline: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  btnTextOutline: {
    color: '#1E40AF',
    fontWeight: '700',
    fontSize: 15,
  },
  btnLogout: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  btnTextLogout: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 15,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
  },
  closeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  closeText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

