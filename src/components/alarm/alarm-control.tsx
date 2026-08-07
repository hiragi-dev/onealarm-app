import * as React from 'react'
import { match, P } from 'ts-pattern'
import { AlarmClockOff, CloudOff, Plus } from 'lucide-react'

import { AddAlarmWizard } from '@/components/alarm/add-alarm-wizard'
import { EditAlarmPage } from '@/components/alarm/edit-alarm-page'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { useDemo } from '@/contexts/demo-context'
import { useAppReadiness } from '@/hooks/use-app-readiness'
import { useRunEffect } from '@/lib/effect-react'
import { formatAlarmTime, formatDaysOfWeek, type Alarm } from '@/lib/alarm'
import { blockReasonLabel, type BlockReason, type BrokerConnection } from '@/lib/app-state'
import { canCreateAlarm, type StopMethod } from '@/lib/stop-method'
import { cn } from '@/lib/utils'

/**
 * 一覧の表示状態。「読み込み中」「空」「一覧あり」の3通りを暗黙の条件分岐ではなく
 * 明示的な型として持ち、描画側で match(...).exhaustive() させる。
 * 状態を1つ増やしたときに描画の追従漏れがコンパイルエラーになる。
 */
type ListState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'loaded'; alarms: Alarm[] }

/** 初回取得中に一覧の形を模して出すスケルトン */
function AlarmListSkeleton() {
  return (
    <div className="pt-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2 py-3" style={{ opacity: 1 - i * 0.25 }}>
          <Skeleton className="h-12 w-42" />
          <Skeleton className="h-4 w-55" />
        </div>
      ))}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3.5" />
        エッジデバイスからアラームを取得しています…
      </div>
    </div>
  )
}

function AlarmListEmpty({ canAdd }: { canAdd: boolean }) {
  return (
    <div className="mt-20 flex flex-col items-center gap-2">
      <AlarmClockOff className="size-11 text-muted-foreground/50" />
      <p className="text-muted-foreground">アラームはまだありません</p>
      <p className="text-xs text-muted-foreground/60">
        {match(canAdd)
          .with(true, () => '右上の＋から追加できます')
          .with(false, () => '先に「停止」タブで停止方法を登録してください')
          .exhaustive()}
      </p>
    </div>
  )
}

/** 一覧の1行。時刻・繰り返し・停止方法と、有効/無効のスイッチを出す */
function AlarmRow({
  alarm,
  stopMethod,
  ready,
  ringing,
  pending,
  onEdit,
  onToggle,
}: {
  alarm: Alarm
  stopMethod: StopMethod | undefined
  ready: boolean
  ringing: boolean
  pending: boolean
  onEdit: () => void
  onToggle: () => void
}) {
  // 切り替えを受け付けない理由。鳴動中であることを優先して伝える
  const blockedReason = match({ ringing, stopMethodId: alarm.stopMethodId })
    .with({ ringing: true }, () => '鳴動中は無効にできません。設定した停止方法で止めてください')
    .with({ stopMethodId: null }, () => '停止方法が未設定のため切り替えできません')
    .otherwise(() => null)

  const summary = [
    formatDaysOfWeek(alarm.daysOfWeek),
    match(stopMethod)
      .with(P.nullish, () => '停止方法未設定')
      .otherwise((m) => m.label),
    ...match(alarm.isNfcEnabled)
      .with(true, () => ['NFC'])
      .with(false, () => [])
      .exhaustive(),
  ].join(' ・ ')

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      /* role="button" を名乗る以上、ネイティブの button と同じく Space でも発火させる。
         Space は既定でページをスクロールさせてしまうので preventDefault が要る */
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        onEdit()
      }}
      className={cn(
        'flex cursor-pointer items-center gap-3 py-3 transition-opacity outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        !alarm.isEnabled && 'opacity-45',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-5xl leading-tight font-extralight tracking-tight tabular-nums">
          {formatAlarmTime(alarm.time)}
        </p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{summary}</p>
      </div>
      {/* 応答待ちの間はスイッチをスピナーに置き換える（幅を固定して行のガタつきを防ぐ） */}
      <div
        className="flex size-14 shrink-0 items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {match(pending)
          .with(true, () => <Spinner className="size-5 text-primary" />)
          .with(false, () => (
            <Switch
              checked={alarm.isEnabled}
              onCheckedChange={onToggle}
              disabled={!ready || blockedReason !== null}
              aria-label={`${formatAlarmTime(alarm.time)} のアラームの有効/無効`}
              title={blockedReason ?? undefined}
            />
          ))
          .exhaustive()}
      </div>
    </div>
  )
}

/** 未接続・エラー時に一覧を覆って操作させないようにするオーバーレイ */
function ConnectionOverlay({
  broker,
  reasons,
}: {
  broker: BrokerConnection
  reasons: BlockReason[]
}) {
  return (
    <div className="absolute -inset-4 z-10 flex items-center justify-center rounded-3xl bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(30,30,30,0.85)] px-4 py-8 text-center shadow-2xl backdrop-blur-xl">
        {match(broker.kind)
          .with('connecting', () => (
            <>
              <div className="mb-4 inline-flex rounded-full bg-white/6 p-4">
                <Spinner className="size-8 text-primary" />
              </div>
              <h2 className="mb-1 text-lg font-bold">再接続しています…</h2>
              <p className="text-sm text-muted-foreground">
                デバイスへ自動で接続を試みています。しばらくお待ちください。
              </p>
            </>
          ))
          .otherwise(() => (
            <>
              <div className="mb-4 inline-flex rounded-full bg-destructive/10 p-4 text-destructive">
                <CloudOff className="size-8" />
              </div>
              <h2 className="mb-1 text-lg font-bold text-destructive">未接続・エラー</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                アラームを操作するには、デバイスとの接続が必要です。以下の問題を確認してください。
              </p>
              <div className="space-y-2 text-left">
                {reasons.map((reason) => (
                  <Alert key={reason.kind} variant="destructive">
                    <CloudOff />
                    <AlertDescription>{blockReasonLabel(reason)}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </>
          ))}
      </div>
    </div>
  )
}

/**
 * 「アラーム」タブ。一覧の表示と、新規作成（ステップウィザード）/
 * 編集（フルページ）を持つ。
 *
 * 「未接続」「鳴動中」「エッジが応答しない」といった失敗はすべて demo-provider が
 * Effect のエラーとして返すため、ここでは条件分岐や応答待ちのタイマーを持たず、
 * 実行して成功したときだけ画面を閉じる。失敗の文言と通知は各画面側の
 * useRunEffect が扱う。
 */
export function AlarmControl() {
  const { alarms, alarmsUpdatedAt, ringingStatus, editAlarm, stopMethods } = useDemo()
  const { alarmManagement, broker } = useAppReadiness()
  const run = useRunEffect()

  const ready = alarmManagement.kind === 'ready'
  const ringingIds = ringingStatus?.ringingIds ?? []
  const canAdd = canCreateAlarm(stopMethods)

  const [addOpen, setAddOpen] = React.useState(false)
  const [editingAlarm, setEditingAlarm] = React.useState<Alarm | null>(null)

  // 有効/無効トグルの応答待ち。トグルはダイアログを介さないため、
  // 対象行のスイッチをスピナーに置き換えて応答待ちを行単位で伝える
  const [pendingToggles, setPendingToggles] = React.useState<ReadonlySet<string>>(new Set())

  const listState: ListState = match({ alarmsUpdatedAt, alarms })
    .with({ alarmsUpdatedAt: null }, (): ListState => ({ kind: 'loading' }))
    .with({ alarms: [] }, (): ListState => ({ kind: 'empty' }))
    .otherwise(({ alarms }): ListState => ({ kind: 'loaded', alarms }))

  const handleToggle = async (alarm: Alarm) => {
    setPendingToggles((prev) => new Set(prev).add(alarm.id))
    await run(
      editAlarm(alarm.id, {
        time: alarm.time,
        daysOfWeek: alarm.daysOfWeek,
        isEnabled: !alarm.isEnabled,
        stopMethodId: alarm.stopMethodId,
        isNfcEnabled: alarm.isNfcEnabled,
      }),
    )
    setPendingToggles((prev) => {
      const next = new Set(prev)
      next.delete(alarm.id)
      return next
    })
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between pb-2">
        <h1 className="text-3xl font-bold">アラーム</h1>
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={() => setAddOpen(true)}
          disabled={!ready || !canAdd}
          aria-label="アラームを追加"
          title={
            match({ ready, canAdd })
              .with({ ready: true, canAdd: false }, () => '先に「停止」タブで停止方法を登録してください')
              .otherwise(() => undefined)
          }
          className="text-primary"
        >
          <Plus className="size-6" />
        </Button>
      </div>

      <Separator />

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {match(listState)
          .with({ kind: 'loading' }, () => <AlarmListSkeleton />)
          .with({ kind: 'empty' }, () => <AlarmListEmpty canAdd={canAdd} />)
          .with({ kind: 'loaded' }, ({ alarms }) => (
            <ul>
              {alarms.map((alarm, index) => (
                <li key={alarm.id}>
                  <AlarmRow
                    alarm={alarm}
                    stopMethod={stopMethods.find((m) => m.id === alarm.stopMethodId)}
                    ready={ready}
                    ringing={ringingIds.includes(alarm.id)}
                    pending={pendingToggles.has(alarm.id)}
                    onEdit={() => setEditingAlarm(alarm)}
                    onToggle={() => void handleToggle(alarm)}
                  />
                  {index < alarms.length - 1 && <Separator />}
                </li>
              ))}
            </ul>
          ))
          .exhaustive()}
      </div>

      {/* 新規作成: ステップウィザード */}
      <AddAlarmWizard open={addOpen} onOpenChange={setAddOpen} stopMethods={stopMethods} />

      {/* 編集: フルページ */}
      <EditAlarmPage
        alarm={editingAlarm}
        isRinging={editingAlarm !== null && ringingIds.includes(editingAlarm.id)}
        stopMethods={stopMethods}
        onClose={() => setEditingAlarm(null)}
      />

      {/* 未接続・エラー時のオーバーレイ */}
      {alarmManagement.kind === 'blocked' && (
        <ConnectionOverlay broker={broker} reasons={alarmManagement.reasons} />
      )}
    </div>
  )
}
