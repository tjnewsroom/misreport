import { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { sb } from '../lib/supabase';
import { useApp } from '../hooks/useApp';
import { useData } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import { QUALITY_ITEMS, REL_ITEMS, PROD_FIELDS, VO_FIELDS, NEWS_TYPES, DEPTS } from '../data/constants';
import { fmtDate, calcScore, todayStr, tdiff, fmtMin } from '../lib/utils';

// ── Date helpers (always ISO strings) ────────────────────────────────────────
function addDaysISO(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtS(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}
function getDates(rangeId, customFrom, customTo) {
  const today = todayStr();
  if (rangeId === 'today') return [today];
  if (rangeId === 'week') {
    const d = new Date(today + 'T12:00:00');
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const r = new Date(mon); r.setDate(mon.getDate() + i);
      return r.toISOString().slice(0, 10);
    });
  }
  if (rangeId === 'month') {
    const [y, m] = today.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    return Array.from({ length: days }, (_, i) => `${today.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`);
  }
  if (rangeId === 'custom' && customFrom && customTo && customFrom <= customTo) {
    const dates = [];
    let cur = customFrom;
    let safety = 0;
    while (cur <= customTo && safety < 400) { dates.push(cur); cur = addDaysISO(cur, 1); safety++; }
    return dates;
  }
  return [today];
}

// ── Shared pill button ────────────────────────────────────────────────────────
function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: 999, border: '1px solid var(--brd)',
      background: active ? 'var(--blue)' : 'var(--surf2)',
      color: active ? '#fff' : 'var(--mt)',
      fontSize: '.78rem', cursor: 'pointer', fontWeight: active ? 700 : 400,
      transition: 'all .15s'
    }}>{children}</button>
  );
}

// ── Quality Errors ────────────────────────────────────────────────────────────
export function QualityPage({ selDate }) {
  const { state, dispatch } = useApp();
  const { saveQuality } = useData();
  const toast = useToast();
  const [deptFilter, setDeptFilter] = useState('All');
  const [saving, setSaving] = useState({});

  // ── Mistake log (client feedback #6): notes with date + team member,
  //    filterable by employee + month, and tied to specific error types ──
  const [notes, setNotes] = useState([]);
  const [logEmp, setLogEmp] = useState('');                    // '' = all employees
  const [logMonth, setLogMonth] = useState(selDate.slice(0,7));
  const [errPopup, setErrPopup] = useState(null);              // { emp, qi } when + clicked
  const [errNote, setErrNote] = useState('');
  const uuidToName = useMemo(() => {
    const m = {}; state.emps.forEach(e => { m[e._uuid] = e; }); return m;
  }, [state.emps]);

  const loadNotes = async () => {
    const [y, m] = logMonth.split('-').map(Number);
    const from = logMonth + '-01';
    const to = `${logMonth}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`;
    let q = sb.from('quality_notes').select('*')
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(500);
    if (logEmp) {
      const emp = state.emps.find(e => e.id === logEmp);
      if (emp?._uuid) q = q.eq('emp_id', emp._uuid);
    }
    const { data, error } = await q;
    if (error) { console.error('quality_notes load:', error.message); return; }
    setNotes(data || []);
  };
  useEffect(() => { loadNotes(); }, [logMonth, logEmp]);

  // + clicked on an error counter → confirm with a note, save counter + note immediately
  const confirmError = async (skipNote) => {
    const { emp, qi } = errPopup;
    const cur = state.quality[emp.id]?.[selDate] || {};
    const newData = { ...cur, [qi.key]: (parseInt(cur[qi.key]) || 0) + 1 };
    dispatch({ type: 'UPDATE_QUALITY', payload: { empId: emp.id, date: selDate, data: newData } });
    setErrPopup(null);
    const ok = await saveQuality(emp.id, selDate, newData);
    if (!ok) { toast('❌ Counter save failed', 'er'); return; }
    if (!skipNote && errNote.trim() && emp._uuid) {
      const { error } = await sb.from('quality_notes').insert({
        date: selDate, emp_id: emp._uuid, note: errNote.trim(), error_key: qi.key,
      });
      if (error) toast('Note save failed: ' + error.message, 'er');
      else loadNotes();
    }
    toast(`✅ ${qi.label} logged for ${emp.name}`);
  };

  // − clicked → decrement and save immediately (notes stay; delete them from the log)
  const decError = async (emp, qi, val) => {
    if (val <= 0) return;
    const cur = state.quality[emp.id]?.[selDate] || {};
    const newData = { ...cur, [qi.key]: val - 1 };
    dispatch({ type: 'UPDATE_QUALITY', payload: { empId: emp.id, date: selDate, data: newData } });
    await saveQuality(emp.id, selDate, newData);
  };

  const deleteNote = async (id) => {
    const { error } = await sb.from('quality_notes').delete().eq('id', id);
    if (error) { toast('Delete failed: ' + error.message, 'er'); return; }
    setNotes(n => n.filter(x => x.id !== id));
  };

  const emps = state.emps.filter(e => e.is_active && (deptFilter === 'All' || e.dept === deptFilter));

  const getVal = (empId, key) => parseInt(state.quality[empId]?.[selDate]?.[key]) || 0;

  const handleChange = (empId, key, val) => {
    const cur = state.quality[empId]?.[selDate] || {};
    dispatch({ type: 'UPDATE_QUALITY', payload: { empId, date: selDate, data: { ...cur, [key]: parseInt(val) || 0 } } });
  };

  const handleSave = async (emp) => {
    setSaving(s => ({ ...s, [emp.id]: true }));
    const ok = await saveQuality(emp.id, selDate, state.quality[emp.id]?.[selDate] || {});
    toast(ok ? '✅ Saved' : '❌ Failed', ok ? undefined : 'er');
    setSaving(s => ({ ...s, [emp.id]: false }));
  };

  return (
    <div style={{ padding: 20 }}>
      {/* ── Note popup when + is pressed on an error (client feedback) ── */}
      {errPopup && (
        <div onClick={() => setErrPopup(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surf)', borderRadius: 16, padding: 22, maxWidth: 420, width: '100%', border: '1px solid var(--brd)', boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>{errPopup.qi.icon} {errPopup.qi.label}</div>
            <div style={{ fontSize: 12, color: 'var(--mt)', marginBottom: 12 }}>
              <strong style={{ color: 'var(--red)' }}>{errPopup.emp.name}</strong> · {selDate} · {errPopup.qi.pts > 0 ? '+' : ''}{errPopup.qi.pts} pts
            </div>
            <textarea className="inp" rows={3} autoFocus placeholder="What mistake was made… (goes into the Mistake Log)"
              value={errNote} onChange={e => setErrNote(e.target.value)}
              style={{ width: '100%', resize: 'vertical', marginBottom: 14, fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setErrPopup(null)} style={{ flex: 1, background: 'var(--surf2)', border: '1px solid var(--brd)', color: 'var(--txt)', borderRadius: 9, padding: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => confirmError(true)} style={{ flex: 1, background: 'var(--surf2)', border: '1px solid var(--brd)', color: 'var(--mt)', borderRadius: 9, padding: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Skip Note</button>
              <button onClick={() => confirmError(false)} disabled={!errNote.trim()} style={{ flex: 1.4, background: errNote.trim() ? 'var(--red)' : 'var(--surf3)', border: 'none', color: errNote.trim() ? '#fff' : 'var(--dim)', borderRadius: 9, padding: 10, fontSize: 12, fontWeight: 700, cursor: errNote.trim() ? 'pointer' : 'default' }}>✓ Save Error + Note</button>
            </div>
          </div>
        </div>
      )}
      <div className="sec-hdr">
        <div><div className="sec-title">🎯 Quality Errors</div><div className="sec-sub">{fmtDate(selDate)}</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {['All', ...DEPTS].map(d => <Pill key={d} active={deptFilter === d} onClick={() => setDeptFilter(d)}>{d}</Pill>)}
      </div>

      {/* ── Mistake log for tracking & review (client feedback #6) ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>📝 Mistake Log</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="inp inp-sm" value={logEmp} onChange={e => setLogEmp(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">All employees</option>
              {state.emps.filter(e => e.is_active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input type="month" className="inp inp-sm" value={logMonth} onChange={e => setLogMonth(e.target.value)} />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--mt)', marginBottom: 12 }}>Press ＋ on any error below — it asks for a note and logs here automatically. Use the filters above to see all mistakes of one employee for any month.</div>
        {notes.length > 0 && (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mt)', marginBottom: 8 }}>
            {notes.length} mistake{notes.length !== 1 ? 's' : ''} in {logMonth}
            {(() => { const pts = notes.reduce((sum, n) => { const qi = QUALITY_ITEMS.find(q => q.key === n.error_key); return sum + (qi && qi.pts < 0 ? Math.abs(qi.pts) : 0); }, 0);
              return pts > 0 ? <span style={{ color: 'var(--red)' }}> · −{pts} pts from logged errors</span> : null; })()}
          </div>
        )}
        {notes.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--dim)', fontStyle: 'italic' }}>No mistakes logged for this selection.</div>
        ) : (
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {notes.map(n => {
              const emp = uuidToName[n.emp_id];
              return (
                <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--surf2)', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono'", color: 'var(--mt)', whiteSpace: 'nowrap', paddingTop: 2 }}>{n.date}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {emp?.name || 'Unknown'}<span style={{ fontWeight: 400, color: 'var(--mt)' }}> · {emp?.dept || ''}</span>
                      {(() => { const qi = QUALITY_ITEMS.find(q => q.key === n.error_key);
                        return qi ? <span style={{ fontSize: 10, fontWeight: 700, background: qi.sev === 'major' ? 'var(--rl)' : 'var(--al)', color: qi.sev === 'major' ? 'var(--red)' : 'var(--amber)', borderRadius: 999, padding: '2px 8px' }}>{qi.icon} {qi.label} · {qi.pts > 0 ? '+' : ''}{qi.pts} pts</span> : null; })()}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--txt)', marginTop: 2 }}>{n.note}</div>
                  </div>
                  <button onClick={() => deleteNote(n.id)} title="Delete note"
                    style={{ border: 'none', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', fontSize: 13 }}>🗑</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))', gap: 16 }}>
        {emps.map(emp => {
          const deptItems = QUALITY_ITEMS.filter(qi => qi.depts.includes(emp.dept));
          const totalDeduct = deptItems.reduce((s, qi) => s + Math.abs(qi.pts) * getVal(emp.id, qi.key), 0);
          return (
            <div key={emp.id} style={{ background: 'var(--surf)', border: '1px solid var(--brd)', borderRadius: 14, padding: 20, boxShadow: 'var(--sh)' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--brd)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--txt)' }}>{emp.name}</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--mt)', marginTop: 2 }}>{emp.id} · {emp.dept}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: totalDeduct > 0 ? 'var(--red)' : 'var(--green)', fontFamily: "'JetBrains Mono'" }}>
                    {totalDeduct > 0 ? `-${totalDeduct}` : '✓'}
                  </div>
                  <div style={{ fontSize: '.65rem', color: 'var(--mt)', marginTop: 2 }}>{totalDeduct > 0 ? 'pts deducted' : 'No errors'}</div>
                </div>
              </div>
              {/* Items grouped by severity */}
              {['major', 'minor'].map(sev => {
                const sevItems = deptItems.filter(qi => qi.sev === sev);
                if (!sevItems.length) return null;
                return (
                  <div key={sev} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: sev === 'major' ? 'var(--red)' : 'var(--amber)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sev === 'major' ? 'var(--red)' : 'var(--amber)', display: 'inline-block' }} />
                      {sev === 'major' ? 'Major Errors' : 'Minor Issues'}
                    </div>
                    {sevItems.map(qi => {
                      const val = getVal(emp.id, qi.key);
                      return (
                        <div key={qi.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: val > 0 ? (sev === 'major' ? 'var(--rl)' : 'var(--al)') : 'var(--surf2)', marginBottom: 4, transition: 'background .2s' }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{qi.icon}</span>
                          <span style={{ flex: 1, fontSize: '.82rem', color: 'var(--txt)', fontWeight: val > 0 ? 600 : 400 }}>{qi.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button onClick={() => decError(emp, qi, val)}
                              style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--brd)', background: 'var(--surf3)', color: 'var(--txt)', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                            <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: '.9rem', color: val > 0 ? (sev === 'major' ? 'var(--red)' : 'var(--amber)') : 'var(--dim)', fontFamily: "'JetBrains Mono'" }}>{val}</span>
                            <button onClick={() => { setErrNote(''); setErrPopup({ emp, qi }); }}
                              style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--brd)', background: 'var(--surf3)', color: 'var(--txt)', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <button className="btn btn-p btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => handleSave(emp)} disabled={saving[emp.id]}>
                {saving[emp.id] ? 'Saving…' : '💾 Save Quality'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Reliability Scores ────────────────────────────────────────────────────────
export function ReliabilityPage({ selDate }) {
  const { state, dispatch } = useApp();
  const { saveReliability } = useData();
  const toast = useToast();
  const [saving, setSaving] = useState({});
  const month = selDate.slice(0, 7);

  const getVal = (empId, key) => state.reliability[empId]?.[month]?.[key] ?? 7;

  const handleChange = (empId, key, val) => {
    const cur = state.reliability[empId]?.[month] || {};
    dispatch({ type: 'UPDATE_RELIABILITY', payload: { empId, month, data: { ...cur, [key]: parseInt(val) } } });
  };

  const handleSave = async (emp) => {
    setSaving(s => ({ ...s, [emp.id]: true }));
    const ok = await saveReliability(emp.id, month, state.reliability[emp.id]?.[month] || {});
    toast(ok ? '✅ Saved' : '❌ Failed', ok ? undefined : 'er');
    setSaving(s => ({ ...s, [emp.id]: false }));
  };

  const REL_ALL = [...REL_ITEMS, { key: 'creativity', label: '🎨 Creativity', desc: 'Creative contribution' }];

  const scoreColor = (v) => v >= 80 ? 'var(--green)' : v >= 60 ? 'var(--amber)' : 'var(--red)';

  return (
    <div style={{ padding: 20 }}>
      <div className="sec-hdr">
        <div><div className="sec-title">📈 Reliability Scores</div><div className="sec-sub">Month: {month}</div></div>
      </div>

      {/* ── How Reliability works (client feedback #7) ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>ℹ️ How the Reliability module works</div>
        <div style={{ fontSize: 12, color: 'var(--mt)', lineHeight: 1.7 }}>
          Admin rates each employee <strong style={{ color: 'var(--txt)' }}>once per month</strong> on 5 reliability areas
          (On-time Delivery, Emergency Response, Team Coordination, Night Shift Support, Pressure Handling) plus Creativity —
          each on a <strong style={{ color: 'var(--txt)' }}>0–10 slider</strong>. Unrated areas default to 7 (Creativity defaults to 5).
        </div>
        <div style={{ fontSize: 12, color: 'var(--mt)', lineHeight: 1.7, marginTop: 8 }}>
          <strong style={{ color: 'var(--txt)' }}>Calculation:</strong> the 5 reliability ratings are averaged and scaled to 100
          — e.g. an average of 8/10 = Reliability score 80. This contributes <strong style={{ color: 'var(--amber)' }}>20%</strong> of
          the employee's final performance score. Creativity is scaled the same way (×10) and contributes
          <strong style={{ color: 'var(--purple)' }}> 10%</strong>. The ring on each card shows the employee's overall final score
          (Quality 40% + Output 30% + Reliability 20% + Creativity 10%).
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))', gap: 16 }}>
        {state.emps.filter(e => e.is_active).map(emp => {
          const sc = calcScore(emp.id, emp.dept, month, state.daily, state.prodDaily, state.quality, state.reliability);
          const avg = Math.round(REL_ALL.reduce((s, r) => s + getVal(emp.id, r.key), 0) / REL_ALL.length * 10);
          return (
            <div key={emp.id} style={{ background: 'var(--surf)', border: '1px solid var(--brd)', borderRadius: 14, padding: 20, boxShadow: 'var(--sh)' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--brd)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--txt)' }}>{emp.name}</div>
                  <div style={{ fontSize: '.72rem', color: 'var(--mt)', marginTop: 2 }}>{emp.id} · {emp.dept}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <svg viewBox="0 0 64 64" width="64" height="64">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="var(--surf2)" strokeWidth="6" />
                    <circle cx="32" cy="32" r="26" fill="none" stroke={scoreColor(sc.final)} strokeWidth="6"
                      strokeDasharray={`${(sc.final / 100) * 163.4} 163.4`} strokeLinecap="round" transform="rotate(-90 32 32)" />
                    <text x="32" y="36" textAnchor="middle" fontSize="14" fontWeight="800" fill={scoreColor(sc.final)}>{sc.final}</text>
                  </svg>
                </div>
              </div>
              {/* Sliders */}
              {REL_ALL.map(r => {
                const val = getVal(emp.id, r.key);
                const pct = val / 10;
                const clr = val >= 7 ? 'var(--green)' : val >= 5 ? 'var(--amber)' : 'var(--red)';
                return (
                  <div key={r.key} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '.8rem', color: 'var(--txt)', fontWeight: 500 }}>{r.label}</span>
                      <span style={{ fontSize: '.8rem', fontWeight: 700, color: clr, fontFamily: "'JetBrains Mono'" }}>{val}<span style={{ color: 'var(--dim)', fontWeight: 400 }}>/10</span></span>
                    </div>
                    <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'var(--surf2)' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct * 100}%`, borderRadius: 3, background: clr, transition: 'width .2s' }} />
                      <input type="range" min="0" max="10" value={val} onChange={e => handleChange(emp.id, r.key, e.target.value)}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0 }} />
                    </div>
                  </div>
                );
              })}
              <button className="btn btn-p btn-sm" style={{ width: '100%', marginTop: 12 }} onClick={() => handleSave(emp)} disabled={saving[emp.id]}>
                {saving[emp.id] ? 'Saving…' : '💾 Save Reliability'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Producers / Voice Over ────────────────────────────────────────────────────
export function ProducersPage({ selDate }) {
  const { state, dispatch } = useApp();
  const { saveProdEntry } = useData();
  const toast = useToast();
  const [saving, setSaving] = useState({});
  const [deptFilter, setDeptFilter] = useState('News Producer');

  const emps = state.emps.filter(e => e.is_active && e.dept === deptFilter);
  const fields = deptFilter === 'News Producer' ? PROD_FIELDS : VO_FIELDS;
  const getVal = (empId, key) => state.prodDaily[empId]?.[selDate]?.[key] || '';

  const handleChange = (empId, key, val) => {
    const cur = state.prodDaily[empId]?.[selDate] || {};
    dispatch({ type: 'UPDATE_PROD_DAILY', payload: { empId, date: selDate, data: { ...cur, [key]: val } } });
  };

  const handleSave = async (emp) => {
    setSaving(s => ({ ...s, [emp.id]: true }));
    const ok = await saveProdEntry(emp.id, selDate, emp.dept, state.prodDaily[emp.id]?.[selDate] || {});
    toast(ok ? '✅ Saved' : '❌ Failed', ok ? undefined : 'er');
    setSaving(s => ({ ...s, [emp.id]: false }));
  };

  return (
    <div style={{ padding: 20 }}>
      <div className="sec-hdr">
        <div><div className="sec-title">🎙 Producers & Voice Over</div><div className="sec-sub">{fmtDate(selDate)}</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['News Producer', 'Voice Over'].map(d => <Pill key={d} active={deptFilter === d} onClick={() => setDeptFilter(d)}>{d}</Pill>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
        {emps.length === 0 && <div style={{ color: 'var(--mt)', padding: 20 }}>No active {deptFilter} staff.</div>}
        {emps.map(emp => (
          <div key={emp.id} style={{ background: 'var(--surf)', border: '1px solid var(--brd)', borderRadius: 14, padding: 20, boxShadow: 'var(--sh)' }}>
            <div style={{ fontWeight: 700, marginBottom: 16, color: 'var(--txt)', paddingBottom: 10, borderBottom: '1px solid var(--brd)' }}>
              {emp.name} <span style={{ fontSize: '.72rem', color: 'var(--mt)' }}>· {emp.id}</span>
            </div>
            {fields.map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
                <label style={{ flex: 1, fontSize: '.82rem', color: 'var(--txt)' }}>{f.label}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => handleChange(emp.id, f.key, Math.max(0, (parseInt(getVal(emp.id, f.key)) || 0) - 1))}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--brd)', background: 'var(--surf2)', color: 'var(--txt)', cursor: 'pointer', fontWeight: 700 }}>−</button>
                  <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 700, fontFamily: "'JetBrains Mono'", color: 'var(--blue)' }}>{parseInt(getVal(emp.id, f.key)) || 0}</span>
                  <button onClick={() => handleChange(emp.id, f.key, (parseInt(getVal(emp.id, f.key)) || 0) + 1)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--brd)', background: 'var(--surf2)', color: 'var(--txt)', cursor: 'pointer', fontWeight: 700 }}>+</button>
                </div>
              </div>
            ))}
            <textarea rows="2" placeholder="Notes…" value={getVal(emp.id, 'notes')} onChange={e => handleChange(emp.id, 'notes', e.target.value)}
              style={{ width: '100%', border: '1px solid var(--brd)', borderRadius: 8, padding: '7px 10px', fontSize: '.8rem', background: 'var(--surf2)', color: 'var(--txt)', resize: 'vertical', fontFamily: 'inherit', marginBottom: 10 }} />
            <button className="btn btn-p btn-sm" style={{ width: '100%' }} onClick={() => handleSave(emp)} disabled={saving[emp.id]}>
              {saving[emp.id] ? 'Saving…' : '💾 Save'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Task Search ───────────────────────────────────────────────────────────────
export function TaskSearchPage({ empId: filterEmpId }) {
  const { state } = useApp();
  const [q, setQ]             = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const filterEmp  = filterEmpId ? state.emps.find(e => String(e.id) === String(filterEmpId)) : null;
  const filterDept = filterEmp?.dept || null;
  const isAdmin        = !filterEmpId;
  const isNewsProducer = filterDept === 'News Producer';
  const isNLEEditor    = filterDept === 'NLE Editor';
  // isVoiceOver: can only search own prod entries — not implemented here (no NLE access)

  const handleSearch = async () => {
    const term = q.trim().toLowerCase();
    setLoading(true);
    setError('');
    setResults(null);

    try {
      // ── JOIN nle_daily_entries with employees directly in Supabase ────────
      // This avoids empMap/_uuid dependency entirely — works for all roles
      let query = sb
        .from('nle_daily_entries')
        .select(`
          id, emp_id, date, news_type, description, start_time, end_time,
          employees!inner ( emp_code, name, dept )
        `)
        .eq('employees.dept', 'NLE Editor')
        .order('date', { ascending: false })
        .limit(5000);

      if (typeFilter !== 'all') {
        query = query.eq('news_type', typeFilter);
      }

      // Apply DB-level text search on description and news_type
      if (term) {
        query = query.or(
          `description.ilike.%${term}%,news_type.ilike.%${term}%`
        );
      }

      const { data: rows, error: dbErr } = await query;
      if (dbErr) { setError('Search failed: ' + dbErr.message); setLoading(false); return; }

      // ── Client feedback #9: also include Producer/VO tasks in results ─────
      // producer_daily stores tasks as a JSON array, so text matching happens
      // client-side after fetching rows joined with employees.
      let prodFound = [];
      if (typeFilter === 'all') { // typeFilter values are NLE news types — producer tasks only match "all"
        const { data: pRows, error: pErr } = await sb
          .from('producer_daily')
          .select(`emp_id, date, dept, tasks, employees!inner ( emp_code, name, dept )`)
          .order('date', { ascending: false })
          .limit(3000);
        if (pErr) { console.error('Producer search failed:', pErr.message); }
        prodFound = (pRows || []).flatMap(r => {
          const emp = r.employees;
          if (!emp) return [];
          const pf = emp.dept === 'News Producer' ? PROD_FIELDS : VO_FIELDS;
          return (r.tasks || []).map(t => {
            const f = pf.find(x => x.key === t.type);
            if (term) {
              const hay = [emp.name, emp.emp_code, emp.dept, t.type || '', f?.label || '', t.label || ''].join(' ').toLowerCase();
              if (!hay.includes(term)) return null;
            }
            return {
              empName: emp.name, empCode: emp.emp_code, dept: emp.dept,
              date: r.date, type: t.type,
              desc: t.label || '',
              startTime: t.startTime || '', endTime: t.endTime || '',
              nt: f ? { icon: f.icon, label: f.label, color: f.color } : null,
            };
          }).filter(Boolean);
        });
      }

      // ── Map and apply client-side name filter ─────────────────────────────
      const found = (rows || [])
        .map(r => {
          const emp = r.employees;
          if (!emp || emp.dept !== 'NLE Editor') return null;
          if (typeFilter !== 'all' && r.news_type !== typeFilter) return null;
          const nt = NEWS_TYPES.find(n => n.key === r.news_type);
          // Client-side filter for employee name search
          if (term) {
            const hay = [emp.name, emp.emp_code, r.news_type, nt?.label || '', r.description || ''].join(' ').toLowerCase();
            if (!hay.includes(term)) return null;
          }
          return {
            empName:   emp.name,
            empCode:   emp.emp_code,
            dept:      emp.dept,
            date:      r.date,
            type:      r.news_type,
            desc:      r.description || '',
            startTime: r.start_time?.slice(0,5) || '',
            endTime:   r.end_time?.slice(0,5)   || '',
            nt,
          };
        })
        .filter(Boolean);

      // Merge NLE + Producer/VO results, newest first
      const merged = [...found, ...prodFound].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
      setResults(merged);
    } catch (e) {
      setError('Unexpected error: ' + e.message);
    }
    setLoading(false);
  };

  const exportXLS = () => {
    if (!results?.length) return;
    const rows = [['Date','Employee','ID','Dept','Type/Activity','Description','Start','End']];
    results.forEach(r => rows.push([r.date, r.empName, r.empCode, r.dept, r.nt?.label||r.type, r.desc, r.startTime, r.endTime]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Search Results');
    XLSX.writeFile(wb, `TJ_Search_${todayStr()}.xlsx`);
  };

  const roleLabel = 'All NLE Editors + Producer/VO tasks — live from database';

  return (
    <div style={{ padding: 20 }}>
      <div className="sec-hdr">
        <div>
          <div className="sec-title">🔍 Task Search</div>
          <div className="sec-sub">{roleLabel}</div>
        </div>
        {results?.length > 0 && (
          <button className="btn btn-p btn-sm" onClick={exportXLS}>📊 Export Excel</button>
        )}
      </div>

      {isNewsProducer && (
        <div style={{ marginBottom: 14, padding: '10px 16px', background: 'var(--bl)', borderRadius: 10, fontSize: '.82rem', color: 'var(--blue)', fontWeight: 600, border: '1px solid rgba(35,97,212,.2)' }}>
          📋 Searching across <strong>all NLE Editors'</strong> tasks. Results fetched fresh from database.
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <select
            className="inp"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="all">All News Types</option>
            {NEWS_TYPES.map(nt => (
              <option key={nt.key} value={nt.key}>{nt.icon} {nt.label}</option>
            ))}
          </select>
          <input
            className="inp"
            placeholder="Search headlines, description, editor name…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button className="btn btn-p" onClick={handleSearch} disabled={loading}>
            {loading ? <><span className="spinner" style={{width:14,height:14,borderWidth:2}}/> Searching…</> : '🔍 Search'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--rl)', color: 'var(--red)', borderRadius: 8, marginBottom: 12, fontSize: '.82rem' }}>
            ❌ {error}
          </div>
        )}

        {results !== null && !loading && (
          <>
            <div style={{ fontSize: '.8rem', color: 'var(--mt)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, color: 'var(--txt)' }}>{results.length}</span> result{results.length !== 1 ? 's' : ''}
              {q && <span>for "<strong>{q}</strong>"</span>}
              <span style={{ marginLeft: 'auto', color: 'var(--green)', fontSize: '.75rem' }}>● Live data</span>
            </div>

            {results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--dim)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                No matching tasks found.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surf2)' }}>
                      {['#', 'Date', 'Employee', 'ID', 'Dept', 'Type/Activity', 'Description', 'IN', 'OUT'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: 'var(--mt)', fontWeight: 700, fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '2px solid var(--brd)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--brd)', background: i%2===0?'transparent':'var(--surf2)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--dim)', fontSize: '.74rem', fontWeight: 700 }}>{i+1}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--mt)', fontFamily: "'JetBrains Mono'", fontSize: '.76rem', whiteSpace: 'nowrap' }}>{r.date}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--txt)', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.empName}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--mt)', fontFamily: "'JetBrains Mono'", fontSize: '.74rem' }}>{r.empCode}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--mt)', fontSize: '.74rem', whiteSpace: 'nowrap' }}>{r.dept}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: (r.nt?.color||'#888')+'22', color: r.nt?.color||'#888', padding: '2px 8px', borderRadius: 5, fontSize: '.74rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {r.nt?.icon} {r.nt?.label||r.type}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--txt)', maxWidth: 240, wordBreak: 'break-word' }}>{r.desc||'—'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--green)', fontFamily: "'JetBrains Mono'", fontSize: '.76rem', whiteSpace: 'nowrap' }}>{r.startTime||'—'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--red)', fontFamily: "'JetBrains Mono'", fontSize: '.76rem', whiteSpace: 'nowrap' }}>{r.endTime||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Full Report ───────────────────────────────────────────────────────────────
const RANGE_OPTS = [
  { id: 'today', label: '📅 Today' },
  { id: 'week',  label: '📆 This Week' },
  { id: 'month', label: '🗓 This Month' },
  { id: 'custom',label: '🔎 Date Range' },
];

// ── Full Report ───────────────────────────────────────────────────────────────
function getDatesR(rangeId, from, to) {
  const today = todayStr();
  if (rangeId === 'today') return [today];
  if (rangeId === 'week') {
    const d = new Date(today + 'T12:00:00');
    const mon = new Date(d); mon.setDate(d.getDate() - (d.getDay()===0?6:d.getDay()-1));
    return Array.from({length:7}, (_,i) => { const r=new Date(mon); r.setDate(mon.getDate()+i); return r.toISOString().slice(0,10); });
  }
  if (rangeId === 'month') {
    const [y,m] = today.split('-').map(Number);
    const days = new Date(y,m,0).getDate();
    return Array.from({length:days}, (_,i) => `${today.slice(0,7)}-${String(i+1).padStart(2,'0')}`);
  }
  if (rangeId === 'custom' && from && to && from <= to) {
    const dates=[]; let cur=from, s=0;
    while(cur<=to && s<400){dates.push(cur);cur=addDaysISO(cur,1);s++;}
    return dates;
  }
  return [today];
}

export function ReportPage({ selDate }) {
  const { state } = useApp();
  const reportRef = useRef();
  const today = todayStr();
  const [range, setRange]       = useState('month');
  const [customFrom, setCustomFrom] = useState(today.slice(0,7)+'-01');
  const [customTo,   setCustomTo]   = useState(today);
  const [exporting, setExporting]   = useState(false);

  // Always compute via "Generate" button click to avoid re-computing on every keystroke
  const initDates = getDatesR('month', customFrom, customTo);
  const [dates, setDates] = useState(initDates);
  const [generated, setGenerated] = useState(true);

  const handleGenerate = () => {
    setDates(getDatesR(range, customFrom, customTo));
    setGenerated(true);
  };

  // When range button clicked, auto-generate immediately
  const handleRange = (r) => {
    setRange(r);
    if (r !== 'custom') setDates(getDatesR(r, customFrom, customTo));
  };

  const dateLabel = dates.length === 1
    ? fmtS(dates[0])
    : `${fmtS(dates[0])} → ${fmtS(dates[dates.length-1])}`;

  const activeNLETypes = NEWS_TYPES.filter(nt =>
    state.emps.filter(e=>e.is_active&&e.dept==='NLE Editor')
      .some(emp => dates.some(d => (state.daily[emp.id]?.[d]||[]).some(it=>it.type===nt.key)))
  );

  // Score breakdown popup — click any Score value to see the calculation
  const [scoreInfo, setScoreInfo] = useState(null); // { emp, sc }

  // ── Client feedback: per-column sorting — click any header (name, each item,
  //    total, points, time, score…) to sort asc/desc ──
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const clickSort = (key) => setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  const arrow = (k) => sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const sortRows = (arr) => [...arr].sort((x, y) => {
    const a = x.s[sort.key] ?? x.s.name, b = y.s[sort.key] ?? y.s.name;
    const r = typeof a === 'string' ? a.localeCompare(String(b)) : a - b;
    return sort.dir === 'asc' ? r : -r;
  });

  const nleEmps  = state.emps.filter(e=>e.is_active&&e.dept==='NLE Editor');
  const prodEmps = state.emps.filter(e=>e.is_active&&e.dept==='News Producer');
  const voEmps   = state.emps.filter(e=>e.is_active&&e.dept==='Voice Over');

  // Team totals for tables
  const nleTypeTotals = activeNLETypes.map(nt => nleEmps.reduce((s, emp) => {
    const allItems = dates.flatMap(d => state.daily[emp.id]?.[d] || []);
    return s + allItems.filter(it => it.type === nt.key).length;
  }, 0));
  const nleTotalItems = nleTypeTotals.reduce((s, v) => s + v, 0);
  const nleTotalWpts = nleEmps.reduce((s, emp) => {
    const allItems = dates.flatMap(d => state.daily[emp.id]?.[d] || []);
    return s + allItems.reduce((ss, it) => ss + (NEWS_TYPES.find(n => n.key === it.type)?.weight || 0), 0);
  }, 0);
  const nleTotalMins = nleEmps.reduce((s, emp) => {
    const allItems = dates.flatMap(d => state.daily[emp.id]?.[d] || []);
    return s + allItems.reduce((ss, it) => ss + (tdiff(it.startTime, it.endTime) ?? it.manualMins ?? 0), 0);
  }, 0);
  const nleAvgScore = nleEmps.length ? Math.round(nleEmps.reduce((s, emp) => s + calcScore(emp.id, emp.dept, dates[dates.length-1].slice(0,7), state.daily, state.prodDaily, state.quality, state.reliability).final, 0) / nleEmps.length) : 0;

  const prodFieldTotals = PROD_FIELDS.map(f => prodEmps.reduce((s, emp) => s + dates.reduce((ss, d) => ss + (parseInt(state.prodDaily[emp.id]?.[d]?.[f.key]) || 0), 0), 0));
  const prodTotalPresent = prodEmps.reduce((s, emp) => s + dates.filter(d => state.attendance[emp.id]?.[d]?.in_time).length, 0);
  const prodAvgScore = prodEmps.length ? Math.round(prodEmps.reduce((s, emp) => s + calcScore(emp.id, emp.dept, dates[dates.length-1].slice(0,7), state.daily, state.prodDaily, state.quality, state.reliability).final, 0) / prodEmps.length) : 0;

  const voFieldTotals = VO_FIELDS.map(f => voEmps.reduce((s, emp) => s + dates.reduce((ss, d) => ss + (parseInt(state.prodDaily[emp.id]?.[d]?.[f.key]) || 0), 0), 0));
  const voTotalPresent = voEmps.reduce((s, emp) => s + dates.filter(d => state.attendance[emp.id]?.[d]?.in_time).length, 0);
  const voAvgScore = voEmps.length ? Math.round(voEmps.reduce((s, emp) => s + calcScore(emp.id, emp.dept, dates[dates.length-1].slice(0,7), state.daily, state.prodDaily, state.quality, state.reliability).final, 0) / voEmps.length) : 0;

  // Errors + point deductions for an employee across the report's date range
  const rangeErr = (empId) => {
    let cnt = 0, ded = 0;
    dates.forEach(d => {
      const q = state.quality[empId]?.[d] || {};
      QUALITY_ITEMS.forEach(qi => { const c = parseInt(q[qi.key]) || 0; if (c > 0 && qi.pts < 0) { cnt += c; ded += Math.abs(qi.pts) * c; } });
    });
    return { cnt, ded };
  };

  // Precomputed per-employee rows — flat `s` map holds every sortable value
  const nleData = sortRows(nleEmps.map(emp => {
    const allItems = dates.flatMap(d=>state.daily[emp.id]?.[d]||[]);
    const counts = {}; activeNLETypes.forEach(nt => { counts[nt.key] = allItems.filter(it=>it.type===nt.key).length; });
    const wpts = allItems.reduce((s2,it)=>{const nt=NEWS_TYPES.find(n=>n.key===it.type);return s2+(nt?.weight||0);},0);
    const mins = allItems.reduce((s2,it)=>s2+(tdiff(it.startTime,it.endTime)??it.manualMins??0),0);
    const sc = calcScore(emp.id,emp.dept,dates[dates.length-1].slice(0,7),state.daily,state.prodDaily,state.quality,state.reliability);
    const er = rangeErr(emp.id);
    return { emp, s: { name: emp.name, ...counts, total: allItems.length, wpts, mins, errors: er.cnt, deduct: er.ded, score: sc.final } };
  }));
  const prodData = sortRows(prodEmps.map(emp => {
    const vals = {}; PROD_FIELDS.forEach(f => { vals[f.key] = dates.reduce((s2,d)=>s2+(parseInt(state.prodDaily[emp.id]?.[d]?.[f.key])||0),0); });
    const present = dates.filter(d=>state.attendance[emp.id]?.[d]?.in_time).length;
    const sc = calcScore(emp.id,emp.dept,dates[dates.length-1].slice(0,7),state.daily,state.prodDaily,state.quality,state.reliability);
    const er = rangeErr(emp.id);
    return { emp, s: { name: emp.name, ...vals, present, errors: er.cnt, deduct: er.ded, score: sc.final } };
  }));
  const voData = sortRows(voEmps.map(emp => {
    const vals = {}; VO_FIELDS.forEach(f => { vals[f.key] = dates.reduce((s2,d)=>s2+(parseInt(state.prodDaily[emp.id]?.[d]?.[f.key])||0),0); });
    const present = dates.filter(d=>state.attendance[emp.id]?.[d]?.in_time).length;
    const sc = calcScore(emp.id,emp.dept,dates[dates.length-1].slice(0,7),state.daily,state.prodDaily,state.quality,state.reliability);
    const er = rangeErr(emp.id);
    return { emp, s: { name: emp.name, ...vals, present, errors: er.cnt, deduct: er.ded, score: sc.final } };
  }));

  const Th = ({children, center, color, sk}) => (
    <th onClick={sk ? () => clickSort(sk) : undefined}
      title={sk ? 'Click to sort' : undefined}
      style={{padding:'9px 10px',textAlign:center?'center':'left',color:color||'var(--mt)',fontWeight:700,
      fontSize:'.72rem',borderBottom:'2px solid var(--brd)',background:'var(--surf2)',whiteSpace:'nowrap',minWidth:50,
      cursor: sk ? 'pointer' : 'default', userSelect:'none'}}>
      {children}{sk ? arrow(sk) : ''}
    </th>
  );

  const exportExcel = () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      // NLE sheet
      const nleH = ['#','Name','ID',...activeNLETypes.map(n=>n.label),'Total','Pts','Time','Errors','Deduct','Score'];
      const nleRows = [nleH];
      nleData.forEach((row,i) => {
        const emp = row.emp;
        const allItems = dates.flatMap(d=>state.daily[emp.id]?.[d]||[]);
        const wpts = allItems.reduce((s,it)=>{const nt=NEWS_TYPES.find(n=>n.key===it.type);return s+(nt?.weight||0);},0);
        const mins = allItems.reduce((s,it)=>s+(tdiff(it.startTime,it.endTime)??it.manualMins??0),0);
        const sc = calcScore(emp.id,emp.dept,dates[dates.length-1].slice(0,7),state.daily,state.prodDaily,state.quality,state.reliability);
        nleRows.push([i+1,emp.name,emp.id,...activeNLETypes.map(nt=>allItems.filter(it=>it.type===nt.key).length||'—'),allItems.length,wpts,fmtMin(mins),row.s.errors||'—',row.s.deduct?`-${row.s.deduct}`:'—',sc.final]);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(nleRows), 'NLE Editors');
      // Producer sheet
      const pRows = [['#','Name','ID',...PROD_FIELDS.map(f=>f.label),'Errors','Deduct','Score']];
      prodData.forEach((row,i) => {
        const emp = row.emp;
        const sc = calcScore(emp.id,emp.dept,dates[dates.length-1].slice(0,7),state.daily,state.prodDaily,state.quality,state.reliability);
        pRows.push([i+1,emp.name,emp.id,...PROD_FIELDS.map(f=>dates.reduce((s,d)=>s+(parseInt(state.prodDaily[emp.id]?.[d]?.[f.key])||0),0)||'—'),row.s.errors||'—',row.s.deduct?`-${row.s.deduct}`:'—',sc.final]);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pRows), 'News Producers');
      // VO sheet
      const vRows = [['#','Name','ID',...VO_FIELDS.map(f=>f.label),'Errors','Deduct','Score']];
      voData.forEach((row,i) => {
        const emp = row.emp;
        const sc = calcScore(emp.id,emp.dept,dates[dates.length-1].slice(0,7),state.daily,state.prodDaily,state.quality,state.reliability);
        vRows.push([i+1,emp.name,emp.id,...VO_FIELDS.map(f=>dates.reduce((s,d)=>s+(parseInt(state.prodDaily[emp.id]?.[d]?.[f.key])||0),0)||'—'),row.s.errors||'—',row.s.deduct?`-${row.s.deduct}`:'—',sc.final]);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vRows), 'Voice Over');
      XLSX.writeFile(wb, `TJ_MIS_Report_${dateLabel.replace(/ /g,'_')}.xlsx`);
    } catch(e){console.error(e);}
    setExporting(false);
  };

  const exportImage = async () => {
    const el = reportRef.current;
    if (!el) return;
    try {
      // Save original styles
      const prev = {
        overflow: el.style.overflow, width: el.style.width,
        height: el.style.height, position: el.style.position,
      };
      // Expand to full content size — critical for mobile where content is clipped
      el.style.overflow = 'visible';
      el.style.position = 'relative';
      el.style.width    = el.scrollWidth  + 'px';
      el.style.height   = el.scrollHeight + 'px';
      // Small delay to let browser reflow before capture
      await new Promise(r => setTimeout(r, 100));
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth:  el.scrollWidth,
        windowHeight: el.scrollHeight,
      });
      // Restore styles
      el.style.overflow = prev.overflow;
      el.style.position = prev.position;
      el.style.width    = prev.width;
      el.style.height   = prev.height;
      const link = document.createElement('a');
      link.download = `TJ_Report_${today}.png`;
      link.href = canvas.toDataURL('image/png');
      // On mobile use share sheet if available
      if (navigator.share) {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const file = new File([blob], link.download, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ title: 'TJ MIS Report', files: [file] }); return; }
          catch(e) { if (e.name === 'AbortError') return; }
        }
      }
      link.click();
    } catch(e){ console.error('Image export failed:', e); }
  };

  // Reusable table styles
  const tdBase = {padding:'10px 10px',borderBottom:'1px solid var(--brd)',verticalAlign:'middle'};

  return (
    <div style={{padding:20}}>
      {/* ── Score calculation breakdown popup ── */}
      {scoreInfo && (() => {
        const { emp, sc } = scoreInfo;
        const scMonth = dates[dates.length-1].slice(0,7);
        const qDed = 100 - sc.qualityScore;
        const parts = [
          { l:'Quality',     v:sc.qualityScore,    w:40, c:'var(--green)',  d:qDed>0?`100 − ${qDed} pts of errors this month`:'100 — no errors this month' },
          { l:'Output',      v:sc.outputScore,     w:30, c:'var(--blue)',   d:`${sc.wpts} weighted pts ÷ 1.5 (max 100)` },
          { l:'Reliability', v:sc.reliScore,       w:20, c:'var(--amber)',  d:'admin monthly ratings (0–10 avg × 10)' },
          { l:'Creativity',  v:sc.creativityScore, w:10, c:'var(--purple)', d:'admin monthly rating (0–10 × 10)' },
        ];
        return (
          <div onClick={()=>setScoreInfo(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div onClick={e=>e.stopPropagation()} style={{background:'var(--surf)',borderRadius:16,padding:22,maxWidth:440,width:'100%',border:'1px solid var(--brd)',boxShadow:'0 10px 40px rgba(0,0,0,.3)'}}>
              <div style={{fontSize:14,fontWeight:800,marginBottom:2}}>🧮 Score Calculation — {emp.name}</div>
              <div style={{fontSize:11,color:'var(--mt)',marginBottom:14}}>Score is always monthly · showing {scMonth}</div>
              {parts.map(pt=>(
                <div key={pt.l} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,background:'var(--surf2)',marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:pt.c}}>{pt.l} <span style={{color:'var(--mt)',fontWeight:400}}>· {pt.w}% weight</span></div>
                    <div style={{fontSize:10.5,color:'var(--mt)',marginTop:1}}>{pt.d}</div>
                  </div>
                  <div style={{textAlign:'right',fontFamily:"'JetBrains Mono'",whiteSpace:'nowrap'}}>
                    <span style={{fontSize:13,fontWeight:800,color:pt.c}}>{pt.v}</span>
                    <span style={{fontSize:11,color:'var(--mt)'}}> × {pt.w/100} = </span>
                    <span style={{fontSize:13,fontWeight:800,color:'var(--txt)'}}>{Math.round(pt.v*pt.w)/100}</span>
                  </div>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',borderRadius:8,background:'var(--bl)',marginTop:4}}>
                <span style={{fontSize:12,fontWeight:800,color:'var(--blue)'}}>FINAL SCORE (rounded)</span>
                <span style={{fontSize:18,fontWeight:800,color:'var(--blue)',fontFamily:"'JetBrains Mono'"}}>{sc.final}/100</span>
              </div>
              <button onClick={()=>setScoreInfo(null)} style={{width:'100%',marginTop:12,background:'var(--surf2)',border:'1px solid var(--brd)',color:'var(--txt)',borderRadius:9,padding:10,fontSize:12,fontWeight:700,cursor:'pointer'}}>Close</button>
            </div>
          </div>
        );
      })()}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:'1.2rem',fontWeight:800,color:'var(--txt)',letterSpacing:'-.3px'}}>Full MIS Report</div>
        <div style={{fontSize:'.82rem',color:'var(--mt)',marginTop:2}}>{dateLabel} Report</div>
      </div>

      {/* Controls card */}
      <div className="card" style={{marginBottom:20}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {[{id:'today',label:'📅 Today'},{id:'week',label:'📆 This Week'},{id:'month',label:'🗓 This Month'}].map(r=>(
            <button key={r.id} onClick={()=>handleRange(r.id)} style={{
              padding:'8px 18px',borderRadius:999,border:'1px solid var(--brd)',
              background:range===r.id?'var(--blue)':'var(--surf2)',
              color:range===r.id?'#fff':'var(--mt)',
              fontSize:'.82rem',cursor:'pointer',fontWeight:range===r.id?700:400,
              transition:'all .15s'
            }}>{r.label}</button>
          ))}
          <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:4}}>
            <span style={{fontSize:'.78rem',color:'var(--mt)',fontWeight:600}}>FROM</span>
            <input type="date" className="inp inp-sm" style={{maxWidth:160}} value={customFrom}
              onChange={e=>{setCustomFrom(e.target.value);setRange('custom');}}/>
            <span style={{fontSize:'.78rem',color:'var(--mt)',fontWeight:600}}>TO</span>
            <input type="date" className="inp inp-sm" style={{maxWidth:160}} value={customTo} min={customFrom}
              onChange={e=>{setCustomTo(e.target.value);setRange('custom');}}/>
            <button className="btn btn-p btn-sm" onClick={handleGenerate}>⚡ Generate</button>
          </div>
        </div>
      </div>

      {/* Export buttons */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <button className="btn btn-s" onClick={exportExcel} disabled={exporting}>
          📊 {exporting?'Exporting…':'Excel'}
        </button>
        <button className="btn btn-s" onClick={exportImage}>🖼 Image</button>
        <span style={{marginLeft:'auto',fontSize:'.72rem',color:'var(--mt)',alignSelf:'center'}}>💡 Click any column heading to sort (▲ / ▼)</span>
      </div>

      {/* Report body */}
      <div ref={reportRef}>

        {/* Header banner */}
        <div style={{
          background:'linear-gradient(135deg,#1a3a8f 0%,#0d6eab 60%,#0a9396 100%)',
          borderRadius:14,padding:'20px 28px',marginBottom:20,
          boxShadow:'0 4px 20px rgba(26,58,143,.3)'
        }}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <div>
              <div style={{fontSize:'1.2rem',fontWeight:800,color:'#fff',letterSpacing:'.02em'}}>TAMILJANAM NLE PRODUCTION</div>
              <div style={{fontSize:'.78rem',color:'rgba(255,255,255,.7)',marginTop:4}}>MIS Report · {dateLabel}</div>
            </div>
            <img src="/tj-logo.png" alt="" style={{height:40,opacity:.85}} onError={e=>e.target.style.display='none'}/>
          </div>
        </div>

        {/* ── NLE EDITORS ── */}
        <div style={{background:'var(--surf)',border:'1px solid var(--brd)',borderRadius:14,overflow:'hidden',marginBottom:20,boxShadow:'var(--sh)'}}>
          <div style={{
            background:'linear-gradient(135deg,#1a56db,#0891b2)',
            padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'
          }}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:20}}>🎬</span>
              <div>
                <div style={{fontWeight:800,fontSize:'1rem',color:'#fff'}}>NLE EDITOR</div>
                <div style={{fontSize:'.7rem',color:'rgba(255,255,255,.7)'}}>{nleEmps.length} staff</div>
              </div>
            </div>
            <span style={{fontSize:'.75rem',color:'rgba(255,255,255,.8)',fontFamily:"'JetBrains Mono'"}}>{dateLabel}</span>
          </div>
          {activeNLETypes.length === 0 ? (
            <div style={{textAlign:'center',padding:40,color:'var(--mt)'}}>
              <div style={{fontSize:32,marginBottom:8}}>📭</div>No NLE entries for this period.
            </div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
                <thead>
                  <tr style={{background:'var(--surf2)'}}>
                    <Th>#</Th>
                    <Th sk="name">Name</Th>
                    <Th>ID</Th>
                    {activeNLETypes.map(nt=>(
                      <th key={nt.key} onClick={()=>clickSort(nt.key)} title="Click to sort"
                        style={{padding:'10px 8px',textAlign:'center',color:nt.color,fontWeight:700,
                        fontSize:'.7rem',borderBottom:'2px solid var(--brd)',background:'var(--surf2)',
                        whiteSpace:'nowrap',minWidth:58,cursor:'pointer',userSelect:'none'}}>
                        <div style={{fontSize:16,marginBottom:2}}>{nt.icon}</div>
                        <div>{nt.label.replace(/\s/g,'_')}{arrow(nt.key)}</div>
                      </th>
                    ))}
                    <Th center sk="total">Total</Th>
                    <Th center sk="wpts">Pts</Th>
                    <Th center sk="mins">Time</Th>
                    <Th center sk="errors" color="var(--red)">Errors</Th>
                    <Th center sk="deduct" color="var(--red)">Deduct</Th>
                    <Th center sk="score">Score</Th>
                  </tr>
                </thead>
                <tbody>
                  {nleData.map((row,idx)=>{ const emp=row.emp;
                    const allItems = dates.flatMap(d=>state.daily[emp.id]?.[d]||[]);
                    const wpts = allItems.reduce((s,it)=>{const nt=NEWS_TYPES.find(n=>n.key===it.type);return s+(nt?.weight||0);},0);
                    const mins = allItems.reduce((s,it)=>s+(tdiff(it.startTime,it.endTime)??it.manualMins??0),0);
                    const sc = calcScore(emp.id,emp.dept,dates[dates.length-1].slice(0,7),state.daily,state.prodDaily,state.quality,state.reliability);
                    const gc = sc.final>=80?'var(--green)':sc.final>=60?'var(--amber)':'var(--red)';
                    return (
                      <tr key={emp.id} style={{borderBottom:'1px solid var(--brd)',background:idx%2===0?'transparent':'var(--surf2)'}}>
                        <td style={{...tdBase,color:'var(--mt)',textAlign:'center'}}>{idx+1}</td>
                        <td style={{...tdBase,fontWeight:700,color:'var(--txt)',whiteSpace:'nowrap'}}>{emp.name}</td>
                        <td style={{...tdBase,color:'var(--mt)',fontFamily:"'JetBrains Mono'",fontSize:'.74rem'}}>{emp.id}</td>
                        {activeNLETypes.map(nt=>{
                          const cnt=allItems.filter(it=>it.type===nt.key).length;
                          return (
                            <td key={nt.key} style={{...tdBase,textAlign:'center',fontWeight:cnt>0?700:400,color:cnt>0?nt.color:'var(--dim)',fontFamily:"'JetBrains Mono'"}}>
                              {cnt>0?cnt:'—'}
                            </td>
                          );
                        })}
                        <td style={{...tdBase,textAlign:'center',fontWeight:700,color:'var(--blue)',fontFamily:"'JetBrains Mono'"}}>{allItems.length||'—'}</td>
                        <td style={{...tdBase,textAlign:'center',fontWeight:700,color:'var(--amber)',fontFamily:"'JetBrains Mono'"}}>{wpts||'—'}</td>
                        <td style={{...tdBase,textAlign:'center',color:'var(--green)',fontFamily:"'JetBrains Mono'",fontSize:'.78rem'}}>{mins>0?fmtMin(mins):'—'}</td>
                        <td style={{...tdBase,textAlign:'center',fontWeight:row.s.errors>0?700:400,color:row.s.errors>0?'var(--red)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{row.s.errors>0?row.s.errors:'—'}</td>
                        <td style={{...tdBase,textAlign:'center',fontWeight:row.s.deduct>0?700:400,color:row.s.deduct>0?'var(--red)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{row.s.deduct>0?`-${row.s.deduct}`:'—'}</td>
                        <td onClick={()=>setScoreInfo({emp,sc})} title="Click to see how this score is calculated" style={{...tdBase,textAlign:'center',fontWeight:800,color:gc,fontFamily:"'JetBrains Mono'",cursor:'pointer',textDecoration:'underline dotted',textUnderlineOffset:3}}>{sc.final}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:'var(--surf2)'}}>
                    <td style={{...tdBase,color:'var(--mt)',textAlign:'center'}}></td>
                    <td style={{...tdBase,fontWeight:700,color:'var(--txt)'}}>Team Total</td>
                    <td style={{...tdBase}}></td>
                    {nleTypeTotals.map((v,i)=> (
                      <td key={i} style={{...tdBase,textAlign:'center',fontWeight:700,color:activeNLETypes[i].color,fontFamily:"'JetBrains Mono'"}}>{v>0?v:'—'}</td>
                    ))}
                    <td style={{...tdBase,textAlign:'center',fontWeight:800,color:'var(--blue)',fontFamily:"'JetBrains Mono'"}}>{nleTotalItems||'—'}</td>
                    <td style={{...tdBase,textAlign:'center',fontWeight:800,color:'var(--amber)',fontFamily:"'JetBrains Mono'"}}>{nleTotalWpts||'—'}</td>
                    <td style={{...tdBase,textAlign:'center',fontWeight:700,color:'var(--green)',fontFamily:"'JetBrains Mono'",fontSize:'.78rem'}}>{nleTotalMins>0?fmtMin(nleTotalMins):'—'}</td>
                    {(()=>{const c=nleData.reduce((a,r)=>a+r.s.errors,0),d=nleData.reduce((a,r)=>a+r.s.deduct,0);return <>
                      <td style={{...tdBase,textAlign:'center',fontWeight:800,color:c>0?'var(--red)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{c>0?c:'—'}</td>
                      <td style={{...tdBase,textAlign:'center',fontWeight:800,color:d>0?'var(--red)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{d>0?`-${d}`:'—'}</td>
                    </>;})()}
                    <td style={{...tdBase,textAlign:'center',fontWeight:800,color:nleAvgScore>=80?'var(--green)':nleAvgScore>=60?'var(--amber)':'var(--red)',fontFamily:"'JetBrains Mono'"}}>{nleAvgScore}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ── NEWS PRODUCERS ── */}
        {prodEmps.length > 0 && (
          <div style={{background:'var(--surf)',border:'1px solid var(--brd)',borderRadius:14,overflow:'hidden',marginBottom:20,boxShadow:'var(--sh)'}}>
            <div style={{background:'linear-gradient(135deg,#059669,#0d9488)',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:20}}>📋</span>
                <div>
                  <div style={{fontWeight:800,fontSize:'1rem',color:'#fff'}}>NEWS PRODUCER</div>
                  <div style={{fontSize:'.7rem',color:'rgba(255,255,255,.7)'}}>{prodEmps.length} staff</div>
                </div>
              </div>
              <span style={{fontSize:'.75rem',color:'rgba(255,255,255,.8)',fontFamily:"'JetBrains Mono'"}}>{dateLabel}</span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
                <thead>
                  <tr style={{background:'var(--surf2)'}}>
                    <Th>#</Th><Th sk="name">Name</Th><Th>ID</Th>
                    {PROD_FIELDS.map(f=>(
                      <th key={f.key} onClick={()=>clickSort(f.key)} title="Click to sort"
                        style={{padding:'10px 8px',textAlign:'center',color:f.color,fontWeight:700,
                        fontSize:'.7rem',borderBottom:'2px solid var(--brd)',background:'var(--surf2)',whiteSpace:'nowrap',minWidth:70,cursor:'pointer',userSelect:'none'}}>
                        <div style={{fontSize:16,marginBottom:2}}>{f.icon}</div>
                        <div>{f.label}{arrow(f.key)}</div>
                      </th>
                    ))}
                    <Th center sk="present">Present</Th>
                    <Th center sk="errors" color="var(--red)">Errors</Th>
                    <Th center sk="deduct" color="var(--red)">Deduct</Th>
                    <Th center sk="score">Score</Th>
                  </tr>
                </thead>
                <tbody>
                  {prodData.map((row,idx)=>{ const emp=row.emp;
                    const sc = calcScore(emp.id,emp.dept,dates[dates.length-1].slice(0,7),state.daily,state.prodDaily,state.quality,state.reliability);
                    const gc = sc.final>=80?'var(--green)':sc.final>=60?'var(--amber)':'var(--red)';
                    const present = dates.filter(d=>state.attendance[emp.id]?.[d]?.in_time).length;
                    return (
                      <tr key={emp.id} style={{borderBottom:'1px solid var(--brd)',background:idx%2===0?'transparent':'var(--surf2)'}}>
                        <td style={{...tdBase,color:'var(--mt)',textAlign:'center'}}>{idx+1}</td>
                        <td style={{...tdBase,fontWeight:700,color:'var(--txt)',whiteSpace:'nowrap'}}>{emp.name}</td>
                        <td style={{...tdBase,color:'var(--mt)',fontFamily:"'JetBrains Mono'",fontSize:'.74rem'}}>{emp.id}</td>
                        {PROD_FIELDS.map(f=>{
                          const v=dates.reduce((s,d)=>s+(parseInt(state.prodDaily[emp.id]?.[d]?.[f.key])||0),0);
                          return (
                            <td key={f.key} style={{...tdBase,textAlign:'center',fontWeight:v>0?700:400,color:v>0?f.color:'var(--dim)',fontFamily:"'JetBrains Mono'"}}>
                              {v>0?v:'—'}
                            </td>
                          );
                        })}
                        <td style={{...tdBase,textAlign:'center',color:present>0?'var(--green)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{present}/{dates.length}</td>
                        <td style={{...tdBase,textAlign:'center',fontWeight:row.s.errors>0?700:400,color:row.s.errors>0?'var(--red)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{row.s.errors>0?row.s.errors:'—'}</td>
                        <td style={{...tdBase,textAlign:'center',fontWeight:row.s.deduct>0?700:400,color:row.s.deduct>0?'var(--red)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{row.s.deduct>0?`-${row.s.deduct}`:'—'}</td>
                        <td onClick={()=>setScoreInfo({emp,sc})} title="Click to see how this score is calculated" style={{...tdBase,textAlign:'center',fontWeight:800,color:gc,fontFamily:"'JetBrains Mono'",cursor:'pointer',textDecoration:'underline dotted',textUnderlineOffset:3}}>{sc.final}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:'var(--surf2)'}}>
                    <td style={{...tdBase,color:'var(--mt)',textAlign:'center'}}></td>
                    <td style={{...tdBase,fontWeight:700,color:'var(--txt)'}}>Team Total</td>
                    <td style={{...tdBase}}></td>
                    {prodFieldTotals.map((v,i)=> (
                      <td key={i} style={{...tdBase,textAlign:'center',fontWeight:700,color:PROD_FIELDS[i].color,fontFamily:"'JetBrains Mono'"}}>{v>0?v:'—'}</td>
                    ))}
                    <td style={{...tdBase,textAlign:'center',fontWeight:700,color:prodTotalPresent>0?'var(--green)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{prodTotalPresent}/{prodEmps.length * dates.length}</td>
                    {(()=>{const c=prodData.reduce((a,r)=>a+r.s.errors,0),d=prodData.reduce((a,r)=>a+r.s.deduct,0);return <>
                      <td style={{...tdBase,textAlign:'center',fontWeight:800,color:c>0?'var(--red)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{c>0?c:'—'}</td>
                      <td style={{...tdBase,textAlign:'center',fontWeight:800,color:d>0?'var(--red)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{d>0?`-${d}`:'—'}</td>
                    </>;})()}
                    <td style={{...tdBase,textAlign:'center',fontWeight:800,color:prodAvgScore>=80?'var(--green)':prodAvgScore>=60?'var(--amber)':'var(--red)',fontFamily:"'JetBrains Mono'"}}>{prodAvgScore}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── VOICE OVER ── */}
        {voEmps.length > 0 && (
          <div style={{background:'var(--surf)',border:'1px solid var(--brd)',borderRadius:14,overflow:'hidden',marginBottom:20,boxShadow:'var(--sh)'}}>
            <div style={{background:'linear-gradient(135deg,#7c3aed,#9333ea)',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:20}}>🎙</span>
                <div>
                  <div style={{fontWeight:800,fontSize:'1rem',color:'#fff'}}>VOICE OVER</div>
                  <div style={{fontSize:'.7rem',color:'rgba(255,255,255,.7)'}}>{voEmps.length} staff</div>
                </div>
              </div>
              <span style={{fontSize:'.75rem',color:'rgba(255,255,255,.8)',fontFamily:"'JetBrains Mono'"}}>{dateLabel}</span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
                <thead>
                  <tr style={{background:'var(--surf2)'}}>
                    <Th>#</Th><Th sk="name">Name</Th><Th>ID</Th>
                    {VO_FIELDS.map(f=>(
                      <th key={f.key} onClick={()=>clickSort(f.key)} title="Click to sort"
                        style={{padding:'10px 8px',textAlign:'center',color:f.color,fontWeight:700,
                        fontSize:'.7rem',borderBottom:'2px solid var(--brd)',background:'var(--surf2)',whiteSpace:'nowrap',minWidth:70,cursor:'pointer',userSelect:'none'}}>
                        <div style={{fontSize:16,marginBottom:2}}>{f.icon}</div>
                        <div>{f.label}{arrow(f.key)}</div>
                      </th>
                    ))}
                    <Th center sk="present">Present</Th>
                    <Th center sk="errors" color="var(--red)">Errors</Th>
                    <Th center sk="deduct" color="var(--red)">Deduct</Th>
                    <Th center sk="score">Score</Th>
                  </tr>
                </thead>
                <tbody>
                  {voData.map((row,idx)=>{ const emp=row.emp;
                    const sc = calcScore(emp.id,emp.dept,dates[dates.length-1].slice(0,7),state.daily,state.prodDaily,state.quality,state.reliability);
                    const gc = sc.final>=80?'var(--green)':sc.final>=60?'var(--amber)':'var(--red)';
                    const present = dates.filter(d=>state.attendance[emp.id]?.[d]?.in_time).length;
                    return (
                      <tr key={emp.id} style={{borderBottom:'1px solid var(--brd)',background:idx%2===0?'transparent':'var(--surf2)'}}>
                        <td style={{...tdBase,color:'var(--mt)',textAlign:'center'}}>{idx+1}</td>
                        <td style={{...tdBase,fontWeight:700,color:'var(--txt)',whiteSpace:'nowrap'}}>{emp.name}</td>
                        <td style={{...tdBase,color:'var(--mt)',fontFamily:"'JetBrains Mono'",fontSize:'.74rem'}}>{emp.id}</td>
                        {VO_FIELDS.map(f=>{
                          const v=dates.reduce((s,d)=>s+(parseInt(state.prodDaily[emp.id]?.[d]?.[f.key])||0),0);
                          return (
                            <td key={f.key} style={{...tdBase,textAlign:'center',fontWeight:v>0?700:400,color:v>0?f.color:'var(--dim)',fontFamily:"'JetBrains Mono'"}}>
                              {v>0?v:'—'}
                            </td>
                          );
                        })}
                        <td style={{...tdBase,textAlign:'center',color:present>0?'var(--green)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{present}/{dates.length}</td>
                        <td style={{...tdBase,textAlign:'center',fontWeight:row.s.errors>0?700:400,color:row.s.errors>0?'var(--red)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{row.s.errors>0?row.s.errors:'—'}</td>
                        <td style={{...tdBase,textAlign:'center',fontWeight:row.s.deduct>0?700:400,color:row.s.deduct>0?'var(--red)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{row.s.deduct>0?`-${row.s.deduct}`:'—'}</td>
                        <td onClick={()=>setScoreInfo({emp,sc})} title="Click to see how this score is calculated" style={{...tdBase,textAlign:'center',fontWeight:800,color:gc,fontFamily:"'JetBrains Mono'",cursor:'pointer',textDecoration:'underline dotted',textUnderlineOffset:3}}>{sc.final}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:'var(--surf2)'}}>
                    <td style={{...tdBase,color:'var(--mt)',textAlign:'center'}}></td>
                    <td style={{...tdBase,fontWeight:700,color:'var(--txt)'}}>Team Total</td>
                    <td style={{...tdBase}}></td>
                    {voFieldTotals.map((v,i)=> (
                      <td key={i} style={{...tdBase,textAlign:'center',fontWeight:700,color:VO_FIELDS[i].color,fontFamily:"'JetBrains Mono'"}}>{v>0?v:'—'}</td>
                    ))}
                    <td style={{...tdBase,textAlign:'center',fontWeight:700,color:voTotalPresent>0?'var(--green)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{voTotalPresent}/{voEmps.length * dates.length}</td>
                    {(()=>{const c=voData.reduce((a,r)=>a+r.s.errors,0),d=voData.reduce((a,r)=>a+r.s.deduct,0);return <>
                      <td style={{...tdBase,textAlign:'center',fontWeight:800,color:c>0?'var(--red)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{c>0?c:'—'}</td>
                      <td style={{...tdBase,textAlign:'center',fontWeight:800,color:d>0?'var(--red)':'var(--dim)',fontFamily:"'JetBrains Mono'"}}>{d>0?`-${d}`:'—'}</td>
                    </>;})()}
                    <td style={{...tdBase,textAlign:'center',fontWeight:800,color:voAvgScore>=80?'var(--green)':voAvgScore>=60?'var(--amber)':'var(--red)',fontFamily:"'JetBrains Mono'"}}>{voAvgScore}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}