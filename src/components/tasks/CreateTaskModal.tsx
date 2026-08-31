import React, { useState, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TaskItem, TaskPriority } from '../../api/task.api';
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
  taskToEdit?: TaskItem | null;
  isSubmitting?: boolean;
}

const PRIORITIES: { key: TaskPriority; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'Low', label: 'Low', icon: 'shield-outline', color: '#64748B' },
  { key: 'Medium', label: 'Medium', icon: 'flag', color: colors.primary },
  { key: 'High', label: 'High', icon: 'flash', color: '#F59E0B' },
  { key: 'Urgent', label: 'Urgent', icon: 'alert-circle', color: '#EF4444' },
];

const TIME_PRESETS = ['01:00 PM', '03:30 PM', '05:30 PM', '06:00 PM', '07:00 PM'];

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  visible,
  onClose,
  onSubmit,
  taskToEdit = null,
  isSubmitting = false,
}) => {
  const { theme, isDark } = useUIStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueTime, setDueTime] = useState('');
  const [titleError, setTitleError] = useState(false);

  useEffect(() => {
    if (visible) {
      if (taskToEdit) {
        setTitle(taskToEdit.title || '');
        setDescription(taskToEdit.description || '');
        setPriority(taskToEdit.priority || 'Medium');
        setDueTime(taskToEdit.dueTime || '');
      } else {
        setTitle('');
        setDescription('');
        setPriority('Medium');
        setDueTime('');
      }
      setTitleError(false);
    }
  }, [visible, taskToEdit]);

  const handleClose = () => {
    setTitleError(false);
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim() || undefined,
        priority,
        dueTime: dueTime.trim() || undefined,
      });
      handleClose();
    } catch (_) {
      // Handled by caller
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: isDark ? '#000000' : '#64748B',
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heading, { color: theme.text }]}>
                {taskToEdit ? 'Edit Task' : 'New Shift Deliverable'}
              </Text>
              <Text style={[styles.subheading, { color: theme.textSecondary }]}>
                {taskToEdit ? 'Update task details & target time' : 'Add a task to your current work session'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.closeBtn, { backgroundColor: theme.surfaceAlt }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Form Fields */}
            <View style={styles.form}>
              {/* Title */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: theme.text }]}>Task Title</Text>
                  <Text style={styles.requiredStar}>*</Text>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceAlt,
                      color: theme.text,
                      borderColor: titleError ? colors.error : theme.border,
                    },
                  ]}
                  placeholder="e.g. Complete quarterly attendance review"
                  placeholderTextColor={theme.textTertiary}
                  value={title}
                  onChangeText={(t) => {
                    setTitle(t);
                    if (titleError) setTitleError(false);
                  }}
                  autoFocus={!taskToEdit}
                />
                {titleError && (
                  <Text style={styles.errorText}>Please enter a task title</Text>
                )}
              </View>

              {/* Priority Selector */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Priority Level</Text>
                <View style={styles.priorityRow}>
                  {PRIORITIES.map((p) => {
                    const isSelected = priority === p.key;
                    return (
                      <TouchableOpacity
                        key={p.key}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setPriority(p.key);
                        }}
                        style={[
                          styles.priorityChip,
                          {
                            backgroundColor: isSelected
                              ? isDark
                                ? 'rgba(32, 118, 199, 0.25)'
                                : 'rgba(32, 118, 199, 0.12)'
                              : theme.surfaceAlt,
                            borderColor: isSelected ? colors.primary : theme.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={p.icon}
                          size={13}
                          color={isSelected ? colors.primary : p.color}
                        />
                        <Text
                          style={[
                            styles.priorityText,
                            {
                              color: isSelected ? colors.primary : theme.textSecondary,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Due Time + Presets */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Target Completion Time <Text style={styles.optionalText}>(Optional)</Text>
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
                  placeholder="e.g. 05:30 PM"
                  placeholderTextColor={theme.textTertiary}
                  value={dueTime}
                  onChangeText={setDueTime}
                />

                {/* Time Preset Quick Pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.presetsRow}
                >
                  {TIME_PRESETS.map((timePreset) => {
                    const activePreset = dueTime === timePreset;
                    return (
                      <TouchableOpacity
                        key={timePreset}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setDueTime(timePreset);
                        }}
                        style={[
                          styles.presetPill,
                          {
                            backgroundColor: activePreset
                              ? colors.primary
                              : isDark
                              ? 'rgba(255,255,255,0.06)'
                              : '#F1F5F9',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetText,
                            { color: activePreset ? '#FFFFFF' : theme.textSecondary },
                          ]}
                        >
                          {timePreset}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Notes / Acceptance Criteria <Text style={styles.optionalText}>(Optional)</Text>
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
                  placeholder="Additional specifications, links, or deliverables..."
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
                onPress={handleClose}
                style={[styles.cancelBtn, { borderColor: theme.border }]}
                disabled={isSubmitting}
              >
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting || !title.trim()}
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: title.trim() && !isSubmitting ? 1 : 0.6,
                  },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.submitBtnContent}>
                    <Ionicons
                      name={taskToEdit ? 'checkmark-circle-outline' : 'add-circle-outline'}
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.submitBtnText}>
                      {taskToEdit ? 'Save Changes' : 'Create Task'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    gap: 16,
  },
  form: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  requiredStar: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '700',
  },
  optionalText: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.6,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '500',
  },
  textArea: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontWeight: '500',
    minHeight: 72,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 11,
    color: colors.error,
    fontWeight: '600',
    marginTop: 2,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  priorityText: {
    fontSize: 11,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  presetPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
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
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

