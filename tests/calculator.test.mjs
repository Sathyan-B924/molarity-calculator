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

console.log("All molarity calculator tests passed.");
