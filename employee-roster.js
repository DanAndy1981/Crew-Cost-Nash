(function exposeEmployeeRoster(globalScope) {
  "use strict";

  function normalizeName(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 100) : "";
  }

  function normalizeSourceClassification(value) {
    return typeof value === "string" ? value.trim().slice(0, 60) : "";
  }

  function sanitizeEmployeeRoster(candidate, fallback, isValidClassification) {
    const source = Array.isArray(candidate) ? candidate : fallback;
    const names = new Set();
    return (Array.isArray(source) ? source : []).flatMap((employee) => {
      if (!employee || typeof employee !== "object") return [];
      const name = normalizeName(employee.name);
      const nameKey = name.toLowerCase();
      if (!name || names.has(nameKey)) return [];
      names.add(nameKey);
      const defaultClassificationId = isValidClassification(employee.defaultClassificationId)
        ? employee.defaultClassificationId
        : null;
      return [{
        name,
        rosterClassification: normalizeSourceClassification(employee.rosterClassification),
        defaultClassificationId,
      }];
    });
  }

  function addEmployee(employees, name, defaultClassificationId, classificationLabel) {
    const normalizedName = normalizeName(name);
    if (!normalizedName) return { ok: false, reason: "Enter an employee name." };
    const duplicate = employees.some((employee) => employee.name.toLowerCase() === normalizedName.toLowerCase());
    if (duplicate) return { ok: false, reason: "That employee is already in the list." };
    return {
      ok: true,
      employees: [...employees, {
        name: normalizedName,
        rosterClassification: normalizeSourceClassification(classificationLabel),
        defaultClassificationId,
      }],
    };
  }

  function updateDefaultClassification(employees, name, classificationId) {
    return employees.map((employee) => employee.name === name
      ? { ...employee, defaultClassificationId: classificationId || null }
      : employee);
  }

  function removeEmployee(employees, name) {
    return employees.filter((employee) => employee.name !== name);
  }

  function indexEmployees(employees) {
    return new Map(employees.map((employee) => [employee.name, employee]));
  }

  const api = {
    addEmployee,
    indexEmployees,
    normalizeName,
    removeEmployee,
    sanitizeEmployeeRoster,
    updateDefaultClassification,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.CrewCostEmployeeRoster = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
