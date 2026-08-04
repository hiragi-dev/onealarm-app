# OneAlarm

Vite + React + TanStack Router + shadcn/ui + TypeScript の PWA。

## コマンド

| コマンド            | 内容                                             |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | 開発サーバー（Service Worker も有効）            |
| `npm run build`     | 型チェック + 本番ビルド（`dist/`）               |
| `npm run preview`   | 本番ビルドのプレビュー                           |
| `npm run typecheck` | 型チェックのみ                                   |
| `npm run lint`      | ESLint                                           |
| `npm run icons`     | `public/` の PWA アイコンを再生成                |

## 構成

```
src/
  main.tsx                     エントリ（router 生成 / 型登録）
  routeTree.gen.ts             自動生成。手で編集しない
  routes/                      ファイルベースルーティング
    __root.tsx                 共通レイアウト
    index.tsx                  /
    settings.tsx               /settings
  components/
    ui/                        shadcn/ui（`npx shadcn@latest add <name>` で追加）
    pwa/
      install-prompt.tsx       ホーム画面追加の案内バナー
      sw-status.tsx            Service Worker 登録と状態表示
  hooks/use-pwa-install.ts     beforeinstallprompt / standalone 判定
  lib/platform.ts              iOS / Android / standalone の判別
  index.css                    Tailwind v4 + shadcn テーマ変数
scripts/generate-icons.mjs     依存なしの PNG アイコン生成
```

ルートを追加するときは `src/routes/` にファイルを置くだけで、
`@tanstack/router-plugin` が `routeTree.gen.ts` を更新する。

## PWA まわりのメモ

- `registerType: 'autoUpdate'` で SW を自動更新する。登録は `SwStatus`
  （`virtual:pwa-register/react`）が行うため、`injectRegister` は `null`。
- `devOptions.enabled: true` なので `npm run dev` でも SW が動く。
  挙動を初期化したいときは DevTools > Application > Service Workers から unregister する。
- iOS では `beforeinstallprompt` が発火しないので、`InstallPrompt` は
  「共有 → ホーム画面に追加」の手順を出す。Android / デスクトップ Chromium では
  ネイティブのインストールダイアログを出す。
- インストールを促すのは、Safari のタブのままだと 7 日間未使用でスクリプト由来の
  データが消えること、および Safari と PWA でストレージが分離していて後から
  移行できないことへの対策（`TODO.md` 参照）。

## 補足

TypeScript は 5.9 系に固定している。TypeScript 7 は `typescript-eslint` が
まだ peer 対応していないため（対応後は上げてよい）。
