import { useState, useCallback } from 'react';
import { useApp } from '../hooks/useApp';
import { useData } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import { NEWS_TYPES, PROD_FIELDS, VO_FIELDS } from '../data/constants';
import { todayStr, fmtDate, tdiff, fmtMin } from '../lib/utils';

function AttendanceCard({ empId, dept, selDate }) {
  const { state, dispatch } = useApp();
  const { recordIN, recordOUT } = useData();
  const toast = useToast();
  const [welcomeInfo, setWelcomeInfo] = useState(null);

  const att = state.attendance[empId]?.[selDate] || {};
  const inT = att.in_time || null;
  const outT = att.out_time || null;
  const inLoc = att.in_location || null;
  const outLoc = att.out_location || null;
  const hrs = inT && outT ? tdiff(inT, outT) : null;
  const isToday = selDate === todayStr();

  const handleIN = async () => {
    const { now } = await recordIN(empId, dept);
    setWelcomeInfo(now);
  };
  const handleOUT = async () => {
    await recordOUT(empId);
  };

  const inBg = inT ? 'rgba(5,150,105,.08)' : 'var(--surf2)';
  const inBrd = inT ? 'var(--green)' : 'rgba(5,150,105,.25)';
  const outBg = outT ? 'rgba(220,38,38,.06)' : 'var(--surf2)';
  const outBrd = outT ? 'var(--red)' : 'rgba(220,38,38,.25)';

  return (
    <div className="card" style={{ marginBottom:16, background: inT&&outT ? 'var(--gl)' : inT ? 'rgba(251,191,36,.08)' : 'var(--surf)', border: `2px solid ${inT&&outT ? 'var(--green)' : inT ? 'var(--amber)' : 'var(--brd)'}` }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700 }}>Overall Attendance</div>
          <div style={{ fontSize:11, color:'var(--mt)' }}>{isToday ? 'Today · '+selDate : selDate}</div>
        </div>
        {hrs !== null && (
          <div style={{ background: hrs>=480 ? 'var(--gl)' : hrs>=240 ? 'var(--al)' : 'var(--rl)', color: hrs>=480 ? 'var(--green)' : hrs>=240 ? 'var(--amber)' : 'var(--red)', padding:'5px 14px', borderRadius:100, fontSize:12, fontWeight:700, fontFamily:"'JetBrains Mono'" }}>
            ⏱ {fmtMin(hrs)} · {hrs>=480 ? 'Full Day' : hrs>=240 ? 'Half Day' : 'Short'}
          </div>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {/* IN */}
        <div style={{ borderRadius:12, border:`2px solid ${inBrd}`, background:inBg, padding:16, textAlign:'center' }}>
          {inT ? (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--green)', letterSpacing:'.1em', marginBottom:6 }}>✅ CHECKED IN</div>
              <div style={{ fontSize:28, fontWeight:800, fontFamily:"'JetBrains Mono'", color:'var(--green)', marginBottom:6 }}>{inT}</div>
              {inLoc ? (
                <a href={`https://maps.google.com/?q=${inLoc}`} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'var(--blue)', textDecoration:'none', background:'var(--bl)', padding:'3px 10px', borderRadius:100, fontWeight:600 }}>📍 View on Map</a>
              ) : <span style={{ fontSize:10, color:'var(--mt)' }}>📍 No location</span>}
            </>
          ) : (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--mt)', letterSpacing:'.1em', marginBottom:10 }}>CHECK IN</div>
              <div style={{ fontSize:32, marginBottom:10 }}>🟢</div>
              {isToday ? (
                <button onClick={handleIN} style={{ background:'var(--green)', border:'none', color:'#fff', borderRadius:10, padding:13, fontSize:15, fontWeight:800, cursor:'pointer', width:'100%', boxShadow:'0 4px 12px rgba(5,150,105,.4)' }}>IN ▶</button>
              ) : <div style={{ fontSize:12, color:'var(--dim)' }}>Not marked</div>}
            </>
          )}
        </div>
        {/* OUT */}
        <div style={{ borderRadius:12, border:`2px solid ${outBrd}`, background:outBg, padding:16, textAlign:'center' }}>
          {outT ? (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--red)', letterSpacing:'.1em', marginBottom:6 }}>✅ CHECKED OUT</div>
              <div style={{ fontSize:28, fontWeight:800, fontFamily:"'JetBrains Mono'", color:'var(--red)', marginBottom:6 }}>{outT}</div>
              {outLoc ? (
                <a href={`https://maps.google.com/?q=${outLoc}`} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'var(--blue)', textDecoration:'none', background:'var(--bl)', padding:'3px 10px', borderRadius:100, fontWeight:600 }}>📍 View on Map</a>
              ) : <span style={{ fontSize:10, color:'var(--mt)' }}>📍 No location</span>}
              {isToday && <div style={{ marginTop:10 }}><button onClick={handleOUT} style={{ background:'transparent', border:'1px solid var(--red)', color:'var(--red)', borderRadius:7, padding:'5px 14px', fontSize:11, fontWeight:600, cursor:'pointer', width:'100%' }}>🔄 Update OUT Time</button></div>}
            </>
          ) : (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--mt)', letterSpacing:'.1em', marginBottom:10 }}>CHECK OUT</div>
              <div style={{ fontSize:32, marginBottom:10 }}>🔴</div>
              {isToday ? (
                <button onClick={handleOUT} style={{ background:'var(--red)', border:'none', color:'#fff', borderRadius:10, padding:13, fontSize:15, fontWeight:800, cursor:'pointer', width:'100%', boxShadow:'0 4px 12px rgba(220,38,38,.35)' }}>OUT ◀</button>
              ) : <div style={{ fontSize:12, color:'var(--dim)' }}>Not marked</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DailyEntry({ empId, dept, selDate }) {
  const { state, dispatch } = useApp();
  const { saveNLEItem, deleteNLEItem, saveProdEntry } = useData();
  const toast = useToast();
  const [search, setSearch] = useState('');

  const items = (state.daily[empId]?.[selDate] || []);
  const prodData = state.prodDaily[empId]?.[selDate] || {};
  const fields = dept === 'News Producer' ? PROD_FIELDS : VO_FIELDS;

  const nleCurrentTime = () => new Date().toTimeString().slice(0,5);

  const updateItem = (idx, field, val) => {
    const updated = items.map((it, i) => i === idx ? { ...it, [field]: val } : it);
    // Validate time
    if ((field==='startTime'||field==='endTime') && val && selDate===todayStr() && val > nleCurrentTime()) {
      toast('⚠️ Time cannot be greater than current time.', 'er');
      return;
    }
    if (field==='endTime' && updated[idx].startTime && val && val <= updated[idx].startTime) {
      toast('⚠️ OUT time must be ≥ IN time.', 'er');
      return;
    }
    dispatch({ type:'UPDATE_DAILY_ITEM', payload:{ empId, date:selDate, items:updated }});
  };

  const setNow = (idx, field) => {
    const now = nleCurrentTime();
    updateItem(idx, field, now);
  };

  const addItem = async () => {
    if (items.length) {
      const last = items[items.length-1];
      if (!last.startTime || !last.endTime) {
        toast('⚠️ IN and OUT time required for Task '+items.length+' before adding new.', 'er');
        return;
      }
      // Save last item and get back the _id from DB
      const savedOk = await saveNLEItem(empId, selDate, last);
      if (!savedOk) return;
      // ✅ Update state with the _id that saveNLEItem wrote onto `last`
      // so subsequent saves UPDATE instead of INSERT (no duplicates)
      const updatedItems = items.map((it, i) =>
        i === items.length - 1 ? { ...it, _id: last._id } : it
      );
      const newItems = [...updatedItems, { type:'vo_sot', desc:'', startTime:'', endTime:'', manualMins:0 }];
      dispatch({ type:'UPDATE_DAILY_ITEM', payload:{ empId, date:selDate, items:newItems }});
    } else {
      const newItems = [{ type:'vo_sot', desc:'', startTime:'', endTime:'', manualMins:0 }];
      dispatch({ type:'UPDATE_DAILY_ITEM', payload:{ empId, date:selDate, items:newItems }});
    }
  };

  const saveItem = async (idx) => {
    const it = items[idx];
    if (!it.startTime || !it.endTime) { toast('⚠️ IN and OUT time required.', 'er'); return; }
    if (it.endTime <= it.startTime) { toast('⚠️ OUT must be ≥ IN.', 'er'); return; }
    const ok = await saveNLEItem(empId, selDate, it);
    if (ok) {
      // ✅ Propagate _id back into state so future saves always UPDATE not INSERT
      if (it._id) {
        const updatedItems = items.map((item, i) =>
          i === idx ? { ...item, _id: it._id } : item
        );
        dispatch({ type:'UPDATE_DAILY_ITEM', payload:{ empId, date:selDate, items:updatedItems }});
      }
      toast('✓ Saved');
    }
  };

  const deleteItem = async (idx) => {
    const it = items[idx];
    const ok = await deleteNLEItem(it);
    if (ok) {
      const newItems = items.filter((_,i) => i !== idx);
      dispatch({ type:'UPDATE_DAILY_ITEM', payload:{ empId, date:selDate, items:newItems }});
      toast('✓ Deleted');
    }
  };

  const updateProd = (key, val) => {
    dispatch({ type:'UPDATE_PROD_DAILY', payload:{ empId, date:selDate, data:{ ...prodData, [key]:val }}});
  };

  const adjProd = (key, delta) => {
    const cur = parseInt(prodData[key]) || 0;
    updateProd(key, Math.max(0, cur+delta));
  };

  const saveProd = async () => {
    const ok = await saveProdEntry(empId, selDate, dept, prodData);
    if (ok) toast('✓ Saved');
  };

  const visibleItems = search
    ? items.filter(it => {
        const nt = NEWS_TYPES.find(n=>n.key===it.type)||NEWS_TYPES[0];
        return [nt.label, it.desc||'', it.type].join(' ').toLowerCase().includes(search.toLowerCase());
      })
    : items;

  return (
    <div>
      <div className="sec-hdr">
        <div>
          <div className="sec-title">Daily Work Entry</div>
          <div className="sec-sub">{fmtDate(selDate)}</div>
        </div>
        <span style={{ background:'var(--bl)', color:'var(--blue)', padding:'4px 12px', borderRadius:6, fontSize:12, fontWeight:600, fontFamily:"'JetBrains Mono'" }}>{selDate}</span>
      </div>

      <AttendanceCard empId={empId} dept={dept} selDate={selDate} />

      {/* NLE Editor */}
      {dept === 'NLE Editor' && (
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--mt)', letterSpacing:'.06em' }}>NEWS ITEMS EDITED</div>
            {items.length > 0 && (
              <input className="inp inp-sm" placeholder="🔍 Search items..." value={search} onChange={e=>setSearch(e.target.value)} style={{ maxWidth:220 }} />
            )}
          </div>
          {items.length === 0 ? (
            <div style={{ textAlign:'center', padding:32, color:'var(--mt)' }}><div style={{ fontSize:36, marginBottom:8 }}>📰</div><div>No items yet. Add one below.</div></div>
          ) : (
            visibleItems.map((it, vi) => {
              const realIdx = items.indexOf(it);
              const nt = NEWS_TYPES.find(n=>n.key===it.type)||NEWS_TYPES[0];
              const mins = tdiff(it.startTime, it.endTime);
              const prev = realIdx > 0 ? items[realIdx-1] : null;
              const gapMins = prev ? tdiff(prev.endTime, it.startTime) : null;
              return (
                <div key={realIdx}>
                  {gapMins > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', margin:'4px 0', background:'var(--al)', borderLeft:'3px solid var(--amber)', borderRadius:6 }}>
                      <span style={{ fontSize:11 }}>⏸</span>
                      <span style={{ fontSize:11, fontWeight:700, color:'var(--amber)', fontFamily:"'JetBrains Mono'" }}>Gap: {fmtMin(gapMins)}</span>
                      <span style={{ fontSize:10, color:'var(--mt)' }}>({prev.endTime} → {it.startTime})</span>
                    </div>
                  )}
                  <div className="ni-item">
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                      <div style={{ width:24, height:24, borderRadius:6, background:nt.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{realIdx+1}</div>
                      <select className="inp inp-sm" style={{ flex:1, maxWidth:180 }} value={it.type} onChange={e=>updateItem(realIdx,'type',e.target.value)}>
                        {NEWS_TYPES.map(n=><option key={n.key} value={n.key}>{n.icon} {n.label} ×{n.weight}</option>)}
                      </select>
                      <input className="inp inp-sm" placeholder="Headline / Description" value={it.desc||''} style={{ flex:2, minWidth:160 }} onChange={e=>updateItem(realIdx,'desc',e.target.value)} />
                      <button className="btn btn-d btn-sm" onClick={()=>deleteItem(realIdx)}>🗑 Delete</button>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, background:'var(--surf)', border:`${!it.startTime?'2px solid var(--red)':'1px solid var(--brd)'}`, borderRadius:7, padding:'4px 8px' }}>
                        <span style={{ fontSize:10, fontWeight:700, color:!it.startTime?'var(--red)':'var(--mt)' }}>IN</span>
                        <input type="time" className="inp inp-sm" value={it.startTime||''} style={{ border:'none', background:'transparent', padding:'2px 4px', fontSize:12, width:88 }} onChange={e=>updateItem(realIdx,'startTime',e.target.value)} />
                        <button onClick={()=>setNow(realIdx,'startTime')} style={{ background:'var(--bl)', border:'none', borderRadius:5, padding:'2px 6px', fontSize:10, color:'var(--blue)', cursor:'pointer', fontWeight:700 }}>Now</button>
                      </div>
                      <span style={{ color:'var(--mt)' }}>→</span>
                      <div style={{ display:'flex', alignItems:'center', gap:4, background:'var(--surf)', border:`${!it.endTime?'2px solid var(--red)':'1px solid var(--brd)'}`, borderRadius:7, padding:'4px 8px' }}>
                        <span style={{ fontSize:10, fontWeight:700, color:!it.endTime?'var(--red)':'var(--mt)' }}>OUT</span>
                        <input type="time" className="inp inp-sm" value={it.endTime||''} style={{ border:'none', background:'transparent', padding:'2px 4px', fontSize:12, width:88 }} onChange={e=>updateItem(realIdx,'endTime',e.target.value)} />
                        <button onClick={()=>setNow(realIdx,'endTime')} style={{ background:'var(--gl)', border:'none', borderRadius:5, padding:'2px 6px', fontSize:10, color:'var(--green)', cursor:'pointer', fontWeight:700 }}>Now</button>
                      </div>
                      {mins !== null && <span style={{ fontSize:12, fontWeight:700, color:'var(--green)', fontFamily:"'JetBrains Mono'", background:'var(--gl)', padding:'3px 10px', borderRadius:6 }}>⏱ {fmtMin(mins)}</span>}
                      <button className="btn btn-p btn-sm" onClick={()=>saveItem(realIdx)}>💾 Save</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <button className="btn btn-p" style={{ width:'100%', padding:11, marginTop:6 }} onClick={addItem}>＋ Add News Item</button>
          {items.length > 0 && (() => {
            const tMins = items.reduce((s,it)=>s+(tdiff(it.startTime,it.endTime)??it.manualMins??0),0);
            const tWpts = items.reduce((s,it)=>{ const nt=NEWS_TYPES.find(n=>n.key===it.type)||{weight:1}; return s+nt.weight; },0);
            let totalGap=0;
            for(let i=1;i<items.length;i++){const g=tdiff(items[i-1].endTime,items[i].startTime);if(g>0)totalGap+=g;}
            return (
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--mt)', letterSpacing:'.06em', marginBottom:12 }}>TODAY'S SUMMARY</div>
                <div className="sg">
                  <div className="sc"><div className="sv" style={{ color:'var(--blue)' }}>{items.length}</div><div className="sl">News Items</div></div>
                  <div className="sc"><div className="sv" style={{ color:'var(--green)' }}>{fmtMin(tMins)}</div><div className="sl">Total Time</div></div>
                  <div className="sc"><div className="sv" style={{ color:'var(--amber)' }}>{tWpts}</div><div className="sl">Weighted Pts</div></div>
                  {totalGap>0 && <div className="sc"><div className="sv" style={{ color:'var(--red)' }}>{fmtMin(totalGap)}</div><div className="sl">Total Gap</div></div>}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Producer / VO */}
      {(dept === 'News Producer' || dept === 'Voice Over') && (
        <div className="card">
          <div style={{ fontSize:12, fontWeight:600, color:'var(--mt)', marginBottom:16, letterSpacing:'.06em' }}>{dept==='News Producer' ? '📋 PRODUCER ACTIVITIES' : '🎤 VOICE OVER ACTIVITIES'}</div>
          {fields.map(f => {
            const v = parseInt(prodData[f.key]) || 0;
            const txt = prodData[f.key+'_notes'] || '';
            return (
              <div key={f.key} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 0', borderBottom:'1px solid var(--brd)' }}>
                <span style={{ fontSize:20, flexShrink:0 }}>{f.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>{f.label}</div>
                  <div className="ctr" style={{ marginBottom:8 }}>
                    <button className="ctr-btn" onClick={()=>adjProd(f.key,-1)}>−</button>
                    <div className="ctr-val" style={{ color: v>0 ? f.color : 'var(--txt)' }}>{v}</div>
                    <button className="ctr-btn" onClick={()=>adjProd(f.key,1)}>+</button>
                  </div>
                  <input className="inp inp-sm" placeholder="Notes / details..." value={txt} onChange={e=>updateProd(f.key+'_notes',e.target.value)} />
                </div>
              </div>
            );
          })}
          <button className="btn btn-p" style={{ width:'100%', marginTop:14, padding:11 }} onClick={saveProd}>💾 Save Entry</button>
        </div>
      )}
    </div>
  );
}
