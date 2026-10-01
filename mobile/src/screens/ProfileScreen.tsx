import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Platform,
  StatusBar,
  RefreshControl,
  Share,
} from 'react-native';
import { CustomAlert as Alert } from '../components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile, changePassword, resolvePhotoUrl, uploadProfilePhoto, deleteProfilePhoto } from '../api/profileApi';
import { Ionicons } from '@expo/vector-icons';
import { sendTestNotification, getNativeFcmToken } from '../services/pushNotificationService';
import { FullImageModal } from '../components/FullImageModal';
import { DigitalIdCardModal } from '../components/DigitalIdCardModal';

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
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const [showIdCard, setShowIdCard] = useState(false);

  // Forms
  const [phone, setPhone] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [modalImageError, setModalImageError] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

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
      setPersonalEmail(res.data.personalEmail ? res.data.personalEmail.replace(/@gmail\.com$/i, '') : '');
      setCurrentAddress(res.data.currentAddress || '');
      setEmergencyContactName(res.data.emergencyContactName || '');
      setEmergencyContactRelationship(res.data.emergencyContactRelationship || '');
      setEmergencyContactPhone(res.data.emergencyContactPhone || '');
      setFatherName(res.data.fatherName || '');
      setMotherName(res.data.motherName || '');
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

    if (phone && phone.length !== 10) {
      return Alert.alert('Invalid Phone', 'Phone number must be exactly 10 digits.');
    }
    if (emergencyContactPhone && emergencyContactPhone.length !== 10) {
      return Alert.alert('Invalid Emergency Phone', 'Emergency contact phone must be exactly 10 digits.');
    }

    let emailToSend = personalEmail.trim().toLowerCase();
    if (emailToSend && !emailToSend.includes('@')) {
      emailToSend = `${emailToSend}@gmail.com`;
    }

    setSaving(true);
    const res = await updateProfile(token, {
      phone: phone || undefined,
      personalEmail: emailToSend || null,
      currentAddress: currentAddress.trim() || null,
      emergencyContactName: emergencyContactName.trim() || null,
      emergencyContactRelationship: emergencyContactRelationship.trim() || null,
      emergencyContactPhone: emergencyContactPhone || null,
      fatherName: fatherName.trim() || null,
      motherName: motherName.trim() || null,
      profilePhotoUrl: photoUrl || null,
    });
    setSaving(false);
    if (res.success) {
      Alert.alert('Success', 'Profile updated successfully.');
      setShowEdit(false);
      loadProfile();
    } else {
      Alert.alert('Error', res.error?.message || 'Failed to update.');
    }
  };

  const handleUploadPhotoUri = async (uri: string) => {
    if (!token) return;
    setPhotoUploading(true);
    try {
      const res = await uploadProfilePhoto(token, uri);
      if (res.success && res.data?.profilePhotoUrl) {
        const newUrl = res.data.profilePhotoUrl;
        setPhotoUrl(newUrl);
        setImageError(false);
        setModalImageError(false);
        setProfile((prev: any) => prev ? { ...prev, profilePhotoUrl: newUrl } : prev);
        updateUser({ profilePhotoUrl: newUrl });
        Alert.alert('Success', 'Profile photo updated successfully!');
      } else {
        Alert.alert('Upload Failed', res.error?.message || 'Could not upload photo.');
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Network error uploading photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow gallery access to upload a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUploadPhotoUri(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to select image from gallery.');
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow camera access to take a profile photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUploadPhotoUri(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to capture photo.');
    }
  };

  const handleRemovePhoto = async () => {
    if (!token) return;
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setPhotoUploading(true);
            try {
              const res = await deleteProfilePhoto(token);
              if (res.success) {
                setPhotoUrl('');
                setImageError(false);
                setModalImageError(false);
                setProfile((prev: any) => prev ? { ...prev, profilePhotoUrl: null } : prev);
                updateUser({ profilePhotoUrl: undefined });
                Alert.alert('Success', 'Profile photo removed.');
              } else {
                Alert.alert('Error', res.error?.message || 'Could not remove photo.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Network error.');
            } finally {
              setPhotoUploading(false);
            }
          }
        }
      ],
      { cancelable: true }
    );
  };

  const handleAvatarPress = () => {
    const photoUri = resolvePhotoUrl(profile?.profilePhotoUrl);
    if (photoUri && !imageError) {
      setShowFullPhoto(true);
    } else {
      setShowPhotoOptions(true);
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
      resetPasswordForm();
      setShowPassword(false);
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
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handleAvatarPress}
              activeOpacity={0.8}
            >
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
                      {(imageLoading || photoUploading) && (
                        <View style={[styles.photo, styles.photoLoadingOverlay]}>
                          <ActivityIndicator size="small" color="#2563EB" />
                        </View>
                      )}
                    </View>
                  );
                }
                return (
                  <View style={styles.photoPlaceholder}>
                    {photoUploading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.photoText}>{profile.name?.[0]?.toUpperCase() || 'U'}</Text>
                    )}
                  </View>
                );
              })()}
              <TouchableOpacity
                style={styles.cameraIconBadge}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowPhotoOptions(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={13} color="#FFFFFF" />
              </TouchableOpacity>
            </TouchableOpacity>

            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.designation}>
              {profile.designation || 'Staff'} • {profile.department || 'Falcon Operations'}
            </Text>

            <View style={styles.badgeRow}>
              <View style={styles.roleBadge}>
                <Ionicons name="shield-outline" size={12} color="#2563EB" style={{ marginRight: 4 }} />
                <Text style={styles.roleBadgeText}>{(profile.role || 'EMPLOYEE').toUpperCase()}</Text>
              </View>

              <View style={[
                styles.modeBadge,
                (profile.attendanceMode || 'Office') === 'Field'
                  ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
                  : { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }
              ]}>
                <Ionicons
                  name={(profile.attendanceMode || 'Office') === 'Field' ? 'navigate' : 'business'}
                  size={12}
                  color={(profile.attendanceMode || 'Office') === 'Field' ? '#D97706' : '#2563EB'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[
                  styles.modeBadgeText,
                  { color: (profile.attendanceMode || 'Office') === 'Field' ? '#B45309' : '#1D4ED8' }
                ]}>
                  {((profile.attendanceMode || 'Office')).toUpperCase()}
                </Text>
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
                  <Ionicons name="navigate-circle-outline" size={16} color="#64748B" />
                  <Text style={styles.label}>Attendance Mode</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[
                    styles.value,
                    {
                      fontWeight: '700',
                      color: (profile.attendanceMode || 'Office') === 'Field' ? '#D97706' : '#2563EB',
                      marginRight: 4
                    }
                  ]}>
                    {(profile.attendanceMode || 'Office') === 'Field' ? '📍 Field' : '🏢 Office'}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '500' }}>
                    (Read-only)
                  </Text>
                </View>
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
                  <Text style={styles.label}>Work Email</Text>
                </View>
                <Text style={styles.value}>{profile.email ? profile.email.toLowerCase() : ''}</Text>
              </View>

              {profile.personalEmail ? (
                <View style={styles.infoRow}>
                  <View style={styles.iconLabel}>
                    <Ionicons name="mail-unread-outline" size={16} color="#64748B" />
                    <Text style={styles.label}>Personal Email</Text>
                  </View>
                  <Text style={styles.value}>{profile.personalEmail.toLowerCase()}</Text>
                </View>
              ) : null}

              <View style={styles.infoRow}>
                <View style={styles.iconLabel}>
                  <Ionicons name="call-outline" size={16} color="#64748B" />
                  <Text style={styles.label}>Phone</Text>
                </View>
                <Text style={styles.value}>{profile.phone || 'Not provided'}</Text>
              </View>

              {profile.currentAddress ? (
                <View style={styles.infoRow}>
                  <View style={styles.iconLabel}>
                    <Ionicons name="home-outline" size={16} color="#64748B" />
                    <Text style={styles.label}>Current Address</Text>
                  </View>
                  <Text style={[styles.value, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                    {profile.currentAddress}
                  </Text>
                </View>
              ) : null}

              {profile.emergencyContactName ? (
                <View style={styles.infoRow}>
                  <View style={styles.iconLabel}>
                    <Ionicons name="medkit-outline" size={16} color="#DC2626" />
                    <Text style={styles.label}>Emergency Contact</Text>
                  </View>
                  <Text style={[styles.value, { flex: 1, textAlign: 'right' }]}>
                    {profile.emergencyContactName} {profile.emergencyContactRelationship ? `(${profile.emergencyContactRelationship})` : ''}
                    {profile.emergencyContactPhone ? ` • ${profile.emergencyContactPhone}` : ''}
                  </Text>
                </View>
              ) : null}

              <View style={styles.infoRow}>
                <View style={styles.iconLabel}>
                  <Ionicons name="calendar-outline" size={16} color="#64748B" />
                  <Text style={styles.label}>Joined On</Text>
                </View>
                <Text style={styles.value}>{profile.joiningDate || 'N/A'}</Text>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconLabel}>
                  <Ionicons name="people-outline" size={16} color="#64748B" />
                  <Text style={styles.label}>Reporting Manager</Text>
                </View>
                <Text style={styles.value}>{profile.reportingManager || profile.reportingManagerName || 'Not assigned'}</Text>
              </View>

              {profile.fatherName ? (
                <View style={styles.infoRow}>
                  <View style={styles.iconLabel}>
                    <Ionicons name="person-outline" size={16} color="#64748B" />
                    <Text style={styles.label}>Father's Name</Text>
                  </View>
                  <Text style={styles.value}>{profile.fatherName}</Text>
                </View>
              ) : null}

              {profile.motherName ? (
                <View style={styles.infoRow}>
                  <View style={styles.iconLabel}>
                    <Ionicons name="person-outline" size={16} color="#64748B" />
                    <Text style={styles.label}>Mother's Name</Text>
                  </View>
                  <Text style={styles.value}>{profile.motherName}</Text>
                </View>
              ) : null}
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
        <TouchableOpacity
          style={styles.btnIdCard}
          onPress={() => setShowIdCard(true)}
          activeOpacity={0.85}
        >
          <View style={styles.idCardBtnLeft}>
            <View style={styles.idCardIconBadge}>
              <Ionicons name="card" size={20} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.idCardBtnTitle}>Official Employee ID Card</Text>
              <Text style={styles.idCardBtnSub}>Digital credential with verification QR</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748B" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowEdit(true)} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.btnTextPrimary}>Edit Profile Details</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnOutline} onPress={() => setShowPassword(true)} activeOpacity={0.8}>
          <Ionicons name="key-outline" size={18} color="#2563EB" style={{ marginRight: 8 }} />
          <Text style={styles.btnTextOutline}>Change Account Password</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnNotificationTest}
          onPress={async () => {
            const res = await sendTestNotification();
            Alert.alert(res.success ? 'Notification Sent! 🔔' : 'Notification Alert', res.message);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={18} color="#2563EB" style={{ marginRight: 8 }} />
          <Text style={styles.btnTextNotificationTest}>Test Push Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnNotificationTest, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', marginTop: 10 }]}
          onPress={async () => {
            const fcmToken = await getNativeFcmToken();
            if (fcmToken) {
              Alert.alert(
                'Firebase Console Connected 🔥',
                `Your Device FCM Registration Token:\n\n${fcmToken.slice(0, 36)}...\n\nTap "Share / Copy Token" to copy it and paste into Firebase Console > Messaging > Send test message.`,
                [
                  {
                    text: 'Share / Copy Token',
                    onPress: () => Share.share({ message: fcmToken, title: 'Firebase FCM Registration Token' })
                  },
                  { text: 'Close', style: 'cancel' }
                ]
              );
            } else {
              Alert.alert('Firebase FCM Token', 'Token is initializing. Please ensure network connectivity and Google Play Services are enabled.');
            }
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="flame-outline" size={18} color="#EA580C" style={{ marginRight: 8 }} />
          <Text style={[styles.btnTextNotificationTest, { color: '#C2410C' }]}>Firebase Console FCM Token</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnLogout} onPress={logout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
          <Text style={styles.btnTextLogout}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Profile Photo Options Modal */}
      <Modal
        visible={showPhotoOptions}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalBg}
          activeOpacity={1}
          onPress={() => setShowPhotoOptions(false)}
        >
          <View style={styles.photoOptionsCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Profile Photo</Text>
              <TouchableOpacity onPress={() => setShowPhotoOptions(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.photoOptionsSubtitle}>Select an option to update or view your photo:</Text>

            {(Boolean(profile?.profilePhotoUrl) || Boolean(photoUrl)) && (
              <TouchableOpacity
                style={styles.photoOptionItem}
                onPress={() => {
                  setShowPhotoOptions(false);
                  setShowFullPhoto(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.photoOptionIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="eye-outline" size={20} color="#2563EB" />
                </View>
                <Text style={styles.photoOptionText}>View Profile Photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.photoOptionItem}
              onPress={() => {
                setShowPhotoOptions(false);
                takePhotoWithCamera();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.photoOptionIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="camera-outline" size={20} color="#2563EB" />
              </View>
              <Text style={styles.photoOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoOptionItem}
              onPress={() => {
                setShowPhotoOptions(false);
                pickFromGallery();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.photoOptionIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="images-outline" size={20} color="#16A34A" />
              </View>
              <Text style={styles.photoOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>

            {(Boolean(profile?.profilePhotoUrl) || Boolean(photoUrl)) && (
              <TouchableOpacity
                style={styles.photoOptionItem}
                onPress={() => {
                  setShowPhotoOptions(false);
                  handleRemovePhoto();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.photoOptionIconBox, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                </View>
                <Text style={[styles.photoOptionText, { color: '#DC2626' }]}>Remove Photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.photoOptionCancelBtn}
              onPress={() => setShowPhotoOptions(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.photoOptionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Screen Image Preview Modal */}
      <FullImageModal
        visible={showFullPhoto}
        onClose={() => setShowFullPhoto(false)}
        imageUrl={resolvePhotoUrl(profile?.profilePhotoUrl || photoUrl)}
        name={profile?.name}
        subtitle={`${profile?.employeeId || ''}${profile?.department ? ` • ${profile.department}` : ''}`}
        onEditPhoto={() => setShowPhotoOptions(true)}
      />

      {/* Edit Profile Modal */}
      <Modal visible={showEdit} animationType="slide" transparent onRequestClose={() => setShowEdit(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { maxHeight: '88%', padding: 0, overflow: 'hidden' }]}>
            <View style={[styles.modalHeaderRow, { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 0 }]}>
              <View>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Update your personal & contact details</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEdit(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ paddingHorizontal: 20, paddingTop: 8 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Section 1: Contact & Address */}
              <View style={[styles.editSectionDivider, { marginTop: 8, paddingTop: 0, borderTopWidth: 0 }]}>
                <Ionicons name="call-outline" size={14} color="#2563EB" />
                <Text style={styles.editSectionTitle}>Contact & Address</Text>
              </View>

              <Text style={styles.inputLabel}>Mobile Number (10 digits)</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="10-digit mobile number"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Personal Email</Text>
              <TextInput
                style={styles.input}
                value={personalEmail}
                onChangeText={(text) => setPersonalEmail(text.trim().toLowerCase())}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="e.g. name@gmail.com"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Current Residential Address</Text>
              <TextInput
                style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
                value={currentAddress}
                onChangeText={setCurrentAddress}
                multiline
                numberOfLines={3}
                placeholder="Enter current residential address"
                placeholderTextColor="#94A3B8"
              />

              {/* Section 2: Emergency Contact */}
              <View style={styles.editSectionDivider}>
                <Ionicons name="medkit-outline" size={14} color="#DC2626" />
                <Text style={[styles.editSectionTitle, { color: '#B91C1C' }]}>Emergency Contact</Text>
              </View>

              <Text style={styles.inputLabel}>Contact Person Name</Text>
              <TextInput
                style={styles.input}
                value={emergencyContactName}
                onChangeText={setEmergencyContactName}
                placeholder="e.g. Relative or friend name"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Relationship</Text>
              <View style={styles.chipContainer}>
                {['Parent', 'Spouse', 'Sibling', 'Child', 'Friend', 'Other'].map((rel) => (
                  <TouchableOpacity
                    key={rel}
                    style={[styles.chip, emergencyContactRelationship === rel && styles.chipSelected]}
                    onPress={() => setEmergencyContactRelationship(rel)}
                  >
                    <Text style={[styles.chipText, emergencyContactRelationship === rel && styles.chipTextSelected]}>
                      {rel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, { marginTop: 2 }]}
                value={emergencyContactRelationship}
                onChangeText={setEmergencyContactRelationship}
                placeholder="Relationship (e.g. Mother, Father, Spouse)"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Emergency Phone Number (10 digits)</Text>
              <TextInput
                style={styles.input}
                value={emergencyContactPhone}
                onChangeText={(text) => setEmergencyContactPhone(text.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="10-digit emergency number"
                placeholderTextColor="#94A3B8"
              />

              {/* Section 3: Family Details */}
              <View style={styles.editSectionDivider}>
                <Ionicons name="people-outline" size={14} color="#2563EB" />
                <Text style={styles.editSectionTitle}>Family Details</Text>
              </View>

              <Text style={styles.inputLabel}>Father's Name</Text>
              <TextInput
                style={styles.input}
                value={fatherName}
                onChangeText={setFatherName}
                placeholder="Father's full name"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Mother's Name</Text>
              <TextInput
                style={styles.input}
                value={motherName}
                onChangeText={setMotherName}
                placeholder="Mother's full name"
                placeholderTextColor="#94A3B8"
              />

              {/* Section 4: Profile Photo */}
              <View style={styles.editSectionDivider}>
                <Ionicons name="image-outline" size={14} color="#2563EB" />
                <Text style={styles.editSectionTitle}>Profile Photo</Text>
              </View>

              <View style={styles.modalPhotoRow}>
                <View style={styles.modalPhotoThumbContainer}>
                  {(() => {
                    const currentPhotoUri = resolvePhotoUrl(photoUrl);
                    if (currentPhotoUri && !modalImageError) {
                      return (
                        <Image
                          source={{ uri: currentPhotoUri }}
                          style={styles.modalPhotoThumb}
                          onError={() => setModalImageError(true)}
                        />
                      );
                    }
                    return (
                      <View style={styles.modalPhotoThumbPlaceholder}>
                        <Text style={styles.modalPhotoThumbText}>
                          {profile?.name?.[0]?.toUpperCase() || 'U'}
                        </Text>
                      </View>
                    );
                  })()}
                  {photoUploading && (
                    <View style={styles.modalPhotoLoadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  )}
                </View>

                <View style={styles.modalPhotoButtons}>
                  <TouchableOpacity
                    style={styles.galleryBtn}
                    onPress={pickFromGallery}
                    disabled={photoUploading}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="images" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.galleryBtnText}>Choose from Gallery</Text>
                  </TouchableOpacity>

                  <View style={styles.modalPhotoSubButtons}>
                    <TouchableOpacity
                      style={styles.cameraBtn}
                      onPress={takePhotoWithCamera}
                      disabled={photoUploading}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="camera-outline" size={14} color="#334155" style={{ marginRight: 4 }} />
                      <Text style={styles.cameraBtnText}>Camera</Text>
                    </TouchableOpacity>

                    {Boolean(photoUrl) && (
                      <TouchableOpacity
                        style={styles.removePhotoBtn}
                        onPress={handleRemovePhoto}
                        disabled={photoUploading}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                        <Text style={styles.removePhotoBtnText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {photoUploading && (
                <Text style={styles.uploadingNotice}>Uploading photo to server...</Text>
              )}

              <TouchableOpacity
                style={styles.toggleUrlBtn}
                onPress={() => setShowUrlInput(!showUrlInput)}
              >
                <Text style={styles.toggleUrlText}>
                  {showUrlInput ? 'Hide URL input' : 'Or paste photo URL manually'}
                </Text>
              </TouchableOpacity>

              {showUrlInput && (
                <TextInput
                  style={[styles.input, { marginTop: 4, marginBottom: 20 }]}
                  value={photoUrl}
                  onChangeText={(t) => {
                    setPhotoUrl(t);
                    setModalImageError(false);
                  }}
                  autoCapitalize="none"
                  placeholder="https://..."
                  placeholderTextColor="#94A3B8"
                />
              )}
              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={[styles.modalActions, { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 0 }]}>
              <TouchableOpacity onPress={() => setShowEdit(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveProfile} style={styles.saveBtn} disabled={saving || photoUploading}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showPassword} animationType="slide" transparent onRequestClose={() => { resetPasswordForm(); setShowPassword(false); }}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => { resetPasswordForm(); setShowPassword(false); }}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Current Password</Text>
            <View style={styles.passwordInputWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPassword((prev) => !prev)}
                style={styles.passwordEyeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>New Password (min 6 chars)</Text>
            <View style={styles.passwordInputWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                placeholder="Enter new password"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword((prev) => !prev)}
                style={styles.passwordEyeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <View style={styles.passwordInputWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                style={styles.passwordEyeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => { resetPasswordForm(); setShowPassword(false); }} style={styles.closeBtn}>
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleChangePassword} style={styles.saveBtn} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Official Digital ID Card Modal */}
      <DigitalIdCardModal
        visible={showIdCard}
        onClose={() => setShowIdCard(false)}
        token={token}
      />
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
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  modeBadgeText: {
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
  btnIdCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  idCardBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  idCardIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idCardBtnTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  idCardBtnSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
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
  btnNotificationTest: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#F0F9FF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  btnTextNotificationTest: {
    color: '#0369A1',
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
    marginTop: 6,
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
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  passwordEyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
  avatarWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2563EB',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  modalPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalPhotoThumbContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    marginRight: 12,
  },
  modalPhotoThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modalPhotoThumbPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  modalPhotoThumbText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  modalPhotoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(37, 99, 235, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPhotoButtons: {
    flex: 1,
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  galleryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modalPhotoSubButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    flex: 1,
  },
  cameraBtnText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 12,
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  removePhotoBtnText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 12,
  },
  uploadingNotice: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  toggleUrlBtn: {
    paddingVertical: 4,
    marginBottom: 4,
  },
  toggleUrlText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  photoOptionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  photoOptionsSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    marginBottom: 16,
    marginTop: 2,
  },
  photoOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  photoOptionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  photoOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  photoOptionCancelBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  photoOptionCancelText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#475569',
  },
  editSectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  editSectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E40AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  chipSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  chipTextSelected: {
    color: '#2563EB',
    fontWeight: '700',
  },
});

