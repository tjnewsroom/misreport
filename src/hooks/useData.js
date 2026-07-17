import { sb } from '../lib/supabase';
import { useApp } from './useApp';
import { useToast } from './useToast';
import { getLocation } from '../lib/utils';

// Fetch ALL rows from a table with proper pagination up to 50k
async function fetchAll(table, query = {}) {
  const PAGE = 1000;
  let all = [], from = 0;
  while (all.length < 50000) {
    let req = sb.from(table).select('*').range(from, from + PAGE - 1);
    if (query.order) req = req.order(query.order, { ascending: query.asc ?? true });
    const { data, error } = await req;
    if (error) { console.error(`fetchAll ${table}:`, error.message); break; }
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`📦 ${table}: fetched ${all.length} rows`);
  return all;
}

// ── Overlap helpers ──────────────────────────────────────────────────────────
// Two HH:MM ranges overlap if each starts before the other ends.
// Exclusive endpoints: back-to-back entries (14:45→14:53, then 14:53→15:00) are OK.
const timeOverlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

export function useData() {
  const { state, dispatch } = useApp();
  const toast = useToast();

  const getEmpUUID = (empCode) => {
    const e = state.emps.find(x => String(x.id) === String(empCode));
    if (!e) { console.error('UUID not found for emp_code:', empCode, '| available:', state.emps.map(x=>x.id)); return null; }
    return e._uuid;
  };

  const loadAll = async () => {
    // ── Employees ──────────────────────────────────────────────
    const { data: ed } = await sb.from('employees').select('*').order('name');
const emps = (ed || []).map(e => ({ id: e.emp_code, name: e.name, dept: e.dept, is_active: e.is_active, features: e.features || [], _uuid: e.id }));    dispatch({ type: 'SET_EMPS', payload: emps });
    const uuidToCode = {};
    emps.forEach(e => { uuidToCode[e._uuid] = e.id; });

    // ── Shifts ─────────────────────────────────────────────────
    const shiftRows = await fetchAll('shift_entries', { order: 'shift_date' });
    const shifts = {};
    shiftRows.forEach(s => {
      if (!shifts[s.shift_date]) shifts[s.shift_date] = {};
      shifts[s.shift_date][s.employee_id] = { shift: s.shift_code, remarks: s.remarks || '' };
    });
    dispatch({ type: 'SET_SHIFTS', payload: shifts });

    // ── Attendance ─────────────────────────────────────────────
    const attRows = await fetchAll('attendance', { order: 'date' });
    const attRaw = {};
    attRows.forEach(a => {
      const code = uuidToCode[a.emp_id] || a.emp_id;
      if (!attRaw[code]) attRaw[code] = {};
      attRaw[code][a.date] = {
        in_time: a.in_time?.slice(0, 5) || null,
        out_time: a.out_time?.slice(0, 5) || null,
        in_location: a.in_location || null,
        out_location: a.out_location || null
      };
    });
    dispatch({ type: 'SET_ATTENDANCE', payload: attRaw });

    // ── NLE Daily ──────────────────────────────────────────────
    // Note: only ordering by `date` leaves same-day rows in an unstable order
    // (Postgres makes no guarantee), so we add a deterministic client-side
    // sort below by start_time (falling back to created_at) per day.
    const nleRows = await fetchAll('nle_daily_entries', { order: 'date' });
    const daily = {};
    nleRows.forEach(r => {
      const code = uuidToCode[r.emp_id] || r.emp_id;
      if (!daily[code]) daily[code] = {};
      if (!daily[code][r.date]) daily[code][r.date] = [];
      daily[code][r.date].push({
        _id: r.id, type: r.news_type, desc: r.description || '',
        startTime: r.start_time?.slice(0, 5) || '', endTime: r.end_time?.slice(0, 5) || '',
        manualMins: r.manual_mins || 0, _createdAt: r.created_at, _clientKey: r.client_key || null
      });
    });
    // Deterministic order: by start_time, then created_at as a tiebreaker/fallback
    Object.values(daily).forEach(byDate => {
      Object.values(byDate).forEach(items => {
        items.sort((a, b) => {
          if (a.startTime && b.startTime && a.startTime !== b.startTime) {
            return a.startTime < b.startTime ? -1 : 1;
          }
          if (a.startTime && !b.startTime) return -1;
          if (!a.startTime && b.startTime) return 1;
          return (a._createdAt || '') < (b._createdAt || '') ? -1 : 1;
        });
      });
    });
    dispatch({ type: 'SET_DAILY', payload: daily });

    // ── Producer Daily ─────────────────────────────────────────
    const prodRows = await fetchAll('producer_daily', { order: 'date' });
    const prodDaily = {};
    prodRows.forEach(r => {
      const code = uuidToCode[r.emp_id] || r.emp_id;
      if (!prodDaily[code]) prodDaily[code] = {};
      prodDaily[code][r.date] = r;
    });
    dispatch({ type: 'SET_PROD_DAILY', payload: prodDaily });

    // ── Breaks ─────────────────────────────────────────────────
    const brkRows = await fetchAll('breaks', { order: 'date' });
    const breaks = {};
    brkRows.forEach(b => {
      const code = uuidToCode[b.emp_id] || b.emp_id;
      if (!breaks[code]) breaks[code] = {};
      if (!breaks[code][b.date]) breaks[code][b.date] = [];
      breaks[code][b.date].push({
        _id: b.id, type: b.break_type,
        start: b.start_time?.slice(0, 5) || '', end: b.end_time?.slice(0, 5) || ''
      });
    });
    dispatch({ type: 'SET_BREAKS', payload: breaks });

    // ── Quality Errors ─────────────────────────────────────────
    const qualRows = await fetchAll('quality_errors');
    const quality = {};
    qualRows.forEach(q => {
      const code = uuidToCode[q.emp_id] || q.emp_id;
      if (!quality[code]) quality[code] = {};
      if (!quality[code][q.date]) quality[code][q.date] = {};
      quality[code][q.date][q.error_key] = q.count;
    });
    dispatch({ type: 'SET_QUALITY', payload: quality });

    // ── Reliability ────────────────────────────────────────────
    const relRows = await fetchAll('reliability_scores');
    const reliability = {};
    relRows.forEach(r => {
      const code = uuidToCode[r.emp_id] || r.emp_id;
      if (!reliability[code]) reliability[code] = {};
      reliability[code][r.month] = {
        on_time: r.on_time, emergency: r.emergency, team_coord: r.team_coord,
        night_shift: r.night_shift, pressure: r.pressure, creativity: r.creativity
      };
    });
    dispatch({ type: 'SET_RELIABILITY', payload: reliability });
  };

  // ── Save / Delete helpers ──────────────────────────────────────────────────

  // ✅ Cross-machine overlap guard for NLE entries.
  // Fetches this employee's rows for the date FRESH from Supabase (the shared
  // source of truth), so it catches entries saved from another browser/machine
  // that this browser's local state has never seen. Returns the conflicting
  // row if the candidate overlaps anything, or null if clear.
  const checkNLEOverlap = async (uuid, date, item) => {
    if (!item.startTime || !item.endTime) return null; // manual-mins/timeless entries: nothing to check
    const { data, error } = await sb
      .from('nle_daily_entries')
      .select('id, start_time, end_time, description')
      .eq('emp_id', uuid)
      .eq('date', date);
    if (error) {
      // If the check itself fails (network blip), don't block the save —
      // same behavior as before this guard existed. Just log it.
      console.error('Overlap check failed:', error.message);
      return null;
    }
    for (const r of (data || [])) {
      if (item._id && r.id === item._id) continue; // don't compare a row against itself on UPDATE
      const s = r.start_time?.slice(0, 5);
      const e = r.end_time?.slice(0, 5);
      if (!s || !e) continue;
      if (timeOverlaps(item.startTime, item.endTime, s, e)) {
        return { start: s, end: e, desc: r.description || '' };
      }
    }
    return null;
  };

  const saveNLEItem = async (empCode, date, item) => {
    const uuid = getEmpUUID(empCode);
    if (!uuid) { toast('UUID not found for: ' + empCode, 'er'); return false; }

    // ✅ Block overlapping entries BEFORE they reach the DB — works across
    // browsers/machines because the check reads from Supabase, not local state.
    const conflict = await checkNLEOverlap(uuid, date, item);
    if (conflict) {
      toast(
        `⚠️ Overlaps existing entry ${conflict.start}–${conflict.end}` +
        (conflict.desc ? ` (${conflict.desc})` : '') +
        `. It may have been saved from another browser — refresh the page to see all entries.`,
        'er'
      );
      return false;
    }

    if (item._id) {
      // UPDATE existing row — safe, always idempotent
      const { error } = await sb.from('nle_daily_entries').update({
        news_type: item.type, description: item.desc || '',
        start_time: item.startTime || null, end_time: item.endTime || null, manual_mins: item.manualMins || 0
      }).eq('id', item._id);
      if (error) { toast('Save failed: ' + error.message, 'er'); return false; }
      return true;
    } else {
      // INSERT new row — protected by client_key unique constraint (DB-level).
      // client_key is generated ONCE per item, the first time it's saved.
      // If this exact insert is retried (double-click, race condition, network retry,
      // multiple tabs), the unique constraint on client_key rejects the duplicate
      // at the DATABASE level — this is bulletproof, unlike a time-window check.
      if (!item._clientKey) {
        item._clientKey = crypto.randomUUID();
      }

      const { data, error } = await sb.from('nle_daily_entries').insert({
        emp_id: uuid, date, news_type: item.type, description: item.desc || '',
        start_time: item.startTime || null, end_time: item.endTime || null, manual_mins: item.manualMins || 0,
        client_key: item._clientKey,
      }).select().single();

      if (error) {
        // Postgres unique_violation = this exact insert already succeeded
        // (race condition / retry). Fetch the existing row instead of failing.
        if (error.code === '23505') {
          console.warn('🔒 Duplicate insert caught by client_key constraint — fetching existing row');
          const { data: existingRow } = await sb
            .from('nle_daily_entries')
            .select('id')
            .eq('client_key', item._clientKey)
            .single();
          if (existingRow) {
            item._id = existingRow.id;
            return true;
          }
        }
        toast('Save failed: ' + error.message, 'er');
        return false;
      }

      item._id = data.id;
      return true;
    }
  };

  const deleteNLEItem = async (item) => {
    if (!item._id) return true;
    const { error } = await sb.from('nle_daily_entries').delete().eq('id', item._id);
    if (error) { toast('Delete failed: ' + error.message, 'er'); return false; }
    return true;
  };

  const saveProdEntry = async (empCode, date, dept, data) => {
    const uuid = getEmpUUID(empCode);
    if (!uuid) { toast('UUID not found for: ' + empCode, 'er'); return false; }

    // ── Stamp a stable id (_tid) on every task — required for cross-browser merge ──
    const localTasks = (data.tasks || []).map(t => t._tid ? t : { ...t, _tid: crypto.randomUUID() });
    const localTombs = data.deleted_tids || [];

    // ── Fetch the current DB row FRESH (shared source of truth) so we can see
    //    tasks saved from other browsers/machines that this browser never loaded ──
    const { data: dbRow, error: fetchErr } = await sb
      .from('producer_daily')
      .select('tasks, deleted_tids')
      .eq('emp_id', uuid)
      .eq('date', date)
      .maybeSingle();
    if (fetchErr) console.error('Prod merge fetch failed:', fetchErr.message);

    // ── Merge rules ──
    // 1. Local tasks win (user just edited them here)
    // 2. Tasks in DB but not local (added by ANOTHER browser) are KEPT, not overwritten
    // 3. Tombstoned (deleted) task ids stay deleted everywhere — deletion is not resurrected
    const tombstones = Array.from(new Set([...(dbRow?.deleted_tids || []), ...localTombs]));
    const tombSet = new Set(tombstones);
    const localIds = new Set(localTasks.map(t => t._tid));
    const fromOtherBrowsers = (dbRow?.tasks || []).filter(
      t => t._tid && !localIds.has(t._tid) && !tombSet.has(t._tid)
    );
    const mergedTasks = [...localTasks.filter(t => !tombSet.has(t._tid)), ...fromOtherBrowsers]
      .sort((a, b) => {
        if (a.startTime && b.startTime && a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
        if (a.startTime && !b.startTime) return -1;
        if (!a.startTime && b.startTime) return 1;
        return 0;
      });

    // ── Reject overlapping tasks in the MERGED set — catches collisions with
    //    tasks entered from another browser too ──
    const timed = mergedTasks.filter(t => t.startTime && t.endTime);
    for (let i = 0; i < timed.length; i++) {
      for (let j = i + 1; j < timed.length; j++) {
        if (timeOverlaps(timed[i].startTime, timed[i].endTime, timed[j].startTime, timed[j].endTime)) {
          toast(
            `⚠️ Task times overlap: ${timed[i].startTime}–${timed[i].endTime} and ${timed[j].startTime}–${timed[j].endTime}. One may be from another browser session. Fix the timings before saving.`,
            'er'
          );
          return false;
        }
      }
    }

    const payload = { ...data, emp_id: uuid, date, dept, tasks: mergedTasks, deleted_tids: tombstones };
    const { error } = await sb.from('producer_daily').upsert(payload, { onConflict: 'emp_id,date' });
    if (error) { toast('Save failed: ' + error.message, 'er'); return false; }

    // Return the merged row (truthy — existing `if (ok)` checks keep working)
    // so callers can sync local state with tasks pulled in from other browsers.
    return payload;
  };

  const saveBreakItem = async (empCode, date, brk) => {
    const uuid = getEmpUUID(empCode);
    if (!uuid) { toast('UUID not found for: ' + empCode, 'er'); return false; }
    if (brk._id) {
      const { error } = await sb.from('breaks').update({
        break_type: brk.type, start_time: brk.start || null, end_time: brk.end || null
      }).eq('id', brk._id);
      if (error) { toast('Save failed: ' + error.message, 'er'); return false; }
    } else {
      const { data, error } = await sb.from('breaks').insert({
        emp_id: uuid, date, break_type: brk.type, start_time: brk.start || null, end_time: brk.end || null
      }).select().single();
      if (error) { toast('Save failed: ' + error.message, 'er'); return false; }
      brk._id = data.id;
    }
    return true;
  };

  const deleteBreak = async (brk) => {
    if (!brk._id) return true;
    const { error } = await sb.from('breaks').delete().eq('id', brk._id);
    if (error) { toast('Delete failed: ' + error.message, 'er'); return false; }
    return true;
  };

  const upsertShift = async (empId, date, shiftCode, remarks) => {
    const { error } = await sb.from('shift_entries').upsert(
      { employee_id: empId, shift_date: date, shift_code: shiftCode, remarks: remarks || '' },
      { onConflict: 'employee_id,shift_date' }
    );
    if (error) { toast('Shift save failed: ' + error.message, 'er'); return false; }
    return true;
  };

  const saveAttendance = async (empCode, date, fields) => {
    const uuid = getEmpUUID(empCode);
    if (!uuid) return;
    const { error } = await sb.from('attendance').upsert({ emp_id: uuid, date, ...fields }, { onConflict: 'emp_id,date' });
    if (error) console.error('Attendance error:', error.message);
  };

  const recordIN = async (empCode, dept) => {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 5);
    toast('📍 Getting location...');
    const loc = await getLocation();
    const fields = { in_time: now };
    if (loc) fields.in_location = loc;
    dispatch({ type: 'UPDATE_ATTENDANCE', payload: { empId: empCode, date: today, data: fields } });
    await saveAttendance(empCode, today, fields);
    toast('✓ IN: ' + now + (loc ? ' 📍' : ''));
    return { now, loc };
  };

  const recordOUT = async (empCode) => {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 5);
    toast('📍 Getting location...');
    const loc = await getLocation();
    const fields = { out_time: now };
    if (loc) fields.out_location = loc;
    dispatch({ type: 'UPDATE_ATTENDANCE', payload: { empId: empCode, date: today, data: fields } });
    await saveAttendance(empCode, today, fields);
    toast('✓ OUT: ' + now + (loc ? ' 📍' : ''));
    return { now, loc };
  };

  const saveQuality = async (empCode, date, dataObj) => {
    const uuid = getEmpUUID(empCode);
    if (!uuid) { toast('UUID not found: ' + empCode, 'er'); return false; }
    for (const [key, count] of Object.entries(dataObj)) {
      const cnt = parseInt(count) || 0;
      if (cnt <= 0) {
        await sb.from('quality_errors').delete().eq('emp_id', uuid).eq('date', date).eq('error_key', key);
      } else {
        const { error } = await sb.from('quality_errors').upsert(
          { emp_id: uuid, date, error_key: key, count: cnt }, { onConflict: 'emp_id,date,error_key' }
        );
        if (error) { toast('Quality save failed: ' + error.message, 'er'); return false; }
      }
    }
    return true;
  };

  const saveReliability = async (empCode, month, data) => {
    const uuid = getEmpUUID(empCode);
    if (!uuid) { toast('UUID not found: ' + empCode, 'er'); return false; }
    const rec = {
      emp_id: uuid, month,
      on_time: data.on_time ?? 7, emergency: data.emergency ?? 7,
      team_coord: data.team_coord ?? 7, night_shift: data.night_shift ?? 7,
      pressure: data.pressure ?? 7, creativity: data.creativity ?? 5
    };
    const { error } = await sb.from('reliability_scores').upsert(rec, { onConflict: 'emp_id,month' });
    if (error) { toast('Reliability save failed: ' + error.message, 'er'); return false; }
    return true;
  };

  return {
    loadAll, saveNLEItem, deleteNLEItem, saveProdEntry,
    saveBreakItem, deleteBreak, upsertShift, saveAttendance,
    recordIN, recordOUT, saveQuality, saveReliability
  };
}