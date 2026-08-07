import * as React from 'react'
import { match } from 'ts-pattern'
import { Cpu, Server, Smartphone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useDemo } from '@/contexts/demo-context'
import { deriveConnectionTones, type Tone } from '@/lib/connection-view'
import { useRunEffect } from '@/lib/effect-react'
import { cn } from '@/lib/utils'
import {
  brokerFields,
  brokerStatusMeta,
  edgeFields,
  edgeStatusMeta,
  toneTextClass,
} from '@/components/settings/settings-shared'
import type { MqttField } from '@/components/settings/settings-shared'
import type { MqttSettings } from '@/contexts/demo-context'

/**
 * 「設定」タブの接続設定。
 *
 * 「アプリ → ブローカー → エッジデバイス」という実際のネットワーク経路を
 * 図として描く。接続線の色とノードの状態色で、どこまで通っているかを示す。
 *
 * 図の下は折りたたまず、全項目を常に出す。設定は4つしかないので隠す必要がなく、
 * 開閉の状態を覚えなくてよくなる。ラベルを左・値を右に寄せた行を細い区切り線で並べ、
 * 「ブローカー」「エッジデバイス」の小見出しで図のノードに対応させている。
 * カードで囲わないのは、アラーム一覧・停止方法一覧と同じく
 * 区切り線だけで構造を出すこの画面群の作りに揃えるため。
 */
export function ConnectionSettings() {
  const { settings, updateSetting, status } = useDemo()

  const editable = status === 'disconnected'

  return (
    <div className="space-y-6">
      <NetworkDiagram />

      <div className="space-y-6">
        <FieldGroup
          heading="ブローカー"
          fields={brokerFields}
          settings={settings}
          updateSetting={updateSetting}
          editable={editable}
        />
        <FieldGroup
          heading="エッジデバイス"
          fields={edgeFields}
          settings={settings}
          updateSetting={updateSetting}
          editable={editable}
        />
      </div>

      {!editable && (
        <p className="text-xs text-muted-foreground">
          接続中は変更できません。切断してから編集してください。
        </p>
      )}

      <ConnectionActions />
    </div>
  )
}

/** 「アプリ → ブローカー → エッジデバイス」の経路図 */
function NetworkDiagram() {
  const { status, edgeStatus } = useDemo()
  const tones = deriveConnectionTones({ broker: status, edge: edgeStatus })

  return (
    <div className="flex items-center">
      <NetworkNode icon={<Smartphone className="size-4" />} label="アプリ" tone={tones.app} />

      <NetworkLine
        tone={tones.brokerLink}
        label={brokerStatusMeta[status].label}
        animating={tones.brokerPending}
      />

      <NetworkNode icon={<Server className="size-4" />} label="ブローカー" tone={tones.brokerLink} />

      <NetworkLine
        tone={tones.edgeLink}
        label={match(tones.edgeUnreachable)
          .with(true, () => '—')
          .with(false, () => edgeStatusMeta[edgeStatus].label)
          .exhaustive()}
        animating={tones.edgePending}
        dimmed={tones.edgeUnreachable}
      />

      <NetworkNode
        icon={<Cpu className="size-4" />}
        label="エッジ"
        tone={tones.edgeLink}
        dimmed={tones.edgeUnreachable}
      />
    </div>
  )
}

function NetworkNode({
  icon,
  label,
  tone,
  dimmed = false,
}: {
  icon: React.ReactNode
  label: string
  tone: Tone
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
    <div
      className={cn(
        'flex w-16 flex-col items-center gap-1.5 transition-opacity',
        dimmed && 'opacity-30',
      )}
    >
      <div className={cn('rounded-full p-2.5 transition-colors duration-300', bgClass)}>{icon}</div>
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
  tone: Tone
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

  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center gap-1 px-1 transition-opacity',
        dimmed && 'opacity-30',
      )}
    >
      <div
        className={cn(
          'h-px w-full transition-colors duration-300',
          lineClass,
          animating && 'animate-pulse',
        )}
      />
      <span className={cn('text-xs font-medium transition-colors', toneTextClass[tone])}>
        {label}
      </span>
    </div>
  )
}

/** 図のノード1つぶんの設定。小見出し＋伸びる線は開発ツールの群分けと同じ語彙 */
function FieldGroup({
  heading,
  fields,
  settings,
  updateSetting,
  editable,
}: {
  heading: string
  fields: MqttField[]
  settings: MqttSettings
  updateSetting: (key: keyof MqttSettings, value: string) => void
  editable: boolean
}) {
  return (
    <section>
      <div className="flex items-center gap-2 pb-1">
        <span className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {heading}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="divide-y divide-border">
        {fields.map((field) => (
          <div key={field.key} className="flex items-center gap-3">
            <Label
              htmlFor={`connection-${field.key}`}
              className="w-24 shrink-0 text-sm font-normal text-muted-foreground"
            >
              {field.short}
            </Label>
            <Input
              id={`connection-${field.key}`}
              // 見えるラベルは詰めてあるので、読み上げには正式な名前を渡す
              aria-label={field.label}
              type={field.type}
              value={settings[field.key]}
              onChange={(e) => updateSetting(field.key, e.target.value)}
              disabled={!editable}
              placeholder={field.placeholder}
              autoComplete="off"
              spellCheck={false}
              // 行そのものが入力欄。枠を消して右寄せにすると、読むときは
              // ラベルと値の対応表に、書くときは入力欄に見える
              className="h-11 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-right focus-visible:ring-0 disabled:opacity-70"
            />
          </div>
        ))}
      </div>
    </section>
  )
}

/** 接続/切断 */
function ConnectionActions() {
  const { settings, status, connect, disconnect } = useDemo()
  const run = useRunEffect()

  const connected = status === 'connected'
  const configured = Boolean(settings.brokerUrl && settings.deviceId)

  return (
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
  )
}
