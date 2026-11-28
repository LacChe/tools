// Run from the repo root: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { kcal, sumMacros, goalFor, percentOfGoal } from "../tools/nutrition/macros.js";

const goal = (effective_from, protein = 200, fat = 90, carbs = 260) => ({ effective_from, protein, fat, carbs });

test("200 / 90 / 260 g is 2,650 kcal", () => {
  assert.equal(kcal({ protein: 200, fat: 90, carbs: 260 }), 2650);
});

test("sumMacros adds each macro and derives kcal from the sums", () => {
  const s = sumMacros([{ protein: 10, fat: 5, carbs: 20 }, { protein: 2.5, fat: 0, carbs: 0 }]);
  assert.deepEqual(s, { protein: 12.5, fat: 5, carbs: 20, kcal: 12.5 * 4 + 45 + 80 });
});

test("sumMacros of no rows is all zero", () => {
  assert.deepEqual(sumMacros([]), { protein: 0, fat: 0, carbs: 0, kcal: 0 });
});

test("goalFor is null before the first goal", () => {
  assert.equal(goalFor([goal("2026-01-10")], "2026-01-09"), null);
  assert.equal(goalFor([], "2026-01-09"), null);
});

test("goalFor uses a goal on its effective date", () => {
  const g = goal("2026-01-10");
  assert.equal(goalFor([g], "2026-01-10"), g);
});

test("goalFor between two goals uses the earlier one", () => {
  const a = goal("2026-01-01");
  const b = goal("2026-03-01", 180);
  assert.equal(goalFor([a, b], "2026-02-28"), a);
  assert.equal(goalFor([a, b], "2026-03-01"), b);
  assert.equal(goalFor([a, b], "2026-12-31"), b);
});

test("percentOfGoal is null when there is no goal", () => {
  assert.equal(percentOfGoal({ protein: 100, fat: 45, carbs: 130 }, null), null);
});

test("percentOfGoal is each macro over its goal, and kcal over goal kcal", () => {
  const p = percentOfGoal({ protein: 100, fat: 45, carbs: 130 }, goal("2026-01-01"));
  assert.deepEqual(p, { protein: 0.5, fat: 0.5, carbs: 0.5, kcal: 0.5 });
});

test("going over the goal gives a ratio above 1, not a cap", () => {
  const p = percentOfGoal({ protein: 400, fat: 0, carbs: 0 }, goal("2026-01-01"));
  assert.equal(p.protein, 2);
});

test("a macro with a goal of 0 has a null percent and the others still count", () => {
  const p = percentOfGoal({ protein: 100, fat: 10, carbs: 130 }, goal("2026-01-01", 200, 0, 260));
  assert.equal(p.fat, null);
  assert.equal(p.protein, 0.5);
  assert.ok(p.kcal > 0);
});

test("kcal percent is null when every goal is 0", () => {
  const p = percentOfGoal({ protein: 1, fat: 1, carbs: 1 }, goal("2026-01-01", 0, 0, 0));
  assert.equal(p.kcal, null);
});
