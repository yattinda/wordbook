import AsyncStorage from "@react-native-async-storage/async-storage";

import { defaultFilters, type Filters } from "./types";

const KEY = "wordbook.filters.v1";

export async function loadFilters(): Promise<Filters> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultFilters();
    const parsed = JSON.parse(raw) as Partial<Filters>;
    return {
      query: "",
      bands: Array.isArray(parsed.bands) ? parsed.bands : defaultFilters().bands,
      domains: Array.isArray(parsed.domains) ? parsed.domains : [],
      pos: Array.isArray(parsed.pos) ? parsed.pos : [],
    };
  } catch {
    return defaultFilters();
  }
}

export async function saveFilters(filters: Filters): Promise<void> {
  const { query: _query, ...rest } = filters;
  await AsyncStorage.setItem(KEY, JSON.stringify(rest));
}
