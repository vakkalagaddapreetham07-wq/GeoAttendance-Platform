import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  RefreshCw,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  Sparkles
} from 'lucide-react';

/**
 * CameraCaptureModal
 * High-reliability webcam capture modal styled natively with pure CSS and Lucide icons.
 * Features:
 * - Live webcam stream with user facingMode
 * - Centered oval face alignment guide with visual pulse
 * - Canvas frame extraction to JPEG data-url
 * - Evaluation snapshot generator fallback (for devices without webcam or blocked permissions)
 * - File upload fallback
 * - Retake and confirm workflow
 */
export default function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  title = 'Biometric Face Verification',
  subtitle = 'Position your face inside the oval frame and look directly at the camera.',
  mode = 'verify', // 'verify' or 'enroll'
  isLoading = false
}) {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize camera when modal opens
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setCameraError(null);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Connect video element to MediaStream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current
        .play()
        .then(() => setIsCameraActive(true))
        .catch((err) => {
          console.warn('[CameraModal] Autoplay warning:', err);
          setIsCameraActive(true);
        });
    }
  }, [stream]);

  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access API is not available on this browser / origin. (Webcam requires HTTPS or http://localhost).');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      setStream(mediaStream);
    } catch (err) {
      console.warn('[CameraModal] Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was blocked. Please click the camera icon in your browser URL bar to allow access.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No webcam hardware detected on this machine. You can upload a photo or use the Demo Snapshot.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is currently in use by another application (e.g. Teams, Zoom, or another browser window).');
      } else {
        setCameraError(err.message || 'Unable to start camera.');
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    // Draw unmirrored standard video frame (aligned with EmployeeRegistration enrollment)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage && onCapture) {
      onCapture(capturedImage);
    }
  };

  // Generate synthetic evaluation snapshot fallback if camera is unavailable or testing
  const handleGenerateSampleFace = () => {
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 400, 400);
    grad.addColorStop(0, '#f1f5f9');
    grad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 400);

    // Realistic face shape
    ctx.fillStyle = '#e8beac';
    ctx.beginPath();
    ctx.ellipse(200, 190, 95, 125, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#262626';
    ctx.beginPath();
    ctx.ellipse(165, 165, 10, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(235, 165, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows
    ctx.strokeStyle = '#332211';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(165, 150, 18, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(235, 150, 18, Math.PI * 1.1, Math.PI * 0.1, true);
    ctx.stroke();

    // Nose
    ctx.strokeStyle = '#c49682';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(200, 165);
    ctx.lineTo(196, 205);
    ctx.lineTo(208, 207);
    ctx.stroke();

    // Mouth
    ctx.fillStyle = '#b84d4d';
    ctx.beginPath();
    ctx.ellipse(200, 240, 28, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    const sampleDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(sampleDataUrl);
    setCameraError(null);
    stopCamera();
  };

  // File upload fallback
  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedImage(event.target.result);
      setCameraError(null);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '620px',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.45)',
          background: '#ffffff'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: '#0f172a',
            color: '#ffffff',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #1e293b'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Camera size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                {title}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                {subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Viewport Body */}
        <div style={{ padding: '1.25rem', background: '#f8fafc', textAlign: 'center' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '520px',
              height: '360px',
              margin: '0 auto',
              background: '#0a0f1d',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.8)'
            }}
          >
            {capturedImage ? (
              // Captured Snapshot Preview
              <img
                src={capturedImage}
                alt="Captured Face"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : cameraError ? (
              // Camera Error or Unavailable Fallback View
              <div style={{ padding: '1.5rem', color: '#f8fafc', maxWidth: '420px' }}>
                <AlertCircle size={42} color="#ef4444" style={{ marginBottom: '0.75rem' }} />
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.4rem', color: '#ffffff' }}>
                  Camera Notice
                </h4>
                <p style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '1.2rem', lineHeight: 1.4 }}>
                  {cameraError}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={startCamera}
                    style={{ fontSize: '0.8rem' }}
                  >
                    <RefreshCw size={14} /> Retry Camera
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: '0.8rem' }}
                  >
                    <Upload size={14} /> Upload Photo
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleGenerateSampleFace}
                    style={{ fontSize: '0.8rem', background: '#3b82f6', color: '#ffffff', border: 'none' }}
                  >
                    <Sparkles size={14} /> Test Snapshot
                  </button>
                </div>
              </div>
            ) : (
              // Live Video Stream with Oval Guide
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)'
                  }}
                />

                {/* Oval Guide Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12%',
                    left: '26%',
                    width: '48%',
                    height: '76%',
                    borderRadius: '50%',
                    border: '3px dashed #10b981',
                    boxShadow: '0 0 0 9999px rgba(10, 15, 29, 0.45)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center'
                  }}
                >
                  <span
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      marginTop: '-12px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  >
                    Align Face Here
                  </span>
                </div>
              </>
            )}

            {/* Hidden canvas and file input */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />

            {/* In-Modal Loading Spinner */}
            {isLoading && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(15, 23, 42, 0.88)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  zIndex: 20
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    border: '4px solid rgba(255, 255, 255, 0.2)',
                    borderTopColor: '#3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '1rem'
                  }}
                />
                <h5 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Biometric Analysis in Progress
                </h5>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  Extracting 128-d facial vector & matching template...
                </p>
              </div>
            )}
          </div>

          {/* Tips Banner */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-around',
              maxWidth: '520px',
              margin: '0.75rem auto 0 auto',
              padding: '0.5rem 1rem',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '0.76rem',
              color: '#64748b'
            }}
          >
            <span>💡 Bright Lighting</span>
            <span>👀 Face Camera</span>
            <span>👤 Single Person</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isLoading}
            onClick={onClose}
          >
            Cancel
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {capturedImage ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isLoading}
                  onClick={handleRetake}
                >
                  <RefreshCw size={15} /> Retake
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={isLoading}
                  onClick={handleConfirm}
                  style={{ fontWeight: 700, padding: '0.6rem 1.25rem' }}
                >
                  <CheckCircle2 size={16} />
                  {mode === 'enroll' ? 'Save Face Profile' : 'Verify & Continue'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload from device"
                >
                  <Upload size={14} /> Upload File
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={Boolean(cameraError) || isLoading}
                  onClick={handleCapture}
                  style={{ fontWeight: 700, padding: '0.6rem 1.25rem' }}
                >
                  <Camera size={16} /> Capture Photo
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
