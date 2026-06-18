import { useState, useEffect } from 'react';
import { sb } from './lib/supabase';
import { AppProvider } from './hooks/useApp';
import { ToastProvider } from './hooks/useToast';
import LoginPage from './pages/LoginPage';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';

function AppInner() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [userData, setUserData] = useState(null);
  const [screenView, setScreenView] = useState('auto');
  const [theme, setTheme] = useState(() => localStorage.getItem('tj_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('tj_theme', next);
  };

  const resolveUserData = (sess) => {
    if (!sess) return null;
    const user = sess.user;

    // ── DEBUG: print full user object so we can see the metadata structure ──
    console.log('🔐 Auth user object:', JSON.stringify(user, null, 2));
    console.log('📋 app_metadata:', user?.app_metadata);
    console.log('📋 user_metadata:', user?.user_metadata);

    const role = user?.app_metadata?.role || user?.user_metadata?.role || 'employee';
    const isAdmin = role === 'admin' || role === 'superadmin';

    // Try multiple possible field names for emp_code
    const empCode =
      user?.app_metadata?.emp_id ||      // ← confirmed field from Supabase
      user?.app_metadata?.emp_code ||
      user?.user_metadata?.emp_code ||
      user?.user_metadata?.employee_code ||
      user?.user_metadata?.empCode ||
      user?.user_metadata?.emp_id ||
      null;

    console.log('👤 Resolved role:', role, '| isAdmin:', isAdmin, '| empCode:', empCode);

    return { user, isAdmin, empCode, hasEmpRecord: !!empCode };
  };

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUserData(resolveUserData(sess));
      setAuthReady(true);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUserData(resolveUserData(sess));
      if (!sess) setScreenView('auto');
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (loginData) => {
    const sess = loginData?.session || loginData;
    const resolved = resolveUserData(sess);
    setSession(sess);
    setUserData(resolved);
    setScreenView('auto');
  };

  const handleSignOut = async () => {
    await sb.auth.signOut();
    setScreenView('auto');
  };

  if (!authReady) {
    return (
      <div className="loader-screen">
        <div className="loader-logo">📺</div>
        <div className="loader-brand">TamilJanam MIS</div>
        <div className="loader-spinner" />
      </div>
    );
  }

  if (!session) return <LoginPage onLogin={handleLogin} />;

  const { user, isAdmin, empCode, hasEmpRecord } = userData || {};

  const effectiveView = screenView === 'auto' ? (isAdmin ? 'admin' : 'employee') : screenView;

  if (effectiveView === 'admin' && isAdmin) {
    return (
      <AdminDashboard
        user={user}
        empCode={empCode}
        onSignOut={handleSignOut}
        onSwitchEmployee={() => setScreenView('employee')}
        hasEmpRecord={hasEmpRecord}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <EmployeeDashboard
      user={user}
      empCode={empCode}
      onSignOut={handleSignOut}
      onSwitchAdmin={isAdmin ? () => setScreenView('admin') : null}
      isAdmin={isAdmin}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </ToastProvider>
  );
}
