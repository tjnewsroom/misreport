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

const buildNavSections = (hasEmpRecord) => {
  const sections = [];
  if (hasEmpRecord) {
    sections.push({ label:'My Work', items:[
      { id:'daily',   label:'Daily Entry',  icon:'📋' },
      { id:'breaks',  label:'Breaks',       icon:'☕' },
      { id:'score',   label:'My Score',     icon:'⭐' },
      { id:'history', label:'History',      icon:'📅' },
    ]});
  }
  sections.push({ label:'Analytics', items:[
    { id:'overview', label:'Overview',    icon:'📊' },
    { id:'today',    label:"Today's Work",icon:'🗒' },
    { id:'att',      label:'Attendance',  icon:'🕒' },
  ]});
  sections.push({ label:'Management', items:[
    { id:'shifts',   label:'Shift Planner',  icon:'📅' },
    { id:'shiftreq', label:'Shift Requests', icon:'🔄' },
    { id:'staff',    label:'Staff Mgmt',     icon:'👥' },
    { id:'quality',  label:'Quality',        icon:'🎯' },
    { id:'rel',      label:'Reliability',    icon:'📈' },
    { id:'prod',     label:'Producers/VO',   icon:'🎙' },
  ]});
  sections.push({ label:'Reports', items:[
    { id:'search', label:'Task Search', icon:'🔍' },
    { id:'report', label:'Full Report', icon:'📄' },
  ]});
  return sections;
};

// Flat list for mobile bottom nav
const MOB_TABS = [
  { id:'overview',  label:'Overview',  icon:'📊' },
  { id:'today',     label:'Today',     icon:'🗒' },
  { id:'shifts',    label:'Shifts',    icon:'📅' },
  { id:'shiftreq',  label:'Shift Req', icon:'🔄' },
  { id:'staff',     label:'Staff',     icon:'👥' },
  { id:'quality',   label:'Quality',   icon:'🎯' },
  { id:'search',    label:'Search',    icon:'🔍' },
  { id:'report',    label:'Report',    icon:'📄' },
];

export default function AdminDashboard({ user, empCode, onSignOut, onSwitchEmployee, hasEmpRecord, theme, onToggleTheme }) {
  const { state, dispatch } = useApp();
  const { loadAll } = useData();
  const [activeTab, setActiveTab] = useState(hasEmpRecord ? 'daily' : 'overview');
  const [selDate, setSelDate] = useState(todayStr());
  const [loading, setLoading] = useState(!state.emps.length);
  const [dbStatus, setDbStatus] = useState(state.emps.length ? 'ok' : 'loading');

  const navSections = buildNavSections(hasEmpRecord);

  useEffect(() => {
    if (state.emps.length) { setDbStatus('ok'); return; }
    loadAll()
      .then(() => setDbStatus('ok'))
      .catch(() => setDbStatus('error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!state.emps.length || !empCode || state.me) return;
    const emp = state.emps.find(e => String(e.id) === String(empCode));
    if (emp) dispatch({ type: 'SET_ME', payload: emp });
  }, [state.emps, empCode]);

  if (loading) return (
    <div className="loader-screen">
      <img src={`${import.meta.env.BASE_URL}tj-logo.png`} alt="TamilJanam" style={{height:60,width:'auto',objectFit:'contain',marginBottom:4}}/>
      <div className="loader-spinner" />
      <div className="loader-text">Loading admin workspace…</div>
    </div>
  );

  const me = state.me;
  const empId = me?.id;
  const dept = me?.dept || 'NLE Editor';
  const adminName = me?.name || user?.user_metadata?.emp_name || user?.email;

  return (
    <div className="app-layout" style={{paddingBottom:'var(--mob-nav-h,0px)'}}>
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-brand" style={{display:'flex',alignItems:'center',gap:8}}>
          <img src={`${import.meta.env.BASE_URL}tj-logo.png`} alt="TamilJanam" style={{height:34,width:'auto',objectFit:'contain'}}/>
          <span className="admin-badge">Admin</span>
        </div>
        <div className="topbar-center">
          <div className={`db-status ${dbStatus}`}>
            <span className={`db-dot ${dbStatus==='loading'?'ld':dbStatus==='error'?'er':''}`}/>
            <span className="tb-desktop-only">
              {dbStatus==='ok'?`Connected · ${state.emps.length} staff`:dbStatus==='error'?'DB Error':'Connecting…'}
            </span>
          </div>
        </div>
        <div className="topbar-right tb-desktop-only">
          <input type="date" className="date-picker" value={selDate}
            onChange={e => setSelDate(e.target.value)} />
          <button className="icon-btn" onClick={onToggleTheme}>{theme==='dark'?'☀️':'🌙'}</button>
          <button className="btn btn-sm btn-outline" onClick={onSwitchEmployee}>👤 Employee View</button>
          <button className="btn btn-s btn-sm" onClick={onSignOut}
            style={{color:'var(--red)',borderColor:'var(--red)',background:'var(--rl)'}}>
            ⏻ Sign Out
          </button>
        </div>
      </header>

      {/* ── Desktop Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-avatar">
          <div className="avatar-circle" style={{fontSize:18}}>🛡</div>
          <div className="avatar-name">{adminName}</div>
          <div className="avatar-dept">Administrator</div>
        </div>
        <div style={{padding:'10px 12px',borderBottom:'1px solid var(--brd)'}}>
          <div className="lbl">Date</div>
          <input type="date" className="inp inp-sm" value={selDate}
            onChange={e => setSelDate(e.target.value)} style={{width:'100%'}}/>
        </div>
        <nav className="sidebar-nav">
          {navSections.map(section => (
            <div key={section.label} className="nav-section">
              <div className="nav-section-label">{section.label}</div>
              {section.items.map(t => (
                <button key={t.id}
                  className={`nav-item ${activeTab===t.id?'active':''}`}
                  onClick={() => setActiveTab(t.id)}>
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

      {/* ── Main ── */}
      <main className="main-content">
        {/* Mobile controls bar */}
        <div className="mob-date-bar">
          <input type="date" className="inp inp-sm" value={selDate}
            onChange={e => setSelDate(e.target.value)} style={{flex:1}}/>
          <button className="icon-btn" onClick={onToggleTheme}>{theme==='dark'?'☀️':'🌙'}</button>
          <button className="btn btn-sm btn-outline" onClick={onSwitchEmployee}
            style={{fontSize:11}}>👤 Emp</button>
        </div>

        {hasEmpRecord && empId && activeTab==='daily'   && <DailyEntry empId={empId} selDate={selDate} dept={dept} isAdmin={true}/>}
        {hasEmpRecord && empId && activeTab==='breaks'  && <BreaksTab empId={empId} selDate={selDate}/>}
        {hasEmpRecord && empId && activeTab==='score'   && <ScoreTab empId={empId} dept={dept} selDate={selDate}/>}
        {hasEmpRecord && empId && activeTab==='history' && <HistoryTab empId={empId} dept={dept} selDate={selDate} onDateChange={setSelDate} onGoToDaily={()=>setActiveTab('daily')}/>}
        {activeTab==='overview'  && <Overview selDate={selDate}/>}
        {activeTab==='today'     && <TodayWork selDate={selDate}/>}
        {activeTab==='att'       && <AttendancePage selDate={selDate}/>}
        {activeTab==='shifts'    && <ShiftPlanner selDate={selDate}/>}
        {activeTab==='shiftreq'  && <ShiftRequests/>}
        {activeTab==='staff'     && <StaffManagement/>}
        {activeTab==='quality'   && <QualityPage selDate={selDate}/>}
        {activeTab==='rel'       && <ReliabilityPage selDate={selDate}/>}
        {activeTab==='prod'      && <ProducersPage selDate={selDate}/>}
        {activeTab==='search'    && <TaskSearchPage/>}
        {activeTab==='report'    && <ReportPage selDate={selDate}/>}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="mob-nav">
        <div className="mob-wrap">
          {MOB_TABS.map(t => (
            <button key={t.id} className={`mob-btn ${activeTab===t.id?'active':''}`}
              onClick={() => setActiveTab(t.id)}>
              <span className="mi">{t.icon}</span>
              {t.label}
            </button>
          ))}
          {/* More button shows current non-pinned tab label */}
          <button className="mob-btn" onClick={onSwitchEmployee}
            style={{color:'var(--green)'}}>
            <span className="mi">👤</span>
            My View
          </button>
          <button className="mob-btn" onClick={onSignOut} style={{color:'var(--red)'}}>
            <span className="mi">⏻</span>
            Sign Out
          </button>
        </div>
      </nav>
    </div>
  );
}
