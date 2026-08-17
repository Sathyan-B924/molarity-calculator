await import("../calculator.js");

import assert from "node:assert/strict";

const {
  calculateFinalVolume,
  consistencyDifference,
  formatResult,
  massToGrams,
  molarityToMolar,
  solveMissing,
  volumeToLiters,
} = globalThis.MolarityCalculator;

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be close to ${expected}`);
}

const sodiumBorohydride = {
  mass: 42.1,
  massUnit: "mg",
  molarMass: 37.83,
  molarity: 1,
  molarityUnit: "M",
  volumeUnit: "uL",
};

const expectedMicroliters = 1112.873380914618;
closeTo(calculateFinalVolume(sodiumBorohydride), expectedMicroliters);

closeTo(calculateFinalVolume({ ...sodiumBorohydride, mass: 42100, massUnit: "ug" }), expectedMicroliters);
closeTo(calculateFinalVolume({ ...sodiumBorohydride, mass: 0.0421, massUnit: "g" }), expectedMicroliters);
closeTo(
  calculateFinalVolume({ ...sodiumBorohydride, molarity: 1000, molarityUnit: "mM", volumeUnit: "mL" }),
  1.112873380914618,
);
closeTo(
  calculateFinalVolume({ ...sodiumBorohydride, molarity: 1_000_000, molarityUnit: "uM", volumeUnit: "L" }),
  0.001112873380914618,
);

assert.equal(calculateFinalVolume({ ...sodiumBorohydride, mass: 0 }), null);
assert.equal(calculateFinalVolume({ ...sodiumBorohydride, molarMass: "" }), null);
assert.equal(calculateFinalVolume({ ...sodiumBorohydride, molarity: -1 }), null);

const units = { mass: "mg", molarity: "M", volume: "uL" };
const values = { mass: 42.1, molarMass: 37.83, molarity: 1, volume: expectedMicroliters };

for (const field of Object.keys(values)) {
  const withMissing = { ...values, [field]: "" };
  const solution = solveMissing(withMissing, units);
  assert.equal(solution.field, field);
  closeTo(solution.value, values[field], field === "volume" ? 1e-8 : 1e-10);
}

const alternateUnits = { mass: "ug", molarity: "mM", volume: "mL" };
const alternateValues = { mass: 42100, molarMass: 37.83, molarity: 1000, volume: 1.112873380914618 };
for (const field of Object.keys(alternateValues)) {
  const solution = solveMissing({ ...alternateValues, [field]: "" }, alternateUnits);
  assert.equal(solution.field, field);
  closeTo(solution.value, alternateValues[field], 1e-8);
}

assert.equal(solveMissing({ mass: "", molarMass: "", molarity: 1, volume: 1000 }, units), null);
assert.equal(solveMissing(values, units), null);
closeTo(consistencyDifference(values, units), 0);
assert.ok(consistencyDifference({ ...values, volume: 1200 }, units) > 7);

closeTo(massToGrams(1000, "ug"), 0.001);
closeTo(molarityToMolar(1000, "mM"), 1);
closeTo(volumeToLiters(1000, "uL"), 0.001);
assert.equal(formatResult(expectedMicroliters, 3), "1112.873");
assert.equal(formatResult(0.0000001, 3), "1.000e-7");

/* ---- Compound library ---------------------------------------------- */

const {
  compoundSearchKey,
  compoundSaveIntent,
  searchCompounds,
  normalizeCompound,
  rememberCompound,
  forgetCompound,
  sanitizeCompoundHistory,
  mergeCompoundSources,
  findCompound,
} = globalThis.MolarityCalculator;

await import("../compounds.js");
const presets = globalThis.MOLARITY_COMPOUNDS;
const library = mergeCompoundSources(presets, []);

// The six bench compounds carry the molar masses the app relies on.
assert.equal(presets.length, 6);
for (const [name, formula, molarMass] of [
  ["Sodium borohydride", "NaBH4", 37.83],
  ["Ammonia borane", "NH3-BH3", 30.87],
  ["4-Nitrophenol", "C6H5NO3", 139.11],
  ["4-Aminophenol", "C6H7NO", 109.13],
  ["Boric acid", "H3BO3", 61.83],
  ["Tris", "C4H11NO3", 121.14],
]) {
  const match = presets.find((compound) => compound.name === name);
  assert.ok(match, `missing preset ${name}`);
  assert.equal(match.formula, formula);
  assert.equal(match.molarMass, molarMass);
}

/* Case and punctuation carry no meaning in a search key. */
assert.equal(compoundSearchKey("NH3-BH3"), "nh3bh3");
assert.equal(compoundSearchKey("nh3 bh3"), "nh3bh3");
assert.equal(compoundSearchKey(" 4-Nitrophenol "), "4nitrophenol");
assert.equal(compoundSearchKey("  "), "");

/* The ways these are actually written at the bench all reach the entry. */
for (const [query, expected] of [
  ["nabh4", "Sodium borohydride"],
  ["NaBH", "Sodium borohydride"],
  ["borohydride", "Sodium borohydride"],
  ["nh3bh3", "Ammonia borane"],
  ["NH3-BH3", "Ammonia borane"],
  ["ammonia", "Ammonia borane"],
  ["borazane", "Ammonia borane"],
  ["4-NP", "4-Nitrophenol"],
  ["pnp", "4-Nitrophenol"],
  ["para-nitrophenol", "4-Nitrophenol"],
  ["4 nitrophenol", "4-Nitrophenol"],
  ["4-AP", "4-Aminophenol"],
  ["p-aminophenol", "4-Aminophenol"],
  ["boric", "Boric acid"],
  ["h3bo3", "Boric acid"],
  ["tromethamine", "Tris"],
  ["tham", "Tris"],
  ["tris", "Tris"],
]) {
  const hits = searchCompounds(library, query);
  assert.ok(hits.length > 0, `no suggestion for "${query}"`);
  assert.equal(hits[0].name, expected, `"${query}" should suggest ${expected}, got ${hits[0].name}`);
}

// "phenol" is ambiguous and must offer both rather than guessing.
const phenols = searchCompounds(library, "phenol").map((c) => c.name);
assert.ok(phenols.includes("4-Nitrophenol") && phenols.includes("4-Aminophenol"));

// An empty query shows nothing: the list appears only once there is a query.
assert.deepEqual(searchCompounds(library, ""), []);
assert.deepEqual(searchCompounds(library, "   "), []);
assert.deepEqual(searchCompounds(library, "zzzz"), []);
assert.ok(searchCompounds(library, "o", 3).length <= 3);

// An exact term outranks a longer name that merely contains it.
assert.equal(searchCompounds(library, "tris")[0].name, "Tris");

/* ---- Storage ---- */

assert.equal(normalizeCompound({ name: "X", molarMass: 0 }), null);
assert.equal(normalizeCompound({ name: "", molarMass: 10 }), null);
assert.equal(normalizeCompound({ name: "X", molarMass: "abc" }), null);
assert.deepEqual(normalizeCompound({ name: " X ", molarMass: "12.5" }), {
  name: "X",
  formula: "",
  molarMass: 12.5,
  aliases: [],
});

// Most recent first; re-saving moves and revises rather than duplicating.
let history = rememberCompound([], { name: "AAA", molarMass: 1 });
history = rememberCompound(history, { name: "BBB", molarMass: 2 });
assert.deepEqual(history.map((c) => c.name), ["BBB", "AAA"]);
history = rememberCompound(history, { name: "aaa", molarMass: 3 });
assert.deepEqual(history.map((c) => c.name), ["aaa", "BBB"]);
assert.equal(history[0].molarMass, 3);

let capped = [];
for (let i = 0; i < 20; i += 1) capped = rememberCompound(capped, { name: `C${i}`, molarMass: i + 1 }, 5);
assert.equal(capped.length, 5);
assert.deepEqual(capped.map((c) => c.name), ["C19", "C18", "C17", "C16", "C15"]);

assert.deepEqual(rememberCompound(history, { name: "", molarMass: 5 }), history);
assert.deepEqual(forgetCompound(history, "AAA").map((c) => c.name), ["BBB"]);
assert.deepEqual(forgetCompound(history, "nope").map((c) => c.name), ["aaa", "BBB"]);

assert.deepEqual(sanitizeCompoundHistory(null), []);
assert.deepEqual(sanitizeCompoundHistory("nope"), []);
assert.deepEqual(
  sanitizeCompoundHistory([
    { name: "A", molarMass: 1 },
    { name: "a", molarMass: 9 },
    { junk: true },
    { name: "B", molarMass: -1 },
  ]).map((c) => c.name),
  ["A"],
);

// A remembered entry can never shadow a built-in preset.
const merged = mergeCompoundSources(presets, [
  { name: "Tris", molarMass: 1 },
  { name: "MyBuffer", molarMass: 200 },
]);
const tris = merged.filter((c) => c.name === "Tris");
assert.equal(tris.length, 1);
assert.equal(tris[0].molarMass, 121.14);
assert.equal(tris[0].remembered, false);
assert.equal(merged.find((c) => c.name === "MyBuffer").remembered, true);

assert.equal(findCompound(library, "pnp").molarMass, 139.11);
assert.equal(findCompound(library, "  Boric acid ").molarMass, 61.83);
assert.equal(findCompound(library, ""), null);
assert.equal(findCompound(library, "unknown"), null);

/* ---- Save prompt ---- */

// An unknown compound with a valid mass is offered for saving.
assert.deepEqual(compoundSaveIntent(library, "MyBuffer", "250.5"), {
  action: "save",
  name: "MyBuffer",
  molarMass: 250.5,
});

// Nothing to offer without both halves, or when it is already known.
assert.equal(compoundSaveIntent(library, "", "250"), null);
assert.equal(compoundSaveIntent(library, "MyBuffer", ""), null);
assert.equal(compoundSaveIntent(library, "MyBuffer", "0"), null);
assert.equal(compoundSaveIntent(library, "Tris", "121.14"), null);
assert.equal(compoundSaveIntent(library, "tromethamine", "121.14"), null);

// A built-in's mass is authoritative and is never offered for revision.
assert.equal(compoundSaveIntent(library, "Tris", "999"), null);

// The bench's own entry can be corrected.
const withOwn = mergeCompoundSources(presets, [{ name: "MyBuffer", molarMass: 200 }]);
assert.deepEqual(compoundSaveIntent(withOwn, "MyBuffer", "210"), {
  action: "update",
  name: "MyBuffer",
  molarMass: 210,
  previous: 200,
});


// Suggestions must carry the source flag so saved entries can be marked.
const libWithSaved = mergeCompoundSources(presets, [{ name: "PVP K30", molarMass: 40000 }]);
assert.equal(searchCompounds(libWithSaved, "pvp")[0].remembered, true);
assert.equal(searchCompounds(libWithSaved, "tris")[0].remembered, false);
assert.deepEqual(searchCompounds([], "anything"), []);

console.log("All molarity calculator tests passed.");
