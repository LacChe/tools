// Run from the repo root: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyse, findPeriods } from "../tools/cycle/rules.js";
import { addDays } from "../shared/dates.js";

// log(["2026-01-01", "medium", "mild"], ...) -> the Map the app keeps
const log = (...rows) => new Map(rows.map(([date, flow, pain = null]) => [date, { v: 1, date, flow, pain, note: "" }]));
const period = (start, length = 5) => Array.from({ length }, (_, i) => [addDays(start, i), "medium"]);
// Periods starting at 2026-01-01, then after each of the given cycle lengths.
const history = (...lengths) => {
  let start = "2026-01-01";
  const rows = period(start);
  for (const n of lengths) { start = addDays(start, n); rows.push(...period(start)); }
  return { entries: log(...rows), lastStart: start };
};
const starts = (entries, today = "2026-12-31") => findPeriods(entries, today).map((p) => p.start);

test("unlogged days inside a period do not split it", () => {
  const p = findPeriods(log(["2026-03-01", "heavy"], ["2026-03-04", "light"], ["2026-03-05", "light"]), "2026-03-30");
  assert.deepEqual(p, [{ start: "2026-03-01", end: "2026-03-05", length: 5 }]);
});

test("spotting never starts or extends a period", () => {
  const p = findPeriods(log(["2026-03-01", "spotting"], ["2026-03-02", "medium"], ["2026-03-03", "spotting"], ["2026-03-20", "spotting"]), "2026-03-30");
  assert.deepEqual(p, [{ start: "2026-03-02", end: "2026-03-02", length: 1 }]);
});

test("a new period needs 10 days since the last start", () => {
  assert.deepEqual(starts(log(["2026-03-01", "medium"], ["2026-03-10", "medium"])), ["2026-03-01"]);
  assert.deepEqual(starts(log(["2026-03-01", "medium"], ["2026-03-11", "medium"])), ["2026-03-01", "2026-03-11"]);
});

test("long cycles count", () => {
  const { entries, lastStart } = history(28, 75);
  const a = analyse(entries, addDays(lastStart, 10));
  assert.deepEqual(a.cycleStats, { last: 75, min: 28, max: 75 });
});

test("no entries: 28 days, no forecast, no cycle day", () => {
  const a = analyse(new Map(), "2026-03-01");
  assert.deepEqual([a.cycleLength, a.forecast, a.cycleDay, a.enough, a.typical], [28, null, null, false, []]);
});

test("0 and 1 completed cycles: a single date 28 days on", () => {
  for (const { entries, lastStart } of [history(), history(33)]) {
    const a = analyse(entries, addDays(lastStart, 6));
    assert.deepEqual(a.forecast, { earliest: addDays(lastStart, 28), latest: addDays(lastStart, 28) });
    assert.deepEqual([a.cycleLength, a.enough, a.cycleStats, a.cycleDay], [28, false, null, 7]);
  }
});

test("2 completed cycles: a range, hidden once today is past it", () => {
  const { entries, lastStart } = history(27, 31);
  const range = { earliest: addDays(lastStart, 27), latest: addDays(lastStart, 31) };
  assert.deepEqual(analyse(entries, range.latest).forecast, range);
  assert.equal(analyse(entries, addDays(range.latest, 1)).forecast, null);
  assert.equal(analyse(entries, range.latest).cycleLength, 29);
});

test("7 completed cycles: only the last 6 count", () => {
  const { entries, lastStart } = history(60, 28, 29, 30, 28, 29, 30);
  const a = analyse(entries, addDays(lastStart, 8));
  assert.equal(a.cycles.length, 7);
  assert.deepEqual(a.cycleStats, { last: 30, min: 28, max: 30 });
  assert.equal(a.cycleLength, 29);
});

test("a period still going is left out of period figures", () => {
  const { entries, lastStart } = history(28, 28);
  for (let i = 2; i < 5; i++) entries.delete(addDays(lastStart, i));
  assert.equal(analyse(entries, addDays(lastStart, 1)).periodStats.last, 5);
  assert.equal(analyse(entries, addDays(lastStart, 8)).periodStats.last, 2);
});

test("future days are ignored", () => {
  assert.deepEqual(starts(log(["2026-03-20", "medium"]), "2026-03-01"), []);
});
