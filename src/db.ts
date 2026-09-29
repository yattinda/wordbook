import * as SQLite from "expo-sqlite";

import type { Filters, Neighbor, WordDetail, WordListItem } from "./types";
import { ATTRIBUTION } from "./generated/attribution";
import { buildWordListSql, type LemmaBound } from "./filters";
import {
  SPREAD_BUCKETS,
  SPREAD_PAGE,
  headBounds,
  headOffset,
  mixSpreadPage,
  type SpreadCursor,
} from "./spread";

const DB_NAME = "wordbook.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let ftsAvailablePromise: Promise<boolean> | null = null;

async function canUseFtsSearch(): Promise<boolean> {
  if (!ftsAvailablePromise) {
    ftsAvailablePromise = (async () => {
      try {
        const db = await getDb();
        await db.getFirstAsync("SELECT 1 FROM word_fts LIMIT 1");
        return true;
      } catch {
        return false;
      }
    })();
  }
  return ftsAvailablePromise;
}

async function listSqlOptions(bound?: LemmaBound) {
  const fts = await canUseFtsSearch();
  return bound ? { bound, fts } : { fts };
}

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
  const { sql, countSql, params, countParams } = buildWordListSql(
    filters,
    limit,
    offset,
    await listSqlOptions(),
  );
  const rows = await db.getAllAsync<Record<string, unknown>>(sql, params);
  const countRow = await db.getFirstAsync<{ n: number }>(countSql, countParams);
  return { items: rows.map(mapListItem), total: countRow?.n ?? 0 };
}

export async function listSpreadPage(
  filters: Filters,
  cursor: SpreadCursor,
  seed: number,
): Promise<{ items: WordListItem[]; total: number; cursor: SpreadCursor; hasMore: boolean }> {
  const db = await getDb();
  const sqlOpts = await listSqlOptions();
  const { countSql, countParams } = buildWordListSql(filters, 1, 0, sqlOpts);
  const countRow = await db.getFirstAsync<{ n: number }>(countSql, countParams);

  const offsets = cursor.offsets.slice();
  const open = cursor.open.slice();
  const skipIds = cursor.skipIds.slice();
  let head: WordListItem[] = [];

  if (!cursor.headed) {
    const bounds = headBounds(seed);
    for (let index = 0; index < bounds.length; index++) {
      const picked = await readSpreadSlice(db, filters, sqlOpts, bounds[index], 1, headOffset(seed, index), skipIds);
      const item = picked[0] ?? (await readSpreadSlice(db, filters, sqlOpts, bounds[index], 1, 0, skipIds))[0];
      if (!item) continue;
      head.push(item);
      skipIds.push(item.id);
    }
    head = mixSpreadPage([head], seed ^ 0x51ed);
  }

  const columns: WordListItem[][] = [];
  const active = cursor.open.filter(Boolean).length || 1;
  const limit = Math.max(1, Math.ceil((SPREAD_PAGE - head.length) / active));

  for (let index = 0; index < SPREAD_BUCKETS.length; index++) {
    const bucket = SPREAD_BUCKETS[index];
    if (!cursor.open[index]) {
      columns.push([]);
      continue;
    }
    const items = await readSpreadSlice(
      db,
      filters,
      sqlOpts,
      bucket,
      limit,
      cursor.offsets[index],
      skipIds,
    );
    offsets[index] = cursor.offsets[index] + items.length;
    if (items.length < limit) open[index] = false;
    columns.push(items);
  }

  return {
    items: [...head, ...mixSpreadPage(columns, seed + cursor.offsets[0])],
    total: countRow?.n ?? 0,
    cursor: { offsets, open, skipIds, headed: true },
    hasMore: open.some(Boolean),
  };
}

async function readSpreadSlice(
  db: SQLite.SQLiteDatabase,
  filters: Filters,
  sqlOpts: { fts: boolean },
  bound: LemmaBound,
  limit: number,
  offset: number,
  excludeIds: string[],
): Promise<WordListItem[]> {
  const { sql, params } = buildWordListSql(filters, limit, offset, {
    ...sqlOpts,
    bound,
    excludeIds,
  });
  const rows = await db.getAllAsync<Record<string, unknown>>(sql, params);
  return rows.map(mapListItem);
}

export async function getWordsByIds(ids: string[]): Promise<Map<string, WordListItem>> {
  const found = new Map<string, WordListItem>();
  if (!ids.length) return found;
  const db = await getDb();
  const chunkSize = 400;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM words WHERE id IN (${placeholders})`,
      chunk
    );
    for (const row of rows) {
      const item = mapListItem(row);
      found.set(item.id, item);
    }
  }
  return found;
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
