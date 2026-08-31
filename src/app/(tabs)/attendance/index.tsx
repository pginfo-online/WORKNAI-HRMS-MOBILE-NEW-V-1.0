import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { attendanceApi } from '../../../api/attendance.api';
import { useAuthStore } from '../../../store/auth.store';
import { useUIStore } from '../../../store/ui.store';
import { useTaskStore } from '../../../store/task.store';
import { useBiometricAuth } from '../../../hooks/useBiometricAuth';
import { useLocationVerification } from '../../../hooks/useLocationVerification';
import { useAttendanceFeedback } from '../../../hooks/useAttendanceFeedback';
import { getLocation } from '../../../services/locationService';
import { colors } from '../../../constants/colors';
import { Card } from '../../../components/ui/Card';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { TaskItemCard } from '../../../components/tasks/TaskItemCard';
import { AttendanceMainSkeleton } from '../../../components/ui/SkeletonPresets';
import { AttendanceFeedback } from '../../../components/ui/AttendanceFeedback';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { safeFormat } from '../../../utils/dateUtils';

function AttendanceContent() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { theme } = useUIStore();
  const { tasks, isLoading: tasksLoading, fetchTodayTasks, toggleTaskCompletion, deleteTask } = useTaskStore();
  const { authenticate: authenticateBiometrics } = useBiometricAuth();

  // ── Location Verification ──────────────────────────────────────────────────
  const {
    geoStatus,
    geoDistance,
    userLocation,
    verifyLocation,
    resetGeoStatus,
  } = useLocationVerification();

  // ── Feedback bar ──────────────────────────────────────────────────────────
  const { feedbackState, showFeedback, hideFeedback } = useAttendanceFeedback();

  // ── Local State ───────────────────────────────────────────────────────────
  const [workMode, setWorkMode] = useState<'Office' | 'WFH' | 'Field'>('Office');
  const [actionLoading, setActionLoading] = useState(false);

  // Live Timer & Shift metrics
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');
  const [isOvertime, setIsOvertime] = useState(false);
  const [progressPct, setProgressPct] = useState(0);

  // Double-tap protection (immediate synchronous ref guard)
  const isActionInFlightRef = useRef(false);

  const isBypassUser = Boolean(user?.geoBypass);

  // ── 1. Fetch Today Attendance Status ──────────────────────────────────────
  const { data: todayData, isLoading, refetch } = useQuery({
    queryKey: ['today-status'],
    queryFn: () => attendanceApi.getToday().then((res) => res.data.data),
  });

  const record = todayData?.record;
  const office = todayData?.office;
  const isCheckedIn = !!record?.inTime && !record?.outTime;
  const isCheckedOut = !!record?.outTime;
  const currentWorkMode = record?.workMode || workMode;

  const fullDayMinutes = office?.fullDayMinutes ?? 480;

  // ── 2. Load tasks on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetchTodayTasks();
  }, [fetchTodayTasks]);

  const officeLat = office?.lat;
  const officeLng = office?.lng;
  const officeRadius = office?.radius;

  // ── 3. Trigger geo verification (Office mode only) ────────────────────────
  useEffect(() => {
    if (isCheckedOut || isBypassUser || workMode !== 'Office') {
      resetGeoStatus('valid');
      return;
    }
    if (!office) {
      resetGeoStatus('valid');
      return;
    }
    verifyLocation(office, { forceRefresh: false });
  }, [officeLat, officeLng, officeRadius, isCheckedOut, isBypassUser, workMode, verifyLocation, resetGeoStatus]);

  // ── 4. Re-verify when app comes back to foreground ────────────────────────
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && !isCheckedOut && !isBypassUser && workMode === 'Office' && office) {
        if (geoStatus !== 'valid' && geoStatus !== 'checking') {
          verifyLocation(office, { forceRefresh: true });
        }
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isCheckedOut, isBypassUser, workMode, office, geoStatus, verifyLocation]);

  // ── 5. Periodic Field Location Tracking ───────────────────────────────────
  useEffect(() => {
    if (!isCheckedIn || currentWorkMode !== 'Field') return;

    const track = async () => {
      const result = await getLocation({ accuracy: 3, timeout: 10_000 });
      if (result.type === 'success' && result.coords) {
        try {
          await attendanceApi.trackLocation({
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
          });
        } catch (err) {
          console.log('[FieldTrack] Periodic track error:', err);
        }
      }
    };

    track();
    const interval = setInterval(track, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isCheckedIn, currentWorkMode]);

  // ── 6. Live Shift Timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isCheckedIn || !record?.inTime) {
      setTimerDisplay('00:00:00');
      setIsOvertime(false);
      setProgressPct(0);
      return;
    }

    const inTime = new Date(record.inTime);
    const shiftMs = fullDayMinutes * 60000;

    const tick = () => {
      const workedMs = Date.now() - inTime.getTime();
      const remainingMs = shiftMs - workedMs;
      const overtime = remainingMs < 0;
      setIsOvertime(overtime);

      const absMs = Math.abs(remainingMs);
      const h = Math.floor(absMs / 3600000);
      const m = Math.floor((absMs % 3600000) / 60000);
      const s = Math.floor((absMs % 60000) / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setTimerDisplay(`${pad(h)}:${pad(m)}:${pad(s)}`);
      setProgressPct(Math.min(100, Math.max(0, (workedMs / shiftMs) * 100)));
    };

    tick();
    let interval = setInterval(tick, 1000);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        tick();
        clearInterval(interval);
        interval = setInterval(tick, 1000);
      } else {
        clearInterval(interval);
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [isCheckedIn, record?.inTime, fullDayMinutes]);

  // ── 7. Check-In Flow ──────────────────────────────────────────────────────
  const handleStartCheckInFlow = useCallback(async () => {
    if (isActionInFlightRef.current || actionLoading) return;
    isActionInFlightRef.current = true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Biometric authentication
      const authResult = await authenticateBiometrics('Verify your identity to check in');
      if (!authResult.success) {
        showFeedback({
          message: authResult.cancelled ? 'Authentication Cancelled' : 'Biometric Failed',
          subMessage: authResult.cancelled ? undefined : (authResult.error || 'Authentication error'),
          variant: authResult.cancelled ? 'warning' : 'error',
        });
        return;
      }

      let resolvedStatus = geoStatus;

      // Re-verify if not valid and in Office mode
      if (!isBypassUser && workMode === 'Office' && geoStatus !== 'valid') {
        setActionLoading(true);
        showFeedback({ message: 'Verifying your location...', variant: 'loading', duration: 0 });

        try {
          const res = await verifyLocation(office, { forceRefresh: false });
          resolvedStatus = res;
        } finally {
          setActionLoading(false);
          hideFeedback();
        }

        if (resolvedStatus !== 'valid') {
          if (resolvedStatus === 'gps_disabled') {
            showFeedback({
              message: 'GPS / Location Services Disabled',
              subMessage: 'Please enable Location Services in your device settings.',
              variant: 'warning',
            });
          } else if (resolvedStatus === 'permission_denied') {
            showFeedback({
              message: 'Location Permission Denied',
              subMessage: 'Tap to open Settings and allow location access.',
              variant: 'error',
              duration: 5000,
            });
          } else if (resolvedStatus === 'timeout') {
            showFeedback({
              message: 'Location Timed Out',
              subMessage: 'Could not get your location. Please try again.',
              variant: 'warning',
            });
          } else if (resolvedStatus === 'invalid') {
            showFeedback({
              message: `Out of Office Zone — ${geoDistance}m away`,
              subMessage: `Must be within ${office?.radius || 200}m of the office.`,
              variant: 'error',
            });
          } else {
            showFeedback({
              message: 'Location Verification Failed',
              subMessage: 'Could not determine your location. Please try again.',
              variant: 'error',
            });
          }
          return;
        }
      }

      const lat = isBypassUser ? undefined : userLocation?.latitude;
      const lng = isBypassUser ? undefined : userLocation?.longitude;

      router.push({
        pathname: '/(tabs)/attendance/check-in-tasks',
        params: {
          workMode,
          latitude: lat != null && !isNaN(lat) ? String(lat) : undefined,
          longitude: lng != null && !isNaN(lng) ? String(lng) : undefined,
        },
      });
    } finally {
      isActionInFlightRef.current = false;
      setActionLoading(false);
    }
  }, [actionLoading, geoStatus, isBypassUser, workMode, office, geoDistance, userLocation, authenticateBiometrics, verifyLocation, showFeedback, hideFeedback, router]);

  // ── 8. Check-Out Flow ─────────────────────────────────────────────────────
  const handleStartCheckOutFlow = useCallback(async () => {
    if (isActionInFlightRef.current || actionLoading) return;
    isActionInFlightRef.current = true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const authResult = await authenticateBiometrics('Verify your identity to check out');
      if (!authResult.success) {
        showFeedback({
          message: authResult.cancelled ? 'Authentication Cancelled' : 'Biometric Failed',
          subMessage: authResult.cancelled ? undefined : (authResult.error || 'Authentication error'),
          variant: authResult.cancelled ? 'warning' : 'error',
        });
        return;
      }

      const lat = isBypassUser ? undefined : userLocation?.latitude;
      const lng = isBypassUser ? undefined : userLocation?.longitude;

      router.push({
        pathname: '/(tabs)/attendance/check-out-tasks',
        params: {
          latitude: lat != null && !isNaN(lat) ? String(lat) : undefined,
          longitude: lng != null && !isNaN(lng) ? String(lng) : undefined,
        },
      });
    } finally {
      isActionInFlightRef.current = false;
      setActionLoading(false);
    }
  }, [actionLoading, isBypassUser, userLocation, authenticateBiometrics, showFeedback, router]);

  // ── 9. canAct ─────────────────────────────────────────────────────────────
  const canAct = useMemo(() => {
    if (actionLoading) return false;
    if (isBypassUser || currentWorkMode !== 'Office') return true;
    return geoStatus === 'valid';
  }, [actionLoading, isBypassUser, currentWorkMode, geoStatus]);

  // ── 10. Geo pill renderer ─────────────────────────────────────────────────
  const renderGeoPill = () => {
    if (isBypassUser) {
      return (
        <View style={[styles.geoPill, { backgroundColor: 'rgba(124,58,237,0.1)', borderColor: 'rgba(124,58,237,0.25)' }]}>
          <Ionicons name="flash" size={14} color="#7C3AED" />
          <Text style={[styles.geoText, { color: '#7C3AED' }]}>Remote Access</Text>
        </View>
      );
    }

    if (currentWorkMode !== 'Office') {
      return (
        <View style={[styles.geoPill, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)' }]}>
          <Ionicons name={currentWorkMode === 'WFH' ? 'home' : 'navigate'} size={14} color="#10B981" />
          <Text style={[styles.geoText, { color: '#10B981' }]}>{currentWorkMode} Mode</Text>
        </View>
      );
    }

    const map: Record<string, { color: string; bg: string; border: string; icon: any; text: string }> = {
      idle:              { color: colors.primary,  bg: 'rgba(32,118,199,0.1)',   border: 'rgba(32,118,199,0.25)',  icon: 'location-outline',  text: 'Awaiting GPS...' },
      checking:          { color: colors.primary,  bg: 'rgba(32,118,199,0.1)',   border: 'rgba(32,118,199,0.25)',  icon: 'sync',              text: 'Verifying GPS...' },
      valid:             { color: '#059669',        bg: 'rgba(5,150,105,0.1)',    border: 'rgba(5,150,105,0.25)',   icon: 'checkmark-circle',  text: `In Office · ${geoDistance}m` },
      invalid:           { color: '#DC2626',        bg: 'rgba(220,38,38,0.1)',    border: 'rgba(220,38,38,0.25)',   icon: 'close-circle',      text: `Out of Range · ${geoDistance}m` },
      error:             { color: '#DC2626',        bg: 'rgba(220,38,38,0.1)',    border: 'rgba(220,38,38,0.25)',   icon: 'alert-circle',      text: 'GPS Error' },
      permission_denied: { color: '#DC2626',        bg: 'rgba(220,38,38,0.1)',    border: 'rgba(220,38,38,0.25)',   icon: 'lock-closed',       text: 'GPS Denied' },
      gps_disabled:      { color: '#D97706',        bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)', icon: 'location-outline',  text: 'GPS Off' },
      timeout:           { color: '#D97706',        bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)', icon: 'timer-outline',     text: 'GPS Timeout' },
      low_accuracy:      { color: '#D97706',        bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)', icon: 'warning',           text: 'Low Accuracy' },
    };

    const s = map[geoStatus] || map.idle;
    return (
      <View style={[styles.geoPill, { backgroundColor: s.bg, borderColor: s.border }]}>
        <Ionicons name={s.icon} size={14} color={s.color} />
        <Text style={[styles.geoText, { color: s.color }]}>{s.text}</Text>
      </View>
    );
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const completedCount = tasks.filter((t) => t.status === 'Completed').length;
  const totalCount = tasks.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const shiftTargetLabel = `${(fullDayMinutes / 60).toFixed(1).replace('.0', '')} hrs`;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Work Session" subtitle="Shift & Task Management" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <AttendanceMainSkeleton />
        </ScrollView>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Work Session" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || tasksLoading}
            onRefresh={() => {
              refetch();
              fetchTodayTasks();
              if (!isBypassUser && workMode === 'Office' && office && !isCheckedOut) {
                verifyLocation(office, { forceRefresh: true });
              }
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Geo Status Row */}
        <View style={styles.statusRow}>
          {renderGeoPill()}
          {!isBypassUser && currentWorkMode === 'Office' && (
            <TouchableOpacity
              onPress={() => {
                if (office) verifyLocation(office, { forceRefresh: true });
              }}
              style={styles.refreshBtn}
            >
              <Ionicons name="refresh" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Hero Card */}
        <LinearGradient
          colors={colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroCard}
        >
          <View style={styles.heroContent}>
            {isCheckedIn ? (
              <View style={styles.activeSession}>
                <Text style={[styles.timerLabel, isOvertime && { color: '#FDE047' }]}>
                  {isOvertime ? '⚡ OVERTIME ACTIVE' : 'ACTIVE DUTY TIMER'}
                </Text>
                <Text style={[styles.timerText, isOvertime && { color: '#FDE047' }]}>
                  {isOvertime && '+'}{timerDisplay}
                </Text>
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progressPct}%` as any },
                        isOvertime && { backgroundColor: '#FDE047' },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressSub}>Shift target: {shiftTargetLabel}</Text>
                </View>
              </View>
            ) : isCheckedOut ? (
              <View style={styles.doneSession}>
                <View style={styles.doneIconCircle}>
                  <Ionicons name="checkmark-done" size={38} color="#FFFFFF" />
                </View>
                <Text style={styles.doneTitle}>Shift Completed</Text>
                <Text style={styles.doneSub}>Your duty hours and tasks are recorded for today.</Text>
              </View>
            ) : (
              <View style={styles.idleSession}>
                <View style={styles.idleIconCircle}>
                  <Ionicons name="time-outline" size={36} color="rgba(255,255,255,0.8)" />
                </View>
                <Text style={styles.idleTitle}>Start Work Session</Text>
                <Text style={styles.idleSub}>Select your mode & assign shift tasks to begin.</Text>
              </View>
            )}

            {/* Mode selection */}
            {!isCheckedIn && !isCheckedOut && (
              <View style={styles.modeRow}>
                {(['Office', 'WFH', 'Field'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setWorkMode(m);
                    }}
                    style={[styles.modeBtn, workMode === m && styles.modeBtnActive]}
                  >
                    <Ionicons
                      name={m === 'Office' ? 'business-outline' : m === 'WFH' ? 'home-outline' : 'navigate-outline'}
                      size={14}
                      color={workMode === m ? colors.primary : 'rgba(255,255,255,0.8)'}
                    />
                    <Text style={[styles.modeBtnText, workMode === m && styles.modeBtnTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Action Button */}
            <View style={styles.actionContainer}>
              {!isCheckedIn && !isCheckedOut ? (
                <TouchableOpacity
                  style={[styles.actionBtn, !canAct && styles.actionBtnDisabled]}
                  onPress={handleStartCheckInFlow}
                  disabled={!canAct || actionLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#FFFFFF', '#F1F5F9']} style={styles.actionBtnGradient}>
                    <Ionicons name="log-in-outline" size={20} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                      ASSIGN TASKS & CHECK IN
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : isCheckedIn ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handleStartCheckOutFlow}
                  disabled={actionLoading}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#EF4444', '#B91C1C']} style={styles.actionBtnGradient}>
                    <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
                    <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>
                      REVIEW TASKS & CHECK OUT
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={styles.syncedBadge}>
                  <Ionicons name="shield-checkmark" size={15} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.syncedText}>SESSION SYNCED & LOGGED</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Quick Nav Shortcuts */}
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/attendance/tasks')}
            style={[styles.navCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.navIconBg, { backgroundColor: 'rgba(32,118,199,0.1)' }]}>
              <Ionicons name="list-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.navTitle, { color: theme.text }]}>Task Hub</Text>
              <Text style={[styles.navSub, { color: theme.textSecondary }]}>
                {totalCount} total · {completedCount} done
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/attendance/summary')}
            style={[styles.navCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.navIconBg, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <Ionicons name="calendar-outline" size={20} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.navTitle, { color: theme.text }]}>Attendance Logs</Text>
              <Text style={[styles.navSub, { color: theme.textSecondary }]}>Monthly calendar & hours</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/attendance/correction')}
            style={[styles.navCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.navIconBg, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
              <Ionicons name="create-outline" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.navTitle, { color: theme.text }]}>Correction Request</Text>
              <Text style={[styles.navSub, { color: theme.textSecondary }]}>Fix incorrect times</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Active Deliverables Preview */}
        <View style={styles.taskSection}>
          <View style={styles.taskSectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Active Deliverables</Text>
              <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                {totalCount > 0
                  ? `${completedCount} of ${totalCount} completed (${completionPct}%)`
                  : 'Assign tasks during check-in to structure your day'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/attendance/tasks')}
              style={[styles.manageBtn, { backgroundColor: 'rgba(32,118,199,0.1)' }]}
            >
              <Text style={[styles.manageBtnText, { color: colors.primary }]}>Manage</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {totalCount > 0 && (
            <View style={[styles.taskProgressCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.taskProgressTrack}>
                <View
                  style={[
                    styles.taskProgressFill,
                    { width: `${completionPct}%` as any, backgroundColor: completionPct === 100 ? colors.success : colors.primary },
                  ]}
                />
              </View>
            </View>
          )}

          <View style={styles.tasksListContainer}>
            {tasks.slice(0, 3).map((task) => (
              <TaskItemCard
                key={task._id}
                task={task}
                onToggleComplete={toggleTaskCompletion}
                onDelete={(t) => deleteTask(t._id)}
              />
            ))}

            {tasks.length > 3 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/attendance/tasks')} style={styles.moreTasksBtn}>
                <Text style={[styles.moreTasksText, { color: colors.primary }]}>
                  +{tasks.length - 3} more in Task Hub →
                </Text>
              </TouchableOpacity>
            )}

            {tasks.length === 0 && !tasksLoading && (
              <Card style={styles.emptyTaskCard}>
                <Ionicons name="clipboard-outline" size={36} color={colors.primary} style={{ opacity: 0.5 }} />
                <Text style={[styles.emptyTaskTitle, { color: theme.text }]}>No Session Tasks Yet</Text>
                <Text style={[styles.emptyTaskSub, { color: theme.textSecondary }]}>
                  Assign tasks at check-in to track your work output.
                </Text>
              </Card>
            )}
          </View>
        </View>

        {/* Duty Metrics */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>Duty Metrics</Text>
        <View style={styles.metricsGrid}>
          {[
            { icon: 'log-in-outline' as const, color: '#10B981', bg: 'rgba(16,185,129,0.1)', label: 'Check In', value: record?.inTime ? safeFormat(record.inTime, 'hh:mm a') : '--:--' },
            { icon: 'log-out-outline' as const, color: colors.primary, bg: 'rgba(32,118,199,0.1)', label: 'Check Out', value: record?.outTime ? safeFormat(record.outTime, 'hh:mm a') : '--:--' },
            { icon: 'hourglass-outline' as const, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', label: 'Total Hours', value: record?.totalHours ? `${record.totalHours.toFixed(1)}h` : '0.0h' },
            { icon: 'calendar-outline' as const, color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', label: 'Duty Status', value: isCheckedOut ? 'DONE' : isCheckedIn ? 'ACTIVE' : 'PENDING' },
          ].map((m) => (
            <Card key={m.label} style={styles.metricCard}>
              <View style={[styles.metricIconBg, { backgroundColor: m.bg }]}>
                <Ionicons name={m.icon} size={20} color={m.color} />
              </View>
              <View>
                <Text style={[styles.metricLabel, { color: theme.textTertiary }]}>{m.label}</Text>
                <Text style={[styles.metricValue, { color: m.label === 'Duty Status' ? (isCheckedOut ? '#10B981' : isCheckedIn ? colors.primary : theme.textSecondary) : theme.text }]}>
                  {m.value}
                </Text>
              </View>
            </Card>
          ))}
        </View>

        {record?.isLate && (
          <View style={styles.lateCard}>
            <Ionicons name="alert-circle" size={22} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.lateTitle}>Late Check-In Flagged</Text>
              <Text style={styles.lateSub}>Arrived {record.lateMinutes} minutes past shift schedule.</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* PhonePe-style Feedback */}
      <AttendanceFeedback
        visible={feedbackState.visible}
        message={feedbackState.message}
        subMessage={feedbackState.subMessage}
        variant={feedbackState.variant}
        onHide={hideFeedback}
      />
    </View>
  );
}

export default function AttendanceScreen() {
  return (
    <ErrorBoundary>
      <AttendanceContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 120 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  geoPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  geoText: { fontSize: 12, fontWeight: '700' },
  refreshBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(32,118,199,0.1)', alignItems: 'center', justifyContent: 'center' },
  heroCard: { borderRadius: 24, padding: 22, overflow: 'hidden' },
  heroContent: { gap: 18 },
  activeSession: { alignItems: 'center', gap: 4 },
  timerLabel: { fontSize: 11, fontWeight: '800', color: '#E0F2FE', letterSpacing: 1.5 },
  timerText: { fontSize: 46, fontWeight: '900', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  progressWrap: { width: '100%', gap: 6, alignItems: 'center', marginTop: 4 },
  progressTrack: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 999 },
  progressSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  doneSession: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  doneIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  doneSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  idleSession: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  idleIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  idleTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  idleSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  modeRow: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 14, padding: 4, gap: 4 },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 10, flexDirection: 'row', gap: 4 },
  modeBtnActive: { backgroundColor: '#FFFFFF' },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  modeBtnTextActive: { color: colors.primary },
  actionContainer: { width: '100%' },
  actionBtn: { borderRadius: 16, overflow: 'hidden' },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnGradient: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  syncedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  syncedText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5 },
  navRow: { gap: 8 },
  navCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, borderWidth: 1 },
  navIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 14, fontWeight: '700' },
  navSub: { fontSize: 12, marginTop: 1 },
  taskSection: { gap: 10 },
  taskSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionSub: { fontSize: 12, marginTop: 2 },
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  manageBtnText: { fontSize: 12, fontWeight: '700' },
  taskProgressCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', height: 6 },
  taskProgressTrack: { flex: 1, backgroundColor: 'transparent' },
  taskProgressFill: { height: '100%', borderRadius: 999 },
  tasksListContainer: { gap: 8 },
  moreTasksBtn: { padding: 10, alignItems: 'center' },
  moreTasksText: { fontSize: 13, fontWeight: '700' },
  emptyTaskCard: { padding: 28, alignItems: 'center', gap: 8 },
  emptyTaskTitle: { fontSize: 15, fontWeight: '800' },
  emptyTaskSub: { fontSize: 13, textAlign: 'center' },
  sectionHeading: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  metricIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: 11, fontWeight: '600' },
  metricValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  lateCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 16, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  lateTitle: { fontSize: 14, fontWeight: '800', color: '#D97706' },
  lateSub: { fontSize: 12, color: '#92400E', marginTop: 2 },
});

