// Cycle rules and figures. Plain functions: entries and today's date in, numbers out. No page or database code.
// The thresholds are this app's working choice, not a clinical definition.
import { addDays, parseISO } from "../../shared/dates.js";

export const FLOWS = ["none", "spotting", "light", "medium", "heavy"];
export const PAINS = ["none", "mild", "moderate", "severe"];
export const DEFAULT_LENGTH = 28;
const RECENT = 6; // averages and ranges use this many

export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const isPeriodFlow = (e) => FLOWS.indexOf(e.flow) >= FLOWS.indexOf("light"); // spotting never counts

// [{ start, end, length }], oldest first.
export function findPeriods(entries, today) {
  const days = [...entries.values()].filter((e) => e.date <= today && isPeriodFlow(e)).map((e) => e.date).sort();
  const periods = [];
  let previous = null;
  for (const day of days) {
    const quiet = !previous || daysBetween(previous, day) > 3; // none in the 3 days before
    const last = periods.at(-1);
    if (quiet && (!last || daysBetween(last.start, day) >= 10)) periods.push({ start: day, end: day });
    else if (daysBetween(last.end, day) <= 3) last.end = day; // bridges gaps of up to 2 days
    previous = day;
  }
  for (const p of periods) p.length = daysBetween(p.start, p.end) + 1;
  return periods;
}

const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
const summary = (list) => ({ last: list.at(-1), min: Math.min(...list), max: Math.max(...list) });

export function analyse(entries, today) {
  const periods = findPeriods(entries, today);
  // Completed cycles: from one start to the day before the next.
  const cycles = periods.slice(0, -1).map((p, i) => ({ start: p.start, length: daysBetween(p.start, periods[i + 1].start), period: p.length }));
  const recent = cycles.slice(-RECENT);
  const enough = cycles.length >= 2;
  // The latest period is complete once it can no longer be extended.
  const finished = periods.filter((p, i) => i < periods.length - 1 || daysBetween(p.end, today) > 2).slice(-RECENT);
  const last = periods.at(-1);

  const cycleLength = enough ? Math.round(mean(recent.map((c) => c.length))) : DEFAULT_LENGTH;
  const periodLength = finished.length ? Math.round(mean(finished.map((p) => p.length))) : last?.length ?? null;
  const cycleStats = enough ? summary(recent.map((c) => c.length)) : null;

  // Next period: none without a start, and none once today is past the latest expected date.
  let forecast = null;
  if (last) {
    const earliest = addDays(last.start, enough ? cycleStats.min : DEFAULT_LENGTH);
    const latest = addDays(last.start, enough ? cycleStats.max : DEFAULT_LENGTH);
    if (today <= latest) forecast = { earliest, latest };
  }

  return {
    periods,
    cycles,
    enough,
    cycleLength,
    periodLength,
    cycleStats,
    periodStats: enough && finished.length ? summary(finished.map((p) => p.length)) : null,
    cycleDay: last ? daysBetween(last.start, today) + 1 : null,
    forecast,
    typical: typicalPeriod(entries, finished, periodLength),
  };
}

// Middle value (the higher one of two). Null when there is nothing.
const median = (list) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] : null);

// For each day of a period: the usual flow and pain among logged days.
function typicalPeriod(entries, periods, length) {
  return Array.from({ length: periods.length ? length : 0 }, (_, i) => {
    const logged = periods.filter((p) => i < p.length).map((p) => entries.get(addDays(p.start, i))).filter(Boolean);
    const flow = median(logged.map((e) => FLOWS.indexOf(e.flow)));
    const pain = median(logged.filter((e) => e.pain).map((e) => PAINS.indexOf(e.pain)));
    return { flow: flow === null ? null : FLOWS[flow], pain: pain === null ? null : PAINS[pain] };
  });
}
