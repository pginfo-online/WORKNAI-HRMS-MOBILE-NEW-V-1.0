import React, { useState, useEffect } from 'react';
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
import Toast from 'react-native-toast-message';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { attendanceApi } from '../../../api/attendance.api';
import { taskApi, TaskItem, TaskPriority } from '../../../api/task.api';
import { useTaskStore } from '../../../store/task.store';
import { useUIStore } from '../../../store/ui.store';
import { colors } from '../../../constants/colors';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import NetInfo from '@react-native-community/netinfo';

interface PendingTaskDraft {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  dueTime?: string;
  isCarriedForward?: boolean;
}

const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export default function CheckInTasksScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    workMode?: string;
    latitude?: string;
    longitude?: string;
  }>();

  const qc = useQueryClient();
  const { theme } = useUIStore();
  const { fetchTodayTasks } = useTaskStore();

  const workMode = (params.workMode as 'Office' | 'WFH' | 'Field') || 'Office';
  const latitude = params.latitude ? parseFloat(params.latitude) : undefined;
  const longitude = params.longitude ? parseFloat(params.longitude) : undefined;

  // Task Input Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Medium');
  const [taskDueTime, setTaskDueTime] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // List of draft tasks for this session
  const [draftTasks, setDraftTasks] = useState<PendingTaskDraft[]>([]);
  const [carriedForwardList, setCarriedForwardList] = useState<TaskItem[]>([]);
  const [selectedCarriedIds, setSelectedCarriedIds] = useState<string[]>([]);
  const [loadingCarried, setLoadingCarried] = useState(true);

  // Fetch carried forward tasks from previous shifts
  useEffect(() => {
    taskApi.getCarriedForwardTasks()
      .then((res) => {
        const carried = res.data?.data || [];
        setCarriedForwardList(carried);
        // Automatically pre-select carried forward tasks so they stay active
        setSelectedCarriedIds(carried.map((t: TaskItem) => t._id));
      })
      .catch(() => {})
      .finally(() => setLoadingCarried(false));
  }, []);

  const handleAddDraft = () => {
    if (!taskTitle.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Task Title Required',
        text2: 'Please enter what you will deliver during this shift.',
      });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newTask: PendingTaskDraft = {
      id: Date.now().toString(),
      title: taskTitle.trim(),
      description: taskDesc.trim() || undefined,
      priority: taskPriority,
      dueTime: taskDueTime.trim() || undefined,
    };

    setDraftTasks((prev) => [...prev, newTask]);
    setTaskTitle('');
    setTaskDesc('');
    setTaskDueTime('');
    setTaskPriority('Medium');
    setShowAdvanced(false);

    Toast.show({
      type: 'success',
      text1: 'Task Added to Shift ✓',
      text2: 'You can add more or confirm check-in below.',
    });
  };

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

  const totalAssignedCount = draftTasks.length + selectedCarriedIds.length;

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const state = await NetInfo.fetch();
      if (!state.isConnected) {
        throw new Error('OFFLINE');
      }

      // 1. Perform Check-In
      await attendanceApi.checkIn({
        latitude,
        longitude,
        workMode,
      });

      // 2. Create New Draft Tasks
      for (const draft of draftTasks) {
        await taskApi.createTask({
          title: draft.title,
          description: draft.description,
          priority: draft.priority,
          dueTime: draft.dueTime,
        });
      }

      // 3. Re-assign carried forward tasks to today's shift date
      for (const carriedId of selectedCarriedIds) {
        await taskApi.updateTask(carriedId, {
          status: 'In Progress',
        });
      }
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Checked In Successfully ✓',
        text2: `${totalAssignedCount} task(s) active for today's session`,
      });

      qc.invalidateQueries({ queryKey: ['today-status'] });
      qc.invalidateQueries({ queryKey: ['my-attendance-summary'] });
      await fetchTodayTasks();

      router.replace('/(tabs)/attendance');
    },
    onError: (err: any) => {
      if (err.message === 'OFFLINE') {
        Toast.show({
          type: 'error',
          text1: 'No Connection',
          text2: 'Cannot check in while offline. Please connect to internet.',
        });
        return;
      }
      Toast.show({
        type: 'error',
        text1: 'Check-In Failed',
        text2: err.response?.data?.message || 'Server error occurred during check-in',
      });
    },
  });

  const handleConfirmCheckIn = () => {
    if (totalAssignedCount === 0) {
      Alert.alert(
        'Task Assignment Compulsory',
        'Company policy requires every employee to assign at least 1 task or carry forward a pending task before starting a work session.',
        [{ text: 'OK' }]
      );
      return;
    }
    checkInMutation.mutate();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Shift Task Assignment"
        subtitle={`Session Mode: ${workMode} · Minimum 1 Task Required`}
        showBack
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Requirement Banner */}
          <View
            style={[
              styles.reqBanner,
              {
                backgroundColor: totalAssignedCount > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                borderColor: totalAssignedCount > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)',
              },
            ]}
          >
            <Ionicons
              name={totalAssignedCount > 0 ? 'checkmark-circle' : 'information-circle'}
              size={20}
              color={totalAssignedCount > 0 ? colors.success : colors.warning}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.reqTitle,
                  { color: totalAssignedCount > 0 ? colors.success : colors.warning },
                ]}
              >
                {totalAssignedCount > 0
                  ? `${totalAssignedCount} Task(s) Active for Shift`
                  : 'Compulsory Task Assignment'}
              </Text>
              <Text style={[styles.reqSub, { color: theme.textSecondary }]}>
                {totalAssignedCount > 0
                  ? 'Ready to start shift. Tasks are synchronized with your attendance.'
                  : 'Assign new tasks or carry forward pending tasks before starting your timer.'}
              </Text>
            </View>
          </View>

          {/* Carried Forward Tasks Section */}
          {carriedForwardList.length > 0 && (
            <View style={styles.carriedSection}>
              <View style={styles.carriedSectionHeader}>
                <Ionicons name="repeat" size={16} color={colors.primary} />
                <Text style={[styles.sectionHeading, { color: theme.textSecondary, flex: 1 }]}>
                  Carried Forward from Previous Shifts ({carriedForwardList.length})
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
                          backgroundColor: isSelected ? 'rgba(32,118,199,0.06)' : theme.surface,
                          borderColor: isSelected ? colors.primary : theme.border,
                        },
                      ]}
                    >
                      <View style={[styles.checkbox, { backgroundColor: isSelected ? colors.primary : 'transparent', borderColor: isSelected ? colors.primary : theme.border }]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.draftTitle, { color: theme.text }]}>{item.title}</Text>
                        <Text style={[styles.draftDesc, { color: theme.textSecondary }]}>
                          Pending from {new Date(item.date).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={[styles.priorityPill, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                        <Text style={[styles.priorityPillText, { color: colors.warning }]}>
                          Carried Forward
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Task Entry Card */}
          <Card style={styles.formCard}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Assign New Task</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Task Title *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border },
                ]}
                placeholder="e.g. Design payroll calculation flow and test edge cases"
                placeholderTextColor={theme.textTertiary}
                value={taskTitle}
                onChangeText={setTaskTitle}
              />
            </View>

            {/* Priority Selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Priority Level</Text>
              <View style={styles.priorityRow}>
                {PRIORITIES.map((p) => {
                  const active = taskPriority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setTaskPriority(p);
                      }}
                      style={[
                        styles.priorityChip,
                        {
                          backgroundColor: active ? colors.primary : theme.surfaceAlt,
                          borderColor: active ? colors.primary : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.priorityChipText,
                          { color: active ? '#FFFFFF' : theme.text },
                        ]}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Optional Details Toggle */}
            <TouchableOpacity
              onPress={() => setShowAdvanced(!showAdvanced)}
              style={styles.toggleRow}
            >
              <Text style={[styles.toggleText, { color: colors.primary }]}>
                {showAdvanced ? 'Hide Optional Details' : '+ Add Due Time & Description'}
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
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Target Due Time
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border },
                    ]}
                    placeholder="e.g. 05:30 PM"
                    placeholderTextColor={theme.textTertiary}
                    value={taskDueTime}
                    onChangeText={setTaskDueTime}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Description / Scope
                  </Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border },
                    ]}
                    placeholder="Provide acceptance criteria, notes, or subtasks..."
                    placeholderTextColor={theme.textTertiary}
                    value={taskDesc}
                    onChangeText={setTaskDesc}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleAddDraft}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Task to Shift</Text>
            </TouchableOpacity>
          </Card>

          {/* New Assigned Tasks List */}
          {draftTasks.length > 0 && (
            <View style={styles.tasksSection}>
              <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                New Tasks Created for This Session ({draftTasks.length})
              </Text>

              <View style={styles.draftList}>
                {draftTasks.map((t, idx) => (
                  <View
                    key={t.id}
                    style={[
                      styles.draftCard,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <View style={styles.draftIndex}>
                      <Text style={styles.draftIndexText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.draftTitle, { color: theme.text }]}>{t.title}</Text>
                      {t.description ? (
                        <Text style={[styles.draftDesc, { color: theme.textSecondary }]}>
                          {t.description}
                        </Text>
                      ) : null}
                      <View style={styles.draftMetaRow}>
                        <View style={[styles.priorityPill, { backgroundColor: 'rgba(32,118,199,0.1)' }]}>
                          <Text style={[styles.priorityPillText, { color: colors.primary }]}>
                            {t.priority}
                          </Text>
                        </View>
                        {t.dueTime ? (
                          <Text style={[styles.draftDue, { color: theme.textTertiary }]}>
                            Due: {t.dueTime}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveDraft(t.id)}
                      style={styles.removeBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Bottom Confirmation Action */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              onPress={handleConfirmCheckIn}
              disabled={checkInMutation.isPending || totalAssignedCount === 0}
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: totalAssignedCount > 0 ? colors.success : '#94A3B8',
                  opacity: checkInMutation.isPending ? 0.6 : 1,
                },
              ]}
            >
              {checkInMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.confirmBtnText}>
                    {totalAssignedCount > 0
                      ? `Confirm Check-In (${totalAssignedCount} Tasks)`
                      : 'Assign or Select 1 Task to Check In'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 50 },
  reqBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  reqTitle: { fontSize: 14, fontWeight: '800' },
  reqSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  carriedSection: { gap: 10 },
  carriedSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeading: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  carriedList: { gap: 8 },
  carriedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  formCard: { padding: 18, gap: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '700' },
  textInput: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  textArea: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 64, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  priorityChipText: { fontSize: 12, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  toggleText: { fontSize: 13, fontWeight: '700' },
  advancedSection: { gap: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 12, marginTop: 4 },
  addBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  tasksSection: { gap: 10 },
  draftList: { gap: 10 },
  draftCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  draftIndex: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(32,118,199,0.1)', alignItems: 'center', justifyContent: 'center' },
  draftIndexText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  draftTitle: { fontSize: 14, fontWeight: '700' },
  draftDesc: { fontSize: 12 },
  draftMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  priorityPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priorityPillText: { fontSize: 11, fontWeight: '700' },
  draftDue: { fontSize: 11, fontWeight: '600' },
  removeBtn: { padding: 6 },
  bottomBar: { marginTop: 8 },
  confirmBtn: { flexDirection: 'row', height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
