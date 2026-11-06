export const NUTRIENTS = ['protein', 'carbs', 'fat', 'sugar', 'salt'];
export const NUTRIENT_LABELS = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat', sugar: 'Sugar', salt: 'Salt' };
export function emptyNutrition() { return { foods: [], entries: [], targets: {} }; }
export function nutritionOf(data) { return data.nutrition || emptyNutrition(); }
export function zeroNutrients() { return Object.fromEntries(NUTRIENTS.map(key => [key, 0])); }
export function nutrientsFor(nutrients, amount) {
  return Object.fromEntries(NUTRIENTS.map(key => [key, nutrients[key] * amount / 100]));
}
export function dailyNutrition(nutrition, date) {
  return nutrition.entries.filter(entry => entry.date === date).reduce((sum, entry) => {
    const values = nutrientsFor(entry.nutrients, entry.amount);
    for (const key of NUTRIENTS) sum[key] += values[key];
    return sum;
  }, zeroNutrients());
}
export function compareNutrient(consumed, target, isLimit = false) {
  if (target === null || target === undefined) return { percent: null, difference: null, status: 'unset' };
  const difference = Math.round((target - consumed) * 1e8) / 1e8;
  return { percent: target === 0 ? (consumed === 0 ? 0 : 100) : consumed / target * 100,
    difference, status: difference < 0 ? 'over' : isLimit ? 'within' : difference === 0 ? 'met' : 'remaining' };
}
export function validateNutrition(value, validDate) {
  if (!value || !Array.isArray(value.foods) || !Array.isArray(value.entries) || !value.targets || typeof value.targets !== 'object' || Array.isArray(value.targets)) throw new Error('Nutrition data is invalid.');
  const validName = name => typeof name === 'string' && name.trim().length > 0 && name.length <= 80;
  const validUnit = unit => unit === 'g' || unit === 'ml';
  const validNutrients = values => values && NUTRIENTS.every(key => Number.isFinite(values[key]) && values[key] >= 0 && values[key] <= 1000);
  const foodIds = new Set(), names = new Set(), entryIds = new Set();
  for (const food of value.foods) {
    if (!food || typeof food.id !== 'string' || !food.id || foodIds.has(food.id) || !validName(food.name) || names.has(food.name.trim().toLowerCase()) || !validUnit(food.unit) || !validNutrients(food.nutrients)) throw new Error('A food in your library is invalid.');
    foodIds.add(food.id); names.add(food.name.trim().toLowerCase());
  }
  for (const entry of value.entries) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || entryIds.has(entry.id) || !validDate(entry.date) || !validName(entry.name) || !validUnit(entry.unit) || !Number.isFinite(entry.amount) || entry.amount <= 0 || entry.amount > 100000 || !validNutrients(entry.nutrients)) throw new Error('A food diary entry is invalid.');
    entryIds.add(entry.id);
  }
  for (const [date, targets] of Object.entries(value.targets)) {
    if (!validDate(date) || !targets || !NUTRIENTS.every(key => targets[key] === null || (Number.isFinite(targets[key]) && targets[key] >= 0 && targets[key] <= 10000))) throw new Error('A daily nutrition target is invalid.');
  }
  const cleanNutrients = values => Object.fromEntries(NUTRIENTS.map(key => [key, values[key]]));
  return {
    foods: value.foods.map(food => ({ id: food.id, name: food.name.trim(), unit: food.unit, nutrients: cleanNutrients(food.nutrients) })),
    // Diary entries keep a nutritional snapshot, so library changes never rewrite history.
    entries: value.entries.map(entry => ({ id: entry.id, date: entry.date, name: entry.name.trim(), unit: entry.unit, amount: entry.amount, nutrients: cleanNutrients(entry.nutrients) })),
    targets: Object.fromEntries(Object.entries(value.targets).map(([date, targets]) => [date, Object.fromEntries(NUTRIENTS.map(key => [key, targets[key]]))]))
  };
}
