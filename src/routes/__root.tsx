import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

import { BottomNav } from '@/components/layout/bottom-nav'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { SwStatus } from '@/components/pwa/sw-status'
import { ArrivalStopBridge } from '@/components/stop/arrival-stop-bridge'
import { RingingTakeover } from '@/components/stop/ringing-takeover'
import { WalkPauseBridge } from '@/components/stop/walk-pause-bridge'
import { WalkUnlockBridge } from '@/components/stop/walk-unlock-bridge'
import { AppProvider } from '@/contexts/app-provider'
import { NotificationProvider } from '@/contexts/notification-provider'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="p-6">
      <p className="text-sm text-muted-foreground">ページが見つかりませんでした。</p>
      <Link to="/" className="text-sm underline underline-offset-4">
        ホームに戻る
      </Link>
    </div>
  ),
})

/**
 * 全画面共通のレイアウト。
 *
 * NotificationProvider を AppProvider より外側に置いているのは、
 * ストアの操作が失敗したときの通知（useRunEffect 経由）を
 * どのタブからでも同じ場所に出せるようにするため。
 */
function RootLayout() {
  return (
    <NotificationProvider>
      <AppProvider>
        {/* 画面を持たない常駐処理: 停止地点への到達を監視して自動停止する */}
        <ArrivalStopBridge />
        {/* 同じく常駐処理: 「歩行検知を有効にする地点」への到達を監視して解除する */}
        <WalkUnlockBridge />
        {/* 歩いている間、デバイスへ一時停止を送り続ける */}
        <WalkPauseBridge />
        {/* 鳴動中だけアプリ全体を覆う停止画面 */}
        <RingingTakeover />

        <div className="flex h-full flex-col overflow-hidden">
          {/* タブ切り替えの View Transition で動かすのはここだけ。下部ナビは据え置く */}
          <main className="min-h-0 flex-1 overflow-hidden [view-transition-name:page]">
            <div className="mx-auto flex h-full max-w-md flex-col px-4 pt-6 pb-2">
              <Outlet />
            </div>
          </main>

          <BottomNav />
        </div>

        <SwStatus />
        <InstallPrompt />
      </AppProvider>
    </NotificationProvider>
  )
}
