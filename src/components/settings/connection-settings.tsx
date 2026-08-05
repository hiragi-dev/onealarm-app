import * as React from 'react'
import { match } from 'ts-pattern'
import { ChevronDown, Smartphone, Server, Cpu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  toneTextClass,
} from '@/components/settings/settings-shared'
import type { MqttField } from '@/components/settings/settings-shared'
import type { MqttSettings } from '@/contexts/demo-context'

/**
 * 「設定」タブの接続設定。
 *
 * 「アプリ → ブローカー → エッジデバイス」という実際のネットワーク経路を
 * 図として描く。接続線の色とノードの状態色で、どこまで通っているかを示す。
 * 設定フォームはブローカー／エッジデバイスごとに分けて、図のノードと対応させている。
 */
export function ConnectionSettings() {
  const { settings, updateSetting, status, edgeStatus, connect, disconnect } = useDemo()
  const run = useRunEffect()

  const meta = brokerStatusMeta[status]
  const edgeMeta = edgeStatusMeta[edgeStatus]
  const connected = status === 'connected'
  const editable = status === 'disconnected'
  const configured = Boolean(settings.brokerUrl && settings.deviceId)

  const brokerConfigured = Boolean(settings.brokerUrl)
  const deviceConfigured = Boolean(settings.deviceId)

  const [brokerOpen, setBrokerOpen] = React.useState(!brokerConfigured)
  const [deviceOpen, setDeviceOpen] = React.useState(!deviceConfigured)

  // ブローカー設定とエッジデバイス設定を分離して、どちらの設定かを明示する
  const brokerFields = mqttFields.filter((f) => f.key !== 'deviceId')
  const edgeFields = mqttFields.filter((f) => f.key === 'deviceId')

  const fullyConnected = connected && edgeStatus === 'online'
  const appTone = fullyConnected ? ('success' as const) : ('neutral' as const)

  const brokerLineTone = match(status)
    .with('connected', () => 'success' as const)
    .with('connecting', () => 'warning' as const)
    .with('error', () => 'destructive' as const)
    .with('disconnected', () => 'neutral' as const)
    .exhaustive()

  const edgeLineTone = match({ connected, edgeStatus })
    .with({ connected: false }, () => 'neutral' as const)
    .with({ connected: true, edgeStatus: 'online' }, () => 'success' as const)
    .with({ connected: true, edgeStatus: 'offline' }, () => 'destructive' as const)
    .with({ connected: true, edgeStatus: 'unknown' }, () => 'neutral' as const)
    .exhaustive()

  return (
    <Card>
      <CardContent className="space-y-4 px-6 py-5">
        {/* ネットワーク図: アプリ ──► ブローカー ──► エッジ */}
        <div className="flex items-center">
          <NetworkNode icon={<Smartphone className="size-4" />} label="アプリ" tone={appTone} />

          <NetworkLine
            tone={brokerLineTone}
            label={meta.label}
            animating={status === 'connecting'}
          />

          <NetworkNode icon={<Server className="size-4" />} label="ブローカー" tone={brokerLineTone} />

          <NetworkLine
            tone={edgeLineTone}
            label={connected ? edgeMeta.label : '—'}
            animating={connected && edgeStatus === 'unknown'}
            dimmed={!connected}
          />

          <NetworkNode
            icon={<Cpu className="size-4" />}
            label="エッジ"
            tone={edgeLineTone}
            dimmed={!connected}
          />
        </div>

        <div className="border-t border-border" />

        {/* ブローカー設定とエッジデバイス設定を分けて、図のどのノードに対応するか明示する */}
        <div className="space-y-2">
          <SettingsSection
            title="ブローカー設定"
            summary={settings.brokerUrl || '未設定'}
            open={brokerOpen}
            onOpenChange={setBrokerOpen}
            fields={brokerFields}
            settings={settings}
            updateSetting={updateSetting}
            editable={editable}
            idPrefix="mqtt-broker"
          />
          <SettingsSection
            title="エッジデバイス設定"
            summary={settings.deviceId || '未設定'}
            open={deviceOpen}
            onOpenChange={setDeviceOpen}
            fields={edgeFields}
            settings={settings}
            updateSetting={updateSetting}
            editable={editable}
            idPrefix="mqtt-edge"
          />
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

type NodeTone = 'neutral' | 'success' | 'warning' | 'destructive'

function NetworkNode({
  icon,
  label,
  tone,
  dimmed = false,
}: {
  icon: React.ReactNode
  label: string
  tone: NodeTone
  dimmed?: boolean
}) {
  const bgClass = match(tone)
    .with('success', () => 'bg-success/10 text-success')
    .with('warning', () => 'bg-warning/10 text-warning')
    .with('destructive', () => 'bg-destructive/10 text-destructive')
    .with('neutral', () => 'bg-muted text-muted-foreground')
    .exhaustive()

  return (
    // w-16 で3ノードを同幅に固定する。そうしないと「ブローカー」と「エッジ」の
    // 文字数差で線の長さが変わってしまう
    <div className={cn('flex w-16 flex-col items-center gap-1.5 transition-opacity', dimmed && 'opacity-30')}>
      <div className={cn('rounded-full p-2.5 transition-colors duration-300', bgClass)}>
        {icon}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function NetworkLine({
  tone,
  label,
  animating,
  dimmed = false,
}: {
  tone: NodeTone
  label: string
  animating: boolean
  dimmed?: boolean
}) {
  const lineClass = match(tone)
    .with('success', () => 'bg-success')
    .with('warning', () => 'bg-warning')
    .with('destructive', () => 'bg-destructive')
    .with('neutral', () => 'bg-border')
    .exhaustive()

  const textClass = match(tone)
    .with('success', () => toneTextClass.success)
    .with('warning', () => toneTextClass.warning)
    .with('destructive', () => toneTextClass.destructive)
    .with('neutral', () => toneTextClass.neutral)
    .exhaustive()

  return (
    <div className={cn('flex flex-1 flex-col items-center gap-1 px-1 transition-opacity', dimmed && 'opacity-30')}>
      <div className={cn('h-px w-full transition-colors duration-300', lineClass, animating && 'animate-pulse')} />
      <span className={cn('text-xs font-medium transition-colors', textClass)}>{label}</span>
    </div>
  )
}

function SettingsSection({
  title,
  summary,
  open,
  onOpenChange,
  fields,
  settings,
  updateSetting,
  editable,
  idPrefix,
}: {
  title: string
  summary: string
  open: boolean
  onOpenChange: (v: boolean) => void
  fields: MqttField[]
  settings: MqttSettings
  updateSetting: (key: keyof MqttSettings, value: string) => void
  editable: boolean
  idPrefix: string
}) {
  return (
    <div className="overflow-hidden rounded-md bg-muted/40">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
          <span className="shrink-0 text-sm text-muted-foreground">{title}</span>
          <span className="ml-auto truncate text-sm font-medium">{summary}</span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t border-border px-3 pt-3 pb-4">
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-${field.key}`} className="text-xs">
                  {field.label}
                </Label>
                <Input
                  id={`${idPrefix}-${field.key}`}
                  type={field.type}
                  value={settings[field.key]}
                  onChange={(e) => updateSetting(field.key, e.target.value)}
                  disabled={!editable}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  className="bg-background"
                />
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
  )
}
