"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateCrew } = require("./calculator");
const {
  STANDARD_CLASSIFICATIONS,
  cloneDefaultSettings,
} = require("./data");

const specials = [
  {
    id: "CW1_AT_AP1",
    name: "CW1 at AP1",
    wageMode: "linked",
    customWage: null,
    wageSourceId: "AP1",
    benefitSourceId: "CW1",
  },
  {
    id: "CW1_AT_AP3",
    name: "CW1 at AP3",
    wageMode: "linked",
    customWage: null,
    wageSourceId: "AP3",
    benefitSourceId: "CW1",
  },
];

const crew = [
  { name: "Worker 1", classificationId: "CW1_AT_AP1", payTypeId: "straight" },
  { name: "Worker 2", classificationId: "CW1_AT_AP3", payTypeId: "straight" },
  { name: "Worker 3", classificationId: "GF", payTypeId: "straight" },
  { name: "Worker 4", classificationId: "AP1", payTypeId: "straight" },
  { name: "Worker 5", classificationId: "JW", payTypeId: "straight" },
];

function rounded(value) {
  return Number(value.toFixed(2));
}

test("crew total, burden subtotals, and per-worker average remain distinct", () => {
  const result = calculateCrew(
    crew,
    cloneDefaultSettings(),
    STANDARD_CLASSIFICATIONS,
    specials,
  );

  assert.equal(result.resolvedCount, 5);
  assert.equal(rounded(result.paidWages), 147.28);
  assert.equal(rounded(result.taxesTotal), 19.72);
  assert.equal(rounded(result.benefitsTotal), 44.38);
  assert.equal(rounded(result.crewCost), 211.38);
  assert.equal(rounded(result.averageCost), 42.28);

  assert.ok(
    Math.abs(result.crewCost - (result.paidWages + result.taxesTotal + result.benefitsTotal)) < 1e-9,
    "crew cost must equal wages plus taxes plus benefits",
  );
  assert.ok(
    Math.abs(result.averageCost - (result.crewCost / result.resolvedCount)) < 1e-9,
    "average cost must equal total crew cost divided by calculated workers",
  );
  assert.notEqual(
    rounded(result.averageCost),
    rounded(result.benefitsTotal),
    "average total cost is not the crew benefits subtotal",
  );
});
