// A configurable operational rules engine
export class RulesEngine {
  constructor(rules) {
    this.rules = rules;
  }

  evaluateOpportunity(opportunity) {
    let riskScore = opportunity.riskScore ?? 0;
    let reasons = [];

    const lastActivityDate = new Date(opportunity.lastActivityDate);
    const closeDate = new Date(opportunity.closeDate);
    const hasValidLastActivityDate = !Number.isNaN(lastActivityDate.getTime());
    const hasValidCloseDate = !Number.isNaN(closeDate.getTime());
    const daysSinceActivity = hasValidLastActivityDate
      ? (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
      : null;

    this.rules.forEach(rule => {
      let isMatch = true;

      // Evaluate conditions
      if (rule.condition.minAmount != null && opportunity.amount < rule.condition.minAmount) isMatch = false;
      if (
        rule.condition.inactivityDays != null &&
        (!hasValidLastActivityDate || daysSinceActivity <= rule.condition.inactivityDays)
      ) isMatch = false;
      if (
        rule.condition.pastCloseDate &&
        (!hasValidCloseDate || Date.now() <= closeDate.getTime())
      ) isMatch = false;
      
      // Apply actions if rule matches
      if (isMatch) {
        if (rule.action.escalateRisk) riskScore += rule.action.escalateRisk;
        if (rule.action.reasoningLabel) reasons.push(rule.action.reasoningLabel);
      }
    });

    return {
      newRiskScore: riskScore,
      reasons,
      isEscalated: riskScore >= 7.0
    };
  }
}
