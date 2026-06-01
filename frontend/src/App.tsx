import React, { useState, useEffect } from 'react';
import { Login } from './pages/Login';
import { Patients } from './pages/Patients';
import { Profile } from './pages/Profile';
import { Portal } from './pages/Portal';
import { HeartScore } from './pages/HeartScore';
import { ctApi } from './lib/api';
import { User } from './types/fhir';

interface RouteState {
  page: string;
  params: Record<string, unknown>;
}

export const App: React.FC = () => {
  const [route, setRoute] = useState<RouteState>({ page: 'login', params: {} });
  const [fading, setFading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Set up unauthorized handler & initial load session
  useEffect(() => {
    const user = ctApi.getCurrentUser();
    setCurrentUser(user);

    // Register global unauthorized event listener
    const handleUnauthorized = () => {
      setCurrentUser(null);
      localStorage.removeItem('ct_route');
      setRoute({ page: 'login', params: {} });
    };

    const handleLogout = () => {
      ctApi.clearSession();
      setCurrentUser(null);
      localStorage.removeItem('ct_route');
      setRoute({ page: 'login', params: {} });
    };

    window.addEventListener('ct-unauthorized', handleUnauthorized);
    (window as unknown as { ctLogout?: () => void }).ctLogout = handleLogout;

    if (!user) {
      setRoute({ page: 'login', params: {} });
    } else {
      const saved = localStorage.getItem('ct_route');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as RouteState;
          setRoute(parsed);
        } catch {
          setRoute({ page: 'patients', params: {} });
        }
      } else {
        setRoute({ page: 'patients', params: {} });
      }
    }

    return () => {
      window.removeEventListener('ct-unauthorized', handleUnauthorized);
      delete (window as unknown as { ctLogout?: () => void }).ctLogout;
    };
  }, []);

  const navigate = (page: string, params: Record<string, unknown> = {}) => {
    setFading(true);
    setTimeout(() => {
      const next = { page, params };
      setRoute(next);
      localStorage.setItem('ct_route', JSON.stringify(next));
      setFading(false);
    }, 130);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'patient') {
      navigate('portal');
    } else {
      navigate('patients');
    }
  };

  return (
    <div style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.13s ease' }}>
      {route.page === 'login' && (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
      {route.page === 'patients' && (
        <Patients navigate={navigate} currentUser={currentUser} />
      )}
      
      {route.page === 'profile' && (
        <Profile
          patientId={Number(route.params.patientId)}
          navigate={navigate}
          currentUser={currentUser}
        />
      )}
      {route.page === 'portal' && (
        <Portal navigate={navigate} currentUser={currentUser} />
      )}
      {route.page === 'heart' && (
        <HeartScore
          patientId={Number(route.params.patientId)}
          navigate={navigate}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
