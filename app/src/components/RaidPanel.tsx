import { getFloorDC } from '../engine/dungeon';
import type { GameState } from '../types/game';
import { GradeBadge } from './GradeBadge';

interface RaidPanelProps {
  state: GameState;
  isBusy: boolean;
  onAdvanceFloor: (narrateWithAi: boolean) => void;
}

export function RaidPanel({ state, isBusy, onAdvanceFloor }: RaidPanelProps) {
  const armedFloors = state.floors.filter((f) => f.slots.length > 0);
  const nextFloor = armedFloors.find((f) => f.floor > state.floorCursor);

  return (
    <div>
      <div className="dk-floor-head">
        <div>
          <strong style={{ color: 'var(--r)' }}>WAVE {state.wave} IN PROGRESS</strong>
          <div className="dk-help-hint">
            {state.floorCursor === 0
              ? 'Party standing at Dungeon Gate'
              : `Cleared / Resolved up to ${state.floorCursor}F`}
            {nextFloor
              ? ` · Next defense: ${nextFloor.floor}F (DC ${getFloorDC(nextFloor)})`
              : ' · Next step: Core Threshold!'}
          </div>
        </div>
        <span className="dk-dc-badge">
          {nextFloor ? `NEXT ${nextFloor.floor}F` : 'CORE'}
        </span>
      </div>

      {/* Upcoming or Last Room Audit */}
      {nextFloor && (
        <div className="dk-card" style={{ borderLeft: '4px solid var(--y)' }}>
          <div className="dk-card-row" style={{ marginBottom: 4 }}>
            <b style={{ color: 'var(--y)' }}>UPCOMING: FLOOR {nextFloor.floor}</b>
            <span className="dk-dc-badge">DC {getFloorDC(nextFloor)}</span>
          </div>
          {nextFloor.slots.map((s, i) => (
            <div key={s.id} className="dk-help-hint" style={{ color: 'var(--w)', marginTop: 2 }}>
              <GradeBadge grade={s.grade} /> #{i + 1} {s.text}
            </div>
          ))}
        </div>
      )}

      {/* Party Status Cards */}
      <div style={{ color: 'var(--c)', fontWeight: 700, marginBottom: 6 }}>
        INTRUDER PARTY STATUS
      </div>
      {state.party.map((h) => {
        const displayName = h.name || `#${h.slot} ${h.raceLabel} ${h.classLabel}`;
        return (
          <div key={h.slot} className={`dk-hero-card ${h.status}`}>
            <div className="dk-hero-top">
              <span className="dk-hero-name">
                #{h.slot} {displayName}
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <GradeBadge grade={h.grade} />
                <span
                  className={`dk-badge ${
                    h.status === 'alive'
                      ? 'n'
                      : h.status === 'dead'
                        ? 'r'
                        : h.status === 'captured'
                          ? 'm'
                          : ''
                  }`}
                >
                  {h.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="dk-tag-row">
              <span className="dk-badge c">{h.raceLabel}</span>
              <span className="dk-badge">{h.classLabel}</span>
              {h.cond === 'injured' && <span className="dk-badge y">INJURED (-2)</span>}
              {h.cond === 'severe' && <span className="dk-badge r">SEVERE (-4)</span>}
              {h.ailment > 0 && <span className="dk-badge c">AFFLICTED (-2)</span>}
              {h.aroused && <span className="dk-badge m">AROUSED (-1)</span>}
            </div>

            {h.lastRollText && (
              <div className="dk-help-hint" style={{ color: 'var(--y)', marginTop: 3 }}>
                Last Roll: {h.lastRollText}
              </div>
            )}
          </div>
        );
      })}

      {/* Dice Audit Table */}
      {state.lastAudit.length > 0 && (
        <div className="dk-card">
          <div style={{ color: 'var(--c)', fontWeight: 700, marginBottom: 4 }}>
            LAST ROOM ROLL AUDIT ({state.floorCursor}F)
          </div>
          {state.lastAudit.map((row) => (
            <div key={row.slot} className="dk-ledger-row">
              <span>
                {row.heroName} · d20({row.die}) {row.mods >= 0 ? `+${row.mods}` : row.mods} ={' '}
                <b>{row.total}</b> vs DC {row.dc}
              </span>
              <span
                className={row.margin >= 0 ? 'dk-pos' : 'dk-neg'}
                style={{ textTransform: 'uppercase' }}
              >
                {row.beat} ({row.statusAfter})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Raid Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        <button
          type="button"
          className="dk-btn cta"
          disabled={isBusy}
          onClick={() => onAdvanceFloor(true)}
        >
          <span>
            {isBusy
              ? 'Resolving Encounter & Narrating...'
              : nextFloor
                ? `RESOLVE ${nextFloor.floor}F + AI NARRATION →`
                : 'RESOLVE CORE BREACH + AI NARRATION →'}
          </span>
          <span style={{ color: '#000' }}>Roll d20s &amp; Chronicle</span>
        </button>

        <button
          type="button"
          className="dk-btn sm amber"
          disabled={isBusy}
          onClick={() => onAdvanceFloor(false)}
          title="Resolve this room mathematically without calling the LLM"
        >
          Quick Resolve Floor (System Log Only · No API Call)
        </button>
      </div>
    </div>
  );
}
