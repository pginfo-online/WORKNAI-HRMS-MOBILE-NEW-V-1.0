import React, { useState, useRef, useCallback } from 'react';
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
import { taskApi, TaskPriority } from '../../../api/task.api';
import { useTaskStore } from '../../../store/task.store';
import { useUIStore } from '../../../store/ui.store';
import { useAttendanceFeedback } from '../../../hooks/useAttendanceFeedback';
import { colors } from '../../../constants/colors';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { AttendanceFeedback } from '../../../components/ui/AttendanceFeedback';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import NetInfo from '@react-native-community/netinfo';

interface PendingTaskDraft {
  id: string;
  title: string;
  priority: TaskPriority;
}

interface PriorityOption {
  key: TaskPriority;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  border: string;
}

const PRIORITY_OPTIONS: PriorityOption[] = [
  { key: 'Low', label: 'Low', icon: 'shield-outline', color: '#64748B', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' },
  { key: 'Medium', label: 'Medium', icon: 'flag-outline', color: colors.primary, bg: 'rgba(32,118,199,0.1)', border: 'rgba(32,118,199,0.25)' },
  { key: 'High', label: 'High', icon: 'flash-outline', color: '#D97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.25)' },
  { key: 'Urgent', label: 'Urgent', icon: 'alert-circle-outline', color: '#DC2626', bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.25)' },
];

function CheckInTasksContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    workMode?: string;
    latitude?: string;
    longitude?: string;
  }>();

  const qc = useQueryClient();
  const { theme, isDark } = useUIStore();
  const { fetchTodayTasks } = useTaskStore();
  const { feedbackState, showFeedback, hideFeedback } = useAttendanceFeedback();

  const workMode = (params.workMode === 'WFH' ? 'WFH' : 'Office') as 'Office' | 'WFH';
  const latitude = params.latitude && !isNaN(parseFloat(params.latitude)) ? parseFloat(params.latitude) : undefined;
  const longitude = params.longitude && !isNaN(parseFloat(params.longitude)) ? parseFloat(params.longitude) : undefined;

  // Form inputs (Title and Priority only)
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Medium');
  const [titleError, setTitleError] = useState(false);

  const titleInputRef = useRef<TextInput>(null);

  // Draft list
  const [draftTasks, setDraftTasks] = useState<PendingTaskDraft[]>([]);
  const isSubmittingRef = useRef(false);

  const handleAddDraft = useCallback(() => {
    if (!taskTitle.trim()) {
      setTitleError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      titleInputRef.current?.focus();
      return;
    }
    setTitleError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setDraftTasks((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        title: taskTitle.trim(),
        priority: taskPriority,
      },
    ]);

    setTaskTitle('');
    setTaskPriority('Medium');

    showFeedback({ message: 'Task added to shift', variant: 'success', duration: 1800 });
  }, [taskTitle, taskPriority, showFeedback]);

  const handleRemoveDraft = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const state = await NetInfo.fetch();
      if (!state.isConnected) throw new Error('OFFLINE');

      // Atomic check-in with shift tasks
      const checkInPromise = attendanceApi.checkIn({
        latitude,
        longitude,
        workMode,
        tasks: draftTasks.map((draft) => ({
          title: draft.title,
          priority: draft.priority,
        })),
      });

      // 30s hard timeout guard
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 30_000)
      );

      await Promise.race([checkInPromise, timeoutPromise]);
      return {};
    },
    onSuccess: () => {
      isSubmittingRef.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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
          subMessage: 'Cannot check in while offline. Please connect to the internet.',
          variant: 'error',
        });
        return;
      }
      if (err.message === 'TIMEOUT') {
        showFeedback({
          message: 'Request Timed Out',
          subMessage: 'The server took too long to respond. Please check your connection and retry.',
          variant: 'warning',
        });
        return;
      }
      showFeedback({
        message: 'Check-In Failed',
        subMessage: err.response?.data?.message || 'Server error occurred during check-in.',
        variant: 'error',
      });
    },
  });

  const handleConfirmCheckIn = useCallback(() => {
    if (isSubmittingRef.current || checkInMutation.isPending) return;

    if (draftTasks.length === 0) {
      Alert.alert(
        'Task Required for Shift',
        'Please add at least 1 task title and priority before starting your work session.',
        [{ text: 'OK', onPress: () => titleInputRef.current?.focus() }]
      );
      return;
    }

    isSubmittingRef.current = true;
    checkInMutation.mutate();
  }, [draftTasks.length, checkInMutation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Shift Task Assignment"
        subtitle={`Session Mode: ${workMode} · Title & Priority Required`}
        showBack
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Status Header Banner */}
          <View
            style={[
              styles.reqBanner,
              {
                backgroundColor: draftTasks.length > 0 ? (isDark ? '#064E3B' : 'rgba(16,185,129,0.1)') : (isDark ? '#451A03' : 'rgba(245,158,11,0.1)'),
                borderColor: draftTasks.length > 0 ? colors.success : colors.warning,
              },
            ]}
          >
            <Ionicons
              name={draftTasks.length > 0 ? 'checkmark-circle' : 'information-circle'}
              size={22}
              color={draftTasks.length > 0 ? colors.success : colors.warning}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.reqTitle, { color: draftTasks.length > 0 ? (isDark ? '#34D399' : colors.success) : (isDark ? '#FBBF24' : colors.warning) }]}>
                {draftTasks.length > 0 ? `${draftTasks.length} Task(s) Added for Shift` : 'Task Assignment Required'}
              </Text>
              <Text style={[styles.reqSub, { color: isDark ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                {draftTasks.length > 0
                  ? 'Ready to check in. These deliverables will be tracked for your shift today.'
                  : 'Add the deliverables you plan to work on today (Title & Priority only).'}
              </Text>
            </View>
          </View>

          {/* New Task Form Card */}
          <Card style={styles.formCard}>
            <View style={styles.formHeader}>
              <View style={[styles.formIconCircle, { backgroundColor: 'rgba(32,118,199,0.1)' }]}>
                <Ionicons name="add-circle" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Add Shift Deliverable</Text>
            </View>

            {/* Task Title */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Task Title *</Text>
              <TextInput
                ref={titleInputRef}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.surfaceAlt,
                    color: theme.text,
                    borderColor: titleError ? colors.error : theme.border,
                  },
                ]}
                placeholder="e.g. Design authentication token refresh flow"
                placeholderTextColor={theme.textTertiary}
                value={taskTitle}
                onChangeText={(t) => {
                  setTaskTitle(t);
                  if (titleError) setTitleError(false);
                }}
                returnKeyType="done"
                maxLength={120}
              />
              {titleError && (
                <Text style={styles.errorText}>Please provide a title for this deliverable</Text>
              )}
            </View>

            {/* Priority Selection Grid */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Priority Level</Text>
              <View style={styles.priorityGrid}>
                {PRIORITY_OPTIONS.map((opt) => {
                  const active = taskPriority === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setTaskPriority(opt.key);
                      }}
                      activeOpacity={0.8}
                      style={[
                        styles.priorityCard,
                        {
                          backgroundColor: active ? (isDark ? 'rgba(32,118,199,0.2)' : opt.bg) : theme.surfaceAlt,
                          borderColor: active ? opt.color : theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={16}
                        color={active ? opt.color : theme.textTertiary}
                      />
                      <Text
                        style={[
                          styles.priorityCardText,
                          { color: active ? opt.color : theme.textSecondary, fontWeight: active ? '800' : '600' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Add Task Button */}
            <TouchableOpacity
              onPress={handleAddDraft}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addBtnText}>+ Add Task to Shift</Text>
            </TouchableOpacity>
          </Card>

          {/* Draft Tasks List */}
          {draftTasks.length > 0 && (
            <View style={styles.draftSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="list" size={16} color={colors.primary} />
                <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                  Shift Deliverables ({draftTasks.length})
                </Text>
              </View>
              <View style={styles.draftList}>
                {draftTasks.map((t, idx) => (
                  <View
                    key={t.id}
                    style={[styles.draftCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <View style={styles.draftIndex}>
                      <Text style={styles.draftIndexText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[styles.taskTitleText, { color: theme.text }]}>{t.title}</Text>
                      <View style={styles.draftMetaRow}>
                        <View style={[styles.priorityPill, { backgroundColor: 'rgba(32,118,199,0.1)' }]}>
                          <Text style={[styles.priorityPillText, { color: colors.primary }]}>{t.priority}</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveDraft(t.id)}
                      style={styles.removeBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Confirm Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              onPress={handleConfirmCheckIn}
              disabled={checkInMutation.isPending || draftTasks.length === 0}
              activeOpacity={0.85}
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: draftTasks.length > 0 ? colors.success : '#94A3B8',
                  opacity: checkInMutation.isPending ? 0.75 : 1,
                },
              ]}
            >
              {checkInMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.confirmBtnText}>
                    {draftTasks.length > 0
                      ? `Confirm Check-In (${draftTasks.length} Task${draftTasks.length > 1 ? 's' : ''})`
                      : 'Add at Least 1 Task to Check In'}
                  </Text>
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

export default function CheckInTasksScreen() {
  return (
    <ErrorBoundary>
      <CheckInTasksContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 80 },
  reqBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5 },
  reqTitle: { fontSize: 14, fontWeight: '800' },
  reqSub: { fontSize: 12, lineHeight: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionHeading: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  taskTitleText: { fontSize: 14, fontWeight: '700' },
  formCard: { padding: 18, gap: 14 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  formIconCircle: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '700' },
  textInput: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  errorText: { fontSize: 11, color: colors.error, fontWeight: '600' },
  priorityGrid: { flexDirection: 'row', gap: 8 },
  priorityCard: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  priorityCardText: { fontSize: 12 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 12,
    marginTop: 4,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  draftSection: { gap: 8 },
  draftList: { gap: 8 },
  draftCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  draftIndex: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(32,118,199,0.1)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  draftIndexText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  draftMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  priorityPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priorityPillText: { fontSize: 11, fontWeight: '700' },
  removeBtn: { padding: 4 },
  bottomBar: { marginTop: 8 },
  confirmBtn: { flexDirection: 'row', height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10 },
  confirmBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
