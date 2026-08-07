import { createFileRoute } from '@tanstack/react-router'

import { ConnectionSettings } from '@/components/settings/connection-settings'
import { DemoPanel } from '@/components/settings/demo-panel'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

/**
 * 「設定」タブ。出すのは MQTT の接続設定と dev 用の操作だけ。
 * 接続設定は経路図と全項目を1続きの流れに並べ、コマンド送信とログは
 * 日常的な設定ではないため開発ツール（DemoPanel）側に置いている。
 */
function Settings() {
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-4">
      <h1 className="text-3xl font-bold">設定</h1>

      <ConnectionSettings />

      {/* 本来は外から起きる状態を切り替える操作なので、本番ビルドには残さない。
          載せ替え後は実機へコマンドを送る口になり、鳴動を止める手段を増やしてしまう。 */}
      {import.meta.env.DEV && <DemoPanel />}
    </div>
  )
}
