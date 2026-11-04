import type { Rule, RuleOperator, RuleStage } from "../schema";

const STAGE_ORDER: Record<RuleStage, number> = { pre: 0, default: 1, post: 2 };

const OPERATOR_SCORE: Record<RuleOperator, number> = {
  is: 5,
  isNot: 5,
  oneOf: 4,
  notOneOf: 4,
  contains: 3,
  doesNotContain: 3,
  matches: 2,
};

export function specificityScore(rule: Rule): number {
  let best = 0;
  for (const condition of rule.conditions) {
    best = Math.max(best, OPERATOR_SCORE[condition.op]);
  }
  return best * 10 + rule.conditions.length;
}

/** Disabled rules are removed; everything else is ordered deterministically. */
export function rankRules(rules: readonly Rule[]): Rule[] {
  return rules
    .filter((rule) => rule.enabled)
    .sort((left, right) => {
      const stage = STAGE_ORDER[left.stage] - STAGE_ORDER[right.stage];
      if (stage !== 0) return stage;
      // Broad rules run first, specific rules last, so the specific action wins.
      const score = specificityScore(left) - specificityScore(right);
      if (score !== 0) return score;
      const created = left.createdAt.localeCompare(right.createdAt);
      if (created !== 0) return created;
      return left.id.localeCompare(right.id);
    });
}
