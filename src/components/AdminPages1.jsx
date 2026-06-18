import { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { NEWS_TYPES, PROD_FIELDS, VO_FIELDS, DEPTS } from '../data/constants';
import { fmtDate, tdiff, fmtMin, shortN, deptColor } from '../lib/utils';

export function Overview({ selDate }) {
  const { state } = useApp();
  const allE = state.emps.filter(e=>e.is_active);
  let tNews=0, tMins=0, tWpts=0, submitted=0, presentCount=0;
  allE.forEach(e=>{
    const items=state.daily[e.id]?.[selDate]||[];
    const att=state.attendance[e.id]?.[selDate];
    if(att?.in_time) presentCount++;
    if(items.length) submitted++;
    items.forEach(it=>{
      const nt=NEWS_TYPES.find(n=>n.key===it.type)||{weight:1};
      tNews++; tWpts+=nt.weight;
      tMins+=tdiff(it.startTime,it.endTime)??it.manualMins??0;
    });
  });

  const deptBreakdown = DEPTS.map(dept=>{
    const emps=allE.filter(e=>e.dept===dept);
    const items=emps.flatMap(e=>state.daily[e.id]?.[selDate]||[]);
    const wpts=items.reduce((s,it)=>{const nt=NEWS_TYPES.find(n=>n.key===it.type)||{weight:1};return s+nt.weight;},0);
    const present=emps.filter(e=>state.attendance[e.id]?.[selDate]?.in_time).length;
    return {dept, total:emps.length, present, items:items.length, wpts};
  }).filter(d=>d.total>0);

  const statCards = [
    {icon:'📰', value:tNews, label:'News Items', color:'var(--blue)', bg:'var(--bl)', sub:'Total across all editors'},
    {icon:'⏱', value:fmtMin(tMins), label:'Edit Time', color:'var(--green)', bg:'var(--gl)', sub:'Combined edit duration'},
    {icon:'⭐', value:tWpts, label:'Weighted Pts', color:'var(--amber)', bg:'var(--al)', sub:'Quality-weighted score'},
    {icon:'🟢', value:presentCount, label:'Present Today', color:'var(--purple)', bg:'rgba(109,63,201,.08)', sub:`Out of ${allE.length} active staff`},
  ];

  const deptColors = {'NLE Editor':'var(--blue)','News Producer':'var(--green)','Voice Over':'var(--purple)'};

  return (
    <div style={{padding:24}}>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <div style={{fontSize:'1.3rem',fontWeight:800,color:'var(--txt)',letterSpacing:'-.3px'}}>{fmtDate(selDate)}</div>
        <div style={{fontSize:'.82rem',color:'var(--mt)',marginTop:3}}>Daily Overview · {allE.length} Active Staff</div>
      </div>

      {/* KPI Cards — generous spacing */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16,marginBottom:28}}>
        {statCards.map(s=>(
          <div key={s.label} style={{
            background:'var(--surf)', border:'1px solid var(--brd)',
            borderRadius:16, padding:'22px 20px',
            boxShadow:'var(--sh)', position:'relative', overflow:'hidden',
          }}>
            {/* coloured top strip */}
            <div style={{position:'absolute',top:0,left:0,right:0,height:4,background:s.color,opacity:.7,borderRadius:'16px 16px 0 0'}}/>
            <div style={{
              width:44,height:44,borderRadius:12,background:s.bg,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:22,marginBottom:14,
            }}>{s.icon}</div>
            <div style={{fontSize:'1.9rem',fontWeight:850,fontFamily:"'JetBrains Mono'",color:s.color,lineHeight:1,marginBottom:4}}>
              {s.value}
            </div>
            <div style={{fontSize:'.82rem',fontWeight:650,color:'var(--txt)',marginBottom:2}}>{s.label}</div>
            <div style={{fontSize:'.7rem',color:'var(--mt)'}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Dept breakdown row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12,marginBottom:28}}>
        {deptBreakdown.map(d=>{
          const dc=deptColors[d.dept]||'var(--blue)';
          const pct=Math.round((d.present/d.total)*100);
          return (
            <div key={d.dept} style={{
              background:'var(--surf)',border:`1px solid var(--brd)`,
              borderRadius:14,padding:'16px 18px',boxShadow:'var(--sh)',
              borderLeft:`4px solid ${dc}`,
            }}>
              <div style={{fontSize:'.72rem',fontWeight:700,color:dc,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>{d.dept}</div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:'1.3rem',fontWeight:800,color:'var(--txt)',fontFamily:"'JetBrains Mono'"}}>{d.present}<span style={{fontSize:'.75rem',color:'var(--mt)',fontWeight:400}}>/{d.total}</span></div>
                  <div style={{fontSize:'.65rem',color:'var(--mt)'}}>Present</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:'1.3rem',fontWeight:800,color:dc,fontFamily:"'JetBrains Mono'"}}>{d.items}</div>
                  <div style={{fontSize:'.65rem',color:'var(--mt)'}}>Tasks</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:'1.3rem',fontWeight:800,color:'var(--amber)',fontFamily:"'JetBrains Mono'"}}>{d.wpts}</div>
                  <div style={{fontSize:'.65rem',color:'var(--mt)'}}>Pts</div>
                </div>
              </div>
              {/* attendance bar */}
              <div style={{height:5,background:'var(--surf2)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct}%`,background:dc,borderRadius:3,transition:'width .4s'}}/>
              </div>
              <div style={{fontSize:'.65rem',color:'var(--mt)',marginTop:4,textAlign:'right'}}>{pct}% attendance</div>
            </div>
          );
        })}
      </div>

      {/* Staff grid — cleaner, more whitespace */}
      <div style={{background:'var(--surf)',border:'1px solid var(--brd)',borderRadius:16,overflow:'hidden',boxShadow:'var(--sh)'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--brd)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:'.82rem',fontWeight:700,color:'var(--txt)',letterSpacing:'.04em'}}>STAFF STATUS</div>
          <div style={{fontSize:'.75rem',color:'var(--mt)'}}>
            <span style={{color:'var(--green)',fontWeight:700}}>{submitted}</span> submitted · <span style={{color:'var(--mt)'}}>{allE.length-submitted} pending</span>
          </div>
        </div>
        <div style={{padding:16,display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
          {allE.map(e=>{
            const items=state.daily[e.id]?.[selDate]||[];
            const att=state.attendance[e.id]?.[selDate];
            const wpts=items.reduce((s,it)=>{const nt=NEWS_TYPES.find(n=>n.key===it.type)||{weight:1};return s+nt.weight;},0);
            const dc=deptColors[e.dept]||'var(--blue)';
            const isPresent=!!att?.in_time;
            return (
              <div key={e.id} style={{
                display:'flex',alignItems:'center',gap:12,
                padding:'12px 14px',borderRadius:12,
                background:items.length?'var(--surf2)':'var(--surf)',
                border:`1px solid ${items.length?dc+'40':'var(--brd)'}`,
                transition:'all .14s',
              }}>
                {/* Avatar */}
                <div style={{
                  width:38,height:38,borderRadius:10,flexShrink:0,
                  background:items.length?`${dc}18`:'var(--surf3)',
                  border:`2px solid ${items.length?dc:'var(--brd)'}`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontWeight:700,fontSize:14,color:items.length?dc:'var(--dim)',
                }}>{e.name[0]}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'.82rem',fontWeight:700,color:'var(--txt)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{shortN(e.name,14)}</div>
                  {items.length ? (
                    <div style={{display:'flex',gap:6,marginTop:3,flexWrap:'wrap'}}>
                      <span style={{fontSize:'.67rem',fontWeight:700,color:dc,background:`${dc}15`,padding:'1px 6px',borderRadius:4,fontFamily:"'JetBrains Mono'"}}>{items.length} items</span>
                      <span style={{fontSize:'.67rem',fontWeight:700,color:'var(--amber)',background:'var(--al)',padding:'1px 6px',borderRadius:4,fontFamily:"'JetBrains Mono'"}}>{wpts} pts</span>
                    </div>
                  ) : (
                    <div style={{fontSize:'.7rem',color:isPresent?'var(--amber)':'var(--dim)',marginTop:3}}>
                      {isPresent?'✓ Present · No entry yet':'Absent'}
                    </div>
                  )}
                </div>
                {/* status dot */}
                <div style={{
                  width:10,height:10,borderRadius:'50%',flexShrink:0,
                  background:items.length?'var(--green)':isPresent?'var(--amber)':'var(--dim)',
                  boxShadow:items.length?'0 0 0 3px rgba(15,155,110,.2)':isPresent?'0 0 0 3px rgba(201,125,14,.15)':'none',
                }}/>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TodayWork({ selDate }) {
  const { state } = useApp();
  const [search, setSearch] = useState('');
  const allE = state.emps.filter(e=>e.is_active);
  const term = search.toLowerCase().trim();

  return (
    <div>
      <div className="sec-hdr">
        <div><div className="sec-title">Today's Work</div><div className="sec-sub">{fmtDate(selDate)}</div></div>
      </div>
      <div style={{marginBottom:16}}>
        <input className="inp" placeholder="🔍 Search by name, type, or description..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:420}}/>
      </div>
      {DEPTS.map(dept=>{
        const dc=deptColor(dept);
        const emps=allE.filter(e=>e.dept===dept);
        if(!emps.length)return null;
        const visibleEmps = emps.filter(e=>{
          if(!term)return true;
          const empMatch=[e.name,e.id,dept].join(' ').toLowerCase().includes(term);
          if(empMatch)return true;
          const items=state.daily[e.id]?.[selDate]||[];
          return items.some(it=>{const nt=NEWS_TYPES.find(n=>n.key===it.type)||NEWS_TYPES[0];return [nt.label,it.desc||'',it.type].join(' ').toLowerCase().includes(term);});
        });
        if(!visibleEmps.length)return null;
        return (
          <div key={dept}>
            <div style={{fontSize:11,fontWeight:700,color:dc,letterSpacing:'.1em',margin:'18px 0 10px',padding:'5px 12px',background:`${dc}12`,borderRadius:6,borderLeft:`3px solid ${dc}`}}>{dept.toUpperCase()}</div>
            {visibleEmps.map(e=>{
              const items=state.daily[e.id]?.[selDate]||[];
              const mins=items.reduce((s,it)=>s+(tdiff(it.startTime,it.endTime)??it.manualMins??0),0);
              const wpts=items.reduce((s,it)=>{const nt=NEWS_TYPES.find(n=>n.key===it.type)||{weight:1};return s+nt.weight;},0);
              let totalGap=0;
              for(let i=1;i<items.length;i++){const g=tdiff(items[i-1].endTime,items[i].startTime);if(g>0)totalGap+=g;}
              const pd=state.prodDaily[e.id]?.[selDate]||{};
              const isProdVO = dept==='News Producer'||dept==='Voice Over';
              const prodFields = isProdVO ? (dept==='News Producer'?PROD_FIELDS:VO_FIELDS) : [];
              const hasProdData = prodFields.some(f=>parseInt(pd[f.key])>0);
              const hasAnyData = items.length>0 || hasProdData;
              return (
                <div key={e.id} className="card" style={{marginBottom:10,borderLeft:`3px solid ${hasAnyData?dc:'var(--brd)'}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:hasAnyData?12:0}}>
                    <div style={{width:36,height:36,borderRadius:9,background:`${dc}18`,color:dc,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>{e.name[0]}</div>
                    <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700}}>{e.name}</div><div style={{fontSize:10,color:'var(--mt)',fontFamily:"'JetBrains Mono'"}}>{e.id}</div></div>
                    <div style={{display:'flex',gap:12,textAlign:'center'}}>
                      {items.length>0 && dept==='NLE Editor' ? (
                        <>
                          <div><div style={{fontSize:16,fontWeight:800,color:dc,fontFamily:"'JetBrains Mono'"}}>{items.length}</div><div style={{fontSize:9,color:'var(--mt)'}}>ITEMS</div></div>
                          <div><div style={{fontSize:16,fontWeight:800,color:'var(--green)',fontFamily:"'JetBrains Mono'"}}>{fmtMin(mins)}</div><div style={{fontSize:9,color:'var(--mt)'}}>TIME</div></div>
                          <div><div style={{fontSize:16,fontWeight:800,color:'var(--amber)',fontFamily:"'JetBrains Mono'"}}>{wpts}</div><div style={{fontSize:9,color:'var(--mt)'}}>PTS</div></div>
                          {totalGap>0&&<div><div style={{fontSize:16,fontWeight:800,color:'var(--red)',fontFamily:"'JetBrains Mono'"}}>{fmtMin(totalGap)}</div><div style={{fontSize:9,color:'var(--mt)'}}>GAP</div></div>}
                        </>
                      ) : isProdVO && hasProdData ? (
                        <>
                          <div><div style={{fontSize:16,fontWeight:800,color:dc,fontFamily:"'JetBrains Mono'"}}>{prodFields.reduce((s,f)=>s+(parseInt(pd[f.key])||0),0)}</div><div style={{fontSize:9,color:'var(--mt)'}}>TOTAL</div></div>
                          {state.attendance[e.id]?.[selDate]?.in_time && <div><div style={{fontSize:16,fontWeight:800,color:'var(--green)'}}>✓</div><div style={{fontSize:9,color:'var(--mt)'}}>PRESENT</div></div>}
                        </>
                      ) : <div style={{fontSize:12,color:'var(--mt)',fontStyle:'italic'}}>No entry</div>}
                    </div>
                  </div>
                  {items.length>0 && dept==='NLE Editor' && (
                    <div style={{overflowX:'auto'}}>
                      <table className="tbl" style={{fontSize:12}}>
                        <thead><tr><th>#</th><th>Type</th><th>IN→OUT</th><th>Time</th><th>Pts</th><th>Description</th></tr></thead>
                        <tbody>
                          {items.map((it,i)=>{
                            const nt=NEWS_TYPES.find(n=>n.key===it.type)||NEWS_TYPES[0];
                            const m=tdiff(it.startTime,it.endTime)??it.manualMins??null;
                            const prev=items[i-1];
                            const gapMins=i>0?tdiff(prev.endTime,it.startTime):null;
                            return (
                              <>
                                {gapMins>0&&<tr key={`gap-${i}`}><td colSpan="6" style={{padding:'3px 10px',background:'var(--al)',borderBottom:'1px solid var(--brd)'}}><span style={{fontSize:10,fontWeight:700,color:'var(--amber)',fontFamily:"'JetBrains Mono'"}}>⏸ Gap: {fmtMin(gapMins)}</span></td></tr>}
                                <tr key={i}><td style={{color:'var(--mt)'}}>{i+1}</td><td><span className="bdg" style={{background:`${nt.color}18`,color:nt.color}}>{nt.icon} {nt.label}</span></td><td style={{fontFamily:"'JetBrains Mono'",fontSize:11,color:'var(--mt)'}}>{it.startTime||'—'} → {it.endTime||'—'}</td><td style={{fontFamily:"'JetBrains Mono'",color:'var(--green)'}}>{m!==null?fmtMin(m):'—'}</td><td style={{fontFamily:"'JetBrains Mono'",fontWeight:700,color:nt.color}}>×{nt.weight}</td><td style={{color:'var(--mt)'}}>{it.desc||'—'}</td></tr>
                              </>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {(dept==='News Producer'||dept==='Voice Over') && (() => {
                    const fields = dept==='News Producer' ? PROD_FIELDS : VO_FIELDS;
                    const hasData = fields.some(f => parseInt(pd[f.key]) > 0);
                    if (!hasData) return <div style={{fontSize:12,color:'var(--mt)',fontStyle:'italic',marginTop:4}}>No entry yet</div>;
                    const total = fields.reduce((s,f)=>s+(parseInt(pd[f.key])||0),0);
                    return (
                      <div style={{marginTop:10}}>
                        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:8}}>
                          {fields.map(f=>{
                            const v=parseInt(pd[f.key])||0;
                            return v>0 ? (
                              <div key={f.key} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,background:`${f.color}12`,border:`1px solid ${f.color}30`}}>
                                <span style={{fontSize:16}}>{f.icon}</span>
                                <div>
                                  <div style={{fontSize:11,color:'var(--mt)'}}>{f.label}</div>
                                  <div style={{fontSize:16,fontWeight:800,color:f.color,fontFamily:"'JetBrains Mono'"}}>{v}</div>
                                </div>
                              </div>
                            ) : null;
                          })}
                        </div>
                        {pd.notes && <div style={{fontSize:12,color:'var(--mt)',fontStyle:'italic',padding:'6px 10px',background:'var(--surf2)',borderRadius:6}}>📝 {pd.notes}</div>}
                        <div style={{display:'flex',gap:16,marginTop:8}}>
                          <span style={{fontSize:12,fontWeight:700,color:dc}}>Total: {total} activities</span>
                          {state.attendance[e.id]?.[selDate]?.in_time && <span style={{fontSize:12,color:'var(--green)'}}>✓ Present</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function AttendancePage({ selDate }) {
  const { state } = useApp();
  const allE = state.emps.filter(e=>e.is_active);

  const locLink = (loc) => loc
    ? <a href={`https://maps.google.com/?q=${loc}`} target="_blank" rel="noreferrer" style={{fontSize:10,color:'var(--blue)',textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:3}}>📍 Map</a>
    : <span style={{color:'var(--dim)',fontSize:11}}>—</span>;

  return (
    <div>
      <div className="sec-hdr"><div><div className="sec-title">Attendance</div><div className="sec-sub">{fmtDate(selDate)}</div></div></div>
      <div className="card" style={{overflowX:'auto'}}>
        <table className="tbl" style={{minWidth:600}}>
          <thead><tr><th>#</th><th>Name</th><th>Dept</th><th style={{textAlign:'center'}}>IN</th><th style={{textAlign:'center'}}>IN Loc</th><th style={{textAlign:'center'}}>OUT</th><th style={{textAlign:'center'}}>OUT Loc</th><th style={{textAlign:'center'}}>Hours</th><th style={{textAlign:'center'}}>Status</th></tr></thead>
          <tbody>
            {allE.map((e,i)=>{
              const att=state.attendance[e.id]?.[selDate]||{};
              const inT=att.in_time||null,outT=att.out_time||null;
              const hrs=inT&&outT?tdiff(inT,outT):null;
              const status=!inT?'Absent':!outT?'Present':hrs>=480?'Full Day':hrs>=240?'Half Day':'Short';
              const sc=!inT?'#dc2626':!outT?'#d97706':hrs>=480?'#059669':'#0891b2';
              const dc=deptColor(e.dept);
              return (
                <tr key={e.id}>
                  <td style={{color:'var(--mt)'}}>{i+1}</td>
                  <td style={{fontWeight:600}}>{e.name}</td>
                  <td><span className="bdg" style={{background:`${dc}18`,color:dc}}>{e.dept.split(' ')[0]}</span></td>
                  <td style={{textAlign:'center',fontFamily:"'JetBrains Mono'",color:'#059669',fontWeight:600}}>{inT||'—'}</td>
                  <td style={{textAlign:'center'}}>{locLink(att.in_location)}</td>
                  <td style={{textAlign:'center',fontFamily:"'JetBrains Mono'",color:'#dc2626',fontWeight:600}}>{outT||'—'}</td>
                  <td style={{textAlign:'center'}}>{locLink(att.out_location)}</td>
                  <td style={{textAlign:'center',fontFamily:"'JetBrains Mono'"}}>{hrs!==null?fmtMin(hrs):'—'}</td>
                  <td style={{textAlign:'center'}}><span style={{background:`${sc}18`,color:sc,padding:'3px 10px',borderRadius:100,fontSize:11,fontWeight:600}}>{status}</span></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><td colSpan="4" style={{fontWeight:700}}>TOTAL: {allE.filter(e=>state.attendance[e.id]?.[selDate]?.in_time).length} present / {allE.filter(e=>!state.attendance[e.id]?.[selDate]?.in_time).length} absent</td><td colSpan="5"/></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
