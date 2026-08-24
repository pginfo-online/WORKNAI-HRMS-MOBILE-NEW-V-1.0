import client from './client';

export interface DashboardResponse {
  todayRecord: any;
  monthlySummary: {
    present: number;
    absent: number;
    late: number;
    totalHours: number;
  };
  birthdays: {
    today: Array<{
      _id: string;
      name: string;
      employeeCode: string;
      profileImageUrl?: string;
      department?: string;
    }>;
    tomorrow: Array<{
      _id: string;
      name: string;
      employeeCode: string;
      profileImageUrl?: string;
      department?: string;
    }>;
  };
  upcomingHolidays: Array<{
    _id: string;
    date: string;
    name: string;
    type?: string;
    description?: string;
  }>;
  leaveSummary: {
    paidLeaveBalance: number;
    compOffBalance: number;
    pendingLeavesCount: number;
  };
}

export const dashboardApi = {
  getEmployeeDashboard: () => client.get<{ data: DashboardResponse }>('/dashboard/employee-dashboard'),
};
