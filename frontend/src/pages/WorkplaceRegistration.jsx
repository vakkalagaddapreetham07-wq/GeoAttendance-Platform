import React, { useState } from 'react';
import { api } from '../services/api';
import InteractiveMap from '../components/InteractiveMap';
import {
  Building2,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sliders,
  Send,
  Phone,
  Mail,
  User,
  Lock,
  Compass
} from 'lucide-react';

const CATEGORIES = [
  { value: 'corporate', label: 'Corporate Office' },
  { value: 'it_tech', label: 'IT & Software Development' },
  { value: 'retail', label: 'Retail Store / Supermarket' },
  { value: 'education', label: 'College / School / University' },
  { value: 'healthcare', label: 'Hospital / Clinic' },
  { value: 'manufacturing', label: 'Manufacturing & Warehouse' },
  { value: 'coworking', label: 'Coworking Space' },
  { value: 'hospitality', label: 'Hotel & Restaurant' },
  { value: 'other', label: 'Other Workplace' }
];

export default function WorkplaceRegistration({ onBackToLogin }) {
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    organizationName: '',
    category: 'corporate',
    registrationNumber: '',
    // Address
    street: '',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    postalCode: '560001',
    // Contact
    contactEmail: '',
    contactPhone: '',
    // Geofence
    latitude: 12.9715987,
    longitude: 77.5945627,
    radius: 50,
    locationName: 'Corporate Headquarters',
    // Shift
    shiftStart: '09:00',
    shiftEnd: '18:00',
    gracePeriodMinutes: 15,
    timezone: 'Asia/Kolkata',
    // Administrator
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: '',
    adminEmployeeId: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredResult, setRegisteredResult] = useState(null);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMapCenterChange = ({ lat, lon }) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lon
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!formData.name.trim() || !formData.organizationName.trim()) {
      setError('Please provide workplace and organization names.');
      return;
    }
    if (!formData.contactEmail.trim() || !formData.contactPhone.trim()) {
      setError('Official contact email and phone number are required.');
      return;
    }
    if (!formData.adminName.trim() || !formData.adminEmail.trim() || !formData.adminPassword) {
      setError('Workplace Administrator name, email, and password are required.');
      return;
    }
    if (formData.adminPassword.length < 8) {
      setError('Administrator password must be at least 8 characters long.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: formData.name.trim(),
        organizationName: formData.organizationName.trim(),
        category: formData.category,
        registrationNumber: formData.registrationNumber.trim() || undefined,
        address: {
          street: formData.street.trim() || 'Workplace Site',
          city: formData.city.trim() || 'Bangalore',
          state: formData.state.trim() || 'Karnataka',
          country: formData.country.trim() || 'India',
          postalCode: formData.postalCode.trim() || '560001'
        },
        contactEmail: formData.contactEmail.trim().toLowerCase(),
        contactPhone: formData.contactPhone.trim(),
        geofence: {
          center: {
            latitude: Number(formData.latitude),
            longitude: Number(formData.longitude)
          },
          radius: Number(formData.radius) || 50,
          locationName: formData.locationName.trim() || formData.name.trim()
        },
        shiftSchedule: {
          shiftStart: formData.shiftStart,
          shiftEnd: formData.shiftEnd,
          gracePeriodMinutes: Number(formData.gracePeriodMinutes) || 15,
          timezone: formData.timezone
        },
        admin: {
          name: formData.adminName.trim(),
          email: formData.adminEmail.trim().toLowerCase(),
          mobileNumber: formData.adminPhone.trim(),
          password: formData.adminPassword,
          employeeId: formData.adminEmployeeId.trim().toUpperCase() || undefined
        }
      };

      const res = await api.registerWorkplace(payload);
      if (res.success) {
        setRegisteredResult(res);
      }
    } catch (err) {
      setError(err.message || 'Workplace registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Success Screen
  if (registeredResult) {
    return (
      <div style={{ maxWidth: '640px', margin: '2rem auto', padding: '1rem' }}>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', background: '#ecfdf5', borderRadius: '50%', color: '#10b981', marginBottom: '1.25rem' }}>
            <CheckCircle2 size={44} />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
            Workplace Registered Successfully!
          </h2>

          <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: '1.5' }}>
            Your organization <strong>{registeredResult.workplace?.name}</strong> has been registered on the platform.
          </p>

          <div style={{ margin: '1.5rem 0', padding: '1.25rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.88rem' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: '#64748b' }}>Assigned Workplace ID: </span>
              <strong style={{ color: '#2563eb', fontSize: '1rem' }}>{registeredResult.workplace?.workplaceId}</strong>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: '#64748b' }}>Workplace Admin Account: </span>
              <strong>{registeredResult.admin?.email}</strong> (ID: {registeredResult.admin?.employeeId})
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: '#64748b' }}>Geofence Radius: </span>
              <strong>{registeredResult.workplace?.geofence?.radius || 50} metres</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Status: </span>
              <span className="badge badge-warning" style={{ fontSize: '0.78rem' }}>
                Pending Platform Approval
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.5rem' }}>
            Our platform administrators will review your workplace verification. Once approved, you and your employees can begin marking GPS attendance.
          </p>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.8rem' }}
            onClick={onBackToLogin}
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '1.5rem auto', padding: '1rem' }}>
      {/* Top back navigation */}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        onClick={onBackToLogin}
      >
        <ArrowLeft size={15} />
        <span>Back to Login</span>
      </button>

      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.5rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
            <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Workplace & Organization Registration
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Register your office, hospital, school, retail store, or site with custom geofence boundaries and shift schedules.
            </p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* SECTION 1: Organization Details */}
          <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} color="#2563eb" />
              1. Organization & Workplace Information
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Workplace Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acme Tech Bangalore HQ"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Organization / Parent Business *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acme Corporation Pvt Ltd"
                  value={formData.organizationName}
                  onChange={(e) => handleChange('organizationName', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Workplace Category *</label>
                <select
                  className="form-input"
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Business Registration / GSTIN (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  value={formData.registrationNumber}
                  onChange={(e) => handleChange('registrationNumber', e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Street Address *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 100 Feet Road, Indiranagar"
                  value={formData.street}
                  onChange={(e) => handleChange('street', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">City *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">State / Region *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Official Contact Email *</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="contact@company.com"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Official Contact Phone *</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+91 98765 43210"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Geofence Location & Radius Map */}
          <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={18} color="#2563eb" />
                2. Workplace Geofence Location & Radius
              </h3>
              <div className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                Default: 50m radius
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Use the interactive place search bar or drag the blue pin on the map to set your workplace's exact GPS coordinates. Employees must be inside this circle to check in.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <InteractiveMap
                centerLat={Number(formData.latitude)}
                centerLon={Number(formData.longitude)}
                radius={Number(formData.radius)}
                editable={true}
                onCenterChange={handleMapCenterChange}
                height="340px"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  className="form-input"
                  value={formData.latitude}
                  onChange={(e) => handleChange('latitude', Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  className="form-input"
                  value={formData.longitude}
                  onChange={(e) => handleChange('longitude', Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label className="form-label">Geofence Radius (metres)</label>
                  <strong style={{ color: '#2563eb' }}>{formData.radius}m</strong>
                </div>
                <input
                  type="range"
                  min="25"
                  max="300"
                  step="5"
                  value={formData.radius}
                  onChange={(e) => handleChange('radius', Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#2563eb' }}
                />
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
                  {[30, 50, 75, 100, 150].map((r) => (
                    <button
                      type="button"
                      key={r}
                      className={`btn btn-secondary btn-sm ${formData.radius === r ? 'active' : ''}`}
                      style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem' }}
                      onClick={() => handleChange('radius', r)}
                    >
                      {r}m {r === 50 && '★'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Shift Schedule */}
          <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} color="#2563eb" />
              3. Standard Workplace Shift Schedule
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Shift Start Time (24h)</label>
                <input
                  type="time"
                  className="form-input"
                  value={formData.shiftStart}
                  onChange={(e) => handleChange('shiftStart', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Shift End Time (24h)</label>
                <input
                  type="time"
                  className="form-input"
                  value={formData.shiftEnd}
                  onChange={(e) => handleChange('shiftEnd', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Punctuality Grace Period (mins)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  className="form-input"
                  value={formData.gracePeriodMinutes}
                  onChange={(e) => handleChange('gracePeriodMinutes', Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Workplace Administrator Account */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#2563eb" />
              4. Workplace Administrator Account Credentials
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Each workplace has exactly one primary administrator who will approve employee join requests, configure shifts, and monitor ML attendance anomalies.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Administrator Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={formData.adminName}
                  onChange={(e) => handleChange('adminName', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Administrator Work Email *</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="admin@company.com"
                  value={formData.adminEmail}
                  onChange={(e) => handleChange('adminEmail', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Verified Mobile Number *</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+91 98765 43210"
                  value={formData.adminPhone}
                  onChange={(e) => handleChange('adminPhone', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Administrator Password *</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Minimum 8 characters"
                  value={formData.adminPassword}
                  onChange={(e) => handleChange('adminPassword', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 700 }}
            disabled={loading}
          >
            <Send size={18} />
            <span>{loading ? 'Submitting Registration...' : 'Complete Workplace Registration'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
