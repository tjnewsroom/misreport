import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { useApp } from '../hooks/useApp';
import { useData } from '../hooks/useData';
import { useToast } from '../hooks/useToast';
import { QUALITY_ITEMS, REL_ITEMS, PROD_FIELDS, VO_FIELDS, NEWS_TYPES, DEPTS } from '../data/constants';
import { fmtDate, calcScore, todayStr } from '../lib/utils';

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
      <div className="sec-hdr">
        <div><div className="sec-title">🎯 Quality Errors</div><div className="sec-sub">{fmtDate(selDate)}</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {['All', ...DEPTS].map(d => <Pill key={d} active={deptFilter === d} onClick={() => setDeptFilter(d)}>{d}</Pill>)}
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
                            <button onClick={() => handleChange(emp.id, qi.key, Math.max(0, val - 1))}
                              style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--brd)', background: 'var(--surf3)', color: 'var(--txt)', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                            <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: '.9rem', color: val > 0 ? (sev === 'major' ? 'var(--red)' : 'var(--amber)') : 'var(--dim)', fontFamily: "'JetBrains Mono'" }}>{val}</span>
                            <button onClick={() => handleChange(emp.id, qi.key, val + 1)}
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
  const [q, setQ] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [results, setResults] = useState(null);
  // If filterEmpId passed (employee view), only show own tasks
  const isEmpView = !!filterEmpId;

  const handleSearch = () => {
    const term = q.trim().toLowerCase();
    const found = [];
    Object.entries(state.daily).forEach(([empId, byDate]) => {
      if (filterEmpId && String(empId) !== String(filterEmpId)) return;
      const emp = state.emps.find(e => e.id === empId);
      if (!emp) return;
      if (!isEmpView && deptFilter !== 'All' && emp.dept !== deptFilter) return;
      Object.entries(byDate).forEach(([date, items]) => {
        (items || []).forEach(item => {
          const nt = NEWS_TYPES.find(n => n.key === item.type);
          const hay = [nt?.label || '', item.desc || '', item.type, emp.name, emp.dept, date].join(' ').toLowerCase();
          if (!term || hay.includes(term)) found.push({ emp: emp.name, dept: emp.dept, date, ...item, nt });
        });
      });
    });
    found.sort((a, b) => b.date.localeCompare(a.date));
    setResults(found);
  };

  const exportXLS = () => {
    if (!results?.length) return;
    const rows = [['Date', 'Employee', 'Dept', 'News Type', 'Description', 'Start', 'End']];
    results.forEach(r => rows.push([r.date, r.emp, r.dept, r.nt?.label || r.type, r.desc, r.startTime || '', r.endTime || '']));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Results');
    XLSX.writeFile(wb, `TJ_Search_${todayStr()}.xlsx`);
  };

  return (
    <div style={{ padding: 20 }}>
      <div className="sec-hdr">
        <div><div className="sec-title">🔍 Task Search</div><div className="sec-sub">Search all NLE tasks across all dates</div></div>
        {results?.length > 0 && <button className="btn btn-p btn-sm" onClick={exportXLS}>📊 Export Excel</button>}
      </div>
      <div className="card">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input className="inp" placeholder="Search news type, description, employee name…"
            value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, minWidth: 200 }} />
          {!isEmpView && (
            <select className="inp inp-sm" style={{ maxWidth: 160 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="All">All Departments</option>
              {DEPTS.map(d => <option key={d}>{d}</option>)}
            </select>
          )}
          <button className="btn btn-p" onClick={handleSearch}>Search</button>
        </div>

        {results !== null && (
          <>
            <div style={{ fontSize: '.8rem', color: 'var(--mt)', marginBottom: 10 }}>
              {results.length} result{results.length !== 1 ? 's' : ''} {q && `for "${q}"`}
            </div>
            {results.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--dim)', fontSize: '.9rem' }}>No matching tasks found.</div>
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--surf2)' }}>
                        {['Date', 'Employee', 'Dept', 'Type', 'Description', 'IN', 'OUT'].map(h => (
                          <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: 'var(--mt)', fontWeight: 600, fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--brd)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--mt)', fontFamily: "'JetBrains Mono'", fontSize: '.76rem', whiteSpace: 'nowrap' }}>{r.date}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--txt)', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.emp}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--mt)', fontSize: '.75rem', whiteSpace: 'nowrap' }}>{r.dept}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ background: (r.nt?.color || '#888') + '22', color: r.nt?.color || '#888', padding: '2px 8px', borderRadius: 5, fontSize: '.74rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {r.nt?.icon} {r.nt?.label || r.type}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--txt)', maxWidth: 220, wordBreak: 'break-word' }}>{r.desc || '—'}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--mt)', fontFamily: "'JetBrains Mono'", fontSize: '.76rem', whiteSpace: 'nowrap' }}>{r.startTime || '—'}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--mt)', fontFamily: "'JetBrains Mono'", fontSize: '.76rem', whiteSpace: 'nowrap' }}>{r.endTime || '—'}</td>
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

export function ReportPage({ selDate }) {
  const { state } = useApp();
  const reportRef = useRef();
  const [range, setRange] = useState('today');
  const [customFrom, setCustomFrom] = useState(selDate);
  const [customTo, setCustomTo] = useState(selDate);
  const [viewMode, setViewMode] = useState('cumulative'); // 'cumulative' | 'breakup'
  const [section, setSection] = useState('nle');
  const [exporting, setExporting] = useState(false);

  // Compute dates only when inputs change (not on every render)
  const dates = useMemo(() => getDates(range, customFrom, customTo), [range, customFrom, customTo]);

  const dateLabel = dates.length === 1
    ? fmtDate(dates[0])
    : `${fmtS(dates[0])} – ${fmtS(dates[dates.length - 1])} (${dates.length} days)`;

  const isMultiDay = dates.length > 1;

  // ─ Cumulative data (per employee totals) ─
  const empSummary = useMemo(() => {
    return state.emps.filter(e => e.is_active).map(emp => {
      const allItems = dates.flatMap(d => state.daily[emp.id]?.[d] || []);
      const wpts = allItems.reduce((s, it) => { const nt = NEWS_TYPES.find(n => n.key === it.type); return s + (nt?.weight || 0); }, 0);
      const presentDays = dates.filter(d => state.attendance[emp.id]?.[d]?.in_time).length;
      const sc = calcScore(emp.id, emp.dept, dates[dates.length - 1].slice(0, 7), state.daily, state.prodDaily, state.quality, state.reliability);
      return { ...emp, allItems, wpts, presentDays, sc };
    });
  }, [dates, state.emps, state.daily, state.attendance]);

  const exportExcel = () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      const nleRows = [['Date', 'Employee', 'News Type', 'Description', 'Start', 'End', 'Pts']];
      state.emps.filter(e => e.is_active && e.dept === 'NLE Editor').forEach(emp => {
        dates.forEach(d => {
          (state.daily[emp.id]?.[d] || []).forEach(it => {
            const nt = NEWS_TYPES.find(n => n.key === it.type);
            nleRows.push([d, emp.name, nt?.label || it.type, it.desc || '', it.startTime || '', it.endTime || '', nt?.weight || 0]);
          });
        });
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(nleRows), 'NLE Tasks');

      const attRows = [['Date', 'Employee', 'Dept', 'In Time', 'Out Time', 'Status']];
      state.emps.filter(e => e.is_active).forEach(emp => {
        dates.forEach(d => {
          const att = state.attendance[emp.id]?.[d] || {};
          attRows.push([d, emp.name, emp.dept, att.in_time || '', att.out_time || '', att.in_time ? 'Present' : 'Absent']);
        });
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attRows), 'Attendance');

      const sumRows = [['Employee', 'Dept', 'Tasks', 'Pts', 'Days Present', 'Score']];
      empSummary.forEach(e => sumRows.push([e.name, e.dept, e.allItems.length, e.wpts, e.presentDays, e.sc.final]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumRows), 'Summary');

      XLSX.writeFile(wb, `TJ_Report_${range}_${todayStr()}.xlsx`);
    } catch (e) { console.error(e); }
    setExporting(false);
  };

  const exportImage = async () => {
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#1f2937', useCORS: true });
      const link = document.createElement('a');
      link.download = `TJ_Report_${todayStr()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) { console.error(e); }
  };

  // Row renderer for breakup (per-date rows) — skips dates with no attendance AND no tasks
  const BreakupRow = ({ emp }) => {
    return dates.map(d => {
      const items = state.daily[emp.id]?.[d] || [];
      const att = state.attendance[emp.id]?.[d];
      // Skip if no data at all for this date
      if (!att?.in_time && !items.length) return null;
      const wpts = items.reduce((s, it) => { const nt = NEWS_TYPES.find(n => n.key === it.type); return s + (nt?.weight || 0); }, 0);
      return (
        <tr key={d} style={{ borderBottom: '1px solid var(--brd)' }}>
          <td style={{ padding: '7px 12px', color: 'var(--txt)', fontWeight: 600 }}>{emp.name}</td>
          <td style={{ padding: '7px 12px', color: 'var(--mt)', fontSize: '.74rem', fontFamily: "'JetBrains Mono'" }}>{d}</td>
          <td style={{ padding: '7px 12px', textAlign: 'center' }}>
            {att?.in_time ? <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '.8rem' }}>{att.in_time}</span> : <span style={{ color: 'var(--dim)' }}>—</span>}
          </td>
          <td style={{ padding: '7px 12px', textAlign: 'center' }}>
            {att?.out_time ? <span style={{ color: 'var(--red)', fontSize: '.8rem' }}>{att.out_time}</span> : <span style={{ color: 'var(--dim)' }}>—</span>}
          </td>
          <td style={{ padding: '7px 12px', textAlign: 'center', color: 'var(--blue)', fontWeight: 700 }}>{items.length || '—'}</td>
          <td style={{ padding: '7px 12px', textAlign: 'center', color: 'var(--amber)', fontWeight: 700 }}>{wpts || '—'}</td>
        </tr>
      );
    });
  };

  const Th = ({ children, center }) => (
    <th style={{ padding: '9px 12px', textAlign: center ? 'center' : 'left', color: 'var(--mt)', fontWeight: 600, fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '2px solid var(--brd)', whiteSpace: 'nowrap', background: 'var(--surf2)' }}>{children}</th>
  );

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div className="sec-hdr">
        <div><div className="sec-title">📄 Full Report</div><div className="sec-sub">{dateLabel}</div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-p btn-sm" onClick={exportExcel} disabled={exporting}>{exporting ? '⏳…' : '📊 Export Excel'}</button>
          <button className="btn btn-sm" style={{ background: 'var(--surf2)', border: '1px solid var(--brd)', color: 'var(--txt)' }} onClick={exportImage}>🖼 Image</button>
        </div>
      </div>

      {/* Range + mode controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {RANGE_OPTS.map(r => <Pill key={r.id} active={range === r.id} onClick={() => setRange(r.id)}>{r.label}</Pill>)}
        </div>
        {range === 'custom' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--brd)' }}>
            <label style={{ fontSize: '.8rem', color: 'var(--mt)' }}>From</label>
            <input type="date" className="inp inp-sm" style={{ maxWidth: 160 }} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            <label style={{ fontSize: '.8rem', color: 'var(--mt)' }}>To</label>
            <input type="date" className="inp inp-sm" style={{ maxWidth: 160 }} value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)} />
            <span style={{ fontSize: '.78rem', color: 'var(--green)' }}>{dates.length} day{dates.length !== 1 ? 's' : ''}</span>
          </div>
        )}
        {/* Cumulative / Breakup toggle — only for multi-day */}
        {isMultiDay && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, marginTop: 4, borderTop: '1px solid var(--brd)' }}>
            <span style={{ fontSize: '.78rem', color: 'var(--mt)', fontWeight: 600 }}>View mode:</span>
            <Pill active={viewMode === 'cumulative'} onClick={() => setViewMode('cumulative')}>📊 Cumulative (per employee)</Pill>
            <Pill active={viewMode === 'breakup'} onClick={() => setViewMode('breakup')}>📋 Breakup (per date)</Pill>
          </div>
        )}
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: 'var(--surf2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[{ id: 'nle', label: '🎬 NLE' }, { id: 'att', label: '🕒 Attendance' }, { id: 'scores', label: '⭐ Scores' }, { id: 'prod', label: '🎙 Producers' }, { id: 'team', label: '👥 Entire Team' }].map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none',
            background: section === s.id ? 'var(--surf)' : 'transparent',
            color: section === s.id ? 'var(--txt)' : 'var(--mt)',
            fontSize: '.82rem', cursor: 'pointer', fontWeight: section === s.id ? 700 : 400,
            boxShadow: section === s.id ? 'var(--sh)' : 'none', transition: 'all .15s'
          }}>{s.label}</button>
        ))}
      </div>

      {/* Report body */}
      <div ref={reportRef}>
        {/* Brand header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '14px 20px', background: 'var(--surf)', borderRadius: 12, border: '1px solid var(--brd)' }}>
          <span style={{ fontSize: 28 }}>📺</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--txt)' }}>TamilJanam MIS · Report</div>
            <div style={{ fontSize: '.75rem', color: 'var(--mt)' }}>{dateLabel} · {isMultiDay ? (viewMode === 'cumulative' ? 'Cumulative' : 'Daily Breakup') : 'Single Day'}</div>
          </div>
        </div>

        {/* ── NLE Section ── */}
        {section === 'nle' && (
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--txt)', fontSize: '.9rem' }}>🎬 NLE Editor Tasks</div>
            {(isMultiDay && viewMode === 'breakup') ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                  <thead><tr><Th>Employee</Th><Th>Date</Th><Th center>IN</Th><Th center>OUT</Th><Th center>Tasks</Th><Th center>Pts</Th></tr></thead>
                  <tbody>
                    {state.emps.filter(e => e.is_active && e.dept === 'NLE Editor').map(emp => <BreakupRow key={emp.id} emp={emp} />)}
                  </tbody>
                </table>
              </div>
            ) : (
              // Cumulative: show each employee's tasks list
              state.emps.filter(e => e.is_active && e.dept === 'NLE Editor').map(emp => {
                const allItems = dates.flatMap(d => (state.daily[emp.id]?.[d] || []).map(it => ({ ...it, date: d })));
                if (!allItems.length) return null;
                const wpts = allItems.reduce((s, it) => { const nt = NEWS_TYPES.find(n => n.key === it.type); return s + (nt?.weight || 0); }, 0);
                return (
                  <div key={emp.id} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--brd)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, color: 'var(--txt)' }}>{emp.name}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ background: 'var(--bl)', color: 'var(--blue)', padding: '2px 10px', borderRadius: 999, fontSize: '.75rem', fontWeight: 700 }}>{allItems.length} tasks</span>
                        <span style={{ background: 'var(--gl)', color: 'var(--green)', padding: '2px 10px', borderRadius: 999, fontSize: '.75rem', fontWeight: 700 }}>{wpts} pts</span>
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                        <thead><tr style={{ background: 'var(--surf2)' }}>{['Date', 'Type', 'Description', 'IN', 'OUT'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
                        <tbody>
                          {allItems.map((it, i) => {
                            const nt = NEWS_TYPES.find(n => n.key === it.type);
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid var(--brd)' }}>
                                <td style={{ padding: '6px 12px', color: 'var(--mt)', fontFamily: "'JetBrains Mono'", fontSize: '.74rem' }}>{it.date}</td>
                                <td style={{ padding: '6px 12px' }}><span style={{ background: (nt?.color || '#888') + '22', color: nt?.color || '#888', padding: '1px 7px', borderRadius: 4, fontSize: '.72rem', fontWeight: 600 }}>{nt?.icon} {nt?.label || it.type}</span></td>
                                <td style={{ padding: '6px 12px', color: 'var(--txt)', maxWidth: 200, wordBreak: 'break-word' }}>{it.desc || '—'}</td>
                                <td style={{ padding: '6px 12px', color: 'var(--mt)', fontFamily: "'JetBrains Mono'", fontSize: '.74rem' }}>{it.startTime || '—'}</td>
                                <td style={{ padding: '6px 12px', color: 'var(--mt)', fontFamily: "'JetBrains Mono'", fontSize: '.74rem' }}>{it.endTime || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Attendance Section ── */}
        {section === 'att' && (
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--txt)', fontSize: '.9rem' }}>🕒 Attendance</div>
            {(isMultiDay && viewMode === 'breakup') ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                  <thead><tr><Th>Employee</Th><Th>Dept</Th><Th>Date</Th><Th center>IN</Th><Th center>OUT</Th><Th center>Status</Th></tr></thead>
                  <tbody>
                    {state.emps.filter(e => e.is_active).flatMap(emp =>
                      dates.map(d => {
                        const att = state.attendance[emp.id]?.[d] || {};
                        if (!att.in_time) return null; // skip absent days in breakup
                        return (
                          <tr key={emp.id + d} style={{ borderBottom: '1px solid var(--brd)' }}>
                            <td style={{ padding: '7px 12px', color: 'var(--txt)', fontWeight: 600 }}>{emp.name}</td>
                            <td style={{ padding: '7px 12px', color: 'var(--mt)', fontSize: '.75rem' }}>{emp.dept}</td>
                            <td style={{ padding: '7px 12px', color: 'var(--mt)', fontFamily: "'JetBrains Mono'", fontSize: '.76rem' }}>{d}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'center', color: 'var(--green)', fontWeight: 700, fontSize: '.8rem' }}>{att.in_time || '—'}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'center', color: 'var(--red)', fontSize: '.8rem' }}>{att.out_time || '—'}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                              <span style={{ background: att.in_time ? 'var(--gl)' : 'var(--rl)', color: att.in_time ? 'var(--green)' : 'var(--red)', padding: '2px 8px', borderRadius: 999, fontSize: '.72rem', fontWeight: 700 }}>
                                {att.in_time ? 'Present' : 'Absent'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              // Cumulative attendance summary
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                  <thead><tr><Th>Employee</Th><Th>Dept</Th><Th center>Present</Th><Th center>Absent</Th><Th center>Rate</Th></tr></thead>
                  <tbody>
                    {empSummary.map(emp => {
                      const rate = Math.round((emp.presentDays / dates.length) * 100);
                      return (
                        <tr key={emp.id} style={{ borderBottom: '1px solid var(--brd)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--txt)', fontWeight: 600 }}>{emp.name}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--mt)', fontSize: '.75rem' }}>{emp.dept}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>{emp.presentDays}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--red)', fontWeight: 700 }}>{dates.length - emp.presentDays}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{ background: rate >= 80 ? 'var(--gl)' : rate >= 50 ? 'var(--al)' : 'var(--rl)', color: rate >= 80 ? 'var(--green)' : rate >= 50 ? 'var(--amber)' : 'var(--red)', padding: '2px 10px', borderRadius: 999, fontSize: '.75rem', fontWeight: 700 }}>
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Scores Section ── */}
        {section === 'scores' && (
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--txt)', fontSize: '.9rem' }}>⭐ Performance Scores</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                <thead><tr><Th>Employee</Th><Th>Dept</Th><Th center>Tasks</Th><Th center>Pts</Th><Th center>Present</Th><Th center>Quality</Th><Th center>Output</Th><Th center>Score</Th></tr></thead>
                <tbody>
                  {empSummary.map(emp => {
                    const grade = emp.sc.final >= 90 ? 'A+' : emp.sc.final >= 80 ? 'A' : emp.sc.final >= 70 ? 'B' : emp.sc.final >= 60 ? 'C' : 'D';
                    const gc = emp.sc.final >= 80 ? 'var(--green)' : emp.sc.final >= 60 ? 'var(--amber)' : 'var(--red)';
                    return (
                      <tr key={emp.id} style={{ borderBottom: '1px solid var(--brd)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--txt)', fontWeight: 600 }}>{emp.name}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--mt)', fontSize: '.75rem' }}>{emp.dept}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--txt)' }}>{emp.allItems.length}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--blue)', fontWeight: 700 }}>{emp.wpts}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--mt)' }}>{emp.presentDays}/{dates.length}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--mt)' }}>{emp.sc.qualityScore}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--mt)' }}>{emp.sc.outputScore}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, color: gc, fontFamily: "'JetBrains Mono'" }}>{emp.sc.final}</span>
                          <span style={{ marginLeft: 6, fontWeight: 800, color: gc }}>{grade}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Entire Team Section ── */}
        {section === 'team' && (
          <div>
            {/* NLE Summary */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--txt)', fontSize: '.9rem' }}>🎬 NLE Editors</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                  <thead><tr><Th>Employee</Th><Th center>Tasks</Th><Th center>Pts</Th><Th center>Present</Th><Th center>IN</Th><Th center>OUT</Th><Th center>Score</Th></tr></thead>
                  <tbody>
                    {empSummary.filter(e => e.dept === 'NLE Editor').map(emp => {
                      const att = dates.length === 1 ? state.attendance[emp.id]?.[dates[0]] : null;
                      const gc = emp.sc.final >= 80 ? 'var(--green)' : emp.sc.final >= 60 ? 'var(--amber)' : 'var(--red)';
                      return (
                        <tr key={emp.id} style={{ borderBottom: '1px solid var(--brd)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--txt)', fontWeight: 600 }}>{emp.name}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--blue)', fontWeight: 700 }}>{emp.allItems.length}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--amber)', fontWeight: 700 }}>{emp.wpts}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--mt)' }}>{emp.presentDays}/{dates.length}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--green)', fontFamily: "'JetBrains Mono'", fontSize: '.78rem' }}>{att?.in_time || '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--red)', fontFamily: "'JetBrains Mono'", fontSize: '.78rem' }}>{att?.out_time || '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: gc, fontFamily: "'JetBrains Mono'" }}>{emp.sc.final}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {/* News Producer Summary */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--txt)', fontSize: '.9rem' }}>📋 News Producers</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                  <thead><tr><Th>Employee</Th>{PROD_FIELDS.map(f=><Th key={f.key} center>{f.icon} {f.label}</Th>)}<Th center>Present</Th><Th center>Score</Th></tr></thead>
                  <tbody>
                    {empSummary.filter(e => e.dept === 'News Producer').map(emp => {
                      const gc = emp.sc.final >= 80 ? 'var(--green)' : emp.sc.final >= 60 ? 'var(--amber)' : 'var(--red)';
                      return (
                        <tr key={emp.id} style={{ borderBottom: '1px solid var(--brd)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--txt)', fontWeight: 600 }}>{emp.name}</td>
                          {PROD_FIELDS.map(f => {
                            const v = dates.reduce((s,d)=>s+(parseInt(state.prodDaily[emp.id]?.[d]?.[f.key])||0),0);
                            return <td key={f.key} style={{ padding: '8px 10px', textAlign: 'center', color: v>0?f.color:'var(--dim)', fontWeight: v>0?700:400 }}>{v||'—'}</td>;
                          })}
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--mt)' }}>{emp.presentDays}/{dates.length}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: gc, fontFamily: "'JetBrains Mono'" }}>{emp.sc.final}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Voice Over Summary */}
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--txt)', fontSize: '.9rem' }}>🎙 Voice Over</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                  <thead><tr><Th>Employee</Th>{VO_FIELDS.map(f=><Th key={f.key} center>{f.icon} {f.label}</Th>)}<Th center>Present</Th><Th center>Score</Th></tr></thead>
                  <tbody>
                    {empSummary.filter(e => e.dept === 'Voice Over').map(emp => {
                      const gc = emp.sc.final >= 80 ? 'var(--green)' : emp.sc.final >= 60 ? 'var(--amber)' : 'var(--red)';
                      return (
                        <tr key={emp.id} style={{ borderBottom: '1px solid var(--brd)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--txt)', fontWeight: 600 }}>{emp.name}</td>
                          {VO_FIELDS.map(f => {
                            const v = dates.reduce((s,d)=>s+(parseInt(state.prodDaily[emp.id]?.[d]?.[f.key])||0),0);
                            return <td key={f.key} style={{ padding: '8px 10px', textAlign: 'center', color: v>0?f.color:'var(--dim)', fontWeight: v>0?700:400 }}>{v||'—'}</td>;
                          })}
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--mt)' }}>{emp.presentDays}/{dates.length}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: gc, fontFamily: "'JetBrains Mono'" }}>{emp.sc.final}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Producers Section ── */}
        {section === 'prod' && (
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 14, color: 'var(--txt)', fontSize: '.9rem' }}>🎙 Producers & Voice Over</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                <thead>
                  <tr>
                    <Th>Employee</Th>
                    {!isMultiDay || viewMode === 'breakup' ? <Th>Date</Th> : null}
                    {[...PROD_FIELDS, ...VO_FIELDS].filter((f, i, a) => a.findIndex(x => x.key === f.key) === i).map(f => (
                      <Th key={f.key} center>{f.icon} {f.label}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.emps.filter(e => e.is_active && (e.dept === 'News Producer' || e.dept === 'Voice Over')).flatMap(emp => {
                    const fields = emp.dept === 'News Producer' ? PROD_FIELDS : VO_FIELDS;
                    const allF = [...PROD_FIELDS, ...VO_FIELDS].filter((f, i, a) => a.findIndex(x => x.key === f.key) === i);
                    if (isMultiDay && viewMode === 'breakup') {
                      return dates.map(d => {
                        const pd = state.prodDaily[emp.id]?.[d] || {};
                        const att = state.attendance[emp.id]?.[d];
                        const hasData = fields.some(f => parseInt(pd[f.key]) > 0) || att?.in_time;
                        if (!hasData) return null;
                        return (
                          <tr key={emp.id + d} style={{ borderBottom: '1px solid var(--brd)' }}>
                            <td style={{ padding: '7px 12px', color: 'var(--txt)', fontWeight: 600 }}>{emp.name}</td>
                            <td style={{ padding: '7px 12px', color: 'var(--mt)', fontSize: '.75rem', fontFamily: "'JetBrains Mono'" }}>{d}</td>
                            {allF.map(f => { const v = parseInt(pd[f.key]) || 0; return <td key={f.key} style={{ padding: '7px 10px', textAlign: 'center', color: v > 0 ? f.color : 'var(--dim)', fontWeight: v > 0 ? 700 : 400 }}>{v || '—'}</td>; })}
                          </tr>
                        );
                      });
                    } else {
                      // Cumulative totals
                      const totals = {};
                      fields.forEach(f => { totals[f.key] = dates.reduce((s, d) => s + (parseInt(state.prodDaily[emp.id]?.[d]?.[f.key]) || 0), 0); });
                      return [(
                        <tr key={emp.id} style={{ borderBottom: '1px solid var(--brd)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--txt)', fontWeight: 600 }}>{emp.name}</td>
                          {allF.map(f => {
                            const v = totals[f.key] || 0;
                            return <td key={f.key} style={{ padding: '8px 10px', textAlign: 'center', color: v > 0 ? f.color : 'var(--dim)', fontWeight: v > 0 ? 700 : 400 }}>{v || '—'}</td>;
                          })}
                        </tr>
                      )];
                    }
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
