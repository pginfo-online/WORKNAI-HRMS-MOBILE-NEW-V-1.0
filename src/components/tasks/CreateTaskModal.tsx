import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TaskPriority } from '../../api/task.api';
import { useUIStore } from '../../store/ui.store';
import { colors } from '../../constants/colors';

interface CreateTaskModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (taskData: {
    title: string;
    description?: string;
    priority: TaskPriority;
    dueTime?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  visible,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  const { theme } = useUIStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueTime, setDueTime] = useState('');

  const handleResetAndClose = () => {
    setTitle('');
    setDescription('');
    setPriority('Medium');
    setDueTime('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueTime: dueTime.trim() || undefined,
    });

    handleResetAndClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleResetAndClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.heading, { color: theme.text }]}>Add Session Task</Text>
              <Text style={[styles.subheading, { color: theme.textSecondary }]}>
                Assign a task for your current work shift
              </Text>
            </View>
            <TouchableOpacity onPress={handleResetAndClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Task Title *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceAlt,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="e.g. Implement user dashboard endpoints"
                placeholderTextColor={theme.textTertiary}
                value={title}
                onChangeText={setTitle}
                autoFocus={true}
              />
            </View>

            {/* Priority Selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Priority</Text>
              <View style={styles.priorityRow}>
                {PRIORITIES.map((p) => {
                  const isSelected = priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setPriority(p);
                      }}
                      style={[
                        styles.priorityChip,
                        {
                          backgroundColor: isSelected ? colors.primary : theme.surfaceAlt,
                          borderColor: isSelected ? colors.primary : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.priorityText,
                          { color: isSelected ? '#FFFFFF' : theme.text },
                        ]}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Due Time */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Target Completion Time (Optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceAlt,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="e.g. 04:30 PM"
                placeholderTextColor={theme.textTertiary}
                value={dueTime}
                onChangeText={setDueTime}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Description / Notes (Optional)
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: theme.surfaceAlt,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="Additional specifications, references, or checklist items..."
                placeholderTextColor={theme.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              onPress={handleResetAndClose}
              style={[styles.cancelBtn, { borderColor: theme.border }]}
              disabled={isSubmitting}
            >
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || !title.trim()}
              style={[
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: title.trim() ? 1 : 0.5 },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Add to Session</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heading: {
    fontSize: 18,
    fontWeight: '800',
  },
  subheading: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  form: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  textArea: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityChip: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
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
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
