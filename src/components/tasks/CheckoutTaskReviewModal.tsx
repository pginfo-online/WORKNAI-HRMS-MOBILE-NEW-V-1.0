import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TaskItem } from '../../api/task.api';
import { useUIStore } from '../../store/ui.store';
import { colors } from '../../constants/colors';

interface CheckoutTaskReviewModalProps {
  visible: boolean;
  tasks: TaskItem[];
  onClose: () => void;
  onConfirmCheckout: (sessionData: {
    tasks: TaskItem[];
    todayWork: string;
    pendingWork: string;
    issuesFaced?: string;
    reportParticipants?: string[];
  }) => Promise<void>;
  isSubmitting?: boolean;
  managementEmps?: any[];
}

export const CheckoutTaskReviewModal: React.FC<CheckoutTaskReviewModalProps> = ({
  visible,
  tasks: initialTasks,
  onClose,
  onConfirmCheckout,
  isSubmitting = false,
  managementEmps = [],
}) => {
  const { theme } = useUIStore();
  const [sessionTasks, setSessionTasks] = useState<TaskItem[]>(initialTasks);
  const [closingNotes, setClosingNotes] = useState('');
  const [issuesFaced, setIssuesFaced] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // Keep local tasks updated when modal opens
  React.useEffect(() => {
    setSessionTasks(initialTasks);
  }, [initialTasks, visible]);

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

  const handleCheckoutSubmit = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Generate formatted tasks summary
    const completedStr = completedTasks
      .map((t, idx) => `• ${t.title}${t.description ? ` (${t.description})` : ''}`)
      .join('\n');

    const pendingStr = pendingTasks
      .map((t, idx) => `• ${t.title}${t.dueTime ? ` [Due: ${t.dueTime}]` : ''}`)
      .join('\n');

    const todayWork = [completedStr, closingNotes.trim()].filter(Boolean).join('\n\nNotes:\n');
    const pendingWork = pendingStr || 'No pending tasks';

    await onConfirmCheckout({
      tasks: sessionTasks,
      todayWork: todayWork || 'Work completed for the day.',
      pendingWork,
      issuesFaced: issuesFaced.trim() || undefined,
      reportParticipants: selectedParticipants,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => !isSubmitting && onClose()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>End Shift & Task Review</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Review today's deliverables before signing off
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Stats Summary Banner */}
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. Pending Tasks Section */}
            {pendingTasks.length > 0 && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
                  <Text style={[styles.sectionHeading, { color: colors.warning }]}>
                    Pending Tasks ({pendingTasks.length})
                  </Text>
                </View>
                <Text style={[styles.sectionHint, { color: theme.textTertiary }]}>
                  Tap the checkmark if you completed any before leaving
                </Text>

                <View style={styles.taskList}>
                  {pendingTasks.map((t) => (
                    <TouchableOpacity
                      key={t._id}
                      activeOpacity={0.8}
                      onPress={() => toggleTaskStatus(t._id)}
                      style={[
                        styles.taskRow,
                        { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                      ]}
                    >
                      <View style={[styles.checkbox, { borderColor: theme.border }]}>
                        {t.status === 'Completed' && (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.taskTitle, { color: theme.text }]}>
                          {t.title}
                        </Text>
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
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={[styles.sectionHeading, { color: colors.success }]}>
                    Completed Deliverables ({completedTasks.length})
                  </Text>
                </View>

                <View style={styles.taskList}>
                  {completedTasks.map((t) => (
                    <TouchableOpacity
                      key={t._id}
                      activeOpacity={0.8}
                      onPress={() => toggleTaskStatus(t._id)}
                      style={[
                        styles.taskRow,
                        { backgroundColor: theme.surfaceAlt, borderColor: 'rgba(16,185,129,0.25)' },
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
              <View style={[styles.emptyBox, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="checkmark-done-circle-outline" size={32} color={colors.primary} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No session tasks logged</Text>
                <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                  You can enter your closing work summary below.
                </Text>
              </View>
            )}

            {/* Additional Remarks */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Additional Work Notes (Optional)
              </Text>
              <TextInput
                multiline
                numberOfLines={2}
                value={closingNotes}
                onChangeText={setClosingNotes}
                placeholder="Any extra achievements or remarks..."
                placeholderTextColor={theme.textTertiary}
                style={[
                  styles.textArea,
                  { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border },
                ]}
              />
            </View>

            {/* Blockers / Issues */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Roadblocks / Issues Faced (Optional)
              </Text>
              <TextInput
                multiline
                numberOfLines={2}
                value={issuesFaced}
                onChangeText={setIssuesFaced}
                placeholder="Any technical bugs or delays encountered..."
                placeholderTextColor={theme.textTertiary}
                style={[
                  styles.textArea,
                  { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border },
                ]}
              />
            </View>

            {/* Notify Managers */}
            {managementEmps.length > 0 && (
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Tag Management for Report
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
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              style={[styles.cancelBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCheckoutSubmit}
              disabled={isSubmitting}
              style={[styles.confirmBtn, { backgroundColor: colors.error }]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm & Check Out</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '90%',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(32,118,199,0.08)',
    borderRadius: 16,
    paddingVertical: 12,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statNum: {
    fontSize: 18,
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
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  scrollArea: {
    maxHeight: 380,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 8,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 11,
  },
  taskList: {
    gap: 8,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  taskMeta: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  emptyBox: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 6,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 12,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    minHeight: 56,
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
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
