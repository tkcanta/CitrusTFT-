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
- ZIPを初期登録し、現行の操作説明は `USAGE.md` で管理。
- 更新は必要なファイルをコミットしてpush。ロールバックは対象コミットのrevert。

公開前に各JavaScriptを `node --check ファイル名` で構文確認し、HTML内のローカル参照先の存在と `git diff --check` を確認する。公開後はPagesビルド成功、トップページとCSS・JavaScriptのHTTP 200および配信内容を確認する。

機能変更時の既存ブラウザ回帰テスト手順はルートの `TESTING.md` を参照。そこに記載された48項目の結果はZIP同梱の過去記録で、今回の公開検証結果とは区別する。Computer Useにはユーザー許可または適用スキルの明示指示が必要。

素材一覧は `catalog.js` のclassic scriptを使用し、file://でも外部通信なしで読み込む。更新は `python update_catalog.py`、単体版の再生成は `python build_standalone.py`。一覧更新後は差分の件数・配信先を確認する。画像本体とGoogle Fontsは外部通信を使用する。公開URLへ移動しても別オリジンの自動保存は引き継がれないため、既存データは `.tft.json` で移す。

設定・保存復元・組版・通信なしの一覧取得は `node tests/editor-settings.cjs`、抽出時の入力検証は `python -m unittest discover -s tests -p test_catalog.py` で確認する。機能変更時は単体HTMLを再生成して同じコミットに含める。
