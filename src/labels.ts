/** Display labels. Stored values stay in English; this only changes what the user sees. */

import { APP_BANDS, DOMAINS } from "./types";

const POS_JA: Record<string, string> = {
  noun: "名詞",
  verb: "動詞",
  adjective: "形容詞",
  adverb: "副詞",
  preposition: "前置詞",
  determiner: "限定詞",
  pronoun: "代名詞",
  conjunction: "接続詞",
  interjection: "間投詞",
  auxiliary: "助動詞",
  modal: "法助動詞",
  numeral: "数詞",
  particle: "小詞",
  phrase: "句",
};

export function posLabel(pos: string): string {
  const key = pos.trim().toLowerCase();
  return POS_JA[key] ?? pos;
}

const POS_ORDER = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "pronoun",
  "determiner",
  "interjection",
  "numeral",
  "phrase",
  "auxiliary",
  "modal",
  "particle",
];

export function comparePos(a: string, b: string): number {
  const left = POS_ORDER.indexOf(a);
  const right = POS_ORDER.indexOf(b);
  return (left === -1 ? POS_ORDER.length : left) - (right === -1 ? POS_ORDER.length : right);
}

const BAND_JA: Record<string, string> = {
  review: "初級",
  core: "中級",
  upper: "中上級",
  advanced: "上級",
};

const DOMAIN_JA: Record<string, string> = {
  general: "日常",
  toeic: "TOEIC",
  business: "ビジネス",
  academic: "学術",
};

export function bandLabel(band: string): string {
  return BAND_JA[band] ?? band;
}

export function domainLabel(domain: string): string {
  return DOMAIN_JA[domain] ?? domain;
}

/** Empty or every value means the user is not narrowing this group. */
export function isAllSelected(selected: string[], universe: readonly string[]): boolean {
  return selected.length === 0 || selected.length >= universe.length;
}

export function bandSummary(bands: string[]): string {
  if (isAllSelected(bands, APP_BANDS)) return "すべてのレベル";
  return APP_BANDS.filter((band) => bands.includes(band)).map(bandLabel).join("・");
}

export function domainSummary(domains: string[]): string | null {
  if (isAllSelected(domains, DOMAINS)) return null;
  return DOMAINS.filter((domain) => domains.includes(domain)).map(domainLabel).join("・");
}

/**
 * Toggle one value. An empty selection means "all", shown only by the すべて chip.
 * Choosing a value from that state starts a fresh selection of just that value.
 * Clearing the last value returns to すべて. A complete set stays selected so the
 * chip that was just turned on remains on.
 */
export function toggleChoice(selected: string[], value: string, universe: readonly string[]): string[] {
  if (selected.length === 0) return [value];
  const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
  if (next.length === 0) return [];
  return next;
}

const IPA_ORDER = ["us", "uk"];
const IPA_JA: Record<string, string> = {
  us: "米",
  uk: "英",
};

function wrapIpa(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}/`;
}

/** One pronunciation line. Prefer US/UK; drop a duplicate default when either exists. */
export function formatPronunciations(ipaMap: Record<string, string>): string {
  const entries = Object.entries(ipaMap).filter(([, value]) => value?.trim());
  if (!entries.length) return "";

  const byKey = new Map(entries.map(([key, value]) => [key.toLowerCase(), value]));
  const hasRegional = IPA_ORDER.some((key) => byKey.has(key));
  const ordered: string[] = [];

  for (const key of IPA_ORDER) {
    const value = byKey.get(key);
    if (!value) continue;
    ordered.push(`${IPA_JA[key]} ${wrapIpa(value)}`);
    byKey.delete(key);
  }

  for (const [key, value] of byKey) {
    if (hasRegional && key === "default") continue;
    const label = IPA_JA[key];
    ordered.push(label ? `${label} ${wrapIpa(value)}` : wrapIpa(value));
  }

  return ordered.join("   ");
}
