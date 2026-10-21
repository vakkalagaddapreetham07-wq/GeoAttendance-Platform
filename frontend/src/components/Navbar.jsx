import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  MapPin,
  LayoutDashboard,
  ShieldAlert,
  Calendar,
  Settings,
  LogOut,
  Smartphone,
  UserCheck
} from 'lucide-react';

export default function Navbar({ currentTab, setCurrentTab }) {
  const { user, logout } = useAuth();

  if (!user) return null;

  const isSuperAdmin = user.role === 'superadmin';
  const isAdmin = user.role === 'admin';

  return (
    <header className="navbar">
      <div className="nav-inner">
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <img src="/logo.png" alt="GeoAttendance Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          <span>GeoAttendance</span>
          <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
            {isSuperAdmin ? 'Platform SuperAdmin' : isAdmin ? 'Workplace Admin' : 'Mobile App'}
          </span>
        </div>

        <nav>
          <ul className="nav-links">
            {isSuperAdmin ? (
              <>
                <li>
                  <button
                    className={`nav-btn ${currentTab === 'platform' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('platform')}
                  >
                    <LayoutDashboard size={16} />
                    <span>Workplaces</span>
                  </button>
                </li>
              </>
            ) : isAdmin ? (
              <>
                <li>
                  <button
                    className={`nav-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('dashboard')}
                  >
                    <LayoutDashboard size={16} />
                    <span>Analytics</span>
                  </button>
                </li>
                <li>
                  <button
                    className={`nav-btn ${currentTab === 'memberships' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('memberships')}
                  >
                    <UserCheck size={16} />
                    <span>Employees & Requests</span>
                  </button>
                </li>
                <li>
                  <button
                    className={`nav-btn ${currentTab === 'anomalies' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('anomalies')}
                  >
                    <ShieldAlert size={16} />
                    <span>Anomalies</span>
                  </button>
                </li>
                <li>
                  <button
                    className={`nav-btn ${currentTab === 'leaves' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('leaves')}
                  >
                    <Calendar size={16} />
                    <span>Leaves</span>
                  </button>
                </li>
                <li>
                  <button
                    className={`nav-btn ${currentTab === 'geofence' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('geofence')}
                  >
                    <Settings size={16} />
                    <span>Geofence & Shift</span>
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <button
                    className={`nav-btn ${currentTab === 'portal' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('portal')}
                  >
                    <Smartphone size={16} />
                    <span>Attendance & GPS</span>
                  </button>
                </li>
                <li>
                  <button
                    className={`nav-btn ${currentTab === 'workplaces' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('workplaces')}
                  >
                    <MapPin size={16} />
                    <span>Workplace</span>
                  </button>
                </li>
                <li>
                  <button
                    className={`nav-btn ${currentTab === 'leaves' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('leaves')}
                  >
                    <Calendar size={16} />
                    <span>My Leaves</span>
                  </button>
                </li>
              </>
            )}

            <li>
              <div className="user-badge">
                <UserCheck size={14} color="#2563eb" />
                <span>{user.name} ({user.employeeId})</span>
              </div>
            </li>

            <li>
              <button
                className="nav-btn"
                onClick={logout}
                title="Log Out"
                style={{ color: '#ef4444' }}
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
