import AsyncStorage from "@react-native-async-storage/async-storage";

/** Kept out of wordbook.db, which is replaced whenever the dictionary is ingested. */
const KEY = "wordbook.lists.v1";

export type BookmarkList = {
  id: string;
  name: string;
  count: number;
};

export type BookmarkChoice = {
  id: string;
  name: string;
  checked: boolean;
};

export type ListMutation =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string };

export type ListMembership = {
  wordId: string;
  addedAt: number;
};

type StoredList = {
  id: string;
  name: string;
  createdAt: number;
};

type StoredMembership = {
  listId: string;
  wordId: string;
  addedAt: number;
};

type Store = {
  lists: StoredList[];
  memberships: StoredMembership[];
};

let cache: Store | null = null;
let chain: Promise<void> = Promise.resolve();

function normalizeListName(name: string): string {
  return name.trim();
}

function newId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyStore(): Store {
  return { lists: [], memberships: [] };
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
      lists: Array.isArray(parsed.lists) ? parsed.lists : [],
      memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
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

function byNewest(left: StoredList, right: StoredList): number {
  return right.createdAt - left.createdAt || right.id.localeCompare(left.id);
}

export function getLists(): Promise<BookmarkList[]> {
  return withStore(
    (store) =>
      [...store.lists].sort(byNewest).map((list) => ({
        id: list.id,
        name: list.name,
        count: store.memberships.filter((item) => item.listId === list.id).length,
      })),
    false
  );
}

export function getList(id: string): Promise<{ id: string; name: string } | null> {
  return withStore((store) => {
    const list = store.lists.find((item) => item.id === id);
    return list ? { id: list.id, name: list.name } : null;
  }, false);
}

export function createList(rawName: string, wordId?: string): Promise<ListMutation> {
  return withStore((store) => {
    const name = normalizeListName(rawName);
    if (!name) return { ok: false, error: "名前を入力してください" };
    if (store.lists.some((list) => list.name === name)) {
      return { ok: false, error: "同じ名前のリストがあります" };
    }
    const id = newId();
    const now = Date.now();
    store.lists.push({ id, name, createdAt: now });
    if (wordId) store.memberships.push({ listId: id, wordId, addedAt: now });
    return { ok: true, id, name };
  }, true);
}

export function renameList(id: string, rawName: string): Promise<ListMutation> {
  return withStore((store) => {
    const name = normalizeListName(rawName);
    if (!name) return { ok: false, error: "名前を入力してください" };
    if (store.lists.some((list) => list.name === name && list.id !== id)) {
      return { ok: false, error: "同じ名前のリストがあります" };
    }
    const list = store.lists.find((item) => item.id === id);
    if (!list) return { ok: false, error: "このリストは見つかりません" };
    list.name = name;
    return { ok: true, id, name };
  }, true);
}

export function deleteList(id: string): Promise<void> {
  return withStore((store) => {
    store.lists = store.lists.filter((list) => list.id !== id);
    store.memberships = store.memberships.filter((item) => item.listId !== id);
  }, true);
}

export function choicesForWord(wordId: string): Promise<BookmarkChoice[]> {
  return withStore(
    (store) =>
      [...store.lists].sort(byNewest).map((list) => ({
        id: list.id,
        name: list.name,
        checked: store.memberships.some((item) => item.listId === list.id && item.wordId === wordId),
      })),
    false
  );
}

export function setMembership(listId: string, wordId: string, on: boolean): Promise<void> {
  return withStore((store) => {
    const index = store.memberships.findIndex((item) => item.listId === listId && item.wordId === wordId);
    if (on) {
      if (index === -1) store.memberships.push({ listId, wordId, addedAt: Date.now() });
      return;
    }
    if (index !== -1) store.memberships.splice(index, 1);
  }, true);
}

export function savedWordIds(): Promise<string[]> {
  return withStore((store) => [...new Set(store.memberships.map((item) => item.wordId))], false);
}

export function membershipsInList(listId: string): Promise<ListMembership[]> {
  return withStore(
    (store) =>
      store.memberships
        .filter((item) => item.listId === listId)
        .sort((left, right) => right.addedAt - left.addedAt || right.wordId.localeCompare(left.wordId))
        .map((item) => ({ wordId: item.wordId, addedAt: item.addedAt })),
    false
  );
}
