# Local Installation & Production Deployment Guide
## Geofence-Based Attendance Management System

---

## 1. System Prerequisites

- **Node.js**: Version 18.x or 20.x or higher (tested on Node v24.18.0)
- **Python**: Version 3.10, 3.11, 3.12, 3.13, or 3.14 (Flask 3.x, scikit-learn compatible)
- **MongoDB**: Local MongoDB community server (port 27017) OR free MongoDB Atlas cluster connection string. *(Automatic in-memory fallback is included for zero-setup demo).*
- **Android Studio** (Optional for native mobile build): Android SDK 34 (UpsideDownCake) / Minimum SDK 26.

---

## 2. Local Development Setup (Windows / macOS / Linux)

### Step 1: Start the Python ML Service
In a new terminal window:
```powershell
cd ml-service
python -m pip install -r requirements.txt
python training/train_model.py
python app/app.py
```
*The ML Service starts on `http://localhost:5001`.*

### Step 2: Start the Express.js Backend Server
In a second terminal window:
```powershell
cd backend
npm install
npm start
```
*The Backend API Server starts on `http://localhost:5000/api`.*

### Step 3: Start the React Frontend Dashboard
In a third terminal window:
```powershell
cd frontend
npm install
npm run dev
```
*The Frontend Web Application starts on `http://localhost:3000`.*

---

## 3. Automated Test Execution Commands

Run the full end-to-end unit and integration test suites:

### 3.1 Backend & Geofencing Automated Test Suite (15 Tests)
```powershell
node backend/tests/run-tests.js
```
*Tests GPS boundary verification, Haversine formula, OTP limits, device binding, 4-feature extraction, hard-rule thresholds, and leave balances.*

### 3.2 Machine Learning Unit Tests (5 Tests)
```powershell
python ml-service/tests/test_ml_service.py
```

### 3.3 ML Model Evaluation on 2,500 Synthetic Records
```powershell
python ml-service/evaluation/evaluate_model.py
```

---

## 4. Default Seeded Development Credentials

| Role | Employee ID / Identifier | Email | Password | Primary Function |
|---|---|---|---|---|
| **HR Administrator** | `ADMIN001` | `admin@attendance.local` | `Admin@12345` | Analytics, Anomaly Adjudication, Leaves, Geofence |
| **Employee 1** | `EMP001` | `alice@company.local` | `Emp@12345` | Engineering, Punctual attendance profile |
| **Employee 2** | `EMP002` | `bob@company.local` | `Emp@12345` | Product, Active checked-in session |
| **Employee 3** | `EMP003` | `charlie@company.local` | `Emp@12345` | QA, Historical short-stay anomaly records |
| **Employee 4** | `EMP004` | `diana@company.local` | `Emp@12345` | DevOps, Historical extreme delay anomaly |
| **Employee 5** | `EMP005` | `evan@company.local` | `Emp@12345` | Customer Support, Approved annual leave |

---

## 5. Production Cloud Deployment Architecture

### 5.1 Frontend on Vercel
1. Import repository into Vercel.
2. Root Directory: `frontend`
3. Framework Preset: `Vite`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Environment Variables:
   - `VITE_API_BASE_URL`: `https://your-backend.onrender.com/api`

### 5.2 Backend on Render / Railway
1. Create new Web Service connected to your repository.
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `node src/server.js`
5. Environment Variables:
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/geofence_attendance?retryWrites=true&w=majority
   JWT_SECRET=<STRONG_CRYPTOGRAPHIC_JWT_SECRET_KEY>
   ML_SERVICE_URL=https://your-ml-service.onrender.com
   DEFAULT_GEOFENCE_RADIUS=50
   ```

### 5.3 Python ML Service on Render / Railway
1. Create new Python Web Service from `ml-service` directory.
2. Build Command: `pip install -r requirements.txt && python training/train_model.py`
3. Start Command: `python app/app.py` or `gunicorn app.app:app -b 0.0.0.0:$PORT`
4. Set Port: `5001`

### 5.4 Database on MongoDB Atlas
1. Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create database user and allow network access (`0.0.0.0/0` with secure password).
3. Copy the standard connection string into `MONGODB_URI`.
