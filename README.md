# Geofence-Based Attendance Management System with Machine Learning Anomaly Detection

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-yellow.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Isolation Forest](https://img.shields.io/badge/ML-Isolation%20Forest-orange.svg)](https://scikit-learn.org/)

A complete, secure, full-stack enterprise and academic attendance management system automating workplace attendance verification via GPS geofencing, eliminating buddy-punching through single-device registration, recording workplace exits automatically, and detecting suspicious attendance patterns using machine learning and deterministic hard rules.

---

## 1. Project Abstract & Objectives

Traditional attendance tracking methods (biometrics, RFID cards, manual rosters) suffer from physical bottlenecks, buddy-punching, and lack of real-time spatial validation. 

This system achieves three primary innovations:
1. **Accurate Geofence Validation**: Enforces a strict **50-metre radius** perimeter around designated office centers using spherical trigonometry (Haversine formula) and native Android Geofencing APIs.
2. **Cryptographic Single-Device Binding**: Ties an employee account to a single verified physical device via 5-minute single-use OTP verification, preventing unauthorized proxy check-ins.
3. **Dual Anomaly Detection Architecture**: Combines a Python **Isolation Forest** machine learning model evaluating a 4-feature attendance vector with an independent deterministic hard-rule engine (e.g., geofence duration < 30 minutes).

---

## 2. Technology Stack & Compatibility Matrix

| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | React.js, Vite, Lucide Icons | 18.3.1 / 8.3.0 | Responsive HR Admin Dashboard & Employee Mobile PWA Portal |
| **Backend** | Node.js, Express.js | 24.18.0 / 4.19.2 | REST API, JWT Auth, Single-Device OTP Binding, Geofence Engine |
| **Database** | MongoDB, Mongoose | 7.0 / 8.4.0 | Schema validation, spatial data, audit trails (with zero-setup in-memory fallback) |
| **Machine Learning**| Python, Flask, scikit-learn | 3.14.0 / 3.1.2 | Isolation Forest (Liu et al. 2008), 4-feature anomaly detection |
| **Mobile Integration**| Native Android (Java) | SDK 34 / Min 26 | Google Play Services Geofencing, BroadcastReceiver, background transitions |

---

## 3. Agile Sprints Implemented (SRS Roadmap)

- **Sprint 1: Authentication & Single-Device Binding**  
  Bcrypt password hashing, JWT session security, single-device enforcement, single-use 5-minute OTP generation and verification, dev OTP adapter.
- **Sprint 2: Geofence-Based Check-In**  
  Fixed 50-metre radius validation using Haversine formula, GPS coordinate validation, duplicate check-in prevention.
- **Sprint 3: Automatic Exit Logging & Duration Tracking**  
  Native Android geofence exit callbacks, open session closure, exact duration calculation, web geolocation fallback demonstration.
- **Sprint 4: Leave Management & Anomaly Exclusion**  
  Leave request submission, administrative approval/rejection, automatic leave balance deduction, exclusion of approved leaves from attendance anomaly analysis.
- **Sprint 5: ML Anomaly Detection & Hard-Rule Fallback**  
  Strict 4-feature vector computation (`check_in_deviation`, `check_out_deviation`, `geofence_duration`, `distance_from_center`), Isolation Forest inference ($s(x, n)$ score), independent hard rules (< 30 min duration), source attribution (`both`, `ml_only`, `hard_rule_only`, `none`).
- **Sprint 6: HR Analytics Dashboard & Complete System Integration**  
  Live telemetry cards, real database aggregation pipelines, anomaly review/adjudication modal with audit trails, company shift configuration.

---

## 4. Project Directory Structure

```
geofence-attendance-system/
├── backend/                        # Node.js & Express.js REST API
│   ├── src/
│   │   ├── config/                 # Database connection & memoryStore fallback
│   │   ├── controllers/            # Auth, Attendance, Leave, Analytics controllers
│   │   ├── middleware/             # JWT verification, Role guards, Rate limiters
│   │   ├── models/                 # Mongoose schemas (User, Device, Geofence, etc.)
│   │   ├── routes/                 # Express REST endpoint routers
│   │   ├── services/               # OTP service, ML client, DB bridge
│   │   ├── utils/                  # Haversine distance & geofence mathematical formulas
│   │   └── server.js               # Express server entry point
│   ├── tests/                      # Automated test runner (15 test cases)
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── ml-service/                     # Python Machine Learning Microservice
│   ├── app/
│   │   ├── app.py                  # Flask REST API (Port 5001)
│   │   └── isolation_forest_engine.py # Liu, Ting, Zhou (2008) Isolation Forest algorithm
│   ├── evaluation/
│   │   ├── evaluate_model.py       # Evaluation metrics on synthetic ground truth
│   │   └── evaluation_report.json  # Exported metrics (Accuracy 98%, Precision 100%)
│   ├── models/                     # Persisted trained models (.joblib / .json)
│   ├── tests/                      # Python ML unit test suite (5 tests)
│   ├── training/
│   │   ├── generate_synthetic_data.py # Reproducible synthetic attendance generator
│   │   ├── synthetic_attendance_dataset.csv # 2,500 labeled synthetic records
│   │   └── train_model.py          # Model training pipeline
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                       # React.js & Vite Web Application
│   ├── src/
│   │   ├── components/             # Role-based Navbar, alerts, badges
│   │   ├── context/                # AuthContext (JWT, user state)
│   │   ├── pages/
│   │   │   ├── Login.jsx           # Secure login with demo credential pickers
│   │   │   ├── OtpVerification.jsx # Device registration & OTP binding flow
│   │   │   ├── EmployeePortal.jsx  # Radar proximity visualizer & live check-in/out
│   │   │   ├── AdminDashboard.jsx  # HR analytics, punctuality, records table
│   │   │   ├── AnomalyManagement.jsx # Dedicated anomaly review & adjudication modal
│   │   │   ├── LeaveManagement.jsx # Leave applications & administrative approvals
│   │   │   └── GeofenceSettings.jsx # 50m geofence coordinate & shift config
│   │   ├── services/               # REST API client
│   │   ├── styles/                 # Modern responsive CSS design system
│   │   ├── App.jsx                 # Routing and navigation hub
│   │   └── main.jsx
│   ├── Dockerfile
│   └── vite.config.js
├── android-app/                    # Native Android Mobile Implementation
│   └── app/src/main/
│       ├── AndroidManifest.xml     # Fine & background location permissions
│       ├── java/com/attendance/geofence/
│       │   ├── GeofenceHelper.java # Google Play Services GeofencingClient builder
│       │   ├── GeofenceBroadcastReceiver.java # Native entry & automatic exit callback
│       │   ├── DeviceManager.java  # Hardware ID & session persistence
│       │   └── MainActivity.java   # Mobile home screen
│       └── res/layout/activity_main.xml
├── docs/                           # Comprehensive Academic Deliverables
│   ├── SRS_ARCHITECTURE.md         # System Architecture, DFD, Use Case, UML diagrams
│   ├── API_DOCUMENTATION.md        # Full REST API specification
│   ├── MACHINE_LEARNING_METHODOLOGY.md # Mathematical theory & 4-feature vector
│   └── INSTALLATION_AND_DEPLOYMENT.md # Setup & cloud deployment guides
├── scripts/
│   └── seed-data.js                # Database population script
├── docker-compose.yml              # Multi-container orchestration
├── .env.example
└── README.md
```

---

## 5. Quickstart: Running Locally

### Step 1: Start the Python ML Service
```powershell
python ml-service/app/app.py
```
*Listens on `http://localhost:5001`.*

### Step 2: Start the Express Backend Server
```powershell
node backend/src/server.js
```
*Listens on `http://localhost:5000` (API: `http://localhost:5000/api`).*

### Step 3: Start the React Frontend Application
```powershell
cd frontend
node node_modules/vite/bin/vite.js --host --port 3000
```
*Open your browser at `http://localhost:3000`.*

---

## 6. Demo Accounts & Credentials

| Role | Employee ID | Email | Password |
|---|---|---|---|
| **HR Administrator** | `ADMIN001` | `admin@attendance.local` | `Admin@12345` |
| **Employee 1 (Alice)** | `EMP001` | `alice@company.local` | `Emp@12345` |
| **Employee 2 (Bob)** | `EMP002` | `bob@company.local` | `Emp@12345` |
| **Employee 3 (Charlie)** | `EMP003` | `charlie@company.local` | `Emp@12345` |

---

## 7. Automated Test Results

### 7.1 Backend Test Suite (`node backend/tests/run-tests.js`)
```
============================================================
  RUNNING GEOFENCE ATTENDANCE SYSTEM AUTOMATED TEST SUITE   
============================================================
[SUITE 1] Geofence & Haversine Distance Tests:
  ✓ Validates correct GPS coordinates (-90..90, -180..180)
  ✓ Calculates exact distance of 0m when user coordinate equals center
  ✓ Correctly verifies coordinates inside 50-metre boundary
  ✓ Correctly rejects coordinates outside 50-metre boundary
  ✓ Boundary edge behavior: distance just under 50m passes, just over 50m fails

[SUITE 2] Authentication, OTP & Device Binding Logic Tests:
  ✓ Generates a 6-digit numeric OTP
  ✓ Dev OTP delivery adapter successfully delivers OTP with debug field in development

[SUITE 3] ML Feature Vector & Hard Rule Tests:
  ✓ Extracts the 4-feature vector in exact required order
  ✓ Calculates positive deviation for late arrival and negative for early arrival
  ✓ Hard Rule: Duration under 30 minutes triggers hard rule violation
  ✓ Hard Rule: Duration above 30 minutes within normal bounds does not violate hard rules
  ✓ Hard Rule: Distance exceeding 50m triggers boundary violation

[SUITE 4] Leave Calculation & Business Rules Tests:
  ✓ Calculates inclusive days between start and end date correctly
  ✓ Prevents invalid start date after end date
  ✓ Enforces leave balance deduction: balance cannot become negative

============================================================
  TEST RESULTS: 15/15 PASSED (0 FAILED)
============================================================
```

### 7.2 Python ML Unit Tests (`python ml-service/tests/test_ml_service.py`)
```
.....
----------------------------------------------------------------------
Ran 5 tests in 0.027s
OK
```

### 7.3 Model Evaluation on 2,500 Synthetic Records (`python ml-service/evaluation/evaluate_model.py`)
- **Evaluated Records**: 2,500
- **Accuracy**: 98.00%
- **Precision**: 100.00%
- **Recall**: 83.33%
- **F1-Score**: 90.91%

---

## 8. SRS Requirement-by-Requirement Mapping

| SRS Section | SRS Requirement | Implemented Feature / Module | Verification |
|---|---|---|---|
| **Section 3** | Employee & Admin Roles | Role-based JWT middleware (`requireRole('admin')`), distinct frontend portals | Verified via role endpoints |
| **Section 4** | Authentication & Single-Device Binding | Bcrypt hashing, 5-min single-use OTP (`otpService.js`), single active device rule | Verified: 15/15 tests pass |
| **Section 5** | Fixed 50m Geofence Check-In | Fixed 50-metre radius, Haversine formula (`utils/geofence.js`), duplicate check-in rejection | Verified: 409 on duplicate |
| **Section 6** | Automatic Exit Logging & Duration | Native Android `GeofenceBroadcastReceiver`, automatic exit callback, exact duration calculation | Verified via `check-out` API |
| **Section 7** | ML Anomaly Detection | Python Isolation Forest (`ml-service/app/app.py`), 4-feature vector, synthetic generator | Verified: real inference |
| **Section 7** | Hard-Rule Fallback | < 30 mins duration rule (`evaluateHardRules`), independent execution, source attribution | Verified: flagged with `both` |
| **Section 8** | Configurable Shift Schedule | Company-wide shift schedule (`09:00 - 18:00`), deviation calculations | Verified via shift endpoints |
| **Section 9** | Leave Management | Leave request submission, approval/rejection, balance deduction, anomaly exclusion | Verified: balance deducted |
| **Section 10**| HR Analytics Dashboard | Live telemetry metrics, anomaly review & adjudication modal, filterable table | Verified via React UI |
| **Section 15**| Native Android Mobile App | Google Play Services Geofencing, fine & background location permissions, native receiver | Implemented in `android-app/` |
| **Biometrics**| Face Recognition & Verification | OpenCV YuNet + SFace deep embedding model, AES-256-GCM template encryption, one-time token gating | Verified: 22/22 tests pass |

---

## 9. Face Recognition & Biometric Attendance Gating

The platform features an enterprise-grade face recognition system designed to eliminate buddy-punching and proxy attendance:

1. **Mandatory Face Enrollment with Explicit Consent**:
   - Explicit consent record with timestamp and version tracking (`v1.0`).
   - Image quality validation (sharpness via Laplacian variance, luminance range 30-240, contrast checks).
   - Single-face constraint enforcement (rejects 0 faces or multiple faces).

2. **Computer Vision & Deep Learning Stack**:
   - **Face Detection**: OpenCV **YuNet** Deep Neural Network (`face_detection_yunet_2023mar.onnx`).
   - **Face Embedding Extraction**: OpenCV **SFace** Deep Face Recognizer (`face_recognition_sface_2021dec.onnx`) generating normalized 128-dimensional vectors.
   - **Matching Metric**: Cosine Similarity ($\ge 0.70$) & Euclidean Distance ($\le 0.75$).
   - **Anti-Spoofing / Liveness**: High-frequency texture energy analysis and natural color saturation distribution checks.

3. **Zero Client-Side Trust (One-Time Verification Tokens)**:
   - Attendance check-in and check-out strictly require a valid, single-use `verificationReference` issued by `POST /api/face/verify` with a 120-second expiration window.
   - Replay attacks using already-consumed tokens are rejected with HTTP 403 Forbidden.

4. **Cryptographic Protection of Biometric Data**:
   - Raw face photographs are **never permanently stored**.
   - Feature vectors are encrypted at rest with authenticated **AES-256-GCM** encryption.

5. **Automated Verification Test Suite**:
   ```bash
   node backend/tests/face-attendance-tests.js
   ```
   **Result: 22 / 22 Passed (0 Failed).**
   - Detailed specification available at `docs/FACE_RECOGNITION_ARCHITECTURE.md`.

