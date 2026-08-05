import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { RingingBanner } from '@/components/common/ringing-banner'
import { BottomNav } from '@/components/layout/bottom-nav'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { SwStatus } from '@/components/pwa/sw-status'
import { ArrivalStopBridge } from '@/components/stop/arrival-stop-bridge'
import { DemoProvider } from '@/contexts/demo-provider'
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
 * NotificationProvider を DemoProvider より外側に置いているのは、
 * ストアの操作が失敗したときの通知（useRunEffect 経由）を
 * どのタブからでも同じ場所に出せるようにするため。
 */
function RootLayout() {
  return (
    <NotificationProvider>
      <DemoProvider>
        {/* 画面を持たない常駐処理: 停止地点への到達を監視して自動停止する */}
        <ArrivalStopBridge />
        <RingingBanner />

        <div className="flex h-full flex-col overflow-hidden">
          <main className="min-h-0 flex-1 overflow-hidden">
            <div className="mx-auto flex h-full max-w-md flex-col px-4 pt-6 pb-2">
              <Outlet />
            </div>
          </main>

          <BottomNav />
        </div>

        <SwStatus />
        <InstallPrompt />

        {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
      </DemoProvider>
    </NotificationProvider>
  )
}
