import client from './client';

export const employeeApi = {
  getMyProfile: () => client.get('/employees/me'),
  getManagement: () => client.get('/employees/management'),
  getById: (id: string) => client.get(`/employees/${id}`),
};
