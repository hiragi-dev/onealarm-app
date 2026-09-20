import * as React from 'react'
import { match } from 'ts-pattern'
import { ChevronDown, RotateCcw, Unplug, Wrench } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useApp } from '@/contexts/app-context'
import { formatAlarmTime, formatDaysOfWeek } from '@/lib/alarm'
import { cn } from '@/lib/utils'
import {
  BROKER_REACHABLE_HELP,
  DEMO_ENABLED_HELP,
  DEV_PANEL_NOTE,
  EDGE_RESPONSIVE_HELP,
} from '@/components/settings/settings-shared'

/**
 * dev 用の操作。本物の MQTT の代わりにアプリ内の偽のデバイス（lib/edge/fake-edge.ts）へ
 * 繋ぎ、その振る舞い（ブローカーに届くか・エッジが応答するか・鳴り出す）を外から動かして、
 * 実機を繋がずに各画面の見え方を確認できるようにしている。
 *
 * 状態を直接書き換える口は持たない。「接続済み」「オフライン」といった状態は
 * 通信層が返事の有無から導くもので、ここが勝手に書き換えると本物と食い違う。
 * 代わりに偽のデバイスの振る舞いを変えて、状態はいつもどおり導かせる。
 *
 * 本番の設定と混ざらないよう、開くまで中身を見せない破線の折りたたみにしたうえで、
 * 開いた時だけ warning 色の枠が現れて「別枠」だと分かるようにしている。
 */
export function DemoPanel() {
  const { status, alarms, ringingStatus, log, demo } = useApp()
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
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-3xl px-6 py-4 text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
          <Wrench className="size-4 shrink-0 text-warning" />
          <span className="text-sm font-extrabold text-warning">開発ツール</span>
          <Badge variant="warning" className="ml-auto">
            dev ビルド専用
          </Badge>
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

            <DevGroupHeading>デモのデバイス</DevGroupHeading>
            <div className="space-y-4">
              <ToggleRow
                label="デモのデバイスに繋ぐ"
                help={DEMO_ENABLED_HELP}
                checked={demo.enabled}
                onCheckedChange={demo.setEnabled}
              />

              {demo.enabled && (
                <>
                  <ToggleRow
                    label="ブローカーに届く"
                    help={BROKER_REACHABLE_HELP}
                    checked={demo.brokerReachable}
                    onCheckedChange={demo.setBrokerReachable}
                  />
                  <ToggleRow
                    label="エッジが応答する"
                    help={EDGE_RESPONSIVE_HELP}
                    checked={demo.edgeResponsive}
                    onCheckedChange={demo.setEdgeResponsive}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={demo.dropConnection}
                    disabled={!connected}
                  >
                    <Unplug />
                    通信を切る
                  </Button>
                </>
              )}
            </div>

            {demo.enabled && (
              <>
                <DevGroupHeading>アラームを鳴らす</DevGroupHeading>
                <div className="space-y-4">
                  {match({ isRinging, connected, alarms })
                    .with({ connected: false }, () => (
                      <p className="text-xs text-muted-foreground">接続すると鳴らせます。</p>
                    ))
                    .with({ isRinging: true }, () => (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="destructive">鳴動中</Badge>
                        停止地点への到達で止められます。
                      </div>
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
                            onClick={() => demo.startRinging(alarm.id)}
                          >
                            <span className="truncate">
                              {formatAlarmTime(alarm.time)}（{formatDaysOfWeek(alarm.daysOfWeek)}
                              ）を鳴らす
                            </span>
                          </Button>
                        ))}
                      </div>
                    ))}

                  <Button variant="ghost" size="sm" onClick={demo.reset}>
                    <RotateCcw />
                    初期状態に戻す
                  </Button>
                </div>
              </>
            )}

            <DevGroupHeading
              trailing={match(log.length)
                .with(0, () => undefined)
                .otherwise((n) => `${n}件`)}
            >
              ログ
            </DevGroupHeading>
            <pre className="max-h-64 overflow-auto rounded-2xl border bg-background/40 p-3 font-mono text-[11px] leading-relaxed font-normal break-all whitespace-pre-wrap text-muted-foreground">
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

function ToggleRow({
  label,
  help,
  checked,
  onCheckedChange,
}: {
  label: string
  help: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Label className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-muted-foreground">{help}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </Label>
  )
}

/** 開発ツールの中を群に分けるための小見出し。区切り線は warning 側に寄せる */
function DevGroupHeading({
  children,
  trailing,
}: {
  children: React.ReactNode
  trailing?: string
}) {
  return (
    <div className="flex items-center gap-2 pt-5 pb-2">
      <span className="text-xs text-foreground">{children}</span>
      <span className="h-px flex-1 bg-warning/20" />
      {trailing && <Badge variant="neutral">{trailing}</Badge>}
    </div>
  )
}
