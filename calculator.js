(function initCrewCostCalculator(root, factory) {
  const calculator = factory();
  if (typeof module === "object" && module.exports) module.exports = calculator;
  root.CrewCostCalculator = calculator;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildCrewCostCalculator() {
  "use strict";

  const TAX_KEYS = ["fica", "federalUnemployment", "stateUnemployment", "workersComp", "generalLiability"];
  const OVERTIME_TAX_KEYS = ["fica", "federalUnemployment", "stateUnemployment"];
  const PREMIUM_BENEFIT_KEYS = ["jatc", "nebf", "neif"];

  function sumValues(record) {
    return Object.values(record).reduce((sum, value) => sum + value, 0);
  }

  function findStandard(classificationId, standardClassifications) {
    return standardClassifications.find((item) => item.id === classificationId) || null;
  }

  function resolveCostProfile(classificationId, settings, standardClassifications, specialClassifications) {
    const standard = findStandard(classificationId, standardClassifications);
    if (standard) {
      return {
        id: standard.id,
        label: standard.label,
        wage: settings.journeymanBaseRate * settings.wageMultipliers[standard.id],
        wageSourceLabel: standard.label,
        benefitClass: standard,
        benefitSourceLabel: standard.label,
        isSpecial: false,
      };
    }

    const special = specialClassifications.find((item) => item.id === classificationId);
    if (!special) return null;
    const wageSource = special.wageMode === "custom"
      ? null
      : findStandard(special.wageSourceId, standardClassifications);
    const benefitClass = findStandard(special.benefitSourceId, standardClassifications);
    if (!benefitClass || (special.wageMode !== "custom" && !wageSource)) return null;

    return {
      id: special.id,
      label: special.name,
      wage: special.wageMode === "custom"
        ? Number(special.customWage)
        : settings.journeymanBaseRate * settings.wageMultipliers[wageSource.id],
      wageSourceLabel: special.wageMode === "custom" ? "Custom wage" : wageSource.label,
      benefitClass,
      benefitSourceLabel: benefitClass.label,
      isSpecial: true,
    };
  }

  function pensionAmount(wage, benefitClass, benefits) {
    if (benefitClass.pensionPlan === "jw") return benefits.journeymanPensionHourly;
    if (benefitClass.pensionPlan === "apprentice") return wage * benefits.apprenticePensionRate;
    if (benefitClass.pensionPlan === "ce") return wage * benefits.cePensionRate;
    return 0;
  }

  function healthAmount(benefitClass, benefits) {
    if (benefitClass.healthPlan === "full") return benefits.healthFullHourly;
    if (benefitClass.healthPlan === "reduced") return benefits.healthReducedHourly;
    if (benefitClass.healthPlan === "cecw") return benefits.healthCeCwHourly;
    return 0;
  }

  function straightBreakdown(wage, benefitClass, settings) {
    const taxes = Object.fromEntries(TAX_KEYS.map((key) => [key, wage * settings.taxes[key]]));
    const benefits = {
      pension: pensionAmount(wage, benefitClass, settings.benefits),
      jatc: wage * settings.benefits.jatcRate,
      nebf: wage * settings.benefits.nebfRate,
      neif: wage * settings.benefits.neifRate,
      nlmcc: settings.benefits.nlmccHourly,
      localLmcc: settings.benefits.localLmccHourly,
      healthWelfare: healthAmount(benefitClass, settings.benefits),
    };
    return { taxes, benefits };
  }

  function payTypeWage(wage, payTypeId) {
    if (payTypeId === "overtime") return wage * 1.5;
    if (payTypeId === "double") return wage * 2;
    if (payTypeId === "second") return ((wage * 1.1) * 8) / 7.5;
    if (payTypeId === "third") return ((wage * 1.15) * 8) / 7;
    return wage;
  }

  function addPremiumBurden(breakdown, premiumWage, benefitClass, settings, payTypeId) {
    if (premiumWage <= 0) return;
    const taxKeys = payTypeId === "overtime" || payTypeId === "double" ? OVERTIME_TAX_KEYS : TAX_KEYS;
    taxKeys.forEach((key) => { breakdown.taxes[key] += premiumWage * settings.taxes[key]; });
    breakdown.benefits.jatc += premiumWage * settings.benefits.jatcRate;
    breakdown.benefits.nebf += premiumWage * settings.benefits.nebfRate;
    breakdown.benefits.neif += premiumWage * settings.benefits.neifRate;

    if (benefitClass.premiumPension) {
      if (benefitClass.pensionPlan === "apprentice") {
        breakdown.benefits.pension += premiumWage * settings.benefits.apprenticePensionRate;
      } else if (benefitClass.pensionPlan === "ce") {
        breakdown.benefits.pension += premiumWage * settings.benefits.cePensionRate;
      }
    }
  }

  function calculateWorker(classificationId, payTypeId, settings, standardClassifications, specialClassifications = []) {
    const profile = resolveCostProfile(
      classificationId,
      settings,
      standardClassifications,
      specialClassifications,
    );
    if (!profile || !Number.isFinite(profile.wage) || profile.wage < 0) return null;

    const paidWage = payTypeWage(profile.wage, payTypeId);
    const breakdown = straightBreakdown(profile.wage, profile.benefitClass, settings);
    addPremiumBurden(breakdown, paidWage - profile.wage, profile.benefitClass, settings, payTypeId);

    const taxesTotal = sumValues(breakdown.taxes);
    const benefitsTotal = sumValues(breakdown.benefits);
    const burdenTotal = taxesTotal + benefitsTotal;
    return {
      profile,
      payTypeId,
      paidWage,
      taxes: breakdown.taxes,
      benefits: breakdown.benefits,
      taxesTotal,
      benefitsTotal,
      burdenTotal,
      totalCost: paidWage + burdenTotal,
      burdenRate: paidWage === 0 ? 0 : burdenTotal / paidWage,
    };
  }

  function emptyBreakdown() {
    return {
      taxes: Object.fromEntries(TAX_KEYS.map((key) => [key, 0])),
      benefits: {
        pension: 0, jatc: 0, nebf: 0, neif: 0, nlmcc: 0, localLmcc: 0, healthWelfare: 0,
      },
    };
  }

  function calculateCrew(crew, settings, standardClassifications, specialClassifications = []) {
    const breakdown = emptyBreakdown();
    const workers = crew.map((entry) => ({
      entry,
      result: calculateWorker(
        entry.classificationId,
        entry.payTypeId,
        settings,
        standardClassifications,
        specialClassifications,
      ),
    }));

    let paidWages = 0;
    let taxesTotal = 0;
    let benefitsTotal = 0;
    let resolvedCount = 0;
    workers.forEach(({ result }) => {
      if (!result) return;
      resolvedCount += 1;
      paidWages += result.paidWage;
      taxesTotal += result.taxesTotal;
      benefitsTotal += result.benefitsTotal;
      Object.keys(breakdown.taxes).forEach((key) => { breakdown.taxes[key] += result.taxes[key]; });
      Object.keys(breakdown.benefits).forEach((key) => { breakdown.benefits[key] += result.benefits[key]; });
    });

    const burdenTotal = taxesTotal + benefitsTotal;
    const crewCost = paidWages + burdenTotal;
    const overhead = crewCost * settings.pricing.overheadRate;
    const profit = (crewCost + overhead) * settings.pricing.profitRate;
    return {
      workers,
      employeeCount: crew.length,
      resolvedCount,
      paidWages,
      taxesTotal,
      benefitsTotal,
      burdenTotal,
      crewCost,
      averageCost: resolvedCount ? crewCost / resolvedCount : 0,
      burdenRate: paidWages ? burdenTotal / paidWages : 0,
      overhead,
      profit,
      sellRate: crewCost + overhead + profit,
      ...breakdown,
    };
  }

  return {
    calculateWorker,
    calculateCrew,
    resolveCostProfile,
    payTypeWage,
  };
});
