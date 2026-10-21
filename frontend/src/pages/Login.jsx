import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { signInWithGoogle, auth, googleProvider, signInWithPopup } from '../firebase';
import { MapPin, Lock, User, AlertCircle, Smartphone, UserPlus, ArrowLeft } from 'lucide-react';

export default function Login({ onBackToHome, onGoToOtp, onGoToRegisterWorkplace, onGoToRegisterEmployee }) {
  const { login, loading, setAuthSession } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(identifier, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const googleUser = await signInWithGoogle();

      let currentDeviceId = localStorage.getItem('attendance_device_id');
      if (!currentDeviceId) {
        currentDeviceId = 'DEV_' + Math.random().toString(36).substring(2, 9).toUpperCase();
        localStorage.setItem('attendance_device_id', currentDeviceId);
      }

      const res = await api.firebaseLogin({
        email: googleUser.email,
        name: googleUser.name,
        idToken: googleUser.idToken,
        googleId: googleUser.uid,
        deviceId: currentDeviceId,
        deviceModel: navigator.userAgent.includes('Mobile') ? 'Mobile Phone' : 'Workstation Browser'
      });

      if (res.notRegistered) {
        if (onGoToRegisterEmployee) {
          onGoToRegisterEmployee();
        } else {
          setError(res.message || 'This Gmail account is not registered yet. Please register first.');
        }
        return;
      }

      if (res.token && res.user && setAuthSession) {
        setAuthSession(res.token, res.user);
      }
    } catch (err) {
      console.warn('[Firebase Google Login] Error:', err);
      setError(err.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const setDemo = (id, pass) => {
    setIdentifier(id);
    setPassword(pass);
    setError('');
  };

  return (
    <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '2rem' }}>
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            className="btn btn-secondary btn-sm"
            style={{ marginBottom: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ArrowLeft size={14} />
            <span>Back to Home</span>
          </button>
        )}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.5rem', background: '#ffffff', borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', marginBottom: '0.75rem' }}>
            <img src="/logo.png" alt="GeoAttendance Logo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>GeoAttendance Platform</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.3rem' }}>
            Multi-Workplace Geofencing & ML Anomaly Detection Platform
          </p>
        </div>

        {error && (
          <div className="alert alert-danger">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Employee ID, Admin Email, or SuperAdmin ID</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. ADMIN001, EMP001, or yourname@gmail.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
            disabled={loading || googleLoading}
          >
            <Lock size={16} />
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>

        {/* Public Action Options */}
        {onGoToRegisterEmployee && (
          <div style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{
                width: '100%',
                background: '#ecfdf5',
                borderColor: '#a7f3d0',
                color: '#065f46',
                fontWeight: 700,
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                borderRadius: '8px'
              }}
              onClick={onGoToRegisterEmployee}
            >
              <UserPlus size={16} />
              <span>Register as Employee (with Gmail & Face ID)</span>
            </button>
          </div>
        )}

        {/* Multi-Tenant Demo Credentials Helper */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Quick Demo Accounts (1-Click Test):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDemo('SUPERADMIN001', 'SuperAdmin@12345')}
              style={{ fontSize: '0.72rem', gridColumn: 'span 2', background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}
            >
              🛡️ Platform SuperAdmin
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDemo('ADMIN001', 'Admin@12345')}
              style={{ fontSize: '0.72rem' }}
            >
              🏢 Admin (Acme Tech)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDemo('ADMIN002', 'Admin@12345')}
              style={{ fontSize: '0.72rem' }}
            >
              🏬 Admin (Metro Retail)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDemo('EMP001', 'Emp@12345')}
              style={{ fontSize: '0.72rem' }}
            >
              👤 Alice (Acme Tech)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDemo('EMP003', 'Emp@12345')}
              style={{ fontSize: '0.72rem' }}
            >
              👤 Charlie (Metro Retail)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
