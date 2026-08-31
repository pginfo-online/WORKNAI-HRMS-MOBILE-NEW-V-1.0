import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Linking,
  BackHandler,
  ScrollView,
  Dimensions,
  Platform,
  InteractionManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import appVersionApi, { VersionCheckResult } from '../api/appVersion.api';
import { colors } from '../constants/colors';

const DEVICE_ID_KEY = 'app_device_id';
const DISMISSED_KEY_PREFIX = 'dismissed_update_';
let cachedDeviceId: string | null = null;

const getOrCreateDeviceId = async (): Promise<string> => {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId =
        'dev_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      AsyncStorage.setItem(DEVICE_ID_KEY, deviceId).catch(() => {});
    }
    cachedDeviceId = deviceId;
    return deviceId;
  } catch (_) {
    return 'dev_fallback_' + Date.now();
  }
};

interface UpdateManagerProps {
  children: React.ReactNode;
}

export function UpdateManager({ children }: UpdateManagerProps) {
  const [updateInfo, setUpdateInfo] = useState<VersionCheckResult | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const checkVersionConcurrently = useCallback(async () => {
    try {
      const deviceId = await getOrCreateDeviceId();
      const currentVersion = Constants.expoConfig?.version || '1.0.0';

      const res = await appVersionApi.checkVersion({
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        version: currentVersion,
        deviceId,
      });

      const data: VersionCheckResult = res.data?.data;
      if (!data || !data.updateRequired) return;

      // Check dismissal status for non-critical update types
      const versionKey = data.versionCode ? String(data.versionCode) : data.latestVersion || '1';
      const dismissKey = `${DISMISSED_KEY_PREFIX}${versionKey}`;

      if (data.updateType !== 'critical' && data.updateType !== 'maintenance') {
        const wasDismissed = await AsyncStorage.getItem(dismissKey);
        if (wasDismissed === 'true') {
          return; // User dismissed this version previously
        }
      }

      setUpdateInfo(data);
    } catch (_) {
      // Fail-soft: silent catch so application opens without any delay or error
    }
  }, []);

  useEffect(() => {
    // Run after all initial screen transitions and renders are complete to protect UI performance
    const task = InteractionManager.runAfterInteractions(() => {
      const timer = setTimeout(() => {
        checkVersionConcurrently();
      }, 1000);
      return () => clearTimeout(timer);
    });

    return () => task.cancel();
  }, [checkVersionConcurrently]);

  // Block Android Back button for Critical or Maintenance updates
  useEffect(() => {
    if (
      updateInfo?.updateRequired &&
      (updateInfo.updateType === 'critical' || updateInfo.updateType === 'maintenance')
    ) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => backHandler.remove();
    }
  }, [updateInfo]);

  const handleOpenStore = () => {
    if (updateInfo?.updateLink) {
      Linking.openURL(updateInfo.updateLink).catch(() => {});
    }
  };

  const handleDismiss = async () => {
    if (!updateInfo) return;
    setIsDismissed(true);
    try {
      const versionKey = updateInfo.versionCode ? String(updateInfo.versionCode) : updateInfo.latestVersion || '1';
      await AsyncStorage.setItem(`${DISMISSED_KEY_PREFIX}${versionKey}`, 'true');
    } catch (_) {}
  };

  // If no update or dismissed non-critical update, render app normally
  if (!updateInfo || !updateInfo.updateRequired || isDismissed) {
    return <>{children}</>;
  }

  const { updateType, title, description, releaseNotes } = updateInfo;

  // ── 1. CRITICAL BLOCK (Full-Screen Gradient Block - Non-Skippable) ──
  if (updateType === 'critical') {
    return (
      <View style={styles.fullScreenContainer}>
        <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.fullScreenGradient}>
          <View style={styles.iconCircleCritical}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
          </View>

          <Text style={styles.criticalTitle}>{title || 'Critical Update Required'}</Text>
          <Text style={styles.criticalDesc}>
            {description || 'A mandatory update is required to continue using the application.'}
          </Text>

          {releaseNotes && releaseNotes.length > 0 && (
            <ScrollView style={styles.notesBox} showsVerticalScrollIndicator={false}>
              <Text style={styles.notesHeading}>Release Notes:</Text>
              {releaseNotes.map((note, idx) => (
                <Text key={idx} style={styles.noteItem}>• {note}</Text>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity onPress={handleOpenStore} style={styles.primaryActionBtn}>
            <Ionicons name="cloud-download-outline" size={20} color="#FFFFFF" />
            <Text style={styles.primaryActionBtnText}>Update Now</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  // ── 2. MAINTENANCE BLOCK (Full-Screen Gradient Maintenance - Non-Skippable) ──
  if (updateType === 'maintenance') {
    return (
      <View style={styles.fullScreenContainer}>
        <LinearGradient colors={['#0F172A', '#1E1B4B']} style={styles.fullScreenGradient}>
          <View style={styles.iconCircleMaintenance}>
            <Ionicons name="construct-outline" size={48} color="#F59E0B" />
          </View>

          <Text style={styles.criticalTitle}>{title || 'App Under Maintenance'}</Text>
          <Text style={styles.criticalDesc}>
            {description || 'The app is currently undergoing scheduled maintenance. Please check back shortly.'}
          </Text>

          <View style={styles.maintBadge}>
            <Ionicons name="time-outline" size={16} color="#F59E0B" />
            <Text style={styles.maintBadgeText}>Maintenance In Progress</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ── 3. IMPORTANT UPDATE (Centered Modal - Skippable) ──
  if (updateType === 'important') {
    return (
      <>
        {children}
        <Modal transparent animationType="fade" visible={!isDismissed}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconBg}>
                <Ionicons name="star" size={28} color="#F59E0B" />
              </View>

              <Text style={styles.modalTitle}>{title || 'Important Update Available'}</Text>
              <Text style={styles.modalDesc}>{description || 'An important update is available with new features.'}</Text>

              {releaseNotes && releaseNotes.length > 0 && (
                <View style={styles.smallNotesBox}>
                  {releaseNotes.slice(0, 3).map((n, i) => (
                    <Text key={i} style={styles.smallNoteText}>• {n}</Text>
                  ))}
                </View>
              )}

              <View style={styles.modalActionRow}>
                <TouchableOpacity onPress={handleDismiss} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Later</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleOpenStore} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Update Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // ── 4. RECOMMENDED UPDATE (Bottom Sheet - Skippable) ──
  if (updateType === 'recommended') {
    return (
      <>
        {children}
        <Modal transparent animationType="slide" visible={!isDismissed}>
          <View style={styles.bottomSheetOverlay}>
            <View style={styles.bottomSheetCard}>
              <View style={styles.dragHandle} />

              <View style={styles.bsHeader}>
                <View style={styles.bsIconBg}>
                  <Ionicons name="arrow-up-circle-outline" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bsTitle}>{title || 'Recommended Update'}</Text>
                  <Text style={styles.bsDesc}>{description || 'New improvements available.'}</Text>
                </View>
              </View>

              <View style={styles.modalActionRow}>
                <TouchableOpacity onPress={handleDismiss} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Later</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleOpenStore} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Update</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // ── 5. OPTIONAL UPDATE (Floating Pill Banner - Skippable) ──
  return (
    <>
      {children}
      <View style={styles.floatingPillContainer}>
        <View style={styles.pillCard}>
          <Ionicons name="sparkles" size={18} color="#10B981" />
          <Text style={styles.pillText} numberOfLines={1}>
            {title || 'New update available'}
          </Text>
          <TouchableOpacity onPress={handleOpenStore} style={styles.pillBtn}>
            <Text style={styles.pillBtnText}>Update</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDismiss} style={styles.pillClose}>
            <Ionicons name="close" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: { flex: 1 },
  fullScreenGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 16,
  },
  iconCircleCritical: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconCircleMaintenance: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  criticalTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  criticalDesc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  notesBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
    marginVertical: 10,
  },
  notesHeading: { fontSize: 12, fontWeight: '800', color: '#CBD5E1', marginBottom: 6 },
  noteItem: { fontSize: 13, color: '#94A3B8', lineHeight: 18 },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 16,
    width: '100%',
    marginTop: 12,
  },
  primaryActionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  maintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    marginTop: 16,
  },
  maintBadgeText: { color: '#F59E0B', fontSize: 13, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    gap: 12,
  },
  modalIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  modalDesc: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 },
  smallNotesBox: { width: '100%', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 12 },
  smallNoteText: { fontSize: 12, color: '#475569' },
  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: '#64748B', fontSize: 14, fontWeight: '700' },
  primaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  // Bottom Sheet
  bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
  },
  dragHandle: { width: 36, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1', alignSelf: 'center' },
  bsHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  bsIconBg: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(32, 118, 199, 0.1)', alignItems: 'center', justifyContent: 'center' },
  bsTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  bsDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },

  // Floating Pill
  floatingPillContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    zIndex: 999,
  },
  pillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  pillText: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  pillBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  pillClose: { padding: 4 },
});
