import type { LemmaBound } from "./filters";

/** Letter ranges plus the few lemmas outside a–z. */
export const SPREAD_BUCKETS: LemmaBound[] = [
  { gte: "a", lt: "d", byLemmaIndex: true },
  { gte: "d", lt: "g", byLemmaIndex: true },
  { gte: "g", lt: "j", byLemmaIndex: true },
  { gte: "j", lt: "m", byLemmaIndex: true },
  { gte: "m", lt: "p", byLemmaIndex: true },
  { gte: "p", lt: "s", byLemmaIndex: true },
  { gte: "s", lt: "v", byLemmaIndex: true },
  { gte: "v", lt: "{", byLemmaIndex: true },
  { lt: "a", byLemmaIndex: true },
  { gte: "{", byLemmaIndex: true },
];

export const SPREAD_PAGE = 80;

/** First screen. One word from each of these scattered letters, not the A-head of every range. */
export const SPREAD_HEAD = 14;

export type SpreadCursor = {
  offsets: number[];
  open: boolean[];
  /** Words already placed in the head, so later pages do not repeat them. */
  skipIds: string[];
  headed: boolean;
};

export function freshSpreadCursor(): SpreadCursor {
  return {
    offsets: SPREAD_BUCKETS.map(() => 0),
    open: SPREAD_BUCKETS.map(() => true),
    skipIds: [],
    headed: false,
  };
}

/** Stride 7 is coprime with 26, so the head covers the alphabet instead of a–c. */
export function headBounds(seed: number, count = SPREAD_HEAD): LemmaBound[] {
  const start = seed % 26;
  const bounds: LemmaBound[] = [];
  for (let i = 0; i < count; i++) {
    const code = (start + i * 7) % 26;
    const gte = String.fromCharCode(97 + code);
    const lt = code === 25 ? "{" : String.fromCharCode(98 + code);
    bounds.push({ gte, lt, byLemmaIndex: true });
  }
  return bounds;
}

/** Skip the first few lemmas of a letter so the head is not always abandon / apple / … */
export function headOffset(seed: number, index: number): number {
  let state = (seed + index * 0x9e3779b1) >>> 0 || 1;
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state % 24;
}

export function mixSpreadPage<T>(columns: T[][], seed: number): T[] {
  const items = columns.flat();
  return shufflePage(items, seed ^ (items.length * 0x9e3779b1));
}

function shufflePage<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let state = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
