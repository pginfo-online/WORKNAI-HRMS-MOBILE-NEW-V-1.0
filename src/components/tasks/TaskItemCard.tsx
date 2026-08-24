import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TaskItem, TaskPriority, TaskStatus } from '../../api/task.api';
import { useUIStore } from '../../store/ui.store';
import { colors } from '../../constants/colors';

interface TaskItemCardProps {
  task: TaskItem;
  onToggleComplete: (task: TaskItem) => void;
  onPress?: (task: TaskItem) => void;
  onDelete?: (task: TaskItem) => void;
}

const PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string; border: string }> = {
  Urgent: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  High: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  Medium: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  Low: { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' },
};

const STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
  Completed: { bg: '#DCFCE7', text: '#15803D' },
  'In Progress': { bg: '#E0F2FE', text: '#0369A1' },
  Pending: { bg: '#FEF3C7', text: '#B45309' },
  Assigned: { bg: '#F1F5F9', text: '#475569' },
};

export const TaskItemCard: React.FC<TaskItemCardProps> = ({
  task,
  onToggleComplete,
  onPress,
  onDelete,
}) => {
  const { theme, isDark } = useUIStore();
  const isCompleted = task.status === 'Completed';
  const pStyle = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
  const sStyle = STATUS_COLORS[task.status] || STATUS_COLORS.Assigned;

  const handleToggle = () => {
    Haptics.impactAsync(
      isCompleted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    );
    onToggleComplete(task);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress && onPress(task)}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: isCompleted ? 'rgba(16,185,129,0.3)' : theme.border,
        },
      ]}
    >
      <View style={styles.contentRow}>
        {/* Checkbox Tick Interaction */}
        <TouchableOpacity
          onPress={handleToggle}
          style={[
            styles.checkbox,
            {
              backgroundColor: isCompleted ? colors.success : 'transparent',
              borderColor: isCompleted ? colors.success : theme.border,
            },
          ]}
        >
          {isCompleted && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </TouchableOpacity>

        {/* Task Details */}
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              {
                color: isCompleted ? theme.textTertiary : theme.text,
                textDecorationLine: isCompleted ? 'line-through' : 'none',
              },
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>

          {task.description ? (
            <Text
              style={[styles.description, { color: theme.textSecondary }]}
              numberOfLines={2}
            >
              {task.description}
            </Text>
          ) : null}

          {/* Badges Row */}
          <View style={styles.metaRow}>
            {/* Priority Badge */}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : pStyle.bg,
                  borderColor: pStyle.border,
                  borderWidth: 1,
                },
              ]}
            >
              <View
                style={[
                  styles.priorityDot,
                  { backgroundColor: pStyle.text },
                ]}
              />
              <Text style={[styles.badgeText, { color: pStyle.text }]}>
                {task.priority}
              </Text>
            </View>

            {/* Status Badge */}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : sStyle.bg,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: sStyle.text }]}>
                {task.status}
              </Text>
            </View>

            {/* Due Time */}
            {task.dueTime ? (
              <View style={styles.dueWrap}>
                <Ionicons name="time-outline" size={12} color={theme.textTertiary} />
                <Text style={[styles.dueText, { color: theme.textSecondary }]}>
                  {task.dueTime}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Delete option */}
        {onDelete && (
          <TouchableOpacity
            onPress={() => onDelete(task)}
            style={styles.deleteBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 4,
  },
  dueText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 4,
    opacity: 0.7,
  },
});
