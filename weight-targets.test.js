import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultWeightTargets, weightTargetWeek } from './weight-targets.js';
import { emptyData, validateData } from './domain.js';

test('planner defaults contain 98 weekly targets with phase endpoints and two-decimal interpolation',()=>{
  const targets=defaultWeightTargets();
  assert.equal(Object.keys(targets).length,98);
  assert.equal(targets['2026-10-14'],68);
  assert.equal(targets['2026-10-21'],67.55);
  assert.equal(targets['2026-12-02'],64.85);
  assert.equal(targets['2026-12-09'],64.85);
  assert.equal(targets['2026-12-16'],64.98);
  assert.equal(targets['2027-03-24'],60.45);
  assert.equal(targets['2027-03-31'],60.45);
  assert.equal(targets['2028-08-23'],69.95);
  targets['2026-10-14']=1;
  assert.equal(defaultWeightTargets()['2026-10-14'],68);
});
test('selected dates use their planner week, including leap days and phase boundaries',()=>{
  assert.equal(weightTargetWeek('2026-10-14'),'2026-10-14');
  assert.equal(weightTargetWeek('2026-10-20'),'2026-10-14');
  assert.equal(weightTargetWeek('2026-10-21'),'2026-10-21');
  assert.equal(weightTargetWeek('2026-10-13'),'2026-10-07');
  assert.equal(weightTargetWeek('2028-02-29'),'2028-02-23');
  assert.equal(weightTargetWeek('2028-08-30'),'2028-08-30');
});
test('old backups receive defaults while edited, deleted and empty plans survive restoration',()=>{
  const legacy=emptyData();delete legacy.bodyweightTargets;
  legacy.bodyweights={'2026-10-14':70};
  const data=validateData(legacy);
  assert.deepEqual(data.bodyweights,legacy.bodyweights);
  assert.deepEqual(data.bodyweightTargets,defaultWeightTargets());
  data.bodyweightTargets['2026-10-14']=66.25;
  delete data.bodyweightTargets['2026-10-21'];
  const restored=validateData(JSON.parse(JSON.stringify(data)));
  assert.equal(restored.bodyweightTargets['2026-10-14'],66.25);
  assert.equal(restored.bodyweightTargets['2026-10-21'],undefined);
  data.bodyweightTargets={};
  assert.deepEqual(validateData(data).bodyweightTargets,{});
});
test('invalid target backups are rejected',()=>{
  for (const targets of [null,[],{'2026-02-30':68},{bad:68},{'2026-10-14':0},{'2026-10-14':-1},{'2026-10-14':1001},{'2026-10-14':NaN},{'2026-10-14':'68'}]) {
    assert.throws(()=>validateData({...emptyData(),bodyweightTargets:targets}));
  }
});
