/*
 * Built-in compound presets.
 *
 * Molar masses are computed from IUPAC standard atomic weights
 * (H 1.008, B 10.81, C 12.011, N 14.007, O 15.999, Na 22.990)
 * and rounded to two decimals, the precision these inputs work at.
 *
 * Shape: { name, formula, molarMass, aliases }
 *
 * `name` is what the suggestion list shows and what lands in the field —
 * it is the recognisable half. `formula` and `molarMass` are shown as
 * secondary detail. `aliases` exist so that search catches how the
 * compound is actually written at the bench: trivial names, p-/para-
 * prefixes, and lab shorthand.
 *
 * Search normalises away case and punctuation, so "NH3-BH3", "nh3 bh3"
 * and "NH3BH3" are one term and need not be listed separately.
 */
globalThis.MOLARITY_COMPOUNDS = Object.freeze([
  {
    // 22.990 + 10.81 + 4(1.008) = 37.832
    name: "Sodium borohydride",
    formula: "NaBH4",
    molarMass: 37.83,
    aliases: ["borohydride", "sodium tetrahydridoborate", "SBH"],
  },
  {
    // 14.007 + 3(1.008) + 10.81 + 3(1.008) = 30.865
    name: "Ammonia borane",
    formula: "NH3-BH3",
    molarMass: 30.87,
    aliases: ["ammonia-borane", "borane ammonia complex", "borazane", "H3NBH3"],
  },
  {
    // 6(12.011) + 5(1.008) + 14.007 + 3(15.999) = 139.110
    name: "4-Nitrophenol",
    formula: "C6H5NO3",
    molarMass: 139.11,
    aliases: ["p-nitrophenol", "para-nitrophenol", "nitrophenol", "PNP", "4NP"],
  },
  {
    // 6(12.011) + 7(1.008) + 14.007 + 15.999 = 109.128
    name: "4-Aminophenol",
    formula: "C6H7NO",
    molarMass: 109.13,
    aliases: ["p-aminophenol", "para-aminophenol", "aminophenol", "PAP", "4AP"],
  },
  {
    // 3(1.008) + 10.81 + 3(15.999) = 61.831
    name: "Boric acid",
    formula: "H3BO3",
    molarMass: 61.83,
    aliases: ["boracic acid", "orthoboric acid", "hydrogen borate"],
  },
  {
    // 4(12.011) + 11(1.008) + 14.007 + 3(15.999) = 121.136
    name: "Tris",
    formula: "C4H11NO3",
    molarMass: 121.14,
    aliases: [
      "tromethamine",
      "trometamol",
      "tris base",
      "tris(hydroxymethyl)aminomethane",
      "THAM",
    ],
  },
]);
