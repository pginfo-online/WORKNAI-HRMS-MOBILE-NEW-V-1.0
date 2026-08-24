import client from './client';

export const payrollApi = {
  getMyPayslips: (params?: { page?: number; limit?: number; year?: number; month?: number }) =>
    client.get('/payroll/list', { params: { ...params, self: 'true' } }),
  getSalarySlip: (id: string) => client.get(`/payroll/salary-slip/${id}`),
  downloadPayslip: (id: string) => client.get(`/payroll/salary-slip/${id}`, { responseType: 'blob' }),
};
