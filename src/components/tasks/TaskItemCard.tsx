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
  onEdit?: (task: TaskItem) => void;
}

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { bg: string; text: string; border: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  Urgent: { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.25)', icon: 'alert-circle' },
  High: { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.25)', icon: 'flash' },
  Medium: { bg: 'rgba(32, 118, 199, 0.1)', text: colors.primary, border: 'rgba(32, 118, 199, 0.25)', icon: 'flag' },
  Low: { bg: 'rgba(100, 116, 139, 0.1)', text: '#64748B', border: 'rgba(100, 116, 139, 0.2)', icon: 'shield-outline' },
};

const STATUS_CONFIG: Record<TaskStatus, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Completed: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981', icon: 'checkmark-circle' },
  'In Progress': { bg: 'rgba(59, 130, 246, 0.12)', text: '#3B82F6', icon: 'time' },
  Pending: { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', icon: 'hourglass-outline' },
  Assigned: { bg: 'rgba(100, 116, 139, 0.1)', text: '#64748B', icon: 'person-outline' },
};

export const TaskItemCard: React.FC<TaskItemCardProps> = ({
  task,
  onToggleComplete,
  onPress,
  onDelete,
  onEdit,
}) => {
  const { theme, isDark } = useUIStore();
  const isCompleted = task.status === 'Completed';
  const pConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.Medium;
  const sConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.Assigned;

  const handleToggle = () => {
    Haptics.impactAsync(
      isCompleted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    );
    onToggleComplete(task);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: isCompleted
            ? isDark
              ? 'rgba(16, 185, 129, 0.25)'
              : 'rgba(16, 185, 129, 0.35)'
            : theme.border,
          shadowColor: isDark ? '#000000' : '#64748B',
        },
      ]}
    >
      <View style={styles.contentRow}>
        {/* Generous Checkbox Hit Area */}
        <TouchableOpacity
          onPress={handleToggle}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
          style={[
            styles.checkboxWrap,
            {
              backgroundColor: isCompleted
                ? colors.success
                : isDark
                ? 'rgba(255,255,255,0.05)'
                : '#F8FAFC',
              borderColor: isCompleted ? colors.success : isDark ? '#334155' : '#CBD5E1',
            },
          ]}
        >
          {isCompleted ? (
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          ) : (
            <View style={styles.checkboxInner} />
          )}
        </TouchableOpacity>

        {/* Task Details Touchable */}
        <TouchableOpacity
          style={styles.textContainer}
          activeOpacity={onPress ? 0.7 : 1}
          onPress={() => onPress && onPress(task)}
        >
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
              style={[
                styles.description,
                {
                  color: isCompleted ? theme.textTertiary : theme.textSecondary,
                  textDecorationLine: isCompleted ? 'line-through' : 'none',
                },
              ]}
              numberOfLines={2}
            >
              {task.description}
            </Text>
          ) : null}

          {/* Badges & Metadata Row */}
          <View style={styles.metaRow}>
            {/* Priority Badge */}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: pConfig.bg,
                  borderColor: pConfig.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Ionicons name={pConfig.icon} size={11} color={pConfig.text} />
              <Text style={[styles.badgeText, { color: pConfig.text }]}>
                {task.priority}
              </Text>
            </View>

            {/* Status Badge */}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: sConfig.bg,
                },
              ]}
            >
              <Ionicons name={sConfig.icon} size={11} color={sConfig.text} />
              <Text style={[styles.badgeText, { color: sConfig.text }]}>
                {task.status}
              </Text>
            </View>

            {/* Target Due Time */}
            {task.dueTime ? (
              <View
                style={[
                  styles.dueWrap,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                  },
                ]}
              >
                <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
                <Text style={[styles.dueText, { color: theme.textSecondary }]}>
                  {task.dueTime}
                </Text>
              </View>
            ) : null}

            {/* Admin Assigned Indicator */}
            {task.isAdminAssigned && (
              <View style={[styles.adminBadge, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                <Ionicons name="shield-checkmark-outline" size={11} color="#6366F1" />
                <Text style={styles.adminBadgeText}>Assigned</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Action Buttons (Edit / Delete) */}
        <View style={styles.actionColumn}>
          {onEdit && (
            <TouchableOpacity
              onPress={() => onEdit(task)}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={15} color={theme.textSecondary} />
            </TouchableOpacity>
          )}

          {onDelete && (
            <TouchableOpacity
              onPress={() => onDelete(task)}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={15} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
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
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dueText: {
    fontSize: 11,
    fontWeight: '600',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
  },
  actionColumn: {
    flexDirection: 'column',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  iconBtn: {
    padding: 4,
    opacity: 0.8,
  },
});

