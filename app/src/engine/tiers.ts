import { CORR_RATCHET_FLOOR, CORR_TIERS } from '../data/constants';
import type { Prisoner } from '../types/game';
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

/**
 * Ticket 31 (trainer depth): the ONE corr write funnel. Every corr delta —
 * pact stat effects, pact-specific bonuses, estate drift/comfort ticks,
 * crisis prisCorr, conversion writes — goes through here so the TiTS-style
 * ratchet floor is enforced in exactly one place: a prisoner already at or
 * above CORR_RATCHET_FLOOR (Hollowed) can never be written back below it.
 *
 * For corr < CORR_RATCHET_FLOOR this is exactly clamp(corr + delta, 0, 100) —
 * identical to the pre-31 write sites. The floor is judged from the
 * prisoner's corr BEFORE the delta: reaching the floor locks it, and later
 * negative deltas ride the lock.
 *
 * Returns the new corr integer (pure — callers spread it into the prisoner).
 */
export function applyCorrDelta(
  prisoner: Pick<Prisoner, 'corr'>,
  delta: number
): number {
  const base = clamp(Math.round(prisoner.corr), 0, 100);
  const floor = base >= CORR_RATCHET_FLOOR ? CORR_RATCHET_FLOOR : 0;
  return clamp(Math.max(base + delta, floor), 0, 100);
}
