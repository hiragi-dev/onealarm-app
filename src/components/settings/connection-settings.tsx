import * as React from 'react'
import { match } from 'ts-pattern'
import { Cpu, Server, Smartphone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useDemo } from '@/contexts/demo-context'
import { useNotify } from '@/contexts/notification-context'
import { deriveConnectionTones, type Tone } from '@/lib/connection-view'
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
 * 群はカードで囲う。設定画面には「今どうなっているか（経路図と接続操作）」と
 * 「何を設定するか（ブローカー / エッジデバイス）」という性質の違うものが並ぶので、
 * 余白の広さだけで区別させるより、面で囲って境界を明示するほうが読み違えにくい。
 * 図で使っているアイコンをカードの見出しに置き、どちらのノードの設定かを示す。
 *
 * 接続操作は経路図と同じカードに入れる。「切断してから編集する」という導線上、
 * 現在の状態とボタンが離れていると往復させることになるため。
 */
export function ConnectionSettings() {
  const { settings, updateSetting, status } = useDemo()

  const editable = status === 'disconnected'

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
  return (
    // w-16 で3ノードを同幅に固定する。そうしないと「ブローカー」と「エッジ」の
    // 文字数差で線の長さが変わってしまう
    <div
      className={cn(
        'flex w-16 flex-col items-center gap-1.5 transition-opacity',
        dimmed && 'opacity-30',
      )}
    >
      <div className={cn('rounded-full p-2.5 transition-colors duration-300', toneBadgeClass[tone])}>
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
