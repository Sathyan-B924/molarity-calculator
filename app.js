(() => {
  const {
    calculateFinalVolume,
    consistencyDifference,
    formatResult,
    positiveNumber,
    solveMissing,
    unitLabel,
  } = globalThis.MolarityCalculator;

  const STORAGE_KEY = "molarity-calculator:v3";
  const compounds = globalThis.MOLARITY_COMPOUNDS ?? [];
  let rowCounter = 0;

  const elements = {
    modeButtons: [...document.querySelectorAll("[data-mode]")],
    batchMode: document.querySelector("#batchMode"),
    individualMode: document.querySelector("#individualMode"),
    compoundName: document.querySelector("#compoundName"),
    compoundPresets: document.querySelector("#compoundPresets"),
    batchMolarMass: document.querySelector("#batchMolarMass"),
    batchMolarity: document.querySelector("#batchMolarity"),
    batchMolarityUnit: document.querySelector("#batchMolarityUnit"),
    batchMassUnit: document.querySelector("#batchMassUnit"),
    batchVolumeUnit: document.querySelector("#batchVolumeUnit"),
    batchDecimals: document.querySelector("#batchDecimals"),
    batchStatus: document.querySelector("#batchStatus"),
    weightColumnLabel: document.querySelector("#weightColumnLabel"),
    volumeColumnLabel: document.querySelector("#volumeColumnLabel"),
    sampleRows: document.querySelector("#sampleRows"),
    addSample: document.querySelector("#addSample"),
    pastedWeights: document.querySelector("#pastedWeights"),
    pasteStatus: document.querySelector("#pasteStatus"),
    usePastedWeights: document.querySelector("#usePastedWeights"),
    copyResults: document.querySelector("#copyResults"),
    clearBatch: document.querySelector("#clearBatch"),
    individualMass: document.querySelector("#individualMass"),
    individualMolarMass: document.querySelector("#individualMolarMass"),
    individualMolarity: document.querySelector("#individualMolarity"),
    individualVolume: document.querySelector("#individualVolume"),
    individualMassUnit: document.querySelector("#individualMassUnit"),
    individualMolarityUnit: document.querySelector("#individualMolarityUnit"),
    individualVolumeUnit: document.querySelector("#individualVolumeUnit"),
    individualDecimals: document.querySelector("#individualDecimals"),
    individualStatus: document.querySelector("#individualStatus"),
    clearIndividual: document.querySelector("#clearIndividual"),
    installButton: document.querySelector("#installButton"),
    offlineStatus: document.querySelector("#offlineStatus"),
  };

  const individualInputs = {
    mass: elements.individualMass,
    molarMass: elements.individualMolarMass,
    molarity: elements.individualMolarity,
    volume: elements.individualVolume,
  };

  const individualUnitInputs = {
    mass: elements.individualMassUnit,
    molarity: elements.individualMolarityUnit,
    volume: elements.individualVolumeUnit,
  };

  const individualNames = {
    mass: "Mass",
    molarMass: "Molar mass",
    molarity: "Molarity",
    volume: "Final volume",
  };

  function newRow(name = "", weight = "", autoName = true) {
    rowCounter += 1;
    return { id: `sample-${Date.now()}-${rowCounter}`, name, weight, autoName };
  }

  function defaultRows() {
    return Array.from({ length: 5 }, (_, index) => newRow(String(index + 1), ""));
  }

  const state = {
    mode: "batch",
    batch: {
      compound: "",
      molarMass: "",
      molarity: "",
      molarityUnit: "mM",
      massUnit: "mg",
      volumeUnit: "uL",
      decimals: 3,
      rows: defaultRows(),
    },
    individual: {
      values: { mass: "", molarMass: "", molarity: "", volume: "" },
      units: { mass: "mg", molarity: "mM", volume: "uL" },
      decimals: 3,
      calculatedField: null,
    },
    deferredInstallPrompt: null,
  };

  function readPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== "object") return;

      if (["batch", "individual"].includes(saved.mode)) state.mode = saved.mode;
      if (saved.batch && typeof saved.batch === "object") {
        state.batch = {
          ...state.batch,
          compound: String(saved.batch.compound ?? ""),
          molarMass: String(saved.batch.molarMass ?? ""),
          molarity: String(saved.batch.molarity ?? ""),
          molarityUnit: ["uM", "mM", "M"].includes(saved.batch.molarityUnit) ? saved.batch.molarityUnit : "mM",
          massUnit: ["ug", "mg", "g"].includes(saved.batch.massUnit) ? saved.batch.massUnit : "mg",
          volumeUnit: ["uL", "mL", "L"].includes(saved.batch.volumeUnit) ? saved.batch.volumeUnit : "uL",
          decimals: Math.max(0, Math.min(6, Number(saved.batch.decimals) || 0)),
          rows: Array.isArray(saved.batch.rows) && saved.batch.rows.length
            ? saved.batch.rows.slice(0, 500).map((row, index) => {
              const name = String(row.name ?? index + 1);
              const autoName = typeof row.autoName === "boolean" ? row.autoName : name === String(index + 1);
              return newRow(name, String(row.weight ?? ""), autoName);
            })
            : defaultRows(),
        };
      }

      if (saved.individual && typeof saved.individual === "object") {
        const savedValues = saved.individual.values ?? {};
        const savedUnits = saved.individual.units ?? {};
        state.individual = {
          values: {
            mass: String(savedValues.mass ?? ""),
            molarMass: String(savedValues.molarMass ?? ""),
            molarity: String(savedValues.molarity ?? ""),
            volume: String(savedValues.volume ?? ""),
          },
          units: {
            mass: ["ug", "mg", "g"].includes(savedUnits.mass) ? savedUnits.mass : "mg",
            molarity: ["uM", "mM", "M"].includes(savedUnits.molarity) ? savedUnits.molarity : "mM",
            volume: ["uL", "mL", "L"].includes(savedUnits.volume) ? savedUnits.volume : "uL",
          },
          decimals: Math.max(0, Math.min(6, Number(saved.individual.decimals) || 0)),
          calculatedField: ["mass", "molarMass", "molarity", "volume"].includes(saved.individual.calculatedField)
            ? saved.individual.calculatedField
            : null,
        };
      }
    } catch {
      // Storage is optional; the calculator remains functional without it.
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: state.mode, batch: state.batch, individual: state.individual }),
      );
    } catch {
      // Ignore unavailable storage, including restrictive direct-file environments.
    }
  }

  function populateCompoundPresets() {
    elements.compoundPresets.replaceChildren();
    for (const compound of compounds) {
      const option = document.createElement("option");
      option.value = compound.formula || compound.name;
      option.label = compound.name;
      elements.compoundPresets.append(option);
    }
  }

  function renumberAutomaticRows() {
    state.batch.rows.forEach((row, index) => {
      if (row.autoName) row.name = String(index + 1);
    });
  }

  function populateFields() {
    elements.compoundName.value = state.batch.compound;
    elements.batchMolarMass.value = state.batch.molarMass;
    elements.batchMolarity.value = state.batch.molarity;
    elements.batchMolarityUnit.value = state.batch.molarityUnit;
    elements.batchMassUnit.value = state.batch.massUnit;
    elements.batchVolumeUnit.value = state.batch.volumeUnit;
    elements.batchDecimals.value = String(state.batch.decimals);

    for (const [field, input] of Object.entries(individualInputs)) input.value = state.individual.values[field];
    for (const [field, select] of Object.entries(individualUnitInputs)) select.value = state.individual.units[field];
    elements.individualDecimals.value = String(state.individual.decimals);
  }

  function readBatchFields() {
    state.batch.compound = elements.compoundName.value;
    state.batch.molarMass = elements.batchMolarMass.value;
    state.batch.molarity = elements.batchMolarity.value;
    state.batch.molarityUnit = elements.batchMolarityUnit.value;
    state.batch.massUnit = elements.batchMassUnit.value;
    state.batch.volumeUnit = elements.batchVolumeUnit.value;
    state.batch.decimals = Number(elements.batchDecimals.value);
  }

  function createSampleRow(row, index) {
    const wrapper = document.createElement("div");
    wrapper.className = "sample-row";
    wrapper.dataset.rowId = row.id;

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = row.name;
    nameInput.placeholder = String(index + 1);
    nameInput.setAttribute("aria-label", `Sample ${index + 1} name`);
    nameInput.addEventListener("input", () => {
      row.name = nameInput.value;
      row.autoName = false;
      savePreferences();
    });

    const weightInput = document.createElement("input");
    weightInput.type = "number";
    weightInput.inputMode = "decimal";
    weightInput.min = "0";
    weightInput.step = "any";
    weightInput.value = row.weight;
    weightInput.placeholder = "0";
    weightInput.setAttribute("aria-label", `Sample ${index + 1} weight in ${unitLabel(state.batch.massUnit)}`);
    weightInput.addEventListener("input", () => {
      row.weight = weightInput.value;
      updateBatchResults();
      savePreferences();
    });

    const result = document.createElement("output");
    result.className = "row-result";
    result.setAttribute("aria-label", `Sample ${index + 1} final volume`);
    const value = document.createElement("strong");
    value.textContent = "—";
    const unit = document.createElement("span");
    unit.textContent = unitLabel(state.batch.volumeUnit);
    result.append(value, unit);

    const remove = document.createElement("button");
    remove.className = "remove-sample";
    remove.type = "button";
    remove.textContent = "×";
    remove.disabled = state.batch.rows.length === 1;
    remove.setAttribute("aria-label", `Remove sample ${index + 1}`);
    remove.addEventListener("click", () => {
      state.batch.rows = state.batch.rows.filter((candidate) => candidate.id !== row.id);
      renumberAutomaticRows();
      renderSampleRows();
      updateBatchResults();
      savePreferences();
    });

    wrapper.append(nameInput, weightInput, result, remove);
    return wrapper;
  }

  function renderSampleRows() {
    elements.sampleRows.replaceChildren();
    state.batch.rows.forEach((row, index) => elements.sampleRows.append(createSampleRow(row, index)));
  }

  function getBatchResults() {
    return state.batch.rows.map((row) => ({
      ...row,
      result: calculateFinalVolume({
        mass: row.weight,
        massUnit: state.batch.massUnit,
        molarMass: state.batch.molarMass,
        molarity: state.batch.molarity,
        molarityUnit: state.batch.molarityUnit,
        volumeUnit: state.batch.volumeUnit,
      }),
    }));
  }

  function updateBatchResults() {
    elements.weightColumnLabel.textContent = `Weight (${unitLabel(state.batch.massUnit)})`;
    elements.volumeColumnLabel.textContent = `Final volume (${unitLabel(state.batch.volumeUnit)})`;

    const sharedValid = positiveNumber(state.batch.molarMass) !== null && positiveNumber(state.batch.molarity) !== null;
    const results = getBatchResults();
    const rowElements = [...elements.sampleRows.querySelectorAll(".sample-row")];
    let calculatedCount = 0;

    results.forEach((row, index) => {
      const resultElement = rowElements[index]?.querySelector(".row-result");
      if (!resultElement) return;
      const valueElement = resultElement.querySelector("strong");
      const unitElement = resultElement.querySelector("span");
      unitElement.textContent = unitLabel(state.batch.volumeUnit);

      if (row.result !== null) {
        valueElement.textContent = formatResult(row.result, state.batch.decimals);
        calculatedCount += 1;
      } else {
        valueElement.textContent = "—";
      }
    });

    if (!sharedValid) {
      elements.batchStatus.textContent = "Enter molar mass and molarity";
    } else if (calculatedCount === 0) {
      elements.batchStatus.textContent = "Enter sample weights";
    } else {
      elements.batchStatus.textContent = `${calculatedCount} sample${calculatedCount === 1 ? "" : "s"} calculated`;
    }
    elements.copyResults.disabled = calculatedCount === 0;
  }

  function renderMode() {
    elements.batchMode.hidden = state.mode !== "batch";
    elements.individualMode.hidden = state.mode !== "individual";
    for (const button of elements.modeButtons) {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  function setIndividualStatus(text, kind = "") {
    elements.individualStatus.textContent = text;
    elements.individualStatus.hidden = !text;
    elements.individualStatus.classList.toggle("is-success", kind === "success");
    elements.individualStatus.classList.toggle("is-error", kind === "error");
  }

  function renderCalculatedField() {
    for (const wrapper of document.querySelectorAll(".solver-field")) {
      wrapper.classList.toggle("is-calculated", wrapper.dataset.field === state.individual.calculatedField);
    }
  }

  function solveIndividual() {
    const valuesForSolver = { ...state.individual.values };
    if (state.individual.calculatedField) valuesForSolver[state.individual.calculatedField] = "";

    const missingFields = Object.keys(valuesForSolver).filter((field) => positiveNumber(valuesForSolver[field]) === null);
    if (missingFields.length > 1) {
      state.individual.calculatedField = null;
      renderCalculatedField();
      setIndividualStatus("");
      savePreferences();
      return;
    }

    if (missingFields.length === 1) {
      const solution = solveMissing(valuesForSolver, state.individual.units);
      if (!solution) {
        state.individual.calculatedField = null;
        renderCalculatedField();
        setIndividualStatus("Check values", "error");
        savePreferences();
        return;
      }

      const formatted = formatResult(solution.value, state.individual.decimals);
      state.individual.values[solution.field] = formatted;
      state.individual.calculatedField = solution.field;
      individualInputs[solution.field].value = formatted;
      renderCalculatedField();
      setIndividualStatus("");
      savePreferences();
      return;
    }

    state.individual.calculatedField = null;
    renderCalculatedField();
    const difference = consistencyDifference(state.individual.values, state.individual.units);
    if (difference === null) {
      setIndividualStatus("Check values", "error");
    } else if (difference <= 0.1) {
      setIndividualStatus("Values agree", "success");
    } else {
      setIndividualStatus(`Mismatch ${formatResult(difference, 1)}%`, "error");
    }
    savePreferences();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    }
  }

  function buildResultsText() {
    const rows = getBatchResults().filter((row) => row.result !== null);
    const massLabel = unitLabel(state.batch.massUnit);
    const volumeLabel = unitLabel(state.batch.volumeUnit);
    const lines = [];
    if (state.batch.compound.trim()) lines.push(`Compound\t${state.batch.compound.trim()}`);
    lines.push(`Molar mass\t${state.batch.molarMass} g/mol`);
    lines.push(`Target molarity\t${state.batch.molarity} ${unitLabel(state.batch.molarityUnit)}`);
    lines.push("");
    lines.push(`Sample\tWeight (${massLabel})\tFinal volume (${volumeLabel})`);
    for (const row of rows) {
      lines.push(`${row.name || "—"}\t${row.weight}\t${formatResult(row.result, state.batch.decimals)}`);
    }
    return lines.join("\n");
  }

  for (const button of elements.modeButtons) {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      renderMode();
      savePreferences();
    });
  }

  for (const input of [
    elements.compoundName,
    elements.batchMolarMass,
    elements.batchMolarity,
    elements.batchMolarityUnit,
    elements.batchMassUnit,
    elements.batchVolumeUnit,
    elements.batchDecimals,
  ]) {
    const handler = () => {
      readBatchFields();
      if (input === elements.compoundName) {
        const query = elements.compoundName.value.trim().toLowerCase();
        const match = compounds.find((compound) =>
          [compound.name, compound.formula].filter(Boolean).some((value) => value.toLowerCase() === query),
        );
        if (match) {
          elements.batchMolarMass.value = String(match.molarMass);
          state.batch.molarMass = String(match.molarMass);
        }
      }
      if (input === elements.batchMassUnit) renderSampleRows();
      updateBatchResults();
      savePreferences();
    };
    input.addEventListener("input", handler);
    input.addEventListener("change", handler);
  }

  elements.addSample.addEventListener("click", () => {
    state.batch.rows.push(newRow(String(state.batch.rows.length + 1), "", true));
    renumberAutomaticRows();
    renderSampleRows();
    updateBatchResults();
    savePreferences();
  });

  elements.usePastedWeights.addEventListener("click", () => {
    const raw = elements.pastedWeights.value.trim();
    elements.pasteStatus.textContent = "";
    if (!raw) {
      elements.pasteStatus.textContent = "Paste at least one weight";
      return;
    }

    const tokens = raw.split(/[\s,;]+/).filter(Boolean);
    if (!tokens.length || tokens.some((token) => positiveNumber(token) === null)) {
      elements.pasteStatus.textContent = "Use positive numbers only";
      return;
    }

    state.batch.rows = tokens.slice(0, 500).map((weight, index) => newRow(String(index + 1), weight, true));
    elements.pastedWeights.value = "";
    renderSampleRows();
    updateBatchResults();
    savePreferences();
  });

  elements.copyResults.addEventListener("click", async () => {
    const copied = await copyText(buildResultsText());
    const original = elements.copyResults.textContent;
    elements.copyResults.textContent = copied ? "Copied" : "Copy failed";
    window.setTimeout(() => { elements.copyResults.textContent = original; }, 1400);
  });

  elements.clearBatch.addEventListener("click", () => {
    if (!window.confirm("Clear compound, values, and sample weights?")) return;
    state.batch.compound = "";
    state.batch.molarMass = "";
    state.batch.molarity = "";
    state.batch.rows = defaultRows();
    populateFields();
    renderSampleRows();
    updateBatchResults();
    savePreferences();
  });

  for (const [field, input] of Object.entries(individualInputs)) {
    input.addEventListener("input", () => {
      if (state.individual.calculatedField && state.individual.calculatedField !== field) {
        if (input.value !== "") {
          const previousCalculated = state.individual.calculatedField;
          state.individual.values[previousCalculated] = "";
          individualInputs[previousCalculated].value = "";
        }
        state.individual.calculatedField = null;
      } else if (state.individual.calculatedField === field) {
        state.individual.calculatedField = null;
      }
      state.individual.values[field] = input.value;
      solveIndividual();
    });
  }

  for (const [field, select] of Object.entries(individualUnitInputs)) {
    select.addEventListener("change", () => {
      if (state.individual.calculatedField) {
        state.individual.values[state.individual.calculatedField] = "";
        individualInputs[state.individual.calculatedField].value = "";
        state.individual.calculatedField = null;
      }
      state.individual.units[field] = select.value;
      solveIndividual();
    });
  }

  elements.individualDecimals.addEventListener("change", () => {
    if (state.individual.calculatedField) {
      state.individual.values[state.individual.calculatedField] = "";
      individualInputs[state.individual.calculatedField].value = "";
      state.individual.calculatedField = null;
    }
    state.individual.decimals = Number(elements.individualDecimals.value);
    solveIndividual();
  });

  elements.clearIndividual.addEventListener("click", () => {
    state.individual.values = { mass: "", molarMass: "", molarity: "", volume: "" };
    state.individual.calculatedField = null;
    for (const input of Object.values(individualInputs)) input.value = "";
    renderCalculatedField();
    setIndividualStatus("");
    savePreferences();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    elements.installButton.hidden = false;
  });

  elements.installButton.addEventListener("click", async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    elements.installButton.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    elements.installButton.hidden = true;
  });

  function updateConnectionStatus() {
    if (location.protocol === "file:") {
      elements.offlineStatus.textContent = "Local mode";
      return;
    }
    elements.offlineStatus.textContent = navigator.onLine ? "Offline ready" : "Offline mode";
  }

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        elements.offlineStatus.textContent = "Online only";
      });
    });
  } else if (location.protocol !== "file:") {
    elements.offlineStatus.textContent = "Online only";
  }

  readPreferences();
  populateCompoundPresets();
  populateFields();
  renderSampleRows();
  updateBatchResults();
  renderMode();
  renderCalculatedField();
  if (state.individual.calculatedField) solveIndividual();
  updateConnectionStatus();
})();
