# GitHub Pages 公開の記録

## 初版のレビュー用公開

- URL: https://sabmwqes.github.io/memoaize/
- PR: https://github.com/sabmwqes/memoaize/pull/1
- デプロイ元: `feat/initial-study-app` の `810be54f7dd0e815c19948f3afcff2f011d7945b`
- 実行コマンド: `npm run deploy`
- 生成物のブランチ: `gh-pages`
- 生成物のコミット: `085e01b6edbb57366dc2b0184915dafe57dc6c61`
- Pages ワークフロー: https://github.com/sabmwqes/memoaize/actions/runs/39796303787
- 更新前の生成物: `56f6be4036126878f1cc8db6051385be4dc947bf`

ビルドと `gh-pages` への push は成功。公開用 `index.html` がローカルのビルドと一致することを確認した。
Pages 側の最終的な配信状態は、上記ワークフローの結果を参照する。

## 今回の方針

利用者の指示により、初版の動作レビューでは既存の公開 URL を更新する。
PR のマージ前に公開し、レビューと修正を継続する。マージとデプロイは別の操作として扱う。

現時点では本番と開発用の配信環境を分けていない。基本的に自分用として、この構成で試す。
単語帳と学習記録はサーバーには送信せず、使用しているブラウザの `localStorage` に保存する。

同じ公開先を更新した場合は同じ保存キーを使う。重要なデータは JSON バックアップを保存する。
将来 PR 専用のプレビューを追加するときは、配信 URL に加え保存キーまたはオリジンの分離も検討する。
