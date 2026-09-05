---
status: current
owner: tkcanta
last_reviewed: 2026-09-05
review_triggers: [公開URL・配信設定・検証コマンドの変更]
---

# 公開と検証

ブラウザ内のCanvasでTFTサムネイルを編集する静的ツール。画像と編集内容はブラウザ内に保存し、バックエンドは使用しない。

- リポジトリ: https://github.com/tkcanta/CitrusTFT-
- 公開URL: https://tkcanta.github.io/CitrusTFT-/
- Pages設定: Deploy from a branch、`main`、`/`。
- `.nojekyll` でファイルをそのまま配信する。独自のActions設定は不要。
- ZIPの実行ファイルは変更せず配置。元READMEは `USAGE.md` に保存。
- 更新は必要なファイルをコミットしてpush。ロールバックは対象コミットのrevert。

公開前に各JavaScriptを `node --check ファイル名` で構文確認し、HTML内のローカル参照先の存在と `git diff --check` を確認する。公開後はPagesビルド成功、トップページとCSS・JavaScriptのHTTP 200および配信内容を確認する。

機能変更時の既存ブラウザ回帰テスト手順はルートの `TESTING.md` を参照。そこに記載された48項目の結果はZIP同梱の過去記録で、今回の公開検証結果とは区別する。Computer Useにはユーザー許可または適用スキルの明示指示が必要。

Google Fontsと素材サイトは外部通信を使用する。素材の直接取得は配信元のCORS設定に依存し、失敗時は画像ファイルを手元から読み込む。公開URLへ移動しても別オリジンの自動保存は引き継がれないため、既存データは `.tft.json` で移す。
