import { match, P } from 'ts-pattern'
import { BellOff, MapPin } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { WalkStatus } from '@/components/stop/walk-status'
import { useDemo } from '@/contexts/demo-context'
import { useAppReadiness } from '@/hooks/use-app-readiness'
import { useRunEffect } from '@/lib/effect-react'
import { blockReasonLabel } from '@/lib/app-state'
import { distanceMeters, formatDistance } from '@/lib/geo'

/**
 * 「停止」タブの「アラームを止める」。アラームごとに設定された停止方法（位置情報）への
 * 到達状況を表示する。実際の送信・到達判定は ArrivalStopBridge が担う。
 *
 * このアプリは「設定した停止地点に到達するまで確実に止められない」ことを意図しているため、
 * 手動で止めるボタンなどのフェイルセーフはここに置かず、状況表示のみを行う。
 * 複数アラームが同時に鳴動している場合は先頭の1件だけを表示する（簡易表示）。
 */
export function StopAlarmControl() {
  const {
    alarms,
    ringingStatus,
    stopMethods,
    currentPosition,
    simulatedPosition,
    setSimulatedPosition,
    sendStopCommand,
  } = useDemo()
  const { alarmManagement } = useAppReadiness()
  const run = useRunEffect()

  // 疑似現在地が設定されていれば表示上の距離もそちらに合わせ、
  // ArrivalStopBridge の到達判定と食い違わないようにする
  const effectivePosition = simulatedPosition ?? currentPosition

  const ringingIds = ringingStatus?.ringingIds ?? []
  const isRinging = ringingIds.length > 0

  // 鳴動中の先頭1件と、それに割り当てられた停止方法をたどる。
  // どちらも「無い」ことがふつうに起きるので、段階ごとに undefined を潰しておく
  const ringingAlarm = alarms.find((a) => a.id === ringingIds[0])
  const stopMethod = stopMethods.find((m) => m.id === ringingAlarm?.stopMethodId)

  const distanceToTarget = match({ stopMethod, effectivePosition })
    .with({ stopMethod: P.nonNullable, effectivePosition: P.nonNullable }, (m) =>
      distanceMeters(m.effectivePosition, m.stopMethod),
    )
    .otherwise(() => null)

  const hasArrived = match({ distanceToTarget, stopMethod })
    .with(
      { distanceToTarget: P.number, stopMethod: P.nonNullable },
      (m) => m.distanceToTarget <= m.stopMethod.radiusMeters,
    )
    .otherwise(() => false)

  return (
    <div className="relative h-full">
      <div className="space-y-5">
        {alarmManagement.kind === 'blocked' && (
          <Alert variant="warning">
            <AlertDescription>
              {alarmManagement.reasons.map(blockReasonLabel).join(' / ')}
            </AlertDescription>
          </Alert>
        )}

        {/* 歩行検知状況。鳴動中に一番大きく出す */}
        <WalkStatus />

        {stopMethod && (
          <Card>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4 text-primary" />
                停止方法: {stopMethod.label} まで
              </div>
              {match(distanceToTarget)
                // 初回測位には数秒かかることがあるため、待機中であることを明示する
                .with(null, () => (
                  <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    現在地を取得しています…
                  </div>
                ))
                .otherwise((meters) => (
                  <p className="text-3xl font-semibold tabular-nums">{formatDistance(meters)}</p>
                ))}
              {hasArrived && (
                <Alert variant="success">
                  <AlertDescription>
                    停止地点に到達しました。まもなく自動的に停止します。
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {isRinging && !stopMethod && (
          <Alert variant="warning">
            <AlertDescription>
              このアラームには位置情報の停止方法が設定されていないため、自動的に停止できません。
              「アラーム」タブで停止方法を設定してください。
            </AlertDescription>
          </Alert>
        )}

        {/* 実際に停止地点まで移動せずに到達検知フローを試すためのデバッグ操作。
            疑似現在地は ArrivalStopBridge が停止を確認でき次第、自動的に解除する。 */}
        {import.meta.env.DEV && isRinging && (
          <Card className="border-dashed border-warning/50">
            <CardContent className="space-y-3">
              <p className="text-xs font-bold text-warning">開発用（本番ビルドには含まれません）</p>
              <div className="flex flex-col items-start gap-2">
                {stopMethod && (
                  <Button
                    variant="outline"
                    disabled={!!simulatedPosition}
                    onClick={() =>
                      setSimulatedPosition({ lat: stopMethod.lat, lng: stopMethod.lng })
                    }
                  >
                    この停止方法の位置まで移動したことにする
                  </Button>
                )}
                {/* 到達判定を経由せずに鳴動を止める強制停止。
                    停止方法が未設定のアラームでも試せるよう常に出す */}
                <Button variant="outline" onClick={() => void run(sendStopCommand)}>
                  強制停止（stop コマンドを直接送信）
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* アラームが鳴っていない場合のオーバーレイ */}
      {!isRinging && (
        <div className="absolute -inset-4 z-10 flex items-center justify-center rounded-3xl bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[rgba(28,28,30,0.85)] px-6 py-10 text-center shadow-2xl backdrop-blur-xl">
            <div className="mb-5 inline-flex rounded-full bg-white/7 p-5 text-white/40">
              <BellOff className="size-10" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-white/85">現在アラームは鳴っていません</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              アラームが鳴り始めると、
              <br />
              ここで停止操作ができます。
            </p>
            {ringingStatus === null && (
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
                <Spinner className="size-3" />
                エッジデバイスから鳴動状況を取得しています…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
