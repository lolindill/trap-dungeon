import { useEffect, useRef, useState } from 'react';
import { assetUrl, resolveNpcImage } from '../data/assetManifest';
import { splitRichSegments, stripSystemTagsForDisplay } from '../engine/tagParser';
import type { ChronicleEntry } from '../types/game';

interface ChroniclePanelProps {
  entries: ChronicleEntry[];
  autoScroll: boolean;
  isBusy: boolean;
  dayLogCount?: number;
  onSendChat: (text: string) => void;
}

export function ChroniclePanel({
  entries,
  autoScroll,
  isBusy,
  dayLogCount = 0,
  onSendChat,
}: ChroniclePanelProps) {
  const [chatInput, setChatInput] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [entries.length, autoScroll, isBusy]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isBusy) return;
    setChatInput('');
    onSendChat(trimmed);
  };

  return (
    <section className="dk-pane dk-chronicle-pane">
      <div className="dk-pane-head">
        <span>DUNGEON CHRONICLE &amp; OFFICER DESK</span>
        <div className="dk-wrap">
          {dayLogCount > 0 && (
            <span
              className="dk-badge c"
              style={{ background: '#000', borderColor: '#000', color: 'var(--c)' }}
            >
              Day Log: {dayLogCount} queued
            </span>
          )}
          {isBusy && <span className="dk-spinner">● AI THINKING...</span>}
        </div>
      </div>

      <div className="dk-chronicle-feed">
        {entries.map((entry) => {
          const cleanText = stripSystemTagsForDisplay(entry.text);
          const segments = splitRichSegments(cleanText);

          return (
            <article key={entry.id} className={`dk-entry ${entry.kind}`}>
              <div className="dk-entry-head">
                <span className="dk-entry-title">{entry.title}</span>
                <span className="dk-help-hint">
                  {entry.wave !== undefined ? `W${entry.wave}` : ''}
                  {entry.floor ? ` · ${entry.floor}F` : ''}
                </span>
              </div>

              {entry.bannerUrl && (
                <img
                  src={assetUrl(entry.bannerUrl)}
                  alt={entry.title}
                  className="dk-entry-banner"
                  loading="lazy"
                />
              )}

              <div>
                {segments.map((seg, idx) => {
                  if (seg.kind === 'img') {
                    const imgSrc = resolveNpcImage(seg.character, seg.keyword);
                    if (!imgSrc) return null;
                    const capChar =
                      seg.character.charAt(0).toUpperCase() + seg.character.slice(1).toLowerCase();
                    return (
                      <figure key={idx} className="dk-npc-inline">
                        <img src={imgSrc} alt={`${capChar} (${seg.keyword})`} loading="lazy" />
                        <figcaption>
                          {capChar} · {seg.keyword.replace(/_/g, ' ')}
                        </figcaption>
                      </figure>
                    );
                  }
                  return (
                    <div key={idx} className="dk-entry-prose">
                      {seg.text.trim()}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="dk-chat-bar">
        <input
          className="dk-input"
          value={chatInput}
          disabled={isBusy}
          placeholder="Speak with Vesper, Lilim, or Eleonora... (optional roleplay or tactical advice)"
          onChange={(e) => setChatInput(e.target.value)}
        />
        <button
          type="submit"
          className="dk-btn pri"
          disabled={isBusy || !chatInput.trim()}
        >
          Send
        </button>
      </form>
    </section>
  );
}
