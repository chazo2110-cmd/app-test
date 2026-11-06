import { id, parseDecimal, shiftDate, validateData, localDate } from './domain.js';
import { NUTRIENTS, NUTRIENT_LABELS, nutritionOf, nutrientsFor, dailyNutrition, compareNutrient, foodForDate, entryBelongsToFood, updateFoodFromDate } from './nutrition.js';

export function initNutrition({ getData, getDate, save, toast }) {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const number = value => new Intl.NumberFormat('en-US', { maximumFractionDigits:2 }).format(value);
  const labelDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
  const isLimit = key => key === 'sugar' || key === 'salt';
  let editingEntry = null, editingFood = null, renderedDate = null, renderedTargets = null;

  $('#target-fields').innerHTML = NUTRIENTS.map(key => `<div><label for="target-${key}">${NUTRIENT_LABELS[key]}${isLimit(key)?' limit':''} (g)</label><input id="target-${key}" type="text" inputmode="decimal" placeholder="Not set"></div>`).join('');
  $('#food-nutrient-fields').innerHTML = NUTRIENTS.map(key => `<div><label for="food-${key}">${NUTRIENT_LABELS[key]} (g)</label><input id="food-${key}" type="text" inputmode="decimal" value="0" required></div>`).join('');

  function commit(nutrition) {
    try { return save(validateData({ ...getData(), nutrition })); }
    catch(error) { toast(error.message); return false; }
  }
  function nutrientText(values) {
    return NUTRIENTS.map(key => `${NUTRIENT_LABELS[key]} ${number(values[key])} g`).join(' · ');
  }
  function selectedFood() {
    const nutrition = nutritionOf(getData());
    return editingEntry ? nutrition.entries.find(e => e.id === editingEntry) : foodForDate(nutrition.foods.find(f => f.id === $('#diary-food').value), getDate());
  }
  function preview() {
    const food = selectedFood(), amount = parseDecimal($('#food-amount').value);
    $('#amount-unit').textContent = food?.unit || 'g';
    $('#food-preview').textContent = food ? (Number.isFinite(amount) && amount > 0 ? nutrientText(nutrientsFor(food.nutrients, amount)) : `Per 100 ${food.unit}: ${nutrientText(food.nutrients)}`) : 'Your library is empty. Choose New food below to get started.';
  }
  function resetEntry() {
    editingEntry = null;
    $('#food-entry-form').reset();
    $('#entry-error').textContent = '';
    $('#food-entry-title').textContent = 'Log food';
    $('#cancel-food-entry').hidden = true;
  }
  function render() {
    const nutrition = nutritionOf(getData()), date = getDate();
    if (date !== renderedDate || (editingEntry && !nutrition.entries.some(e => e.id === editingEntry))) resetEntry();
    const targets = nutrition.targets[date] || {}, targetSignature = JSON.stringify(targets);
    if (date !== renderedDate || targetSignature !== renderedTargets) {
      for (const key of NUTRIENTS) $(`#target-${key}`).value = targets[key] ?? '';
      $('#targets-error').textContent = '';
    }
    renderedDate = date; renderedTargets = targetSignature;
    $('#nutrition-date').textContent = labelDate(date).toUpperCase();
    $('#previous-targets').disabled = !nutrition.targets[shiftDate(date, -1)];
    const total = dailyNutrition(nutrition, date);
    $('#nutrient-cards').innerHTML = NUTRIENTS.map(key => {
      const target = targets[key], comparison = compareNutrient(total[key], target, isLimit(key));
      const text = comparison.status === 'unset' ? 'Set a daily target' : comparison.status === 'over' ? `${number(-comparison.difference)} g over ${isLimit(key)?'limit':'target'}` : comparison.status === 'within' ? `${number(comparison.difference)} g below limit` : comparison.status === 'met' ? 'Target reached' : `${number(comparison.difference)} g remaining`;
      return `<article class="nutrient-card"><span>${NUTRIENT_LABELS[key]}${isLimit(key)?' · limit':''}</span><div><strong>${number(total[key])}</strong><small>/ ${target == null?'—':number(target)} g</small></div><div class="nutrient-track" aria-hidden="true"><i style="width:${comparison.percent === null?0:Math.max(0,Math.min(100,comparison.percent))}%"></i></div><p class="${comparison.status === 'over'?'nutrient-over':''}">${text}</p></article>`;
    }).join('');
    const previous = $('#diary-food').value;
    $('#diary-food').innerHTML = nutrition.foods.map(food => `<option value="${esc(food.id)}">${esc(foodForDate(food, date).name)} · ${foodForDate(food, date).unit}</option>`).join('') || '<option value="">No foods yet</option>';
    if (editingEntry) {
      const entry = nutrition.entries.find(e => e.id === editingEntry);
      const option = document.createElement('option'); option.value = '__saved__'; option.textContent = `${entry.name} · saved nutrition`; $('#diary-food').append(option); $('#diary-food').value = '__saved__';
    } else if (nutrition.foods.some(f => f.id === previous)) $('#diary-food').value = previous;
    $('#diary-food').disabled = !!editingEntry || !nutrition.foods.length;
    $('#save-food-entry').disabled = !editingEntry && !nutrition.foods.length;
    preview();
    const entries = nutrition.entries.filter(entry => entry.date === date);
    $('#food-entry-count').textContent = entries.length;
    $('#food-diary').innerHTML = entries.length ? entries.map(entry => `<article class="food-row"><div><h3>${esc(entry.name)}</h3><p>${number(entry.amount)} ${entry.unit} · ${nutrientText(nutrientsFor(entry.nutrients, entry.amount))}</p></div><div class="entry-actions"><button type="button" data-entry-edit="${esc(entry.id)}">Edit</button><button type="button" data-entry-delete="${esc(entry.id)}">Delete</button></div></article>`).join('') : '<div class="empty-log"><h3>A fresh plate.</h3><p>No food logged for this day. Add a food to your library, then log your portion above.</p></div>';
    $('#food-library-list').innerHTML = nutrition.foods.length ? nutrition.foods.map(food => `<article class="food-row"><div><h3>${esc(food.name)}</h3><p>Per 100 ${food.unit} · ${nutrientText(food.nutrients)}${food.versions?` · Updated ${labelDate(food.versions.at(-1).effectiveDate)}`:''}</p></div><div class="entry-actions"><button type="button" data-food-edit="${esc(food.id)}">Edit</button><button type="button" data-food-delete="${esc(food.id)}">Delete</button></div></article>`).join('') : '<div class="empty-log"><h3>Your food library starts here.</h3><p>Add your first food using the nutrition label on its packaging.</p></div>';
  }

  $('#targets-form').addEventListener('submit', event => {
    event.preventDefault(); const targets = {};
    for (const key of NUTRIENTS) {
      const text = $(`#target-${key}`).value.trim(), value = text === '' ? null : parseDecimal(text);
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > 10000)) { $('#targets-error').textContent = 'Enter amounts from 0 to 10000 g, or leave blank. Use a dot or comma for decimals.'; return; }
      targets[key] = value;
    }
    const nutrition = nutritionOf(getData());
    if (commit({ ...nutrition, targets:{ ...nutrition.targets, [getDate()]: targets } })) { $('#targets-error').textContent = ''; render(); toast('Daily nutrition targets saved.'); }
  });
  $('#previous-targets').addEventListener('click', () => {
    const targets = nutritionOf(getData()).targets[shiftDate(getDate(), -1)]; if (!targets) return;
    for (const key of NUTRIENTS) $(`#target-${key}`).value = targets[key] ?? '';
    $('#targets-error').textContent = ''; toast('Previous targets filled in. Choose Save targets to apply.');
  });
  function openFood(food = null) {
    editingFood = food?.id || null; $('#food-form').reset();
    $('#food-dialog-title').textContent = food ? 'Edit food.' : 'Add a food.';
    const current = foodForDate(food, localDate());
    $('#food-name').value = current?.name || ''; $('#food-unit').value = current?.unit || 'g';
    $('#food-unit').disabled = !!food && nutritionOf(getData()).entries.some(entry => entryBelongsToFood(entry, food));
    $('#food-effective-date').textContent = food ? `Changes apply from ${labelDate(localDate())}, including saved portions on that day and later. Earlier dates keep their original values. For a different g/ml unit, add a separate food.` : 'New foods are also available when logging a past day.';
    for (const key of NUTRIENTS) $(`#food-${key}`).value = current?.nutrients[key] ?? 0;
    $('#food-error').textContent = ''; $('#food-dialog').showModal();
  }
  $('#new-food').addEventListener('click', () => openFood());
  $('#food-form').addEventListener('submit', event => {
    event.preventDefault(); const nutrition = nutritionOf(getData()), name = $('#food-name').value.trim(), nutrients = {};
    if (!name) { $('#food-error').textContent = 'Enter a food name.'; return; }
    if (nutrition.foods.some(f => f.id !== editingFood && f.name.toLowerCase() === name.toLowerCase())) { $('#food-error').textContent = 'This food is already in your library.'; return; }
    for (const key of NUTRIENTS) {
      const value = parseDecimal($(`#food-${key}`).value);
      if (!Number.isFinite(value) || value < 0 || value > 1000) { $('#food-error').textContent = 'Enter each nutrient from 0 to 1000 g per 100 g/ml. Use 0 if none.'; return; }
      nutrients[key] = value;
    }
    const food = { id: editingFood || id(), name, unit: $('#food-unit').value, nutrients };
    try {
      const effectiveDate = localDate();
      if (commit(updateFoodFromDate(nutrition, food, effectiveDate))) { $('#food-dialog').close(); render(); if (!editingEntry) { $('#diary-food').value = food.id; preview(); } toast(editingFood?`Food updated from ${labelDate(effectiveDate)}. Earlier days are unchanged.`:'Food saved.'); }
    } catch(error) { $('#food-error').textContent = error.message; }
  });
  $('#food-library-list').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    const nutrition = nutritionOf(getData()), food = nutrition.foods.find(f => f.id === (button.dataset.foodEdit || button.dataset.foodDelete)); if (!food) return;
    if (button.dataset.foodEdit) openFood(food);
    else if (confirm(`Delete ${food.name} from your library? Existing diary entries will be kept.`) && commit({ ...nutrition, foods:nutrition.foods.filter(f => f.id !== food.id), entries:nutrition.entries.map(entry => entryBelongsToFood(entry,food)?{...entry,foodId:food.id}:entry) })) { render(); toast('Food deleted. Your diary is kept.'); }
  });
  $('#diary-food').addEventListener('change', preview); $('#food-amount').addEventListener('input', preview);
  $('#food-entry-form').addEventListener('submit', event => {
    event.preventDefault(); const food = selectedFood(), amount = parseDecimal($('#food-amount').value);
    if (!food) { $('#entry-error').textContent = 'Add and select a food first.'; return; }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) { $('#entry-error').textContent = 'Enter an amount greater than 0 and up to 100000 g/ml. Decimals can use a dot or comma.'; return; }
    const nutrition = nutritionOf(getData()), entry = { id: editingEntry || id(), date:getDate(), name:food.name, unit:food.unit, amount, nutrients:{ ...food.nutrients }, ...((editingEntry ? food.foodId : food.id) ? {foodId:editingEntry ? food.foodId : food.id} : {}) };
    const entries = editingEntry ? nutrition.entries.map(e => e.id === editingEntry ? entry : e) : [...nutrition.entries, entry];
    if (commit({ ...nutrition, entries })) { resetEntry(); render(); toast('Food diary saved.'); }
  });
  $('#cancel-food-entry').addEventListener('click', () => { resetEntry(); render(); });
  $('#food-diary').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    const nutrition = nutritionOf(getData()), entry = nutrition.entries.find(e => e.id === (button.dataset.entryEdit || button.dataset.entryDelete)); if (!entry) return;
    if (button.dataset.entryEdit) {
      editingEntry = entry.id; $('#food-entry-title').textContent = 'Edit food entry'; $('#cancel-food-entry').hidden = false; $('#entry-error').textContent = ''; $('#food-amount').value = entry.amount; render(); $('#food-entry-form').scrollIntoView({block:'center'}); $('#food-amount').focus({preventScroll:true});
    } else if (confirm(`Delete this ${entry.name} entry?`) && commit({ ...nutrition, entries:nutrition.entries.filter(e => e.id !== entry.id) })) { if (editingEntry === entry.id) resetEntry(); render(); toast('Food diary entry deleted.'); }
  });
  return { render };
}
