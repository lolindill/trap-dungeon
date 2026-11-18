import { CFG } from '../data/constants';

/**
 * Trap-defense term of a floor's DC (everything except DC_BASE and the depth term).
 * Single shared pure function: dungeon.getFloorDC and raidMods.floorTrapPower both call it,
 * so the two can never drift apart (raidMods must not import dungeon.ts).
 *
 * Only the raw trap sum passes through the diminishing "knee"; synergy and the ascendant
 * bonus are added AFTER it, so a full floor of strong traps no longer swallows them.
 * The knee is rounded DOWN so the engine value is always an integer equal to what the UI shows.
 */
export function floorDefense(trapSum: number, synBonus: number, ascendantBonus: number): number {
  const { KNEE, CAP } = CFG.FLOOR_DEFENSE;
  const kneed = trapSum <= KNEE ? trapSum : KNEE + Math.floor((trapSum - KNEE) / 2);
  return Math.min(CAP, Math.max(0, kneed + synBonus + ascendantBonus));
}
