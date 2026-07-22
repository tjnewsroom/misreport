import { NEWS_TYPES, QUALITY_ITEMS, PROD_FIELDS, VO_FIELDS, REL_ITEMS } from '../data/constants';

export const todayStr = () => new Date().toISOString().slice(0, 10);
export const fmtISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const fmtShort = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)}`;
export const fmtDate = s => {
  if (!s) return '';
  return new Date(s + 'T00:00').toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
};
// Shift an ISO date string by n days — used by ◀ Prev / Next ▶ date navigation
export const shiftDateISO = (iso, n) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
export const gwkStart = d => { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r; };
export const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
export const tdiff = (t1, t2) => {
  if (!t1 || !t2) return null;
  const [h1,m1] = t1.split(':').map(Number);
  const [h2,m2] = t2.split(':').map(Number);
  let d = (h2*60+m2) - (h1*60+m1);
  if (d < 0) d += 1440;
  return d;
};
export const fmtMin = m => {
  if (!m && m !== 0) return '—';
  const h = Math.floor(m/60), mn = m%60;
  return h > 0 ? `${h}h ${mn}m` : `${mn}m`;
};
export const shortN = n => { const p = n.split(' '); return p.length === 1 ? n : p[0]+' '+p[p.length-1]; };
export const deptColor = dept => ({ 'NLE Editor':'#2563eb','News Producer':'#0891b2','Voice Over':'#059669' }[dept] || '#2563eb');
export const perfBadge = s => {
  if (s >= 85) return { label:'Top Performer', color:'#d97706', bg:'#fffbeb', icon:'🏆' };
  if (s >= 75) return { label:'Reliable',       color:'#059669', bg:'#ecfdf5', icon:'⚡' };
  if (s >= 65) return { label:'Good',           color:'#2563eb', bg:'#eff6ff', icon:'✅' };
  if (s >= 50) return { label:'Developing',     color:'#7c3aed', bg:'#f5f3ff', icon:'📈' };
  return { label:'Needs Support', color:'#dc2626', bg:'#fef2f2', icon:'🔧' };
};
export const scrFmtD = iso => {
  if (!iso) return '—';
  return new Date(iso+'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
};

export const calcScore = (empId, dept, month, DAILY, PROD_DAILY, QUALITY, RELIABILITY) => {
  const days = Object.keys(DAILY[empId]||{}).filter(d => d.startsWith(month));
  const pdays = Object.keys(PROD_DAILY[empId]||{}).filter(d => d.startsWith(month));
  let wpts=0, items=0;
  if (dept === 'NLE Editor') {
    days.forEach(d => (DAILY[empId][d]||[]).forEach(it => {
      const nt = NEWS_TYPES.find(n => n.key === it.type)||{weight:1};
      wpts += nt.weight; items++;
    }));
  } else if (dept === 'News Producer') {
    pdays.forEach(d => {
      const pd = PROD_DAILY[empId][d]||{};
      PROD_FIELDS.forEach(f => { const v=parseInt(pd[f.key])||0; wpts+=v; items+=v; });
    });
  } else if (dept === 'Voice Over') {
    pdays.forEach(d => {
      const pd = PROD_DAILY[empId][d]||{};
      VO_FIELDS.forEach(f => { const v=parseInt(pd[f.key])||0; wpts+=v; items+=v; });
    });
  }
  const outputScore = Math.min(100, Math.round(wpts/1.5));
  let qualDeduct = 0;
  Object.keys(QUALITY[empId]||{}).filter(d => d.startsWith(month)).forEach(d => {
    const q = QUALITY[empId][d]||{};
    QUALITY_ITEMS.filter(qi => qi.depts.includes(dept)).forEach(qi => qualDeduct += Math.abs(qi.pts)*(parseInt(q[qi.key])||0));
  });
  const qualityScore = Math.max(0, 100-qualDeduct);
  const rData = RELIABILITY[empId]?.[month]||{};
  const relRaw = REL_ITEMS.reduce((s,r) => s+(parseInt(rData[r.key])||7), 0);
  const reliScore = Math.round(relRaw/REL_ITEMS.length/10*100);
  const creativityScore = (parseInt(rData.creativity)||5)*10;
  const final = Math.round(qualityScore*0.4 + outputScore*0.3 + reliScore*0.2 + creativityScore*0.1);
  return { final, qualityScore, outputScore, reliScore, creativityScore, wpts, items };
};

export const getLocation = () => new Promise(resolve => {
  if (!navigator.geolocation) { resolve(null); return; }
  navigator.geolocation.getCurrentPosition(
    pos => resolve(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`),
    () => resolve(null),
    { timeout:8000, enableHighAccuracy:true }
  );
});

// Returns the last `n` month keys (YYYY-MM) ending at the current month, oldest first.
// Used by the performance trend chart and monthly dashboards.
export const lastNMonths = (n) => {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return out;
};

export const monthLabel = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString('en-IN', { month:'short' });
};

// Elapsed time since a HH:MM "in_time" today, formatted like "2h 14m"
export const elapsedSince = (hhmm) => {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const start = new Date();
  start.setHours(h, m, 0, 0);
  let diffMin = Math.round((Date.now() - start.getTime()) / 60000);
  if (diffMin < 0) diffMin += 1440; // crossed midnight
  const hh = Math.floor(diffMin/60), mm = diffMin%60;
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
};
