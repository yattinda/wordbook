import AsyncStorage from "@react-native-async-storage/async-storage";

import { defaultFilters, type Filters } from "./types";

const KEY = "wordbook.filters.v1";

export async function loadFilters(): Promise<Filters> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultFilters();
    const parsed = JSON.parse(raw) as Partial<Filters>;
    return {
      ...defaultFilters(),
      ...parsed,
      query: "",
    };
  } catch {
    return defaultFilters();
  }
}

export async function saveFilters(filters: Filters): Promise<void> {
  const { query: _query, ...rest } = filters;
  await AsyncStorage.setItem(KEY, JSON.stringify(rest));
}
