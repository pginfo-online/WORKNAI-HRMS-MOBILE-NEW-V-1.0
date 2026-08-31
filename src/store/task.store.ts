import { create } from 'zustand';
import { taskApi, TaskItem, TaskStatus, TaskReviewStatus, CreateTaskPayload, UpdateTaskPayload, MyTasksParams } from '../api/task.api';

export interface TaskSummary {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  completionPercentage: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface TaskState {
  // Today's session tasks
  tasks: TaskItem[];
  sessionSummary: TaskSummary | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Task history (paginated)
  historyTasks: TaskItem[];
  historyPagination: Pagination | null;
  isHistoryLoading: boolean;

  // Admin tasks
  adminTasks: TaskItem[];
  adminPagination: Pagination | null;
  isAdminLoading: boolean;

  // Actions
  fetchTodayTasks: (silent?: boolean) => Promise<void>;
  createTask: (payload: CreateTaskPayload) => Promise<TaskItem | null>;
  toggleTaskCompletion: (task: TaskItem) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  updateTask: (taskId: string, payload: UpdateTaskPayload) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  setTasks: (tasks: TaskItem[]) => void;

  // History
  fetchMyTasks: (params?: MyTasksParams, silent?: boolean) => Promise<void>;
  fetchMoreHistory: (params?: MyTasksParams) => Promise<void>;

  // Admin
  fetchAdminTasks: (params?: any) => Promise<void>;
  reviewTask: (taskId: string, data: { reviewNotes?: string; reviewStatus?: TaskReviewStatus }) => Promise<void>;
}

const calculateSummary = (tasks: TaskItem[]): TaskSummary => {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'Completed').length;
  const inProgress = tasks.filter((t) => t.status === 'In Progress').length;
  const pending = tasks.filter((t) => t.status === 'Pending' || t.status === 'Assigned').length;
  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, inProgress, pending, completionPercentage };
};

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  sessionSummary: null,
  isLoading: false,
  isSaving: false,
  error: null,

  historyTasks: [],
  historyPagination: null,
  isHistoryLoading: false,

  adminTasks: [],
  adminPagination: null,
  isAdminLoading: false,

  setTasks: (tasks) => set({ tasks, sessionSummary: calculateSummary(tasks) }),

  fetchTodayTasks: async (silent = false) => {
    if (!silent && get().tasks.length === 0) {
      set({ isLoading: true, error: null });
    }
    try {
      const res = await taskApi.getTodaySessionTasks();
      const { tasks, summary } = res.data.data;
      const loadedTasks = tasks || [];
      set({
        tasks: loadedTasks,
        sessionSummary: summary || calculateSummary(loadedTasks),
        isLoading: false,
      });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'Failed to load session tasks',
        isLoading: false,
      });
    }
  },

  createTask: async (payload) => {
    set({ isSaving: true });
    try {
      const res = await taskApi.createTask(payload);
      const newTask = res.data.data;
      const updatedTasks = [newTask, ...get().tasks];
      const updatedHistory = [newTask, ...get().historyTasks];

      set({
        tasks: updatedTasks,
        historyTasks: updatedHistory,
        sessionSummary: calculateSummary(updatedTasks),
        isSaving: false,
      });
      return newTask;
    } catch (err: any) {
      set({ isSaving: false, error: err.response?.data?.message || 'Failed to create task' });
      throw err;
    }
  },

  toggleTaskCompletion: async (task) => {
    const currentStatus = task.status;
    const nextStatus: TaskStatus = currentStatus === 'Completed' ? 'In Progress' : 'Completed';
    const nowIso = new Date().toISOString();

    const previousTasks = get().tasks;
    const previousHistory = get().historyTasks;
    const previousSummary = get().sessionSummary;

    // Optimistic update across all task lists
    const updatedTasks = previousTasks.map((t) =>
      t._id === task._id
        ? {
            ...t,
            status: nextStatus,
            completedAt: nextStatus === 'Completed' ? nowIso : undefined,
          }
        : t
    );

    const updatedHistory = previousHistory.map((t) =>
      t._id === task._id
        ? {
            ...t,
            status: nextStatus,
            completedAt: nextStatus === 'Completed' ? nowIso : undefined,
          }
        : t
    );

    set({
      tasks: updatedTasks,
      historyTasks: updatedHistory,
      sessionSummary: calculateSummary(updatedTasks),
    });

    try {
      await taskApi.updateTask(task._id, { status: nextStatus });
    } catch (err) {
      // Rollback on error
      set({
        tasks: previousTasks,
        historyTasks: previousHistory,
        sessionSummary: previousSummary,
      });
      throw err;
    }
  },

  updateTaskStatus: async (taskId, status) => {
    const nowIso = new Date().toISOString();
    const previousTasks = get().tasks;
    const previousHistory = get().historyTasks;
    const previousSummary = get().sessionSummary;

    const updatedTasks = previousTasks.map((t) =>
      t._id === taskId
        ? {
            ...t,
            status,
            completedAt: status === 'Completed' ? nowIso : undefined,
          }
        : t
    );

    const updatedHistory = previousHistory.map((t) =>
      t._id === taskId
        ? {
            ...t,
            status,
            completedAt: status === 'Completed' ? nowIso : undefined,
          }
        : t
    );

    set({
      tasks: updatedTasks,
      historyTasks: updatedHistory,
      sessionSummary: calculateSummary(updatedTasks),
    });

    try {
      await taskApi.updateTask(taskId, { status });
    } catch (err) {
      set({
        tasks: previousTasks,
        historyTasks: previousHistory,
        sessionSummary: previousSummary,
      });
      throw err;
    }
  },

  updateTask: async (taskId, payload) => {
    set({ isSaving: true });
    try {
      const res = await taskApi.updateTask(taskId, payload);
      const updated = res.data.data;
      const updatedTasks = get().tasks.map((t) => (t._id === taskId ? updated : t));
      const updatedHistory = get().historyTasks.map((t) => (t._id === taskId ? updated : t));

      set({
        tasks: updatedTasks,
        historyTasks: updatedHistory,
        sessionSummary: calculateSummary(updatedTasks),
        isSaving: false,
      });
    } catch (err) {
      set({ isSaving: false });
      throw err;
    }
  },

  deleteTask: async (taskId) => {
    const previousTasks = get().tasks;
    const previousHistory = get().historyTasks;
    const previousSummary = get().sessionSummary;

    const updatedTasks = previousTasks.filter((t) => t._id !== taskId);
    const updatedHistory = previousHistory.filter((t) => t._id !== taskId);

    set({
      tasks: updatedTasks,
      historyTasks: updatedHistory,
      sessionSummary: calculateSummary(updatedTasks),
    });

    try {
      await taskApi.deleteTask(taskId);
    } catch (err) {
      set({
        tasks: previousTasks,
        historyTasks: previousHistory,
        sessionSummary: previousSummary,
      });
      throw err;
    }
  },

  fetchMyTasks: async (params, silent = false) => {
    if (!silent && get().historyTasks.length === 0) {
      set({ isHistoryLoading: true, error: null });
    }
    try {
      const res = await taskApi.getMyTasks(params);
      const { tasks, pagination } = res.data.data;
      set({
        historyTasks: tasks || [],
        historyPagination: pagination || null,
        isHistoryLoading: false,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to retrieve tasks history';
      set({ isHistoryLoading: false, error: msg });
    }
  },

  fetchMoreHistory: async (params) => {
    const { historyPagination, historyTasks } = get();
    if (!historyPagination || historyPagination.page >= historyPagination.totalPages) return;

    const nextPage = historyPagination.page + 1;
    try {
      const res = await taskApi.getMyTasks({ ...params, page: nextPage });
      const { tasks, pagination } = res.data.data;
      set({
        historyTasks: [...historyTasks, ...(tasks || [])],
        historyPagination: pagination || null,
      });
    } catch (err: any) {
      console.error('[TaskStore] fetchMoreHistory error:', err.message);
    }
  },

  fetchAdminTasks: async (params) => {
    set({ isAdminLoading: true, error: null });
    try {
      const res = await taskApi.getAdminTasks(params);
      const { tasks, pagination } = res.data.data;
      set({
        adminTasks: tasks || [],
        adminPagination: pagination || null,
        isAdminLoading: false,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load admin task list';
      set({ isAdminLoading: false, error: msg });
    }
  },

  reviewTask: async (taskId, data) => {
    try {
      const res = await taskApi.reviewTask(taskId, data);
      const updated = res.data.data;
      set((state) => ({
        adminTasks: state.adminTasks.map((t) => (t._id === taskId ? updated : t)),
      }));
    } catch (err) {
      throw err;
    }
  },
}));

