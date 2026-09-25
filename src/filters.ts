import type { Filters } from "./types";

export function buildWordListSql(filters: Filters, limit: number, offset: number) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  const query = filters.query.trim();

  if (query) {
    const like = `%${query}%`;
    const ascii = /[A-Za-z]/.test(query);
    if (ascii) {
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

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT w.id, w.lemma, w.pos, w.cefr, w.app_band, w.zipf, w.gloss_ja, w.gloss_en, w.ipa, w.domains
    FROM words w
    ${whereSql}
    ORDER BY w.lemma COLLATE NOCASE, w.pos
    LIMIT ? OFFSET ?
  `;
  const countSql = `SELECT COUNT(*) AS n FROM words w ${whereSql}`;
  return {
    sql,
    countSql,
    params: [...params, limit, offset],
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
