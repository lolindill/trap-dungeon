import { CFG } from '../data/constants';
import type { TrapSlot } from '../types/game';

/**
 * MP refunded when a trap is dismantled. Armed traps refund CFG.REFUND_RATE; spent or disarmed
 * traps already did their job, so they refund CFG.REFUND_RATE_USED (stops dismantle-rebuild churn
 * from being a free reset). Shared by the dismantle action, the UI preview and net-assets maths.
 */
export function getTrapRefund(slot: Pick<TrapSlot, 'mpInvested' | 'status'>): number {
  const rate = slot.status === 'spent' || slot.status === 'disarmed' ? CFG.REFUND_RATE_USED : CFG.REFUND_RATE;
  return Math.floor((slot.mpInvested ?? 0) * rate);
}
