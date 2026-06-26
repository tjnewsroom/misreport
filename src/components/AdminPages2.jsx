import { useState, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import { useData } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import { SHIFT_OPTS, SH_CLS, SH_MAP, DEPTS } from '../data/constants';
import { fmtISO, fmtShort, gwkStart, addDays, todayStr, deptColor, shortN, scrFmtD } from '../lib/utils';
import { sb } from '../lib/supabase';
import html2canvas from 'html2canvas';

export function ShiftPlanner() {
  const { state, dispatch } = useApp();
  const { upsertShift } = useData();
  const toast = useToast();
  const [wkStart, setWkStart] = useState(() => gwkStart(new Date()));
  const [pending, setPending] = useState(null);
  const [moOpen, setMoOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  const tableRef = useRef(null);

  const days = Array.from({length:7},(_,i)=>addDays(wkStart,i));
  const today = todayStr();
  const dn = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const allE = state.emps.filter(e=>e.is_active);

  const reqShift = (empId, ds, newVal, sel) => {
    const oldVal = state.shifts[ds]?.[empId]?.shift||'';
    const e = state.emps.find(x=>x.id===empId);
    const newLbl = SHIFT_OPTS.find(o=>o.v===newVal)?.lbl||(newVal||'(Clear)');
    const oldLbl = oldVal?(SHIFT_OPTS.find(o=>o.v===oldVal)?.lbl||oldVal):'Not set';
    setPending({empId,ds,newVal,oldVal,sel,empName:e?.name||empId,newLbl,oldLbl});
    setRemarks('');
    setMoOpen(true);
  };

  const confirmShift = async () => {
    if(!pending)return;
    const {empId,ds,newVal,sel} = pending;
    setMoOpen(false);
    dispatch({ type:'UPDATE_SHIFT', payload:{date:ds,empId,data:{shift:newVal,remarks}} });
    if(sel) sel.className='sh-sel '+(SH_CLS[newVal]||'sem');
    const ok = await upsertShift(empId,ds,newVal,remarks);
    if(ok) toast('✓ Shift saved');
    else {
      dispatch({ type:'UPDATE_SHIFT', payload:{date:ds,empId,data:{shift:pending.oldVal,remarks:''}} });
      if(sel){sel.value=pending.oldVal; sel.className='sh-sel '+(SH_CLS[pending.oldVal]||'sem');}
    }
    setPending(null);
  };

  const cancelShift = () => {
    if(pending?.sel){pending.sel.value=pending.oldVal; pending.sel.className='sh-sel '+(SH_CLS[pending.oldVal]||'sem');}
    setPending(null); setMoOpen(false);
  };

  const captureShift = async () => {
    const el = tableRef.current; if(!el)return;
    toast('Generating...');
    try {
      // Expand to full scroll size before capture so mobile gets the full week
      const prevStyle = { overflow: el.style.overflow, width: el.style.width, height: el.style.height };
      el.style.overflow = 'visible';
      el.style.width    = el.scrollWidth  + 'px';
      el.style.height   = el.scrollHeight + 'px';
      const canvas = await html2canvas(el, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
        scrollX: 0, scrollY: 0,
        windowWidth:  el.scrollWidth,
        windowHeight: el.scrollHeight,
      });
      el.style.overflow = prevStyle.overflow;
      el.style.width    = prevStyle.width;
      el.style.height   = prevStyle.height;
      const fname = `TJ_Shifts_${fmtShort(days[0]).replace(/\//g,'-')}.png`;
      const blob = await new Promise(r=>canvas.toBlob(r,'image/png'));
      const file = new File([blob],fname,{type:'image/png'});
      if(navigator.share&&navigator.canShare?.({files:[file]})){
        try{await navigator.share({title:'TJ Shift Plan',files:[file]});toast('Shared ✓');}
        catch(e){if(e.name!=='AbortError'){const a=document.createElement('a');a.download=fname;a.href=canvas.toDataURL('image/png');a.click();}}
      } else {
        const a=document.createElement('a');a.download=fname;a.href=canvas.toDataURL('image/png');a.click();
        toast('Image downloaded ✓');
      }
    } catch(e){toast('Failed: '+e.message,'er');}
  };

  const normShift = (raw) => {
    const s=raw.trim().toUpperCase().replace(/\s+/g,' ');
    return SH_MAP[s]||null;
  };

  const importCSV = async (file) => {
    const text = await file.text();
    const rows=[];
    const lines=text.replace(/\r/g,'').split('\n').map(l=>l.trim()).filter(Boolean);
    if(!lines.length)return toast('Empty file','er');
    const delim=lines[0].includes('\t')?'\t':',';
    let hIdx=lines.findIndex(l=>/\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2}/.test(l));
    if(hIdx===-1)hIdx=0;
    const hCols=lines[hIdx].split(delim);
    const dates=[];
    for(let c=2;c<hCols.length;c++){
      const raw=hCols[c].trim();
      if(/^\d{2}-\d{2}-\d{4}$/.test(raw)){const[dd,mm,yyyy]=raw.split('-');dates.push(`${yyyy}-${mm}-${dd}`);}
      else if(/^\d{4}-\d{2}-\d{2}$/.test(raw))dates.push(raw);
      else dates.push(null);
    }
    const skipped=[];
    for(let i=hIdx+1;i<lines.length;i++){
      const cols=lines[i].split(delim);if(cols.length<3)continue;
      const col0=cols[0].trim(),nameRaw=cols[1].trim();
      let empId=null;
      const byId=state.emps.find(e=>e.id===col0);
      if(byId){empId=col0;}
      else{const byName=state.emps.find(e=>e.name.toUpperCase()===nameRaw.toUpperCase());if(byName)empId=byName.id;else{skipped.push(nameRaw);continue;}}
      for(let c=2;c<cols.length;c++){
        const sd=dates[c-2];if(!sd)continue;
        const sc=normShift(cols[c]||'');if(!sc)continue;
        rows.push({employee_id:empId,shift_date:sd,shift_code:sc,remarks:''});
      }
    }
    if(skipped.length)toast(`⚠ ${skipped.length} unmatched rows`,'er');
    if(!rows.length)return toast('No valid rows found','er');
    toast(`Uploading ${rows.length}...`);
    const BATCH=50;let failed=0;
    for(let i=0;i<rows.length;i+=BATCH){
      const batch=rows.slice(i,i+BATCH);
      const{error}=await sb.from('shift_entries').upsert(batch,{onConflict:'employee_id,shift_date'});
      if(error)failed+=batch.length;
      else batch.forEach(r=>{dispatch({type:'UPDATE_SHIFT',payload:{date:r.shift_date,empId:r.employee_id,data:{shift:r.shift_code,remarks:''}}});});
    }
    if(failed)toast(`Done — ${failed} failed`,'er');
    else toast(`✓ ${rows.length} entries imported!`);
  };

  return (
    <div>
      <div className="sec-hdr">
        <div><div className="sec-title">Shift Planner</div><div className="sec-sub">{fmtShort(days[0])} — {fmtShort(days[6])}</div></div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <button className="btn btn-s btn-sm" onClick={()=>setWkStart(addDays(wkStart,-7))}>‹ Prev</button>
          <button className="btn btn-s btn-sm" onClick={()=>setWkStart(gwkStart(new Date()))}>Today</button>
          <button className="btn btn-s btn-sm" onClick={()=>setWkStart(addDays(wkStart,7))}>Next ›</button>
          <button className="btn btn-p btn-sm" onClick={captureShift}>📸 Share</button>
          <label className="btn btn-s btn-sm" style={{cursor:'pointer'}}>⬆ Import<input type="file" accept=".csv,.sql" style={{display:'none'}} onChange={e=>{const f=e.target.files[0];if(f)importCSV(f);e.target.value='';}} /></label>
        </div>
      </div>
      <div className="sh-wrap" ref={tableRef}>
        <table className="sh-tbl">
          <thead>
            <tr>
              <th className="sh-stk" style={{width:28}}>#</th>
              <th className="sh-stk2 tl" style={{minWidth:130}}>NAME</th>
              {days.map((d,i)=>{const ds=fmtISO(d),isT=ds===today;return(
                <th key={ds} style={{background:isT?'rgba(37,99,235,.12)':'',color:isT?'var(--blue)':'var(--mt)',minWidth:82}}>
                  <div style={{fontWeight:700,fontSize:10}}>{dn[i]}</div>
                  <div style={{fontSize:10,fontWeight:400}}>{fmtShort(d)}</div>
                </th>
              );})}
            </tr>
          </thead>
          <tbody>
            {DEPTS.map(dept=>{
              const dc=deptColor(dept);
              const emps=allE.filter(e=>e.dept===dept);
              if(!emps.length)return null;
              return [
                <tr key={dept+'_hdr'}><td colSpan={9} style={{background:`${dc}12`,color:dc,fontSize:11,fontWeight:700,padding:'12px 16px',textAlign:'center',border:'1px solid var(--brd)',borderTop:`3px solid ${dc}`}}>{dept.toUpperCase()}</td></tr>,
                ...emps.map((e,idx)=>(
                  <tr key={e.id}>
                    <td className="sh-stk" style={{textAlign:'center',color:'var(--mt)',fontSize:10}}>{idx+1}</td>
                    <td className="sh-stk2" style={{padding:'10px 8px'}}>
                      <div style={{fontSize:11,fontWeight:600,color:dc}}>{shortN(e.name)}</div>
                      <div style={{fontSize:9,color:'var(--mt)',fontFamily:"'JetBrains Mono'"}}>{e.id}</div>
                    </td>
                    {days.map(d=>{
                      const ds=fmtISO(d);
                      const val=state.shifts[ds]?.[e.id]?.shift||'';
                      const cls=SH_CLS[val]||'sem';
                      return (
                        <td key={ds} style={{padding:'2px 3px'}}>
                          <select className={`sh-sel ${cls}`}
                            value={val}
                            onChange={ev=>reqShift(e.id,ds,ev.target.value,ev.target)}>
                            {SHIFT_OPTS.map(o=><option key={o.v} value={o.v}>{o.lbl}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))
              ];
            })}
            <tr style={{background:'var(--surf2)'}}>
              <td colSpan={2} style={{padding:'6px 10px',fontSize:10,fontWeight:700,color:'var(--mt)'}}>SUMMARY</td>
              {days.map(d=>{
                const ds=fmtISO(d);
                let p=0,o=0,l=0;
                allE.forEach(e=>{
                  const v=state.shifts[ds]?.[e.id]?.shift||'';
                  if(['1ST','2ND','NIGHT','GEN','MN','COMP_HOL','COMP_WEEK'].includes(v))p++;
                  else if(v==='OFF')o++;
                  else if(['CL','SL','PL','LOP'].includes(v))l++;
                });
                return <td key={ds} style={{textAlign:'center',fontSize:9,fontFamily:"'JetBrains Mono'",padding:'4px 2px'}}><div style={{color:'var(--green)'}}>P:{p}</div><div style={{color:'var(--red)'}}>O:{o}</div><div style={{color:'var(--amber)'}}>L:{l}</div></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Shift Confirm Modal */}
      <div className={`mo ${moOpen?'open':''}`}>
        <div className="mo-box">
          <div className="mo-t">Confirm Shift Change <button className="mo-x" onClick={cancelShift}>×</button></div>
          {pending && (
            <div style={{background:'var(--surf2)',borderRadius:9,padding:12,marginBottom:14,fontSize:13,lineHeight:1.8}}>
              <div style={{fontWeight:700,fontSize:14}}>{pending.empName}</div>
              <div style={{marginTop:5}}>📅 <strong>{new Date(pending.ds+'T00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}</strong></div>
              <div style={{marginTop:4,color:'var(--mt)'}}>Current: <span style={{color:'var(--amber)'}}>{pending.oldLbl}</span></div>
              <div style={{marginTop:3}}>Change to: <strong style={{color:'var(--blue)'}}>{pending.newLbl}</strong></div>
            </div>
          )}
          <div className="fg"><label className="lbl">Remarks (optional)</label><input className="inp" value={remarks} onChange={e=>setRemarks(e.target.value)} placeholder="e.g. swap, emergency..."/></div>
          <div className="mo-ac">
            <button className="btn btn-s" onClick={cancelShift}>Cancel</button>
            <button className="btn btn-p" onClick={confirmShift}>✓ Confirm & Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StaffManagement() {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newEmp, setNewEmp] = useState({code:'',name:'',dept:'NLE Editor'});
  const [editMo, setEditMo] = useState(null);
  const [delMo, setDelMo] = useState(null);

  const addEmp = async () => {
    const code=newEmp.code.trim(), name=newEmp.name.trim().toUpperCase(), dept=newEmp.dept;
    if(!code||!name)return toast('Code and Name required','er');
    if(state.emps.find(e=>e.id===code))return toast('Code already exists','er');
    const{data,error}=await sb.from('employees').insert({emp_code:code,name,dept,is_active:true}).select().single();
    if(error)return toast('Failed: '+error.message,'er');
    dispatch({type:'ADD_EMP',payload:{id:code,name,dept,is_active:true,_uuid:data.id}});
    setNewEmp({code:'',name:'',dept:'NLE Editor'}); setShowAdd(false);
    toast('✓ Employee added');
  };

  const saveEdit = async () => {
    if(!editMo)return;
    const{uuid,newCode,newName,newDept,oldCode}=editMo;
    if(!newCode||!newName)return toast('Code and Name required','er');
    if(newCode!==oldCode&&state.emps.find(e=>e.id===newCode))return toast('Code already in use','er');
    const{error}=await sb.from('employees').update({emp_code:newCode,name:newName,dept:newDept}).eq('id',uuid);
    if(error)return toast('Update failed: '+error.message,'er');
    dispatch({type:'UPDATE_EMP',payload:{_uuid:uuid,id:newCode,name:newName,dept:newDept}});
    toast('✓ Employee updated'); setEditMo(null);
  };

  const toggleActive = async (e) => {
    const newState=!e.is_active;
    const{error}=await sb.from('employees').update({is_active:newState}).eq('id',e._uuid);
    if(error)return toast('Failed: '+error.message,'er');
    dispatch({type:'UPDATE_EMP',payload:{_uuid:e._uuid,is_active:newState}});
    toast(newState?'✓ Activated':'✓ Deactivated');
  };

  const confirmDelete = async () => {
    if(!delMo)return;
    const{error}=await sb.from('employees').delete().eq('id',delMo.uuid);
    if(error){toast('Failed: '+error.message,'er');setDelMo(null);return;}
    dispatch({type:'REMOVE_EMP',payload:delMo.uuid});
    toast('✓ Deleted'); setDelMo(null);
  };

  const dc = (dept) => ({NLEEditor:'#2563eb','News Producer':'#0891b2','Voice Over':'#059669'}[dept]||deptColor(dept));

  return (
    <div>
      <div className="sec-hdr">
        <div><div className="sec-title">All Staff</div><div className="sec-sub">Manage employees</div></div>
        <button className="btn btn-p btn-sm" onClick={()=>setShowAdd(!showAdd)}>+ Add Staff</button>
      </div>
      {showAdd && (
        <div className="card">
          <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>Add New Staff</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div><label className="lbl">Employee Code</label><input className="inp" value={newEmp.code} onChange={e=>setNewEmp(p=>({...p,code:e.target.value}))} placeholder="e.g. 22023"/></div>
            <div><label className="lbl">Full Name</label><input className="inp" value={newEmp.name} onChange={e=>setNewEmp(p=>({...p,name:e.target.value}))} placeholder="JOHN K"/></div>
          </div>
          <div className="fg"><label className="lbl">Department</label>
            <select className="inp" value={newEmp.dept} onChange={e=>setNewEmp(p=>({...p,dept:e.target.value}))}>
              {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-p" style={{flex:1}} onClick={addEmp}>Add Employee</button>
            <button className="btn btn-s" style={{flex:1}} onClick={()=>setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="card" style={{overflowX:'auto'}}>
        <table className="tbl" style={{minWidth:400}}>
          <thead><tr><th>#</th><th>Name</th><th>Code</th><th>Dept</th><th style={{textAlign:'center'}}>Status</th><th style={{textAlign:'center'}}>Actions</th></tr></thead>
          <tbody>
            {state.emps.map((e,i)=>(
              <tr key={e._uuid} style={{opacity:e.is_active?1:.5}}>
                <td style={{color:'var(--mt)'}}>{i+1}</td>
                <td style={{fontWeight:600}}>{e.name}</td>
                <td style={{fontFamily:"'JetBrains Mono'",fontSize:11,color:'var(--mt)'}}>{e.id}</td>
                <td><span className="bdg" style={{background:`${deptColor(e.dept)}18`,color:deptColor(e.dept)}}>{e.dept}</span></td>
                <td style={{textAlign:'center'}}><span style={{background:e.is_active?'var(--gl)':'var(--rl)',color:e.is_active?'var(--green)':'var(--red)',padding:'2px 10px',borderRadius:100,fontSize:11,fontWeight:600}}>{e.is_active?'Active':'Inactive'}</span></td>
                <td style={{textAlign:'center'}}>
                  <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                    <button className="btn btn-s btn-sm" onClick={()=>setEditMo({uuid:e._uuid,oldCode:e.id,newCode:e.id,newName:e.name,newDept:e.dept})}>✏️ Edit</button>
                    <button className="btn btn-s btn-sm" onClick={()=>toggleActive(e)}>{e.is_active?'Deactivate':'Activate'}</button>
                    <button className="btn btn-d btn-sm" onClick={()=>setDelMo({uuid:e._uuid,name:e.name})}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <div className={`mo ${editMo?'open':''}`}>
        <div className="mo-box">
          <div className="mo-t">Edit Employee <button className="mo-x" onClick={()=>setEditMo(null)}>×</button></div>
          {editMo && <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div><label className="lbl">Employee Code</label><input className="inp" value={editMo.newCode} onChange={e=>setEditMo(p=>({...p,newCode:e.target.value}))} /></div>
              <div><label className="lbl">Full Name</label><input className="inp" value={editMo.newName} onChange={e=>setEditMo(p=>({...p,newName:e.target.value}))} /></div>
            </div>
            <div className="fg"><label className="lbl">Department</label>
              <select className="inp" value={editMo.newDept} onChange={e=>setEditMo(p=>({...p,newDept:e.target.value}))}>
                {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </>}
          <div className="mo-ac">
            <button className="btn btn-s" onClick={()=>setEditMo(null)}>Cancel</button>
            <button className="btn btn-p" onClick={saveEdit}>✓ Save Changes</button>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <div className={`mo ${delMo?'open':''}`}>
        <div className="mo-box" style={{maxWidth:360}}>
          <div className="mo-t">Confirm Delete <button className="mo-x" onClick={()=>setDelMo(null)}>×</button></div>
          <div style={{fontSize:14,color:'var(--mt)',marginBottom:8}}>Delete "{delMo?.name}"?</div>
          <div style={{fontSize:12,color:'var(--red)',marginBottom:16}}>This cannot be undone.</div>
          <div className="mo-ac">
            <button className="btn btn-s" onClick={()=>setDelMo(null)}>Cancel</button>
            <button className="btn btn-d" onClick={confirmDelete}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShiftRequests() {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const [reqs, setReqs] = useState(null);
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  const load = async () => {
    const{data}=await sb.from('shift_change_requests').select('*').order('submitted_at',{ascending:false});
    setReqs(data||[]);
  };

  if(reqs===null && state.emps.length>0) load();

  const adminAction = async (req, action) => {
    const{error:e1}=await sb.from('shift_change_requests').update({status:action,reviewed_at:new Date().toISOString()}).eq('id',req.id);
    if(e1){toast('Update failed: '+e1.message,'er');return;}
    if(action==='approved'){
      const rows=[];
      const requestedCodeMap = { OFF:'OFFREQUESTED', '1ST':'1STSHIFTREQUESTED', '2ND':'2NDSHIFTREQUESTED' };
      const shiftCode = requestedCodeMap[req.requested_shift] || req.requested_shift;
      const cur=new Date(req.start_date+'T00:00');
      const end=new Date(req.end_date+'T00:00');
      while(cur<=end){
        const localDate=cur.getFullYear()+'-'+String(cur.getMonth()+1).padStart(2,'0')+'-'+String(cur.getDate()).padStart(2,'0');
        rows.push({employee_id:req.employee_id,shift_date:localDate,shift_code:shiftCode,remarks:'Shift change approved'});
        cur.setDate(cur.getDate()+1);
      }
      for(let i=0;i<rows.length;i+=50){
        const{error:e2}=await sb.from('shift_entries').upsert(rows.slice(i,i+50),{onConflict:'employee_id,shift_date'});
        if(e2){toast('Shift update failed: '+e2.message,'er');return;}
      }
      rows.forEach(r=>dispatch({type:'UPDATE_SHIFT',payload:{date:r.shift_date,empId:r.employee_id,data:{shift:r.shift_code,remarks:r.remarks}}}));
      toast('✅ Approved — schedule updated');
    } else {
      toast('❌ Rejected');
    }
    setReqs(prev=>prev.map(r=>r.id===req.id?{...r,status:action}:r));
  };

  const shiftLbl={"1ST":"🌅 1st Shift","2ND":"🌙 2nd Shift","OFF":"🏖️ Off"};
  const shiftCls={"1ST":"sc1","2ND":"sc2","OFF":"scoff"};

  const all = reqs || [];
  const counts = { pending: all.filter(r=>r.status==='pending').length, approved: all.filter(r=>r.status==='approved').length, rejected: all.filter(r=>r.status==='rejected').length };
  const tabList = [
    { key:'pending',  label:'Pending',  color:'var(--amber)', bg:'var(--al)',  pill:'pending'  },
    { key:'approved', label:'Approved', color:'var(--green)', bg:'var(--gl)',  pill:'approved' },
    { key:'rejected', label:'Rejected', color:'var(--red)',   bg:'var(--rl)',  pill:'rejected' },
  ];

  const tabReqs = all
    .filter(r => r.status === activeTab)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  const filtered = filter ? tabReqs.filter(r=>(r.employee_name||'').toLowerCase().includes(filter.toLowerCase())) : tabReqs;

  const tabEmptyMsg = { pending:'✅ All caught up! No pending requests.', approved:'No approved requests yet.', rejected:'No rejected requests.' };

  return (
    <div>
      <div className="sec-hdr">
        <div><div className="sec-title">Shift Change Requests</div><div className="sec-sub">Review and approve requests</div></div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:16,borderBottom:'2px solid var(--brd)',paddingBottom:0}}>
        {tabList.map(t=>{
          const isActive = activeTab===t.key;
          return (
            <button key={t.key} onClick={()=>{setActiveTab(t.key);setFilter('');}}
              style={{
                display:'flex',alignItems:'center',gap:6,padding:'9px 16px',
                border:'none',borderBottom:`2px solid ${isActive?t.color:'transparent'}`,
                background:'transparent',cursor:'pointer',fontFamily:'Inter',
                fontSize:13,fontWeight:isActive?700:500,
                color:isActive?t.color:'var(--mt)',
                marginBottom:-2,transition:'all .15s',borderRadius:'6px 6px 0 0',
              }}>
              {t.label}
              {counts[t.key]>0 && (
                <span style={{
                  background:isActive?t.color:'var(--brd2)',color:isActive?'#fff':'var(--mt)',
                  borderRadius:100,fontSize:11,fontWeight:700,
                  padding:'0px 7px',minWidth:20,textAlign:'center',lineHeight:'18px',display:'inline-block',
                }}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {reqs===null ? (
        <div className="card" style={{textAlign:'center',padding:40,color:'var(--mt)'}}>Loading...</div>
      ) : (
        <>
          {/* Filter bar — shown only when there are items */}
          {tabReqs.length>0 && (
            <div className="card" style={{
              background: activeTab==='pending'?'var(--al)':activeTab==='approved'?'var(--gl)':'var(--rl)',
              borderColor: activeTab==='pending'?'rgba(201,125,14,.3)':activeTab==='approved'?'rgba(15,155,110,.3)':'rgba(212,50,40,.3)',
              marginBottom:16,
            }}>
              {activeTab==='pending' && counts.pending>0 && (
                <div style={{fontWeight:700,color:'var(--amber)',marginBottom:10}}>🔔 {counts.pending} pending request{counts.pending>1?'s':''} awaiting approval</div>
              )}
              {activeTab==='approved' && (
                <div style={{fontWeight:700,color:'var(--green)',marginBottom:10}}>✅ {counts.approved} approved request{counts.approved>1?'s':''}</div>
              )}
              {activeTab==='rejected' && (
                <div style={{fontWeight:700,color:'var(--red)',marginBottom:10}}>❌ {counts.rejected} rejected request{counts.rejected>1?'s':''}</div>
              )}
              <input className="inp" placeholder="🔍 Filter by employee name…" style={{fontSize:12}} value={filter} onChange={e=>setFilter(e.target.value)} />
            </div>
          )}

          {/* Empty state */}
          {!tabReqs.length ? (
            <div className="card" style={{textAlign:'center',padding:40,color:'var(--mt)'}}>
              <div style={{fontSize:32,marginBottom:8}}>{activeTab==='pending'?'✅':activeTab==='approved'?'📋':'🚫'}</div>
              <div style={{fontWeight:600}}>{tabEmptyMsg[activeTab]}</div>
            </div>
          ) : filtered.length===0 ? (
            <div className="card" style={{textAlign:'center',padding:24,color:'var(--mt)'}}>No results for "{filter}"</div>
          ) : (
            filtered.map(req=>{
              const dateRange=req.start_date===req.end_date?scrFmtD(req.start_date):`${scrFmtD(req.start_date)} → ${scrFmtD(req.end_date)}`;
              return (
                <div key={req.id} className="scr-req-card">
                  <div className="scr-req-hdr">
                    <div className="scr-req-name">{req.employee_name}</div>
                    <div className={`scr-req-pill ${req.status}`}>{req.status.toUpperCase()}</div>
                  </div>
                  <div className="scr-req-rows">
                    {[['Dept',req.dept],['Date(s)',dateRange],['Shift',<span className={`scr-sbdg ${shiftCls[req.requested_shift]||''}`}>{shiftLbl[req.requested_shift]||req.requested_shift}</span>],...(req.reason?[['Reason',req.reason]]:[]),...(req.reviewed_at&&req.status!=='pending'?[['Reviewed',scrFmtD(req.reviewed_at.slice(0,10))]]:[])]
                      .map(([l,v])=><div key={l} className="scr-req-row"><span className="rl">{l}</span><span className="rv">{v}</span></div>)}
                  </div>
                  {req.status==='pending' ? (
                    <div className="scr-req-acts">
                      <button className="scr-req-btn appr" onClick={()=>adminAction(req,'approved')}>✅ Approve</button>
                      <button className="scr-req-btn rejt" onClick={()=>adminAction(req,'rejected')}>❌ Reject</button>
                    </div>
                  ) : (
                    <div className={`scr-req-note ${req.status==='rejected'?'rejt':''}`}>
                      {req.status==='approved'?`✅ Schedule updated to ${shiftLbl[req.requested_shift]||req.requested_shift}`:'❌ Rejected — original schedule kept'}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
