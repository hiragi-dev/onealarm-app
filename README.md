# OneAlarm

Vite + React + TanStack Router + shadcn/ui + Effect + TypeScript の PWA。

旧実装（Next.js + MUI + MQTT の
[eager-alarm-app](https://github.com/hiragi-dev/eager-alarm-app)）から
**UI だけ**を移植したもの。エッジデバイスにもブローカーにも接続せず、
状態はすべて `src/lib/dummy-data.ts` を初期値としてメモリ上で完結する。
実機との接続とテストは未着手。

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
  routes/                      ファイルベースルーティング（下部ナビの3タブ）
    __root.tsx                 Provider・常駐処理・下部ナビ
    index.tsx                  /          アラーム一覧
    stop.tsx                   /stop      停止（サブタブで停止方法の管理）
    settings.tsx               /settings  接続・位置情報・歩行検知・デモ操作
  contexts/
    demo-context.ts            ストアの型と useDemo（実装と分離）
    demo-provider.tsx          MQTT/GPS/センサーをダミー化したアプリ状態
    notification-context.ts    useNotify
    notification-provider.tsx  通知ポップアップ（キュー方式）
  components/
    alarm/alarm-control.tsx    アラーム一覧と追加/編集/削除ダイアログ
    stop/
      stop-alarm-control.tsx   停止地点への到達状況の表示
      stop-method-settings.tsx 停止方法（位置情報）の登録・編集
      arrival-stop-bridge.tsx  到達を監視して自動停止する常駐処理（画面なし）
    settings/                  接続設定・位置情報・歩行検知・デモ操作パネル
    map/location-picker-map.tsx  Leaflet の地点選択・半径調整
    layout/bottom-nav.tsx      下部の3タブ
    common/                    情報ポップオーバー・鳴動バナー
    ui/                        shadcn/ui（`npx shadcn@latest add <name>` で追加）
    pwa/
      install-prompt.tsx       ホーム画面追加の案内バナー
      sw-status.tsx            Service Worker 登録と状態表示
  lib/
    errors.ts                  タグ付きエラーと利用者向け文言（Match で網羅）
    effect-react.ts            Effect を React から実行する（失敗→通知）
    validation.ts              Schema によるフォーム検証
    alarm.ts / stop-method.ts / geo.ts / app-state.ts   ドメイン型と純粋関数
    dummy-data.ts              UI確認用の初期データ
    platform.ts                iOS / Android / standalone の判別
  hooks/
    use-app-readiness.ts       接続状況から操作可否を導出
    use-pwa-install.ts         beforeinstallprompt / standalone 判定
  index.css                    Tailwind v4 + shadcn テーマ変数
scripts/generate-icons.mjs     依存なしの PNG アイコン生成
```

ルートを追加するときは `src/routes/` にファイルを置くだけで、
`@tanstack/router-plugin` が `routeTree.gen.ts` を更新する。

## エラーハンドリング（Effect）

失敗しうる操作は、例外や `null` ではなく `Effect` のエラーチャネルで表す。

- `lib/errors.ts` … 失敗の種類を `Data.TaggedError` で定義する。UI に出す文言は
  `errorMessage()` に集約し、`Match.exhaustive` なので種類を足すと文言の
  付け忘れがコンパイルエラーになる。
- `contexts/demo-provider.tsx` … 「未接続」「鳴動中」「エッジが応答しない」を
  ガードとして Effect に載せる。応答待ちは `Effect.timeoutFail` で
  `EdgeTimeoutError` に変えるため、画面側は待ち時間のタイマーを持たない。
- `lib/validation.ts` … 入力欄の文字列からドメインの型への変換を `Schema` で
  定義し、失敗は `ValidationError`（どの欄で落ちたかを保持）に翻訳する。
- `lib/effect-react.ts` … `useRunEffect()` が実行し、失敗は通知に、想定外の欠陥は
  コンソールと汎用文言に振り分ける。アンマウント時は中断するので、
  中断は失敗として扱わない。

画面側は「検証 → 送信」を1本の Effect につないで実行し、成功したときの処理
（ダイアログを閉じるなど）だけを書けばよい。

## ダミーデータでの動作確認

「設定」タブ下部の**デモ操作**パネルから、本来は外から起きる状態を切り替えられる。

- ブローカー接続状態 / エッジの生存状況 … 未接続・オフライン時のオーバーレイ
- エッジが応答する … 切るとタイムアウトの通知を確認できる
- 位置情報・歩行検知の許可 … 拒否・非対応時の表示
- アラームを鳴らす … 鳴動バナーと「停止」タブの到達判定

「停止」タブの開発用ボタンで、実際に移動せず停止地点への到達を再現できる。

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
