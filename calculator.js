(() => {
  const MASS_FACTORS = Object.freeze({ ug: 1e-6, mg: 1e-3, g: 1 });
  const MOLARITY_FACTORS = Object.freeze({ uM: 1e-6, mM: 1e-3, M: 1 });
  const VOLUME_FACTORS = Object.freeze({ uL: 1e-6, mL: 1e-3, L: 1 });

  function positiveNumber(value) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function convert(value, fromUnit, toUnit, factors) {
    const number = positiveNumber(value);
    if (number === null || !(fromUnit in factors) || !(toUnit in factors)) return null;
    return (number * factors[fromUnit]) / factors[toUnit];
  }

  function massToGrams(value, unit) {
    return convert(value, unit, "g", MASS_FACTORS);
  }

  function gramsToMass(value, unit) {
    return convert(value, "g", unit, MASS_FACTORS);
  }

  function molarityToMolar(value, unit) {
    return convert(value, unit, "M", MOLARITY_FACTORS);
  }

  function molarToMolarity(value, unit) {
    return convert(value, "M", unit, MOLARITY_FACTORS);
  }

  function volumeToLiters(value, unit) {
    return convert(value, unit, "L", VOLUME_FACTORS);
  }

  function litersToVolume(value, unit) {
    return convert(value, "L", unit, VOLUME_FACTORS);
  }

  /** Calculate final solution volume from mass, molar mass, and target molarity. */
  function calculateFinalVolume({
    mass,
    massUnit = "mg",
    molarMass,
    molarity,
    molarityUnit = "M",
    volumeUnit = "uL",
  }) {
    const massGrams = massToGrams(mass, massUnit);
    const molarMassValue = positiveNumber(molarMass);
    const molarityMolar = molarityToMolar(molarity, molarityUnit);

    if (massGrams === null || molarMassValue === null || molarityMolar === null) return null;

    const liters = massGrams / molarMassValue / molarityMolar;
    return litersToVolume(liters, volumeUnit);
  }

  /** Solve exactly one missing quantity among mass, molar mass, molarity, and volume. */
  function solveMissing(values, units) {
    const keys = ["mass", "molarMass", "molarity", "volume"];
    const missing = keys.filter((key) => positiveNumber(values[key]) === null);
    if (missing.length !== 1) return null;

    const missingField = missing[0];
    const massGrams = missingField === "mass" ? null : massToGrams(values.mass, units.mass);
    const molarMassValue = missingField === "molarMass" ? null : positiveNumber(values.molarMass);
    const molarityMolar = missingField === "molarity" ? null : molarityToMolar(values.molarity, units.molarity);
    const volumeLiters = missingField === "volume" ? null : volumeToLiters(values.volume, units.volume);
    let result;

    if (missingField === "mass") {
      result = gramsToMass(molarityMolar * molarMassValue * volumeLiters, units.mass);
    } else if (missingField === "molarMass") {
      result = massGrams / (molarityMolar * volumeLiters);
    } else if (missingField === "molarity") {
      result = molarToMolarity(massGrams / (molarMassValue * volumeLiters), units.molarity);
    } else {
      result = litersToVolume(massGrams / (molarMassValue * molarityMolar), units.volume);
    }

    return Number.isFinite(result) && result > 0 ? { field: missingField, value: result } : null;
  }

  function consistencyDifference(values, units) {
    const expectedVolume = calculateFinalVolume({
      mass: values.mass,
      massUnit: units.mass,
      molarMass: values.molarMass,
      molarity: values.molarity,
      molarityUnit: units.molarity,
      volumeUnit: units.volume,
    });
    const suppliedVolume = positiveNumber(values.volume);
    if (expectedVolume === null || suppliedVolume === null) return null;
    return Math.abs(expectedVolume - suppliedVolume) / expectedVolume * 100;
  }

  function formatResult(value, decimals = 3) {
    const number = Number(value);
    const places = Math.max(0, Math.min(6, Number(decimals) || 0));
    if (!Number.isFinite(number)) return "";
    if (number !== 0 && Math.abs(number) < 10 ** -places) {
      return number.toExponential(Math.max(1, places));
    }
    return number.toFixed(places);
  }

  function unitLabel(unit) {
    return ({ ug: "µg", mg: "mg", g: "g", uM: "µM", mM: "mM", M: "M", uL: "µL", mL: "mL", L: "L" })[unit] ?? unit;
  }

  globalThis.MolarityCalculator = Object.freeze({
    MASS_FACTORS,
    MOLARITY_FACTORS,
    VOLUME_FACTORS,
    positiveNumber,
    massToGrams,
    gramsToMass,
    molarityToMolar,
    molarToMolarity,
    volumeToLiters,
    litersToVolume,
    calculateFinalVolume,
    solveMissing,
    consistencyDifference,
    formatResult,
    unitLabel,
  });
})();
