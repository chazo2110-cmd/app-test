export const STORAGE_KEY = 'form.training.v1';
export const STARTERS = ['Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row', 'Pull-up'];
export function id() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function emptyData() { return { version: 1, exercises: STARTERS.map(name => ({ id: id(), name })), sessions: [], bodyweights: {} }; }
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function validDate(s) { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(`${s}T12:00:00`); return !isNaN(d) && localDate(d) === s; }
export function shiftDate(date, days) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate()+days); return localDate(d); }
export function validSet(s) { return s && Number.isInteger(s.reps) && s.reps > 0 && s.reps <= 10000 && Number.isFinite(s.weight) && s.weight >= 0 && s.weight <= 10000; }
export function validateData(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.exercises) || !Array.isArray(data.sessions) || !data.bodyweights || typeof data.bodyweights !== 'object' || Array.isArray(data.bodyweights)) throw new Error('This is not a valid FORM backup.');
  const ids = new Set(); const names = new Set();
  for (const e of data.exercises) {
    if (!e || typeof e.id !== 'string' || !e.id || ids.has(e.id) || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 80 || names.has(e.name.trim().toLowerCase())) throw new Error('The exercise list is invalid.');
    ids.add(e.id); names.add(e.name.trim().toLowerCase());
  }
  const sessionIds = new Set();
  for (const s of data.sessions) {
    if (!s || typeof s.id !== 'string' || !s.id || sessionIds.has(s.id) || !ids.has(s.exerciseId) || !validDate(s.date) || !Array.isArray(s.sets) || !s.sets.length || s.sets.length > 100 || !s.sets.every(validSet)) throw new Error('A workout entry is invalid.');
    sessionIds.add(s.id);
  }
  for (const [date, weight] of Object.entries(data.bodyweights)) if (!validDate(date) || !Number.isFinite(weight) || weight <= 0 || weight > 1000) throw new Error('A body weight entry is invalid.');
  // Copy only the supported fields, including dictionary keys safely.
  return { version: 1, exercises: data.exercises.map(e => ({id:e.id,name:e.name.trim()})), sessions: data.sessions.map(s => ({ id:s.id,exerciseId:s.exerciseId,date:s.date,sets:s.sets.map(x=>({reps:x.reps,weight:x.weight})) })), bodyweights: Object.fromEntries(Object.entries(data.bodyweights)) };
}
export function totals(sessions) { return sessions.reduce((a,s) => { for (const set of s.sets) { a.sets++; a.reps += set.reps; a.weight = Math.max(a.weight,set.weight); } return a; },{sets:0,reps:0,weight:0}); }
export function chartPoints(data, exerciseId, metric, endDate, days) {
  const startDate = days ? shiftDate(endDate,1-days) : '0000-01-01';
  if (metric === 'bodyweight') return Object.entries(data.bodyweights).filter(([date])=>date>=startDate && date<=endDate).sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,value}));
  const groups = new Map();
  for (const s of data.sessions) if (s.exerciseId===exerciseId && s.date>=startDate && s.date<=endDate) { if (!groups.has(s.date)) groups.set(s.date,[]); groups.get(s.date).push(s); }
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,sessions])=>({ date, value:totals(sessions)[metric] }));
}
