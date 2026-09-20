import client from './client';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Assigned' | 'In Progress' | 'Completed' | 'Pending';
export type TaskReviewStatus = 'Pending' | 'Reviewed' | 'NeedsRevision';

export interface TaskItem {
  _id: string;
  employeeId: string;
  employeeCode: string;
  employeeName?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  reviewStatus: TaskReviewStatus;
  dueTime?: string;
  date: string;
  notes?: string;
  isSelfAssigned: boolean;
  isAdminAssigned: boolean;
  assignedByName?: string;
  reviewedByName?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueTime?: string;
  notes?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueTime?: string;
  notes?: string;
}

export interface SessionTasksResponse {
  tasks: TaskItem[];
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    completionPercentage: number;
  };
}

export interface MyTasksParams {
  status?: string;
  priority?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AdminTaskParams extends MyTasksParams {
  employeeCode?: string;
  department?: string;
  reviewStatus?: string;
}

export const taskApi = {
  // Employee endpoints
  getTodaySessionTasks: () =>
    client.get<{ data: SessionTasksResponse }>('/tasks/session/today'),
  createTask: (data: CreateTaskPayload) =>
    client.post<{ data: TaskItem }>('/tasks', data),
  updateTask: (id: string, data: UpdateTaskPayload) =>
    client.patch<{ data: TaskItem }>(`/tasks/${id}`, data),
  deleteTask: (id: string) =>
    client.delete<{ data: { id: string } }>(`/tasks/${id}`),
  syncCheckout: (tasks: Partial<TaskItem>[]) =>
    client.post<{ data: { tasks: TaskItem[]; summaryText: string; pendingText: string; completedCount: number; pendingCount: number } }>(
      '/tasks/sync-checkout',
      { tasks }
    ),
  getMyTasks: (params?: MyTasksParams) =>
    client.get<{ data: { tasks: TaskItem[]; pagination: any } }>('/tasks/my', { params }),
  getTaskById: (id: string) =>
    client.get<{ data: TaskItem }>(`/tasks/${id}`),

  // Admin/Manager endpoints
  getAdminTasks: (params?: AdminTaskParams) =>
    client.get<{ data: { tasks: TaskItem[]; summary: any; pagination: any } }>('/tasks/admin/all', { params }),
  reviewTask: (id: string, data: { reviewNotes?: string; reviewStatus?: TaskReviewStatus }) =>
    client.patch<{ data: TaskItem }>(`/tasks/${id}/review`, data),
};
