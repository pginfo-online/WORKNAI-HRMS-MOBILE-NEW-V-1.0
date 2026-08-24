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
import { employeeApi } from '../../../api/employee.api';
import { taskApi, TaskItem } from '../../../api/task.api';
import { useTaskStore } from '../../../store/task.store';
import { useUIStore } from '../../../store/ui.store';
import { colors } from '../../../constants/colors';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import NetInfo from '@react-native-community/netinfo';

export default function CheckOutTasksScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    latitude?: string;
    longitude?: string;
  }>();

  const qc = useQueryClient();
  const { theme } = useUIStore();
  const { tasks: storeTasks, fetchTodayTasks } = useTaskStore();

  const [sessionTasks, setSessionTasks] = useState<TaskItem[]>(storeTasks);
  const [closingNotes, setClosingNotes] = useState('');
  const [issuesFaced, setIssuesFaced] = useState('');
  const [managementEmps, setManagementEmps] = useState<any[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  useEffect(() => {
    setSessionTasks(storeTasks);
  }, [storeTasks]);

  useEffect(() => {
    employeeApi.getManagement()
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
      if (!state.isConnected) {
        throw new Error('OFFLINE');
      }

      // 1. Sync updated task states in bulk
      await taskApi.syncCheckout(sessionTasks);

      // 2. Prepare todayWork and pendingWork summaries
      const completedStr = completedTasks
        .map((t) => `• ${t.title}${t.description ? ` (${t.description})` : ''}`)
        .join('\n');

      const pendingStr = pendingTasks
        .map((t) => `• ${t.title}${t.dueTime ? ` [Due: ${t.dueTime}]` : ''}`)
        .join('\n');

      const todayWork = [completedStr, closingNotes.trim()].filter(Boolean).join('\n\nNotes:\n') || 'Work completed for the shift.';
      const pendingWork = pendingStr || 'No pending tasks';

      const lat = params.latitude ? parseFloat(params.latitude) : undefined;
      const lng = params.longitude ? parseFloat(params.longitude) : undefined;

      const res = await attendanceApi.checkOut({
        latitude: lat,
        longitude: lng,
        todayWork,
        pendingWork,
        issuesFaced: issuesFaced.trim() || undefined,
        reportParticipants: selectedParticipants,
      });

      return res;
    },
    onSuccess: async (res) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const totalHrs = res.data.data?.totalHours || 0;
      Toast.show({
        type: 'success',
        text1: 'Checked Out Successfully ✓',
        text2: `Logged ${totalHrs.toFixed(1)} hrs · Tasks updated`,
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
          text2: 'Cannot check out while offline. Please connect to internet.',
        });
        return;
      }
      Toast.show({
        type: 'error',
        text1: 'Check-Out Failed',
        text2: err.response?.data?.message || 'Failed to complete check-out',
      });
    }
  });

  const handleConfirmCheckout = () => {
    if (pendingTasks.length > 0) {
      Alert.alert(
        'Pending Tasks Remaining',
        `You have ${pendingTasks.length} pending task(s). Are you sure you want to end your shift now?`,
        [
          { text: 'Review Tasks', style: 'cancel' },
          {
            text: 'Yes, End Shift',
            style: 'destructive',
            onPress: () => checkOutMutation.mutate(),
          },
        ]
      );
    } else {
      checkOutMutation.mutate();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="End Shift & Task Review"
        subtitle="Review Deliverables & Closing Summary"
        showBack
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Summary Stat Banner */}
          <View style={styles.statsBanner}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{sessionTasks.length}</Text>
              <Text style={styles.statLabel}>Total Tasks</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.success }]}>
                {completedTasks.length}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: pendingTasks.length > 0 ? colors.warning : colors.primary }]}>
                {pendingTasks.length}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>

          {/* 1. Pending Tasks Section */}
          {pendingTasks.length > 0 && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="hourglass-outline" size={18} color={colors.warning} />
                <Text style={[styles.sectionTitle, { color: colors.warning }]}>
                  Pending Deliverables ({pendingTasks.length})
                </Text>
              </View>
              <Text style={[styles.sectionHint, { color: theme.textTertiary }]}>
                Tap the checkbox if you completed any task before leaving
              </Text>

              <View style={styles.tasksList}>
                {pendingTasks.map((t) => (
                  <TouchableOpacity
                    key={t._id}
                    activeOpacity={0.8}
                    onPress={() => toggleTaskStatus(t._id)}
                    style={[
                      styles.taskCard,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <View style={[styles.checkbox, { borderColor: theme.border }]}>
                      {t.status === 'Completed' && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskTitle, { color: theme.text }]}>{t.title}</Text>
                      {t.description ? (
                        <Text style={[styles.taskDesc, { color: theme.textSecondary }]}>
                          {t.description}
                        </Text>
                      ) : null}
                      <Text style={[styles.taskMeta, { color: theme.textTertiary }]}>
                        {t.priority} Priority {t.dueTime ? `· Due ${t.dueTime}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 2. Completed Tasks Section */}
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
                      { backgroundColor: theme.surface, borderColor: 'rgba(16,185,129,0.25)' },
                    ]}
                  >
                    <View style={[styles.checkbox, { backgroundColor: colors.success, borderColor: colors.success }]}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.taskTitle,
                          { color: theme.textSecondary, textDecorationLine: 'line-through' },
                        ]}
                      >
                        {t.title}
                      </Text>
                      <Text style={[styles.taskMeta, { color: colors.success }]}>
                        Completed ✓
                      </Text>
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
                placeholder="Any links, PR numbers, meeting notes, or achievements..."
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

            {/* Notify Managers */}
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
              style={[
                styles.confirmBtn,
                { backgroundColor: colors.error, opacity: checkOutMutation.isPending ? 0.6 : 1 },
              ]}
            >
              {checkOutMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.confirmBtnText}>
                    Confirm & Complete Check-Out
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
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 18,
    paddingBottom: 50,
  },
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(32,118,199,0.08)',
    borderRadius: 18,
    paddingVertical: 14,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statNum: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  divider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 12,
  },
  tasksList: {
    gap: 8,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  taskDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  taskMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
  },
  formCard: {
    padding: 18,
    gap: 14,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: '800',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bottomBar: {
    marginTop: 4,
  },
  confirmBtn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
