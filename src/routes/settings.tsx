import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

function Settings() {
  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>設定</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          ルーティング動作確認用のページです。
        </CardContent>
      </Card>
    </div>
  )
}
