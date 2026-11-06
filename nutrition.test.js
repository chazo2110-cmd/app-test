import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, validateData, validDate } from './domain.js';
import { emptyNutrition, nutritionOf, nutrientsFor, dailyNutrition, compareNutrient, validateNutrition, updateFoodFromDate, foodForDate } from './nutrition.js';

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
test('food updates recalculate the effective day and future portions while preserving earlier snapshots',()=>{
  const nutrition=fixture(), food=nutrition.foods[0];
  nutrition.entries.push({...nutrition.entries[0],id:'future',date:'2026-11-07'});
  const original=JSON.parse(JSON.stringify(nutrition));
  const updated=updateFoodFromDate(nutrition,{...food,name:'Greek yogurt',nutrients:{...nutrients,protein:20}},'2026-11-06');
  assert.equal(updated.entries.find(e=>e.id==='other').nutrients.protein,10);
  assert.equal(updated.entries.find(e=>e.id==='other').name,'Yogurt');
  assert.equal(updated.entries.find(e=>e.id==='first').nutrients.protein,20);
  assert.equal(updated.entries.find(e=>e.id==='future').name,'Greek yogurt');
  assert.equal(updated.entries.find(e=>e.id==='second').nutrients.protein,3);
  assert.equal(dailyNutrition(updated,'2026-11-06').protein,37.5);
  assert.equal(dailyNutrition(updated,'2026-11-05').protein,10);
  assert.equal(updated.entries.find(e=>e.id==='first').foodId,food.id);
  assert.deepEqual(nutrition,original);
  assert.doesNotThrow(()=>validateNutrition(updated,validDate));
});
test('backdated portions use dated labels; same-day edits replace only that day’s version',()=>{
  const nutrition=fixture(),food=nutrition.foods[0];
  const first=updateFoodFromDate(nutrition,{...food,nutrients:{...nutrients,protein:20}},'2026-11-06');
  const second=updateFoodFromDate(first,{...food,name:'New label',nutrients:{...nutrients,protein:25}},'2026-11-06');
  assert.equal(second.foods[0].versions.length,2);
  assert.equal(foodForDate(second.foods[0],'2026-11-05').nutrients.protein,10);
  assert.equal(foodForDate(second.foods[0],'2026-11-06').nutrients.protein,25);
  const third=updateFoodFromDate(second,{...food,nutrients:{...nutrients,protein:30}},'2026-11-08');
  assert.equal(foodForDate(third.foods[0],'2026-11-07').nutrients.protein,25);
  assert.equal(foodForDate(third.foods[0],'2026-11-08').nutrients.protein,30);
  assert.equal(third.entries.find(e=>e.id==='first').nutrients.protein,25);
  const restored=validateNutrition(JSON.parse(JSON.stringify(third)),validDate);
  assert.deepEqual(restored,third);
  assert.equal(foodForDate(restored.foods[0],'2026-11-05').name,'Yogurt');
});
test('food identity survives renames and label updates do not convert saved grams to millilitres',()=>{
  const nutrition=fixture(),food=nutrition.foods[0];
  assert.throws(()=>updateFoodFromDate(nutrition,{...food,unit:'ml'},'2026-11-06'),/different g\/ml/);
  const renamed=updateFoodFromDate(nutrition,{...food,name:'Greek yogurt'},'2026-11-06');
  const newer=updateFoodFromDate(renamed,{...food,name:'New yogurt',nutrients:{...nutrients,protein:30}},'2026-11-06');
  assert.equal(newer.entries.find(e=>e.id==='first').name,'New yogurt');
  assert.equal(newer.entries.find(e=>e.id==='other').name,'Yogurt');
});
test('food label history rejects out-of-order, invalid or mismatched versions in backups',()=>{
  const nutrition=fixture(),food=nutrition.foods[0];
  const updated=updateFoodFromDate(nutrition,{...food,nutrients:{...nutrients,protein:20}},'2026-11-06');
  for(const mutate of [
    n=>n.foods[0].versions.reverse(),
    n=>n.foods[0].versions[1].effectiveDate='2026-02-30',
    n=>n.foods[0].versions[0].nutrients.salt=-1,
    n=>n.foods[0].versions[1].nutrients.protein=50,
    n=>n.entries[0].foodId=5
  ]) {const next=JSON.parse(JSON.stringify(updated));mutate(next);assert.throws(()=>validateNutrition(next,validDate));}
});
