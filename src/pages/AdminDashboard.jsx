import { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { useData } from '../hooks/useData';
import { todayStr, fmtDate } from '../lib/utils';
import DailyEntry from '../components/DailyEntry';
import BreaksTab from '../components/BreaksTab';
import ScoreTab from '../components/ScoreTab';
import HistoryTab from '../components/HistoryTab';
import { Overview, TodayWork, AttendancePage } from '../components/AdminPages1';
import { ShiftPlanner, StaffManagement, ShiftRequests } from '../components/AdminPages2';
import { QualityPage, ReliabilityPage, ProducersPage, TaskSearchPage, ReportPage } from '../components/AdminPages3';

const BASE_URL = import.meta.env.BASE_URL;

const buildNavSections = (hasEmpRecord) => {
  const sections = [];
  if (hasEmpRecord) {
    sections.push({
      label: 'My Work',
      items: [
        { id: 'daily',   label: 'Daily Entry',  icon: '📋' },
        { id: 'breaks',  label: 'Breaks',        icon: '☕' },
        { id: 'score',   label: 'My Score',      icon: '⭐' },
        { id: 'history', label: 'History',        icon: '📅' },
      ]
    });
  }
  sections.push({
    label: 'Analytics',
    items: [
      { id: 'overview', label: 'Overview',      icon: '📊' },
      { id: 'today',    label: "Today's Work",  icon: '🗒' },
      { id: 'att',      label: 'Attendance',    icon: '🕒' },
    ]
  });
  sections.push({
    label: 'Management',
    items: [
      { id: 'shifts',   label: 'Shift Planner',   icon: '📅' },
      { id: 'shiftreq', label: 'Shift Requests',  icon: '🔄' },
      { id: 'staff',    label: 'Staff Mgmt',      icon: '👥' },
      { id: 'quality',  label: 'Quality',          icon: '🎯' },
      { id: 'rel',      label: 'Reliability',      icon: '📈' },
      { id: 'prod',     label: 'Producers/VO',     icon: '🎙' },
    ]
  });
  sections.push({
    label: 'Reports',
    items: [
      { id: 'search', label: 'Task Search', icon: '🔍' },
      { id: 'report', label: 'Full Report', icon: '📄' },
    ]
  });
  return sections;
};

export default function AdminDashboard({ user, empCode, onSignOut, onSwitchEmployee, hasEmpRecord, theme, onToggleTheme }) {
  const { state, dispatch } = useApp();
  const { loadAll } = useData();
  const [activeTab, setActiveTab] = useState(hasEmpRecord ? 'daily' : 'overview');
  const [selDate, setSelDate] = useState(todayStr());
  const [loading, setLoading] = useState(!state.emps.length);
  const [dbStatus, setDbStatus] = useState(state.emps.length ? 'ok' : 'loading');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navSections = buildNavSections(hasEmpRecord);

  useEffect(() => {
    if (state.emps.length) return; // already loaded (e.g. came back from employee view)
    loadAll()
      .then(() => setDbStatus('ok'))
      .catch(() => setDbStatus('error'))
      .finally(() => setLoading(false));
  }, []);

  // Resolve me for admin who has emp record
  useEffect(() => {
    if (!state.emps.length || !empCode || state.me) return;
    const emp = state.emps.find(e => String(e.id) === String(empCode));
    if (emp) dispatch({ type: 'SET_ME', payload: emp });
  }, [state.emps, empCode]);

  const handleTabChange = (tab) => { setActiveTab(tab); setMobileNavOpen(false); };

  if (loading) {
    return (
      <div className="loader-screen">
        <img src={`${BASE_URL}tj-logo.png`} alt="TamilJanam" style={{height:60,width:"auto",objectFit:"contain",marginBottom:4}}/>
        <div className="loader-spinner" />
        <div className="loader-text">Loading admin workspace…</div>
      </div>
    );
  }

  const me = state.me;
  const empId = me?.id;
  const dept = me?.dept || 'NLE Editor';
  const adminName = me?.name || user?.user_metadata?.emp_name || user?.email;

  return (
    <div className="app-layout">
      <header className="topbar">
        <button className="mobile-menu-btn" onClick={() => setMobileNavOpen(s => !s)}>☰</button>
        <div className="topbar-brand" style={{display:'flex',alignItems:'center',gap:10}}>
          <img src={`${BASE_URL}tj-logo.png`} alt="TamilJanam" style={{height:36,width:'auto',objectFit:'contain'}}/>
          <span className="admin-badge">Admin</span>
        </div>
        <div className="topbar-center">
          <div className={`db-status ${dbStatus}`}>
            <span className="db-dot" />
            {dbStatus === 'ok' ? `Connected · ${state.emps.length} staff` : dbStatus === 'error' ? 'DB Error' : 'Connecting…'}
          </div>
        </div>
        <div className="topbar-right">
          <input type="date" className="date-picker" value={selDate}
            onChange={e => setSelDate(e.target.value)} />
          <button className="icon-btn" onClick={onToggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-sm btn-outline" onClick={onSwitchEmployee}>👤 Employee View</button>

<button className="btn btn-s btn-sm" onClick={onSignOut} style={{color:'var(--red)',borderColor:'var(--red)',background:'var(--rl)',gap:6}} title="Sign out">
  ⏻ Sign Out
</button>
Change it in both files — same line in both.

        </div>
      </header>

      {mobileNavOpen && <div className="nav-overlay" onClick={() => setMobileNavOpen(false)} />}

      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="sidebar-avatar">
          <div className="avatar-circle" style={{ fontSize: 18 }}>🛡</div>
          <div className="avatar-name">{adminName}</div>
          <div className="avatar-dept">Administrator</div>
        </div>
        <nav className="sidebar-nav">
          {navSections.map(section => (
            <div key={section.label} className="nav-section">
              <div className="nav-section-label">{section.label}</div>
              {section.items.map(t => (
                <button key={t.id}
                  className={`nav-item ${activeTab === t.id ? 'active' : ''}`}
                  onClick={() => handleTabChange(t.id)}>
                  <span className="nav-icon">{t.icon}</span>
                  <span className="nav-label">{t.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-date">{fmtDate(selDate)}</div>
        </div>
      </aside>

      <main className="main-content">
        {/* My Work — only if admin has own emp record */}
        {hasEmpRecord && empId && activeTab === 'daily'   && <DailyEntry empId={empId} selDate={selDate} dept={dept} isAdmin={true} />}
        {hasEmpRecord && empId && activeTab === 'breaks'  && <BreaksTab empId={empId} selDate={selDate} />}
        {hasEmpRecord && empId && activeTab === 'score'   && <ScoreTab empId={empId} dept={dept} selDate={selDate} />}
        {hasEmpRecord && empId && activeTab === 'history' && <HistoryTab empId={empId} dept={dept} selDate={selDate} onDateChange={setSelDate} onGoToDaily={()=>setActiveTab('daily')} />}

        {/* Analytics */}
        {activeTab === 'overview'  && <Overview selDate={selDate} />}
        {activeTab === 'today'     && <TodayWork selDate={selDate} />}
        {activeTab === 'att'       && <AttendancePage selDate={selDate} />}

        {/* Management */}
        {activeTab === 'shifts'    && <ShiftPlanner selDate={selDate} />}
        {activeTab === 'shiftreq'  && <ShiftRequests />}
        {activeTab === 'staff'     && <StaffManagement />}
        {activeTab === 'quality'   && <QualityPage selDate={selDate} />}
        {activeTab === 'rel'       && <ReliabilityPage selDate={selDate} />}
        {activeTab === 'prod'      && <ProducersPage selDate={selDate} />}

        {/* Reports */}
        {activeTab === 'search'    && <TaskSearchPage />}
        {activeTab === 'report'    && <ReportPage selDate={selDate} />}
      </main>
    </div>
  );
}
