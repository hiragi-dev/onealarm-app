import { match, P } from 'ts-pattern'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { InfoPopover } from '@/components/common/info-popover'
import { useDemo } from '@/contexts/demo-context'
import { useRunEffect } from '@/lib/effect-react'
import { errorMessage, SensorPermissionError } from '@/lib/errors'

function fmt(n: number | null | undefined): string {
  return match(n)
    .with(P.nullish, () => '—')
    .otherwise((v) => `${v.toFixed(1)}m/s²`)
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-20">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg tabular-nums">{value}</p>
    </div>
  )
}

/**
 * 「設定」タブの歩行検知。加速度センサーの生値と検知状態を表示する。
 * 権限が下りていない場合の見え方は、デモ操作パネルの権限切り替えで確認できる。
 */
export function WalkSensorSettings() {
  const { walkPermission, requestWalkPermission, motion, lastEventAt, isWalking, stepCount } =
    useDemo()
  const run = useRunEffect()

  if (walkPermission === 'denied') {
    return (
      <Alert variant="warning">
        <AlertDescription>
          {errorMessage(new SensorPermissionError({ reason: 'denied' }))}
        </AlertDescription>
      </Alert>
    )
  }

  if (walkPermission === 'prompt') {
    return (
      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">歩行検知を行うには許可が必要です。</p>
          <Button onClick={() => void run(requestWalkPermission)}>歩行検知の利用を許可</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            加速度 (DeviceMotion)
            <InfoPopover>
              上段は重力の影響を除いた値です（端末によっては非対応で常に — になります）。
              下段は重力を含む値で、ほぼ全端末で対応しています。
            </InfoPopover>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">重力除外</p>
            <div className="flex gap-6">
              <Stat label="x" value={fmt(motion?.accelerationX)} />
              <Stat label="y" value={fmt(motion?.accelerationY)} />
              <Stat label="z" value={fmt(motion?.accelerationZ)} />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">重力込み</p>
            <div className="flex gap-6">
              <Stat label="x" value={fmt(motion?.accelerationGravityX)} />
              <Stat label="y" value={fmt(motion?.accelerationGravityY)} />
              <Stat label="z" value={fmt(motion?.accelerationGravityZ)} />
            </div>
          </div>

          <Separator />

          <p className="text-sm text-muted-foreground">
            {match(lastEventAt)
              .with(P.nullish, () => 'まだセンサーデータを受信していません。')
              .otherwise(
                (at) =>
                  `最終受信: ${new Date(at).toLocaleTimeString('ja-JP', { hour12: false })}（数値が変化し続けていれば検知できています）`,
              )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-1">
            歩行検知状態
            <InfoPopover>
              加速度センサーの変動から簡易的に歩行を検知しています。アラームが鳴っている間、
              歩行中はこの検知結果を使って自動的に一時停止します。
            </InfoPopover>
          </CardTitle>
          <Badge
            variant={match(isWalking)
              .with(true, () => 'success' as const)
              .with(false, () => 'secondary' as const)
              .exhaustive()}
          >
            {match(isWalking)
              .with(true, () => '歩行中')
              .with(false, () => '静止中')
              .exhaustive()}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">検知した歩数: {stepCount}</p>
        </CardContent>
      </Card>
    </div>
  )
}
