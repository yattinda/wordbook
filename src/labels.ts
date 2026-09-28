/** Display labels. Stored values stay in English; this only changes what the user sees. */

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
