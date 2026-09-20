import { match } from 'ts-pattern'
import { Footprints, MapPin } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApp } from '@/contexts/app-context'
import { useRunEffect } from '@/lib/effect-react'
import type { LocationPermission, WalkPermission } from '@/contexts/app-context'

/**
 * 「設定」タブのセンサーの状態。位置情報と歩行検知（加速度）の許可状況を並べる。
 *
 * 許可の要求はここからもできる。特に iOS の歩行検知は操作起点でしか要求できず、
 * 鳴動中の画面にもボタンはあるが、寝起きにダイアログを相手にせずに済むよう
 * 落ち着いているときに済ませられる場所を用意しておく。
 * 歩数と最終受信は「センサーが本当に動いているか」を確かめるための表示。
 */
export function SensorSettings() {
  const {
    locationPermission,
    watching,
    currentPosition,
    startWatching,
    walkPermission,
    requestWalkPermission,
    isWalking,
    stepCount,
    lastEventAt,
  } = useApp()
  const run = useRunEffect()

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="text-sm">センサー</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        <SensorRow
          icon={<MapPin className="size-4" />}
          label="位置情報"
          badge={locationBadge(locationPermission, watching)}
          detail={match(currentPosition)
            .with(null, () => '現在地はまだ取れていません')
            .otherwise((p) => `精度 ±${Math.round(p.accuracy)} m`)}
          action={match(locationPermission)
            .with('prompt', () => (
              <Button size="sm" onClick={() => void run(startWatching)}>
                許可
              </Button>
            ))
            .otherwise(() => null)}
        />
        <SensorRow
          icon={<Footprints className="size-4" />}
          label="歩行検知"
          badge={walkBadge(walkPermission, isWalking)}
          detail={match(lastEventAt)
            .with(null, () => 'センサーの値はまだ届いていません')
            .otherwise(
              (at) =>
                `${stepCount} 歩 ・ 最終受信 ${new Date(at).toLocaleTimeString('ja-JP', { hour12: false })}`,
            )}
          action={match(walkPermission)
            .with('prompt', () => (
              <Button size="sm" onClick={() => void run(requestWalkPermission)}>
                許可
              </Button>
            ))
            .otherwise(() => null)}
        />
      </CardContent>
    </Card>
  )
}

function locationBadge(permission: LocationPermission, watching: boolean) {
  return match({ permission, watching })
    .with({ permission: 'granted', watching: true }, () => <Badge variant="success">取得中</Badge>)
    .with({ permission: 'granted' }, () => <Badge variant="neutral">停止中</Badge>)
    .with({ permission: 'prompt' }, () => <Badge variant="warning">未許可</Badge>)
    .with({ permission: 'denied' }, () => <Badge variant="destructive">拒否</Badge>)
    .with({ permission: 'unsupported' }, () => <Badge variant="destructive">非対応</Badge>)
    .with({ permission: 'insecure' }, () => <Badge variant="destructive">HTTPS が必要</Badge>)
    .exhaustive()
}

function walkBadge(permission: WalkPermission, isWalking: boolean) {
  return match({ permission, isWalking })
    .with({ permission: 'granted', isWalking: true }, () => <Badge variant="success">歩行中</Badge>)
    .with({ permission: 'granted' }, () => <Badge variant="neutral">静止中</Badge>)
    .with({ permission: 'prompt' }, () => <Badge variant="warning">未許可</Badge>)
    .with({ permission: 'denied' }, () => <Badge variant="destructive">拒否</Badge>)
    .with({ permission: 'unsupported' }, () => <Badge variant="destructive">非対応</Badge>)
    .with({ permission: 'insecure' }, () => <Badge variant="destructive">HTTPS が必要</Badge>)
    .exhaustive()
}

function SensorRow({
  icon,
  label,
  badge,
  detail,
  action,
}: {
  icon: React.ReactNode
  label: string
  badge: React.ReactNode
  detail: string
  action: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">{label}</span>
          {badge}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      {action}
    </div>
  )
}
