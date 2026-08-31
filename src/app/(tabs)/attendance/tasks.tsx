import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useTaskStore } from '../../../store/task.store';
import { useUIStore } from '../../../store/ui.store';
import { TaskItem, TaskPriority } from '../../../api/task.api';
import { colors } from '../../../constants/colors';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { TaskItemCard } from '../../../components/tasks/TaskItemCard';
import { CreateTaskModal } from '../../../components/tasks/CreateTaskModal';
import { TaskListSkeleton } from '../../../components/ui/SkeletonPresets';
import { ProgressRing } from '../../../components/ui/ProgressRing';
import { ErrorBoundary } from '../../../components/ErrorBoundary';

type TabFilter = 'today' | 'all' | 'pending' | 'completed';
type PriorityFilter = 'ALL' | TaskPriority;

const PRIORITIES: TaskPriority[] = ['Urgent', 'High', 'Medium', 'Low'];
const SEARCH_DEBOUNCE_MS = 200;

function TaskHubContent() {
  const router = useRouter();
  const { theme, isDark } = useUIStore();
  const {
    tasks,
    sessionSummary,
    historyTasks,
    historyPagination,
    isLoading,
    isHistoryLoading,
    isSaving,
    fetchTodayTasks,
    fetchMyTasks,
    fetchMoreHistory,
    createTask,
    updateTask,
    toggleTaskCompletion,
    deleteTask,
  } = useTaskStore();

  const [activeTab, setActiveTab] = useState<TabFilter>('today');
  const [selectedPriority, setSelectedPriority] = useState<PriorityFilter>('ALL');
  const [rawSearch, setRawSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<TaskItem | null>(null);

  // Search debounce
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((text: string) => {
    setRawSearch(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchQuery(text), SEARCH_DEBOUNCE_MS);
  }, []);

  // Initial Load
  useEffect(() => {
    fetchTodayTasks();
    fetchMyTasks(undefined, true);
  }, [fetchTodayTasks, fetchMyTasks]);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeTab === 'today') {
      await fetchTodayTasks(true);
    } else {
      await fetchMyTasks(undefined, true);
    }
  }, [activeTab, fetchTodayTasks, fetchMyTasks]);

  // Pagination for History
  const handleLoadMore = useCallback(() => {
    if (activeTab !== 'today' && !isHistoryLoading) {
      if (historyPagination && historyPagination.page < historyPagination.totalPages) {
        fetchMoreHistory();
      }
    }
  }, [activeTab, isHistoryLoading, historyPagination, fetchMoreHistory]);

  // Create / Edit Modal Triggers
  const handleOpenCreateModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTaskToEdit(null);
    setModalVisible(true);
  }, []);

  const handleOpenEditModal = useCallback((task: TaskItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTaskToEdit(task);
    setModalVisible(true);
  }, []);

  const handleSaveTask = useCallback(
    async (taskData: { title: string; description?: string; priority: TaskPriority; dueTime?: string }) => {
      try {
        if (taskToEdit) {
          await updateTask(taskToEdit._id, taskData);
          Toast.show({
            type: 'success',
            text1: 'Task Updated',
            text2: `"${taskData.title}" details saved.`,
          });
        } else {
          await createTask(taskData);
          Toast.show({
            type: 'success',
            text1: 'Task Created',
            text2: `Added to your session deliverables.`,
          });
        }
        setModalVisible(false);
      } catch (err: any) {
        Alert.alert('Unable to Save Task', err.response?.data?.message || err.message || 'Please try again.');
      }
    },
    [taskToEdit, createTask, updateTask]
  );

  // Smooth Toggle Completion with Feedback
  const handleToggle = useCallback(
    async (task: TaskItem) => {
      const willComplete = task.status !== 'Completed';
      try {
        await toggleTaskCompletion(task);
        Toast.show({
          type: 'success',
          text1: willComplete ? 'Task Completed 🎉' : 'Task Reopened',
          text2: `"${task.title}" marked as ${willComplete ? 'Completed' : 'In Progress'}.`,
          visibilityTime: 2000,
        });
      } catch (err: any) {
        Alert.alert('Update Failed', err.response?.data?.message || 'Could not sync task status.');
      }
    },
    [toggleTaskCompletion]
  );

  // Delete Task with Confirmation
  const handleDelete = useCallback(
    (task: TaskItem) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Delete Deliverable', `Are you sure you want to delete "${task.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTask(task._id);
              Toast.show({
                type: 'info',
                text1: 'Task Deleted',
                text2: `"${task.title}" removed.`,
              });
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete task.');
            }
          },
        },
      ]);
    },
    [deleteTask]
  );

  // Tab Filtering & Counts
  const todayTasks = tasks;
  const allTasks = historyTasks.length > 0 ? historyTasks : tasks;

  const todayCount = todayTasks.length;
  const allCount = allTasks.length;
  const pendingCount = (activeTab === 'today' ? todayTasks : allTasks).filter(
    (t) => t.status === 'In Progress' || t.status === 'Pending' || t.status === 'Assigned'
  ).length;
  const completedCount = (activeTab === 'today' ? todayTasks : allTasks).filter(
    (t) => t.status === 'Completed'
  ).length;

  // Filtered List
  const currentList = useMemo(() => {
    const base = activeTab === 'today' ? todayTasks : allTasks;

    return base.filter((t) => {
      // Tab status filter
      if (activeTab === 'completed' && t.status !== 'Completed') return false;
      if (activeTab === 'pending' && t.status === 'Completed') return false;

      // Priority chip filter
      if (selectedPriority !== 'ALL' && t.priority !== selectedPriority) return false;

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const matchesDue = t.dueTime?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesDue) return false;
      }

      return true;
    });
  }, [activeTab, todayTasks, allTasks, selectedPriority, searchQuery]);

  // Overall completion metrics for banner
  const completionPct = sessionSummary?.completionPercentage ?? (todayCount > 0 ? Math.round((todayTasks.filter(t => t.status === 'Completed').length / todayCount) * 100) : 0);

  const isInitialLoading = (isLoading && todayTasks.length === 0) || (isHistoryLoading && historyTasks.length === 0);

  // Render Items
  const renderTaskItem = useCallback(
    ({ item }: { item: TaskItem }) => (
      <TaskItemCard
        task={item}
        onToggleComplete={handleToggle}
        onEdit={handleOpenEditModal}
        onDelete={handleDelete}
      />
    ),
    [handleToggle, handleOpenEditModal, handleDelete]
  );

  const renderFooter = useCallback(() => {
    if (!isHistoryLoading || activeTab === 'today') return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isHistoryLoading, activeTab]);

  const renderEmpty = useCallback(() => {
    if (isInitialLoading) {
      return (
        <View style={{ paddingTop: 8 }}>
          <TaskListSkeleton count={4} />
        </View>
      );
    }
    return (
      <Card style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
        <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(32,118,199,0.15)' : 'rgba(32,118,199,0.08)' }]}>
          <Ionicons
            name={activeTab === 'completed' ? 'checkmark-done-circle-outline' : 'checkbox-outline'}
            size={40}
            color={colors.primary}
          />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {searchQuery ? 'No Matching Deliverables' : activeTab === 'completed' ? 'No Completed Tasks Yet' : activeTab === 'pending' ? 'No Pending Tasks' : 'No Tasks Logged for Today'}
        </Text>
        <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
          {searchQuery
            ? 'Try adjusting your search keywords or priority filters.'
            : activeTab === 'completed'
            ? 'Mark tasks as completed from the Today tab to track your output.'
            : 'Plan your shift effectively by creating your work deliverables.'}
        </Text>
        {!searchQuery && (
          <TouchableOpacity
            onPress={handleOpenCreateModal}
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.emptyBtnText}>Add Shift Task</Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  }, [isInitialLoading, searchQuery, activeTab, theme, isDark, handleOpenCreateModal]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Task Management"
        subtitle="Track & Deliver Your Shift Work"
        showBack
        rightAction={
          <TouchableOpacity
            onPress={handleOpenCreateModal}
            activeOpacity={0.8}
            style={[styles.addHeaderBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addHeaderBtnText}>New Task</Text>
          </TouchableOpacity>
        }
      />

      {/* Main Content List */}
      <FlatList
        data={currentList}
        keyExtractor={(item) => item._id}
        renderItem={renderTaskItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && todayTasks.length > 0}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <>
            {/* 1. Shift Progress Summary Banner */}
            <LinearGradient
              colors={['#165B9C', '#2076C7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryBanner}
            >
              <View style={styles.bannerRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.bannerSubtitle}>TODAY'S SHIFT DELIVERABLES</Text>
                  <Text style={styles.bannerTitle}>
                    {todayTasks.filter((t) => t.status === 'Completed').length} of {todayCount} Completed
                  </Text>
                  <Text style={styles.bannerDesc}>
                    {completionPct === 100
                      ? '🌟 All deliverables completed for today!'
                      : completionPct > 50
                      ? '⚡ Great progress! Keep pushing forward.'
                      : '📝 Log your shift targets and track milestones.'}
                  </Text>
                </View>

                {/* Progress Ring */}
                <ProgressRing
                  percentage={completionPct}
                  size={64}
                  strokeWidth={6}
                  color="#10B981"
                  bgColor="rgba(255,255,255,0.2)"
                >
                  <Text style={styles.progressRingText}>{completionPct}%</Text>
                </ProgressRing>
              </View>

              {/* Counter Metrics Row */}
              <View style={styles.counterRow}>
                <View style={styles.counterBox}>
                  <Text style={styles.counterValue}>{todayCount}</Text>
                  <Text style={styles.counterLabel}>Total</Text>
                </View>
                <View style={styles.counterDivider} />
                <View style={styles.counterBox}>
                  <Text style={[styles.counterValue, { color: '#6EE7B7' }]}>
                    {todayTasks.filter((t) => t.status === 'Completed').length}
                  </Text>
                  <Text style={styles.counterLabel}>Done</Text>
                </View>
                <View style={styles.counterDivider} />
                <View style={styles.counterBox}>
                  <Text style={[styles.counterValue, { color: '#93C5FD' }]}>
                    {todayTasks.filter((t) => t.status === 'In Progress').length}
                  </Text>
                  <Text style={styles.counterLabel}>Active</Text>
                </View>
                <View style={styles.counterDivider} />
                <View style={styles.counterBox}>
                  <Text style={[styles.counterValue, { color: '#FCD34D' }]}>
                    {todayTasks.filter((t) => t.status === 'Pending' || t.status === 'Assigned').length}
                  </Text>
                  <Text style={styles.counterLabel}>Pending</Text>
                </View>
              </View>
            </LinearGradient>

            {/* 2. Search & Search Bar */}
            <View style={styles.filterSection}>
              <View
                style={[
                  styles.searchBar,
                  { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                ]}
              >
                <Ionicons name="search-outline" size={18} color={theme.textTertiary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Search deliverables, notes or time..."
                  placeholderTextColor={theme.textTertiary}
                  value={rawSearch}
                  onChangeText={handleSearchChange}
                />
                {rawSearch ? (
                  <TouchableOpacity
                    onPress={() => {
                      setRawSearch('');
                      setSearchQuery('');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Segmented Tab Filter */}
              <View style={[styles.tabBar, { backgroundColor: theme.surfaceAlt }]}>
                {(
                  [
                    { id: 'today', label: 'Today', count: todayCount },
                    { id: 'all', label: 'All History', count: allCount },
                    { id: 'pending', label: 'In Progress', count: pendingCount },
                    { id: 'completed', label: 'Completed', count: completedCount },
                  ] as const
                ).map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setActiveTab(tab.id);
                        if (tab.id === 'today') fetchTodayTasks(true);
                        else fetchMyTasks(undefined, true);
                      }}
                      style={[
                        styles.tabItem,
                        active && {
                          backgroundColor: theme.surface,
                          borderColor: theme.border,
                          shadowColor: isDark ? '#000000' : '#64748B',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          {
                            color: active ? colors.primary : theme.textSecondary,
                            fontWeight: active ? '800' : '600',
                          },
                        ]}
                      >
                        {tab.label}
                      </Text>
                      <View
                        style={[
                          styles.tabBadge,
                          {
                            backgroundColor: active
                              ? isDark
                                ? 'rgba(32, 118, 199, 0.25)'
                                : 'rgba(32, 118, 199, 0.12)'
                              : isDark
                              ? 'rgba(255,255,255,0.06)'
                              : '#E2E8F0',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabBadgeText,
                            { color: active ? colors.primary : theme.textTertiary },
                          ]}
                        >
                          {tab.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Priority Chips Filter */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.priorityFilterRow}
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedPriority('ALL');
                  }}
                  style={[
                    styles.priorityFilterChip,
                    {
                      backgroundColor:
                        selectedPriority === 'ALL'
                          ? colors.primary
                          : theme.surfaceAlt,
                      borderColor:
                        selectedPriority === 'ALL' ? colors.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityFilterText,
                      { color: selectedPriority === 'ALL' ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    All Priorities
                  </Text>
                </TouchableOpacity>

                {PRIORITIES.map((p) => {
                  const isSelected = selectedPriority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedPriority(p);
                      }}
                      style={[
                        styles.priorityFilterChip,
                        {
                          backgroundColor: isSelected
                            ? colors.primary
                            : theme.surfaceAlt,
                          borderColor: isSelected ? colors.primary : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.priorityFilterText,
                          { color: isSelected ? '#FFFFFF' : theme.textSecondary },
                        ]}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </>
        }
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* Unified Create & Edit Task Modal */}
      <CreateTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSaveTask}
        taskToEdit={taskToEdit}
        isSubmitting={isSaving}
      />
    </View>
  );
}

export default function TaskHubScreen() {
  return (
    <ErrorBoundary>
      <TaskHubContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  addHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // Summary Banner
  summaryBanner: {
    borderRadius: 22,
    padding: 18,
    marginTop: 12,
    marginBottom: 16,
    gap: 14,
    shadowColor: '#2076C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bannerSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.5,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  bannerDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 16,
  },
  progressRingText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  counterRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  counterBox: {
    alignItems: 'center',
    flex: 1,
  },
  counterValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  counterLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  counterDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  // Filter Section
  filterSection: {
    gap: 10,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
    gap: 3,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
    elevation: 0,
  },
  tabText: {
    fontSize: 11,
  },
  tabBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  priorityFilterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  priorityFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  priorityFilterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Empty Card
  emptyCard: {
    padding: 28,
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});

