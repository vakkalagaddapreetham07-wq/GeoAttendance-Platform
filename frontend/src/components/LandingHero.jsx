import React, { useState } from 'react';
import {
  MapPin,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Smartphone,
  ChevronDown,
  UserCheck,
  Building2,
  Lock,
  Layers,
  MessageSquare,
  HelpCircle,
  Clock,
  Compass,
  Cpu,
  Fingerprint
} from 'lucide-react';

export default function LandingHero({
  onGoToLogin,
  onGoToRegisterEmployee,
  onGoToRegisterWorkplace,
  onQuickDemoLogin
}) {
  const [showFloatingWidget, setShowFloatingWidget] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #ecfdf5 0%, #f0fdf9 30%, #f8fafc 70%, #ffffff 100%)',
      color: '#0f172a',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* 1. TOP NAVIGATION BAR */}
      <header style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '1.25rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 40
      }}>
        {/* Brand Logo & Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src="/logo.png"
            alt="GeoAttendance Logo"
            style={{ width: '42px', height: '42px', objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#064e3b', letterSpacing: '-0.02em' }}>
              GeoAttendance
            </span>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              background: '#d1fae5',
              color: '#047857',
              padding: '2px 7px',
              borderRadius: '12px',
              textTransform: 'uppercase'
            }}>
              AI 2.0
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
          <div
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Why GeoAttendance? <ChevronDown size={14} />
            </span>
            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '0.5rem',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                padding: '0.75rem',
                width: '260px',
                zIndex: 50
              }}>
                <div style={{ padding: '0.5rem', fontSize: '0.82rem', color: '#1e293b' }}>
                  <strong>Zero Proxy Attendance</strong>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>OpenCV YuNet & SFace biometric match</div>
                </div>
                <div style={{ padding: '0.5rem', fontSize: '0.82rem', color: '#1e293b' }}>
                  <strong>Precision GPS Geofencing</strong>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Hardware GPS + Multi-workplace radius</div>
                </div>
              </div>
            )}
          </div>

          <a href="#features" style={{ fontSize: '0.92rem', fontWeight: 600, color: '#334155', textDecoration: 'none' }}>
            Features
          </a>
          <a href="#pricing" style={{ fontSize: '0.92rem', fontWeight: 600, color: '#334155', textDecoration: 'none' }}>
            Workplaces
          </a>
          <a href="#about" style={{ fontSize: '0.92rem', fontWeight: 600, color: '#334155', textDecoration: 'none' }}>
            Biometrics
          </a>
        </nav>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onGoToLogin}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#064e3b',
              fontWeight: 700,
              fontSize: '0.92rem',
              padding: '0.6rem 1.1rem',
              cursor: 'pointer',
              borderRadius: '30px'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={onGoToRegisterEmployee}
            style={{
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.92rem',
              padding: '0.65rem 1.4rem',
              borderRadius: '30px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#047857')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#059669')}
          >
            Start for free
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '3rem 2rem 5rem 2rem',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)',
        gap: '3.5rem',
        alignItems: 'center',
        position: 'relative'
      }}>
        {/* Left Column: Headline & Value Proposition */}
        <div>
          {/* Subtle Tag */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: '#ffffff',
            border: '1px solid #a7f3d0',
            padding: '0.4rem 0.9rem',
            borderRadius: '30px',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#047857',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.1)'
          }}>
            <Sparkles size={15} color="#059669" />
            <span>OpenCV YuNet & SFace Biometric Face Attendance</span>
          </div>

          {/* Main Headline (Matching Dubsado's iconic layout) */}
          <h1 style={{
            fontSize: '3.6rem',
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: '-0.035em',
            color: '#064e3b',
            marginBottom: '1.25rem'
          }}>
            More attendance, <br />
            <span style={{ color: '#059669' }}>zero fraud.</span>
          </h1>

          {/* Subtitle Description */}
          <p style={{
            fontSize: '1.12rem',
            lineHeight: 1.6,
            color: '#334155',
            maxWidth: '540px',
            marginBottom: '2rem'
          }}>
            GeoAttendance helps your workplace stay in sync. Verify employee presence with GPS geofencing,
            enroll and match faces in 0.2s using OpenCV AI, and streamline attendance workflows from clock-in to clock-out.
          </p>

          {/* Primary Call to Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
            <button
              type="button"
              onClick={onGoToRegisterEmployee}
              style={{
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                padding: '0.9rem 2rem',
                borderRadius: '30px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 6px 20px rgba(5, 150, 105, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <span>Start for free</span>
              <ArrowRight size={18} />
            </button>

            <button
              type="button"
              onClick={onGoToLogin}
              style={{
                background: '#ffffff',
                color: '#064e3b',
                border: '1.5px solid #cbd5e1',
                fontWeight: 700,
                fontSize: '1rem',
                padding: '0.85rem 1.75rem',
                borderRadius: '30px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = '#059669')}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = '#cbd5e1')}
            >
              Sign In to Portal
            </button>

            <button
              type="button"
              onClick={onGoToRegisterWorkplace}
              style={{
                background: 'transparent',
                color: '#047857',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Register Company
            </button>
          </div>

          {/* Social Proof & Security Badges */}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#047857', fontWeight: 600 }}>
              <CheckCircle2 size={16} color="#059669" />
              <span>100% Anti-Spoofing</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#047857', fontWeight: 600 }}>
              <CheckCircle2 size={16} color="#059669" />
              <span>GPS Geofence Protected</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#047857', fontWeight: 600 }}>
              <CheckCircle2 size={16} color="#059669" />
              <span>Multi-Workplace Supported</span>
            </div>
          </div>
        </div>

        {/* Right Column: Floating Assistant & Interactive Portal Card (Direct Dubsado match!) */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          {/* Background Ambient Glow */}
          <div style={{
            position: 'absolute',
            width: '420px',
            height: '420px',
            background: 'radial-gradient(circle, rgba(52, 211, 153, 0.25) 0%, rgba(240, 253, 244, 0) 70%)',
            borderRadius: '50%',
            top: '5%',
            right: '5%',
            zIndex: 1,
            pointerEvents: 'none'
          }} />

          {/* Main Floating Card Widget */}
          <div style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            maxWidth: '430px',
            background: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 20px 45px -10px rgba(5, 150, 105, 0.18), 0 0 1px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0'
          }}>
            {/* Top Green Banner (Exact Dubsado "Hi there 👋" style) */}
            <div style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #064e3b 100%)',
              padding: '1.75rem 1.5rem',
              color: '#ffffff',
              position: 'relative'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>Hi there</span> <span>👋</span>
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, lineHeight: 1.4 }}>
                Platform status & live check-in portal:
                <br />
                <strong>GPS Geofencing Active • ML Biometrics Ready</strong>
              </div>

              {/* Decorative Subtle Circles */}
              <div style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                pointerEvents: 'none'
              }} />
            </div>

            {/* Body Content */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Card 1: Start an Attendance Check-in or Register */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '1.25rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
              }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.65rem' }}>
                  Quick Access Portal
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  {/* Stacked Avatar Circles */}
                  <div style={{ display: 'flex' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, border: '2px solid #fff' }}>
                      AS
                    </div>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, border: '2px solid #fff', marginLeft: '-8px' }}>
                      SC
                    </div>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, border: '2px solid #fff', marginLeft: '-8px' }}>
                      AD
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Attendance response time</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={13} /> Under 0.3 seconds
                    </div>
                  </div>
                </div>

                {/* Send us a message / Clock In Button */}
                <button
                  type="button"
                  onClick={onGoToLogin}
                  style={{
                    width: '100%',
                    background: '#34d399',
                    color: '#064e3b',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#10b981')}
                  onMouseOut={(e) => (e.currentTarget.style.background = '#34d399')}
                >
                  <Fingerprint size={16} />
                  <span>Clock In with Face Match</span>
                </button>
              </div>

              {/* Card 2: Status Indicator (Exact Dubsado "All Systems Operational") */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '0.9rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#047857' }}>
                    Status: All Systems Operational
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    OpenCV ML Port 5001 • Geofence Engine Online
                  </div>
                </div>
              </div>

              {/* Card 3: One-Click Demo Logins */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '1rem'
              }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Quick One-Click Test Demos:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => onQuickDemoLogin && onQuickDemoLogin('EMP001', 'Pass@123')}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0.45rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#1e293b',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    👤 Employee (Alice)
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickDemoLogin && onQuickDemoLogin('ADMIN001', 'Admin@123')}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0.45rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#1e293b',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    🏢 Admin (Sarah)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FLOATING CIRCULAR TOGGLE BUTTON IN BOTTOM RIGHT (Matching the green circle in the screenshot!) */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99 }}>
        <button
          type="button"
          onClick={() => setShowFloatingWidget(!showFloatingWidget)}
          title="Toggle Assistant"
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#34d399',
            color: '#064e3b',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(5, 150, 105, 0.35)',
            cursor: 'pointer',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <MessageSquare size={24} />
        </button>
      </div>
    </div>
  );
}
