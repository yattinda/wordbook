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

- Node.js（`npm`）
- Python 3（データ取り込みスクリプト用）
- 語彙データセット **englishdatasetsmaker**（同じマシン上なら `../englishdatasetsmaker` を想定）

`assets/wordbook.db` は Git に含めません。クローン後はデータセットをビルドしてから取り込みを実行してください。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 語彙データの準備（englishdatasetsmaker）

wordbook は **ビルド済みの JSONL** を読み込みます。日本語訳の欠けや Wiktionary 由来の訳の修正は、データセット側のパイプラインで行います。

推奨の流れ（詳細は `../englishdatasetsmaker/README.md`）:

1. **欠けている日本語訳を出す**（未キャッシュの意味だけ）

   ```bash
   cd ../englishdatasetsmaker
   python -m edsm fill-ja --export-pending
   ```

2. **埋める** — OpenAI 互換 API なら `python -m edsm fill-ja`（`EDSM_LLM_API_KEY` または `OPENAI_API_KEY`）。API が無い場合は `data/qa/pending_ja.jsonl` を分割してチャットで `gloss_ja` を埋め、`data/qa/filled/done_*.jsonl` として保存し、`python -m edsm fill-ja --import-dir data/qa/filled`（または `--import`）。分割例: `python scripts/chat_fill_slice.py slice --offset 0 --limit 400`。

3. **データセットを再ビルド**（Wiktionary の意味・訳の付け方の変更もここで反映される）

   ```bash
   python -m edsm build
   ```

   `build` は `data/processed/words.jsonl` を作り直し、`ja_gloss_cache.jsonl` の訳を空欄の意味に再適用します。`fill-ja --import` だけでは Wiktionary 処理は走りません。

### 3. アプリ用 DB の生成

```bash
cd ../wordbook
npm run ingest
```

既定では兄弟ディレクトリの englishdatasetsmaker を参照します（`words.jsonl` / `neighbors.jsonl` / `ATTRIBUTION.md`）。パスを変える場合:

```bash
npm run ingest -- \
  --words /path/to/words.jsonl \
  --neighbors /path/to/neighbors.jsonl \
  --attribution /path/to/ATTRIBUTION.md
```

`neighbors` や `attribution` は省略可能です。詳細は `python3 scripts/ingest-dataset.py --help`。

生成される主なファイル:

- `assets/wordbook.db` — アプリが読み込む語彙 DB
- `assets/ATTRIBUTION.md` / `src/generated/attribution.ts` — `--attribution` を指定した場合

データを更新したら **ingest を再実行**し、Expo を再起動してください。

### 4. 起動

```bash
npx expo start
```

iOS / Android は Expo のメニューから、ブラウザ確認は `npm run web` でも起動できます。

## 日本語訳が空の単語について

一覧で「（訳なし）」、詳細で英語定義だけの行がある場合、データセット側でその意味の `gloss_ja` がまだ無い状態です（`needs_ja_gloss` や意味ごとの空欄）。wordbook の表示仕様であり、アプリ単体では補完しません。上記 **2 → 3** のパイプラインで埋めてから ingest してください。

## ライセンス・出典

語彙カードは複数のオープンライセンスソースの合成である想定です。取り込み時に `ATTRIBUTION.md` を渡した場合、アプリの設定画面および `assets/ATTRIBUTION.md` に出典とライセンスの概要を表示します。例文は Tatoeba（CC BY 2.0 FR）など、ソースごとの条件が適用されます。
