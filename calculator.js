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

  /* ---- Compound library -------------------------------------------------
     Two sources feed one suggestion list: the built-in presets in
     compounds.js, and the compounds this bench has actually used. The
     remembered half lives in localStorage, so these helpers stay pure and
     the storage layer in app.js only calls them.                          */

  const COMPOUND_HISTORY_LIMIT = 12;
  const COMPOUND_SUGGESTION_LIMIT = 6;

  function compoundKey(value) {
    return String(value ?? "").trim().toLowerCase();
  }

  /* Search key: case and punctuation carry no meaning when a compound may
     be written NH3-BH3, nh3 bh3 or NH3BH3. Collapse them all. */
  function compoundSearchKey(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  /* An entry is usable only with a name and a real positive molar mass. */
  function normalizeCompound(entry) {
    if (!entry || typeof entry !== "object") return null;
    const formula = String(entry.formula ?? "").trim();
    const rawName = String(entry.name ?? "").trim();
    const name = rawName || formula;
    const molarMass = positiveNumber(entry.molarMass);
    if (!name || molarMass === null) return null;
    const aliases = Array.isArray(entry.aliases)
      ? [...new Set(entry.aliases.map((alias) => String(alias ?? "").trim()).filter(Boolean))]
      : [];
    return { name, formula, molarMass, aliases };
  }

  /* Every string a user might type to mean this compound. */
  function compoundTerms(compound) {
    return [compound.name, compound.formula, ...(compound.aliases ?? [])]
      .filter(Boolean)
      .map((term) => ({ term, key: compoundSearchKey(term) }))
      .filter((entry) => entry.key);
  }

  /* Rank: exact term beats prefix beats substring, so typing "tris" puts
     Tris first even though the string also appears inside its long name. */
  function compoundMatchRank(compound, queryKey) {
    let best = null;
    for (const { term, key } of compoundTerms(compound)) {
      let rank = null;
      if (key === queryKey) rank = 0;
      else if (key.startsWith(queryKey)) rank = 1;
      else if (key.includes(queryKey)) rank = 2;
      if (rank === null) continue;
      if (best === null || rank < best.rank || (rank === best.rank && term.length < best.term.length)) {
        best = { rank, term };
      }
    }
    return best;
  }

  /* Suggestions for what the user has typed so far. An empty query returns
     nothing: the list only appears once there is something to match. */
  function searchCompounds(list, query, limit = COMPOUND_SUGGESTION_LIMIT) {
    const queryKey = compoundSearchKey(query);
    if (!queryKey) return [];
    const source = Array.isArray(list) ? list : [];
    return source
      /* Normalise per item rather than via sanitizeCompoundHistory, which
         drops the `remembered` flag the suggestion list needs. */
      .map((item) => {
        const compound = normalizeCompound(item);
        return compound ? { ...compound, remembered: item.remembered === true } : null;
      })
      .filter(Boolean)
      .map((compound) => ({ compound, match: compoundMatchRank(compound, queryKey) }))
      .filter((entry) => entry.match !== null)
      .sort((a, b) => a.match.rank - b.match.rank || a.compound.name.localeCompare(b.compound.name))
      .slice(0, Math.max(0, limit))
      .map((entry) => ({ ...entry.compound, matchedTerm: entry.match.term }));
  }

  /* What the save prompt should offer for the current pair, if anything. */
  function compoundSaveIntent(list, name, molarMass) {
    const label = String(name ?? "").trim();
    const mass = positiveNumber(molarMass);
    if (!label || mass === null) return null;
    const known = findCompound(list, label);
    if (!known) return { action: "save", name: label, molarMass: mass };
    if (known.molarMass === mass) return null;
    /* Built-in values are authoritative; only the bench's own can be revised. */
    if (!known.remembered) return null;
    return { action: "update", name: known.name, molarMass: mass, previous: known.molarMass };
  }

  /* Most-recent-first, deduplicated by name, capped. Re-saving a compound
     moves it to the front and revises its mass rather than adding a copy. */
  function rememberCompound(history, entry, limit = COMPOUND_HISTORY_LIMIT) {
    const compound = normalizeCompound(entry);
    if (!compound) return sanitizeCompoundHistory(history, limit);
    const key = compoundSearchKey(compound.name);
    const rest = sanitizeCompoundHistory(history, Infinity).filter(
      (item) => compoundSearchKey(item.name) !== key,
    );
    return [compound, ...rest].slice(0, Math.max(0, limit));
  }

  function forgetCompound(history, name, limit = COMPOUND_HISTORY_LIMIT) {
    const key = compoundSearchKey(name);
    return sanitizeCompoundHistory(history, limit).filter(
      (item) => compoundSearchKey(item.name) !== key,
    );
  }

  /* Storage is user-editable and may be from an older version: rebuild the
     list from scratch and drop anything that no longer validates. */
  function sanitizeCompoundHistory(history, limit = COMPOUND_HISTORY_LIMIT) {
    if (!Array.isArray(history)) return [];
    const seen = new Set();
    const result = [];
    for (const item of history) {
      const compound = normalizeCompound(item);
      if (!compound) continue;
      const key = compoundSearchKey(compound.name);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(compound);
      if (result.length >= limit) break;
    }
    return result;
  }

  /* Presets win over history on the same label, so a remembered typo can
     never shadow a built-in value. */
  function mergeCompoundSources(presets, history, limit = COMPOUND_HISTORY_LIMIT) {
    const builtIn = sanitizeCompoundHistory(presets, Infinity).map((compound) => ({
      ...compound,
      remembered: false,
    }));
    const keys = new Set(builtIn.map((compound) => compoundSearchKey(compound.name)));
    const remembered = sanitizeCompoundHistory(history, limit)
      .filter((compound) => !keys.has(compoundSearchKey(compound.name)))
      .map((compound) => ({ ...compound, remembered: true }));
    return [...builtIn, ...remembered];
  }

  /* Exact match on the name, formula or any alias. Preserves the caller's
     `remembered` flag so the save prompt can tell the two sources apart. */
  function findCompound(list, query) {
    const key = compoundSearchKey(query);
    if (!key) return null;
    const source = Array.isArray(list) ? list : [];
    for (const item of source) {
      const compound = normalizeCompound(item);
      if (!compound) continue;
      if (compoundTerms(compound).some((entry) => entry.key === key)) {
        return { ...compound, remembered: item.remembered === true };
      }
    }
    return null;
  }

  globalThis.MolarityCalculator = Object.freeze({
    COMPOUND_HISTORY_LIMIT,
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
    COMPOUND_SUGGESTION_LIMIT,
    compoundKey,
    compoundSearchKey,
    compoundSaveIntent,
    searchCompounds,
    normalizeCompound,
    rememberCompound,
    forgetCompound,
    sanitizeCompoundHistory,
    mergeCompoundSources,
    findCompound,
  });
})();
