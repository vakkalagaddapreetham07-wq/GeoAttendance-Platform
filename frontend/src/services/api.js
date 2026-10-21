/**
 * Frontend API Service Client
 * Handles HTTP requests, JWT token management, and error handling.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Fetch wrapper with token authorization header
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Authentication & Device Binding
  login: (identifier, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    }),

  firebaseLogin: (payload) =>
    request('/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  register: (userData) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),

  sendRegistrationOtp: (phone) =>
    request('/auth/registration-otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone })
    }),

  verifyRegistrationOtp: (phone, otp) =>
    request('/auth/registration-otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp })
    }),

  sendRegistrationEmail: (email) =>
    request('/auth/registration-email/send', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),

  verifyEmailCode: (sessionId, code) =>
    request('/auth/registration-email/verify-code', {
      method: 'POST',
      body: JSON.stringify({ sessionId, code })
    }),

  checkEmailVerificationStatus: (sessionId) =>
    request(`/auth/registration-email/status?sessionId=${encodeURIComponent(sessionId)}`),

  getMe: () => request('/auth/me'),

  logout: () =>
    request('/auth/logout', {
      method: 'POST'
    }),

  requestOtp: (employeeId, password, deviceId, deviceModel) =>
    request('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ employeeId, password, deviceId, deviceModel })
    }),

  verifyOtpAndBindDevice: (employeeId, deviceId, deviceModel, osVersion, otp) =>
    request('/auth/verify-otp-device', {
      method: 'POST',
      body: JSON.stringify({ employeeId, deviceId, deviceModel, osVersion, otp })
    }),

  getDeviceBinding: (employeeId) =>
    request(employeeId ? `/auth/device-binding/${employeeId}` : '/auth/device-binding'),

  // Attendance & Geofencing
  checkIn: (deviceId, latitude, longitude, accuracy, verificationReference) =>
    request('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({ deviceId, latitude, longitude, accuracy, verificationReference, isNativeEvent: false })
    }),

  checkOut: (deviceId, latitude, longitude, accuracy, verificationReference) =>
    request('/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({ deviceId, latitude, longitude, accuracy, verificationReference, isNativeEvent: false })
    }),

  // Face Recognition & Biometric Verification
  getFaceStatus: () => request('/face/status', { method: 'GET' }),
  enrollFace: (imageData, consentGiven, consentStatement) =>
    request('/face/enroll', {
      method: 'POST',
      body: JSON.stringify({ image: imageData, consentGiven, consentStatement })
    }),
  verifyFace: (imageData) =>
    request('/face/verify', {
      method: 'POST',
      body: JSON.stringify({ image: imageData })
    }),
  reEnrollFace: (password, imageData, consentGiven, consentStatement) =>
    request('/face/re-enroll', {
      method: 'POST',
      body: JSON.stringify({ password, image: imageData, consentGiven, consentStatement })
    }),
  deleteFaceEnrollment: (password) =>
    request('/face/enrollment', {
      method: 'DELETE',
      body: JSON.stringify({ password })
    }),

  getAttendanceStatus: () =>
    request('/attendance/status'),

  getAttendanceHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/attendance/history?${query}`);
  },

  getGeofence: (employeeId) =>
    request(employeeId ? `/attendance/geofence/${employeeId}` : '/attendance/geofence'),

  updateGeofence: (employeeId, latitude, longitude, locationName, radius) =>
    request(`/attendance/geofence/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify({ latitude, longitude, locationName, radius })
    }),

  // Leave Management
  submitLeave: (leaveData) =>
    request('/leave/apply', {
      method: 'POST',
      body: JSON.stringify(leaveData)
    }),

  getMyLeaves: () =>
    request('/leave/my-leaves'),

  getPendingLeaves: () =>
    request('/leave/pending'),

  getAllLeaves: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/leave/all?${query}`);
  },

  approveLeave: (id, decisionNote) =>
    request(`/leave/approve/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ decisionNote })
    }),

  rejectLeave: (id, decisionNote) =>
    request(`/leave/reject/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ decisionNote })
    }),

  // HR Analytics & Anomaly Management
  getDashboardSummary: (workplaceId) =>
    request(workplaceId ? `/analytics/dashboard-summary?workplaceId=${workplaceId}` : '/analytics/dashboard-summary'),

  getAttendanceRecords: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/analytics/attendance-records?${query}`);
  },

  getAnomalyRecords: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/analytics/anomalies?${query}`);
  },

  reviewAnomaly: (id, reviewStatus, reviewNotes) =>
    request(`/analytics/anomalies/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ reviewStatus, reviewNotes })
    }),

  getShiftSchedule: () =>
    request('/analytics/shift-schedule'),

  updateShiftSchedule: (scheduleData) =>
    request('/analytics/shift-schedule', {
      method: 'PUT',
      body: JSON.stringify(scheduleData)
    }),

  // Multi-Workplace Platform & Tenant APIs
  registerWorkplace: (workplaceData) =>
    request('/workplaces/register', {
      method: 'POST',
      body: JSON.stringify(workplaceData)
    }),

  getPublicWorkplaces: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/workplaces/public?${query}`);
  },

  getMyWorkplace: () =>
    request('/workplaces/my-workplace'),

  updateMyWorkplace: (updates) =>
    request('/workplaces/my-workplace', {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),

  requestAdminReplacement: (data) =>
    request('/workplaces/admin-replacement', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getPlatformAllWorkplaces: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/workplaces/platform/all?${query}`);
  },

  reviewPlatformWorkplace: (id, status, notes = '') =>
    request(`/workplaces/platform/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes })
    }),

  getPlatformDashboardSummary: () =>
    request('/workplaces/platform/dashboard-summary'),

  // Workplace Membership APIs
  requestMembership: (workplaceId, requestNote = '') =>
    request('/memberships/request', {
      method: 'POST',
      body: JSON.stringify({ workplaceId, requestNote })
    }),

  getMyMembershipStatus: () =>
    request('/memberships/my-status'),

  getPendingMemberships: () =>
    request('/memberships/pending'),

  getWorkplaceMembers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/memberships/members?${query}`);
  },

  approveMembership: (id, notes = '', assignedWorkplaceEmployeeId = '') =>
    request(`/memberships/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ notes, assignedWorkplaceEmployeeId })
    }),

  rejectMembership: (id, notes = '') =>
    request(`/memberships/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ notes })
    }),

  updateMemberStatus: (id, status, notes = '') =>
    request(`/memberships/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes })
    })
};
