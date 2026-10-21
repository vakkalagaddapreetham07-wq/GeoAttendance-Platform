# API Documentation & REST Interface Specification
## Geofence-Based Attendance Management System with ML Anomaly Detection

Base URL: `http://localhost:5000/api` (Production: `https://api.yourdomain.com/api`)  
Content-Type: `application/json`  
Authentication Scheme: `Bearer <JWT_TOKEN>` in HTTP `Authorization` Header

---

## 1. Authentication & Device Binding Endpoints

### 1.1 User Login
- **Endpoint**: `POST /auth/login`
- **Access**: Public (Rate-limited: 10 req / 15 min)
- **Request Body**:
```json
{
  "identifier": "ADMIN001",
  "password": "Admin@12345"
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "employeeId": "ADMIN001",
    "name": "Sarah Connor (HR Admin)",
    "email": "admin@attendance.local",
    "role": "admin",
    "department": "Human Resources",
    "leaveBalance": { "sick": 15, "casual": 15, "annual": 20 },
    "isDeviceBound": false,
    "boundDeviceId": null
  }
}
```

### 1.2 Request OTP for Device Registration
- **Endpoint**: `POST /auth/request-otp`
- **Access**: Public / Credential-protected (Rate-limited: 3 req / 5 min)
- **Request Body**:
```json
{
  "employeeId": "EMP001",
  "password": "Emp@12345",
  "deviceId": "DEVICE_ANDROID_A12345B",
  "deviceModel": "Google Pixel 8 (Android 14)"
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "OTP dispatched to registered contact for employee EMP001. Valid for 5 minutes.",
  "channel": "DEV_CONSOLE_ADAPTER",
  "expiresAt": "2026-10-15T10:00:00.000Z",
  "debugOtp": "466784"
}
```

### 1.3 Verify OTP & Bind Device
- **Endpoint**: `POST /auth/verify-otp-device`
- **Access**: Public
- **Request Body**:
```json
{
  "employeeId": "EMP001",
  "deviceId": "DEVICE_ANDROID_A12345B",
  "deviceModel": "Google Pixel 8",
  "osVersion": "Android 14",
  "otp": "466784"
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Device successfully registered and bound to account.",
  "device": {
    "employeeId": "EMP001",
    "deviceId": "DEVICE_ANDROID_A12345B",
    "deviceModel": "Google Pixel 8",
    "isBound": true,
    "registeredAt": "2026-10-15T09:55:00.000Z"
  }
}
```

---

## 2. Attendance & Geofencing Endpoints

### 2.1 Record Geofence Check-In
- **Endpoint**: `POST /attendance/check-in`
- **Access**: Employee Authenticated
- **Request Body**:
```json
{
  "deviceId": "DEVICE_ANDROID_A12345B",
  "latitude": 12.97162,
  "longitude": 77.59458,
  "accuracy": 8.5
}
```
- **Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "Check-in successful! Welcome to work.",
  "attendance": {
    "id": "att_1792057987634",
    "employeeId": "EMP001",
    "attendanceDate": "2026-10-15",
    "checkInTime": "2026-10-15T09:00:00.000Z",
    "distanceToCenter": 11.2,
    "status": "checked_in"
  }
}
```
- **Error: Outside Geofence (400 Bad Request)**:
```json
{
  "success": false,
  "error": "Outside geofence. You are 142.5 meters away from your designated workplace. Required: within 50m.",
  "currentDistance": 142.5,
  "geofenceRadius": 50
}
```
- **Error: Duplicate Active Session (409 Conflict)**:
```json
{
  "success": false,
  "error": "Already checked in. An active attendance session is already in progress."
}
```

### 2.2 Record Geofence Check-Out & Trigger ML Assessment
- **Endpoint**: `POST /attendance/check-out`
- **Access**: Employee Authenticated
- **Request Body**:
```json
{
  "deviceId": "DEVICE_ANDROID_A12345B",
  "latitude": 12.97162,
  "longitude": 77.59458,
  "accuracy": 10
}
```
- **Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Check-out successfully recorded.",
  "attendance": {
    "id": "att_1792057987634",
    "employeeId": "EMP001",
    "attendanceDate": "2026-10-15",
    "checkInTime": "2026-10-15T08:58:00.000Z",
    "checkOutTime": "2026-10-15T18:05:00.000Z",
    "durationMinutes": 547,
    "status": "completed",
    "anomaly": {
      "isAnomaly": false,
      "detectionSource": "none",
      "explanation": "Normal attendance session. Within acceptable shift and geofence parameters."
    }
  }
}
```

### 2.3 Get Current Live Geofence Status
- **Endpoint**: `GET /attendance/status`
- **Access**: Employee Authenticated

### 2.4 Update Employee Geofence Coordinates
- **Endpoint**: `PUT /attendance/geofence/:employeeId`
- **Access**: Administrator Only
- **Request Body**:
```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "locationName": "Main Technology Park Building"
}
```

---

## 3. Leave Management Endpoints

### 3.1 Apply for Leave
- **Endpoint**: `POST /leave/apply`
- **Access**: Employee Authenticated
- **Request Body**:
```json
{
  "leaveType": "sick",
  "startDate": "2026-10-20",
  "endDate": "2026-10-21",
  "reason": "Viral fever recovery"
}
```

### 3.2 List Pending Leave Requests
- **Endpoint**: `GET /leave/pending`
- **Access**: Administrator Only

### 3.3 Approve Leave
- **Endpoint**: `PUT /leave/approve/:id`
- **Access**: Administrator Only
- **Request Body**:
```json
{
  "decisionNote": "Approved by HR Department."
}
```

### 3.4 Reject Leave
- **Endpoint**: `PUT /leave/reject/:id`
- **Access**: Administrator Only
- **Request Body**:
```json
{
  "decisionNote": "Declined due to critical delivery sprint."
}
```

---

## 4. HR Analytics & Anomaly Review Endpoints

### 4.1 Dashboard Analytics Summary
- **Endpoint**: `GET /analytics/dashboard-summary`
- **Access**: Administrator Only

### 4.2 Query Attendance Records
- **Endpoint**: `GET /analytics/attendance-records?page=1&limit=20&isAnomaly=true`
- **Access**: Administrator Only

### 4.3 Review & Resolve Anomaly
- **Endpoint**: `PUT /analytics/anomalies/:id/review`
- **Access**: Administrator Only
- **Request Body**:
```json
{
  "reviewStatus": "resolved",
  "reviewNotes": "HR Verified: Off-site client meeting authorized by manager."
}
```

### 4.4 Get/Update Shift Schedule
- **Endpoint**: `GET /analytics/shift-schedule` | `PUT /analytics/shift-schedule`
- **Access**: Administrator Only
