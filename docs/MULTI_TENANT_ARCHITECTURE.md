# Multi-Tenant Geofence-Based Attendance Platform with ML Anomaly Detection

## Architectural Specification & Platform Manual (v2.0)

---

### 1. Executive Summary

This document specifies the multi-tenant upgrade of the **Geofence-Based Attendance Management System with ML Anomaly Detection**. The platform enables independent organizations, companies, offices, hospitals, universities, and commercial sites to register autonomously. Each workplace maintains an isolated tenant perimeter featuring dedicated administrator controls, customizable geofence centers, configurable radius thresholds (defaulting to 50 metres), tenant-scoped shift schedules, employee membership workflows, leave management, and Isolation Forest machine learning anomaly analysis.

---

### 2. User Roles & Access Hierarchy

The platform implements a 3-tier Role-Based Access Control (RBAC) hierarchy enforced strictly server-side:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Platform SuperAdmin (`superadmin`)                   │
│   - Global tenant oversight, registration reviews & workplace status   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Governs
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Workplace Administrator (`admin`)                     │
│   - Exactly 1 active administrator per workplace                       │
│   - Geofence center & radius configuration (default 50m)               │
│   - Employee membership approval queue & workplace roster              │
│   - Shift schedules, leave requests & ML anomaly review                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Manages
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Employee (`employee`)                          │
│   - Public platform account with SMS OTP device binding               │
│   - Workplace browse, search, and membership join requests             │
│   - Real GPS geofence check-in & check-out                             │
│   - Personal attendance history & leave management                     │
└────────────────────────────────────────────────────────────────────────┘
```

#### A. Platform Administrator (`superadmin`)
- Accessible via secure pre-seeded platform accounts or elevated keys.
- Views all registered workplaces across all categories and regions.
- Reviews incoming workplace registrations (`pending`, `approved`, `suspended`).
- Performs platform governance actions (approve, reject, suspend, reactivate).
- Monitors aggregate platform telemetry: total tenants, registered users, and system health.

#### B. Workplace Administrator (`admin`)
- Exactly **one active administrator** per workplace in version 1.0.
- Registered through the public workplace registration flow.
- Configures workplace geofence coordinates, location name, and radius (defaulting to 50m with visual live-radius maps).
- Reviews employee membership requests in the dedicated verification queue.
- Configures standard shift windows (`shiftStart`, `shiftEnd`, grace periods).
- Reviews attendance records, punctuality rates, and anomalies flagged by Isolation Forest or hard rules.
- Approves or declines employee leave requests with automated balance deductions.
- Protected by strict server-side tenant isolation (`attachTenantContext`).

#### C. Employee (`employee`)
- Creates a public platform account with mobile number and password.
- Verifies mobile number through SMS OTP and binds one active mobile hardware device.
- Browses approved workplaces in the directory and submits a membership join request.
- Once approved, marks attendance within the workplace geofence perimeter.
- Submits leave applications and monitors balance.
- Cannot view records, devices, or leaves from other employees or workplaces.

---

### 3. Strict Multi-Tenant Isolation Architecture

Tenant isolation is implemented through three redundant security rings:

1. **Identity Ring (`attachTenantContext` middleware)**:
   - When any authenticated request arrives, the server resolves tenant context directly from the verified token and database record.
   - Workplace Administrators have their `workplaceId` bound server-side to their assigned organization. Any attempt to query or tamper with another workplace ID is rejected with `403 Forbidden`.
   - Employees have their active membership verified. If an employee belongs to Workplace A, they cannot view or check in to Workplace B.

2. **Database Ring (`dbBridge` filter injection)**:
   - All attendance queries (`queryAttendance`), anomaly queries (`getAnomalyRecords`), shift schedules, geofences, and leave queries (`queryLeaves`) automatically inject `{ workplaceId: req.workplaceId }`.
   - Cross-tenant data leakage is prevented at the data access abstraction layer.

3. **Geofence Perimeter Ring (`verifyGeofence`)**:
   - Geofence verification compares employee GPS telemetry strictly against that specific workplace's center and radius.
   - An employee must be within their assigned workplace's geofence radius to record attendance.

---

### 4. Seeded Test & Demonstration Accounts

The platform includes pre-configured, isolated test accounts for evaluation:

| Role | Username / Identifier | Password | Tenant / Workplace | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Platform SuperAdmin** | `SUPERADMIN001` | `SuperAdmin@12345` | Platform-Wide | Tenant governance & moderation |
| **Workplace Admin 1** | `ADMIN001` | `Admin@12345` | Acme Tech Bangalore (`WP_ACME_001`) | Workplace management, 50m radius |
| **Workplace Admin 2** | `ADMIN002` | `Admin@12345` | Metro Retail Chennai (`WP_METRO_002`) | Independent branch, 75m radius |
| **Workplace Admin 3** | `ADMIN003` | `Admin@12345` | Apex Biotech Hyderabad (`WP_APEX_003`) | Pending workplace for review |
| **Employee 1** | `EMP001` | `Emp@12345` | Acme Tech Bangalore (`WP_ACME_001`) | Active employee (Alice) |
| **Employee 2** | `EMP002` | `Emp@12345` | Acme Tech Bangalore (`WP_ACME_001`) | Active employee with anomalies (Bob) |
| **Employee 3** | `EMP003` | `Emp@12345` | Metro Retail Chennai (`WP_METRO_002`) | Active employee in Metro Retail |
| **Employee 4** | `EMP005` | `Emp@12345` | Apex Biotech Hyderabad | Applicant with pending join request |

---

### 5. API Reference Summary

#### Multi-Workplace Platform Endpoints (`/api/workplaces`)
- `POST /api/workplaces/register`: Public registration of organization, geofence, and administrator.
- `GET /api/workplaces/public`: Browse and search approved public workplaces.
- `GET /api/workplaces/my-workplace`: Fetch workplace profile and metrics for the authenticated administrator.
- `PUT /api/workplaces/my-workplace`: Update workplace address, contact, and settings.
- `GET /api/workplaces/platform/all`: List all registered workplaces (SuperAdmin only).
- `PUT /api/workplaces/platform/:id/review`: Approve, reject, suspend, or reactivate a workplace (SuperAdmin only).
- `GET /api/workplaces/platform/dashboard-summary`: Platform-wide aggregate metrics (SuperAdmin only).

#### Membership Endpoints (`/api/memberships`)
- `POST /api/memberships/request`: Employee applies to join an approved workplace.
- `GET /api/memberships/my-status`: Check active workplace membership status.
- `GET /api/memberships/pending`: List pending employee applications (Workplace Admin only).
- `GET /api/memberships/members`: List approved workplace personnel directory (Workplace Admin only).
- `PUT /api/memberships/:id/approve`: Approve applicant and bind account to workplace (Workplace Admin only).
- `PUT /api/memberships/:id/reject`: Decline membership application (Workplace Admin only).
- `PUT /api/memberships/:id/status`: Suspend or reactivate member (Workplace Admin only).

#### Attendance & Geofencing Endpoints (`/api/attendance`)
- `POST /api/attendance/check-in`: GPS attendance check-in verified against workplace geofence radius.
- `POST /api/attendance/check-out`: Session completion and duration calculation.
- `GET /api/attendance/status`: Current session, workplace geofence center, and shift info.
- `GET /api/attendance/history`: Personal employee attendance history.
- `GET /api/attendance/geofence`: Retrieve workplace geofence center and radius.
- `PUT /api/attendance/geofence`: Update workplace geofence center and radius (Admin only).
- `GET /api/attendance/shift-schedule`: Get workplace shift window (Admin only).
- `PUT /api/attendance/shift-schedule`: Update workplace shift schedule (Admin only).

---

### 6. Verification and Test Results

The platform is covered by two automated test suites:

1. **`backend/tests/multi-tenant-tests.js`**:
   - 36 Automated Test Assertions across 7 test suites:
     - Multi-role authentication (SuperAdmin, Admin 1, Admin 2, Employee).
     - Public workplace registration with custom geofence and radius.
     - Platform SuperAdmin review, approval, and 403 access control.
     - Strict tenant isolation (Admin 1 cannot see or edit Admin 2 records or shifts).
     - Membership lifecycle (request, admin pending queue, approval, active status).
     - Geofence attendance gating (unassigned check-in block, outside perimeter rejection, inside perimeter completion).
     - Tenant-scoped leave management.
   - **Result: 36 / 36 PASSED (100% Pass Rate)**.

2. **`backend/tests/run-tests.js`**:
   - 15 Core System Tests (Haversine formula, OTP binding, ML feature vector, hard rule thresholds, leave calculations).
   - **Result: 15 / 15 PASSED (100% Pass Rate)**.
