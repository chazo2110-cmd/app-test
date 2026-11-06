import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, validateData, validDate } from './domain.js';
import { emptyNutrition, nutritionOf, nutrientsFor, dailyNutrition, compareNutrient, validateNutrition } from './nutrition.js';

const nutrients = { protein:10, carbs:20, fat:5, sugar:8, salt:0.4 };
function fixture() {
  return { foods:[{id:'food', name:'Yogurt', unit:'g', nutrients:{...nutrients}}], entries:[
    {id:'first',date:'2026-11-06',name:'Yogurt',unit:'g',amount:150,nutrients:{...nutrients}},
    {id:'second',date:'2026-11-06',name:'Milk',unit:'ml',amount:250,nutrients:{protein:3,carbs:5,fat:1,sugar:5,salt:0.1}},
    {id:'other',date:'2026-11-05',name:'Yogurt',unit:'g',amount:100,nutrients:{...nutrients}}
  ], targets:{'2026-11-06':{protein:100,carbs:200,fat:60,sugar:40,salt:5}} };
}
test('legacy data stays intact and starts with an empty nutrition diary',()=>{
  const old=emptyData(); old.bodyweights['2026-11-06']=72.5;
  const restored=validateData(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(restored,old);
  assert.deepEqual(nutritionOf(restored),emptyNutrition());
});
test('food portions scale nutrition label values by amount / 100',()=>{
  assert.deepEqual(nutrientsFor(nutrients,150),{protein:15,carbs:30,fat:7.5,sugar:12,salt:0.6});
  assert.equal(nutrientsFor(nutrients,22.5).protein,2.25);
});
test('daily totals combine gram and millilitre portions and exclude other dates',()=>{
  const total=dailyNutrition(fixture(),'2026-11-06');
  assert.deepEqual(total,{protein:22.5,carbs:42.5,fat:10,sugar:24.5,salt:0.85});
  assert.deepEqual(dailyNutrition(fixture(),'2026-11-05'),nutrients);
  assert.equal(dailyNutrition(fixture(),'2026-11-07').protein,0);
});
test('comparison distinguishes missing targets, zero limits, remaining, met and over',()=>{
  assert.equal(compareNutrient(20,undefined).status,'unset');
  assert.equal(compareNutrient(20,null).percent,null);
  assert.deepEqual(compareNutrient(25,100),{percent:25,difference:75,status:'remaining'});
  assert.equal(compareNutrient(100,100).status,'met');
  assert.equal(compareNutrient(2,5,true).status,'within');
  assert.equal(compareNutrient(6,5,true).difference,-1);
  assert.equal(compareNutrient(0.1,0,true).status,'over');
  assert.equal(compareNutrient(0.1,0,true).percent,100);
  assert.equal(compareNutrient(0.1+0.2,0.3).status,'met');
});
test('nutrition data round trips with training in the same backup',()=>{
  const data={...emptyData(),nutrition:fixture()};
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(data))),data);
  data.nutrition.targets['2026-11-07']={protein:null,carbs:0,fat:60,sugar:0,salt:0.5};
  assert.doesNotThrow(()=>validateData(data));
});
test('catalogue changes or deletion leave saved diary snapshots and totals intact',()=>{
  const nutrition=fixture(),before=dailyNutrition(nutrition,'2026-11-06');
  nutrition.foods[0].nutrients.protein=99;
  assert.deepEqual(dailyNutrition(nutrition,'2026-11-06'),before);
  nutrition.foods=[];
  assert.deepEqual(dailyNutrition(nutrition,'2026-11-06'),before);
  const restored=validateNutrition(nutrition,validDate);
  restored.entries[0].nutrients.protein=50;
  assert.equal(nutrition.entries[0].nutrients.protein,10);
});
test('malformed nutrition backups are rejected rather than silently replacing data',()=>{
  for(const mutate of [
    n=>n.foods[0].nutrients.protein=-1,
    n=>n.foods[0].unit='oz',
    n=>n.foods.push({...n.foods[0],id:'duplicate-name'}),
    n=>n.entries[0].amount=0,
    n=>n.entries[0].date='2026-02-30',
    n=>n.entries[1].id='first',
    n=>n.entries[0].nutrients.salt=NaN,
    n=>n.targets['2026-11-06'].protein=-5,
    n=>n.targets['invalid']={protein:1},
    n=>delete n.targets['2026-11-06'].salt
  ]) {const nutrition=fixture();mutate(nutrition);assert.throws(()=>validateData({...emptyData(),nutrition}));}
});
