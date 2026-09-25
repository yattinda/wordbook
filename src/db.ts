import * as SQLite from "expo-sqlite";

import type { Filters, Neighbor, WordDetail, WordListItem } from "./types";
import { ATTRIBUTION } from "./generated/attribution";
import { buildWordListSql } from "./filters";

const DB_NAME = "wordbook.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapListItem(row: Record<string, unknown>): WordListItem {
  return {
    id: String(row.id),
    lemma: String(row.lemma),
    pos: String(row.pos),
    cefr: (row.cefr as string | null) ?? null,
    app_band: (row.app_band as string | null) ?? null,
    zipf: typeof row.zipf === "number" ? row.zipf : row.zipf == null ? null : Number(row.zipf),
    gloss_ja: (row.gloss_ja as string | null) ?? null,
    gloss_en: (row.gloss_en as string | null) ?? null,
    ipa: (row.ipa as string | null) ?? null,
    domains: parseJson<string[]>(String(row.domains ?? "[]"), []),
  };
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      await SQLite.importDatabaseFromAssetAsync(DB_NAME, {
        assetId: require("../assets/wordbook.db"),
      });
      return SQLite.openDatabaseAsync(DB_NAME);
    })();
  }
  return dbPromise;
}

export async function listWords(
  filters: Filters,
  limit = 80,
  offset = 0
): Promise<{ items: WordListItem[]; total: number }> {
  const db = await getDb();
  const { sql, countSql, params, countParams } = buildWordListSql(filters, limit, offset);
  const rows = await db.getAllAsync<Record<string, unknown>>(sql, params);
  const countRow = await db.getFirstAsync<{ n: number }>(countSql, countParams);
  return { items: rows.map(mapListItem), total: countRow?.n ?? 0 };
}

export async function getWord(id: string): Promise<WordDetail | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>("SELECT * FROM words WHERE id = ?", [id]);
  if (!row) return null;
  const base = mapListItem(row);
  return {
    ...base,
    variants: parseJson<string[]>(String(row.variants ?? "[]"), []),
    ipaMap: parseJson<Record<string, string>>(String(row.ipa_json ?? "{}"), {}),
    senses: parseJson(String(row.senses_json ?? "[]"), []),
    examples: parseJson(String(row.examples_json ?? "[]"), []),
    synonyms: parseJson(String(row.synonyms_json ?? "[]"), []),
    collocations: parseJson(String(row.collocations_json ?? "[]"), []),
  };
}

export async function getNeighbors(id: string): Promise<Neighbor[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `
    SELECT n.neighbor_id AS id, n.score, w.lemma, w.pos, w.gloss_ja
    FROM neighbors n
    JOIN words w ON w.id = n.neighbor_id
    WHERE n.word_id = ?
    ORDER BY n.score DESC
    `,
    [id]
  );
  return rows.map((row) => ({
    id: String(row.id),
    lemma: String(row.lemma),
    pos: String(row.pos),
    gloss_ja: (row.gloss_ja as string | null) ?? null,
    score: Number(row.score),
  }));
}

export async function listPosValues(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ pos: string }>(
    "SELECT DISTINCT pos FROM words WHERE pos IS NOT NULL ORDER BY pos"
  );
  return rows.map((row) => row.pos);
}

export async function loadAttribution(): Promise<string> {
  return ATTRIBUTION;
}
