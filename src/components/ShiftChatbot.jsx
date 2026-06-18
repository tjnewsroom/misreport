import { useState, useRef, useEffect } from 'react';
import { sb } from '../lib/supabase';
import { useToast } from '../hooks/useToast';

function scrFmtD(iso) {
  if (!iso) return '—';
  return new Date(iso+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}
function scrMinDate() { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); }
function scrMaxDate() { const d=new Date(); d.setDate(d.getDate()+21); return d.toISOString().slice(0,10); }

const initData = () => ({ startDate:null, endDate:null, requestedShift:null, reason:'' });

export default function ShiftChatbot({ me, isVisible }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(0);
  const [data, setData] = useState(initData());
  const [reasonInput, setReasonInput] = useState('');
  const [showInp, setShowInp] = useState(false);
  const msgsRef = useRef(null);
  const toast = useToast();

  const scroll = () => setTimeout(() => { if(msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight; }, 60);

  const addMsg = (type, content) => {
    setMessages(prev => [...prev, { id:Date.now()+Math.random(), type, content }]);
    scroll();
  };

  const withTyping = (cb, ms=600) => {
    addMsg('typing', null);
    setTimeout(() => {
      setMessages(prev => prev.filter(m=>m.type!=='typing'));
      cb();
    }, ms);
  };

  const restart = () => {
    setMessages([]);
    setData(initData());
    setStep(0);
    setShowInp(false);
    setReasonInput('');
    setTimeout(startFlow, 150);
  };

  const startFlow = () => {
    withTyping(() => {
      addMsg('bot', { html: `👋 Hi <strong>${me?.name||'there'}</strong>! Let's raise a <strong>Shift Change Request</strong>.<br/><br/>📅 Pick your <strong>start date</strong>.<br/><em style="font-size:.72rem;color:#6b82a8">Tomorrow earliest · Max 21 days ahead</em>`, step:0 });
      addMsg('datepick', { min:scrMinDate(), max:scrMaxDate(), default:scrMinDate(), onConfirm: (v) => {
        setData(d=>({...d, startDate:v}));
        addMsg('user', scrFmtD(v));
        moveEndDate(v);
      }});
    });
  };

  const moveEndDate = (startDate) => {
    setStep(1);
    withTyping(() => {
      addMsg('bot', { html: `📅 Now pick the <strong>end date</strong>.<br/><em style="font-size:.72rem;color:#6b82a8">Same as start = single day</em>`, step:1 });
      addMsg('datepick', { min:startDate, max:scrMaxDate(), default:startDate, onConfirm: (v) => {
        if (v < startDate) { addMsg('bot',{html:'⚠️ End date cannot be before start. Pick again.'}); moveEndDate(startDate); return; }
        setData(d=>({...d, endDate:v}));
        addMsg('user', scrFmtD(v));
        moveShift(startDate, v);
      }});
    });
  };

  const moveShift = (s, e) => {
    setStep(2);
    withTyping(() => {
      const range = s===e ? `on <strong>${scrFmtD(s)}</strong>` : `from <strong>${scrFmtD(s)}</strong> to <strong>${scrFmtD(e)}</strong>`;
      addMsg('bot', { html:`🕐 Which shift are you requesting ${range}?`, step:2 });
      addMsg('shiftpick', { onPick: (v, lbl) => {
        setData(d=>({...d, requestedShift:v}));
        addMsg('user', lbl);
        moveReason();
      }});
    });
  };

  const moveReason = () => {
    setStep(3);
    withTyping(() => {
      addMsg('bot', { html:`📝 Any reason? <em style="font-size:.72rem;color:#6b82a8">(Optional — press ➤ to skip)</em>`, step:3 });
      setShowInp(true);
    });
  };

  const sendReason = () => {
    if (step !== 3) return;
    const val = reasonInput.trim();
    setReasonInput('');
    setShowInp(false);
    setData(d=>({...d, reason:val}));
    if (val) addMsg('user', val);
    moveSummary(val);
  };

  const moveSummary = (reason) => {
    setStep(4);
    withTyping(() => {
      addMsg('bot', { html:'📋 Here\'s your shift change request:', step:4 });
      addMsg('summary', { reason });
      setTimeout(() => {
        addMsg('opts', { options:['✅ Submit Request','🔄 Start Fresh'], onPick: (choice) => {
          if (choice==='🔄 Start Fresh') { restart(); return; }
          doSubmit(reason);
        }});
      }, 300);
    });
  };

  const doSubmit = (reason) => {
    withTyping(async () => {
      const d = data;
      const { error } = await sb.from('shift_change_requests').insert({
        employee_id:me.id, employee_name:me.name, dept:me.dept,
        start_date:d.startDate, end_date:d.endDate,
        requested_shift:d.requestedShift, reason:reason||'', status:'pending'
      });
      if (error) { addMsg('bot',{html:'❌ Submission failed: '+error.message}); return; }
      const shiftLbl = {"1ST":"1st Shift","2ND":"2nd Shift","OFF":"Off"}[d.requestedShift];
      const dateRange = d.startDate===d.endDate ? scrFmtD(d.startDate) : `${scrFmtD(d.startDate)} to ${scrFmtD(d.endDate)}`;
      addMsg('bot',{html:`✅ <strong>Request submitted!</strong><br/><br/>You've requested <strong>${shiftLbl}</strong> for ${dateRange}.<br/>Your admin will review it.`});
      setStep('done');
      toast('✓ Shift change request submitted');
      setTimeout(()=>{ addMsg('opts',{options:['➕ New Request'], onPick:restart}); }, 400);
    }, 800);
  };

  useEffect(() => {
    if (open && messages.length===0) startFlow();
  }, [open]);

  useEffect(()=>{scroll();},[messages]);

  const shiftOpts = [{label:'🌅 1st Shift',value:'1ST',cls:'sc1'},{label:'🌙 2nd Shift',value:'2ND',cls:'sc2'},{label:'🏖️ Off',value:'OFF',cls:'scoff'}];
  const shiftLblMap = {"1ST":"🌅 1st Shift","2ND":"🌙 2nd Shift","OFF":"🏖️ Off"};
  const shiftClsMap = {"1ST":"sc1","2ND":"sc2","OFF":"scoff"};

  return (
    <>
      <button className={`scr-fab-btn ${isVisible?'visible':''}`} onClick={()=>setOpen(true)}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 3C8.477 3 4 7.254 4 12.5c0 2.196.78 4.22 2.075 5.822L4.5 22l4.2-1.3A10.22 10.22 0 0014 22c5.523 0 10-4.254 10-9.5S19.523 3 14 3z" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.5)" strokeWidth="1.3"/><circle cx="10" cy="12.5" r="1.4" fill="white"/><circle cx="14" cy="12.5" r="1.4" fill="white"/><circle cx="18" cy="12.5" r="1.4" fill="white"/></svg>
      </button>

      <div className={`scr-panel-wrap ${open?'open':''}`}>
        <div className="scr-chat-panel">
          <div className="scr-head">
            <div className="scr-head-ico">🔄</div>
            <div style={{flex:1}}>
              <div className="scr-head-title">Shift Change Request</div>
              <div className="scr-head-sub">TAMILJANAM Newsroom Scheduler</div>
            </div>
            <button className="scr-head-close" onClick={()=>setOpen(false)}>✕</button>
          </div>
          <div className="scr-steps-bar">
            <div className="scr-steps">
              {[0,1,2,3,4].map(i=>(
                <div key={i} className={`scr-sdot ${step==='done'||i<step?'done':i===step?'active':''}`}/>
              ))}
            </div>
            <div className="scr-slbls">
              {['Start','End','Shift','Reason','Submit'].map((l,i)=>(
                <div key={i} className={`scr-slbl ${step==='done'||i<step?'done':i===step?'active':''}`}>{l}</div>
              ))}
            </div>
          </div>
          <div className="scr-msgs" ref={msgsRef}>
            {messages.map(m => {
              if (m.type==='typing') return (
                <div key={m.id} className="scr-m bot">
                  <div className="scr-typing-wrap">
                    <div className="scr-dot"/><div className="scr-dot"/><div className="scr-dot"/>
                  </div>
                </div>
              );
              if (m.type==='bot') return (
                <div key={m.id} className="scr-m bot">
                  <div className="scr-bub" dangerouslySetInnerHTML={{__html:m.content.html||m.content}}/>
                </div>
              );
              if (m.type==='user') return (
                <div key={m.id} className="scr-m usr">
                  <div className="scr-bub">{m.content}</div>
                </div>
              );
              if (m.type==='datepick') return (
                <DatePick key={m.id} {...m.content}/>
              );
              if (m.type==='shiftpick') return (
                <div key={m.id} className="scr-m bot">
                  <div className="scr-opts">
                    {shiftOpts.map(s=>(
                      <ShiftBtn key={s.value} label={s.label} cls={s.cls} onPick={()=>m.content.onPick(s.value,s.label)}/>
                    ))}
                  </div>
                </div>
              );
              if (m.type==='opts') return (
                <OptButtons key={m.id} options={m.content.options} onPick={m.content.onPick}/>
              );
              if (m.type==='summary') return (
                <SummaryCard key={m.id} data={data} reason={m.content.reason} shiftLblMap={shiftLblMap} shiftClsMap={shiftClsMap}/>
              );
              return null;
            })}
          </div>
          {showInp && (
            <div className="scr-inp-area">
              <textarea rows="1" placeholder="Type reason or skip…" value={reasonInput}
                onChange={e=>setReasonInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendReason();}}}/>
              <button className="scr-send" onClick={sendReason}>➤</button>
            </div>
          )}
          <div className="scr-restart-bar"><a onClick={restart}>🔄 Start fresh</a></div>
        </div>
      </div>
    </>
  );
}

function DatePick({min,max,default:def,onConfirm}) {
  const [val,setVal] = useState(def||min);
  const [used,setUsed] = useState(false);
  if(used) return null;
  return (
    <div className="scr-m bot">
      <div className="scr-dw">
        <input type="date" className="scr-di" value={val} min={min} max={max} onChange={e=>setVal(e.target.value)}/>
        <button className="scr-opt" style={{width:'100%'}} onClick={()=>{
          if(!val){return;}
          if(val<min||val>max){return;}
          setUsed(true);
          onConfirm(val);
        }}>✅ Confirm Date</button>
      </div>
    </div>
  );
}

function ShiftBtn({label,cls,onPick}) {
  const [used,setUsed]=useState(false);
  return <button className={`scr-opt ${cls}`} disabled={used} onClick={()=>{setUsed(true);onPick();}}>{label}</button>;
}

function OptButtons({options,onPick}) {
  const [used,setUsed]=useState(false);
  return (
    <div className="scr-m bot">
      <div className="scr-opts">
        {options.map(o=>(
          <button key={o} className="scr-opt" disabled={used} onClick={()=>{setUsed(true);onPick(o);}}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({data,reason,shiftLblMap,shiftClsMap}) {
  const dateRange = data.startDate===data.endDate
    ? new Date(data.startDate+'T00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
    : `${new Date(data.startDate+'T00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})} → ${new Date(data.endDate+'T00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}`;
  const shiftLbl = shiftLblMap[data.requestedShift]||data.requestedShift;
  const shiftCls = shiftClsMap[data.requestedShift]||'';
  return (
    <div className="scr-m bot">
      <div className="scr-sum">
        {[['Date(s)',dateRange],['Requested', <span className={`scr-sbdg ${shiftCls}`}>{shiftLbl}</span>],['Reason',reason||<em style={{color:'#6b82a8'}}>—</em>]].map(([l,v])=>(
          <div key={l} className="scr-sum-row"><span className="rl">{l}</span><span className="rv">{v}</span></div>
        ))}
      </div>
    </div>
  );
}
