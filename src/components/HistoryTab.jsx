import { useEffect, useState } from 'react';
import { useApp } from '../hooks/useApp';
import { NEWS_TYPES, PROD_FIELDS, VO_FIELDS } from '../data/constants';
import { tdiff, fmtMin, scrFmtD, todayStr } from '../lib/utils';
import { sb } from '../lib/supabase';

export default function HistoryTab({ empId, dept, onDateChange, onGoToDaily }) {
  const { state } = useApp();
  const [requests, setRequests] = useState([]);
  const [expanded, setExpanded] = useState(null); // date string of expanded day

  const isNLE = dept === 'NLE Editor';
  const src = isNLE ? state.daily[empId] : state.prodDaily[empId];
  const days = Object.keys(src || {}).sort().reverse().slice(0, 30);
  const fields = dept === 'News Producer' ? PROD_FIELDS : VO_FIELDS;

  useEffect(() => {
    if (!empId) return;
    const today = todayStr();
    sb.from('shift_change_requests')
      .select('*')
      .eq('employee_id', empId)
      .in('status', ['pending', 'approved', 'rejected'])
      .gte('end_date', today)
      .order('submitted_at', { ascending: false })
      .then(({ data }) => setRequests(data || []));
  }, [empId]);

  const shiftLbl = { "1ST": "🌅 1st Shift", "2ND": "🌙 2nd Shift", "OFF": "🏖️ Off" };

  const handleDayClick = (d) => {
    // Toggle inline expansion
    setExpanded(prev => prev === d ? null : d);
    // Also update the date picker at top so if user switches tabs it shows that date
    onDateChange?.(d);
  };

  const handleGoToDay = (d, e) => {
    e.stopPropagation();
    onDateChange?.(d);
    onGoToDaily?.(); // switch to daily tab
  };

  return (
    <div>
      <div className="sec-hdr">
        <div><div className="sec-title">📅 History</div><div className="sec-sub">Last 30 days — click to expand</div></div>
      </div>

      {!days.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--mt)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>No history yet
        </div>
      ) : days.map(d => {
        const isOpen = expanded === d;
        let label1, label2, items = [], prodData = {};

        if (isNLE) {
          items = state.daily[empId]?.[d] || [];
          const wpts = items.reduce((s, it) => { const nt = NEWS_TYPES.find(n => n.key === it.type) || { weight: 1 }; return s + nt.weight; }, 0);
          const mins = items.reduce((s, it) => s + (tdiff(it.startTime, it.endTime) ?? it.manualMins ?? 0), 0);
          label1 = `${items.length} item${items.length !== 1 ? 's' : ''} · ${fmtMin(mins)}`;
          label2 = `${wpts} weighted pts`;
        } else {
          prodData = state.prodDaily[empId]?.[d] || {};
          const total = fields.reduce((s, f) => s + (parseInt(prodData[f.key]) || 0), 0);
          label1 = `${total} activities`;
          label2 = fields.filter(f => parseInt(prodData[f.key]) > 0).map(f => `${f.icon}${prodData[f.key]}`).join(' ') || '—';
        }

        const dObj = new Date(d + 'T00:00');
        const att = state.attendance[empId]?.[d];
        const isToday = d === todayStr();

        return (
          <div key={d} style={{ marginBottom: 6 }}>
            {/* Row header */}
            <div
              onClick={() => handleDayClick(d)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                padding: '10px 14px', borderRadius: isOpen ? '10px 10px 0 0' : 10,
                background: isOpen ? 'var(--surf)' : 'var(--surf2)',
                border: `1px solid ${isOpen ? 'var(--blue)' : 'var(--brd)'}`,
                borderBottom: isOpen ? '1px solid var(--brd)' : undefined,
                transition: 'all .15s'
              }}>
              {/* Date badge */}
              <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono'", color: isToday ? 'var(--blue)' : 'var(--txt)' }}>
                  {String(dObj.getDate()).padStart(2, '0')}
                </div>
                <div style={{ fontSize: 10, color: 'var(--mt)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {dObj.toLocaleDateString('en-IN', { month: 'short' })}
                </div>
              </div>

              {/* Attendance chip */}
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: att?.in_time ? 'var(--green)' : 'var(--dim)', flexShrink: 0 }} title={att?.in_time ? `In: ${att.in_time}` : 'Absent'} />

              {/* Labels */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{label1}</div>
                <div style={{ fontSize: 11, color: 'var(--mt)', marginTop: 2 }}>{label2}</div>
              </div>

              {/* Attendance times */}
              {att?.in_time && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', fontFamily: "'JetBrains Mono'" }}>{att.in_time}</div>
                  {att.out_time && <div style={{ fontSize: 11, color: 'var(--red)', fontFamily: "'JetBrains Mono'" }}>{att.out_time}</div>}
                </div>
              )}

              <span style={{ color: 'var(--mt)', fontSize: 12, flexShrink: 0, transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{ background: 'var(--surf)', border: '1px solid var(--blue)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '12px 14px' }}>
                {isNLE ? (
                  items.length === 0 ? (
                    <div style={{ color: 'var(--mt)', fontSize: 13, textAlign: 'center', padding: '10px 0' }}>No items recorded this day.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--surf2)' }}>
                            {['#', 'Type', 'Description', 'IN', 'OUT', 'Duration'].map(h => (
                              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--mt)', fontWeight: 600, fontSize: '.68rem', textTransform: 'uppercase', borderBottom: '1px solid var(--brd)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, i) => {
                            const nt = NEWS_TYPES.find(n => n.key === it.type);
                            const mins = tdiff(it.startTime, it.endTime);
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid var(--brd)' }}>
                                <td style={{ padding: '6px 10px', color: 'var(--dim)', fontWeight: 700 }}>{i + 1}</td>
                                <td style={{ padding: '6px 10px' }}>
                                  <span style={{ background: (nt?.color || '#888') + '22', color: nt?.color || '#888', padding: '2px 7px', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {nt?.icon} {nt?.label || it.type}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 10px', color: 'var(--txt)', maxWidth: 180, wordBreak: 'break-word' }}>{it.desc || '—'}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--green)', fontFamily: "'JetBrains Mono'", fontSize: '.76rem', whiteSpace: 'nowrap' }}>{it.startTime || '—'}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--red)', fontFamily: "'JetBrains Mono'", fontSize: '.76rem', whiteSpace: 'nowrap' }}>{it.endTime || '—'}</td>
                                <td style={{ padding: '6px 10px', color: 'var(--amber)', fontFamily: "'JetBrains Mono'", fontSize: '.76rem', whiteSpace: 'nowrap' }}>{mins !== null ? fmtMin(mins) : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {/* Summary row */}
                      <div style={{ display: 'flex', gap: 16, padding: '10px 4px 0', flexWrap: 'wrap' }}>
                        {[
                          { label: 'Total Items', val: items.length, color: 'var(--blue)' },
                          { label: 'Total Time', val: fmtMin(items.reduce((s, it) => s + (tdiff(it.startTime, it.endTime) ?? 0), 0)), color: 'var(--green)' },
                          { label: 'Weighted Pts', val: items.reduce((s, it) => { const nt = NEWS_TYPES.find(n => n.key === it.type); return s + (nt?.weight || 1); }, 0), color: 'var(--amber)' },
                        ].map(stat => (
                          <div key={stat.label} style={{ background: 'var(--surf2)', padding: '6px 14px', borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: stat.color, fontFamily: "'JetBrains Mono'" }}>{stat.val}</div>
                            <div style={{ fontSize: '.65rem', color: 'var(--mt)', marginTop: 2 }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  // Producer/VO
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {fields.map(f => {
                      const v = parseInt(prodData[f.key]) || 0;
                      return (
                        <div key={f.key} style={{ background: v > 0 ? 'var(--surf2)' : 'var(--surf3)', padding: '8px 14px', borderRadius: 8, textAlign: 'center', minWidth: 100, opacity: v > 0 ? 1 : 0.4 }}>
                          <div style={{ fontSize: 20, marginBottom: 4 }}>{f.icon}</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: v > 0 ? f.color : 'var(--dim)', fontFamily: "'JetBrains Mono'" }}>{v}</div>
                          <div style={{ fontSize: '.68rem', color: 'var(--mt)', marginTop: 2 }}>{f.label}</div>
                        </div>
                      );
                    })}
                    {prodData.notes && (
                      <div style={{ width: '100%', padding: '8px 12px', background: 'var(--surf2)', borderRadius: 8, fontSize: '.82rem', color: 'var(--txt)' }}>
                        📝 {prodData.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* Go to that day button */}
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-p btn-sm" onClick={(e) => handleGoToDay(d, e)}>
                    📋 Open in Daily Entry →
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Shift Change Requests */}
      <div className="sec-hdr" style={{ marginTop: 24 }}>
        <div><div className="sec-title" style={{ fontSize: 14 }}>🔄 My Shift Change Requests</div><div className="sec-sub">Upcoming & recent</div></div>
      </div>
      {!requests.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--mt)', fontSize: 12 }}>
          No upcoming approved or rejected shift requests.
        </div>
      ) : requests.map(r => {
        const isApproved = r.status === 'approved';
        const dateRange = r.start_date === r.end_date ? scrFmtD(r.start_date) : scrFmtD(r.start_date) + ' → ' + scrFmtD(r.end_date);
        return (
          <div key={r.id} className="card-sm" style={{ marginBottom: 8, background: isApproved ? 'var(--gl)' : 'rgba(239,68,68,.06)', border: `1.5px solid ${isApproved ? 'var(--green)' : '#fca5a5'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{shiftLbl[r.requested_shift] || r.requested_shift}</div>
                <div style={{ fontSize: 11, color: 'var(--mt)' }}>{dateRange}</div>
                {r.reason && <div style={{ fontSize: 11, color: 'var(--mt)', fontStyle: 'italic', marginTop: 2 }}>"{r.reason}"</div>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: isApproved ? '#059669' : '#ef4444', color: '#fff', flexShrink: 0 }}>
                {r.status.toUpperCase()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
