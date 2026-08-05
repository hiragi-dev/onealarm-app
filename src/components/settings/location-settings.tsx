import { match } from 'ts-pattern'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDemo } from '@/contexts/demo-context'
import { useRunEffect } from '@/lib/effect-react'
import { errorMessage, LocationUnavailableError } from '@/lib/errors'

/**
 * 「設定」タブの位置情報。取得の許可状況の確認と取得開始だけを扱う。
 * 「どこで止めるか」の登録・管理は「停止」タブの「停止方法」で行う。
 */
export function LocationSettings() {
  const { locationPermission, watching, startWatching, currentPosition } = useDemo()
  const run = useRunEffect()

  // 取得できない状態はエラー型として持ち、文言は errors.ts に集約する
  const blocked = match(locationPermission)
    .with('granted', 'prompt', () => null)
    .otherwise((reason) => new LocationUnavailableError({ reason }))

  return (
    <div className="space-y-5">
      {blocked && (
        <Alert variant="warning">
          <AlertDescription>{errorMessage(blocked)}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>現在地</CardTitle>
          {watching && <Badge variant="success">取得中</Badge>}
        </CardHeader>
        <CardContent className="space-y-3">
          {!watching && (
            <Button onClick={() => void run(startWatching)} disabled={!!blocked}>
              位置情報の取得を開始
            </Button>
          )}

          {currentPosition && (
            <p className="text-sm tabular-nums text-muted-foreground">
              緯度: {currentPosition.lat.toFixed(6)} / 経度: {currentPosition.lng.toFixed(6)}
              （精度: 約{currentPosition.accuracy.toFixed(0)}m）
            </p>
          )}
        </CardContent>
      </Card>

      <Alert variant="info">
        <AlertDescription>
          アラームを止める地点の登録は、「停止」タブの「停止方法」から行えます。
        </AlertDescription>
      </Alert>
    </div>
  )
}
