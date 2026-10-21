# Face Recognition Attendance System Architecture & Technical Specification

## 1. Executive Summary & Objective

The **Face Recognition Attendance System** integrates real biometric facial verification directly into the Multi-Workplace Geofence-Based Attendance Platform. It eliminates **buddy-punching**, device-sharing fraud, and credential-sharing attempts by ensuring that manual attendance check-in and check-out events are mathematically verified against an enrolled employee biometric template.

---

## 2. Core Security & Architectural Principles

1. **Strict Server-Side Verification Gating (Zero Client-Side Trust)**
   - The backend never trusts a client-reported flag like `faceVerified: true`.
   - Before attendance can be recorded, the client must capture a live photo and submit it to `POST /api/face/verify`.
   - Upon a verified biometric match (similarity $\ge 0.70$), the server issues a cryptographically random, short-lived (120-second TTL), single-use `verificationReference` token.
   - The attendance controller validates and permanently consumes this token during `checkIn` or `checkOut`. Replay attacks using consumed or expired tokens are rejected with HTTP 403 Forbidden.

2. **Cryptographic Protection of Biometric Data at Rest (AES-256-GCM)**
   - Raw face photographs are **never permanently stored** on disk or in the database.
   - Facial feature embeddings (128-dimensional floating point vectors) are encrypted at rest using authenticated **AES-256-GCM** encryption (`iv`, `ciphertext`, `authTag`).
   - Biometric decryption occurs exclusively in volatile memory during template matching.

3. **Multi-Workplace Tenant Isolation**
   - Each biometric enrollment is strictly scoped to the employee's assigned `workplaceId`.
   - Cross-workplace matching is prevented at the database and service layer.
   - Workplace administrators cannot view, export, or access raw biometric templates.

4. **Explicit Consent & Regulatory Compliance**
   - Biometric enrollment enforces mandatory employee consent with timestamping and version tracking (`v1.0`).
   - Employees are informed of the sole purpose: attendance validation and fraud prevention.

---

## 3. Computer Vision & Machine Learning Pipeline

The face verification microservice runs as part of the Python service (Port 5001) utilizing OpenCV and NumPy:

```
[Camera Video Stream]
         │
         ▼
[Image Quality Pre-Check]
   ├── Brightness Range (30 - 240 luminance)
   ├── Contrast (StdDev > 12)
   └── Sharpness (Laplacian Variance > 15.0)
         │
         ▼
[Face Detection & Framing]
   ├── Primary: OpenCV YuNet Deep Neural Face Detector (ONNX)
   └── Candidate Count: Must equal exactly 1 (0 or >1 rejected)
         │
         ▼
[Liveness & Anti-Spoofing Assessment]
   ├── High-frequency texture energy analysis
   └── Color saturation distribution check
         │
         ▼
[128-D Biometric Embedding Extraction]
   ├── Primary: OpenCV SFace Deep Face Recognizer (ONNX)
   ├── Secondary: Multi-Scale Spatial Gradient Descriptor (128-d)
   └── L2 Normalization: ||v|| = 1.0
         │
         ▼
[Empirical Biometric Verification Match]
   ├── Cosine Similarity: cos(θ) = (u · v) / (||u|| * ||v||)  [Threshold: ≥ 0.70]
   └── Euclidean Distance: ||u - v||                          [Threshold: ≤ 0.75]
         │
         ▼
[Short-Lived One-Time Token Issuance (VREF_...)]
```

---

## 4. API Specification

### Biometric Face Endpoints (`/api/face`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/face/status` | Authenticated Employee | Returns whether employee has an active enrolled biometric profile. |
| `POST` | `/api/face/enroll` | Authenticated Employee | Enrolls face embedding with explicit consent verification. |
| `POST` | `/api/face/verify` | Authenticated Employee | Verifies face capture against enrolled template; returns `verificationReference`. |
| `POST` | `/api/face/re-enroll` | Authenticated Employee | Updates biometric template; requires current password confirmation. |
| `DELETE` | `/api/face/enrollment` | Authenticated Employee | Revokes and permanently deletes biometric template; requires password confirmation. |

### Attendance Gating Endpoints (`/api/attendance`)

| Method | Endpoint | Requirement |
|---|---|---|
| `POST` | `/api/attendance/check-in` | Valid `deviceId` + Within Geofence Radius (50m) + **Valid `verificationReference`** |
| `POST` | `/api/attendance/check-out` | Valid `deviceId` + **Valid `verificationReference`** |

---

## 5. Automated Verification Results

All automated test suites pass cleanly:

1. **`backend/tests/face-attendance-tests.js`** (22/22 Tests Passed):
   - Status retrieval and pre-seeded biometric enrollment check.
   - Rejection of check-in without biometric token (HTTP 403, `requiresFaceVerification: true`).
   - Rejection of enrollment without explicit consent (HTTP 400).
   - Biometric enrollment with real face image and consent (HTTP 200).
   - Impostor / buddy-punching face rejection (HTTP 401, `verified: false`).
   - Genuine face match producing short-lived `verificationReference` (HTTP 200).
   - Check-in with valid verification reference (HTTP 201, `faceVerified: true`).
   - Anti-replay prevention: reusing consumed reference rejected (HTTP 403).
   - Check-out with genuine face verification (HTTP 200, `faceVerified: true`).
   - Password requirement for re-enrollment security.

2. **`backend/tests/multi-tenant-tests.js`** (36/36 Tests Passed):
   - SuperAdmin, Workplace Admin, and Employee tenant isolation.
   - Public workplace registration and approval workflows.
   - Device binding and geofence boundary checks.

3. **`backend/tests/run-tests.js`** (15/15 Tests Passed):
   - Haversine distance and geofence logic.
   - Device binding OTP generation and validation.
   - Isolation Forest ML anomaly feature extraction.
   - Leave deduction business logic.

**Total passing test assertions: 73 / 73 (100% Passed).**
