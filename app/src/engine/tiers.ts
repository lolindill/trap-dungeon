import { CORR_TIERS } from '../data/constants';
import { clamp } from './rng';

/**
 * Ticket 27 (corruption seam II): map a raw corr integer to its named tier
 * from CORR_TIERS. Deterministic and total — inputs outside 0-100 clamp to
 * the boundary tiers. This is the ONE place raw corr becomes a word: tier
 * labels cross the LLM/UI boundary, raw ints never do (judge ruling).
 */
export function corrTier(corr: number): { key: string; label: string } {
  const c = clamp(Math.round(corr), 0, 100);
  const tier = CORR_TIERS.find((t) => c >= t.min && c <= t.max) ?? CORR_TIERS[0];
  return { key: tier.key, label: tier.label };
}
