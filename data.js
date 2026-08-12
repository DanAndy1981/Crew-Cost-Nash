(function initCrewCostData(root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  root.CrewCostData = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildCrewCostData() {
  "use strict";

  // `premiumPension` intentionally follows the supplied Labor Details premium formulas.
  // Those formulas include pension on AP6/AP5 premium wages but omit it for AP4/AP3,
  // even though all four receive the 10% pension at straight time. Keep this explicit
  // until the underlying agreement rule is confirmed and changed intentionally.
  const STANDARD_CLASSIFICATIONS = [
    { id: "JW", label: "JW", longLabel: "Journeyman", multiplier: 1, pensionPlan: "jw", healthPlan: "full", premiumPension: false },
    { id: "FOR", label: "FOR", longLabel: "Foreman", multiplier: 1.1, pensionPlan: "jw", healthPlan: "full", premiumPension: false },
    { id: "GF", label: "GF", longLabel: "General Foreman", multiplier: 1.15, pensionPlan: "jw", healthPlan: "full", premiumPension: false },
    { id: "AP6", label: "AP 6", longLabel: "Apprentice 6th Year", multiplier: 0.8, pensionPlan: "apprentice", healthPlan: "full", premiumPension: true },
    { id: "AP5", label: "AP 5", longLabel: "Apprentice 5th Year", multiplier: 0.75, pensionPlan: "apprentice", healthPlan: "full", premiumPension: true },
    { id: "AP4", label: "AP 4", longLabel: "Apprentice 4th Year", multiplier: 0.7, pensionPlan: "apprentice", healthPlan: "full", premiumPension: false },
    { id: "AP3", label: "AP 3", longLabel: "Apprentice 3rd Year", multiplier: 0.65, pensionPlan: "apprentice", healthPlan: "reduced", premiumPension: false },
    { id: "AP2", label: "AP 2", longLabel: "Apprentice 2nd Year", multiplier: 0.6, pensionPlan: "none", healthPlan: "reduced", premiumPension: false },
    { id: "AP1", label: "AP 1", longLabel: "Apprentice 1st Year", multiplier: 0.6, pensionPlan: "none", healthPlan: "reduced", premiumPension: false },
    { id: "CE3", label: "CE3", longLabel: "Construction Electrician 3", multiplier: 0.8, pensionPlan: "ce", healthPlan: "cecw", premiumPension: true },
    { id: "CE2", label: "CE2", longLabel: "Construction Electrician 2", multiplier: 0.75, pensionPlan: "ce", healthPlan: "cecw", premiumPension: true },
    { id: "CE1", label: "CE1", longLabel: "Construction Electrician 1", multiplier: 0.7, pensionPlan: "ce", healthPlan: "cecw", premiumPension: true },
    { id: "CW5", label: "CW5", longLabel: "Construction Wireman 5", multiplier: 0.65, pensionPlan: "none", healthPlan: "cecw", premiumPension: false },
    { id: "CW4", label: "CW4", longLabel: "Construction Wireman 4", multiplier: 0.6, pensionPlan: "none", healthPlan: "cecw", premiumPension: false },
    { id: "CW3", label: "CW3", longLabel: "Construction Wireman 3", multiplier: 0.55, pensionPlan: "none", healthPlan: "cecw", premiumPension: false },
    { id: "CW2", label: "CW2", longLabel: "Construction Wireman 2", multiplier: 0.5, pensionPlan: "none", healthPlan: "cecw", premiumPension: false },
    { id: "CW1", label: "CW1", longLabel: "Construction Wireman 1", multiplier: 0.45, pensionPlan: "none", healthPlan: "none", premiumPension: false },
  ];

  const PAY_TYPES = [
    { id: "straight", label: "Straight Time", shortLabel: "Straight" },
    { id: "overtime", label: "Time and One-Half", shortLabel: "Time 1/2" },
    { id: "double", label: "Double Time", shortLabel: "Double" },
    { id: "second", label: "2nd Shift", shortLabel: "2nd Shift" },
    { id: "third", label: "3rd Shift", shortLabel: "3rd Shift" },
  ];

  const DEFAULT_SETTINGS = {
    agreement: {
      name: "IBEW Local Union #429",
      effectivePeriod: "1/1/23 to 5/31/23",
    },
    journeymanBaseRate: 36.82,
    wageMultipliers: Object.fromEntries(STANDARD_CLASSIFICATIONS.map((item) => [item.id, item.multiplier])),
    taxes: {
      fica: 0.0765,
      federalUnemployment: 0.006,
      stateUnemployment: 0.023,
      workersComp: 0.0107,
      generalLiability: 0.01769,
    },
    benefits: {
      journeymanPensionHourly: 6,
      apprenticePensionRate: 0.1,
      cePensionRate: 0.05,
      jatcRate: 0.02,
      nebfRate: 0.03,
      neifRate: 0.01,
      nlmccHourly: 0.01,
      localLmccHourly: 0.07,
      healthFullHourly: 8.9,
      healthReducedHourly: 5.34,
      healthCeCwHourly: 4.11,
    },
    pricing: { overheadRate: 0, profitRate: 0 },
  };

  const EMPLOYEES = [
    ["Andrew Gooch", "JW"], ["Ashley Davis", "AP5"], ["David Merkle", "JW"], ["Erik Garcia", "GF"],
    ["James Ballard", "AP1"], ["John Garner", "AP3"], ["Lydia Mahoney", "AP1"], ["Thomas McNeese", "AP4"],
    ["Trystan Harbin", "FOR"], ["Van Fryman", "JW"], ["Dan Cook", "GF"], ["Colyn Massaro", "F"],
    ["Josh Skelton", "F"], ["Kade Hewitt", "CW1"], ["Jason Malone", "GF"], ["Luis Diaz", "JW"],
    ["Anna Reedy", "AP5"], ["Edward Plegel", "AP1"], ["John Calvario", "AP4"], ["Christopher Hughes", "JW"],
    ["Ethan Smith", "GF"], ["Jacob Petty", "AP3"], ["McKenzie Neely", "CW1"], ["Kristopher Certo", "GF"],
    ["David (Peyton) Swafford - 175", "AP4"], ["Jordon Estes", "CW1"], ["Evan Derr", "CW2"], ["Michael Tanner", "JW"],
    ["Josh Phelps - 175", "AP"], ["Aaron Bockoven", "JW"], ["Ethan Duke", "AP6"], ["James Schiavo", "JW"],
    ["Johnathan Moss", "JW"], ["Michael Judkins", "CW1"], ["Lloyd \"Greg\" Carson - 175", "JW"],
    ["Mike Presswood - 175", "JW"], ["Justin Journell", "JW"], ["Nick Runnfeldt", "CW1"], ["Ryan Shelby", "GF"],
  ].map(([name, rosterClassification]) => ({
    name,
    rosterClassification,
    defaultClassificationId: STANDARD_CLASSIFICATIONS.some((item) => item.id === rosterClassification)
      ? rosterClassification
      : null,
  }));

  const cloneDefaultSettings = () => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

  return {
    STANDARD_CLASSIFICATIONS,
    PAY_TYPES,
    DEFAULT_SETTINGS,
    EMPLOYEES,
    cloneDefaultSettings,
  };
});
