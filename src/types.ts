export type Sense = {
  gloss_en: string | null;
  gloss_ja: string | null;
  themes?: string[];
  gloss_ja_source?: string;
};

export type Example = {
  en: string;
  ja: string;
  source?: string;
  sentence_id?: number;
  translation_id?: number;
  author?: string;
  translation_author?: string;
};

export type WordListItem = {
  id: string;
  lemma: string;
  pos: string;
  cefr: string | null;
  app_band: string | null;
  zipf: number | null;
  gloss_ja: string | null;
  gloss_en: string | null;
  ipa: string | null;
  domains: string[];
};

export type WordDetail = WordListItem & {
  variants: string[];
  ipaMap: Record<string, string>;
  senses: Sense[];
  examples: Example[];
  synonyms: string[];
  collocations: string[];
};

export type Neighbor = {
  id: string;
  lemma: string;
  pos: string;
  gloss_ja: string | null;
  score: number;
};

export const APP_BANDS = ["review", "core", "upper", "advanced"] as const;
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const DOMAINS = ["general", "toeic", "business", "academic"] as const;

export const DEFAULT_BANDS = ["core", "upper", "advanced"] as const;

export type Filters = {
  query: string;
  bands: string[];
  cefr: string[];
  domains: string[];
  pos: string[];
};

export const defaultFilters = (): Filters => ({
  query: "",
  bands: [...DEFAULT_BANDS],
  cefr: [],
  domains: [],
  pos: [],
});
