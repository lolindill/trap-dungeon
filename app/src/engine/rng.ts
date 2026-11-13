export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickOne<T>(items: readonly T[], rng: () => number = Math.random): T {
  return items[Math.floor(rng() * items.length)];
}

export function pickWeighted<T>(items: readonly T[], getWeight: (item: T, idx: number) => number): T {
  const weights = items.map((item, idx) => Math.max(0, getWeight(item, idx)));
  const total = weights.reduce((acc, w) => acc + w, 0);
  if (total <= 0) return items[0];
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
