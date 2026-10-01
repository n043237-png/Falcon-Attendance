import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface FullImageModalProps {
  visible: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  name?: string;
  subtitle?: string;
  onEditPhoto?: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const FullImageModal: React.FC<FullImageModalProps> = ({
  visible,
  onClose,
  imageUrl,
  name,
  subtitle,
  onEditPhoto,
}) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const initial = (name?.trim()?.charAt(0) || 'U').toUpperCase();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.backdrop}>
        {/* Top Header Bar */}
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.iconButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>
                {name || 'Profile Photo'}
              </Text>
              {subtitle ? (
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>

            {onEditPhoto ? (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onEditPhoto();
                }}
                style={styles.iconButton}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>
        </SafeAreaView>

        {/* Center Image Container */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.centerArea}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.imageCard}>
                {imageUrl && !imageError ? (
                  <View style={styles.imageWrapper}>
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.fullImage}
                      resizeMode="cover"
                      onLoadStart={() => setImageLoading(true)}
                      onLoadEnd={() => setImageLoading(false)}
                      onError={() => {
                        setImageLoading(false);
                        setImageError(true);
                      }}
                    />
                    {imageLoading && (
                      <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.placeholderContainer}>
                    <View style={styles.placeholderCircle}>
                      <Text style={styles.placeholderText}>{initial}</Text>
                    </View>
                    <Text style={styles.noPhotoText}>No Profile Photo Set</Text>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>

        {/* Bottom Bar Info */}
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={18} color="#94A3B8" />
            <Text style={styles.dismissText}>Tap anywhere to close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const PHOTO_BOX_SIZE = Math.min(SCREEN_WIDTH - 24, SCREEN_HEIGHT * 0.55);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  safeHeader: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  imageCard: {
    width: PHOTO_BOX_SIZE,
    height: PHOTO_BOX_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  placeholderCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 54,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  noPhotoText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomBar: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  dismissButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dismissText: {
    color: '#94A3B8',
    fontSize: 12.5,
    fontWeight: '500',
  },
});
