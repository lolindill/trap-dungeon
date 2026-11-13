import {
  NAV_TABS,
  getNavTabBadges,
  getPrimaryTabForMode,
  type NavTabId,
} from '../engine/dayLoop';
import type { GameState } from '../types/game';

interface NavTabsProps {
  state: GameState;
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
}

export function NavTabs({ state, activeTab, onSelectTab }: NavTabsProps) {
  const primaryTab = getPrimaryTabForMode(state.mode);
  const badges = getNavTabBadges(state);

  return (
    <nav className="dk-subtabs" aria-label="Domain Subsystems">
      {NAV_TABS.map((tab) => {
        const badge = badges[tab.id];
        const isActive = activeTab === tab.id;
        const isPrimary = primaryTab === tab.id;
        const badgeClass =
          badge.tone === 'neutral' ? 'dk-tab-badge' : `dk-tab-badge ${badge.tone}`;

        return (
          <button
            key={tab.id}
            type="button"
            className={`dk-subtab ${isActive ? 'active' : ''} ${isPrimary ? 'phase-primary' : ''}`}
            onClick={() => onSelectTab(tab.id)}
            aria-selected={isActive}
          >
            <span className="dk-subtab-top">
              <span className="dk-kbd">{tab.hotkey}</span>
              <span>{tab.label}</span>
            </span>
            <span className={badgeClass}>{badge.text}</span>
          </button>
        );
      })}
    </nav>
  );
}
