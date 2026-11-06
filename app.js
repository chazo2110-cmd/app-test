import { initNutrition } from './nutrition-ui.js';
import { STORAGE_KEY, emptyData, id, localDate, shiftDate, validDate, validateData, totals, chartPoints, parseDecimal, removeExercise, copyDay, sortExercises } from './domain.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const num = n => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
const prettyDate = (s, options = { month:'short', day:'numeric', year:'numeric' }) => new Date(`${s}T12:00:00`).toLocaleDateString('en-US',options);
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data = emptyData(), selectedDate = localDate(), metric = 'weight', range = 30, editingId = null, toastTimer, readBlocked = false;
function warn(message) { $('#storage-warning').hidden = false; $('#storage-warning').textContent = message; }
try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) data = validateData(JSON.parse(raw)); }
catch { readBlocked = true; warn('Your saved data could not be read. It has not been overwritten. Export a recovery copy, or import a valid backup before saving new entries.'); }
let selectedExercise = sortExercises(data.exercises)[0]?.id || '';
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(()=>$('#toast').hidden=true,4500); }
function updateStorageRemaining() {
  const indicator = $('#storage-remaining');
  try {
    // LocalStorage has no quota API. Estimate UTF-16 key/value storage against
    // a typical 5 MiB budget, without writing test data or measuring other APIs.
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) used += (key.length + (localStorage.getItem(key)?.length || 0)) * 2;
    }
    const remaining = Math.max(0, 5 * 1024 * 1024 - used) / (1024 * 1024);
    indicator.textContent = `Storage ≈ ${remaining > 0 && remaining < 0.01 ? '<0.01' : remaining.toFixed(2)} MB left`;
    indicator.title = 'Estimated LocalStorage space remaining for this website, based on a typical 5 MB limit and UTF-16 key/value size. Actual browser limits and accounting vary. Offline app cache is separate.';
  } catch {
    indicator.textContent = 'Storage unavailable';
    indicator.title = 'This browser is not allowing access to LocalStorage.';
  }
}
function persist(next, importing = false) {
  if (readBlocked && !importing) { toast('Saving is paused to protect unreadable data. Please import a valid backup.'); return false; }
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(next)); data=next; readBlocked=false; $('#storage-warning').hidden=true; updateStorageRemaining(); return true; }
  catch { updateStorageRemaining(); warn('Unable to save on this device. Storage may be full or restricted. Your latest change was not saved. Export a backup of your existing entries.'); return false; }
}
const nutritionUI = initNutrition({ getData:()=>data, getDate:()=>selectedDate, save:persist, toast });
function renderExerciseOptions() {
  const previous = $('#log-exercise').value;
  const editedExercise = data.sessions.find(s=>s.id===editingId)?.exerciseId;
  const ordered = sortExercises(data.exercises);
  const available = ordered.filter(e=>!e.archived || e.id===editedExercise);
  const options = list => list.map(e=>`<option value="${escape(e.id)}">${escape(e.name)}${e.archived?' (removed)':''}</option>`).join('');
  $('#log-exercise').innerHTML = options(available) || '<option value="">Add an exercise to get started</option>';
  $('#chart-exercise').innerHTML = options(ordered) || '<option value="">No exercises</option>';
  $('#log-exercise').disabled = !available.length; $('#save-workout').disabled = !available.length;
  if (available.some(e=>e.id===previous)) $('#log-exercise').value=previous;
  if (!data.exercises.some(e=>e.id===selectedExercise)) selectedExercise=ordered[0]?.id || '';
  $('#chart-exercise').value=selectedExercise;
}
function addSet(weight = '', reps = '') {
  if ($$('.set-row').length>=100) return toast('A workout can contain up to 100 sets.');
  const row = document.createElement('div'); row.className='set-row';
  row.innerHTML = `<span class="set-number"></span><input class="set-weight" type="text" inputmode="decimal" placeholder="0" value="${escape(weight)}" required><input class="set-reps" type="number" inputmode="numeric" min="1" max="10000" step="1" placeholder="0" value="${escape(reps)}" required><button class="remove-set" type="button">×</button>`;
  row.querySelector('.set-weight').addEventListener('input',event=>event.target.setCustomValidity(''));
  row.querySelector('button').addEventListener('click',()=>{row.remove();renumber();});
  $('#set-rows').append(row);renumber();
}
function renumber() { $$('.set-row').forEach((row,i)=>{row.querySelector('.set-number').textContent=String(i+1).padStart(2,'0');row.querySelector('.set-weight').setAttribute('aria-label',`Set ${i+1} weight in kg`);row.querySelector('.set-reps').setAttribute('aria-label',`Set ${i+1} reps`);row.querySelector('.remove-set').setAttribute('aria-label',`Remove set ${i+1}`);row.querySelector('.remove-set').disabled=$$('.set-row').length===1;}); }
function getSets() { return $$('.set-row').map(row=>({weight:parseDecimal(row.querySelector('.set-weight').value),reps:Number(row.querySelector('.set-reps').value)})); }
function resetForm() { editingId=null; $('#log-title').textContent='Log a workout';$('#cancel-edit').hidden=true;$('#set-rows').replaceChildren();addSet();addSet();addSet();renderExerciseOptions(); }
function render() {
  const order=new Map(sortExercises(data.exercises).map((exercise,index)=>[exercise.id,index]));
  const sessions=data.sessions.filter(s=>s.date===selectedDate).sort((a,b)=>(order.get(a.exerciseId)??0)-(order.get(b.exerciseId)??0)), t=totals(sessions), bw=data.bodyweights[selectedDate];
  $('#active-date').value=selectedDate; $('#day-heading').textContent=selectedDate===localDate()?'Today’s effort':prettyDate(selectedDate,{month:'long',day:'numeric'});
  $('#stat-sets').textContent=num(t.sets); $('#stat-reps').textContent=num(t.reps); $('#stat-bodyweight').textContent=bw?num(bw):'—';
  const count=new Set(sessions.map(s=>s.exerciseId)).size; $('#stat-exercise-count').textContent=count; $('#daily-count').textContent=count; $('#stat-exercises').textContent=`Across ${count} exercise${count===1?'':'s'}`;
  $('#open-bodyweight').textContent=bw?'Update your weight →':'Record your weight →';
  $('#save-date').textContent=prettyDate(selectedDate,{month:'short',day:'numeric'}); $('#history-date').textContent=prettyDate(selectedDate).toUpperCase(); $('#entry-count').textContent=sessions.length; $('#copy-day').disabled=!sessions.length;
  $('#history').innerHTML=sessions.length?sessions.map(s=>`<article class="history-entry"><div><h3 class="entry-name">${escape(data.exercises.find(e=>e.id===s.exerciseId)?.name || 'Exercise')}</h3><span class="entry-summary">${s.sets.length} sets · ${num(totals([s]).reps)} reps</span></div><div class="entry-sets">${s.sets.map(set=>`<span class="set-pill">${num(set.weight)} kg × ${set.reps}</span>`).join('')}</div><div class="entry-actions"><button data-edit="${escape(s.id)}" aria-label="Edit ${escape(data.exercises.find(e=>e.id===s.exerciseId)?.name || 'workout')}">Edit</button><button data-delete="${escape(s.id)}" aria-label="Delete ${escape(data.exercises.find(e=>e.id===s.exerciseId)?.name || 'workout')}">Delete</button></div></article>`).join(''):`<div class="empty-log"><span class="empty-icon">≋</span><h3>A fresh page. A stronger you.</h3><p>No workouts logged for this day.<br>Add your first set and make it count.</p></div>`;
  renderChart();
  nutritionUI.render();
}
const metricNames={weight:'Daily top weight',reps:'Daily total reps',sets:'Daily working sets',bodyweight:'Daily body weight'};
function renderChart() {
  const points=chartPoints(data,selectedExercise,metric,selectedDate,range), unit=['weight','bodyweight'].includes(metric)?'kg':metric;
  $('#chart-exercise').disabled=metric==='bodyweight';$('#chart-unit').textContent=unit;$('#chart-legend').textContent=metricNames[metric];
  $('#chart-period').textContent=range?`${prettyDate(shiftDate(selectedDate,1-range),{month:'short',day:'numeric'})} – ${prettyDate(selectedDate,{month:'short',day:'numeric'})}`:`Through ${prettyDate(selectedDate,{month:'short',day:'numeric'})}`;
  $('#chart-value').textContent=points.length?num(points.at(-1).value):'—';
  const change=points.length>1?points.at(-1).value-points[0].value:0;
  $('#chart-change').textContent=points.length>1?`${change>0?'+':''}${num(change)} ${unit} from first logged day`:points.length?'First entry. Keep showing up.':'Your next chapter starts here';
  $$('#metric-tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.metric===metric);b.setAttribute('aria-pressed',b.dataset.metric===metric);});
  $$('#range-buttons button').forEach(b=>{b.classList.toggle('active',Number(b.dataset.range)===range);b.setAttribute('aria-pressed',Number(b.dataset.range)===range);});
  if (!points.length) { $('#chart').innerHTML=`<div class="chart-empty"><strong>Consistency becomes a curve.</strong><p>${metric==='bodyweight'?'Record your body weight':'Log this exercise'} to see your progress here.<br>Only your real data. Every day counts.</p></div>`;return; }
  const W=600,H=225,L=43,R=18,T=16,B=34;
  const values=points.map(p=>p.value), min=Math.min(...values), max=Math.max(...values);
  const span=Math.max(max-min,max*.15,1), low=Math.max(0,min-span*.25), high=max+span*.3;
  const stamp=d=>new Date(`${d}T12:00:00Z`).getTime();
  const start=stamp(range?shiftDate(selectedDate,1-range):points[0].date), end=stamp(selectedDate);
  const x=p=>end===start?(L+W-R)/2:L+(stamp(p.date)-start)/(end-start)*(W-L-R);
  const y=v=>H-B-(v-low)/(high-low)*(H-T-B);
  const path=points.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
  const ticks=Array.from({length:4},(_,i)=>low+(high-low)*i/3);
  const labelCount=Math.min(range===7?4:5,Math.max(2,Math.round((end-start)/86400000)+1));
  const labels=Array.from({length:labelCount},(_,i)=>({date:new Date(start+(end-start)*i/(labelCount-1)),x:L+(W-L-R)*i/(labelCount-1)}));
  // Date labels use UTC to match the chart's calendar-day coordinate system.
  const svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${metricNames[metric]}: ${escape(points.map(p=>`${prettyDate(p.date)}: ${num(p.value)} ${unit}`).join('; '))}"><defs><linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#333" stop-opacity=".09"/><stop offset="100%" stop-color="#333" stop-opacity="0"/></linearGradient></defs>${ticks.map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#ecece7" stroke-dasharray="3 5"/><text x="${L-9}" y="${y(v)+3}" text-anchor="end">${num(v)}</text>`).join('')}${points.length>1?`<path d="${path} L${x(points.at(-1))},${H-B} L${x(points[0])},${H-B} Z" fill="url(#area-fill)"/><path d="${path}" stroke="#383833" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`:''}${points.map(p=>`<g tabindex="0" role="img" aria-label="${prettyDate(p.date)}: ${num(p.value)} ${unit}"><title>${prettyDate(p.date)}: ${num(p.value)} ${unit}</title><circle cx="${x(p)}" cy="${y(p.value)}" r="12" fill="transparent"/><circle cx="${x(p)}" cy="${y(p.value)}" r="3.5" fill="#fff" stroke="#383833" stroke-width="2"/></g>`).join('')}${labels.map(p=>`<text x="${p.x}" y="${H-7}" text-anchor="middle">${p.date.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})}</text>`).join('')}</svg>`;
  $('#chart').innerHTML=svg;
  $$('#chart svg g').forEach(g=>{g.addEventListener('click',()=>$('#chart-change').textContent=g.getAttribute('aria-label'));g.addEventListener('focus',()=>$('#chart-change').textContent=g.getAttribute('aria-label'));});
}
function showView(view) {
  $('#training-stats').hidden = view === 'nutrition';
  $$('.view-tabs [role=tab]').forEach(button=>{
    const active=button.dataset.view===view;
    button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    document.getElementById(button.getAttribute('aria-controls')).hidden=!active;
  });
}
$('.view-tabs').addEventListener('click',event=>{
  const tab=event.target.closest('[role=tab]');if(tab)showView(tab.dataset.view);
});
$('.view-tabs').addEventListener('keydown',event=>{
  const tabs=$$('.view-tabs [role=tab]'), index=tabs.indexOf(event.target);
  if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  showView(tabs[next].dataset.view);tabs[next].focus();
});
function changeDate(date) { if (!validDate(date)) return; if (editingId && !confirm('Leave this edit without saving?')) {$('#active-date').value=selectedDate;return;} selectedDate=date;resetForm();render(); }
$('#active-date').addEventListener('change',e=>{if(validDate(e.target.value))changeDate(e.target.value);else e.target.value=selectedDate;});
$('#prev-day').addEventListener('click',()=>changeDate(shiftDate(selectedDate,-1)));
$('#next-day').addEventListener('click',()=>changeDate(shiftDate(selectedDate,1)));
$('#today-button').addEventListener('click',()=>changeDate(localDate()));
$('#jump-log').addEventListener('click',()=>{showView('overview');$('#log-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});$('#log-exercise').focus({preventScroll:true});});
$('#chart-exercise').addEventListener('change',e=>{selectedExercise=e.target.value;renderChart();});
$('#metric-tabs').addEventListener('click',e=>{if(e.target.dataset.metric){metric=e.target.dataset.metric;renderChart();}});
$('#range-buttons').addEventListener('click',e=>{if(e.target.dataset.range){range=Number(e.target.dataset.range);renderChart();}});
$('#add-set').addEventListener('click',()=>{const last=$$('.set-row').at(-1);addSet(last?.querySelector('.set-weight').value??'',last?.querySelector('.set-reps').value??'');});
$('#cancel-edit').addEventListener('click',resetForm);
$('#workout-form').addEventListener('submit',e=>{
  e.preventDefault();const exerciseId=$('#log-exercise').value;if(!exerciseId)return toast('Add an exercise first.');
  for(const input of $$('.set-weight')) { const value=parseDecimal(input.value); if(!Number.isFinite(value)||value<0||value>10000){input.setCustomValidity('Enter a weight from 0 to 10000 kg, e.g. 22.5 or 22,5.');input.reportValidity();return;} }
  const session={id:editingId||id(),date:selectedDate,exerciseId,sets:getSets()};
  const next={...data,sessions:editingId?data.sessions.map(s=>s.id===editingId?session:s):[...data.sessions,session]};
  try { validateData(next); } catch(err) {return toast(err.message);}
  if(!persist(next))return;selectedExercise=exerciseId;$('#chart-exercise').value=selectedExercise;resetForm();render();toast('Workout saved. One step stronger.');
});
$('#history').addEventListener('click',e=>{
  const target=e.target.closest('button');if(!target)return;
  const edit=target.dataset.edit, remove=target.dataset.delete;
  if(edit){showView('overview');const s=data.sessions.find(s=>s.id===edit);editingId=s.id;renderExerciseOptions();$('#log-title').textContent='Edit workout';$('#cancel-edit').hidden=false;$('#log-exercise').value=s.exerciseId;$('#set-rows').replaceChildren();s.sets.forEach(set=>addSet(set.weight,set.reps));$('#log-panel').scrollIntoView({block:'start'});}
  if(remove && confirm('Delete this workout? This cannot be undone.')){if(persist({...data,sessions:data.sessions.filter(s=>s.id!==remove)})){if(editingId===remove)resetForm();render();toast('Workout deleted.');}}
});
$('#add-exercise').addEventListener('click',()=>{$('#exercise-form').reset();$('#exercise-error').textContent='';$('#exercise-dialog').showModal();});
$('#exercise-form').addEventListener('submit',e=>{
  e.preventDefault();const name=$('#exercise-name').value.trim();
  if(!name){$('#exercise-error').textContent='Enter an exercise name.';return;}
  if(data.exercises.some(x=>!x.archived && x.name.toLowerCase()===name.toLowerCase())){$('#exercise-error').textContent='This exercise is already in your library.';return;}
  const existing=data.exercises.find(x=>x.name.toLowerCase()===name.toLowerCase());
  const exercise=existing?{id:existing.id,name}: {id:id(),name};if(persist({...data,exercises:[...data.exercises.filter(x=>x.id!==exercise.id),exercise]})){selectedExercise=exercise.id;renderExerciseOptions();$('#log-exercise').value=exercise.id;renderChart();$('#exercise-dialog').close();toast('Exercise added to your library.');}
});
$('#bodyweight-input').addEventListener('input',e=>e.target.setCustomValidity(''));
$('#open-bodyweight').addEventListener('click',()=>{$('#bodyweight-input').setCustomValidity('');$('#bodyweight-date').textContent=prettyDate(selectedDate);$('#bodyweight-input').value=data.bodyweights[selectedDate]??'';$('#delete-bodyweight').hidden=!data.bodyweights[selectedDate];$('#bodyweight-dialog').showModal();});
$('#bodyweight-form').addEventListener('submit',e=>{e.preventDefault();const input=$('#bodyweight-input'), weight=parseDecimal(input.value);if(!Number.isFinite(weight)||weight<=0||weight>1000){input.setCustomValidity('Enter a body weight greater than 0 and up to 1000 kg, e.g. 72.5 or 72,5.');input.reportValidity();return;} if(persist({...data,bodyweights:{...data.bodyweights,[selectedDate]:weight}})){$('#bodyweight-dialog').close();render();toast('Body weight saved.');}});
$('#delete-bodyweight').addEventListener('click',()=>{if(!confirm('Remove body weight for this day?'))return;const bodyweights={...data.bodyweights};delete bodyweights[selectedDate];if(persist({...data,bodyweights})){$('#bodyweight-dialog').close();render();toast('Body weight removed.');}});
function renderLibrary() {
  $('#library-list').innerHTML=data.exercises.length?sortExercises(data.exercises).map(e=>`<div class="library-row"><div><strong>${escape(e.name)}</strong><small>${e.archived?'Removed · history kept':`${data.sessions.filter(s=>s.exerciseId===e.id).length} saved workouts`}</small></div><button type="button" class="text-button" data-library-id="${escape(e.id)}" data-action="${e.archived?'restore':'remove'}">${e.archived?'Restore':'Remove'}</button></div>`).join(''):'<p>Your library is empty. Close this window and choose New exercise to add one.</p>';
}
$('#manage-exercises').addEventListener('click',()=>{renderLibrary();$('#library-dialog').showModal();});
$('#library-list').addEventListener('click',event=>{
  const button=event.target.closest('[data-library-id]');if(!button)return;
  const exercise=data.exercises.find(e=>e.id===button.dataset.libraryId);if(!exercise)return;
  const restoring=button.dataset.action==='restore';
  if(!restoring && !confirm(`Remove ${exercise.name} from your exercise library? Saved workouts and progress will be kept.`))return;
  const next=restoring?{...data,exercises:data.exercises.map(e=>e.id===exercise.id?{id:e.id,name:e.name}:e)}:removeExercise(data,exercise.id);
  if(persist(next)){resetForm();renderLibrary();render();toast(restoring?'Exercise restored.':'Exercise removed. Saved history is kept.');}
});
$('#copy-day').addEventListener('click',()=>{
  const sessions=data.sessions.filter(s=>s.date===selectedDate);if(!sessions.length)return;
  $('#copy-summary').textContent=`Copy ${sessions.length} workout${sessions.length===1?'':'s'} from ${prettyDate(selectedDate)}.`;
  $('#copy-date').value=shiftDate(selectedDate,1);$('#copy-error').textContent='';$('#copy-dialog').showModal();
});
$('#copy-form').addEventListener('submit',event=>{
  event.preventDefault();const targetDate=$('#copy-date').value;
  try {
    const next=copyDay(data,selectedDate,targetDate);
    const existing=data.sessions.filter(s=>s.date===targetDate).length;
    if(!confirm(`Copy workouts to ${prettyDate(targetDate)}?${existing?` This adds to ${existing} existing workout(s).`:''}`))return;
    if(persist(next)){$('#copy-dialog').close();render();toast(`Workouts copied to ${prettyDate(targetDate)}.`);}
  } catch(error) {$('#copy-error').textContent=error.message;}
});
$$('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
function download(text,name) {const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('#export-data').addEventListener('click',()=>{try{download(readBlocked?(localStorage.getItem(STORAGE_KEY)||'{}'):JSON.stringify(data,null,2),`form-${readBlocked?'recovery-':''}${localDate()}.json`);toast('Backup exported. Keep it somewhere safe.');}catch{toast('Unable to export data from this browser.');}});
$('.import-label').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#import-data').click();}});
$('#import-data').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>10*1024*1024)throw new Error('Backup must be smaller than 10 MB.');const next=validateData(JSON.parse(await file.text()));if(!confirm(`Replace current data with this backup (${next.sessions.length} workouts, plus nutrition data if included)? Export your existing data first if you want to keep it.`))return;if(persist(next,true)){resetForm();renderExerciseOptions();render();toast('Backup restored. Welcome back.');}}
  catch(err){toast(err instanceof SyntaxError?'This file is not valid JSON.':err.message);}finally{e.target.value='';}
});
window.addEventListener('storage',e=>{updateStorageRemaining();if(e.key===STORAGE_KEY) {readBlocked=true;warn('Your data changed in another tab. Reload this page before saving to avoid overwriting those changes.');}});
renderExerciseOptions();resetForm();render();
updateStorageRemaining();
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
