import * as React from 'react'
import { match } from 'ts-pattern'
import { Check, Cpu, LoaderCircle, Minus, Server, Smartphone, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useApp } from '@/contexts/app-context'
import { useNotify } from '@/contexts/notification-context'
import { deriveConnectAction, deriveConnectionTones, type Tone } from '@/lib/connection-view'
import { isEditIntent } from '@/lib/edit-intent'
import { useRunEffect } from '@/lib/effect-react'
import { cn } from '@/lib/utils'
import {
  brokerFields,
  brokerStatusMeta,
  CONNECTED_LOCK_NOTICE,
  edgeFields,
  edgeStatusMeta,
  toneBadgeClass,
} from '@/components/settings/settings-shared'
import type { MqttField } from '@/components/settings/settings-shared'
import type { MqttSettings } from '@/contexts/app-context'

/**
 * 「設定」タブの接続設定。
 *
 * 「アプリ → ブローカー → エッジデバイス」という実際のネットワーク経路を
 * 図として描く。接続線の色とノードの状態色で、どこまで通っているかを示す。
 *
 * 群はカードで囲う。設定画面には「今どうなっているか（経路図と接続操作）」と
 * 「何を設定するか（ブローカー / エッジデバイス）」という性質の違うものが並ぶので、
 * 余白の広さだけで区別させるより、面で囲って境界を明示するほうが読み違えにくい。
 * 図で使っているアイコンをカードの見出しに置き、どちらのノードの設定かを示す。
 *
 * 接続操作は経路図と同じカードに入れる。「切断してから編集する」という導線上、
 * 現在の状態とボタンが離れていると往復させることになるため。
 */
export function ConnectionSettings() {
  const { settings, updateSetting, status } = useApp()

  // 失敗した後（error）も編集できる。接続先を直せないと失敗から抜け出せない
  const editable = status === 'disconnected' || status === 'error'

  return (
    <div className="space-y-4">
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>接続状態</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <NetworkDiagram />
          <ConnectionActions />
        </CardContent>
      </Card>

      <FieldGroup
        icon={<Server className="size-4" />}
        heading="ブローカー"
        fields={brokerFields}
        settings={settings}
        updateSetting={updateSetting}
        editable={editable}
      />
      <FieldGroup
        icon={<Cpu className="size-4" />}
        heading="エッジデバイス"
        fields={edgeFields}
        settings={settings}
        updateSetting={updateSetting}
        editable={editable}
      />
    </div>
  )
}

/** 「アプリ → ブローカー → エッジデバイス」の経路図 */
function NetworkDiagram() {
  const { status, edgeStatus } = useApp()
  const tones = deriveConnectionTones({ broker: status, edge: edgeStatus })

  return (
    <div className="flex items-start">
      <NetworkNode icon={<Smartphone className="size-4" />} label="アプリ" tone={tones.app} />
      <NetworkLine
        tone={tones.brokerLink}
        pending={tones.brokerPending}
        description={brokerStatusMeta[status].label}
      />
      <NetworkNode icon={<Server className="size-4" />} label="ブローカー" tone={tones.brokerLink} />
      <NetworkLine
        tone={tones.edgeLink}
        pending={tones.edgePending}
        description={match(tones.edgeUnreachable)
          .with(true, () => '判定できません')
          .with(false, () => edgeStatusMeta[edgeStatus].label)
          .exhaustive()}
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
  return (
    // w-16 で3ノードを同幅に固定する。そうしないと「ブローカー」と「エッジ」の
    // 文字数差で線の長さが変わってしまう。名前は折り返さない（w-16 に 5 文字が収まる）
    <div
      className={cn(
        'flex w-16 flex-col items-center gap-1.5 transition-opacity',
        dimmed && 'opacity-30',
      )}
    >
      <div className={cn('rounded-full p-2.5 transition-colors duration-300', toneBadgeClass[tone])}>
        {icon}
      </div>
      <span className="text-xs whitespace-nowrap text-muted-foreground">{label}</span>
    </div>
  )
}

/**
 * ノード間の線。状態は線の色と、線の中央に乗せた小さな印で示す。
 * 言葉（「接続済み」「オンライン」）をここに置くと幅を取ってノード名と競合するため、
 * 印の形で伝える: 通っていれば✓、待っていれば回転、失敗は×、判定できなければ −。
 * 色だけだと色弱の人に区別がつかないので、形も必ず変える。
 * 言葉での説明は読み上げ（aria-label）に残す
 */
function NetworkLine({
  tone,
  pending,
  description,
  dimmed = false,
}: {
  tone: Tone
  pending: boolean
  description: string
  dimmed?: boolean
}) {
  const lineClass = match(tone)
    .with('success', () => 'bg-success')
    .with('warning', () => 'bg-warning')
    .with('destructive', () => 'bg-destructive')
    .with('neutral', () => 'bg-border')
    .exhaustive()

  // 印は線の上に乗るので、線が透けないよう塗りつぶす（ノードの丸は薄い色のまま）
  const markClass = match(tone)
    .with('success', () => 'bg-success text-success-foreground')
    .with('warning', () => 'bg-warning text-warning-foreground')
    .with('destructive', () => 'bg-destructive text-destructive-foreground')
    .with('neutral', () => 'bg-accent text-muted-foreground')
    .exhaustive()

  const mark = match({ tone, pending })
    .with({ pending: true }, () => <LoaderCircle className="size-3 animate-spin" />)
    .with({ tone: 'success' }, () => <Check className="size-3" />)
    .with({ tone: 'destructive' }, () => <X className="size-3" />)
    .otherwise(() => <Minus className="size-3" />)

  return (
    // アイコンの高さ（p-2.5 + size-4 = 36px）の中央に線を通す
    <div
      className={cn('relative flex h-9 flex-1 items-center px-1 transition-opacity', dimmed && 'opacity-30')}
      role="img"
      aria-label={description}
      title={description}
    >
      <div
        className={cn(
          'h-0.5 w-full rounded-full transition-colors duration-300',
          lineClass,
          pending && 'animate-pulse',
        )}
      />
      <span
        className={cn(
          'absolute left-1/2 flex size-5 -translate-x-1/2 items-center justify-center rounded-full ring-2 ring-card transition-colors duration-300',
          markClass,
        )}
      >
        {mark}
      </span>
    </div>
  )
}

/** 図のノード1つぶんの設定カード。見出しのアイコンで、図のどのノードの設定かを示す */
function FieldGroup({
  icon,
  heading,
  fields,
  settings,
  updateSetting,
  editable,
}: {
  icon: React.ReactNode
  heading: string
  fields: MqttField[]
  settings: MqttSettings
  updateSetting: (key: keyof MqttSettings, value: string) => void
  editable: boolean
}) {
  const notify = useNotify()

  const notifyIfLocked = () => {
    if (editable) return
    notify('warning', CONNECTED_LOCK_NOTICE)
  }

  const handleLockedKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (editable) return
    if (isEditIntent(e)) notifyIfLocked()
  }

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{icon}</span>
          {heading}
        </CardTitle>
      </CardHeader>

      {/* 見出しとの間隔はカード側の gap で取るので、ここは行間だけを持つ */}
      <CardContent className="divide-y divide-border">
        {fields.map((field) => (
          <div
            key={field.key}
            className="flex items-center gap-3"
            // ラベル側を叩いたときも拾えるよう、行ごと受ける
            onClick={notifyIfLocked}
          >
            <Label
              htmlFor={`connection-${field.key}`}
              className="w-24 shrink-0 text-sm text-muted-foreground"
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
              /* disabled ではなく readOnly。disabled はクリックもキー入力も
                 イベントを発火しないので「編集しようとした」ことを検知できない。
                 readOnly なら編集は防いだまま検知でき、値の選択・コピーも残る */
              readOnly={!editable}
              onKeyDown={handleLockedKeyDown}
              placeholder={field.placeholder}
              autoComplete="off"
              spellCheck={false}
              // 行そのものが入力欄。枠を消して右寄せにすると、読むときは
              // ラベルと値の対応表に、書くときは入力欄に見える
              className={cn(
                'h-11 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-right focus-visible:ring-0',
                !editable && 'opacity-70',
              )}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/** 接続/切断 */
function ConnectionActions() {
  const { settings, status, edgeStatus, connect, reconnect, disconnect } = useApp()
  const run = useRunEffect()

  const configured = Boolean(settings.brokerUrl && settings.deviceId)
  const action = deriveConnectAction({ broker: status, edge: edgeStatus, configured })

  return (
    <div className="flex gap-2">
      <Button
        className="flex-1"
        onClick={() =>
          void match(action)
            .with({ kind: 'connect' }, () => run(connect))
            .with({ kind: 'reconnect' }, () => run(reconnect))
            .otherwise(() => Promise.resolve())
        }
        disabled={match(action)
          .with({ kind: 'connect' }, { kind: 'reconnect' }, () => false)
          .otherwise(() => true)}
      >
        {action.kind === 'busy' && <Spinner className="size-4" />}
        {match(action)
          .with({ kind: 'busy' }, () => '接続中…')
          .with({ kind: 'reconnect' }, () => '再接続')
          .otherwise(() => '接続')}
      </Button>
      <Button
        variant="outline"
        onClick={() => void run(disconnect)}
        disabled={status === 'disconnected'}
      >
        切断
      </Button>
    </div>
  )
}
