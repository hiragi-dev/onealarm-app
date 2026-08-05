import * as React from 'react'
import { match } from 'ts-pattern'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useDemo } from '@/contexts/demo-context'
import { useRunEffect } from '@/lib/effect-react'
import { cn } from '@/lib/utils'
import {
  brokerStatusMeta,
  edgeStatusMeta,
  mqttFields,
  toneBgClass,
  toneTextClass,
} from '@/components/settings/settings-shared'

/**
 * 「設定」タブの接続設定。
 *
 * 「今どうなっているか」を画面でいちばん大きい要素にし、その真下に
 * 「どこに繋いでいるか」（一段沈んだ面の中に畳んである）、「繋ぐ/切る」の順に置く。
 * 接続先の4項目はエッジの状態と同じ面に並ぶ1行として畳んであるので、
 * 開いたときもカードの内側の情報だと分かる。
 *
 * 日常的な設定ではないコマンド送信とログは DemoPanel（開発ツール）側にある。
 */
export function ConnectionSettings() {
  const { settings, updateSetting, status, edgeStatus, connect, disconnect } = useDemo()
  const run = useRunEffect()

  const meta = brokerStatusMeta[status]
  const edgeMeta = edgeStatusMeta[edgeStatus]
  const connected = status === 'connected'
  const editable = status === 'disconnected'
  const configured = Boolean(settings.brokerUrl && settings.deviceId)

  // 接続先が未入力のうちは畳んでいても仕方がないので開いた状態から始める
  const [fieldsOpen, setFieldsOpen] = React.useState(!configured)

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          ブローカー
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* いちばん大きい要素 = 現在の接続状態 */}
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'size-3 shrink-0 rounded-full',
              toneBgClass[meta.tone],
              status === 'connecting' && 'animate-pulse',
            )}
          />
          <span className={cn('text-2xl font-semibold', toneTextClass[meta.tone])}>
            {meta.label}
          </span>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">{meta.description}</p>

        {/* 状態に付随する情報。一段沈んだ面に置いてカードの内側だと分かるようにする */}
        <div className="divide-y divide-border overflow-hidden rounded-md bg-muted/40">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-muted-foreground">エッジデバイス</span>
            <span className={cn('text-sm font-medium', toneTextClass[edgeMeta.tone])}>
              {edgeMeta.label}
            </span>
          </div>

          <Collapsible open={fieldsOpen} onOpenChange={setFieldsOpen}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
              <span className="shrink-0 text-sm text-muted-foreground">接続先</span>
              <span className="ml-auto truncate text-sm font-medium">
                {settings.deviceId || '未設定'}
              </span>
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform',
                  fieldsOpen && 'rotate-180',
                )}
              />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="space-y-4 border-t border-border px-3 pt-3 pb-4">
                {mqttFields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`mqtt-${field.key}`} className="text-xs">
                      {field.label}
                    </Label>
                    <Input
                      id={`mqtt-${field.key}`}
                      type={field.type}
                      value={settings[field.key]}
                      onChange={(e) => updateSetting(field.key, e.target.value)}
                      disabled={!editable}
                      placeholder={field.placeholder}
                      autoComplete="off"
                      className="bg-background"
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">{field.help}</p>
                  </div>
                ))}
                {!editable && (
                  <p className="text-xs text-muted-foreground">
                    接続中は変更できません。切断してから編集してください。
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => void run(connect)}
            disabled={status === 'connecting' || connected || !configured}
          >
            {status === 'connecting' && <Spinner className="size-4" />}
            {match(status)
              .with('connecting', () => '接続中…')
              .otherwise(() => '接続')}
          </Button>
          <Button variant="outline" onClick={disconnect} disabled={status === 'disconnected'}>
            切断
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
