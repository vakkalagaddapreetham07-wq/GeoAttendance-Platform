import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  auth,
  googleProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  getFirebaseErrorMessage
} from '../firebase';
import {
  User,
  Mail,
  Lock,
  Phone,
  Building2,
  Briefcase,
  Camera,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Sparkles,
  UserCheck,
  Fingerprint,
  Smartphone,
  ExternalLink,
  KeyRound,
  Send
} from 'lucide-react';

export default function EmployeeRegistration({ onBackToLogin }) {
  const { setAuthSession } = useAuth();

  // Verification Mode: 'google' | 'firebase_email'
  const [verificationMode, setVerificationMode] = useState('google');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Operations');
  const [workplaceId, setWorkplaceId] = useState('');
  const [employeeId, setEmployeeId] = useState(() => 'EMP' + Math.floor(1000 + Math.random() * 9000));

  // Firebase Email/Password Verification State
  const [firebasePassword, setFirebasePassword] = useState('');
  const [firebaseEmailSent, setFirebaseEmailSent] = useState(false);
  const [checkingFirebaseStatus, setCheckingFirebaseStatus] = useState(false);
  const [resendingFirebaseEmail, setResendingFirebaseEmail] = useState(false);

  // Email Mobile Verification State
  const [emailSent, setEmailSent] = useState(false);
  const [emailSessionId, setEmailSessionId] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationProof, setEmailVerificationProof] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [emailPreviewUrl, setEmailPreviewUrl] = useState('');
  const [debugCode, setDebugCode] = useState('');
  const [deliveredViaSmtp, setDeliveredViaSmtp] = useState(false);

  // Firebase Google Auth State (Alternative)
  const [googleUser, setGoogleUser] = useState(null);
  const [authenticatingGoogle, setAuthenticatingGoogle] = useState(false);

  // Biometrics & Consent
  const [consentGiven, setConsentGiven] = useState(true);
  const [faceImage, setFaceImage] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // UI & Loading States
  const [workplaces, setWorkplaces] = useState([]);
  const [loadingWorkplaces, setLoadingWorkplaces] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const pollTimerRef = useRef(null);

  // Is the email verified either via mobile email link or Firebase Google?
  const isIdentityVerified = emailVerified || Boolean(googleUser);

  // Fetch registered workplaces on mount
  useEffect(() => {
    async function loadWorkplaces() {
      try {
        const res = await api.getPublicWorkplaces();
        const list = res.workplaces || [];
        setWorkplaces(list);
        if (list.length > 0) {
          setWorkplaceId(list[0].workplaceId);
        }
      } catch (err) {
        console.warn('Failed to fetch workplaces:', err);
      } finally {
        setLoadingWorkplaces(false);
      }
    }
    loadWorkplaces();

    return () => {
      stopCamera();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // When identity is verified, activate camera for face registration
  useEffect(() => {
    if (isIdentityVerified && !faceImage && !streamRef.current) {
      startCamera();
    }
  }, [isIdentityVerified, faceImage]);

  // Connect video element to MediaStream
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current
        .play()
        .then(() => setIsCameraActive(true))
        .catch((err) => {
          console.warn('[Camera] Autoplay issue:', err);
          setIsCameraActive(true);
        });
    }
  }, [streamRef.current]);

  // -------------------------------------------------------------
  // Mobile Email Verification Handlers
  // -------------------------------------------------------------
  const handleSendVerificationEmail = async () => {
    setError('');
    setSuccessMessage('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid Gmail address to receive the verification link.');
      return;
    }

    setSendingEmail(true);

    try {
      const res = await api.sendRegistrationEmail(email.trim().toLowerCase());
      setEmailSent(true);
      setEmailSessionId(res.sessionId);
      setDeliveredViaSmtp(Boolean(res.deliveredViaSmtp));
      setSuccessMessage(res.message || `Verification link sent to ${email}. Check your Gmail inbox!`);
      if (res.debugCode) {
        setDebugCode(res.debugCode);
        setVerificationCode(res.debugCode);
      }
      if (res.previewUrl) {
        setEmailPreviewUrl(res.previewUrl);
      }

      // Start real-time polling every 2 seconds to detect mobile link click
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      pollTimerRef.current = setInterval(async () => {
        try {
          const statusRes = await api.checkEmailVerificationStatus(res.sessionId);
          if (statusRes.verified) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setEmailVerified(true);
            if (statusRes.proofToken) {
              setEmailVerificationProof(statusRes.proofToken);
            }
            setSuccessMessage(`✓ Gmail verified successfully on your mobile phone! You can now proceed to Face Enrollment.`);
          }
        } catch (pollErr) {
          console.warn('[Polling] Verification status check error:', pollErr);
        }
      }, 2000);
    } catch (err) {
      console.error('[Email Verification] Send error:', err);
      setError(err.message || 'Failed to dispatch verification email. Please check the email address.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleVerifyCodeManually = async () => {
    if (!verificationCode || verificationCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code from your email.');
      return;
    }

    setError('');
    setVerifyingCode(true);

    try {
      const res = await api.verifyEmailCode(emailSessionId, verificationCode.trim());
      if (res.verified) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setEmailVerified(true);
        if (res.proofToken) {
          setEmailVerificationProof(res.proofToken);
        }
        setSuccessMessage('✓ 6-Digit Code Verified! Gmail confirmed. Proceed to Face Registration.');
      }
    } catch (err) {
      console.error('[Code Verification] Error:', err);
      setError(err.message || 'Incorrect verification code. Please check your email.');
    } finally {
      setVerifyingCode(false);
    }
  };

  // Google Firebase Authentication
  const handleGoogleSignIn = async () => {
    setError('');
    setAuthenticatingGoogle(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const idToken = await user.getIdToken();

      const googleData = {
        success: true,
        email: user.email.toLowerCase(),
        name: user.displayName || user.email.split('@')[0],
        photoURL: user.photoURL,
        idToken,
        uid: user.uid,
        provider: 'firebase_google'
      };

      setGoogleUser(googleData);
      setEmail(googleData.email);
      if (googleData.name && !name) {
        setName(googleData.name);
      }
      setSuccessMessage(`✓ Authenticated via Google Firebase as ${googleData.email}`);
    } catch (err) {
      console.warn('[Firebase Auth] Sign in error:', err);
      setError(getFirebaseErrorMessage(err));
    } finally {
      setAuthenticatingGoogle(false);
    }
  };

  // Firebase Email & Password Registration with Verification Link
  const handleFirebaseEmailRegister = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    const regPassword = firebasePassword || password;
    if (!regPassword || regPassword.length < 6) {
      setError('Password must be at least 6 characters for Firebase registration.');
      return;
    }

    // Auto-sync form password fields so user does not need to retype
    if (!password) {
      setPassword(regPassword);
      setConfirmPassword(regPassword);
    }

    setSendingEmail(true);

    try {
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, regPassword);
      } catch (createErr) {
        if (createErr.code === 'auth/email-already-in-use') {
          // If already created in Firebase, attempt sign-in with same password to check or resend verification
          try {
            userCredential = await signInWithEmailAndPassword(auth, cleanEmail, regPassword);
          } catch (signInErr) {
            throw new Error(getFirebaseErrorMessage(createErr));
          }
        } else {
          throw new Error(getFirebaseErrorMessage(createErr));
        }
      }

      const user = userCredential.user;

      if (user.emailVerified) {
        setEmailVerified(true);
        setSuccessMessage(`✓ Email (${cleanEmail}) is already verified in Firebase! You can proceed to Face Enrollment.`);
        return;
      }

      // Trigger sendEmailVerification right after creation
      await sendEmailVerification(user);
      setFirebaseEmailSent(true);
      setEmailSent(true);
      setSuccessMessage(`✓ Verification email sent via Firebase to ${cleanEmail}! Please open your email, tap the link to verify, then click "Check Verification Status" below.`);

      // Start automatic polling every 3 seconds to auto-detect when user taps link
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          if (auth.currentUser) {
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
              setEmailVerified(true);
              setSuccessMessage(`✓ Email verified successfully via Firebase! You can now proceed to Face Enrollment.`);
            }
          }
        } catch (pollErr) {
          console.warn('[Firebase Polling] Status check error:', pollErr);
        }
      }, 3000);
    } catch (err) {
      console.error('[Firebase Email/Password] Error:', err);
      setError(getFirebaseErrorMessage(err));
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCheckFirebaseVerification = async () => {
    setError('');
    setCheckingFirebaseStatus(true);
    try {
      const regPassword = firebasePassword || password;
      if (!auth.currentUser) {
        if (email && regPassword) {
          await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), regPassword);
        } else {
          setError('Please enter your email and password above to check status.');
          setCheckingFirebaseStatus(false);
          return;
        }
      }

      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setEmailVerified(true);
        setSuccessMessage(`✓ Email verified successfully via Firebase! You can now proceed to Face Enrollment.`);
      } else {
        setError('Email not verified yet. Please check your inbox and tap the link in the email from Firebase, then click this button again.');
      }
    } catch (err) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setCheckingFirebaseStatus(false);
    }
  };

  const handleResendFirebaseVerification = async () => {
    setError('');
    setResendingFirebaseEmail(true);
    try {
      const regPassword = firebasePassword || password;
      if (!auth.currentUser && email && regPassword) {
        await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), regPassword);
      }
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setSuccessMessage(`✓ Fresh verification email sent via Firebase to ${auth.currentUser.email}. Please check your inbox!`);
      } else {
        setError('Please enter your email and password first.');
      }
    } catch (err) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setResendingFirebaseEmail(false);
    }
  };

  const handleResetVerification = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setEmailSent(false);
    setFirebaseEmailSent(false);
    setEmailSessionId('');
    setEmailVerified(false);
    setEmailVerificationProof('');
    setVerificationCode('');
    setEmailPreviewUrl('');
    setDebugCode('');
    setGoogleUser(null);
    setFirebasePassword('');
  };

  // Camera Management
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam API is not available on this browser/origin.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().then(() => setIsCameraActive(true));
      }
    } catch (err) {
      console.warn('[Camera] Stream init error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was blocked by the browser. Please allow webcam permissions in your URL bar.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No webcam detected. You can use "Upload Photo" or "Test Snapshot" below.');
      } else {
        setCameraError(err.message || 'Unable to access camera.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Capture frame from video stream to base64 JPEG
  const handleCaptureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setFaceImage(dataUrl);
    setError('');
  };

  // Fallback: Upload Photo from local file
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG or PNG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFaceImage(event.target.result);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  // Fallback: Generate Synthetic Portrait Canvas
  const handleGenerateTestSnapshot = () => {
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 360, 360);

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(180, 340, 140, 90, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8d7b8';
    ctx.beginPath();
    ctx.ellipse(180, 180, 75, 100, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(155, 165, 8, 0, Math.PI * 2);
    ctx.arc(205, 165, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#d4a373';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(180, 175);
    ctx.lineTo(176, 200);
    ctx.lineTo(186, 200);
    ctx.stroke();

    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(180, 220, 25, 0.1 * Math.PI, 0.9 * Math.PI, false);
    ctx.stroke();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setFaceImage(dataUrl);
    setError('');
  };

  const handleRetake = () => {
    setFaceImage(null);
    if (!streamRef.current) {
      startCamera();
    }
  };

  // Submit Registration Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!isIdentityVerified) {
      setError('Please complete Gmail verification on your mobile phone before submitting registration.');
      return;
    }

    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }

    const regEmail = googleUser ? googleUser.email : email;
    if (!regEmail) {
      setError('Verified Gmail address is missing.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (!consentGiven) {
      setError('You must consent to biometric facial registration to proceed.');
      return;
    }

    if (!faceImage) {
      setError('Face capture is required. Please capture your face photo using the camera, upload a photo, or click "Test Snapshot".');
      return;
    }

    setSubmitting(true);

    try {
      let currentDeviceId = localStorage.getItem('attendance_device_id');
      if (!currentDeviceId) {
        currentDeviceId = 'DEV_' + Math.random().toString(36).substring(2, 9).toUpperCase();
        localStorage.setItem('attendance_device_id', currentDeviceId);
      }

      let fbToken = googleUser ? googleUser.idToken : undefined;
      let fbUid = googleUser ? googleUser.uid : undefined;
      if (!fbToken && auth.currentUser) {
        try {
          fbToken = await auth.currentUser.getIdToken();
          fbUid = auth.currentUser.uid;
        } catch (tErr) {
          console.warn('[Firebase Token] Warning:', tErr);
        }
      }

      const payload = {
        employeeId: employeeId.trim().toUpperCase(),
        name: name.trim(),
        email: regEmail.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        emailVerificationProof: emailVerificationProof || undefined,
        isGmailVerified: isIdentityVerified,
        googleId: fbUid || undefined,
        firebaseToken: fbToken || undefined,
        department,
        workplaceId: workplaceId || null,
        faceImage,
        consentGiven: true,
        consentStatement: 'I explicitly consent to biometric facial enrollment for identity validation and fraud prevention in the Geofence Attendance System.',
        deviceId: currentDeviceId,
        deviceModel: navigator.userAgent.includes('Mobile') ? 'Mobile Phone' : 'Workstation Browser'
      };

      const res = await api.register(payload);

      if (res.token && res.user && setAuthSession) {
        setAuthSession(res.token, res.user);
      }

      setSuccessMessage('Registration & Biometric Face Enrollment Successful! Redirecting to Employee Portal...');
      stopCamera();

      setTimeout(() => {
        if (!res.token && onBackToLogin) {
          onBackToLogin();
        }
      }, 1200);
    } catch (err) {
      console.error('[Registration] Submit error:', err);
      setError(err.message || 'Registration failed. Please check your inputs and ensure your face is clearly visible.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem' }}>
      <div className="card" style={{ maxWidth: '700px', width: '100%', padding: '2rem' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={onBackToLogin}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ArrowLeft size={15} />
            <span>Back to Sign In</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2563eb', fontSize: '0.8rem', fontWeight: 700 }}>
            <Fingerprint size={18} />
            <span>Biometric Onboarding</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.5rem', background: '#ffffff', borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
            <img src="/logo.png" alt="GeoAttendance Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Employee Registration</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
            Verify your Gmail on your mobile phone, then proceed to Biometric Face Enrollment.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* STEP 1: GMAIL VERIFICATION ON MOBILE DEVICE */}
        <div style={{
          marginBottom: '1.5rem',
          background: isIdentityVerified ? '#ecfdf5' : '#f8fafc',
          padding: '1.25rem',
          borderRadius: '10px',
          border: `1.5px solid ${isIdentityVerified ? '#10b981' : '#cbd5e1'}`,
          transition: 'all 0.2s ease'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isIdentityVerified ? '#047857' : '#1e293b', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Mail size={16} color={isIdentityVerified ? '#059669' : '#2563eb'} />
              <span>1. Firebase Email & Identity Verification (Mandatory)</span>
            </div>
            {isIdentityVerified ? (
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle2 size={13} /> Verified
              </span>
            ) : (
              <span className="badge badge-warning">Verification Required</span>
            )}
          </div>

          {!isIdentityVerified ? (
            <div>
              {/* Tab Navigation for Verification Mode */}
              <div style={{
                display: 'flex',
                background: '#e2e8f0',
                borderRadius: '8px',
                padding: '4px',
                marginBottom: '1rem',
                gap: '4px'
              }}>
                <button
                  type="button"
                  onClick={() => setVerificationMode('google')}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: verificationMode === 'google' ? '#ffffff' : 'transparent',
                    color: verificationMode === 'google' ? '#1e293b' : '#64748b',
                    boxShadow: verificationMode === 'google' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Google (1-Click)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVerificationMode('firebase_email')}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: verificationMode === 'firebase_email' ? '#ffffff' : 'transparent',
                    color: verificationMode === 'firebase_email' ? '#1e293b' : '#64748b',
                    boxShadow: verificationMode === 'firebase_email' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Mail size={15} />
                  <span>Email & Password Link</span>
                </button>
              </div>

              {/* Mode A: Google 1-Click Popup */}
              {verificationMode === 'google' && (
                <div>
                  <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '0.85rem', lineHeight: 1.5 }}>
                    Verify your identity instantly using your official Google / Gmail account via Firebase Authentication popup.
                  </p>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={authenticatingGoogle}
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.6rem',
                      padding: '0.75rem 1rem',
                      fontWeight: 600,
                      background: '#ffffff',
                      color: '#1e293b',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>{authenticatingGoogle ? 'Opening Google Sign-In...' : 'Continue with Google (Firebase)'}</span>
                  </button>
                </div>
              )}

              {/* Mode B: Firebase Email & Password Verification Link */}
              {verificationMode === 'firebase_email' && (
                <div>
                  <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '0.85rem', lineHeight: 1.5 }}>
                    Enter your email and create a password. Firebase will create your account and dispatch an official email verification link. Tap the link in your email to verify before proceeding.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.75rem' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="yourname@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={sendingEmail}
                        style={{ paddingLeft: '2.25rem' }}
                      />
                      <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Password (min 6 chars)"
                        value={firebasePassword}
                        onChange={(e) => {
                          setFirebasePassword(e.target.value);
                          if (!password) {
                            setPassword(e.target.value);
                            setConfirmPassword(e.target.value);
                          }
                        }}
                        disabled={sendingEmail}
                        style={{ paddingLeft: '2.25rem' }}
                      />
                      <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleFirebaseEmailRegister}
                    disabled={sendingEmail || !email}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem 1rem' }}
                  >
                    {sendingEmail ? (
                      <>
                        <RefreshCw size={15} className="spinner" />
                        <span>Creating Firebase Account & Dispatching Link...</span>
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>{firebaseEmailSent ? 'Resend Verification Link' : 'Register with Email & Send Link'}</span>
                      </>
                    )}
                  </button>

                  {/* Firebase Email Status Notification Box */}
                  {firebaseEmailSent && (
                    <div style={{
                      marginTop: '1rem',
                      background: '#f0fdf4',
                      border: '1.5px solid #86efac',
                      borderRadius: '8px',
                      padding: '1rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.85rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: '#dcfce7',
                          color: '#16a34a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px'
                        }}>
                          <Mail size={16} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#166534' }}>
                            Verification Email Sent!
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#15803d', marginTop: '0.2rem', lineHeight: 1.45 }}>
                            We sent a verification link to <strong>{email}</strong>. Please check your inbox and tap the link to verify your email before proceeding.
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <RefreshCw size={12} className="spinner" />
                            <span>Auto-detecting verification every 3 seconds...</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleCheckFirebaseVerification}
                          disabled={checkingFirebaseStatus}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                        >
                          {checkingFirebaseStatus ? (
                            <>
                              <RefreshCw size={13} className="spinner" />
                              <span>Checking Status...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={13} />
                              <span>Check Verification Status</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleResendFirebaseVerification}
                          disabled={resendingFirebaseEmail}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                        >
                          {resendingFirebaseEmail ? (
                            <>
                              <RefreshCw size={13} className="spinner" />
                              <span>Resending...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw size={13} />
                              <span>Resend Email</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Verified Confirmation Banner */
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={18} color="#059669" />
                  <span>{googleUser ? googleUser.email : email}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#047857', marginTop: '0.2rem' }}>
                  Status: <strong>Verified via Firebase</strong> • Ready for Biometric Enrollment
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetVerification}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              >
                Change Email / Re-verify
              </button>
            </div>
          )}
        </div>

        {/* STEP 2 & STEP 3 FORM CONTAINER (LOCKED UNTIL VERIFICATION) */}
        <form onSubmit={handleSubmit}>
          {!isIdentityVerified && (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#92400e'
            }}>
              <AlertCircle size={24} style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                <strong>Step 2 (Workplace Details) and Step 3 (Face Enrollment) are locked.</strong>
                <br />
                Please verify your identity using Google (1-Click) or Email & Password verification link above to unlock the remaining steps.
              </div>
            </div>
          )}

          <div style={{
            opacity: isIdentityVerified ? 1 : 0.45,
            pointerEvents: isIdentityVerified ? 'auto' : 'none',
            transition: 'all 0.3s ease'
          }}>
            {/* STEP 2: Employee Profile & Workplace Details */}
            <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <User size={16} color="#2563eb" />
                <span>2. Workplace & Profile Details</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Verified Gmail Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={googleUser ? googleUser.email : email}
                    readOnly
                    style={{ background: '#f1f5f9', cursor: 'not-allowed', color: '#0f172a', fontWeight: 600 }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Password * (min 6 chars)</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Confirm Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Mobile Number (Optional Contact)</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. +91 93983 94987"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Employee ID (Generated / Custom)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. EMP4821"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Workplace / Company *</label>
                  <select
                    className="form-input"
                    value={workplaceId}
                    onChange={(e) => setWorkplaceId(e.target.value)}
                    disabled={loadingWorkplaces}
                  >
                    {workplaces.map((wp) => (
                      <option key={wp.workplaceId} value={wp.workplaceId}>
                        {wp.name} ({wp.city || 'Office'})
                      </option>
                    ))}
                    {workplaces.length === 0 && <option value="">No workplaces found</option>}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Department</label>
                  <select
                    className="form-input"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="Operations">Operations</option>
                    <option value="Engineering">Engineering / IT</option>
                    <option value="Sales">Sales & Marketing</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Finance">Finance & Accounting</option>
                  </select>
                </div>
              </div>
            </div>

            {/* STEP 3: Biometric Face Capture */}
            <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Camera size={16} color="#2563eb" />
                  <span>3. Biometric Face Enrollment (Mandatory)</span>
                </div>
                {faceImage ? (
                  <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CheckCircle2 size={13} /> Face Captured
                  </span>
                ) : (
                  <span className="badge badge-warning">Capture Required</span>
                )}
              </div>

              {/* Privacy Notice */}
              <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', marginBottom: '1rem', fontSize: '0.8rem', color: '#1e40af' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#2563eb' }} />
                  <div>
                    <strong>Biometric Privacy:</strong> Your face is converted into a 128-dimensional mathematical vector using OpenCV YuNet & SFace models. During attendance check-ins, your face will be matched against this enrolled template.
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                  />
                  <span>I consent to biometric facial registration for attendance verification.</span>
                </label>
              </div>

              {/* Camera Viewport & Capture Options */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                {faceImage ? (
                  /* Captured Face Preview */
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: '240px', height: '240px', borderRadius: '12px', overflow: 'hidden', border: '3px solid #22c55e', margin: '0 auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      <img src={faceImage} alt="Captured Face" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(34, 197, 94, 0.9)', color: '#fff', fontSize: '0.75rem', padding: '0.3rem', fontWeight: 700 }}>
                        ✓ Enrolled Reference Face
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleRetake}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <RefreshCw size={14} />
                        <span>Retake Photo</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Live Camera Stream */
                  <div style={{ width: '100%', maxWidth: '340px' }}>
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      paddingTop: '75%', // 4:3 Aspect Ratio
                      background: '#0f172a',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '2px solid #cbd5e1'
                    }}>
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transform: 'scaleX(-1)' // Mirror effect
                        }}
                      />

                      {/* Face Guide Oval */}
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '150px',
                        height: '190px',
                        borderRadius: '50%',
                        border: '2px dashed rgba(255, 255, 255, 0.85)',
                        boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45)',
                        pointerEvents: 'none'
                      }} />

                      {cameraError && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(15, 23, 42, 0.9)',
                          color: '#f87171',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '1rem',
                          textAlign: 'center',
                          fontSize: '0.8rem'
                        }}>
                          <AlertCircle size={28} style={{ marginBottom: '0.5rem' }} />
                          <span>{cameraError}</span>
                        </div>
                      )}
                    </div>

                    {/* Capture Controls */}
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleCaptureFrame}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.65rem' }}
                        disabled={!isCameraActive || !!cameraError}
                      >
                        <Camera size={16} />
                        <span>Capture Face Photo</span>
                      </button>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => fileInputRef.current?.click()}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                        >
                          <Upload size={14} />
                          <span>Upload Photo</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleGenerateTestSnapshot}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                        >
                          <Sparkles size={14} />
                          <span>Test Snapshot</span>
                        </button>
                      </div>

                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/jpeg,image/png"
                        style={{ display: 'none' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Hidden Canvas */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Checklist */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              justifyContent: 'center',
              marginBottom: '1rem',
              padding: '0.65rem 0.85rem',
              background: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '0.78rem'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: isIdentityVerified ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                <CheckCircle2 size={14} /> 1. Gmail Mobile Verified
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: name && password ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                <CheckCircle2 size={14} /> 2. Profile Details
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: faceImage ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                <CheckCircle2 size={14} /> 3. Face Biometric Enrolled
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700 }}
              disabled={submitting || !faceImage || !consentGiven || !isIdentityVerified}
            >
              {submitting ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <RefreshCw size={18} className="spinner" />
                  <span>Enrolling Biometric Face & Registering...</span>
                </span>
              ) : !isIdentityVerified ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Mail size={18} />
                  <span>Verify Gmail on Mobile Phone to Continue</span>
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={18} />
                  <span>Complete Registration & Face Enrollment</span>
                </span>
              )}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
            Already have an employee account?{' '}
            <button
              type="button"
              onClick={onBackToLogin}
              style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Sign In here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
