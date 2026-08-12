(function startCrewCostApp() {
  "use strict";

  const {
    STANDARD_CLASSIFICATIONS,
    PAY_TYPES,
    EMPLOYEES,
    cloneDefaultSettings,
  } = globalThis.CrewCostData;
  const { calculateWorker, calculateCrew } = globalThis.CrewCostCalculator;
  const {
    addEmployee,
    indexEmployees,
    removeEmployee,
    sanitizeEmployeeRoster,
    updateDefaultClassification,
  } = globalThis.CrewCostEmployeeRoster;

  const STORAGE_KEY = "adman.employeeCrewCostCalculator.v1";
  const TAX_LABELS = {
    fica: "FICA",
    federalUnemployment: "Federal unemployment",
    stateUnemployment: "State unemployment",
    workersComp: "Workers’ compensation",
    generalLiability: "General liability",
  };
  const BENEFIT_LABELS = {
    pension: "Pension",
    jatc: "JATC",
    nebf: "NEBF",
    neif: "NEIF / NECA",
    nlmcc: "NLMCC",
    localLmcc: "Local LMCC",
    healthWelfare: "Health & welfare",
  };
  const standardById = new Map(STANDARD_CLASSIFICATIONS.map((item) => [item.id, item]));
  const payTypeById = new Map(PAY_TYPES.map((item) => [item.id, item]));

  const elements = {
    agreementSummary: document.querySelector("#agreement-summary"),
    employeeSearch: document.querySelector("#employee-search"),
    employeeList: document.querySelector("#employee-list"),
    employeeCountPill: document.querySelector("#employee-count-pill"),
    selectVisibleButton: document.querySelector("#select-visible-button"),
    clearSelectionButton: document.querySelector("#clear-selection-button"),
    defaultPayType: document.querySelector("#default-pay-type"),
    addSelectedButton: document.querySelector("#add-selected-button"),
    crewEmptyState: document.querySelector("#crew-empty-state"),
    crewTableWrap: document.querySelector("#crew-table-wrap"),
    crewTableBody: document.querySelector("#crew-table-body"),
    clearCrewButton: document.querySelector("#clear-crew-button"),
    newSpecialButton: document.querySelector("#new-special-button"),
    crewCostTotal: document.querySelector("#crew-cost-total"),
    crewCostSupport: document.querySelector("#crew-cost-support"),
    paidWagesTotal: document.querySelector("#paid-wages-total"),
    taxesTotal: document.querySelector("#taxes-total"),
    taxesSupport: document.querySelector("#taxes-support"),
    benefitsTotal: document.querySelector("#benefits-total"),
    benefitsSupport: document.querySelector("#benefits-support"),
    taxBreakdown: document.querySelector("#tax-breakdown"),
    benefitBreakdown: document.querySelector("#benefit-breakdown"),
    burdenRatePill: document.querySelector("#burden-rate-pill"),
    overheadRate: document.querySelector("#overhead-rate"),
    profitRate: document.querySelector("#profit-rate"),
    sellRateTotal: document.querySelector("#sell-rate-total"),
    sellRateDetail: document.querySelector("#sell-rate-detail"),
    printButton: document.querySelector("#print-button"),
    openSettingsButton: document.querySelector("#open-settings-button"),
    settingsDialog: document.querySelector("#settings-dialog"),
    settingsContent: document.querySelector("#settings-form-content"),
    resetSettingsButton: document.querySelector("#reset-settings-button"),
    exportSettingsButton: document.querySelector("#export-settings-button"),
    importSettingsButton: document.querySelector("#import-settings-button"),
    settingsFileInput: document.querySelector("#settings-file-input"),
    specialDialog: document.querySelector("#special-dialog"),
    specialForm: document.querySelector("#special-form"),
    specialDialogTitle: document.querySelector("#special-dialog-title"),
    specialId: document.querySelector("#special-id"),
    specialName: document.querySelector("#special-name"),
    specialWageSource: document.querySelector("#special-wage-source"),
    specialCustomWageField: document.querySelector("#special-custom-wage-field"),
    specialCustomWage: document.querySelector("#special-custom-wage"),
    specialBenefitSource: document.querySelector("#special-benefit-source"),
    closeSpecialButton: document.querySelector("#close-special-button"),
    cancelSpecialButton: document.querySelector("#cancel-special-button"),
    workerDetailDialog: document.querySelector("#worker-detail-dialog"),
    workerDetailTitle: document.querySelector("#worker-detail-title"),
    workerDetailSubtitle: document.querySelector("#worker-detail-subtitle"),
    workerDetailContent: document.querySelector("#worker-detail-content"),
    toast: document.querySelector("#toast"),
  };

  const selectedNames = new Set();
  let searchQuery = "";
  let toastTimer = null;
  let state = loadState();
  let employeeByName = indexEmployees(state.employees);

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value || 0);
  }

  function percentage(value) {
    return `${((value || 0) * 100).toFixed(1)}%`;
  }

  function sanitizeSettings(candidate, template = cloneDefaultSettings()) {
    if (typeof candidate !== "object" || !candidate) return template;
    const visit = (source, fallback) => {
      if (typeof fallback === "number") {
        const parsed = Number(source);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
      }
      if (typeof fallback === "string") return typeof source === "string" ? source.slice(0, 120) : fallback;
      if (fallback && typeof fallback === "object") {
        return Object.fromEntries(Object.entries(fallback).map(([key, value]) => [key, visit(source?.[key], value)]));
      }
      return fallback;
    };
    const settings = visit(candidate, template);
    settings.wageMultipliers.JW = 1;
    return settings;
  }

  function sanitizeSpecials(candidate) {
    if (!Array.isArray(candidate)) return [];
    const ids = new Set();
    return candidate.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const id = typeof item.id === "string" ? item.id.slice(0, 100) : "";
      const name = typeof item.name === "string" ? item.name.trim().slice(0, 60) : "";
      const wageMode = item.wageMode === "custom" ? "custom" : "linked";
      const customWage = Number(item.customWage);
      const wageSourceId = standardById.has(item.wageSourceId) ? item.wageSourceId : "JW";
      const benefitSourceId = standardById.has(item.benefitSourceId) ? item.benefitSourceId : "JW";
      if (!id || standardById.has(id) || ids.has(id) || !name || (wageMode === "custom" && (!Number.isFinite(customWage) || customWage < 0))) return [];
      ids.add(id);
      return [{ id, name, wageMode, customWage: wageMode === "custom" ? customWage : null, wageSourceId, benefitSourceId }];
    });
  }

  function validClassificationId(classificationId, specials) {
    return standardById.has(classificationId) || specials.some((item) => item.id === classificationId);
  }

  function normalizeSavedState(saved) {
    const settings = sanitizeSettings(saved?.settings);
    const specialClassifications = sanitizeSpecials(saved?.specialClassifications);
    let employees = sanitizeEmployeeRoster(
      saved?.employees,
      EMPLOYEES,
      (classificationId) => validClassificationId(classificationId, specialClassifications),
    );
    const legacyAssignments = {};
    if (saved?.employeeAssignments && typeof saved.employeeAssignments === "object") {
      Object.entries(saved.employeeAssignments).forEach(([name, classificationId]) => {
        if (validClassificationId(classificationId, specialClassifications)) {
          legacyAssignments[name] = classificationId;
        }
      });
    }
    employees = employees.map((employee) => legacyAssignments[employee.name]
      ? { ...employee, defaultClassificationId: legacyAssignments[employee.name] }
      : employee);
    const normalizedEmployeeByName = indexEmployees(employees);
    const seen = new Set();
    const crew = Array.isArray(saved?.crew) ? saved.crew.flatMap((entry) => {
      if (!entry || !normalizedEmployeeByName.has(entry.name) || seen.has(entry.name) || !payTypeById.has(entry.payTypeId)) return [];
      seen.add(entry.name);
      const classificationId = validClassificationId(entry.classificationId, specialClassifications)
        ? entry.classificationId
        : normalizedEmployeeByName.get(entry.name).defaultClassificationId || "";
      return [{ name: entry.name, classificationId, payTypeId: entry.payTypeId }];
    }) : [];
    return { settings, specialClassifications, employees, crew };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return normalizeSavedState(saved);
    } catch {
      return normalizeSavedState(null);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, ...state }));
    } catch {
      showToast("Changes are active, but this browser could not save them for next time.");
    }
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 3600);
  }

  function classificationOptions(selectedId, includePlaceholder = true) {
    const standardOptions = STANDARD_CLASSIFICATIONS.map((item) =>
      `<option value="${item.id}"${selectedId === item.id ? " selected" : ""}>${escapeHtml(item.label)} — ${escapeHtml(item.longLabel)}</option>`,
    ).join("");
    const specialOptions = state.specialClassifications.map((item) =>
      `<option value="${escapeHtml(item.id)}"${selectedId === item.id ? " selected" : ""}>${escapeHtml(item.name)}</option>`,
    ).join("");
    return [
      includePlaceholder ? `<option value=""${!selectedId ? " selected" : ""}>Select a cost classification</option>` : "",
      `<optgroup label="Contract classifications">${standardOptions}</optgroup>`,
      specialOptions ? `<optgroup label="Special classifications">${specialOptions}</optgroup>` : "",
    ].join("");
  }

  function payTypeOptions(selectedId) {
    return PAY_TYPES.map((item) =>
      `<option value="${item.id}"${selectedId === item.id ? " selected" : ""}>${escapeHtml(item.label)}</option>`,
    ).join("");
  }

  function classificationLabel(classificationId) {
    return standardById.get(classificationId)?.label
      || state.specialClassifications.find((item) => item.id === classificationId)?.name
      || "Unassigned";
  }

  function rebuildEmployeeIndex() {
    employeeByName = indexEmployees(state.employees);
  }

  function filteredEmployees() {
    if (!searchQuery) return state.employees;
    return state.employees.filter((employee) =>
      `${employee.name} ${employee.rosterClassification} ${classificationLabel(employee.defaultClassificationId)}`.toLowerCase().includes(searchQuery),
    );
  }

  function renderEmployeeList() {
    const employees = filteredEmployees();
    elements.employeeList.innerHTML = employees.length ? employees.map((employee) => {
      const unresolved = !employee.defaultClassificationId;
      const defaultLabel = classificationLabel(employee.defaultClassificationId);
      return `
        <label class="employee-option">
          <input type="checkbox" data-employee-name="${escapeHtml(employee.name)}"${selectedNames.has(employee.name) ? " checked" : ""} />
          <span class="employee-name" title="${escapeHtml(employee.name)}">${escapeHtml(employee.name)}</span>
          <span class="classification-chip${unresolved ? " classification-chip-warning" : ""}" title="${unresolved ? "Classification needs confirmation" : `Default: ${defaultLabel}`}">${escapeHtml(unresolved ? (employee.rosterClassification || "Unassigned") : defaultLabel)}</span>
        </label>`;
    }).join("") : `<p class="list-empty">No employees match this search.</p>`;
    const selectedCount = selectedNames.size;
    elements.employeeCountPill.textContent = `${selectedCount} selected`;
    elements.addSelectedButton.disabled = selectedCount === 0;
  }

  function renderBreakdownList(element, breakdown, labels, total, workerCount) {
    const workerLabel = workerCount
      ? ` (${workerCount} worker${workerCount === 1 ? "" : "s"})`
      : "";
    element.innerHTML = [
      ...Object.entries(labels).map(([key, label]) => `<div><dt>${escapeHtml(label)}</dt><dd>${money(breakdown[key])}</dd></div>`),
      `<div class="breakdown-total"><dt>Crew total${workerLabel}</dt><dd>${money(total)}</dd></div>`,
    ].join("");
  }

  function workerResult(entry) {
    return calculateWorker(
      entry.classificationId,
      entry.payTypeId,
      state.settings,
      STANDARD_CLASSIFICATIONS,
      state.specialClassifications,
    );
  }

  function renderCrewTable() {
    elements.crewEmptyState.hidden = state.crew.length > 0;
    elements.crewTableWrap.hidden = state.crew.length === 0;
    elements.clearCrewButton.hidden = state.crew.length === 0;
    elements.crewTableBody.innerHTML = state.crew.map((entry, index) => {
      const employee = employeeByName.get(entry.name);
      const result = workerResult(entry);
      return `
        <tr${result ? "" : ' class="row-warning"'}>
          <td class="employee-cell"><strong>${escapeHtml(entry.name)}</strong><small>Default: ${escapeHtml(classificationLabel(employee.defaultClassificationId))}</small></td>
          <td><select data-crew-classification="${index}" aria-label="Cost classification for ${escapeHtml(entry.name)}">${classificationOptions(entry.classificationId)}</select></td>
          <td><select data-crew-pay-type="${index}" aria-label="Pay type for ${escapeHtml(entry.name)}">${payTypeOptions(entry.payTypeId)}</select></td>
          ${result ? `
            <td class="numeric">${money(result.paidWage)}</td>
            <td class="numeric">${money(result.taxesTotal)}</td>
            <td class="numeric">${money(result.benefitsTotal)}</td>
            <td class="numeric cost-total">${money(result.totalCost)}</td>` : `
            <td class="numeric unresolved-text" colspan="4">Choose a cost classification</td>`}
          <td><div class="table-actions">
            <button class="table-icon-button" data-worker-detail="${index}" type="button" title="View cost detail" aria-label="View cost detail for ${escapeHtml(entry.name)}"${result ? "" : " disabled"}>i</button>
            <button class="table-icon-button remove" data-remove-worker="${index}" type="button" title="Remove from crew" aria-label="Remove ${escapeHtml(entry.name)} from crew">×</button>
          </div></td>
        </tr>`;
    }).join("");
  }

  function renderSummary() {
    const result = calculateCrew(
      state.crew,
      state.settings,
      STANDARD_CLASSIFICATIONS,
      state.specialClassifications,
    );
    const perWorkerTaxes = result.resolvedCount ? result.taxesTotal / result.resolvedCount : 0;
    const perWorkerBenefits = result.resolvedCount ? result.benefitsTotal / result.resolvedCount : 0;
    const unresolvedCount = result.employeeCount - result.resolvedCount;
    elements.crewCostTotal.textContent = money(result.crewCost);
    elements.crewCostSupport.textContent = result.employeeCount
      ? `${result.resolvedCount} worker${result.resolvedCount === 1 ? "" : "s"} calculated • ${money(result.averageCost)} average total cost per calculated worker${unresolvedCount ? ` • ${unresolvedCount} needs a rate` : ""}`
      : "Select employees to build a crew";
    elements.paidWagesTotal.textContent = money(result.paidWages);
    elements.taxesTotal.textContent = money(result.taxesTotal);
    elements.taxesSupport.textContent = `Crew total • ${money(perWorkerTaxes)} average per calculated worker`;
    elements.benefitsTotal.textContent = money(result.benefitsTotal);
    elements.benefitsSupport.textContent = `Crew total • ${money(perWorkerBenefits)} average per calculated worker`;
    elements.burdenRatePill.textContent = `${percentage(result.burdenRate)} burden on paid wages`;
    renderBreakdownList(elements.taxBreakdown, result.taxes, TAX_LABELS, result.taxesTotal, result.resolvedCount);
    renderBreakdownList(elements.benefitBreakdown, result.benefits, BENEFIT_LABELS, result.benefitsTotal, result.resolvedCount);
    elements.sellRateTotal.textContent = `${money(result.sellRate)}/hr`;
    elements.sellRateDetail.textContent = `Includes ${money(result.overhead)} overhead and ${money(result.profit)} profit`;
  }

  function renderHeaderAndPricing() {
    elements.agreementSummary.textContent = `${state.settings.agreement.name} • rates effective ${state.settings.agreement.effectivePeriod}`;
    elements.overheadRate.value = (state.settings.pricing.overheadRate * 100).toFixed(1);
    elements.profitRate.value = (state.settings.pricing.profitRate * 100).toFixed(1);
  }

  function renderMain() {
    renderHeaderAndPricing();
    renderEmployeeList();
    renderCrewTable();
    renderSummary();
  }

  function settingsNumberInput(path, value, kind = "currency", options = {}) {
    const scaledValue = kind === "percent" ? value * 100 : value;
    const displayValue = Number(scaledValue.toFixed(4));
    const step = options.step || (kind === "percent" ? "0.001" : "0.01");
    return `<input type="number" min="0" step="${step}" value="${displayValue}" data-setting-path="${path}" data-setting-kind="${kind}" />`;
  }

  function renderSpecialSettingsList() {
    if (!state.specialClassifications.length) return `<p class="no-specials">No special classifications have been created.</p>`;
    return `<div class="special-settings-list">${state.specialClassifications.map((item) => {
      const wageLabel = item.wageMode === "custom" ? money(item.customWage) : standardById.get(item.wageSourceId)?.label;
      const benefitLabel = standardById.get(item.benefitSourceId)?.label;
      return `<div class="special-settings-item"><div><strong>${escapeHtml(item.name)}</strong><small>Wage: ${escapeHtml(wageLabel)} • Benefits: ${escapeHtml(benefitLabel)}</small></div><div class="special-settings-actions"><button class="text-button" data-edit-special="${escapeHtml(item.id)}" type="button">Edit</button><button class="text-button text-button-danger" data-delete-special="${escapeHtml(item.id)}" type="button">Delete</button></div></div>`;
    }).join("")}</div>`;
  }

  function renderEmployeeSettingsList() {
    if (!state.employees.length) return `<p class="no-specials">No employees are in the list. Add the first employee above.</p>`;
    return `<div class="employee-settings-list">${state.employees.map((employee) => `
      <div class="employee-settings-item">
        <strong title="${escapeHtml(employee.name)}">${escapeHtml(employee.name)}</strong>
        <label>
          <span class="visually-hidden">Default classification for ${escapeHtml(employee.name)}</span>
          <select data-employee-default="${escapeHtml(employee.name)}" aria-label="Default classification for ${escapeHtml(employee.name)}">
            ${classificationOptions(employee.defaultClassificationId)}
          </select>
        </label>
        <button class="text-button text-button-danger" data-remove-employee="${escapeHtml(employee.name)}" type="button">Remove</button>
      </div>`).join("")}</div>`;
  }

  function renderSettings() {
    const { settings } = state;
    elements.settingsContent.innerHTML = `
      <section class="settings-section">
        <div class="settings-section-heading"><div><h3>Agreement</h3><p>Source identification shown on the calculator.</p></div></div>
        <div class="settings-fields">
          <label class="settings-field">Agreement name<input type="text" maxlength="120" value="${escapeHtml(settings.agreement.name)}" data-setting-path="agreement.name" data-setting-kind="text" /></label>
          <label class="settings-field">Effective period<input type="text" maxlength="120" value="${escapeHtml(settings.agreement.effectivePeriod)}" data-setting-path="agreement.effectivePeriod" data-setting-kind="text" /></label>
          <label class="settings-field">Journeyman base rate${settingsNumberInput("journeymanBaseRate", settings.journeymanBaseRate)}</label>
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section-heading"><div><h3>Classification wage scale</h3><p>Percent of the Journeyman base rate.</p></div></div>
        <div class="table-scroll"><table class="settings-table"><thead><tr><th>Classification</th><th>Percent of JW</th><th class="numeric">Current base rate</th></tr></thead><tbody>
          ${STANDARD_CLASSIFICATIONS.map((item) => `<tr><td><strong>${escapeHtml(item.label)}</strong> — ${escapeHtml(item.longLabel)}</td><td>${item.id === "JW" ? "100.0%" : settingsNumberInput(`wageMultipliers.${item.id}`, settings.wageMultipliers[item.id], "percent", { step: "0.1" })}</td><td class="derived-rate" data-derived-class="${item.id}">${money(settings.journeymanBaseRate * settings.wageMultipliers[item.id])}</td></tr>`).join("")}
        </tbody></table></div>
      </section>

      <section class="settings-section">
        <div class="settings-section-heading"><div><h3>Taxes &amp; insurance</h3><p>Applied to hourly wages according to the Labor Details formulas.</p></div></div>
        <div class="settings-fields">
          ${Object.entries(TAX_LABELS).map(([key, label]) => `<label class="settings-field">${escapeHtml(label)}${settingsNumberInput(`taxes.${key}`, settings.taxes[key], "percent")}</label>`).join("")}
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section-heading"><div><h3>Benefits &amp; other burden</h3><p>Dollar values are hourly; percentage values follow the source workbook.</p></div></div>
        <div class="settings-fields">
          <label class="settings-field">Pension — JW / FOR / GF${settingsNumberInput("benefits.journeymanPensionHourly", settings.benefits.journeymanPensionHourly)}</label>
          <label class="settings-field">Pension — AP 3 through AP 6${settingsNumberInput("benefits.apprenticePensionRate", settings.benefits.apprenticePensionRate, "percent")}</label>
          <label class="settings-field">Pension — CE 1 through CE 3${settingsNumberInput("benefits.cePensionRate", settings.benefits.cePensionRate, "percent")}</label>
          <label class="settings-field">JATC${settingsNumberInput("benefits.jatcRate", settings.benefits.jatcRate, "percent")}</label>
          <label class="settings-field">NEBF${settingsNumberInput("benefits.nebfRate", settings.benefits.nebfRate, "percent")}</label>
          <label class="settings-field">NEIF / NECA${settingsNumberInput("benefits.neifRate", settings.benefits.neifRate, "percent")}</label>
          <label class="settings-field">NLMCC hourly${settingsNumberInput("benefits.nlmccHourly", settings.benefits.nlmccHourly, "currency", { step: "0.01" })}</label>
          <label class="settings-field">Local LMCC hourly${settingsNumberInput("benefits.localLmccHourly", settings.benefits.localLmccHourly, "currency", { step: "0.01" })}</label>
          <label class="settings-field">H&amp;W — full${settingsNumberInput("benefits.healthFullHourly", settings.benefits.healthFullHourly)}</label>
          <label class="settings-field">H&amp;W — reduced${settingsNumberInput("benefits.healthReducedHourly", settings.benefits.healthReducedHourly)}</label>
          <label class="settings-field">H&amp;W — CE / CW${settingsNumberInput("benefits.healthCeCwHourly", settings.benefits.healthCeCwHourly)}</label>
        </div>
        <p class="settings-help">The workbook assigns full H&amp;W to JW, FOR, GF, AP6–AP4; reduced H&amp;W to AP3–AP1; CE/CW H&amp;W to CE3–CW2; and no H&amp;W to CW1.</p>
      </section>

      <section class="settings-section">
        <div class="settings-section-heading"><div><h3>Special classifications</h3><p>Reusable combinations of a wage source and benefit package.</p></div><button class="button button-secondary" data-new-special type="button">New classification</button></div>
        ${renderSpecialSettingsList()}
      </section>

      <section class="settings-section">
        <div class="settings-section-heading"><div><h3>Employees</h3><p>Add or remove names and choose the classification used when each employee is added to a crew.</p></div></div>
        <div class="employee-add-form" data-add-employee-controls>
          <label class="settings-field">Employee name<input name="employeeName" type="text" maxlength="100" autocomplete="off" placeholder="Enter employee name" /></label>
          <label class="settings-field">Default classification<select name="defaultClassificationId">${classificationOptions("")}</select></label>
          <button class="button button-primary" data-add-employee type="button">Add employee</button>
        </div>
        ${renderEmployeeSettingsList()}
      </section>`;
  }

  function setByPath(target, path, value) {
    const parts = path.split(".");
    const last = parts.pop();
    let current = target;
    parts.forEach((part) => { current = current[part]; });
    current[last] = value;
  }

  function updateDerivedRates() {
    elements.settingsContent.querySelectorAll("[data-derived-class]").forEach((cell) => {
      const classificationId = cell.dataset.derivedClass;
      cell.textContent = money(state.settings.journeymanBaseRate * state.settings.wageMultipliers[classificationId]);
    });
  }

  function standardSelectOptions(selectedId) {
    return STANDARD_CLASSIFICATIONS.map((item) => `<option value="${item.id}"${selectedId === item.id ? " selected" : ""}>${escapeHtml(item.label)} — ${escapeHtml(item.longLabel)}</option>`).join("");
  }

  function openSpecialDialog(specialId = "") {
    const special = state.specialClassifications.find((item) => item.id === specialId);
    const linkedWageSelection = special
      ? (special.wageMode === "linked" ? special.wageSourceId : "")
      : "AP1";
    elements.specialDialogTitle.textContent = special ? "Edit classification" : "Create a classification";
    elements.specialId.value = special?.id || "";
    elements.specialName.value = special?.name || "";
    elements.specialWageSource.innerHTML = `<option value="custom"${special?.wageMode === "custom" ? " selected" : ""}>Custom hourly wage</option>${standardSelectOptions(linkedWageSelection)}`;
    elements.specialBenefitSource.innerHTML = standardSelectOptions(special?.benefitSourceId || "CW1");
    elements.specialCustomWage.value = special?.wageMode === "custom" ? special.customWage : "";
    toggleCustomWageField();
    elements.specialDialog.showModal();
    setTimeout(() => elements.specialName.focus(), 0);
  }

  function toggleCustomWageField() {
    const custom = elements.specialWageSource.value === "custom";
    elements.specialCustomWageField.hidden = !custom;
    elements.specialCustomWage.required = custom;
  }

  function closeSpecialDialog() {
    elements.specialDialog.close();
  }

  function saveSpecialClassification(event) {
    event.preventDefault();
    const existingId = elements.specialId.value;
    const name = elements.specialName.value.trim();
    const wageSourceValue = elements.specialWageSource.value;
    const wageMode = wageSourceValue === "custom" ? "custom" : "linked";
    const customWage = Number(elements.specialCustomWage.value);
    const duplicateName = state.specialClassifications.some((item) => item.id !== existingId && item.name.toLowerCase() === name.toLowerCase());
    if (!name || duplicateName || (wageMode === "custom" && (!Number.isFinite(customWage) || customWage < 0))) {
      showToast(duplicateName ? "Use a unique classification name." : "Complete the classification fields with a valid wage.");
      return;
    }
    const special = {
      id: existingId || `special-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      wageMode,
      customWage: wageMode === "custom" ? customWage : null,
      wageSourceId: wageMode === "linked" ? wageSourceValue : "JW",
      benefitSourceId: elements.specialBenefitSource.value,
    };
    const existingIndex = state.specialClassifications.findIndex((item) => item.id === special.id);
    if (existingIndex >= 0) state.specialClassifications.splice(existingIndex, 1, special);
    else state.specialClassifications.push(special);
    saveState();
    closeSpecialDialog();
    renderMain();
    if (elements.settingsDialog.open) renderSettings();
    showToast(`${special.name} saved.`);
  }

  function deleteSpecialClassification(specialId) {
    const special = state.specialClassifications.find((item) => item.id === specialId);
    if (!special || !window.confirm(`Delete “${special.name}”? Crew rows using it will need a new classification.`)) return;
    state.specialClassifications = state.specialClassifications.filter((item) => item.id !== specialId);
    state.crew.forEach((entry) => { if (entry.classificationId === specialId) entry.classificationId = ""; });
    state.employees = state.employees.map((employee) => employee.defaultClassificationId === specialId
      ? { ...employee, defaultClassificationId: null }
      : employee);
    rebuildEmployeeIndex();
    saveState();
    renderMain();
    renderSettings();
    showToast(`${special.name} deleted.`);
  }

  function saveEmployeeDefault(name, classificationId) {
    if (!employeeByName.has(name) || (classificationId && !validClassificationId(classificationId, state.specialClassifications))) return;
    state.employees = updateDefaultClassification(state.employees, name, classificationId);
    state.crew.forEach((entry) => {
      if (entry.name === name) entry.classificationId = classificationId;
    });
    rebuildEmployeeIndex();
    saveState();
    renderMain();
    showToast(`${name}'s default classification was updated.`);
  }

  function addEmployeeFromSettings(controls) {
    const nameInput = controls.querySelector('[name="employeeName"]');
    const classificationSelect = controls.querySelector('[name="defaultClassificationId"]');
    const name = nameInput.value;
    const classificationId = classificationSelect.value;
    if (!name.trim()) {
      showToast("Enter an employee name.");
      nameInput.focus();
      return;
    }
    if (!validClassificationId(classificationId, state.specialClassifications)) {
      showToast("Choose a default classification.");
      classificationSelect.focus();
      return;
    }
    const result = addEmployee(
      state.employees,
      name,
      classificationId,
      classificationLabel(classificationId),
    );
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    state.employees = result.employees;
    rebuildEmployeeIndex();
    saveState();
    renderSettings();
    renderMain();
    showToast("Employee added.");
  }

  function deleteEmployee(name) {
    if (!employeeByName.has(name) || !window.confirm(`Remove “${name}” from the employee list? This also removes them from the current crew.`)) return;
    state.employees = removeEmployee(state.employees, name);
    state.crew = state.crew.filter((entry) => entry.name !== name);
    selectedNames.delete(name);
    rebuildEmployeeIndex();
    saveState();
    renderSettings();
    renderMain();
    showToast(`${name} removed.`);
  }

  function openWorkerDetail(index) {
    const entry = state.crew[index];
    const result = entry && workerResult(entry);
    if (!entry || !result) return;
    const payType = payTypeById.get(entry.payTypeId);
    elements.workerDetailTitle.textContent = entry.name;
    elements.workerDetailSubtitle.textContent = `${result.profile.label} • ${payType.label}`;
    elements.workerDetailContent.innerHTML = `
      <div class="worker-detail-summary">
        <div class="worker-detail-stat"><span>Paid wage</span><strong>${money(result.paidWage)}</strong></div>
        <div class="worker-detail-stat"><span>Total burden</span><strong>${money(result.burdenTotal)}</strong></div>
        <div class="worker-detail-stat"><span>Total cost / hr</span><strong>${money(result.totalCost)}</strong></div>
      </div>
      <p class="worker-source-note">Wage source: ${escapeHtml(result.profile.wageSourceLabel)} at ${money(result.profile.wage)}/hr • Benefit package: ${escapeHtml(result.profile.benefitSourceLabel)} • Burden: ${percentage(result.burdenRate)} of paid wages</p>
      <div class="breakdown-grid"><div><h4>Taxes &amp; insurance</h4><dl class="breakdown-list" data-detail-tax></dl></div><div><h4>Benefits &amp; other burden</h4><dl class="breakdown-list" data-detail-benefit></dl></div></div>`;
    renderBreakdownList(elements.workerDetailContent.querySelector("[data-detail-tax]"), result.taxes, TAX_LABELS, result.taxesTotal);
    renderBreakdownList(elements.workerDetailContent.querySelector("[data-detail-benefit]"), result.benefits, BENEFIT_LABELS, result.benefitsTotal);
    elements.workerDetailDialog.showModal();
  }

  function addSelectedEmployees() {
    const existingNames = new Set(state.crew.map((entry) => entry.name));
    let added = 0;
    selectedNames.forEach((name) => {
      if (existingNames.has(name)) return;
      const employee = employeeByName.get(name);
      state.crew.push({
        name,
        classificationId: employee.defaultClassificationId || "",
        payTypeId: elements.defaultPayType.value,
      });
      added += 1;
    });
    selectedNames.clear();
    saveState();
    renderMain();
    showToast(added ? `${added} employee${added === 1 ? "" : "s"} added to the crew.` : "Those employees are already in the crew.");
  }

  function exportSettings() {
    const payload = JSON.stringify({
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      specialClassifications: state.specialClassifications,
      employees: state.employees,
    }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "crew-cost-settings.json";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Settings exported.");
  }

  async function importSettings(file) {
    try {
      const parsed = JSON.parse(await file.text());
      const imported = normalizeSavedState({
        ...parsed,
        employees: Array.isArray(parsed.employees) ? parsed.employees : state.employees,
        crew: state.crew,
      });
      state.settings = imported.settings;
      state.specialClassifications = imported.specialClassifications;
      state.employees = imported.employees;
      state.crew = imported.crew;
      selectedNames.clear();
      rebuildEmployeeIndex();
      saveState();
      renderSettings();
      renderMain();
      showToast("Settings imported.");
    } catch {
      showToast("That file is not a valid crew-cost settings export.");
    } finally {
      elements.settingsFileInput.value = "";
    }
  }

  function bindEvents() {
    elements.defaultPayType.innerHTML = payTypeOptions("straight");
    elements.employeeSearch.addEventListener("input", () => {
      searchQuery = elements.employeeSearch.value.trim().toLowerCase();
      renderEmployeeList();
    });
    elements.employeeList.addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-employee-name]");
      if (!checkbox) return;
      if (checkbox.checked) selectedNames.add(checkbox.dataset.employeeName);
      else selectedNames.delete(checkbox.dataset.employeeName);
      renderEmployeeList();
    });
    elements.selectVisibleButton.addEventListener("click", () => {
      filteredEmployees().forEach((employee) => selectedNames.add(employee.name));
      renderEmployeeList();
    });
    elements.clearSelectionButton.addEventListener("click", () => { selectedNames.clear(); renderEmployeeList(); });
    elements.addSelectedButton.addEventListener("click", addSelectedEmployees);
    elements.clearCrewButton.addEventListener("click", () => { state.crew = []; saveState(); renderMain(); showToast("Crew cleared."); });
    elements.newSpecialButton.addEventListener("click", () => openSpecialDialog());
    elements.crewTableBody.addEventListener("change", (event) => {
      const classificationSelect = event.target.closest("[data-crew-classification]");
      const payTypeSelect = event.target.closest("[data-crew-pay-type]");
      if (classificationSelect) {
        const entry = state.crew[Number(classificationSelect.dataset.crewClassification)];
        entry.classificationId = classificationSelect.value;
        state.employees = updateDefaultClassification(state.employees, entry.name, classificationSelect.value);
        rebuildEmployeeIndex();
      }
      if (payTypeSelect) state.crew[Number(payTypeSelect.dataset.crewPayType)].payTypeId = payTypeSelect.value;
      saveState();
      renderMain();
    });
    elements.crewTableBody.addEventListener("click", (event) => {
      const detailButton = event.target.closest("[data-worker-detail]");
      const removeButton = event.target.closest("[data-remove-worker]");
      if (detailButton) openWorkerDetail(Number(detailButton.dataset.workerDetail));
      if (removeButton) {
        state.crew.splice(Number(removeButton.dataset.removeWorker), 1);
        saveState();
        renderMain();
      }
    });
    elements.overheadRate.addEventListener("input", () => {
      const value = Number(elements.overheadRate.value);
      if (Number.isFinite(value) && value >= 0) { state.settings.pricing.overheadRate = value / 100; saveState(); renderSummary(); }
    });
    elements.profitRate.addEventListener("input", () => {
      const value = Number(elements.profitRate.value);
      if (Number.isFinite(value) && value >= 0) { state.settings.pricing.profitRate = value / 100; saveState(); renderSummary(); }
    });
    elements.printButton.addEventListener("click", () => window.print());
    elements.openSettingsButton.addEventListener("click", () => { renderSettings(); elements.settingsDialog.showModal(); });
    elements.settingsContent.addEventListener("input", (event) => {
      const input = event.target.closest("[data-setting-path]");
      if (!input) return;
      const kind = input.dataset.settingKind;
      const value = kind === "text" ? input.value : Number(input.value) / (kind === "percent" ? 100 : 1);
      if (kind !== "text" && (!Number.isFinite(value) || value < 0)) return;
      setByPath(state.settings, input.dataset.settingPath, value);
      saveState();
      updateDerivedRates();
      renderHeaderAndPricing();
      renderCrewTable();
      renderSummary();
    });
    elements.settingsContent.addEventListener("change", (event) => {
      const defaultSelect = event.target.closest("[data-employee-default]");
      if (defaultSelect) saveEmployeeDefault(defaultSelect.dataset.employeeDefault, defaultSelect.value);
    });
    elements.settingsContent.addEventListener("keydown", (event) => {
      const controls = event.target.closest("[data-add-employee-controls]");
      if (!controls || event.key !== "Enter") return;
      event.preventDefault();
      addEmployeeFromSettings(controls);
    });
    elements.settingsContent.addEventListener("click", (event) => {
      const newButton = event.target.closest("[data-new-special]");
      const editButton = event.target.closest("[data-edit-special]");
      const deleteButton = event.target.closest("[data-delete-special]");
      const removeEmployeeButton = event.target.closest("[data-remove-employee]");
      const addEmployeeButton = event.target.closest("[data-add-employee]");
      if (newButton) openSpecialDialog();
      if (editButton) openSpecialDialog(editButton.dataset.editSpecial);
      if (deleteButton) deleteSpecialClassification(deleteButton.dataset.deleteSpecial);
      if (removeEmployeeButton) deleteEmployee(removeEmployeeButton.dataset.removeEmployee);
      if (addEmployeeButton) addEmployeeFromSettings(addEmployeeButton.closest("[data-add-employee-controls]"));
    });
    elements.resetSettingsButton.addEventListener("click", () => {
      if (!window.confirm("Reset all contract rates, benefits, overhead, and profit to the supplied workbook defaults?")) return;
      state.settings = cloneDefaultSettings();
      saveState();
      renderSettings();
      renderMain();
      showToast("Workbook defaults restored.");
    });
    elements.exportSettingsButton.addEventListener("click", exportSettings);
    elements.importSettingsButton.addEventListener("click", () => elements.settingsFileInput.click());
    elements.settingsFileInput.addEventListener("change", () => {
      const [file] = elements.settingsFileInput.files;
      if (file) importSettings(file);
    });
    elements.specialWageSource.addEventListener("change", toggleCustomWageField);
    elements.specialForm.addEventListener("submit", saveSpecialClassification);
    elements.closeSpecialButton.addEventListener("click", closeSpecialDialog);
    elements.cancelSpecialButton.addEventListener("click", closeSpecialDialog);
  }

  bindEvents();
  renderMain();
})();
