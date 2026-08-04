import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { SwStatus } from '@/components/pwa/sw-status'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="p-6">
      <p className="text-muted-foreground text-sm">ページが見つかりませんでした。</p>
      <Link to="/" className="text-sm underline underline-offset-4">
        ホームに戻る
      </Link>
    </div>
  ),
})

function RootLayout() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-4 border-b px-4 py-3">
        <span className="font-semibold">OneAlarm</span>
        <nav className="text-muted-foreground flex gap-3 text-sm">
          <Link to="/" className="[&.active]:text-foreground [&.active]:font-medium">
            ホーム
          </Link>
          <Link to="/settings" className="[&.active]:text-foreground [&.active]:font-medium">
            設定
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <SwStatus />
      <InstallPrompt />

      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </div>
  )
}
