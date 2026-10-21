import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import OtpVerification from './pages/OtpVerification';
import EmployeePortal from './pages/EmployeePortal';
import AdminDashboard from './pages/AdminDashboard';
import AnomalyManagement from './pages/AnomalyManagement';
import LeaveManagement from './pages/LeaveManagement';
import GeofenceSettings from './pages/GeofenceSettings';

import PlatformDashboard from './pages/PlatformDashboard';
import WorkplaceRegistration from './pages/WorkplaceRegistration';
import WorkplaceSelection from './pages/WorkplaceSelection';
import MembershipRequests from './pages/MembershipRequests';
import EmployeeRegistration from './pages/EmployeeRegistration';
import LandingHero from './components/LandingHero';

function AppContent() {
  const { user, isAuthenticated, login } = useAuth();
  const [currentTab, setCurrentTab] = useState('portal'); // portal, dashboard, memberships, anomalies, leaves, geofence, workplaces, platform
  const [authView, setAuthView] = useState('landing'); // landing (Dubsado UI/UX), login, otp, register_workplace, register_employee

  // Set default tab on role switch
  React.useEffect(() => {
    if (user?.role === 'superadmin') {
      setCurrentTab('platform');
    } else if (user?.role === 'admin') {
      setCurrentTab('dashboard');
    } else if (user?.role === 'employee') {
      setCurrentTab('portal');
    }
  }, [user?.role]);

  if (!isAuthenticated) {
    if (authView === 'landing') {
      return (
        <LandingHero
          onGoToLogin={() => setAuthView('login')}
          onGoToRegisterEmployee={() => setAuthView('register_employee')}
          onGoToRegisterWorkplace={() => setAuthView('register_workplace')}
          onQuickDemoLogin={async (id, pass) => {
            try {
              await login(id, pass);
            } catch (err) {
              setAuthView('login');
            }
          }}
        />
      );
    }
    if (authView === 'otp') {
      return <OtpVerification onBackToLogin={() => setAuthView('login')} />;
    }
    if (authView === 'register_workplace') {
      return <WorkplaceRegistration onBackToLogin={() => setAuthView('landing')} />;
    }
    if (authView === 'register_employee') {
      return <EmployeeRegistration onBackToLogin={() => setAuthView('landing')} />;
    }
    return (
      <Login
        onBackToHome={() => setAuthView('landing')}
        onGoToOtp={() => setAuthView('otp')}
        onGoToRegisterWorkplace={() => setAuthView('register_workplace')}
        onGoToRegisterEmployee={() => setAuthView('register_employee')}
      />
    );
  }

  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="app-container">
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="main-content">
        {isSuperAdmin ? (
          <>
            {currentTab === 'platform' && <PlatformDashboard />}
            {currentTab !== 'platform' && <PlatformDashboard />}
          </>
        ) : isAdmin ? (
          <>
            {currentTab === 'dashboard' && <AdminDashboard />}
            {currentTab === 'memberships' && <MembershipRequests />}
            {currentTab === 'anomalies' && <AnomalyManagement />}
            {currentTab === 'leaves' && <LeaveManagement />}
            {currentTab === 'geofence' && <GeofenceSettings />}
            {!['dashboard', 'memberships', 'anomalies', 'leaves', 'geofence'].includes(currentTab) && (
              <AdminDashboard />
            )}
          </>
        ) : (
          <>
            {currentTab === 'portal' && (
              <EmployeePortal onGoToWorkplaces={() => setCurrentTab('workplaces')} />
            )}
            {currentTab === 'workplaces' && (
              <WorkplaceSelection onNavigateToPortal={() => setCurrentTab('portal')} />
            )}
            {currentTab === 'leaves' && <LeaveManagement />}
            {!['portal', 'workplaces', 'leaves'].includes(currentTab) && (
              <EmployeePortal onGoToWorkplaces={() => setCurrentTab('workplaces')} />
            )}
          </>
        )}
      </main>

      <footer style={{ textAlign: 'center', padding: '1.25rem', borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.8rem', background: '#ffffff', marginTop: 'auto' }}>
        Geofence Attendance Management System with ML Anomaly Detection | Academic Implementation &copy; 2026
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
