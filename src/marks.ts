import AsyncStorage from "@react-native-async-storage/async-storage";

import { addToTroubleList } from "./lists";

/** Kept out of wordbook.db, which is replaced whenever the dictionary is ingested. */
const KEY = "wordbook.marks.v1";

/** Quiz setup: due words only (not a bookmark list id). */
export const QUIZ_SOURCE_REVIEW = "__wordbook_review__";

export const INTERVAL_DAYS = [1, 3, 7, 21, 45] as const;

const MS_PER_DAY = 86_400_000;

export type MarkStatus = "known" | "unknown";

export type WordMark = {
  wordId: string;
  status: MarkStatus;
  step: number;
  dueAt: number;
  everUnknown: boolean;
};

type StoredMark = {
  wordId: string;
  status: MarkStatus;
  step: number;
  dueAt: number;
  everUnknown?: boolean;
};

type Store = {
  marks: StoredMark[];
};

let cache: Store | null = null;
let chain: Promise<void> = Promise.resolve();

function emptyStore(): Store {
  return { marks: [] };
}

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      cache = emptyStore();
      return cache;
    }
    const parsed = JSON.parse(raw) as Partial<Store>;
    cache = {
      marks: Array.isArray(parsed.marks)
        ? parsed.marks.filter(
            (item): item is StoredMark =>
              item != null &&
              typeof item.wordId === "string" &&
              (item.status === "known" || item.status === "unknown") &&
              typeof item.step === "number" &&
              typeof item.dueAt === "number"
          )
        : [],
    };
    return cache;
  } catch {
    cache = emptyStore();
    return cache;
  }
}

function withStore<T>(task: (store: Store) => T, persist: boolean): Promise<T> {
  const run = chain.then(async () => {
    const store = await load();
    const result = task(store);
    if (persist) {
      cache = store;
      await AsyncStorage.setItem(KEY, JSON.stringify(store));
    }
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function clampStep(step: number): number {
  const max = INTERVAL_DAYS.length - 1;
  return Math.max(0, Math.min(max, Math.floor(step)));
}

function daysForStep(step: number): number {
  return INTERVAL_DAYS[clampStep(step)];
}

export function intervalMsForStep(step: number): number {
  return daysForStep(step) * MS_PER_DAY;
}

function everUnknownFromRow(row: StoredMark): boolean {
  return row.everUnknown === true || row.status === "unknown";
}

export function nextKnownMark(previous: WordMark | null, now = Date.now()): Omit<WordMark, "wordId" | "everUnknown"> {
  const prevStep = previous?.step ?? -1;
  const maxStep = INTERVAL_DAYS.length - 1;
  const step = Math.min(prevStep + 1, maxStep);
  return {
    status: "known",
    step,
    dueAt: now + intervalMsForStep(step),
  };
}

export function nextUnknownMark(now = Date.now()): Omit<WordMark, "wordId"> {
  return {
    status: "unknown",
    step: 0,
    dueAt: now,
    everUnknown: true,
  };
}

function toWordMark(row: StoredMark): WordMark {
  return {
    wordId: row.wordId,
    status: row.status,
    step: clampStep(row.step),
    dueAt: row.dueAt,
    everUnknown: everUnknownFromRow(row),
  };
}

export function getMark(wordId: string): Promise<WordMark | null> {
  return withStore((store) => {
    const row = store.marks.find((item) => item.wordId === wordId);
    return row ? toWordMark(row) : null;
  }, false);
}

function upsert(store: Store, wordId: string, fields: Omit<WordMark, "wordId">): void {
  const index = store.marks.findIndex((item) => item.wordId === wordId);
  const row: StoredMark = { wordId, ...fields };
  if (index === -1) store.marks.push(row);
  else store.marks[index] = row;
}

export function markKnown(wordId: string, now = Date.now()): Promise<WordMark> {
  return withStore((store) => {
    const previous = store.marks.find((item) => item.wordId === wordId);
    const prevMark = previous ? toWordMark(previous) : null;
    const fields = nextKnownMark(prevMark, now);
    const everUnknown = previous ? everUnknownFromRow(previous) : false;
    const next: Omit<WordMark, "wordId"> = { ...fields, everUnknown };
    upsert(store, wordId, next);
    return { wordId, ...next };
  }, true);
}

export async function markUnknown(wordId: string, now = Date.now()): Promise<WordMark> {
  const mark = await withStore((store) => {
    const fields = nextUnknownMark(now);
    upsert(store, wordId, fields);
    return { wordId, ...fields };
  }, true);
  await addToTroubleList(wordId);
  return mark;
}

export function clearMark(wordId: string): Promise<void> {
  return withStore((store) => {
    store.marks = store.marks.filter((item) => item.wordId !== wordId);
  }, true);
}

export function clearAllMarks(): Promise<void> {
  return withStore((store) => {
    store.marks = [];
  }, true);
}

export function restingIds(now = Date.now()): Promise<string[]> {
  return withStore(
    (store) => store.marks.filter((item) => item.dueAt > now).map((item) => item.wordId),
    false
  );
}

/** Marks due now, plus any word ever marked unknown (continuous review). */
export function reviewMarks(now = Date.now()): Promise<WordMark[]> {
  return withStore(
    (store) =>
      store.marks
        .filter((item) => item.dueAt <= now || everUnknownFromRow(item))
        .map(toWordMark)
        .sort((left, right) => {
          const leftDue = left.dueAt <= now ? 0 : 1;
          const rightDue = right.dueAt <= now ? 0 : 1;
          if (leftDue !== rightDue) return leftDue - rightDue;
          return left.dueAt - right.dueAt || left.wordId.localeCompare(right.wordId);
        }),
    false
  );
}

/** @deprecated Use reviewMarks for quiz decks. */
export function dueMarks(now = Date.now()): Promise<WordMark[]> {
  return reviewMarks(now);
}