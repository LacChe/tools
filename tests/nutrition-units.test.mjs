// Run from the repo root: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { UNITS, kindOf, convert, formatQty, displayWeight, toKg } from "../tools/nutrition/units.js";
import { parseNum } from "../shared/numbers.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not near ${b}`);
const t = (key) => ({ unit_cup: "cup", unit_fl_oz: "fl oz" })[key] ?? key;

test("mass converts both ways inside the kind", () => {
  near(convert(1, "kg", "g"), 1000);
  near(convert(1000, "g", "kg"), 1);
  near(convert(1, "lb", "oz"), 16, 1e-3);
  near(convert(16, "oz", "lb"), 1, 1e-3);
});

test("volume converts both ways inside the kind", () => {
  near(convert(1, "cup", "ml"), 240);
  near(convert(240, "ml", "cup"), 1);
  near(convert(1, "tbsp", "tsp"), 3, 1e-3);
  near(convert(1, "l", "fl_oz"), 1000 / 29.5735);
});

test("a value survives a round trip through another unit of its kind", () => {
  near(convert(convert(2.5, "cup", "tbsp"), "tbsp", "cup"), 2.5);
});

test("conversion across kinds is null", () => {
  assert.equal(convert(1, "cup", "g"), null);
  assert.equal(convert(1, "oz", "fl_oz"), null);
  assert.equal(convert(1, "piece", "ml"), null);
});

test("an unknown unit converts to null", () => {
  assert.equal(convert(1, "stone", "g"), null);
  assert.equal(convert(1, "g", "stone"), null);
});

test("every unit has a kind and a positive factor", () => {
  for (const [code, u] of Object.entries(UNITS)) {
    assert.ok(["mass", "volume", "count"].includes(u.kind), code);
    assert.ok(u.factor > 0, code);
  }
  assert.equal(kindOf("fl_oz"), "volume");
  assert.equal(kindOf("nope"), null);
});

test("formatQty shows the number and the translated unit", () => {
  assert.equal(formatQty(0.25, "cup", t), "0.25 cup");
  assert.equal(formatQty(10, "fl_oz", t), "10 fl oz");
});

test("weight shows in the chosen system and is stored back as kg", () => {
  assert.equal(displayWeight(70, "metric"), 70);
  assert.equal(displayWeight(70, "us"), 154.3);
  assert.equal(toKg(154.3, "us"), 69.989);
  assert.equal(toKg(70, "metric"), 70);
});

test("parseNum still reads a comma as a decimal point", () => {
  assert.equal(parseNum("4,5"), 4.5);
  assert.equal(parseNum(""), null);
  assert.ok(Number.isNaN(parseNum("abc")));
});
