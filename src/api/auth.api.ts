import client from './client';

export interface UpdateProfileDto {
  mobileNumber?: string;
  alternateMobileNumber?: string;
  gender?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  fatherName?: string;
  motherName?: string;
  currentAddress?: string;
  permanentAddress?: string;
  district?: string;
  state?: string;
  pincode?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactMobile?: string;
  emergencyContactAddress?: string;
  profileImageUrl?: string;
  profileImageBase64?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export const authApi = {
  login: (data: { employeeCode: string; password: string }) => client.post('/auth/login', data),
  logout: () => client.post('/auth/logout'),
  getMe: () => client.get('/auth/me'),
  uploadAvatar: (formData: FormData) =>
    client.post('/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateProfile: (data: UpdateProfileDto) => client.put('/auth/profile', data),
  changePassword: (data: ChangePasswordDto) => client.post('/auth/change-password', data),
};
