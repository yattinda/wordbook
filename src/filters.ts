import type { Filters } from "./types";

export type LemmaBound = {
  gte?: string;
  lt?: string;
  /** Range-scan `idx_words_lemma` and stop at LIMIT. Browse mix only. */
  byLemmaIndex?: boolean;
};

export type WordListSqlOptions = {
  bound?: LemmaBound;
  /** When false, English search uses LIKE only (expo-sqlite web has no fts5). */
  fts?: boolean;
  excludeIds?: string[];
};

/** Grammatical endings. Mid-gloss hits of these flood the list, so only exact and prefix atoms stay. */
const JA_GLOSS_STOPLIST = new Set(["する", "した", "しない", "ない", "こと", "もの"]);

/** Split gloss atoms on the same separators used when senses are joined. */
const GLOSS_ATOMS =
  "(' ' || replace(replace(replace(replace(replace(replace(IFNULL(w.gloss_ja, ''), '；', ' '), ';', ' '), '／', ' '), '/', ' '), '、', ' '), '　', ' ') || ' ')";

function isJapaneseQuery(query: string): boolean {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(query);
}

function englishRank(query: string): { sql: string; params: string[] } {
  const needle = query.toLowerCase();
  const sql = `CASE
      WHEN lower(w.lemma) = ? OR instr(lower(w.variants), '"' || ? || '"') > 0 THEN 0
      WHEN lower(w.lemma) LIKE ? || '%' OR instr(lower(w.variants), '"' || ?) > 0 THEN 1
      WHEN lower(w.lemma) LIKE '%' || ? OR instr(lower(w.lemma), '-' || ?) > 0 OR instr(lower(w.lemma), ' ' || ?) > 0 THEN 2
      WHEN instr(lower(w.lemma), ?) > 0 OR instr(lower(w.variants), ?) > 0 THEN 3
      ELSE 4
    END`;
  return { sql, params: Array(9).fill(needle) };
}

function japaneseRank(query: string): { sql: string; params: string[] } {
  const sql = `CASE
      WHEN instr(${GLOSS_ATOMS}, ' ' || ? || ' ') > 0 THEN 0
      WHEN instr(${GLOSS_ATOMS}, ' ' || ?) > 0 THEN 1
      WHEN instr(IFNULL(w.gloss_ja, ''), ?) > 0 THEN 2
      ELSE 3
    END`;
  return { sql, params: [query, query, query] };
}

export function buildWordListSql(
  filters: Filters,
  limit: number,
  offset: number,
  options?: WordListSqlOptions,
) {
  const bound = options?.bound;
  const where: string[] = [];
  const params: (string | number)[] = [];
  const query = filters.query.trim();

  if (query) {
    const like = `%${query}%`;
    const ascii = /[A-Za-z]/.test(query);
    const useFts = ascii && options?.fts === true;
    if (useFts) {
      where.push(
        "(w.lemma LIKE ? OR IFNULL(w.gloss_ja, '') LIKE ? OR IFNULL(w.gloss_en, '') LIKE ? OR IFNULL(w.variants, '') LIKE ? OR w.id IN (SELECT id FROM word_fts WHERE word_fts MATCH ?))"
      );
      params.push(like, like, like, like, ftsQuery(query));
    } else {
      where.push(
        "(w.lemma LIKE ? OR IFNULL(w.gloss_ja, '') LIKE ? OR IFNULL(w.gloss_en, '') LIKE ? OR IFNULL(w.variants, '') LIKE ?)"
      );
      params.push(like, like, like, like);
    }
  }

  if (filters.bands.length) {
    where.push(`w.app_band IN (${filters.bands.map(() => "?").join(", ")})`);
    params.push(...filters.bands);
  }

  if (filters.cefr.length) {
    where.push(`w.cefr IN (${filters.cefr.map(() => "?").join(", ")})`);
    params.push(...filters.cefr);
  }

  if (filters.pos.length) {
    where.push(`w.pos IN (${filters.pos.map(() => "?").join(", ")})`);
    params.push(...filters.pos);
  }

  if (filters.domains.length) {
    const domainClause = filters.domains
      .map(() => "w.domains LIKE ?")
      .join(" OR ");
    where.push(`(${domainClause})`);
    for (const domain of filters.domains) {
      params.push(`%"${domain}"%`);
    }
  }

  if (options?.excludeIds?.length) {
    where.push(`w.id NOT IN (${options.excludeIds.map(() => "?").join(", ")})`);
    params.push(...options.excludeIds);
  }

  if (bound?.gte != null) {
    where.push("w.lemma >= ?");
    params.push(bound.gte);
  }
  if (bound?.lt != null) {
    where.push("w.lemma < ?");
    params.push(bound.lt);
  }

  let rank: { sql: string; params: string[] } | null = null;
  if (query && !bound?.byLemmaIndex) {
    if (isJapaneseQuery(query)) {
      rank = japaneseRank(query);
      if (JA_GLOSS_STOPLIST.has(query)) {
        where.push(`instr(${GLOSS_ATOMS}, ' ' || ?) > 0`);
        params.push(query);
      }
    } else {
      rank = englishRank(query);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const from = bound?.byLemmaIndex ? "FROM words w INDEXED BY idx_words_lemma" : "FROM words w";
  const order = bound?.byLemmaIndex
    ? "ORDER BY w.lemma"
    : rank
      ? `ORDER BY ${rank.sql}, IFNULL(w.zipf, -1) DESC, length(w.lemma), w.lemma COLLATE NOCASE, w.pos`
      : "ORDER BY w.lemma COLLATE NOCASE, w.pos";
  const sql = `
    SELECT w.id, w.lemma, w.pos, w.cefr, w.app_band, w.zipf, w.gloss_ja, w.gloss_en, w.ipa, w.domains
    ${from}
    ${whereSql}
    ${order}
    LIMIT ? OFFSET ?
  `;
  const countSql = `SELECT COUNT(*) AS n FROM words w ${whereSql}`;
  return {
    sql,
    countSql,
    params: [...params, ...(rank?.params ?? []), limit, offset],
    countParams: params,
  };
}

export function ftsQuery(raw: string): string {
  const tokens = raw
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replace(/"/g, "")}"*`);
  return tokens.join(" AND ") || '"*"';
}
