import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { attendanceApi } from '../../../api/attendance.api';
import { employeeApi } from '../../../api/employee.api';
import { taskApi, TaskItem } from '../../../api/task.api';
import { useTaskStore } from '../../../store/task.store';
import { useUIStore } from '../../../store/ui.store';
import { useAttendanceFeedback } from '../../../hooks/useAttendanceFeedback';
import { getLocation } from '../../../services/locationService';
import { colors } from '../../../constants/colors';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { AttendanceFeedback } from '../../../components/ui/AttendanceFeedback';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import NetInfo from '@react-native-community/netinfo';

function CheckOutTasksContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    latitude?: string;
    longitude?: string;
  }>();

  const qc = useQueryClient();
  const { theme, isDark } = useUIStore();
  const { tasks: storeTasks, fetchTodayTasks } = useTaskStore();
  const { feedbackState, showFeedback, hideFeedback } = useAttendanceFeedback();

  // Initialize once from store snapshot to avoid double-render
  const [sessionTasks, setSessionTasks] = useState<TaskItem[]>(() => storeTasks);
  const [closingNotes, setClosingNotes] = useState('');
  const [issuesFaced, setIssuesFaced] = useState('');
  const [managementEmps, setManagementEmps] = useState<any[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // Double-tap & concurrency prevention
  const isSubmittingRef = useRef(false);

  // Load management list for reporting
  useEffect(() => {
    employeeApi
      .getManagement()
      .then((res) => setManagementEmps(res.data.data || []))
      .catch(() => {});
  }, []);

  const completedTasks = sessionTasks.filter((t) => t.status === 'Completed');
  const pendingTasks = sessionTasks.filter((t) => t.status !== 'Completed');

  const toggleTaskStatus = (taskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSessionTasks((prev) =>
      prev.map((t) => {
        if (t._id === taskId) {
          const nextStatus = t.status === 'Completed' ? 'In Progress' : 'Completed';
          return {
            ...t,
            status: nextStatus,
            completedAt: nextStatus === 'Completed' ? new Date().toISOString() : undefined,
          };
        }
        return t;
      })
    );
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const state = await NetInfo.fetch();
      if (!state.isConnected) throw new Error('OFFLINE');

      const completedStr = completedTasks
        .map((t) => `• ${t.title}${t.description ? ` (${t.description})` : ''}`)
        .join('\n');
      const pendingStr = pendingTasks
        .map((t) => `• ${t.title}${t.dueTime ? ` [Due: ${t.dueTime}]` : ''}`)
        .join('\n');
      const todayWork =
        [completedStr, closingNotes.trim()].filter(Boolean).join('\n\nNotes:\n') ||
        'Work completed for the shift.';
      const pendingWork = pendingStr || 'No pending tasks';

      let lat =
        params.latitude && !isNaN(parseFloat(params.latitude))
          ? parseFloat(params.latitude)
          : undefined;
      let lng =
        params.longitude && !isNaN(parseFloat(params.longitude))
          ? parseFloat(params.longitude)
          : undefined;

      // Fast-path location check (cached position, 1.5s timeout)
      if (lat == null || lng == null) {
        try {
          const locResult = await getLocation({ forceRefresh: false, timeout: 1500 });
          if (locResult.type === 'success' && locResult.coords) {
            lat = locResult.coords.latitude;
            lng = locResult.coords.longitude;
          }
        } catch (_) {}
      }

      // Execute task sync and checkout in parallel with 30s timeout
      const syncPromise = taskApi.syncCheckout(sessionTasks).catch(() => {});
      const checkOutPromise = attendanceApi.checkOut({
        latitude: lat,
        longitude: lng,
        todayWork,
        pendingWork,
        issuesFaced: issuesFaced.trim() || undefined,
        reportParticipants: selectedParticipants,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 30_000)
      );

      const [_, res] = (await Promise.race([
        Promise.all([syncPromise, checkOutPromise]),
        timeoutPromise,
      ])) as any;

      return res;
    },
    onSuccess: () => {
      isSubmittingRef.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Trigger background cache updates without blocking the UI navigation transition
      qc.invalidateQueries({ queryKey: ['today-status'] });
      qc.invalidateQueries({ queryKey: ['my-attendance-summary'] });
      fetchTodayTasks().catch(() => {});

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/attendance');
      }
    },
    onError: (err: any) => {
      isSubmittingRef.current = false;
      if (err.message === 'OFFLINE') {
        showFeedback({
          message: 'No Internet Connection',
          subMessage: 'Cannot check out while offline. Please connect to the internet.',
          variant: 'error',
        });
        return;
      }
      if (err.message === 'TIMEOUT') {
        showFeedback({
          message: 'Request Timed Out',
          subMessage: 'The server took too long to complete checkout. Please retry.',
          variant: 'warning',
        });
        return;
      }
      showFeedback({
        message: 'Check-Out Failed',
        subMessage: err.response?.data?.message || 'Failed to complete check-out.',
        variant: 'error',
      });
    },
  });

  const handleConfirmCheckout = useCallback(() => {
    if (isSubmittingRef.current || checkOutMutation.isPending) return;

    if (pendingTasks.length > 0) {
      Alert.alert(
        'Pending Deliverables Remaining',
        `You have ${pendingTasks.length} pending task(s). Are you sure you want to end your shift now?`,
        [
          { text: 'Review Tasks', style: 'cancel' },
          {
            text: 'Yes, End Shift',
            style: 'destructive',
            onPress: () => {
              isSubmittingRef.current = true;
              checkOutMutation.mutate();
            },
          },
        ]
      );
    } else {
      isSubmittingRef.current = true;
      checkOutMutation.mutate();
    }
  }, [pendingTasks.length, checkOutMutation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="End Shift & Task Review" showBack />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Stats Banner */}
          <View style={[styles.statsBanner, { backgroundColor: isDark ? 'rgba(32,118,199,0.12)' : 'rgba(32,118,199,0.08)' }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.primary }]}>{sessionTasks.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Tasks</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.success }]}>{completedTasks.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Completed</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statNum,
                  { color: pendingTasks.length > 0 ? colors.warning : colors.primary },
                ]}
              >
                {pendingTasks.length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</Text>
            </View>
          </View>

          {/* Pending Tasks */}
          {pendingTasks.length > 0 && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="hourglass-outline" size={18} color={colors.warning} />
                <Text style={[styles.sectionTitle, { color: colors.warning }]}>
                  Pending Deliverables ({pendingTasks.length})
                </Text>
              </View>
              <Text style={[styles.sectionHint, { color: theme.textTertiary }]}>
                Tap the checkbox if you completed any deliverable before leaving
              </Text>
              <View style={styles.tasksList}>
                {pendingTasks.map((t) => (
                  <TouchableOpacity
                    key={t._id}
                    activeOpacity={0.8}
                    onPress={() => toggleTaskStatus(t._id)}
                    style={[styles.taskCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: t.status === 'Completed' ? colors.success : 'transparent',
                          borderColor: t.status === 'Completed' ? colors.success : theme.border,
                        },
                      ]}
                    >
                      {t.status === 'Completed' && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskTitle, { color: theme.text }]}>{t.title}</Text>
                      {t.description ? (
                        <Text style={[styles.taskDesc, { color: theme.textSecondary }]}>{t.description}</Text>
                      ) : null}
                      <Text style={[styles.taskMeta, { color: theme.textTertiary }]}>
                        {t.priority} Priority{t.dueTime ? ` · Due ${t.dueTime}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={[styles.sectionTitle, { color: colors.success }]}>
                  Completed Deliverables ({completedTasks.length})
                </Text>
              </View>
              <View style={styles.tasksList}>
                {completedTasks.map((t) => (
                  <TouchableOpacity
                    key={t._id}
                    activeOpacity={0.8}
                    onPress={() => toggleTaskStatus(t._id)}
                    style={[
                      styles.taskCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.25)',
                      },
                    ]}
                  >
                    <View style={[styles.checkbox, { backgroundColor: colors.success, borderColor: colors.success }]}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.taskTitle,
                          { color: theme.textTertiary, textDecorationLine: 'line-through' },
                        ]}
                      >
                        {t.title}
                      </Text>
                      <Text style={[styles.taskMeta, { color: colors.success }]}>Completed ✓</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {sessionTasks.length === 0 && (
            <Card style={styles.emptyCard}>
              <Ionicons name="information-circle-outline" size={32} color={colors.primary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No session tasks logged</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Please provide your end-of-day work summary below.
              </Text>
            </Card>
          )}

          {/* Handover & Remarks */}
          <Card style={styles.formCard}>
            <Text style={[styles.cardHeading, { color: theme.text }]}>Handover & Summary</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Additional Deliverable Notes (Optional)
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border },
                ]}
                placeholder="Key links, PR numbers, meeting notes, or achievements..."
                placeholderTextColor={theme.textTertiary}
                value={closingNotes}
                onChangeText={setClosingNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Issues / Blockers Faced (Optional)
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border },
                ]}
                placeholder="Any roadblocks or dependencies that held you back..."
                placeholderTextColor={theme.textTertiary}
                value={issuesFaced}
                onChangeText={setIssuesFaced}
                multiline
                numberOfLines={2}
              />
            </View>

            {managementEmps.length > 0 && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Tag Management for Daily Report
                </Text>
                <View style={styles.tagGrid}>
                  {managementEmps.map((mgr) => {
                    const selected = selectedParticipants.includes(mgr._id);
                    return (
                      <TouchableOpacity
                        key={mgr._id}
                        onPress={() => toggleParticipant(mgr._id)}
                        style={[
                          styles.tagChip,
                          {
                            backgroundColor: selected ? colors.primary : theme.surfaceAlt,
                            borderColor: selected ? colors.primary : theme.border,
                          },
                        ]}
                      >
                        <Text style={[styles.tagText, { color: selected ? '#FFFFFF' : theme.text }]}>
                          {mgr.name} ({mgr.role})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </Card>

          {/* Confirm Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              onPress={handleConfirmCheckout}
              disabled={checkOutMutation.isPending}
              activeOpacity={0.85}
              style={[
                styles.confirmBtn,
                { backgroundColor: colors.error, opacity: checkOutMutation.isPending ? 0.75 : 1 },
              ]}
            >
              {checkOutMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.confirmBtnText}>Confirm & Complete Check-Out</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Inline Feedback */}
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

export default function CheckOutTasksScreen() {
  return (
    <ErrorBoundary>
      <CheckOutTasksContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 18, paddingBottom: 80 },
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 18,
    paddingVertical: 14,
  },
  statItem: { alignItems: 'center', gap: 2 },
  statNum: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '700' },
  divider: { width: 1, height: 26 },
  sectionBlock: { gap: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHint: { fontSize: 12 },
  tasksList: { gap: 8 },
  taskCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  taskTitle: { fontSize: 14, fontWeight: '700' },
  taskDesc: { fontSize: 12, marginTop: 2 },
  taskMeta: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  emptyCard: { padding: 24, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptySub: { fontSize: 12, textAlign: 'center' },
  formCard: { padding: 18, gap: 14 },
  cardHeading: { fontSize: 15, fontWeight: '800' },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '700' },
  textArea: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 13, minHeight: 60, textAlignVertical: 'top' },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: '600' },
  bottomBar: { marginTop: 4 },
  confirmBtn: { flexDirection: 'row', height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10 },
  confirmBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});

