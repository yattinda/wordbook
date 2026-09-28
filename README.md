# wordbook

オフラインで使える英単語帳アプリです。単語の一覧・検索・詳細を、ネット接続なしで閲覧できます。語彙は端末内の SQLite データベースとしてバンドルして使います。

## できること

- **単語一覧** — 見出し語、品詞、CEFR、アプリ内バンド、日本語訳の要約を一覧表示
- **検索・絞り込み** — 英語・日本語・定義での検索、学習バンド（`review` / `core` / `upper` / `advanced`）、CEFR、ドメイン（general / toeic / business / academic）、品詞でのフィルタ
- **単語詳細** — 意味（日英）、発音（IPA）、コロケーション、辞書の類義語、例文（Tatoeba 由来の出典表示）
- **類似語** — 事前計算した近い語へのジャンプ（`neighbors.jsonl` を取り込んだ場合）
- **設定** — 学習レベル用のバンドプリセット（既定は `core` / `upper` / `advanced`）、データソースのクレジット表示

一覧の既定では A1/A2 相当の `review` バンドは含めません。設定画面から変更できます。

## 技術スタック

- [Expo](https://expo.dev/)（React Native）+ [expo-router](https://docs.expo.dev/router/introduction/)
- 語彙の保存・検索: [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)（バンドル用 SQLite、`assets/wordbook.db`）
- フィルタ設定の永続化: AsyncStorage

## 前提

| もの | 用途 |
| --- | --- |
| Node.js + `npm` | wordbook のビルド・ingest |
| Python 3.11+ | englishdatasetsmaker（`.venv` 推奨） |
| リポジトリ配置 | 兄弟ディレクトリ想定: `wordbook/` と `englishdatasetsmaker/` |

`assets/wordbook.db` は Git に含めません。語彙の正本はデータセット側の **`data/processed/ja_gloss_cache.jsonl`**（コミット対象）と、ビルド後の **`data/processed/words.jsonl`** です。

---

## 初回セットアップ

### 1. wordbook

```bash
cd wordbook
npm install
```

### 2. englishdatasetsmaker（一度だけ）

```bash
cd ../englishdatasetsmaker
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
python -m edsm download     # 語彙リスト・Tatoeba を data/raw に固定
python -m edsm build        # 初回は Wiktionary サブセット取得（時間がかかる）
```

詳細は [englishdatasetsmaker の README](../englishdatasetsmaker/README.md) を参照。

### 3. アプリ用 DB と起動

```bash
cd ../wordbook
npm run ingest
npx expo start
```

---

## 語彙を更新する（標準: チャットで日本語訳を埋める）

wordbook は **ビルド済み `words.jsonl`** を ingest します。日本語が欠けている意味は、データセット側で **B. LLM チャット（Cursor / Copilot 等）** で `gloss_ja` を埋め、キャッシュに取り込んでから `build` → `ingest` します。OpenAI API は使いません。

以下のコマンドは **`englishdatasetsmaker` のルート**で、`.venv` を有効化した状態で実行します。

```bash
cd ../englishdatasetsmaker
source .venv/bin/activate
```

### チェックリスト（毎回この順）

| # | やること | 確認 |
| --- | --- | --- |
| 1 | 未キャッシュの意味を export | `pending_ja.jsonl` ができる |
| 2 | 400 行ずつ slice → チャットで `done_*.jsonl` | `chat_fill_all_status.py` で OK 件数 |
| 3 | キャッシュへ import | `imported N glosses` |
| 4 | データセット全体を build | `words.jsonl` 更新 |
| 5 | 欠損ゼロ確認 | `fill-ja --dry-run` → missing 0 |
| 6 | wordbook ingest | `assets/wordbook.db` 再生成 |
| 7 | Expo 再起動 | 実機は必要なら再インストール |

### 1. 欠けている日本語訳の一覧を出す

```bash
python -m edsm fill-ja --export-pending
python -m edsm fill-ja --dry-run
```

- 出力: `data/qa/pending_ja.jsonl`（**sense 1 行 = 未キャッシュの意味 1 件**）
- `key` 列はそのまま触らない（取り込みと `words.jsonl` 反映の照合に使う）
- 試しに先頭だけ: `python -m edsm fill-ja --export-pending --limit 50`

### 2. 分割してチャットで埋める

**切り出し**（例: 先頭 400 件 = offset 0）:

```bash
python scripts/chat_fill_slice.py slice --offset 0 --limit 400
# → data/qa/filled/slice_00000_0400.jsonl
```

**チャットへの依頼例**（Cursor 等にコピペ）:

> `englishdatasetsmaker/data/qa/filled/slice_00000_0400.jsonl` の全行について、`sources/ja_gloss_prompt.json` のルールで `gloss_ja` を埋めてください。  
> ルール: 1〜3 の短い日本語、／区切り、`gloss_en` を訳す（辞書サイトの文はコピーしない）。  
> 出力: `data/qa/filled/done_00000.jsonl`（元の `id` / `key` / `sense_index` 等は保持、`model`: `cursor-chat`）。  
> 空の `gloss_ja` は 0 件。

運用の目安:

| ファイル | 役割 |
| --- | --- |
| `slice_OFFSET_LIMIT.jsonl` | チャットに渡す入力（`gloss_ja` は null） |
| `done_OFFSET.jsonl` | 埋め終わったバッチ（**この名前で保存**） |
| `glosses_OFFSET.json` + `scripts/apply_gloss_list.py` |  gloss 配列を JSON で渡す場合（任意） |

全 pending を 400 行ずつ回すときは offset を `0, 400, 800, …` と増やします。進捗:

```bash
python scripts/chat_fill_all_status.py
# pending senses: N / filled OK: M と TODO offset の一覧
```

`data/qa/pending_ja.jsonl` と `data/qa/filled/` は **gitignore**（作業用）。共有・再現に必要なのは取り込み後の **`ja_gloss_cache.jsonl`** です。

### 3. キャッシュに取り込む

`done_*.jsonl` が揃ったら:

```bash
python -m edsm fill-ja --import-dir data/qa/filled --apply-only
```

- ディレクトリ内の `*.jsonl` を読む（`pending_ja.jsonl` / `merged_import.jsonl` はスキップ）
- 既にキャッシュにある `key` は飛ばす
- API キーが無くてもここまで実行できる

取り込みだけ試す場合は `scripts/run_chat_fill_import.sh` も同様（import + 簡易統計）。

### 4. データセットを再ビルド

```bash
python -m edsm build
```

- Wiktionary / Tatoeba を再付与し、`ja_gloss_cache.jsonl` の訳をカードに載せ直す
- **`fill-ja --import` だけでは Wiktionary 処理は走らない**ので、wordbook に載せる前に **必ず `build`**

### 5. 欠損が無いことを確認

```bash
python -m edsm fill-ja --dry-run
# missing senses: 0; uncached: 0
```

### 6. wordbook に取り込む

```bash
cd ../wordbook
npm run ingest
```

既定パス（兄弟の englishdatasetsmaker）:

- `data/processed/words.jsonl`
- `data/processed/neighbors.jsonl`（無ければ警告のみ）
- `ATTRIBUTION.md` → `assets/ATTRIBUTION.md` と `src/generated/attribution.ts`

パスを変える場合:

```bash
npm run ingest -- \
  --words /path/to/words.jsonl \
  --neighbors /path/to/neighbors.jsonl \
  --attribution /path/to/ATTRIBUTION.md
```

### 7. アプリを反映

```bash
npx expo start
```

開発ビルド（`expo run:android` 等）を使っている場合は、DB 差し替え後に **再ビルドまたはアプリ再インストール** した方が確実です。

---

## コミットするもの（データセット側）

| コミットする | コミットしない（削除可） |
| --- | --- |
| `data/processed/ja_gloss_cache.jsonl` | `data/qa/pending_ja.jsonl` |
| （任意）`ATTRIBUTION.md` の更新 | `data/qa/filled/` 一式（slice / done / glosses JSON） |
| | `scripts/_glosses_*.py` など作業用スクリプト |

別マシンでは `ja_gloss_cache.jsonl` を pull → `python -m edsm build` → wordbook で `npm run ingest` で同じ訳を再現できます。

---

## 日本語訳が空の表示について

一覧の「（訳なし）」や、詳細で英語定義だけの行は、**その sense に `gloss_ja` が無い**状態です。wordbook 単体では補完しません。上記 **export → チャット埋め → import → build → ingest** で直してください。

`build` 後も欠ける場合は、`pending` の `key` と `done_*.jsonl` の `key` が一致しているか、`chat_fill_all_status.py` で未完了スライスが無いかを確認します。

---

## 別ルート: OpenAI 互換 API（A）

API キーがある場合のみ [englishdatasetsmaker README の A](../englishdatasetsmaker/README.md#a-openai-互換-api推奨再現しやすい) を使えます。wordbook への載せ方は同じ（`build` → `npm run ingest`）。

---

## ライセンス・出典

語彙カードは複数のオープンライセンスソースの合成である想定です。取り込み時に `ATTRIBUTION.md` を渡した場合、アプリの設定画面および `assets/ATTRIBUTION.md` に出典とライセンスの概要を表示します。チャットで付けた訳は `gloss_ja_source: "llm"` です。公開する場合は ATTRIBUTION にその旨を残してください。例文は Tatoeba（CC BY 2.0 FR）など、ソースごとの条件が適用されます。
