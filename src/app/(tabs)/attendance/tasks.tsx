import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useTaskStore } from '../../../store/task.store';
import { useUIStore } from '../../../store/ui.store';
import { TaskItem, TaskPriority, TaskStatus } from '../../../api/task.api';
import { colors } from '../../../constants/colors';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { TaskItemCard } from '../../../components/tasks/TaskItemCard';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';

type TabFilter = 'today' | 'all' | 'completed';

export default function TaskHubScreen() {
  const router = useRouter();
  const { theme, isDark } = useUIStore();
  const {
    tasks,
    historyTasks,
    isLoading,
    isHistoryLoading,
    fetchTodayTasks,
    fetchMyTasks,
    createTask,
    toggleTaskCompletion,
    deleteTask,
  } = useTaskStore();

  const [activeTab, setActiveTab] = useState<TabFilter>('today');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create Task Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('Medium');
  const [newDueTime, setNewDueTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTodayTasks();
    fetchMyTasks();
  }, []);

  const handleRefresh = () => {
    if (activeTab === 'today') {
      fetchTodayTasks();
    } else {
      fetchMyTasks();
    }
  };

  const handleCreateTask = async () => {
    if (!newTitle.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Task Title Required',
        text2: 'Please enter a title for your task',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createTask({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        priority: newPriority,
        dueTime: newDueTime.trim() || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Task Created ✓',
        text2: 'Added to your active tasks',
      });

      setModalVisible(false);
      setNewTitle('');
      setNewDesc('');
      setNewPriority('Medium');
      setNewDueTime('');
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to Create Task',
        text2: err.response?.data?.message || 'Server error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentList = activeTab === 'today' ? tasks : historyTasks;

  const filteredTasks = currentList.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeTab === 'completed') {
      return matchesSearch && task.status === 'Completed';
    }
    return matchesSearch;
  });

  const renderTaskItem = ({ item }: { item: TaskItem }) => (
    <TaskItemCard
      task={item}
      onToggleComplete={toggleTaskCompletion}
      onDelete={(t) => deleteTask(t._id)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Task Management"
        subtitle="Track & Deliver Your Shift Work"
        showBack
        rightElement={
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setModalVisible(true);
            }}
            style={[styles.addHeaderBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addHeaderBtnText}>New Task</Text>
          </TouchableOpacity>
        }
      />

      {/* Filter Tabs & Search */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBar, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={18} color={theme.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search deliverables..."
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[styles.tabBar, { backgroundColor: theme.surfaceAlt }]}>
          {(
            [
              { id: 'today', label: "Today's Tasks", count: tasks.length },
              { id: 'all', label: 'All History', count: historyTasks.length },
              { id: 'completed', label: 'Completed', count: historyTasks.filter((t) => t.status === 'Completed').length },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab(tab.id);
                }}
                style={[
                  styles.tabItem,
                  active && { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.tabText, { color: active ? colors.primary : theme.textSecondary }]}>
                  {tab.label}
                </Text>
                <View style={[styles.badge, { backgroundColor: active ? 'rgba(32,118,199,0.12)' : theme.surface }]}>
                  <Text style={[styles.badgeText, { color: active ? colors.primary : theme.textTertiary }]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item._id}
        renderItem={renderTaskItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isHistoryLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          isLoading || isHistoryLoading ? (
            <View style={{ gap: 12 }}>
              <Skeleton width="100%" height={70} borderRadius={16} />
              <Skeleton width="100%" height={70} borderRadius={16} />
              <Skeleton width="100%" height={70} borderRadius={16} />
            </View>
          ) : (
            <Card style={styles.emptyCard}>
              <Ionicons name="checkbox-outline" size={44} color={colors.primary} style={{ opacity: 0.4 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Tasks Found</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                {searchQuery
                  ? 'No tasks match your search filter.'
                  : activeTab === 'today'
                  ? 'No tasks assigned for today. Tap "+ New Task" to create one.'
                  : 'No task history available.'}
              </Text>
            </Card>
          )
        }
      />

      {/* Create Task Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Create New Task</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Task Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. Complete module documentation"
                placeholderTextColor={theme.textTertiary}
                value={newTitle}
                onChangeText={setNewTitle}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Priority</Text>
              <View style={styles.priorityRow}>
                {(['Low', 'Medium', 'High', 'Urgent'] as TaskPriority[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setNewPriority(p)}
                    style={[
                      styles.priorityChip,
                      {
                        backgroundColor: newPriority === p ? colors.primary : theme.surfaceAlt,
                        borderColor: newPriority === p ? colors.primary : theme.border,
                      },
                    ]}
                  >
                    <Text style={[styles.priorityChipText, { color: newPriority === p ? '#FFFFFF' : theme.text }]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Target Due Time</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. 05:30 PM"
                placeholderTextColor={theme.textTertiary}
                value={newDueTime}
                onChangeText={setNewDueTime}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Description / Notes</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                placeholder="Details, scope, or acceptance criteria..."
                placeholderTextColor={theme.textTertiary}
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              onPress={handleCreateTask}
              disabled={isSubmitting}
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Create Task</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  addHeaderBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  filterSection: { paddingHorizontal: 20, gap: 12, marginBottom: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  tabBar: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  tabText: { fontSize: 12, fontWeight: '700' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  listContent: { padding: 20, gap: 10, paddingBottom: 40 },
  emptyCard: { padding: 32, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, gap: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  formGroup: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700' },
  input: { height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  textArea: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: { flex: 1, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  priorityChipText: { fontSize: 12, fontWeight: '700' },
  submitBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
