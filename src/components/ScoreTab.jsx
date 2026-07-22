import { useApp } from '../hooks/useApp';
import { calcScore, perfBadge, lastNMonths, monthLabel } from '../lib/utils';
import MiniLineChart from './MiniLineChart';

export default function ScoreTab({ empId, dept }) {
  const { state } = useApp();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const sc = calcScore(empId, dept, monthKey, state.daily, state.prodDaily, state.quality, state.reliability);
  const b = perfBadge(sc.final);
  const R=44, circ=2*Math.PI*R, dash=circ*sc.final/100;

  // Last 6 months trend — reuses the same calcScore engine, just looped across months.
  const months = lastNMonths(6);
  const trend = months.map(m => calcScore(empId, dept, m, state.daily, state.prodDaily, state.quality, state.reliability).final);

  return (
    <div>
      <div className="sec-hdr">
        <div>
          <div className="sec-title">My Performance Score</div>
          <div className="sec-sub">Month: {monthKey} · Set by admin</div>
        </div>
      </div>
      <div className="card" style={{ textAlign:'center' }}>
        <div className="ring-wrap" style={{ marginBottom:16 }}>
          <svg width="110" height="110" viewBox="0 0 110 110">
            <circle cx="55" cy="55" r={R} fill="none" stroke="var(--surf2)" strokeWidth="10"/>
            <circle cx="55" cy="55" r={R} fill="none" stroke={b.color} strokeWidth="10"
              strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"/>
          </svg>
          <div className="ring-inner">
            <div style={{ fontSize:24, fontWeight:800, fontFamily:"'JetBrains Mono'", color:b.color }}>{sc.final}</div>
            <div style={{ fontSize:10, color:'var(--mt)' }}>/100</div>
          </div>
        </div>
        <div style={{ background:b.bg, color:b.color, padding:'5px 18px', borderRadius:100, fontSize:13, fontWeight:600, display:'inline-flex', alignItems:'center', gap:6, marginBottom:20 }}>{b.icon} {b.label}</div>
      </div>
      <div className="sg">
        {[{l:'Quality',v:sc.qualityScore,c:'var(--green)'},{l:'Output',v:sc.outputScore,c:'var(--blue)'},{l:'Reliability',v:sc.reliScore,c:'var(--amber)'},{l:'Creativity',v:sc.creativityScore,c:'var(--purple)'}].map(s=>(
          <div key={s.l} className="sc"><div className="sv" style={{ color:s.c }}>{s.v}</div><div className="sl">{s.l}</div></div>
        ))}
      </div>

      {/* ── How the score works (client feedback #2: make score easier to understand) ── */}
      <div className="card" style={{ marginTop:16 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>🧮 How your score is calculated</div>
        {[
          { l:'Quality', pct:40, v:sc.qualityScore, c:'var(--green)', d:'Starts at 100. Each error logged by admin deducts points (major −5 to −10, minor −2 to −3).' },
          { l:'Output', pct:30, v:sc.outputScore, c:'var(--blue)', d:'Based on your total weighted points this month — every item you log adds its weight (e.g. Package ×25).' },
          { l:'Reliability', pct:20, v:sc.reliScore, c:'var(--amber)', d:'Admin rates you 0–10 monthly on delivery, emergencies, teamwork, night shifts and pressure handling.' },
          { l:'Creativity', pct:10, v:sc.creativityScore, c:'var(--purple)', d:'Admin rating (0–10) for creative contribution, scaled to 100.' },
        ].map(r => (
          <div key={r.l} style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
              <span style={{ fontSize:12, fontWeight:700, color:r.c }}>{r.l} · {r.pct}% of final</span>
              <span style={{ fontSize:12, fontWeight:700, fontFamily:"'JetBrains Mono'", color:r.c }}>{r.v} → +{Math.round(r.v*r.pct/100)} pts</span>
            </div>
            <div style={{ height:6, borderRadius:3, background:'var(--surf2)', marginBottom:4 }}>
              <div style={{ height:'100%', width:`${r.v}%`, borderRadius:3, background:r.c }} />
            </div>
            <div style={{ fontSize:11, color:'var(--mt)', lineHeight:1.5 }}>{r.d}</div>
          </div>
        ))}
        <div style={{ background:'var(--surf2)', borderRadius:8, padding:'8px 12px', fontSize:11, color:'var(--mt)', fontFamily:"'JetBrains Mono'" }}>
          Final = Quality×0.4 + Output×0.3 + Reliability×0.2 + Creativity×0.1 = <strong style={{ color:'var(--txt)' }}>{sc.final}/100</strong>
        </div>
      </div>
      <div className="card" style={{ marginTop:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--txt)', marginBottom:12 }}>📈 6-Month Trend</div>
        <MiniLineChart data={trend} labels={months.map(monthLabel)} color={b.color} max={100} />
      </div>
    </div>
  );
}
