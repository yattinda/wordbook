#!/usr/bin/env python3
"""Convert englishdatasetsmaker JSONL into an offline SQLite database."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = ROOT.parent / "englishdatasetsmaker"
DEFAULT_WORDS = DEFAULT_DATASET / "data" / "processed" / "words.jsonl"
DEFAULT_NEIGHBORS = DEFAULT_DATASET / "data" / "processed" / "neighbors.jsonl"
DEFAULT_ATTRIBUTION = DEFAULT_DATASET / "ATTRIBUTION.md"
DEFAULT_OUT = ROOT / "assets" / "wordbook.db"
DEFAULT_ATTRIBUTION_OUT = ROOT / "assets" / "ATTRIBUTION.md"
DEFAULT_ATTRIBUTION_TS = ROOT / "src" / "generated" / "attribution.ts"

SCHEMA = """
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;

CREATE TABLE words (
  id TEXT PRIMARY KEY,
  lemma TEXT NOT NULL,
  pos TEXT NOT NULL,
  cefr TEXT,
  app_band TEXT,
  zipf REAL,
  domains TEXT NOT NULL,
  variants TEXT NOT NULL,
  ipa_json TEXT NOT NULL,
  senses_json TEXT NOT NULL,
  examples_json TEXT NOT NULL,
  synonyms_json TEXT NOT NULL,
  collocations_json TEXT NOT NULL,
  gloss_ja TEXT,
  gloss_en TEXT,
  ipa TEXT
);

CREATE TABLE neighbors (
  word_id TEXT NOT NULL,
  neighbor_id TEXT NOT NULL,
  score REAL NOT NULL,
  PRIMARY KEY (word_id, neighbor_id)
);

CREATE VIRTUAL TABLE word_fts USING fts5(
  id UNINDEXED,
  lemma,
  gloss_ja,
  gloss_en,
  variants
);

CREATE INDEX idx_words_band ON words(app_band);
CREATE INDEX idx_words_cefr ON words(cefr);
CREATE INDEX idx_words_pos ON words(pos);
CREATE INDEX idx_words_lemma ON words(lemma);
CREATE INDEX idx_neighbors_word ON neighbors(word_id, score DESC);
"""


def dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def first_ipa(ipa: dict) -> str | None:
    if not ipa:
        return None
    for key in ("us", "uk", "default"):
        if ipa.get(key):
            return str(ipa[key])
    for value in ipa.values():
        if value:
            return str(value)
    return None


def join_senses(senses: list, field: str) -> str:
    parts = []
    for sense in senses or []:
        text = (sense.get(field) or "").strip()
        if text:
            parts.append(text)
    return " ".join(parts)


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def ingest(
    words_path: Path,
    neighbors_path: Path | None,
    attribution_path: Path | None,
    out_path: Path,
    attribution_out: Path,
    attribution_ts: Path,
) -> None:
    if not words_path.exists():
        raise SystemExit(f"missing {words_path}")

    cards = load_jsonl(words_path)
    neighbors = load_jsonl(neighbors_path) if neighbors_path and neighbors_path.exists() else []

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()

    conn = sqlite3.connect(out_path)
    try:
        conn.executescript(SCHEMA)
        word_rows = []
        fts_rows = []
        for card in cards:
            senses = card.get("senses") or []
            variants = card.get("variants") or []
            gloss_ja = join_senses(senses, "gloss_ja")
            gloss_en = join_senses(senses, "gloss_en")
            ipa = first_ipa(card.get("ipa") or {})
            variants_text = " ".join(variants)
            word_rows.append(
                (
                    card["id"],
                    card.get("lemma") or "",
                    card.get("pos") or "unknown",
                    card.get("cefr"),
                    card.get("app_band"),
                    card.get("zipf"),
                    dumps(card.get("domains") or []),
                    dumps(variants),
                    dumps(card.get("ipa") or {}),
                    dumps(senses),
                    dumps(card.get("examples") or []),
                    dumps(card.get("synonyms") or []),
                    dumps(card.get("collocations") or []),
                    gloss_ja or None,
                    gloss_en or None,
                    ipa,
                )
            )
            fts_rows.append(
                (
                    card["id"],
                    card.get("lemma") or "",
                    gloss_ja,
                    gloss_en,
                    variants_text,
                )
            )
        conn.executemany(
            """
            INSERT INTO words (
              id, lemma, pos, cefr, app_band, zipf, domains, variants,
              ipa_json, senses_json, examples_json, synonyms_json, collocations_json,
              gloss_ja, gloss_en, ipa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            word_rows,
        )
        conn.executemany(
            "INSERT INTO word_fts(id, lemma, gloss_ja, gloss_en, variants) VALUES (?, ?, ?, ?, ?)",
            fts_rows,
        )

        neighbor_rows = []
        for row in neighbors:
            word_id = row.get("id")
            for neighbor in row.get("neighbors") or []:
                nid = neighbor.get("id")
                if not word_id or not nid:
                    continue
                neighbor_rows.append((word_id, nid, float(neighbor.get("score") or 0)))
        if neighbor_rows:
            conn.executemany(
                "INSERT OR REPLACE INTO neighbors (word_id, neighbor_id, score) VALUES (?, ?, ?)",
                neighbor_rows,
            )
        conn.commit()
        n_words = conn.execute("SELECT COUNT(*) FROM words").fetchone()[0]
        n_neighbors = conn.execute("SELECT COUNT(*) FROM neighbors").fetchone()[0]
    finally:
        conn.close()

    if attribution_path and attribution_path.exists():
        text = attribution_path.read_text(encoding="utf-8")
        attribution_out.write_text(text, encoding="utf-8")
        attribution_ts.parent.mkdir(parents=True, exist_ok=True)
        attribution_ts.write_text(
            "export const ATTRIBUTION = " + json.dumps(text, ensure_ascii=False) + ";\n",
            encoding="utf-8",
        )
        print(f"copied attribution to {attribution_out} and {attribution_ts}")

    print(f"wrote {n_words} words and {n_neighbors} neighbor edges to {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest vocabulary JSONL into SQLite")
    parser.add_argument("--words", type=Path, default=DEFAULT_WORDS)
    parser.add_argument("--neighbors", type=Path, default=DEFAULT_NEIGHBORS)
    parser.add_argument("--attribution", type=Path, default=DEFAULT_ATTRIBUTION)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--attribution-out", type=Path, default=DEFAULT_ATTRIBUTION_OUT)
    parser.add_argument("--attribution-ts", type=Path, default=DEFAULT_ATTRIBUTION_TS)
    args = parser.parse_args()
    neighbors = args.neighbors if args.neighbors.exists() else None
    if neighbors is None:
        print(f"warning: {args.neighbors} missing; ingesting without similar words")
    ingest(
        args.words,
        neighbors,
        args.attribution,
        args.out,
        args.attribution_out,
        args.attribution_ts,
    )


if __name__ == "__main__":
    main()
