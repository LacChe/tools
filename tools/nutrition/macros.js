// Pure: calories, totals, goal lookup and percent of goal. Imports nothing.
// Percentages are ratios (1 = 100%) computed at display time; none is ever stored.

export const kcal = ({ protein, fat, carbs }) => protein * 4 + fat * 9 + carbs * 4;

export const sumMacros = (rows) => {
  const sum = { protein: 0, fat: 0, carbs: 0 };
  for (const r of rows) { sum.protein += r.protein; sum.fat += r.fat; sum.carbs += r.carbs; }
  return { ...sum, kcal: kcal(sum) };
};

// goals are sorted ascending by effective_from; dates are "YYYY-MM-DD", so strings compare correctly.
export const goalFor = (goals, date) => {
  let found = null;
  for (const g of goals) if (g.effective_from <= date) found = g;
  return found;
};

const ratio = (actual, goal) => (goal > 0 ? actual / goal : null);

// Null when there is no goal; a key is null when its own goal is 0.
export const percentOfGoal = (totals, goal) => {
  if (!goal) return null;
  return {
    protein: ratio(totals.protein, goal.protein),
    fat: ratio(totals.fat, goal.fat),
    carbs: ratio(totals.carbs, goal.carbs),
    kcal: ratio(kcal(totals), kcal(goal)),
  };
};
