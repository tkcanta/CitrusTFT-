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

外部のゲーム画像・TFT全素材カタログは同梱していません。ユーザーが画像を読み込む仕組みと、指定サイトの画像一覧取得アダプターを実装しています。提供元の利用案内をご確認ください。
