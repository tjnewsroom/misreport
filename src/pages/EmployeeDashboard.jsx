import { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { useData } from '../hooks/useData';
import { todayStr, fmtDate, shiftDateISO } from '../lib/utils';
import DailyEntry from '../components/DailyEntry';
import BreaksTab from '../components/BreaksTab';
import ScoreTab from '../components/ScoreTab';
import HistoryTab from '../components/HistoryTab';
import ShiftChatbot from '../components/ShiftChatbot';
import { GRANTABLE_FEATURES } from '../data/features';
import { Overview, TodayWork, AttendancePage } from '../components/AdminPages1';
import { ShiftPlanner, StaffManagement, ShiftRequests } from '../components/AdminPages2';
import { TaskSearchPage, QualityPage, ReliabilityPage, ProducersPage, ReportPage } from '../components/AdminPages3';
import { LiveNow, EmployeeMonthlyPage, NewsTypeMonthlyPage } from '../components/AdminPages4';

const EMP_TABS = [
  { id: 'daily',   label: 'Daily',   icon: '📋' },
  { id: 'breaks',  label: 'Breaks',  icon: '☕' },
  { id: 'score',   label: 'Score',   icon: '⭐' },
  { id: 'history', label: 'History', icon: '📅' },
  { id: 'search',  label: 'Search',  icon: '🔍' },
];

// ◀ Prev / Next ▶ day arrows — client feedback: easier navigation across all menus
function DateNav({ selDate, onChange }) {
  const atMax = selDate >= todayStr();
  const btn = (dir, disabled) => (
    <button
      onClick={() => onChange(shiftDateISO(selDate, dir))}
      disabled={disabled}
      title={dir < 0 ? 'Previous day' : 'Next day'}
      style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--brd)',
        background:'var(--surf2)', color: disabled ? 'var(--dim)' : 'var(--txt)',
        cursor: disabled ? 'default' : 'pointer', fontSize:13, fontWeight:700, flexShrink:0 }}>
      {dir < 0 ? '◀' : '▶'}
    </button>
  );
  return <>{btn(-1, false)}{btn(1, atMax)}</>;
}

export default function EmployeeDashboard({ user, empCode, onSignOut, onSwitchAdmin, isAdmin, theme, onToggleTheme }) {
  const { state, dispatch } = useApp();
  const { loadAll } = useData();
  const [activeTab, setActiveTab] = useState('daily');
  const [selDate, setSelDate] = useState(todayStr());
  const [loading, setLoading] = useState(!state.emps.length);

  useEffect(() => {
    // Always load to get latest features from DB
    loadAll().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!state.emps.length || !empCode) return;
    const emp = state.emps.find(e => String(e.id) === String(empCode));
    if (emp) dispatch({ type: 'SET_ME', payload: emp });
  }, [state.emps, empCode]);

  if (loading) return (
    <div className="loader-screen">
      <img src={`${import.meta.env.BASE_URL}tj-logo.png`} alt="TamilJanam" style={{height:60,width:'auto',objectFit:'contain',marginBottom:4}}/>
      <div className="loader-spinner" />
      <div className="loader-text">Loading workspace…</div>
    </div>
  );

  const me = state.me;
  const empId = me?.id;
  const empName = me?.name || user?.email;
  const dept = me?.dept || 'NLE Editor';

  // ── Admin features granted to this employee (Staff Mgmt → Edit) ──
const grantedFeatures = GRANTABLE_FEATURES.filter(f => (me?.features || []).includes(f.id));
  console.log('🔑 me.features:', me?.features, '| granted:', grantedFeatures.map(f=>f.id));
  return (
    <div className="app-layout" style={{paddingBottom:'var(--mob-nav-h,0px)'}}>
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-brand" style={{display:'flex',alignItems:'center'}}>
          <img src={`${import.meta.env.BASE_URL}tj-logo.png`} alt="TamilJanam" style={{height:34,width:'auto',objectFit:'contain'}}/>
        </div>
        <div className="topbar-center">
          <div className="emp-info-topbar">
            <span className="topbar-empname">{empName}</span>
            <span className="topbar-dept">{dept}</span>
          </div>
        </div>
        {/* Desktop right controls */}
        <div className="topbar-right tb-desktop-only">
          <DateNav selDate={selDate} onChange={setSelDate} />
          <input type="date" className="date-picker" value={selDate}
            max={todayStr()} onChange={e => setSelDate(e.target.value)} />
          <button className="icon-btn" onClick={onToggleTheme}>{theme==='dark'?'☀️':'🌙'}</button>
          {isAdmin && onSwitchAdmin && (
            <button className="btn btn-sm btn-outline" onClick={onSwitchAdmin}>🛡 Admin</button>
          )}
          <button className="btn btn-s btn-sm" onClick={onSignOut}
            style={{color:'var(--red)',borderColor:'var(--red)',background:'var(--rl)'}}>
            ⏻ Sign Out
          </button>
        </div>
      </header>

      {/* ── Desktop sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-avatar">
          <div className="avatar-circle">{empName?.[0]?.toUpperCase()||'?'}</div>
          <div className="avatar-name">{empName}</div>
          <div className="avatar-dept">{dept}</div>
        </div>
        {/* Date picker inside sidebar on desktop */}
        <div style={{padding:'10px 12px',borderBottom:'1px solid var(--brd)'}}>
          <div className="lbl">Date</div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <DateNav selDate={selDate} onChange={setSelDate} />
            <input type="date" className="inp inp-sm" value={selDate}
              max={todayStr()} onChange={e => setSelDate(e.target.value)} style={{flex:1,minWidth:0}}/>
          </div>
        </div>
        <nav className="sidebar-nav">
          {EMP_TABS.map(t => (
            <button key={t.id} className={`nav-item ${activeTab===t.id?'active':''}`}
              onClick={() => setActiveTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
            </button>
          ))}
          {grantedFeatures.length > 0 && (
            <div className="nav-section">
              <div className="nav-section-label">Admin Access</div>
              {grantedFeatures.map(t => (
                <button key={t.id} className={`nav-item ${activeTab===t.id?'active':''}`}
                  onClick={() => setActiveTab(t.id)}>
                  <span className="nav-icon">{t.icon}</span>
                  <span className="nav-label">{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-date">{fmtDate(selDate)}</div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        {/* Mobile date picker — inside content area, always visible */}
        <div className="mob-date-bar">
          <DateNav selDate={selDate} onChange={setSelDate} />
          <input type="date" className="inp inp-sm" value={selDate}
            max={todayStr()} onChange={e => setSelDate(e.target.value)}
            style={{flex:1}}/>
          <button className="icon-btn" onClick={onToggleTheme}>{theme==='dark'?'☀️':'🌙'}</button>
          {isAdmin && onSwitchAdmin && (
            <button className="btn btn-sm btn-outline" onClick={onSwitchAdmin}>🛡</button>
          )}
        </div>

        {!empId ? (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'60vh',gap:12,color:'var(--mt)'}}>
            <div style={{fontSize:48}}>🔍</div>
            <div style={{fontWeight:700,color:'var(--txt)'}}>Employee record not linked</div>
            <div style={{fontSize:'.82rem',textAlign:'center',maxWidth:340,lineHeight:1.6}}>
              <code style={{background:'var(--surf2)',padding:'2px 6px',borderRadius:4}}>app_metadata.emp_id</code> = <strong>{empCode||'(not set)'}</strong>
            </div>
          </div>
        ) : (
          <>
            {activeTab==='daily'   && <DailyEntry empId={empId} selDate={selDate} dept={dept} isAdmin={false}/>}
            {activeTab==='breaks'  && <BreaksTab empId={empId} selDate={selDate}/>}
            {activeTab==='score'   && <ScoreTab empId={empId} dept={dept} selDate={selDate}/>}
            {activeTab==='history' && <HistoryTab empId={empId} dept={dept} selDate={selDate} onDateChange={setSelDate} onGoToDaily={()=>setActiveTab('daily')}/>}
            {activeTab==='search'  && <TaskSearchPage empId={empId}/>}

            {/* ── Granted admin features (only render if access granted) ── */}
            {grantedFeatures.some(f=>f.id==='overview')  && activeTab==='overview'  && <Overview selDate={selDate}/>}
            {grantedFeatures.some(f=>f.id==='live')      && activeTab==='live'      && <LiveNow selDate={selDate}/>}
            {grantedFeatures.some(f=>f.id==='today')     && activeTab==='today'     && <TodayWork selDate={selDate}/>}
            {grantedFeatures.some(f=>f.id==='att')       && activeTab==='att'       && <AttendancePage selDate={selDate}/>}
            {grantedFeatures.some(f=>f.id==='shifts')    && activeTab==='shifts'    && <ShiftPlanner selDate={selDate}/>}
            {grantedFeatures.some(f=>f.id==='shiftreq')  && activeTab==='shiftreq'  && <ShiftRequests/>}
            {grantedFeatures.some(f=>f.id==='staff')     && activeTab==='staff'     && <StaffManagement/>}
            {grantedFeatures.some(f=>f.id==='quality')   && activeTab==='quality'   && <QualityPage selDate={selDate}/>}
            {grantedFeatures.some(f=>f.id==='rel')       && activeTab==='rel'       && <ReliabilityPage selDate={selDate}/>}
            {grantedFeatures.some(f=>f.id==='prod')      && activeTab==='prod'      && <ProducersPage selDate={selDate}/>}
            {grantedFeatures.some(f=>f.id==='report')    && activeTab==='report'    && <ReportPage selDate={selDate}/>}
            {grantedFeatures.some(f=>f.id==='empmonth')  && activeTab==='empmonth'  && <EmployeeMonthlyPage/>}
            {grantedFeatures.some(f=>f.id==='typemonth') && activeTab==='typemonth' && <NewsTypeMonthlyPage/>}
          </>
        )}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="mob-nav">
        <div className="mob-wrap">
          {EMP_TABS.map(t => (
            <button key={t.id} className={`mob-btn ${activeTab===t.id?'active':''}`}
              onClick={() => setActiveTab(t.id)}>
              <span className="mi">{t.icon}</span>
              {t.label}
            </button>
          ))}
          {grantedFeatures.map(t => (
            <button key={t.id} className={`mob-btn ${activeTab===t.id?'active':''}`}
              onClick={() => setActiveTab(t.id)}
              style={{color:activeTab===t.id?undefined:'var(--purple)'}}>
              <span className="mi">{t.icon}</span>
              {t.label}
            </button>
          ))}
          {isAdmin && onSwitchAdmin && (
            <button className="mob-btn" onClick={onSwitchAdmin}
              style={{color:'var(--purple)'}}>
              <span className="mi">🛡</span>
              Admin
            </button>
          )}
          <button className="mob-btn" onClick={onSignOut}
            style={{color:'var(--red)'}}>
            <span className="mi">⏻</span>
            Sign Out
          </button>
        </div>
      </nav>

      {me && <ShiftChatbot me={me} isVisible={true}/>}
    </div>
  );
}
