# 同梱データと外部依存

## G-Force UI

参照プロジェクト： https://github.com/tkcanta/gforce-ui

使用版：ユーザーの保存済み `gforce-ui-v1.0.0.zip` から取得した1.0.0のビルド済みCSS/JavaScript。参照先リポジトリの最新バージョンを丸ごと同梱したものではありません。

変更点：JavaScriptのmodule exportをclassic-scriptラッパーへ変更。localStorageが利用できない場合でもUIの初期化を止めないためのアダプターを追加。UI固有の追加CSSはstyles.cssへ分離。

ライセンス全文：vendor/GFORCE-LICENSE.txt。単体HTMLにもライセンスコメントを含めています。

## Citrusロゴ

ユーザーが提示したCitrusロゴPNGをassets.jsへ埋め込みました。再デザインしたサービスロゴではありません。サムネイル内のロゴに使用します。

## フォント

Noto Serif JP 900 / Noto Sans JP 900をGoogle Fontsから実行時に読み込みます。フォントバイナリは同梱・埋め込みしていません。手動指定したフォントもプロジェクトファイルへ含めません。

## ゲーム素材

ゲーム画像本体は同梱していません。2026年9月5日に https://gamers-hack.com/tftimg/set-18/ から抽出した画像URL・名前4,844件を `catalog.js` に収録しています。画像配信元は https://github.com/noxelisdev/TFT_DDragon です。提供元の利用案内をご確認ください。
