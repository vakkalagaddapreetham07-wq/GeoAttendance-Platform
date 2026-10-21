# System Architecture & Academic UML Design Specifications
## Geofence-Based Attendance Management System with ML Anomaly Detection

---

## 1. System Architecture Diagram

```mermaid
graph TD
    subgraph ClientLayer ["1. Client Application Layer"]
        A1["Android Native Mobile App<br/>(Play Services Geofencing)"]
        A2["HR Admin Web Dashboard<br/>(React.js + Vite)"]
        A3["Employee Web Portal<br/>(PWA / Geolocation Demo)"]
    end

    subgraph ApiGateway ["2. Backend Services & Security Layer"]
        B1["Express.js REST API Server<br/>(Port 5000)"]
        B2["JWT Auth & Role-Based Guard"]
        B3["Single-Device Binding & OTP Service"]
        B4["Haversine Geofence Validator (50m)"]
        B5["Hard-Rule Deterministic Engine"]
    end

    subgraph MlService ["3. Machine Learning Microservice"]
        C1["Flask Python ML Service<br/>(Port 5001)"]
        C2["Isolation Forest Engine<br/>(Contamination = 0.10)"]
        C3["4-Feature Feature Extractor"]
        C4["Synthetic Dataset Generator"]
    end

    subgraph DataLayer ["4. Persistence & Storage Layer"]
        D1["MongoDB Database<br/>(Local / Atlas Cluster)"]
        D2[("Users & Devices")]
        D3[("Attendance Records")]
        D4[("Geofences (50m)")]
        D5[("Leave Requests & Balances")]
        D6[("Audit Logs & Shift Schedules")]
    end

    A1 -->|HTTPS / REST API| B1
    A2 -->|HTTPS / REST API| B1
    A3 -->|HTTPS / REST API| B1

    B1 --> B2
    B1 --> B3
    B1 --> B4
    B1 --> B5

    B1 -->|POST /assess (4 Features)| C1
    C1 --> C2
    C2 --> C3

    B1 --> D1
    D1 --> D2
    D1 --> D3
    D1 --> D4
    D1 --> D5
    D1 --> D6
```

---

## 2. Data Flow Diagram (DFD Level 1)

```mermaid
flowchart TD
    E[Employee Device] -->|1. GPS Coordinates & Device ID| P1[Process 1.0: Geofence Validation]
    P1 -->|Query Coordinates & Radius| DB1[(Geofence Store)]
    DB1 -->|Center Lat/Lon, 50m Radius| P1
    
    P1 -->|2. Validated Inside 50m| P2[Process 2.0: Attendance Processing]
    P2 -->|Record Check-In/Exit| DB2[(Attendance Store)]
    
    P2 -->|3. On Exit: Duration & Deviations| P3[Process 3.0: 4-Feature Extraction]
    P3 -->|Vector: [InDev, OutDev, Dur, Dist]| P4[Process 4.0: ML Anomaly Assessment]
    
    P4 -->|Inference Query| ML[(Isolation Forest Model)]
    ML -->|Anomaly Score & Prediction| P4
    
    P3 -->|Duration & Distance| P5[Process 5.0: Hard-Rule Fallback]
    P5 -->|Violations (e.g. Dur < 30m)| P6[Process 6.0: Results Arbiter]
    P4 -->|ML Output| P6
    
    P6 -->|Combined Anomaly Flag & Source| DB2
    DB2 -->|Telemetry & Metrics| P7[Process 7.0: Analytics Aggregator]
    P7 -->|Summary & Anomaly Queues| A[HR Administrator]
```

---

## 3. Use-Case Diagram

```mermaid
flowchart LR
    subgraph EmployeeUseCases ["Employee Use Cases"]
        UC1(["Secure Login"])
        UC2(["Request OTP for Device"])
        UC3(["Verify OTP & Bind Phone"])
        UC4(["View Geofence Proximity"])
        UC5(["Record Geofence Check-In"])
        UC6(["Automatic Geofence Exit"])
        UC7(["View Attendance History"])
        UC8(["Submit Leave Application"])
        UC9(["View Leave Balance"])
    end

    subgraph AdminUseCases ["HR Administrator Use Cases"]
        UC10(["Admin Secure Login"])
        UC11(["View Analytics Dashboard"])
        UC12(["Manage Employee Geofences (50m)"])
        UC13(["Configure Company Shift"])
        UC14(["Review Flagged Anomalies"])
        UC15(["Adjudicate Leave Requests"])
        UC16(["Audit System Actions"])
    end

    Emp((Employee)) --> UC1
    Emp --> UC2
    Emp --> UC3
    Emp --> UC4
    Emp --> UC5
    Emp --> UC6
    Emp --> UC7
    Emp --> UC8
    Emp --> UC9

    Admin((HR Admin)) --> UC10
    Admin --> UC11
    Admin --> UC12
    Admin --> UC13
    Admin --> UC14
    Admin --> UC15
    Admin --> UC16
```

---

## 4. Domain UML Class Diagram

```mermaid
classDiagram
    class User {
        +String employeeId
        +String name
        +String email
        +String passwordHash
        +String role
        +String department
        +Object leaveBalance
        +String accountStatus
        +Boolean verifyPassword(pwd)
    }

    class Device {
        +String employeeId
        +String deviceId
        +String deviceModel
        +String osVersion
        +Boolean isBound
        +Date registeredAt
        +Date lastSeenAt
        +Date revokedAt
        +void invalidate()
    }

    class OtpRecord {
        +String employeeId
        +String deviceId
        +String hashedOtp
        +Date expiresAt
        +Number attemptCount
        +Boolean isConsumed
        +Boolean isValid()
    }

    class Geofence {
        +String employeeId
        +Object center
        +Number radius
        +String locationName
        +String configuredBy
        +Boolean isInside(lat, lon)
    }

    class ShiftSchedule {
        +String name
        +String shiftStart
        +String shiftEnd
        +String timezone
        +Number gracePeriodMinutes
        +Boolean isCompanyWide
    }

    class AttendanceRecord {
        +String employeeId
        +String deviceId
        +String attendanceDate
        +Object checkIn
        +Object checkOut
        +Number durationMinutes
        +String status
        +Object anomaly
        +Array auditLog
        +void completeSession(outTime, lat, lon)
    }

    class LeaveRequest {
        +String employeeId
        +String leaveType
        +Date startDate
        +Date endDate
        +Number daysCount
        +String reason
        +String status
        +String reviewedBy
        +Date decisionTimestamp
        +void approve(adminId)
        +void reject(adminId, note)
    }

    User "1" -- "1" Device : binds
    User "1" -- "0..*" OtpRecord : requests
    User "1" -- "1" Geofence : assigned
    User "1" -- "0..*" AttendanceRecord : owns
    User "1" -- "0..*" LeaveRequest : submits
    AttendanceRecord "0..*" -- "1" ShiftSchedule : evaluated against
```

---

## 5. Database ER-Style Schema

```mermaid
erDiagram
    USERS ||--o| DEVICES : "has active binding"
    USERS ||--o{ OTP_RECORDS : "generates"
    USERS ||--|| GEOFENCES : "has assigned perimeter"
    USERS ||--o{ ATTENDANCE_RECORDS : "records"
    USERS ||--o{ LEAVE_REQUESTS : "submits"
    USERS ||--o{ AUDIT_LOGS : "triggers/reviews"

    USERS {
        string employeeId PK
        string email UK
        string name
        string role
        string department
        object leaveBalance
        string accountStatus
    }

    DEVICES {
        string deviceId PK
        string employeeId FK
        string deviceModel
        boolean isBound
        datetime registeredAt
        datetime revokedAt
    }

    GEOFENCES {
        string employeeId PK, FK
        double centerLatitude
        double centerLongitude
        double radius "Fixed 50m"
        string locationName
    }

    ATTENDANCE_RECORDS {
        objectId _id PK
        string employeeId FK
        string deviceId FK
        string attendanceDate
        datetime checkInTimestamp
        datetime checkOutTimestamp
        double durationMinutes
        string status
        boolean isAnomaly
        string detectionSource
        double anomalyScore
    }

    LEAVE_REQUESTS {
        objectId _id PK
        string employeeId FK
        string leaveType
        date startDate
        date endDate
        int daysCount
        string status
        string reviewedBy
    }
```

---

## 6. Sequence Diagrams

### 6.1 Authentication & Device Binding Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Employee as Employee Mobile App
    participant API as Express API Server
    participant DB as MongoDB Database
    participant OTP as OTP Service Adapter

    Employee->>API: POST /api/auth/request-otp (employeeId, password, deviceId)
    API->>DB: Find User & Validate Password
    DB-->>API: User Credentials Valid
    API->>OTP: Generate Cryptographic 6-Digit OTP
    OTP->>DB: Store Hashed OTP (5 min expiry, max 3 attempts)
    OTP-->>Employee: Dispatch via SMS / Dev Adapter
    
    Employee->>API: POST /api/auth/verify-otp-device (employeeId, deviceId, otp)
    API->>DB: Fetch Active OTP & Verify Hash
    API->>DB: Invalidate Any Previously Bound Device (Single-Device Rule)
    API->>DB: Insert / Update Active Device Binding (isBound = true)
    API->>DB: Write Audit Log (DEVICE_BOUND)
    API-->>Employee: 200 OK: Device Bound Successfully
```

### 6.2 Check-In and Automatic Checkout Sequence
```mermaid
sequenceDiagram
    autonumber
    actor OS as Android Geofencing API
    participant App as Android Client App
    participant API as Express API Server
    participant DB as MongoDB Database
    participant ML as Python ML Service

    Note over OS,App: Employee walks within 50m of office
    OS->>App: GEOFENCE_TRANSITION_ENTER Callback
    App->>API: POST /api/attendance/check-in (deviceId, lat, lon, accuracy)
    API->>DB: Verify Single-Device Binding
    API->>DB: Verify Coordinates within 50m of Assigned Geofence
    API->>DB: Prevent Duplicate Open Session
    API->>DB: Save AttendanceRecord (status: checked_in)
    API-->>App: 201 Created: Check-In Recorded

    Note over OS,App: Employee leaves 50m perimeter at shift end
    OS->>App: GEOFENCE_TRANSITION_EXIT Callback
    App->>API: POST /api/attendance/check-out (deviceId, lat, lon, accuracy)
    API->>DB: Find Open Session
    API->>API: Calculate Duration = CheckOut - CheckIn (mins)
    API->>API: Compute 4-Feature Vector & Evaluate Hard Rules
    API->>ML: POST /assess ([InDev, OutDev, Duration, Distance])
    ML-->>API: { is_anomaly, anomaly_score, prediction }
    API->>API: Arbitrate Detection Source (ml_only, hard_rule_only, both, none)
    API->>DB: Update Session (status: completed, duration, anomaly flags)
    API-->>App: 200 OK: Automatic Check-Out Recorded
```

### 6.3 Machine Learning Anomaly Detection Sequence
```mermaid
sequenceDiagram
    autonumber
    participant Backend as Backend Attendance Service
    participant Rules as Hard-Rule Engine
    participant ML as Flask ML Service (Port 5001)
    participant Model as Trained Isolation Forest
    participant DB as MongoDB Attendance Record

    Backend->>Backend: Extract 4 Features: [CheckInDev, CheckOutDev, Duration, Distance]
    
    par Hard Rule Check
        Backend->>Rules: Evaluate Deterministic Rules
        Note over Rules: 1. Duration < 30 mins?<br/>2. Distance > 50m?<br/>3. CheckInDev > 240m?
        Rules-->>Backend: { isHardRuleViolation, violationsList }
    and ML Inference Check
        Backend->>ML: POST /assess { features: [...] }
        ML->>Model: Compute Path Lengths E(h(x)) & Anomaly Score
        Model-->>ML: s(x, n) = 2^(-E(h(x))/c(n))
        ML-->>Backend: { is_anomaly, anomaly_score, prediction }
    end

    Backend->>Backend: Arbitrate Detection Source:
    Note over Backend: - Both ML and Hard Rule triggered -> 'both'<br/>- ML only -> 'ml_only'<br/>- Hard Rule only -> 'hard_rule_only'<br/>- None -> 'none'
    
    Backend->>DB: Store Assessment in attendance record
```
