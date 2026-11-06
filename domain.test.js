import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, validateData, validDate, totals, chartPoints, shiftDate, parseDecimal, removeExercise, copyDay } from './domain.js';
function fixture(){const data=emptyData(),exerciseId=data.exercises[0].id;data.sessions=[{id:'a',date:'2026-11-01',exerciseId,sets:[{reps:10,weight:50},{reps:8,weight:60}]},{id:'b',date:'2026-11-01',exerciseId,sets:[{reps:5,weight:70}]},{id:'c',date:'2026-11-03',exerciseId,sets:[{reps:8,weight:75}]}];data.bodyweights={'2026-11-01':72.5,'2026-11-03':72};return data;}
test('totals count real sets, reps, and maximum weight',()=>{const data=fixture();assert.deepEqual(totals(data.sessions.slice(0,2)),{sets:3,reps:23,weight:70});});
test('chart combines workouts by calendar day without filling missing days with zero',()=>{const data=fixture();assert.deepEqual(chartPoints(data,data.exercises[0].id,'weight','2026-11-03',7),[{date:'2026-11-01',value:70},{date:'2026-11-03',value:75}]);assert.deepEqual(chartPoints(data,data.exercises[0].id,'reps','2026-11-01',7),[{date:'2026-11-01',value:23}]);});
test('date windows include both boundaries and exclude future and other exercises',()=>{const data=fixture();data.sessions.push({id:'d',date:'2026-11-03',exerciseId:data.exercises[1].id,sets:[{weight:100,reps:10}]});assert.deepEqual(chartPoints(data,data.exercises[0].id,'sets','2026-11-03',2),[{date:'2026-11-03',value:1}]);assert.deepEqual(chartPoints(data,'anything','bodyweight','2026-11-01',0),[{date:'2026-11-01',value:72.5}]);});
test('calendar dates handle leap years and month rollover',()=>{assert.equal(validDate('2025-02-29'),false);assert.equal(validDate('2024-02-29'),true);assert.equal(validDate('2026-13-01'),false);assert.equal(shiftDate('2024-03-01',-1),'2024-02-29');});
test('backup round trips safely and rejects invalid references, duplicate IDs and invalid numbers',()=>{const original=fixture();assert.deepEqual(validateData(JSON.parse(JSON.stringify(original))),original);for(const mutate of [d=>d.sessions[0].sets[0].reps=-1,d=>d.sessions[0].sets[0].weight=NaN,d=>d.sessions[0].exerciseId='missing',d=>d.sessions[1].id='a',d=>d.bodyweights['2026-11-03']=0,d=>d.sessions[0].date='2026-02-30']){const d=fixture();mutate(d);assert.throws(()=>validateData(d));}});
test('zero added load is valid while empty sets and fractional reps are rejected',()=>{const d=fixture();d.sessions[0].sets=[{weight:0,reps:12}];assert.doesNotThrow(()=>validateData(d));d.sessions[0].sets[0].reps=2.5;assert.throws(()=>validateData(d));d.sessions[0].sets=[];assert.throws(()=>validateData(d));});
test('decimal weights accept comma or dot and reject blank, mixed or partial numbers',()=>{
  for (const input of ['22.5','22,5',' 22,50 ']) assert.equal(parseDecimal(input),22.5);
  assert.equal(parseDecimal('0'),0);
  assert.equal(parseDecimal('72,25'),72.25);
  for (const input of ['',' ','22kg','22,5.0','1,2,3','NaN','Infinity','-5','22.']) assert.equal(Number.isNaN(parseDecimal(input)),true,input);
});
test('removing unused exercises deletes them; used exercises keep history and archive status in backups',()=>{
  const data=fixture(), usedId=data.exercises[0].id, unusedId=data.exercises[1].id;
  const unusedRemoved=removeExercise(data,unusedId);
  assert.equal(unusedRemoved.exercises.some(e=>e.id===unusedId),false);
  const archived=removeExercise(unusedRemoved,usedId);
  assert.equal(archived.exercises.find(e=>e.id===usedId).archived,true);
  assert.deepEqual(archived.sessions,data.sessions);
  assert.equal(data.exercises[0].archived,undefined);
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(archived))),archived);
  assert.equal(chartPoints(archived,usedId,'weight','2026-11-03',7).at(-1).value,75);
});
test('copying a day appends independent workouts with fresh IDs without changing existing entries or body weight',()=>{
  const data=fixture(), before=JSON.stringify(data);
  const copied=copyDay(data,'2026-11-01','2026-11-03');
  assert.equal(copied.sessions.length,5);
  assert.deepEqual(copied.sessions.slice(0,3),data.sessions);
  assert.equal(new Set(copied.sessions.map(s=>s.id)).size,5);
  assert.equal(copied.sessions[3].date,'2026-11-03');
  assert.equal(copied.sessions[3].exerciseId,data.sessions[0].exerciseId);
  assert.deepEqual(copied.sessions[3].sets,data.sessions[0].sets);
  assert.notEqual(copied.sessions[3].sets[0],data.sessions[0].sets[0]);
  assert.deepEqual(copied.bodyweights,data.bodyweights);
  assert.equal(JSON.stringify(data),before);
  assert.doesNotThrow(()=>validateData(copied));
  copied.sessions[3].sets[0].weight=22.5;
  assert.equal(data.sessions[0].sets[0].weight,50);
});
test('copy rejects same-day, invalid dates and empty source days without mutation',()=>{
  const data=fixture(), before=JSON.stringify(data);
  for(const [source,target] of [['2026-11-01','2026-11-01'],['2026-11-01','2026-02-30'],['2026-11-02','2026-11-03']]) assert.throws(()=>copyDay(data,source,target));
  assert.equal(JSON.stringify(data),before);
});
