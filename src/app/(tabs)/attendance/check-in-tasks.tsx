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
import { taskApi, TaskItem, TaskPriority } from '../../../api/task.api';
import { useTaskStore } from '../../../store/task.store';
import { useUIStore } from '../../../store/ui.store';
import { useAttendanceFeedback } from '../../../hooks/useAttendanceFeedback';
import { colors } from '../../../constants/colors';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';
import { AttendanceFeedback } from '../../../components/ui/AttendanceFeedback';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import NetInfo from '@react-native-community/netinfo';

interface PendingTaskDraft {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  dueTime?: string;
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

  const workMode = (params.workMode as 'Office' | 'WFH' | 'Field') || 'Office';
  const latitude = params.latitude && !isNaN(parseFloat(params.latitude)) ? parseFloat(params.latitude) : undefined;
  const longitude = params.longitude && !isNaN(parseFloat(params.longitude)) ? parseFloat(params.longitude) : undefined;

  // Form inputs
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Medium');
  const [taskDueTime, setTaskDueTime] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [titleError, setTitleError] = useState(false);

  // Input refs for smooth keyboard management
  const titleInputRef = useRef<TextInput>(null);
  const dueTimeInputRef = useRef<TextInput>(null);
  const descInputRef = useRef<TextInput>(null);

  // Draft / carried forward lists
  const [draftTasks, setDraftTasks] = useState<PendingTaskDraft[]>([]);
  const [carriedForwardList, setCarriedForwardList] = useState<TaskItem[]>([]);
  const [selectedCarriedIds, setSelectedCarriedIds] = useState<string[]>([]);
  const [loadingCarried, setLoadingCarried] = useState(true);

  // Double-tap & concurrency guard
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    taskApi
      .getCarriedForwardTasks()
      .then((res) => {
        const carried = res.data?.data || [];
        setCarriedForwardList(carried);
        setSelectedCarriedIds(carried.map((t: TaskItem) => t._id));
      })
      .catch(() => {})
      .finally(() => setLoadingCarried(false));
  }, []);

  const totalAssignedCount = draftTasks.length + selectedCarriedIds.length;

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
        description: taskDesc.trim() || undefined,
        priority: taskPriority,
        dueTime: taskDueTime.trim() || undefined,
      },
    ]);

    setTaskTitle('');
    setTaskDesc('');
    setTaskDueTime('');
    setTaskPriority('Medium');
    setShowAdvanced(false);

    showFeedback({ message: 'Task added to shift', variant: 'success', duration: 1800 });
  }, [taskTitle, taskDesc, taskPriority, taskDueTime, showFeedback]);

  const handleRemoveDraft = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleCarriedTask = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCarriedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const state = await NetInfo.fetch();
      if (!state.isConnected) throw new Error('OFFLINE');

      // Execute check-in and task operations in parallel
      const checkInPromise = attendanceApi.checkIn({ latitude, longitude, workMode });

      const taskPromises = [
        ...draftTasks.map((draft) =>
          taskApi.createTask({
            title: draft.title,
            description: draft.description,
            priority: draft.priority,
            dueTime: draft.dueTime,
          }).catch((err) => {
            console.warn('[CheckIn] Task create error:', draft.title, err);
          })
        ),
        ...selectedCarriedIds.map((carriedId) =>
          taskApi.updateTask(carriedId, { status: 'In Progress' }).catch((err) => {
            console.warn('[CheckIn] Carried task activate error:', carriedId, err);
          })
        ),
      ];

      // 30s hard timeout guard
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 30_000)
      );

      await Promise.race([Promise.all([checkInPromise, ...taskPromises]), timeoutPromise]);
      return {};
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

    if (totalAssignedCount === 0) {
      Alert.alert(
        'Task Assignment Required',
        'Company policy requires at least 1 task before starting a work session.',
        [{ text: 'OK', onPress: () => titleInputRef.current?.focus() }]
      );
      return;
    }

    isSubmittingRef.current = true;
    checkInMutation.mutate();
  }, [totalAssignedCount, checkInMutation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Shift Task Assignment"
        subtitle={`Session Mode: ${workMode} · Min. 1 Task Required`}
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
                backgroundColor: totalAssignedCount > 0 ? (isDark ? '#064E3B' : 'rgba(16,185,129,0.1)') : (isDark ? '#451A03' : 'rgba(245,158,11,0.1)'),
                borderColor: totalAssignedCount > 0 ? colors.success : colors.warning,
              },
            ]}
          >
            <Ionicons
              name={totalAssignedCount > 0 ? 'checkmark-circle' : 'information-circle'}
              size={22}
              color={totalAssignedCount > 0 ? colors.success : colors.warning}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.reqTitle, { color: totalAssignedCount > 0 ? (isDark ? '#34D399' : colors.success) : (isDark ? '#FBBF24' : colors.warning) }]}>
                {totalAssignedCount > 0 ? `${totalAssignedCount} Task(s) Active for Shift` : 'Task Assignment Required'}
              </Text>
              <Text style={[styles.reqSub, { color: isDark ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                {totalAssignedCount > 0
                  ? 'All set to start your shift. Tasks are synchronized with your attendance.'
                  : 'Assign new deliverables or select carried tasks below.'}
              </Text>
            </View>
          </View>

          {/* Carried Forward Section */}
          {loadingCarried ? (
            <Skeleton width="100%" height={72} borderRadius={16} />
          ) : carriedForwardList.length > 0 ? (
            <View style={styles.carriedSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="repeat" size={16} color={colors.primary} />
                <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                  Carried Forward ({carriedForwardList.length})
                </Text>
              </View>
              <View style={styles.carriedList}>
                {carriedForwardList.map((item) => {
                  const isSelected = selectedCarriedIds.includes(item._id);
                  return (
                    <TouchableOpacity
                      key={item._id}
                      onPress={() => toggleCarriedTask(item._id)}
                      activeOpacity={0.8}
                      style={[
                        styles.carriedCard,
                        {
                          backgroundColor: isSelected ? (isDark ? 'rgba(32,118,199,0.15)' : 'rgba(32,118,199,0.06)') : theme.surface,
                          borderColor: isSelected ? colors.primary : theme.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          {
                            backgroundColor: isSelected ? colors.primary : 'transparent',
                            borderColor: isSelected ? colors.primary : theme.border,
                          },
                        ]}
                      >
                        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.taskTitleText, { color: theme.text }]}>{item.title}</Text>
                        <Text style={[styles.taskSubText, { color: theme.textSecondary }]}>
                          Pending from {new Date(item.date).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={[styles.carriedPill, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                        <Text style={[styles.carriedPillText, { color: colors.warning }]}>Carried</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* New Task Form Card */}
          <Card style={styles.formCard}>
            <View style={styles.formHeader}>
              <View style={[styles.formIconCircle, { backgroundColor: 'rgba(32,118,199,0.1)' }]}>
                <Ionicons name="add-circle" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Add New Deliverable</Text>
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

            {/* Expandable Advanced Options */}
            <TouchableOpacity
              onPress={() => setShowAdvanced(!showAdvanced)}
              style={[styles.toggleRow, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
              activeOpacity={0.75}
            >
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={[styles.toggleText, { color: colors.primary, flex: 1 }]}>
                {showAdvanced ? 'Hide Optional Scope & Due Time' : '+ Add Due Time & Scope Description'}
              </Text>
              <Ionicons
                name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.primary}
              />
            </TouchableOpacity>

            {showAdvanced && (
              <View style={styles.advancedSection}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Target Due Time</Text>
                  <TextInput
                    ref={dueTimeInputRef}
                    style={[styles.textInput, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                    placeholder="e.g. 05:30 PM"
                    placeholderTextColor={theme.textTertiary}
                    value={taskDueTime}
                    onChangeText={setTaskDueTime}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Description / Acceptance Scope</Text>
                  <TextInput
                    ref={descInputRef}
                    style={[styles.textArea, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                    placeholder="Key deliverables, PR numbers, or acceptance criteria..."
                    placeholderTextColor={theme.textTertiary}
                    value={taskDesc}
                    onChangeText={setTaskDesc}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            )}

            {/* Add Task Button */}
            <TouchableOpacity
              onPress={handleAddDraft}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Deliverable to Shift</Text>
            </TouchableOpacity>
          </Card>

          {/* Draft Tasks List */}
          {draftTasks.length > 0 && (
            <View style={styles.draftSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="list" size={16} color={colors.primary} />
                <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                  New Tasks for This Session ({draftTasks.length})
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
                      {t.description ? (
                        <Text style={[styles.taskSubText, { color: theme.textSecondary }]} numberOfLines={2}>
                          {t.description}
                        </Text>
                      ) : null}
                      <View style={styles.draftMetaRow}>
                        <View style={[styles.priorityPill, { backgroundColor: 'rgba(32,118,199,0.1)' }]}>
                          <Text style={[styles.priorityPillText, { color: colors.primary }]}>{t.priority}</Text>
                        </View>
                        {t.dueTime ? (
                          <View style={styles.dueWrap}>
                            <Ionicons name="time-outline" size={12} color={theme.textTertiary} />
                            <Text style={[styles.dueText, { color: theme.textTertiary }]}>{t.dueTime}</Text>
                          </View>
                        ) : null}
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
              disabled={checkInMutation.isPending || totalAssignedCount === 0}
              activeOpacity={0.85}
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: totalAssignedCount > 0 ? colors.success : '#94A3B8',
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
                    {totalAssignedCount > 0
                      ? `Confirm Check-In (${totalAssignedCount} Task${totalAssignedCount > 1 ? 's' : ''})`
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
  carriedSection: { gap: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionHeading: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  carriedList: { gap: 8 },
  carriedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  taskTitleText: { fontSize: 14, fontWeight: '700' },
  taskSubText: { fontSize: 12, marginTop: 1 },
  carriedPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  carriedPillText: { fontSize: 11, fontWeight: '700' },
  formCard: { padding: 18, gap: 14 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  formIconCircle: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '700' },
  textInput: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  textArea: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 13, minHeight: 68, textAlignVertical: 'top' },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleText: { fontSize: 12, fontWeight: '700' },
  advancedSection: { gap: 12 },
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
  dueWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dueText: { fontSize: 11, fontWeight: '600' },
  removeBtn: { padding: 4 },
  bottomBar: { marginTop: 8 },
  confirmBtn: { flexDirection: 'row', height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10 },
  confirmBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
;
