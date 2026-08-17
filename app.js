(() => {
  const {
    calculateFinalVolume,
    compoundSaveIntent,
    compoundSearchKey,
    consistencyDifference,
    findCompound,
    forgetCompound,
    formatResult,
    mergeCompoundSources,
    positiveNumber,
    rememberCompound,
    sanitizeCompoundHistory,
    searchCompounds,
    solveMissing,
    unitLabel,
  } = globalThis.MolarityCalculator;

  const STORAGE_KEY = "molarity-calculator:v3";
  const compounds = globalThis.MOLARITY_COMPOUNDS ?? [];

  /* Built-in presets plus whatever this bench has used before. */
  function compoundLibrary() {
    return mergeCompoundSources(compounds, state.compoundHistory);
  }
  let rowCounter = 0;

  const elements = {
    modeButtons: [...document.querySelectorAll("[data-mode]")],
    batchMode: document.querySelector("#batchMode"),
    individualMode: document.querySelector("#individualMode"),
    compoundName: document.querySelector("#compoundName"),
    compoundSuggestions: document.querySelector("#compoundSuggestions"),
    compoundSave: document.querySelector("#compoundSave"),
    compoundSaved: document.querySelector("#compoundSaved"),
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
    compoundHistory: [],
    deferredInstallPrompt: null,
  };

  function readPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== "object") return;

      if (["batch", "individual"].includes(saved.mode)) state.mode = saved.mode;
      state.compoundHistory = sanitizeCompoundHistory(saved.compoundHistory);
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
        JSON.stringify({
          mode: state.mode,
          batch: state.batch,
          individual: state.individual,
          compoundHistory: state.compoundHistory,
        }),
      );
    } catch {
      // Ignore unavailable storage, including restrictive direct-file environments.
    }
  }

  /* ---- Compound field --------------------------------------------------
     A type-ahead over every name, formula and alias in the library, plus
     an explicit save prompt. Both modes get one: the molar mass is the
     same lookup whether you are weighing a batch or solving one sample.

     Built as a factory rather than a singleton because the two modes keep
     independent state and their own inputs.                              */

  function createCompoundField({ nameInput, listEl, saveEl, savedEl, massInput, onApply }) {
    let suggestions = [];
    let active = -1;
    let dismissed = null;
    const optionId = (index) => `${listEl.id}-option-${index}`;

    function close() {
      suggestions = [];
      active = -1;
      listEl.replaceChildren();
      listEl.hidden = true;
      nameInput.setAttribute("aria-expanded", "false");
      nameInput.removeAttribute("aria-activedescendant");
    }

    function renderSuggestions() {
      suggestions = searchCompounds(compoundLibrary(), nameInput.value);
      active = -1;
      listEl.replaceChildren();
      if (!suggestions.length) {
        close();
        return;
      }

      suggestions.forEach((compound, index) => {
        const option = document.createElement("li");
        option.className = "compound-option";
        option.id = optionId(index);
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");

        const name = document.createElement("span");
        name.className = "compound-option-name";
        name.textContent = compound.name;

        const detail = document.createElement("span");
        detail.className = "compound-option-detail";
        /* Show the alias when that, rather than the name, is what matched. */
        const matched = compound.matchedTerm;
        const viaAlias = matched && compoundSearchKey(matched) !== compoundSearchKey(compound.name);
        detail.textContent = [compound.formula, viaAlias ? matched : null].filter(Boolean).join(" · ");

        const mass = document.createElement("span");
        mass.className = "compound-option-mass";
        mass.textContent = `${compound.molarMass} g/mol`;

        if (compound.remembered) {
          const badge = document.createElement("span");
          badge.className = "compound-option-badge";
          badge.textContent = "saved";
          name.append(" ", badge);
        }

        option.append(name, detail, mass);
        /* mousedown, not click: blur would close the list first. */
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
          apply(compound);
        });
        listEl.append(option);
      });

      listEl.hidden = false;
      nameInput.setAttribute("aria-expanded", "true");
    }

    function highlight(index) {
      const options = [...listEl.children];
      if (!options.length) return;
      active = (index + options.length) % options.length;
      options.forEach((option, position) => {
        const isActive = position === active;
        option.classList.toggle("is-active", isActive);
        option.setAttribute("aria-selected", isActive ? "true" : "false");
        if (isActive) option.scrollIntoView({ block: "nearest" });
      });
      nameInput.setAttribute("aria-activedescendant", optionId(active));
    }

    function apply(compound) {
      nameInput.value = compound.name;
      close();
      dismissed = null;
      onApply(compound);
      renderSave();
    }

    function saveKey(intent) {
      return `${intent.action}:${compoundSearchKey(intent.name)}:${intent.molarMass}`;
    }

    /* Nothing is stored until this is answered, so a typo never becomes a
       permanent entry. */
    function renderSave() {
      const intent = compoundSaveIntent(compoundLibrary(), nameInput.value, massInput.value);
      saveEl.replaceChildren();

      if (!intent || dismissed === saveKey(intent)) {
        saveEl.hidden = true;
        return;
      }

      const message = document.createElement("span");
      message.className = "compound-save-text";
      message.textContent =
        intent.action === "save"
          ? `Remember ${intent.name} at ${intent.molarMass} g/mol?`
          : `Update ${intent.name} from ${intent.previous} to ${intent.molarMass} g/mol?`;

      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "compound-save-confirm";
      confirm.textContent = intent.action === "save" ? "Remember" : "Update";
      confirm.addEventListener("click", () => {
        state.compoundHistory = rememberCompound(state.compoundHistory, {
          name: intent.name,
          molarMass: intent.molarMass,
        });
        dismissed = null;
        savePreferences();
        refreshCompoundFields();
      });

      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.className = "compound-save-dismiss";
      dismiss.textContent = "Not now";
      dismiss.addEventListener("click", () => {
        dismissed = saveKey(intent);
        renderSave();
      });

      saveEl.append(message, confirm, dismiss);
      saveEl.hidden = false;
    }

    /* Shown only once something has been saved, so the default screen
       stays as quiet as it was. */
    function renderSaved() {
      savedEl.replaceChildren();
      if (!state.compoundHistory.length) {
        savedEl.hidden = true;
        return;
      }

      const label = document.createElement("span");
      label.className = "compound-saved-label";
      label.textContent = "Saved";
      savedEl.append(label);

      for (const compound of state.compoundHistory) {
        const item = document.createElement("span");
        item.className = "compound-saved-item";

        const pick = document.createElement("button");
        pick.type = "button";
        pick.className = "compound-saved-pick";
        pick.textContent = compound.name;
        pick.title = `${compound.name} — ${compound.molarMass} g/mol`;
        pick.addEventListener("click", () => apply(compound));

        const forget = document.createElement("button");
        forget.type = "button";
        forget.className = "compound-saved-forget";
        forget.textContent = "×";
        forget.setAttribute("aria-label", `Forget ${compound.name}`);
        forget.addEventListener("click", () => {
          state.compoundHistory = forgetCompound(state.compoundHistory, compound.name);
          savePreferences();
          refreshCompoundFields();
        });

        item.append(pick, forget);
        savedEl.append(item);
      }
      savedEl.hidden = false;
    }

    nameInput.addEventListener("input", () => {
      dismissed = null;
      renderSuggestions();
      renderSave();
    });

    nameInput.addEventListener("focus", () => {
      if (nameInput.value.trim()) renderSuggestions();
    });

    nameInput.addEventListener("blur", close);

    massInput.addEventListener("input", () => {
      dismissed = null;
      renderSave();
    });

    nameInput.addEventListener("keydown", (event) => {
      const open = !listEl.hidden && suggestions.length > 0;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!open) renderSuggestions();
        highlight(active + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (open) highlight(active - 1);
      } else if (event.key === "Enter" && open && active >= 0) {
        event.preventDefault();
        apply(suggestions[active]);
      } else if (event.key === "Escape" && open) {
        event.preventDefault();
        close();
      }
    });

    close();
    return { renderSave, renderSaved, close };
  }

  const compoundFields = [
    createCompoundField({
      nameInput: elements.compoundName,
      listEl: elements.compoundSuggestions,
      saveEl: elements.compoundSave,
      savedEl: elements.compoundSaved,
      massInput: elements.batchMolarMass,
      onApply(compound) {
        elements.batchMolarMass.value = String(compound.molarMass);
        state.batch.compound = compound.name;
        state.batch.molarMass = String(compound.molarMass);
        updateBatchResults();
        savePreferences();
      },
    }),
  ];

  function refreshCompoundFields() {
    for (const field of compoundFields) {
      field.renderSave();
      field.renderSaved();
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
        /* An exact hit still autofills, so typing a full name and tabbing
           away works without touching the suggestion list. */
        const match = findCompound(compoundLibrary(), elements.compoundName.value);
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
  populateFields();
  refreshCompoundFields();
  renderSampleRows();
  updateBatchResults();
  renderMode();
  renderCalculatedField();
  if (state.individual.calculatedField) solveIndividual();
  updateConnectionStatus();
})();
