import { useMemo, useState } from 'react';
import {
  ALBUM_CATALOG,
  ALBUM_CATEGORIES,
  getPairedVariantEntry,
  type AlbumCategory,
  type AlbumEntry,
} from '../data/albumCatalog';

interface GalleryModalProps {
  onClose: () => void;
}

type MaleVariantFilter = 'all' | 'base' | 'male';

export function GalleryModal({ onClose }: GalleryModalProps) {
  const [cat, setCat] = useState<AlbumCategory>('P');
  const [sub, setSub] = useState<string>('all');
  const [maleFilter, setMaleFilter] = useState<MaleVariantFilter>('all');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<AlbumEntry | null>(null);

  const activeCategoryDef =
    ALBUM_CATEGORIES.find((c) => c.id === cat) ?? ALBUM_CATEGORIES[0];

  const categoryCounts = useMemo(() => {
    const counts: Record<AlbumCategory, number> = {
      P: 0,
      D: 0,
      T: 0,
      J: 0,
      N: 0,
      S: 0,
      X: 0,
    };
    for (const item of ALBUM_CATALOG) {
      counts[item.cat] += 1;
    }
    return counts;
  }, []);

  const categoryItems = useMemo(
    () => ALBUM_CATALOG.filter((item) => item.cat === cat),
    [cat]
  );

  const hasMaleVariantsInCategory = useMemo(
    () => categoryItems.some((item) => item.isMaleVariant),
    [categoryItems]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categoryItems.filter((item) => {
      if (sub !== 'all' && item.sub !== sub) return false;
      if (maleFilter === 'base' && item.isMaleVariant) return false;
      if (maleFilter === 'male' && !item.isMaleVariant) return false;
      if (!q) return true;
      return (
        item.key.toLowerCase().includes(q) ||
        item.resolvedKey.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.hint.toLowerCase().includes(q)
      );
    });
  }, [categoryItems, sub, maleFilter, search]);

  const previewIndex = preview
    ? filtered.findIndex((item) => item.id === preview.id)
    : -1;
  const pairedVariant = preview ? getPairedVariantEntry(preview) : undefined;

  const handleStepPreview = (delta: -1 | 1) => {
    if (!preview || filtered.length === 0) return;
    const baseIdx = previewIndex >= 0 ? previewIndex : 0;
    const nextIdx = (baseIdx + delta + filtered.length) % filtered.length;
    setPreview(filtered[nextIdx] ?? null);
  };

  return (
    <div className="dk-modal-bg" onClick={onClose}>
      <div
        className="dk-modal"
        style={{ width: 'min(980px, 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dk-modal-head">
          <span>
            ALWAYS-UNLOCKED CG &amp; PORTRAIT ALBUM ({ALBUM_CATALOG.length} ASSETS ·{' '}
            {activeCategoryDef.label.toUpperCase()})
          </span>
          <button type="button" className="dk-btn sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="dk-modal-body">
          {/* 7 Category Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {ALBUM_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`dk-btn sm ${cat === c.id ? 'active' : ''}`}
                onClick={() => {
                  setCat(c.id);
                  setSub('all');
                  setPreview(null);
                }}
              >
                {c.shortLabel} ({categoryCounts[c.id]})
              </button>
            ))}
          </div>

          {/* Subcategory Chips + _m Variant Toggle + Search */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 5,
              alignItems: 'center',
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: '1px dashed var(--d)',
            }}
          >
            <button
              type="button"
              className={`dk-subnav-btn ${sub === 'all' ? 'active' : ''}`}
              onClick={() => {
                setSub('all');
                setPreview(null);
              }}
            >
              All ({categoryItems.length})
            </button>
            {activeCategoryDef.subs.map((sc) => {
              const count = categoryItems.filter((i) => i.sub === sc.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={sc.id}
                  type="button"
                  className={`dk-subnav-btn ${sub === sc.id ? 'active' : ''}`}
                  onClick={() => {
                    setSub(sc.id);
                    setPreview(null);
                  }}
                >
                  {sc.label} ({count})
                </button>
              );
            })}

            {hasMaleVariantsInCategory && (
              <div style={{ display: 'inline-flex', gap: 3, marginLeft: 'auto' }}>
                {(
                  [
                    ['all', 'All'],
                    ['base', 'Base / F'],
                    ['male', 'Male (_m)'],
                  ] as [MaleVariantFilter, string][]
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`dk-btn sm ${maleFilter === mode ? 'pri' : ''}`}
                    onClick={() => setMaleFilter(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <input
              className="dk-input"
              style={{ flex: '1 1 180px', minWidth: 160 }}
              value={search}
              placeholder="Filter key, title, or hint..."
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Lightbox / Inspect View */}
          {preview && (
            <div
              className="dk-card"
              style={{ borderColor: 'var(--y)', textAlign: 'center', marginBottom: 10 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <b style={{ color: 'var(--y)' }}>{preview.title}</b>{' '}
                  <span className="dk-badge c">{preview.key}</span>{' '}
                  {preview.isAlias && (
                    <span className="dk-badge m">Alias → {preview.resolvedKey}</span>
                  )}
                  {preview.isMaleVariant && <span className="dk-badge">Male (_m)</span>}
                  <div className="dk-help-hint">{preview.hint}</div>
                </div>

                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {pairedVariant && (
                    <button
                      type="button"
                      className="dk-btn sm amber"
                      onClick={() => setPreview(pairedVariant)}
                    >
                      {preview.isMaleVariant ? 'View Base' : 'View Male (_m)'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="dk-btn sm"
                    disabled={filtered.length <= 1}
                    onClick={() => handleStepPreview(-1)}
                  >
                    ◄ Prev
                  </button>
                  <button
                    type="button"
                    className="dk-btn sm"
                    disabled={filtered.length <= 1}
                    onClick={() => handleStepPreview(1)}
                  >
                    Next ►
                  </button>
                  <button
                    type="button"
                    className="dk-btn sm del"
                    onClick={() => setPreview(null)}
                  >
                    Close Preview
                  </button>
                </div>
              </div>

              <img
                src={preview.url}
                alt={preview.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '46vh',
                  objectFit: 'contain',
                  border: '1px solid var(--d)',
                  background: '#000',
                }}
              />
            </div>
          )}

          {/* Thumbnail Grid */}
          {filtered.length === 0 ? (
            <div className="dk-help-hint">No assets match the current filter.</div>
          ) : (
            <div className="dk-gallery-grid">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="dk-gallery-tile"
                  style={
                    preview?.id === item.id
                      ? { borderColor: 'var(--y)', boxShadow: '0 0 0 1px var(--y)' }
                      : undefined
                  }
                  onClick={() => setPreview(item)}
                  title={`${item.title} (${item.key})`}
                >
                  <img src={item.url} alt={item.title} loading="lazy" />
                  <span>
                    {item.isMaleVariant ? '♂ ' : ''}
                    {item.isAlias ? '↪ ' : ''}
                    {item.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
