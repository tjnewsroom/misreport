import { useApp } from '../hooks/useApp';
import { calcScore, perfBadge } from '../lib/utils';

export default function ScoreTab({ empId, dept }) {
  const { state } = useApp();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const sc = calcScore(empId, dept, monthKey, state.daily, state.prodDaily, state.quality, state.reliability);
  const b = perfBadge(sc.final);
  const R=44, circ=2*Math.PI*R, dash=circ*sc.final/100;

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
    </div>
  );
}
