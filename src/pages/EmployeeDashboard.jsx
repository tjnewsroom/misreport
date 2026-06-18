import { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { useData } from '../hooks/useData';
import { todayStr, fmtDate } from '../lib/utils';
import DailyEntry from '../components/DailyEntry';
import BreaksTab from '../components/BreaksTab';
import ScoreTab from '../components/ScoreTab';
import HistoryTab from '../components/HistoryTab';
import ShiftChatbot from '../components/ShiftChatbot';
import { TaskSearchPage } from '../components/AdminPages3';

const EMP_TABS = [
  { id: 'daily',   label: 'Daily Entry', icon: '📋' },
  { id: 'breaks',  label: 'Breaks',      icon: '☕' },
  { id: 'score',   label: 'My Score',    icon: '⭐' },
  { id: 'history', label: 'History',     icon: '📅' },
  { id: 'search',  label: 'Task Search', icon: '🔍' },
];

export default function EmployeeDashboard({ user, empCode, onSignOut, onSwitchAdmin, isAdmin, theme, onToggleTheme }) {
  const { state, dispatch } = useApp();
  const { loadAll } = useData();
  const [activeTab, setActiveTab] = useState('daily');
  const [selDate, setSelDate] = useState(todayStr());
  const [loading, setLoading] = useState(!state.emps.length);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (state.emps.length) { setLoading(false); return; }
    loadAll().finally(() => setLoading(false));
  }, []);

  // Resolve me by empCode (app_metadata.emp_id)
  useEffect(() => {
    if (!state.emps.length || state.me) return;
    if (!empCode) return;
    const emp = state.emps.find(e => String(e.id) === String(empCode));
    if (emp) {
      console.log('✅ Employee matched:', emp.name, emp.dept);
      dispatch({ type: 'SET_ME', payload: emp });
    } else {
      console.warn('⚠️ empCode', empCode, 'not found in emps list:', state.emps.map(e=>e.id));
    }
  }, [state.emps, empCode]);

  const handleTabChange = (tab) => { setActiveTab(tab); setMobileNavOpen(false); };

  if (loading) return (
    <div className="loader-screen">
      <div className="loader-logo">📺</div>
      <div className="loader-brand">TamilJanam MIS</div>
      <div className="loader-spinner" />
      <div className="loader-text">Loading workspace…</div>
    </div>
  );

  const me = state.me;
  const empId = me?.id;
  const empName = me?.name || user?.email;
  const dept = me?.dept || 'NLE Editor';

  return (
    <div className="app-layout">
      <header className="topbar">
        <button className="mobile-menu-btn" onClick={() => setMobileNavOpen(s => !s)}>☰</button>
        <div className="topbar-brand" style={{display:'flex',alignItems:'center'}}>
          <img src="/tj-logo.png" alt="TamilJanam" style={{height:36,width:'auto',objectFit:'contain'}}/>
        </div>
        <div className="topbar-center">
          <div className="emp-info-topbar">
            <span className="topbar-empname">{empName}</span>
            <span className="topbar-dept">{dept}</span>
          </div>
        </div>
        <div className="topbar-right">
          <input type="date" className="date-picker" value={selDate}
            max={todayStr()} onChange={e => setSelDate(e.target.value)} />
          <button className="icon-btn" onClick={onToggleTheme}>{theme==='dark'?'☀️':'🌙'}</button>
          {isAdmin && onSwitchAdmin && (
            <button className="btn btn-sm btn-outline" onClick={onSwitchAdmin}>🛡 Admin View</button>
          )}
          <button className="icon-btn" onClick={onSignOut} title="Sign out">⎋</button>
        </div>
      </header>

      {mobileNavOpen && <div className="nav-overlay" onClick={() => setMobileNavOpen(false)} />}

      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="sidebar-avatar">
          <div className="avatar-circle">{empName?.[0]?.toUpperCase()||'?'}</div>
          <div className="avatar-name">{empName}</div>
          <div className="avatar-dept">{dept}</div>
        </div>
        <nav className="sidebar-nav">
          {EMP_TABS.map(t => (
            <button key={t.id} className={`nav-item ${activeTab===t.id?'active':''}`} onClick={()=>handleTabChange(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><div className="sidebar-date">{fmtDate(selDate)}</div></div>
      </aside>

      <main className="main-content">
        {!empId ? (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'60vh',gap:12,color:'var(--mt)'}}>
            <div style={{fontSize:48}}>🔍</div>
            <div style={{fontWeight:700,color:'var(--txt)',fontSize:'1rem'}}>Employee record not linked</div>
            <div style={{fontSize:'.82rem',textAlign:'center',maxWidth:340,lineHeight:1.6}}>
              Your <code style={{background:'var(--surf2)',padding:'2px 6px',borderRadius:4}}>app_metadata.emp_id</code> = <strong>{empCode||'(not set)'}</strong><br/>
              Available IDs: {state.emps.slice(0,5).map(e=>e.id).join(', ')}…
            </div>
          </div>
        ) : (
          <>
            {activeTab==='daily'   && <DailyEntry empId={empId} selDate={selDate} dept={dept} isAdmin={false}/>}
            {activeTab==='breaks'  && <BreaksTab empId={empId} selDate={selDate}/>}
            {activeTab==='score'   && <ScoreTab empId={empId} dept={dept} selDate={selDate}/>}
            {activeTab==='history' && <HistoryTab empId={empId} dept={dept} selDate={selDate} onDateChange={setSelDate} onGoToDaily={()=>setActiveTab('daily')}/>}
            {activeTab==='search'  && <TaskSearchPage empId={empId}/>}
          </>
        )}
      </main>

      {me && <ShiftChatbot me={me} isVisible={true}/>}
    </div>
  );
}
