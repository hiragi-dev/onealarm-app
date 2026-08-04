import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePwaInstall } from '@/hooks/use-pwa-install'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { installed, platform } = usePwaInstall()

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>セットアップ完了</CardTitle>
          <CardDescription>
            Vite + React + TanStack Router + shadcn/ui + PWA
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-1 text-sm">
          <p>プラットフォーム: {platform}</p>
          <p>表示モード: {installed ? 'standalone（インストール済み）' : 'ブラウザ'}</p>
        </CardContent>
      </Card>
    </div>
  )
}
