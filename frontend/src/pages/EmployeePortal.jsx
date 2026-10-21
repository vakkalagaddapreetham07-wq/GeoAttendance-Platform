import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import InteractiveMap from '../components/InteractiveMap';
import CameraCaptureModal from '../components/CameraCaptureModal';
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Navigation,
  Smartphone,
  ShieldCheck,
  History,
  Compass,
  Radio,
  Camera,
  UserCheck,
  X
} from 'lucide-react';

export default function EmployeePortal({ onGoToWorkplaces }) {
  const { user } = useAuth();
  const [statusData, setStatusData] = useState(null);
  const [history, setHistory] = useState([]);
  const [faceStatus, setFaceStatus] = useState(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraModalMode, setCameraModalMode] = useState('verify'); // 'verify' or 'enroll'
  const [pendingAction, setPendingAction] = useState(null); // 'checkIn' | 'checkOut' | null
  const [cameraLoading, setCameraLoading] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [reEnrollPassword, setReEnrollPassword] = useState('');
  const [showReEnrollModal, setShowReEnrollModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Default Office Location: Bangalore HQ
  const defaultOfficeLat = 12.9715987;
  const defaultOfficeLon = 77.5945627;

  // Real GPS state
  const [currentCoords, setCurrentCoords] = useState({
    latitude: defaultOfficeLat,
    longitude: defaultOfficeLon,
    accuracy: 10
  });

  const [locationSource, setLocationSource] = useState('detecting'); // 'real_gps' or 'simulated'
  const [isWatchingGps, setIsWatchingGps] = useState(false);
  const watchIdRef = useRef(null);

  const deviceId = user?.boundDeviceId || localStorage.getItem('simulated_device_id') || `DEVICE_${user?.employeeId}`;

  const fetchFaceStatus = async () => {
    try {
      const res = await api.getFaceStatus();
      setFaceStatus(res);
    } catch (err) {
      console.warn('Face status error:', err.message);
    }
  };

  // Fetch initial status and history
  const fetchStatusAndHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const [statusRes, historyRes] = await Promise.all([
        api.getAttendanceStatus(),
        api.getAttendanceHistory({ limit: 10 })
      ]);
      setStatusData(statusRes);
      setHistory(historyRes.records || []);
    } catch (err) {
      setError(err.message || 'Failed to load attendance state.');
    } finally {
      setLoading(false);
    }
  };

  // Acquire real device GPS
  const acquireRealGps = () => {
    if (!navigator.geolocation) {
      setError('Browser Geolocation is not supported by your browser.');
      setLocationSource('simulated');
      return;
    }

    setNotice('Acquiring high-accuracy real GPS fix from your device...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(7));
        const lon = Number(pos.coords.longitude.toFixed(7));
        const acc = Math.round(pos.coords.accuracy);

        setCurrentCoords({
          latitude: lat,
          longitude: lon,
          accuracy: acc
        });
        setLocationSource('real_gps');
        setNotice(`Acquired Real GPS Position: [${lat}, ${lon}] (Accuracy: ±${acc}m). Distance updated.`);
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setError(`Could not acquire GPS: ${err.message}. Please allow location access in your browser settings.`);
        setLocationSource('simulated');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Toggle Continuous GPS Tracking
  const toggleGpsWatch = () => {
    if (isWatchingGps) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsWatchingGps(false);
      setNotice('Real-time GPS tracking paused.');
    } else {
      if (!navigator.geolocation) {
        setError('Geolocation not supported.');
        return;
      }
      setIsWatchingGps(true);
      setNotice('Live GPS tracking started. Coordinates update automatically as you move.');

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(7));
          const lon = Number(pos.coords.longitude.toFixed(7));
          const acc = Math.round(pos.coords.accuracy);

          setCurrentCoords({
            latitude: lat,
            longitude: lon,
            accuracy: acc
          });
          setLocationSource('real_gps');
        },
        (err) => {
          setError(`Live tracking error: ${err.message}`);
          setIsWatchingGps(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
      );
    }
  };

  // Automatically request real GPS fix on component mount
  useEffect(() => {
    fetchStatusAndHistory();
    fetchFaceStatus();
    acquireRealGps();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Calculate Haversine distance in browser
  const calculateLiveDistance = () => {
    const lat1 = currentCoords.latitude;
    const lon1 = currentCoords.longitude;
    const lat2 = statusData?.geofence?.center?.latitude || defaultOfficeLat;
    const lon2 = statusData?.geofence?.center?.longitude || defaultOfficeLon;

    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  const currentDistance = calculateLiveDistance();
  const geofenceRadius = statusData?.geofence?.radius || 50;
  const isInside = currentDistance <= geofenceRadius;
  const isCheckedIn = statusData?.isCheckedIn;

  const officeLat = statusData?.geofence?.center?.latitude || defaultOfficeLat;
  const officeLon = statusData?.geofence?.center?.longitude || defaultOfficeLon;

  // Trigger Check-In: opens face scan
  const handleCheckInClick = () => {
    if (!faceStatus?.isEnrolled) {
      setCameraModalMode('enroll');
      setShowConsentModal(true);
      return;
    }
    setPendingAction('checkIn');
    setCameraModalMode('verify');
    setIsCameraModalOpen(true);
  };

  // Trigger Check-Out: opens face scan
  const handleCheckOutClick = () => {
    if (!faceStatus?.isEnrolled) {
      setCameraModalMode('enroll');
      setShowConsentModal(true);
      return;
    }
    setPendingAction('checkOut');
    setCameraModalMode('verify');
    setIsCameraModalOpen(true);
  };

  // Handle capture from CameraCaptureModal
  const handleCameraCapture = async (imageData) => {
    setCameraLoading(true);
    setError('');
    setNotice('');

    try {
      if (cameraModalMode === 'enroll') {
        await api.enrollFace(
          imageData,
          true,
          'I consent to biometric face verification solely for work attendance identity validation and fraud prevention.'
        );
        setNotice('Face biometric profile successfully registered and encrypted! You may now record attendance.');
        setIsCameraModalOpen(false);
        setShowConsentModal(false);
        await fetchFaceStatus();
      } else if (cameraModalMode === 'verify') {
        // Step 1: Verify face against enrolled biometric template
        const verifyRes = await api.verifyFace(imageData);
        if (!verifyRes.verified || !verifyRes.verificationReference) {
          throw new Error(verifyRes.error || 'Biometric verification failed. Face does not match registered employee.');
        }

        const matchPercent = (verifyRes.similarityScore * 100).toFixed(1);
        const token = verifyRes.verificationReference;

        // Step 2: Submit attendance record using one-time token
        if (pendingAction === 'checkIn') {
          const checkInRes = await api.checkIn(
            deviceId,
            currentCoords.latitude,
            currentCoords.longitude,
            currentCoords.accuracy,
            token
          );
          setNotice(`Biometric Verified (${matchPercent}% match). ${checkInRes.message}`);
        } else if (pendingAction === 'checkOut') {
          const checkOutRes = await api.checkOut(
            deviceId,
            currentCoords.latitude,
            currentCoords.longitude,
            currentCoords.accuracy,
            token
          );
          setNotice(`Biometric Verified (${matchPercent}% match). ${checkOutRes.message}`);
        }

        setIsCameraModalOpen(false);
        setPendingAction(null);
        await fetchStatusAndHistory();
      }
    } catch (err) {
      setError(err.message || 'Face verification failed.');
    } finally {
      setCameraLoading(false);
    }
  };

  return (
    <div>
      {/* Real GPS Status Banner */}
      <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Navigation size={18} color="#2563eb" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.85rem' }}>
            <strong>GPS Location Source: </strong>
            <span style={{ fontWeight: 700, color: locationSource === 'real_gps' ? '#10b981' : '#f59e0b' }}>
              {locationSource === 'real_gps' ? '🟢 Live Hardware Device GPS' : '🟡 Simulated Coordinates'}
            </span>
            {' '}| Accuracy: ±{currentCoords.accuracy}m
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={acquireRealGps}
            title="Refresh GPS from device"
          >
            <Compass size={14} />
            <span>Update Real GPS</span>
          </button>
          <button
            className={`btn btn-sm ${isWatchingGps ? 'btn-danger' : 'btn-primary'}`}
            onClick={toggleGpsWatch}
          >
            <Radio size={14} />
            <span>{isWatchingGps ? 'Stop Live Track' : 'Continuous Tracking'}</span>
          </button>
        </div>
      </div>

      {/* Workplace Affiliation Banner */}
      {statusData?.workplace ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🏢</span>
            <div>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{statusData.workplace.name}</span>
              <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.5rem' }}>
                ({statusData.workplace.city || 'Office'}) • ID: <code style={{ color: '#2563eb' }}>{statusData.workplace.workplaceId}</code>
              </span>
            </div>
          </div>
          {onGoToWorkplaces && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
              onClick={onGoToWorkplaces}
            >
              Workplace Details
            </button>
          )}
        </div>
      ) : statusData && statusData.membershipStatus !== 'approved' ? (
        <div className="alert alert-warning" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <div>
            <strong>Workplace Enrollment Required: </strong>
            <span>You do not have an active approved workplace membership. Geofence attendance cannot be recorded until you are approved.</span>
          </div>
          {onGoToWorkplaces && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onGoToWorkplaces}
            >
              Select / Join Workplace
            </button>
          )}
        </div>
      ) : null}

      {error && (
        <div className="alert alert-danger">
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{notice}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* Left Column: Interactive Map & 50m Geofence Perimeter */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <MapPin size={18} color="#2563eb" />
              <span>Interactive Geofence Map ({geofenceRadius}m Radius)</span>
            </span>
            <span className={`badge ${isInside ? 'badge-success' : 'badge-danger'}`}>
              {isInside ? `Inside ${geofenceRadius}m Perimeter` : 'Outside Geofence'}
            </span>
          </div>

          {/* Interactive Map Visualizer */}
          <div style={{ marginBottom: '1rem' }}>
            <InteractiveMap
              centerLat={officeLat}
              centerLon={officeLon}
              userLat={currentCoords.latitude}
              userLon={currentCoords.longitude}
              userAccuracy={currentCoords.accuracy}
              radius={geofenceRadius}
              editable={false}
              height="300px"
            />
          </div>

          {/* Real-time Telemetry Readout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>DISTANCE TO WORKPLACE</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: isInside ? '#10b981' : '#ef4444' }}>
                {currentDistance} m
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Allowed Radius: <strong>{geofenceRadius} metres</strong>
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>GEOFENCE PERIMETER</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>
                {Number(geofenceRadius).toFixed(1)} m
              </div>
              <div style={{ fontSize: '0.72rem', color: isInside ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {isInside ? '✓ PERMITTED' : '✗ LOCKED (OUTSIDE)'}
              </div>
            </div>
          </div>

          {/* Action Check-In / Check-Out Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {!isCheckedIn ? (
              <button
                className="btn btn-success"
                style={{ flex: 1, padding: '0.85rem' }}
                disabled={!isInside || actionLoading}
                onClick={handleCheckInClick}
              >
                <Camera size={18} />
                <span>{actionLoading ? 'Processing...' : 'Face Scan & Check-In'}</span>
              </button>
            ) : (
              <button
                className="btn btn-danger"
                style={{ flex: 1, padding: '0.85rem' }}
                disabled={actionLoading}
                onClick={handleCheckOutClick}
              >
                <Camera size={18} />
                <span>{actionLoading ? 'Processing...' : 'Face Scan & Check-Out'}</span>
              </button>
            )}

            <button
              className="btn btn-secondary"
              onClick={fetchStatusAndHistory}
              title="Refresh Telemetry"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {!isInside && !isCheckedIn && (
            <p style={{ fontSize: '0.78rem', color: '#b91c1c', textAlign: 'center', marginTop: '0.6rem', background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #fecaca' }}>
              🔒 <strong>Check-In Locked (Outside Geofence):</strong> You are {currentDistance}m away (Limit: {geofenceRadius}m). Move within the workplace perimeter and tap <strong>"Update Real GPS"</strong>.
            </p>
          )}
        </div>

        {/* Right Column: Attendance Status & Device Hardware */}
        <div>
          {/* Active Session Status Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Clock size={18} color="#10b981" />
                <span>Today's Attendance Status</span>
              </span>
              <span className={`badge ${isCheckedIn ? 'badge-success' : 'badge-neutral'}`}>
                {isCheckedIn ? 'Checked In' : 'Not Checked In'}
              </span>
            </div>

            {isCheckedIn && statusData?.activeSession ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Check-In Time</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                      {new Date(statusData.activeSession.checkIn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Check-In Distance</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                      {statusData.activeSession.checkIn.distanceToCenter} m
                    </div>
                  </div>
                </div>
                <div className="alert alert-success" style={{ margin: 0, fontSize: '0.8rem' }}>
                  ✓ Continuous attendance session active. Under native Android operation, exiting the 50m geofence automatically records exit.
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#64748b', fontSize: '0.88rem' }}>
                No active attendance session recorded for today. Move inside the 50m circle on the map to check in.
              </div>
            )}
          </div>

          {/* Bound Hardware Device Information */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Smartphone size={18} color="#64748b" />
                <span>Registered Device Hardware</span>
              </span>
              <span className="badge badge-success">Single Device Bound</span>
            </div>

            <div style={{ fontSize: '0.84rem', color: '#334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Hardware Identifier:</span>
                <code>{deviceId}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Designated Workplace:</span>
                <strong>{statusData?.geofence?.locationName || 'Main Office Site'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Workplace Coordinates:</span>
                <code>[{officeLat.toFixed(5)}, {officeLon.toFixed(5)}]</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Anti-Buddy-Punching:</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>Active (1 Registered Device Limit)</span>
              </div>
            </div>
          </div>

          {/* Biometric Face Identity Status Card */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-header">
              <span className="card-title">
                <UserCheck size={18} color="#10b981" />
                <span>Biometric Face Security</span>
              </span>
              <span className={`badge ${faceStatus?.isEnrolled ? 'badge-success' : 'badge-warning'}`}>
                {faceStatus?.isEnrolled ? '✓ Face Enrolled' : 'Not Registered'}
              </span>
            </div>

            <div style={{ fontSize: '0.84rem', color: '#334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Biometric Protection:</span>
                <span style={{ fontWeight: 600, color: faceStatus?.isEnrolled ? '#10b981' : '#f59e0b' }}>
                  {faceStatus?.isEnrolled ? 'Active (AES-256-GCM Encrypted)' : 'Enrollment Required'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: '#64748b' }}>Recognition Model:</span>
                <code>{faceStatus?.modelName || 'OpenCV YuNet + SFace (128-d)'}</code>
              </div>
              {faceStatus?.isEnrolled && faceStatus?.enrolledAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <span style={{ color: '#64748b' }}>Enrolled On:</span>
                  <span>{new Date(faceStatus.enrolledAt).toLocaleDateString()}</span>
                </div>
              )}

              <div style={{ marginTop: '0.8rem' }}>
                {!faceStatus?.isEnrolled ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm w-100"
                    onClick={() => {
                      setCameraModalMode('enroll');
                      setShowConsentModal(true);
                    }}
                  >
                    <Camera size={14} className="me-1" /> Register Your Face Now
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm w-100"
                    onClick={() => {
                      setCameraModalMode('enroll');
                      setShowConsentModal(true);
                    }}
                  >
                    <Camera size={14} className="me-1" /> Update / Re-enroll Face
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">
            <History size={18} color="#2563eb" />
            <span>Attendance History Log</span>
          </span>
          <span className="badge badge-neutral">{history.length} Sessions</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Biometric Face</th>
                <th>Recorded Duration</th>
                <th>Session Status</th>
                <th>Anomaly Status</th>
                <th>Detection Source</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No recorded attendance sessions yet.
                  </td>
                </tr>
              ) : (
                history.map((rec) => (
                  <tr key={rec._id}>
                    <td><strong>{rec.attendanceDate}</strong></td>
                    <td>{rec.checkIn?.timestamp ? new Date(rec.checkIn.timestamp).toLocaleTimeString() : 'N/A'}</td>
                    <td>{rec.checkOut?.timestamp ? new Date(rec.checkOut.timestamp).toLocaleTimeString() : 'In Progress'}</td>
                    <td>
                      {rec.faceVerification?.checkInVerified ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>👤✓</span> Verified {rec.faceVerification?.similarityScore ? `(${(rec.faceVerification.similarityScore * 100).toFixed(0)}%)` : ''}
                        </span>
                      ) : (
                        <span className="badge badge-neutral">Standard</span>
                      )}
                    </td>
                    <td>{rec.durationMinutes ? `${rec.durationMinutes} mins (${(rec.durationMinutes / 60).toFixed(1)} hrs)` : '-'}</td>
                    <td>
                      <span className={`badge ${rec.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                        {rec.status}
                      </span>
                    </td>
                    <td>
                      {rec.anomaly?.isAnomaly ? (
                        <span className="badge badge-danger">
                          Anomaly Flagged
                        </span>
                      ) : (
                        <span className="badge badge-success">
                          Normal
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        {rec.anomaly?.detectionSource || 'none'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explicit Biometric Consent Modal */}
      {/* Explicit Biometric Consent Modal */}
      {showConsentModal && (
        <div className="modal-overlay" style={{ zIndex: 1150 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '520px',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={20} color="#2563eb" />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Biometric Consent Notice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, marginBottom: '1rem' }}>
              In compliance with privacy standards, this system records an encrypted mathematical facial vector to prevent proxy check-ins and buddy-punching.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
                Privacy & Cryptographic Safeguards:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>
                <li>Raw photographs are <strong>never stored unencrypted</strong> or shared with third parties.</li>
                <li>Biometric templates are encrypted with authenticated <strong>AES-256-GCM</strong>.</li>
                <li>Biometrics are used solely for attendance validation within your registered workplace.</li>
              </ul>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '1.5rem',
                padding: '0.6rem 0.75rem',
                background: '#eff6ff',
                borderRadius: '8px',
                border: '1px solid #bfdbfe',
                cursor: 'pointer'
              }}
              onClick={() => setConsentChecked(!consentChecked)}
            >
              <input
                type="checkbox"
                id="consentCheck"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="consentCheck" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e40af', cursor: 'pointer', margin: 0 }}>
                I give explicit consent to biometric facial verification for work attendance logging.
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowConsentModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!consentChecked}
                onClick={() => {
                  setShowConsentModal(false);
                  setIsCameraModalOpen(true);
                }}
                style={{ fontWeight: 700, padding: '0.6rem 1.25rem' }}
              >
                Proceed to Camera Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Camera Capture & Verification Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => {
          setIsCameraModalOpen(false);
          setPendingAction(null);
        }}
        onCapture={handleCameraCapture}
        title={cameraModalMode === 'enroll' ? 'Biometric Face Enrollment' : 'Biometric Attendance Verification'}
        subtitle={cameraModalMode === 'enroll' ? 'Position your face inside the oval frame to record your baseline profile.' : 'Look directly at camera to verify your identity for attendance.'}
        mode={cameraModalMode}
        isLoading={cameraLoading}
      />
    </div>
  );
}
