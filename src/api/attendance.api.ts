import client from './client';

export interface CheckInData {
  latitude?: number;
  longitude?: number;
  workMode: 'Office' | 'WFH';
  tasks?: { title: string; priority?: string }[];
}

export interface CheckOutData {
  latitude?: number;
  longitude?: number;
  todayWork?: string;
  pendingWork?: string;
  issuesFaced?: string;
  reportParticipants?: string[];
  tasks?: any[];
}

export interface CorrectionRequestData {
  attendanceId?: string;
  date?: string;             // YYYY-MM-DD
  requestedStatus?: 'P' | 'Half' | 'Coff' | string;
  requestedInTime?: string;  // ISO string
  requestedOutTime?: string; // ISO string
  correctionReason: string;
  correctionProofUrl?: string;
}

export interface AttendanceSummaryParams {
  from?: string;  // YYYY-MM-DD
  to?: string;    // YYYY-MM-DD
  page?: number;
  limit?: number;
}

export const attendanceApi = {
  getToday: () => client.get('/attendance/today'),
  checkIn: (data: CheckInData) => client.post('/attendance/check-in', data),
  checkOut: (data: CheckOutData) => client.post('/attendance/check-out', data),
  getMySummary: (params?: AttendanceSummaryParams) =>
    client.get('/attendance/my-summary', { params }),
  requestCorrection: (data: CorrectionRequestData) =>
    client.post('/attendance/correction', data),
  editCorrection: (id: string, data: Partial<CorrectionRequestData>) =>
    client.put(`/attendance/correction/${id}`, data),
  getPendingCorrections: () =>
    client.get('/attendance/corrections/pending'),
  getMyCorrectionHistory: () =>
    client.get('/attendance/my-corrections'),
};

