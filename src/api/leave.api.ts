import client from './client';

export const leaveApi = {
  getMyBalance: () => client.get('/leave-balance/me'),
  getMyLeaves: (params?: { page?: number; limit?: number; status?: string; year?: number }) =>
    client.get('/leaves/my', { params }),
  apply: (data: {
    leaveType: 'Paid' | 'CompOff' | 'Unpaid';
    startDate: string;
    endDate?: string;
    reason: string;
    halfDay?: boolean;
    halfDayPeriod?: string;
  }) => client.post('/leaves', data),
  cancel: (id: string, reason?: string) => client.patch(`/leaves/${id}/cancel`, { reason }),
};

export const payrollApi = {
  getMyPayslips: (params?: { page?: number; limit?: number }) =>
    client.get('/payroll/list', { params: { ...params, self: 'true' } }),
  getSalarySlip: (id: string) => client.get(`/payroll/salary-slip/${id}`),
};
