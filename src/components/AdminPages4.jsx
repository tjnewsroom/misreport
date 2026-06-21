import { useState, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import { NEWS_TYPES } from '../data/constants';
import { fmtMin, tdiff, todayStr, monthLabel, elapsedSince, calcScore, shortN } from '../lib/utils';
import MiniBarChart from './MiniBarChart';

const deptColors = { 'NLE Editor':'var(--blue)', 'News Producer':'var(--green)', 'Voice Over':'var(--purple)' };

// ── Live Now — who is currently clocked in, right now ───────────────────────
export function LiveNow({ selDate }) {
  const { state } = useApp();
  const [, setTick] = useState(0);
  // Re-render every 30s so elapsed times stay current without a full data refetch.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t+1), 30000);
    return () => clearInterval(id);
  }, []);

  const today = selDate || todayStr();
  const allE = state.emps.filter(e => e.is_active);

  const live = [];
  const checkedOut = [];
  const notIn = [];
  allE.forEach(e => {
    const att = state.attendance[e.id]?.[today];
    if (att?.in_time && !att?.out_time) live.push({ e, att });
    else if (att?.in_time && att?.out_time) checkedOut.push({ e, att });
    else notIn.push(e);
  });
  // Longest on-shift first
  live.sort((a,b) => (a.att.in_time||'') < (b.att.in_time||'') ? -1 : 1);

  return (
    <div style={{ padding:24 }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:'1.3rem', fontWeight:800, color:'var(--txt)', letterSpacing:'-.3px', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:9, height:9, borderRadius:'50%', background:'var(--green)', boxShadow:'0 0 0 3px rgba(15,155,110,.2)', display:'inline-block' }}/>
          Live Now
        </div>
        <div style={{ fontSize:'.82rem', color:'var(--mt)', marginTop:3 }}>{live.length} on duty · updates every 30s</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:12, marginBottom:28 }}>
        {live.length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:30, color:'var(--mt)', fontSize:13 }}>No one is currently clocked in.</div>
        )}
        {live.map(({ e, att }) => {
          const dc = deptColors[e.dept] || 'var(--blue)';
          return (
            <div key={e.id} style={{
              display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
              borderRadius:14, background:'var(--surf)', border:`1px solid ${dc}40`, boxShadow:'var(--sh)',
            }}>
              <div style={{
                width:40, height:40, borderRadius:10, flexShrink:0, background:`${dc}18`,
                border:`2px solid ${dc}`, display:'flex', alignItems:'center', justifyContent:'center',
                fontWeight:700, fontSize:15, color:dc,
              }}>{e.name[0]}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'.85rem', fontWeight:700, color:'var(--txt)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.name}</div>
                <div style={{ fontSize:'.7rem', color:'var(--mt)' }}>{e.dept}</div>
                <div style={{ display:'flex', gap:8, marginTop:4, alignItems:'center' }}>
                  <span style={{ fontSize:'.7rem', color:'var(--green)', fontWeight:700, fontFamily:"'JetBrains Mono'" }}>IN {att.in_time}</span>
                  <span style={{ fontSize:'.7rem', color:'var(--mt)' }}>·</span>
                  <span style={{ fontSize:'.7rem', color:'var(--amber)', fontWeight:700 }}>{elapsedSince(att.in_time)} ago</span>
                </div>
              </div>
              <div style={{ width:9, height:9, borderRadius:'50%', background:'var(--green)', boxShadow:'0 0 0 3px rgba(15,155,110,.2)', flexShrink:0 }}/>
            </div>
          );
        })}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ background:'var(--surf)', border:'1px solid var(--brd)', borderRadius:14, padding:16 }}>
          <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--mt)', marginBottom:10, textTransform:'uppercase', letterSpacing:'.05em' }}>Already Checked Out ({checkedOut.length})</div>
          {checkedOut.length === 0 && <div style={{ fontSize:12, color:'var(--dim)' }}>—</div>}
          {checkedOut.map(({ e, att }) => (
            <div key={e.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'5px 0', borderBottom:'1px solid var(--brd)' }}>
              <span>{shortN(e.name)}</span>
              <span style={{ color:'var(--mt)', fontFamily:"'JetBrains Mono'" }}>{att.in_time}–{att.out_time}</span>
            </div>
          ))}
        </div>
        <div style={{ background:'var(--surf)', border:'1px solid var(--brd)', borderRadius:14, padding:16 }}>
          <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--mt)', marginBottom:10, textTransform:'uppercase', letterSpacing:'.05em' }}>Not Clocked In Yet ({notIn.length})</div>
          {notIn.length === 0 && <div style={{ fontSize:12, color:'var(--dim)' }}>—</div>}
          {notIn.map(e => (
            <div key={e.id} style={{ fontSize:12, padding:'5px 0', borderBottom:'1px solid var(--brd)', color:'var(--dim)' }}>{shortN(e.name)} · {e.dept}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Employee Monthly Dashboard ───────────────────────────────────────────────
export function EmployeeMonthlyPage() {
  const { state } = useApp();
  const allE = state.emps.filter(e => e.is_active).sort((a,b) => a.name.localeCompare(b.name));
  const [empId, setEmpId] = useState(allE[0]?.id || '');
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);

  const emp = allE.find(e => e.id === empId);
  if (!emp) return <div style={{ padding:24, color:'var(--mt)' }}>No employees found.</div>;

  const dept = emp.dept;
  const days = Object.keys(state.daily[empId]||{}).filter(d => d.startsWith(month)).sort();
  const sc = calcScore(empId, dept, month, state.daily, state.prodDaily, state.quality, state.reliability);

  // Per-day breakdown for the month
  const [y, m] = month.split('-').map(Number);
  const numDays = new Date(y, m, 0).getDate();
  const dayRows = Array.from({ length: numDays }, (_, i) => {
    const d = `${month}-${String(i+1).padStart(2,'0')}`;
    const items = state.daily[empId]?.[d] || [];
    const att = state.attendance[empId]?.[d];
    const wpts = items.reduce((s,it) => { const nt = NEWS_TYPES.find(n=>n.key===it.type)||{weight:1}; return s+nt.weight; }, 0);
    const mins = items.reduce((s,it) => s + (tdiff(it.startTime,it.endTime) ?? it.manualMins ?? 0), 0);
    return { date:d, dayNum:i+1, items:items.length, wpts, mins, present: !!att?.in_time };
  });

  const presentDays = dayRows.filter(r => r.present).length;
  const totalItems = dayRows.reduce((s,r) => s+r.items, 0);
  const totalWpts = dayRows.reduce((s,r) => s+r.wpts, 0);
  const totalMins = dayRows.reduce((s,r) => s+r.mins, 0);

  const trendData = dayRows.map(r => r.wpts);
  const trendLabels = dayRows.map(r => String(r.dayNum));

  const statCards = [
    { icon:'📅', value:`${presentDays}/${numDays}`, label:'Days Present', color:'var(--purple)' },
    { icon:'📰', value:totalItems, label:'Total Items', color:'var(--blue)' },
    { icon:'⭐', value:totalWpts, label:'Weighted Pts', color:'var(--amber)' },
    { icon:'⏱', value:fmtMin(totalMins), label:'Total Time', color:'var(--green)' },
  ];

  return (
    <div style={{ padding:24 }}>
      <div style={{ marginBottom:20, display:'flex', flexWrap:'wrap', gap:12, alignItems:'flex-end', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:'1.3rem', fontWeight:800, color:'var(--txt)' }}>Employee Monthly Dashboard</div>
          <div style={{ fontSize:'.82rem', color:'var(--mt)', marginTop:3 }}>{emp.name} · {dept}</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <select className="inp inp-sm" value={empId} onChange={e=>setEmpId(e.target.value)} style={{ minWidth:160 }}>
            {allE.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input type="month" className="inp inp-sm" value={month} onChange={e=>setMonth(e.target.value)} />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:14, marginBottom:24 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background:'var(--surf)', border:'1px solid var(--brd)', borderRadius:14, padding:'16px 16px', boxShadow:'var(--sh)' }}>
            <div style={{ fontSize:20, marginBottom:8 }}>{s.icon}</div>
            <div style={{ fontSize:'1.5rem', fontWeight:800, color:s.color, fontFamily:"'JetBrains Mono'" }}>{s.value}</div>
            <div style={{ fontSize:'.72rem', color:'var(--mt)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom:24 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--txt)', marginBottom:12 }}>Daily Weighted Points — {monthLabel(month)} {y}</div>
        <MiniBarChart data={trendData} labels={trendLabels} color="var(--amber)" max={Math.max(10, ...trendData)} labelEvery={5} />
      </div>

      <div className="card" style={{ marginBottom:24 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--txt)', marginBottom:12 }}>Score Breakdown</div>
        <div className="sg">
          {[{l:'Quality',v:sc.qualityScore,c:'var(--green)'},{l:'Output',v:sc.outputScore,c:'var(--blue)'},{l:'Reliability',v:sc.reliScore,c:'var(--amber)'},{l:'Creativity',v:sc.creativityScore,c:'var(--purple)'},{l:'Final',v:sc.final,c:'var(--red)'}].map(s=>(
            <div key={s.l} className="sc"><div className="sv" style={{ color:s.c }}>{s.v}</div><div className="sl">{s.l}</div></div>
          ))}
        </div>
      </div>

      <div style={{ background:'var(--surf)', border:'1px solid var(--brd)', borderRadius:16, overflow:'hidden', boxShadow:'var(--sh)' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--brd)', fontSize:'.82rem', fontWeight:700 }}>Day-by-Day ({days.length} days with entries)</div>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl" style={{ width:'100%', fontSize:13 }}>
            <thead><tr><th>Date</th><th>Present</th><th>Items</th><th>Weighted Pts</th><th>Time</th></tr></thead>
            <tbody>
              {dayRows.filter(r => r.items > 0 || r.present).map(r => (
                <tr key={r.date}>
                  <td>{r.date}</td>
                  <td>{r.present ? '✓' : '—'}</td>
                  <td>{r.items}</td>
                  <td>{r.wpts}</td>
                  <td>{fmtMin(r.mins)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── News Type Monthly Dashboard ──────────────────────────────────────────────
export function NewsTypeMonthlyPage() {
  const { state } = useApp();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);

  // Aggregate every NLE entry across all employees for the selected month
  const byType = {};
  NEWS_TYPES.forEach(nt => { byType[nt.key] = { ...nt, count:0, wpts:0, mins:0, emps:new Set() }; });

  Object.entries(state.daily).forEach(([empId, byDate]) => {
    Object.entries(byDate).forEach(([date, items]) => {
      if (!date.startsWith(month)) return;
      items.forEach(it => {
        const bucket = byType[it.type] || (byType[it.type] = { key:it.type, label:it.type, color:'#64748b', weight:1, count:0, wpts:0, mins:0, emps:new Set() });
        bucket.count++;
        bucket.wpts += bucket.weight ?? 1;
        bucket.mins += tdiff(it.startTime, it.endTime) ?? it.manualMins ?? 0;
        bucket.emps.add(empId);
      });
    });
  });

  const rows = Object.values(byType).filter(t => t.count > 0).sort((a,b) => b.count - a.count);
  const totalCount = rows.reduce((s,r) => s+r.count, 0);
  const maxCount = Math.max(1, ...rows.map(r => r.count));

  return (
    <div style={{ padding:24 }}>
      <div style={{ marginBottom:20, display:'flex', flexWrap:'wrap', gap:12, alignItems:'flex-end', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:'1.3rem', fontWeight:800, color:'var(--txt)' }}>News Type Monthly Dashboard</div>
          <div style={{ fontSize:'.82rem', color:'var(--mt)', marginTop:3 }}>{totalCount} total items across all staff · {monthLabel(month)} {month.split('-')[0]}</div>
        </div>
        <input type="month" className="inp inp-sm" value={month} onChange={e=>setMonth(e.target.value)} />
      </div>

      {rows.length === 0 && (
        <div style={{ textAlign:'center', padding:40, color:'var(--mt)' }}>No NLE entries logged in this month.</div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {rows.map(r => {
          const pct = Math.round((r.count / maxCount) * 100);
          return (
            <div key={r.key} style={{ background:'var(--surf)', border:'1px solid var(--brd)', borderRadius:12, padding:'14px 16px', boxShadow:'var(--sh)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                <div style={{ fontWeight:700, fontSize:'.85rem', color:'var(--txt)', display:'flex', alignItems:'center', gap:6 }}>
                  <span>{r.icon}</span>{r.label}
                </div>
                <div style={{ display:'flex', gap:14, fontSize:'.72rem', color:'var(--mt)' }}>
                  <span><strong style={{ color:r.color, fontFamily:"'JetBrains Mono'" }}>{r.count}</strong> items</span>
                  <span><strong style={{ color:'var(--amber)', fontFamily:"'JetBrains Mono'" }}>{r.wpts}</strong> pts</span>
                  <span><strong style={{ color:'var(--green)', fontFamily:"'JetBrains Mono'" }}>{fmtMin(r.mins)}</strong></span>
                  <span>{r.emps.size} staff</span>
                </div>
              </div>
              <div style={{ height:6, background:'var(--surf2)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:r.color, borderRadius:3, transition:'width .4s' }}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
