import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import InteractiveMap from '../components/InteractiveMap';
import {
  MapPin,
  Clock,
  Save,
  CheckCircle2,
  AlertCircle,
  Crosshair,
  Sliders,
  Maximize2
} from 'lucide-react';

// Haversine formula for distance in metres
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export default function GeofenceSettings() {
  // Shift Schedule State
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');
  const [gracePeriod, setGracePeriod] = useState(15);
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  // Geofence Configuration State
  const [targetEmployeeId, setTargetEmployeeId] = useState('ALL');
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [latitude, setLatitude] = useState('12.9715987');
  const [longitude, setLongitude] = useState('77.5945627');
  const [radius, setRadius] = useState(50); // Default 50m, admin can change
  const [locationName, setLocationName] = useState('Bangalore HQ Office Site');

  // Admin Live GPS Location State
  const [adminLat, setAdminLat] = useState(null);
  const [adminLon, setAdminLon] = useState(null);
  const [adminAccuracy, setAdminAccuracy] = useState(null);
  const [locatingAdmin, setLocatingAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingShift, setSavingShift] = useState(false);
  const [savingGeofence, setSavingGeofence] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Fetch workplace employees dynamically
  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const res = await api.getWorkplaceMembers({ limit: 100 });
      if (res.success && Array.isArray(res.members)) {
        setEmployees(res.members);
      }
    } catch (err) {
      console.warn('Failed to load workplace members for geofence selection:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  // Track Admin's device GPS for live preview
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setAdminLat(pos.coords.latitude);
          setAdminLon(pos.coords.longitude);
          setAdminAccuracy(pos.coords.accuracy);
        },
        () => {
          // Silent fallback if permission not yet granted
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const scheduleRes = await api.getShiftSchedule();
      if (scheduleRes.schedule) {
        setShiftStart(scheduleRes.schedule.shiftStart);
        setShiftEnd(scheduleRes.schedule.shiftEnd);
        setGracePeriod(scheduleRes.schedule.gracePeriodMinutes ?? 15);
        setTimezone(scheduleRes.schedule.timezone || 'Asia/Kolkata');
      }

      const geofenceRes = await api.getGeofence(targetEmployeeId !== 'ALL' ? targetEmployeeId : null);
      if (geofenceRes.geofence?.center) {
        setLatitude(String(geofenceRes.geofence.center.latitude));
        setLongitude(String(geofenceRes.geofence.center.longitude));
        setLocationName(geofenceRes.geofence.locationName || 'Designated Office Site');
      }
      if (geofenceRes.geofence?.radius) {
        setRadius(Number(geofenceRes.geofence.radius));
      }
    } catch (err) {
      setError(err.message || 'Failed to load configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [targetEmployeeId]);

  // Click handler to set coordinates to Admin's real device GPS
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLocatingAdmin(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        const formattedLat = Number(lat.toFixed(7));
        const formattedLon = Number(lon.toFixed(7));
        setLatitude(String(formattedLat));
        setLongitude(String(formattedLon));
        setAdminLat(formattedLat);
        setAdminLon(formattedLon);
        setAdminAccuracy(accuracy);
        setLocatingAdmin(false);
        setNotice(
          `📍 Workplace center aligned to your physical GPS position (${formattedLat}, ${formattedLon} ±${Math.round(accuracy)}m). Click "Save Geofence Coordinates" to persist.`
        );
      },
      (err) => {
        setLocatingAdmin(false);
        setError(`Unable to acquire real GPS location: ${err.message}. Please allow location access in your browser.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleMapCenterChange = (newLat, newLon, placeName = null) => {
    setLatitude(String(newLat));
    setLongitude(String(newLon));
    if (placeName && (!locationName || locationName === 'Designated Office Site' || locationName === 'Bangalore HQ Office Site')) {
      const shortName = placeName.split(',')[0];
      if (shortName) setLocationName(shortName);
    }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    setSavingShift(true);
    setError('');
    setNotice('');
    try {
      const res = await api.updateShiftSchedule({
        shiftStart,
        shiftEnd,
        gracePeriodMinutes: Number(gracePeriod),
        timezone
      });
      setNotice(res.message);
    } catch (err) {
      setError(err.message || 'Failed to update shift schedule.');
    } finally {
      setSavingShift(false);
    }
  };

  const handleSaveGeofence = async (e) => {
    e.preventDefault();
    setSavingGeofence(true);
    setError('');
    setNotice('');
    try {
      const res = await api.updateGeofence(
        targetEmployeeId,
        Number(latitude),
        Number(longitude),
        locationName,
        Number(radius) || 50
      );
      setNotice(res.message);
    } catch (err) {
      setError(err.message || 'Failed to update employee geofence.');
    } finally {
      setSavingGeofence(false);
    }
  };

  // Distance between admin live GPS and current workplace center
  const adminDistance =
    adminLat !== null && adminLon !== null && latitude && longitude
      ? calculateDistanceMeters(Number(latitude), Number(longitude), adminLat, adminLon)
      : null;

  const currentRadius = Number(radius) || 50;
  const isInsideRadius = adminDistance !== null && adminDistance <= currentRadius;

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
          Geofence & Company Shift Settings
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Configure workplace coordinates, geofence radius, and company shift schedule
        </p>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {/* Geofence Configuration Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <MapPin size={18} color="#2563eb" />
              <span>Interactive Geofence Configuration</span>
            </span>
            <span className="badge badge-info">{currentRadius}m Radius</span>
          </div>

          <form onSubmit={handleSaveGeofence}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Target Employee / Scope</span>
                {loadingEmployees && (
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Refreshing members...</span>
                )}
              </label>
              <select
                className="form-select"
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
                required
              >
                <option value="ALL">🌐 Entire Workplace (All Employees)</option>
                {employees.map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.employeeId} - {emp.name} ({emp.department || 'Operations'}) {emp.email ? `• ${emp.email}` : ''}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem' }}>
                {targetEmployeeId === 'ALL'
                  ? 'Configuring the general workplace geofence radius & center applied to all employees.'
                  : `Configuring custom workplace location specifically for employee ${targetEmployeeId}.`}
              </div>
            </div>

            {/* Quick Action: Set to My Real GPS Location */}
            <div style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locatingAdmin}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.7rem',
                  border: '1px solid #3b82f6',
                  color: '#1d4ed8',
                  background: '#eff6ff',
                  fontWeight: 600
                }}
              >
                <Crosshair size={18} color="#2563eb" />
                <span>{locatingAdmin ? 'Acquiring GPS Signal...' : '📍 Set Workplace to My Current GPS Location'}</span>
              </button>
            </div>

            {/* Enhanced Interactive Leaflet Map */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Workplace Map (High-visibility Leaflet map with search)</span>
                {adminDistance !== null && (
                  <span
                    className={`badge ${isInsideRadius ? 'badge-success' : 'badge-warning'}`}
                    style={{ fontSize: '0.72rem' }}
                  >
                    You are {adminDistance}m away ({isInsideRadius ? `Inside ${currentRadius}m` : `Outside ${currentRadius}m`})
                  </span>
                )}
              </label>

              <InteractiveMap
                centerLat={Number(latitude) || 12.9715987}
                centerLon={Number(longitude) || 77.5945627}
                userLat={adminLat}
                userLon={adminLon}
                userAccuracy={adminAccuracy}
                radius={currentRadius}
                editable={true}
                onCenterChange={handleMapCenterChange}
                height="320px"
              />
            </div>

            {/* Workplace Geofence Radius Configuration */}
            <div className="form-group" style={{ marginBottom: '1.25rem', padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Sliders size={16} color="#2563eb" />
                  <span>Workplace Geofence Radius</span>
                </label>
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: '#1d4ed8',
                    background: '#eff6ff',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    border: '1px solid #bfdbfe'
                  }}
                >
                  {currentRadius} metres
                </span>
              </div>

              {/* Slider & Input Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="5"
                  value={currentRadius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  style={{ flex: 1, cursor: 'pointer', accentColor: '#2563eb' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="number"
                    min="10"
                    max="2000"
                    step="5"
                    className="form-input"
                    value={currentRadius}
                    onChange={(e) => setRadius(Math.max(10, Number(e.target.value)))}
                    style={{ width: '80px', textAlign: 'center', fontWeight: 700, padding: '0.4rem' }}
                  />
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>m</span>
                </div>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginRight: '2px' }}>
                  Presets:
                </span>
                {[30, 50, 100, 200, 500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRadius(preset)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: currentRadius === preset ? 700 : 500,
                      background: currentRadius === preset ? '#2563eb' : '#ffffff',
                      color: currentRadius === preset ? '#ffffff' : '#334155',
                      border: currentRadius === preset ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                      borderRadius: '4px'
                    }}
                  >
                    {preset === 50 ? '50m (Default)' : `${preset}m`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Latitude (-90 to +90)</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Longitude (-180 to +180)</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Designated Site Description</label>
              <input
                type="text"
                className="form-input"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem' }}
              disabled={savingGeofence}
            >
              <Save size={16} />
              <span>
                {savingGeofence
                  ? 'Saving Geofence...'
                  : targetEmployeeId === 'ALL'
                  ? `Save ${currentRadius}m Geofence for All Employees`
                  : `Save ${currentRadius}m Geofence for ${targetEmployeeId}`}
              </span>
            </button>
          </form>
        </div>

        {/* Company Shift Schedule Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Clock size={18} color="#10b981" />
              <span>Company-Wide Shift Schedule</span>
            </span>
            <span className="badge badge-success">Company Policy</span>
          </div>

          <form onSubmit={handleSaveShift}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Shift Start Time (HH:mm)</label>
                <input
                  type="time"
                  className="form-input"
                  value={shiftStart}
                  onChange={(e) => setShiftStart(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Shift End Time (HH:mm)</label>
                <input
                  type="time"
                  className="form-input"
                  value={shiftEnd}
                  onChange={(e) => setShiftEnd(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Grace Period (Minutes)</label>
              <input
                type="number"
                min="0"
                max="60"
                className="form-input"
                value={gracePeriod}
                onChange={(e) => setGracePeriod(e.target.value)}
                required
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>
                Arrivals within grace period are marked punctual in HR analytics.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Enterprise Timezone</label>
              <select
                className="form-select"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                <option value="UTC">UTC (Universal Time)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-success"
              style={{ width: '100%', padding: '0.75rem' }}
              disabled={savingShift}
            >
              <Save size={16} />
              <span>{savingShift ? 'Updating Shift...' : 'Save Shift Schedule'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
