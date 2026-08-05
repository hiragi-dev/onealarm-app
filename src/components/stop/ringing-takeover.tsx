import { match } from 'ts-pattern'
import { BellRing, MapPin } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { WalkStatus } from '@/components/stop/walk-status'
import { useDemo } from '@/contexts/demo-context'
import { useAppReadiness } from '@/hooks/use-app-readiness'
import { useRunEffect } from '@/lib/effect-react'
import { blockReasonLabel } from '@/lib/app-state'
import { formatDistance } from '@/lib/geo'
import { deriveRingingView, type RingingTarget } from '@/lib/ringing-view'

/**
 * 鳴動中だけ画面全体（下部ナビも含む）を覆う停止画面。
 *
 * 「アラームを止める」操作は実際に鳴っているときにしか使わないため、
 * 平常時はどこにも置かず、鳴り始めた瞬間にアプリ全体をこの画面で覆う。
 * 鳴っている＝最優先という状況なので、他タブへ逃げられる余地を残さず、
 * 到達して自動停止するまでこの画面だけを見せる。
 *
 * このアプリは「設定した停止地点に到達するまで確実に止められない」ことを意図しているため、
 * 手動で止めるボタンなどのフェイルセーフはここに置かず、状況表示のみを行う。
 *
 * 「何を描くか」の判断は lib/ringing-view.ts の純粋関数に切り出してあり、
 * ここはその判別可能ユニオンを網羅描画するだけ（描画漏れはコンパイルで落ちる）。
 */
export function RingingTakeover() {
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
  const position = simulatedPosition ?? currentPosition

  const view = deriveRingingView({ ringingStatus, alarms, stopMethods, position })

  return match(view)
    // 鳴っていなければ何も描かない。平常時はこの画面自体が存在しない
    .with({ kind: 'silent' }, () => null)
    .with({ kind: 'ringing' }, ({ target }) => (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(10,10,12,0.97)] backdrop-blur-xl animate-in fade-in-0">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 pt-10 pb-10">
          {/* 鳴動中であることの見出し */}
          <div className="flex items-center gap-2 text-warning">
            <BellRing className="size-5 animate-pulse" />
            <span className="text-sm font-bold tracking-wide">アラームが鳴っています</span>
          </div>

          {alarmManagement.kind === 'blocked' && (
            <Alert variant="warning">
              <AlertDescription>
                {alarmManagement.reasons.map(blockReasonLabel).join(' / ')}
              </AlertDescription>
            </Alert>
          )}

          {/* 歩行検知状況。鳴動中に一番大きく出す */}
          <WalkStatus />

          <StopTarget target={target} />

          {/* 実際に停止地点まで移動せずに到達検知フローを試すためのデバッグ操作。
              疑似現在地は ArrivalStopBridge が停止を確認でき次第、自動的に解除する。 */}
          {import.meta.env.DEV && (
            <Card className="border-dashed border-warning/50">
              <CardContent className="space-y-3">
                <p className="text-xs font-bold text-warning">
                  開発用（本番ビルドには含まれません）
                </p>
                <div className="flex flex-col items-start gap-2">
                  {target.kind === 'with-method' && (
                    <Button
                      variant="outline"
                      disabled={!!simulatedPosition}
                      onClick={() =>
                        setSimulatedPosition({
                          lat: target.stopMethod.lat,
                          lng: target.stopMethod.lng,
                        })
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
      </div>
    ))
    .exhaustive()
}

/** 停止方法の有無で分かれる中身。判別可能ユニオンを網羅描画する */
function StopTarget({ target }: { target: RingingTarget }) {
  return match(target)
    .with({ kind: 'with-method' }, (t) => (
      <Card>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4 text-primary" />
            停止方法: {t.stopMethod.label} まで
          </div>
          {match(t.distanceToTarget)
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
          {t.hasArrived && (
            <Alert variant="success">
              <AlertDescription>
                停止地点に到達しました。まもなく自動的に停止します。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    ))
    .with({ kind: 'no-method' }, () => (
      <Alert variant="warning">
        <AlertDescription>
          このアラームには位置情報の停止方法が設定されていないため、自動的に停止できません。
          「アラーム」タブで停止方法を設定してください。
        </AlertDescription>
      </Alert>
    ))
    .exhaustive()
}
