import * as React from 'react'
import { match } from 'ts-pattern'
import { ChevronDown, Power, RotateCcw, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useDemo } from '@/contexts/demo-context'
import { formatAlarmTime, formatDaysOfWeek } from '@/lib/alarm'
import { useRunEffect } from '@/lib/effect-react'
import { cn } from '@/lib/utils'
import type { BrokerStatus, EdgeDeviceStatus } from '@/lib/app-state'
import {
  brokerStatusOptions,
  edgeStatusOptions,
  DEV_PANEL_NOTE,
  EDGE_RESPONSIVE_HELP,
} from '@/components/settings/settings-shared'

/**
 * dev 用の操作。本来は外から与えられる状態（ブローカー接続・エッジの生存・
 * センサーの権限など）をここから直接動かして、実機を繋がずに各画面の見え方を
 * 確認できるようにしている。
 *
 * 本番の設定と混ざらないよう、開くまで中身を見せない破線の折りたたみにしたうえで、
 * 開いた時だけ warning 色の枠が現れて「別枠」だと分かるようにしている。
 *
 * 中身は「状態を作る → 操作を送る → 結果を見る」の順に3群へ分けた。
 * コマンド送信は送る操作なので2群目、ログは送った結果なので最後に置いている。
 */
export function DemoPanel() {
  const {
    status,
    setStatus,
    edgeStatus,
    setEdgeStatus,
    edgeResponsive,
    setEdgeResponsive,
    alarms,
    ringingStatus,
    startRinging,
    resetDemoData,
    log,
    sendPowerCommand,
  } = useDemo()
  const run = useRunEffect()
  const [open, setOpen] = React.useState(false)

  const isRinging = (ringingStatus?.ringingIds ?? []).length > 0
  const connected = status === 'connected'

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card
        className={cn(
          'gap-0 border-dashed py-0 transition-colors',
          open ? 'border-warning/50 bg-warning/5' : 'border-muted-foreground/30 bg-transparent',
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-xl px-6 py-4 text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
          <Wrench className="size-4 shrink-0 text-warning" />
          <span className="text-sm font-semibold text-warning">開発ツール</span>
          <span className="ml-auto text-xs text-muted-foreground">dev ビルド専用</span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator className="bg-warning/20" />
          <div className="px-6 py-4">
            <p className="text-xs leading-relaxed text-muted-foreground">{DEV_PANEL_NOTE}</p>

            {/* 1. 本来は外から与えられる状態を、ここで作る */}
            <DevGroupHeading>状態を差し替える</DevGroupHeading>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="demo-broker">ブローカー接続状態</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as BrokerStatus)}>
                  <SelectTrigger id="demo-broker">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {brokerStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="demo-edge">エッジデバイスの生存状況</Label>
                <Select
                  value={edgeStatus}
                  onValueChange={(v) => setEdgeStatus(v as EdgeDeviceStatus)}
                >
                  <SelectTrigger id="demo-edge">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {edgeStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Label className="flex items-center justify-between gap-3 font-normal">
                <span className="min-w-0">
                  <span className="block text-sm">エッジが応答する</span>
                  <span className="block text-xs text-muted-foreground">
                    {EDGE_RESPONSIVE_HELP}
                  </span>
                </span>
                <Switch checked={edgeResponsive} onCheckedChange={setEdgeResponsive} />
              </Label>
            </div>

            {/* 2. 作った状態に対して操作を送る */}
            <DevGroupHeading>操作を送る</DevGroupHeading>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>電源コマンド</Label>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                    onClick={() => void run(sendPowerCommand('on'))}
                    disabled={!connected}
                  >
                    <Power />
                    ON
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => void run(sendPowerCommand('off'))}
                    disabled={!connected}
                  >
                    <Power />
                    OFF
                  </Button>
                </div>
                {!connected && (
                  <p className="text-xs text-muted-foreground">
                    接続すると送信できるようになります。
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>アラームを鳴らす</Label>
                {match({ isRinging, alarms })
                  .with({ isRinging: true }, () => (
                    <p className="text-xs text-muted-foreground">
                      鳴動中です。「停止」タブから停止地点への到達で止められます。
                    </p>
                  ))
                  .with({ alarms: [] }, () => (
                    <p className="text-xs text-muted-foreground">アラームが登録されていません。</p>
                  ))
                  .otherwise(({ alarms }) => (
                    <div className="flex flex-col items-start gap-2">
                      {alarms.map((alarm) => (
                        <Button
                          key={alarm.id}
                          variant="outline"
                          size="sm"
                          className="max-w-full"
                          onClick={() => startRinging(alarm.id)}
                        >
                          <span className="truncate">
                            {formatAlarmTime(alarm.time)}（{formatDaysOfWeek(alarm.daysOfWeek)}
                            ）を鳴らす
                          </span>
                        </Button>
                      ))}
                    </div>
                  ))}
              </div>

              <Button variant="ghost" size="sm" onClick={resetDemoData}>
                <RotateCcw />
                ダミーデータを初期状態に戻す
              </Button>
            </div>

            {/* 3. 送った結果を見る */}
            <DevGroupHeading trailing={log.length > 0 ? `${log.length}件` : undefined}>
              ログ
            </DevGroupHeading>
            <pre className="max-h-64 overflow-auto rounded-md border bg-background/40 p-2 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-muted-foreground">
              {match(log)
                .with([], () => '（まだログはありません）')
                .otherwise((entries) => entries.map((e) => `${e.time}  ${e.text}`).join('\n'))}
            </pre>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

/** 開発ツールの中を3群に分けるための小見出し。区切り線は warning 側に寄せる */
function DevGroupHeading({
  children,
  trailing,
}: {
  children: React.ReactNode
  trailing?: string
}) {
  return (
    <div className="flex items-center gap-2 pt-5 pb-2">
      <span className="text-xs font-medium text-foreground">{children}</span>
      <span className="h-px flex-1 bg-warning/20" />
      {trailing && <span className="text-[11px] text-muted-foreground">{trailing}</span>}
    </div>
  )
}
