# Agents カスタム指示

このリポジトリ特有の背景情報や取り組み方針として明記するべき重要なことについては、適宜ここに追記/編集してください。

- 自分用の暗記アプリ。主な端末はスマホ。GitHub Pages で静的に配信し、データはブラウザの `localStorage`（キー `memoaize.library.v1`）に保存する。
- データ形式（Library v1）は PR #1 と互換に保つ。項目を足すときは、古いバックアップも読めるよう既定値で補う（例: `settings.loop`）。
- デザインの考え方と用語（WEAK = 苦手、AGAIN、OK、COMPILATION）は `docs/design.md`。黒基調・角丸なし・高コントラスト・虹色の差し色、表記は英語中心で説明は日本語。
- 変更の確認は `npm test`、`npm run lint`、`npm run build`。
