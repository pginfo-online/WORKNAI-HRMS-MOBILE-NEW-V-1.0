import { create } from 'zustand';
import { taskApi, TaskItem, TaskStatus, TaskReviewStatus, CreateTaskPayload, UpdateTaskPayload, MyTasksParams } from '../api/task.api';

interface TaskSummary {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  completionPercentage: number;
}

interface Pagination {
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
  fetchTodayTasks: () => Promise<void>;
  createTask: (payload: CreateTaskPayload) => Promise<TaskItem | null>;
  toggleTaskCompletion: (task: TaskItem) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  updateTask: (taskId: string, payload: UpdateTaskPayload) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  setTasks: (tasks: TaskItem[]) => void;

  // History
  fetchMyTasks: (params?: MyTasksParams) => Promise<void>;
  fetchMoreHistory: (params?: MyTasksParams) => Promise<void>;

  // Admin
  fetchAdminTasks: (params?: any) => Promise<void>;
  reviewTask: (taskId: string, data: { reviewNotes?: string; reviewStatus?: TaskReviewStatus }) => Promise<void>;
}

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

  setTasks: (tasks) => set({ tasks }),

  fetchTodayTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await taskApi.getTodaySessionTasks();
      const { tasks, summary } = res.data.data;
      set({ tasks: tasks || [], sessionSummary: summary || null, isLoading: false });
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
      set((state) => ({
        tasks: [newTask, ...state.tasks],
        isSaving: false,
      }));
      return newTask;
    } catch (err: any) {
      set({ isSaving: false, error: err.response?.data?.message || 'Failed to create task' });
      throw err;
    }
  },

  toggleTaskCompletion: async (task) => {
    const currentStatus = task.status;
    const nextStatus: TaskStatus = currentStatus === 'Completed' ? 'In Progress' : 'Completed';

    // Optimistic update
    const previousTasks = get().tasks;
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t._id === task._id
          ? {
              ...t,
              status: nextStatus,
              completedAt: nextStatus === 'Completed' ? new Date().toISOString() : undefined,
            }
          : t
      ),
    }));

    try {
      await taskApi.updateTask(task._id, { status: nextStatus });
    } catch (err) {
      // Rollback on error
      set({ tasks: previousTasks });
      throw err;
    }
  },

  updateTaskStatus: async (taskId, status) => {
    const previousTasks = get().tasks;
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t._id === taskId
          ? {
              ...t,
              status,
              completedAt: status === 'Completed' ? new Date().toISOString() : undefined,
            }
          : t
      ),
    }));

    try {
      await taskApi.updateTask(taskId, { status });
    } catch (err) {
      set({ tasks: previousTasks });
      throw err;
    }
  },

  updateTask: async (taskId, payload) => {
    set({ isSaving: true });
    try {
      const res = await taskApi.updateTask(taskId, payload);
      const updated = res.data.data;
      set((state) => ({
        tasks: state.tasks.map((t) => (t._id === taskId ? updated : t)),
        historyTasks: state.historyTasks.map((t) => (t._id === taskId ? updated : t)),
        isSaving: false,
      }));
    } catch (err) {
      set({ isSaving: false });
      throw err;
    }
  },

  deleteTask: async (taskId) => {
    const previousTasks = get().tasks;
    set((state) => ({
      tasks: state.tasks.filter((t) => t._id !== taskId),
    }));

    try {
      await taskApi.deleteTask(taskId);
    } catch (err) {
      set({ tasks: previousTasks });
      throw err;
    }
  },

  fetchMyTasks: async (params) => {
    set({ isHistoryLoading: true });
    try {
      const res = await taskApi.getMyTasks(params);
      const { tasks, pagination } = res.data.data;
      set({
        historyTasks: tasks || [],
        historyPagination: pagination || null,
        isHistoryLoading: false,
      });
    } catch (err: any) {
      set({ isHistoryLoading: false });
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
      // Silent fail for pagination
    }
  },

  fetchAdminTasks: async (params) => {
    set({ isAdminLoading: true });
    try {
      const res = await taskApi.getAdminTasks(params);
      const { tasks, pagination } = res.data.data;
      set({
        adminTasks: tasks || [],
        adminPagination: pagination || null,
        isAdminLoading: false,
      });
    } catch (err: any) {
      set({ isAdminLoading: false });
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
