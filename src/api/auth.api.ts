import client from './client';

export const authApi = {
  login: (data: { employeeCode: string; password: string }) => client.post('/auth/login', data),
  logout: () => client.post('/auth/logout'),
  getMe: () => client.get('/auth/me'),
  updateProfile: (data: any) => client.put('/auth/profile', data),
  changePassword: (data: any) => client.patch('/auth/change-password', data),
};
