// Weekly body-weight targets from fitness_periodization_planner.html.
// Match its interpolation: both endpoints are included within each phase.
const PHASES = [
  [1, 8, 68.0, 64.85],
  [9, 2, 64.85, 64.98],
  [11, 8, 64.98, 61.86],
  [19, 2, 61.86, 62.0],
  [21, 4, 62.0, 60.45],
  [25, 12, 60.45, 64.06],
  [37, 3, 64.06, 62.22],
  [40, 12, 62.22, 65.9],
  [52, 3, 65.9, 64.02],
  [55, 12, 64.02, 67.78],
  [67, 3, 67.78, 65.85],
  [70, 12, 65.85, 69.68],
  [82, 3, 69.68, 67.71],
  [85, 11, 67.71, 71.28],
  [96, 3, 71.28, 69.95]
];
const START = '2026-10-14';
const DAY = 86400000;
const stamp = date => Date.parse(`${date}T12:00:00Z`);
const dateAt = time => new Date(time).toISOString().slice(0,10);
export function weightTargetWeek(date) {
  return dateAt(stamp(START) + Math.floor((stamp(date)-stamp(START))/(7*DAY))*7*DAY);
}
export function defaultWeightTargets() {
  const targets = {};
  for (const [week, duration, start, end] of PHASES) {
    for (let i=0; i<duration; i++) {
      const date = dateAt(stamp(START)+(week-1+i)*7*DAY);
      targets[date] = Number((start+(end-start)*i/(duration-1)).toFixed(2));
    }
  }
  return targets;
}
