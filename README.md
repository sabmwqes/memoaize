# memoaize 🗿

単語帳をつくって、刻むように覚える。自分用の暗記アプリ。

公開先: https://sabmwqes.github.io/memoaize/

## 開発

```sh
npm ci
npm run dev     # 開発サーバー
npm test        # ドメインロジックのテスト
npm run lint
npm run build
```

`VITE_SEED_SAMPLE=1 npm run build` で、保存データが空のときにサンプルの単語帳が入った状態で開くビルドを作れます（見た目の確認用）。

データは使っているブラウザの中（`localStorage`）だけに保存します。別の端末へ移すときや、ブラウザのデータ削除に備えて、右上の「…」から JSON でバックアップしてください。

## ドキュメント

- [デザインメモ](./docs/design.md)
- [初期の構想](./docs/project-brainstorm.md)
