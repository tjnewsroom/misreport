import { useApp } from '../hooks/useApp';
import { useData } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import { BREAK_TYPES } from '../data/constants';
import { fmtDate, tdiff, fmtMin } from '../lib/utils';

export default function BreaksTab({ empId, selDate }) {
  const { state, dispatch } = useApp();
  const { saveBreakItem, deleteBreak } = useData();
  const toast = useToast();

  const breaks = state.breaks[empId]?.[selDate] || [];
  const totalBreak = breaks.reduce((s,b)=>s+(tdiff(b.start,b.end)||0),0);

  const updateBreaks = (newBreaks) => {
    dispatch({ type:'UPDATE_BREAKS', payload:{ empId, date:selDate, items:newBreaks }});
  };

  const addBreak = () => {
    updateBreaks([...breaks, { type:'lunch', start:'', end:'' }]);
  };

  const updateField = (idx, field, val) => {
    updateBreaks(breaks.map((b,i)=>i===idx?{...b,[field]:val}:b));
  };

  const saveB = async (idx) => {
    const b = breaks[idx];
    const ok = await saveBreakItem(empId, selDate, b);
    if (ok) toast('✓ Break saved');
  };

  const deleteB = async (idx) => {
    const b = breaks[idx];
    const ok = await deleteBreak(b);
    if (ok) {
      updateBreaks(breaks.filter((_,i)=>i!==idx));
      toast('✓ Deleted');
    }
  };

  return (
    <div>
      <div className="sec-hdr">
        <div>
          <div className="sec-title">Break / Lunch</div>
          <div className="sec-sub">{fmtDate(selDate)}</div>
        </div>
      </div>
      <div className="card">
        <button className="btn btn-p" style={{ width:'100%', padding:10, marginBottom:14 }} onClick={addBreak}>＋ Add Break</button>
        {breaks.map((b,i) => {
          const bt = BREAK_TYPES.find(x=>x.key===b.type)||BREAK_TYPES[0];
          const mins = tdiff(b.start, b.end);
          return (
            <div key={i} className="brk-row">
              <span style={{ fontSize:18 }}>{bt.icon}</span>
              <select className="inp inp-sm" style={{ flex:1, maxWidth:140 }} value={b.type} onChange={e=>updateField(i,'type',e.target.value)}>
                {BREAK_TYPES.map(x=><option key={x.key} value={x.key}>{x.icon} {x.label}</option>)}
              </select>
              <input type="time" className="inp inp-sm" value={b.start||''} style={{ width:110 }} onChange={e=>updateField(i,'start',e.target.value)} />
              <span style={{ color:'var(--mt)', fontWeight:600 }}>→</span>
              <input type="time" className="inp inp-sm" value={b.end||''} style={{ width:110 }} onChange={e=>updateField(i,'end',e.target.value)} />
              {mins !== null && <span style={{ fontSize:12, fontWeight:700, color:bt.color, fontFamily:"'JetBrains Mono'" }}>{fmtMin(mins)}</span>}
              <button className="btn btn-p btn-sm" onClick={()=>saveB(i)}>💾</button>
              <button className="btn btn-d btn-sm" onClick={()=>deleteB(i)}>🗑</button>
            </div>
          );
        })}
        {totalBreak > 0 && <div style={{ marginTop:10, textAlign:'center', fontSize:13, fontWeight:600, color:'var(--amber)' }}>Total Break Time: {fmtMin(totalBreak)}</div>}
      </div>
    </div>
  );
}
