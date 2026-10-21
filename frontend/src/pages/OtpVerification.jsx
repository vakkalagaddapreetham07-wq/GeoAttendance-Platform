import React, { useState } from 'react';
import { api } from '../services/api';
import { Smartphone, KeyRound, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function OtpVerification({ onBackToLogin }) {
  const [step, setStep] = useState(1); // 1 = Request OTP, 2 = Verify OTP
  const [employeeId, setEmployeeId] = useState('EMP001');
  const [password, setPassword] = useState('Emp@12345');
  const [deviceId, setDeviceId] = useState(() => {
    // Generate or read persistent simulated phone hardware ID
    let saved = localStorage.getItem('simulated_device_id');
    if (!saved) {
      saved = 'DEVICE_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      localStorage.setItem('simulated_device_id', saved);
    }
    return saved;
  });
  const [deviceModel, setDeviceModel] = useState('Google Pixel 8 (Android 14)');
  const [otp, setOtp] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.requestOtp(employeeId, password, deviceId, deviceModel);
      setSuccessMsg(res.message);
      if (res.debugOtp) {
        setDebugOtp(res.debugOtp);
        setOtp(res.debugOtp); // Autofill for effortless testing
      }
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to dispatch OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.verifyOtpAndBindDevice(
        employeeId,
        deviceId,
        deviceModel,
        'Android 14',
        otp
      );
      setSuccessMsg(res.message);
      setStep(3); // Success state
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '460px', width: '100%', padding: '2rem' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onBackToLogin}
          style={{ marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
        >
          <ArrowLeft size={14} />
          <span>Back to Login</span>
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', background: '#ecfdf5', borderRadius: '50%', color: '#10b981', marginBottom: '0.75rem' }}>
            <Smartphone size={32} />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Device Binding & OTP Verification</h2>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
            Enforcing Single-Device Registration to prevent buddy punching
          </p>
        </div>

        {error && (
          <div className="alert alert-danger">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && step !== 3 && (
          <div className="alert alert-info">
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleRequestOtp}>
            <div className="form-group">
              <label className="form-label">Employee ID</label>
              <input
                type="text"
                className="form-input"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Simulated Phone Device Hardware ID</label>
              <input
                type="text"
                className="form-input"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Device Model & OS</label>
              <input
                type="text"
                className="form-input"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
              disabled={loading}
            >
              <KeyRound size={16} />
              <span>{loading ? 'Requesting OTP...' : 'Generate Single-Use OTP'}</span>
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp}>
            {debugOtp && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#92400e' }}>
                <strong>[Dev OTP Adapter]:</strong> Generated 6-digit OTP is: <strong>{debugOtp}</strong>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Enter 6-Digit OTP</label>
              <input
                type="text"
                maxLength={6}
                className="form-input"
                style={{ fontSize: '1.4rem', textAlign: 'center', letterSpacing: '0.3em', fontWeight: 700 }}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="000000"
                required
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
                Valid for 5 minutes. Max 3 verification attempts permitted.
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-success"
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
              disabled={loading}
            >
              <CheckCircle2 size={16} />
              <span>{loading ? 'Verifying OTP...' : 'Verify OTP & Bind Phone'}</span>
            </button>
          </form>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Phone Bound Successfully!</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.5rem 0 1.5rem 0' }}>
              Your device <strong>{deviceId}</strong> is now the sole registered attendance device for <strong>{employeeId}</strong>. Any previously bound device has been invalidated.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={onBackToLogin}
            >
              Proceed to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
