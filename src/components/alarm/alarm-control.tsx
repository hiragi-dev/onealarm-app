import * as React from 'react'
import { Effect, Option } from 'effect'
import { match, P } from 'ts-pattern'
import { AlarmClockOff, CloudOff, Plus, Trash2 } from 'lucide-react'

import { InfoPopover } from '@/components/common/info-popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { useDemo } from '@/contexts/demo-context'
import { useNotify } from '@/contexts/notification-context'
import { useAppReadiness } from '@/hooks/use-app-readiness'
import { useRunEffect, useRunEffectState } from '@/lib/effect-react'
import {
  ALL_DAYS,
  DAY_LABELS,
  defaultTimeValue,
  formatAlarmTime,
  formatDaysOfWeek,
  type Alarm,
  type DayOfWeek,
} from '@/lib/alarm'
import { blockReasonLabel, type BlockReason, type BrokerConnection } from '@/lib/app-state'
import type { StopMethod } from '@/lib/stop-method'
import { validateAlarmForm } from '@/lib/validation'
import { cn } from '@/lib/utils'

type DialogMode = { kind: 'add' } | { kind: 'edit'; alarm: Alarm }
type SavingOp = 'add' | 'edit' | 'delete'

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

function AlarmListEmpty() {
  return (
    <div className="mt-20 flex flex-col items-center gap-2">
      <AlarmClockOff className="size-11 text-muted-foreground/50" />
      <p className="text-muted-foreground">アラームはまだありません</p>
      <p className="text-xs text-muted-foreground/60">右上の＋から追加できます</p>
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
      onKeyDown={(e) => e.key === 'Enter' && onEdit()}
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
 * 「アラーム」タブ。一覧の表示と、追加/編集/削除ダイアログを持つ。
 *
 * 「未接続」「鳴動中」「エッジが応答しない」といった失敗はすべて demo-provider が
 * Effect のエラーとして返すため、ここでは条件分岐や応答待ちのタイマーを持たず、
 * 実行して成功したときだけダイアログを閉じる。失敗の文言と通知は useRunEffect が扱う。
 */
export function AlarmControl() {
  const { alarms, alarmsUpdatedAt, ringingStatus, addAlarm, editAlarm, deleteAlarm, stopMethods } =
    useDemo()
  const { alarmManagement, broker } = useAppReadiness()
  const notify = useNotify()
  const { run: runSave, pending: saving } = useRunEffectState()
  const run = useRunEffect()

  const ready = alarmManagement.kind === 'ready'
  const ringingIds = ringingStatus?.ringingIds ?? []

  const [dialogMode, setDialogMode] = React.useState<DialogMode | null>(null)
  const [savingOp, setSavingOp] = React.useState<SavingOp | null>(null)
  const [timeInput, setTimeInput] = React.useState(defaultTimeValue())
  const [selectedDays, setSelectedDays] = React.useState<DayOfWeek[]>([
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
  ])
  const [selectedStopMethodId, setSelectedStopMethodId] = React.useState('')
  const [isNfcEnabled, setIsNfcEnabled] = React.useState(false)

  // 有効/無効トグルの応答待ち。トグルはダイアログを介さないため、
  // 対象行のスイッチをスピナーに置き換えて応答待ちを行単位で伝える
  const [pendingToggles, setPendingToggles] = React.useState<ReadonlySet<string>>(new Set())

  const listState: ListState = match({ alarmsUpdatedAt, alarms })
    .with({ alarmsUpdatedAt: null }, (): ListState => ({ kind: 'loading' }))
    .with({ alarms: [] }, (): ListState => ({ kind: 'empty' }))
    .otherwise(({ alarms }): ListState => ({ kind: 'loaded', alarms }))

  const openAddDialog = () => {
    setTimeInput(defaultTimeValue())
    setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    setSelectedStopMethodId('')
    setIsNfcEnabled(false)
    setDialogMode({ kind: 'add' })
  }

  const openEditDialog = (alarm: Alarm) => {
    setTimeInput(alarm.time)
    setSelectedDays(alarm.daysOfWeek)
    setSelectedStopMethodId(alarm.stopMethodId ?? '')
    setIsNfcEnabled(alarm.isNfcEnabled)
    setDialogMode({ kind: 'edit', alarm })
  }

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays((prev) =>
      match(prev.includes(day))
        .with(true, () => prev.filter((d) => d !== day))
        .with(false, () => [...prev, day])
        .exhaustive(),
    )
  }

  const handleSave = async () => {
    if (!dialogMode) return
    const mode = dialogMode

    // 入力の検証と送信を1本の Effect につなぐ。検証で落ちれば送信は実行されず、
    // どちらの失敗も同じ経路（通知）で利用者に伝わる
    const effect = validateAlarmForm({
      time: timeInput,
      daysOfWeek: selectedDays,
      stopMethodId: selectedStopMethodId,
      isNfcEnabled,
    }).pipe(
      Effect.flatMap((form) => {
        const input = {
          time: form.time,
          daysOfWeek: [...form.daysOfWeek],
          stopMethodId: form.stopMethodId,
          isNfcEnabled: form.isNfcEnabled,
        }
        return match(mode)
          .with({ kind: 'add' }, () => addAlarm({ ...input, isEnabled: true }))
          .with({ kind: 'edit' }, ({ alarm }) =>
            editAlarm(alarm.id, { ...input, isEnabled: alarm.isEnabled }),
          )
          .exhaustive()
      }),
    )

    setSavingOp(mode.kind)
    const result = await runSave(effect)
    setSavingOp(null)

    if (Option.isSome(result)) {
      setDialogMode(null)
      notify(
        'success',
        match(mode.kind)
          .with('add', () => 'アラームを追加しました')
          .with('edit', () => 'アラームを変更しました')
          .exhaustive(),
      )
    }
  }

  const handleDelete = async () => {
    if (dialogMode?.kind !== 'edit') return
    setSavingOp('delete')
    const result = await runSave(deleteAlarm(dialogMode.alarm.id))
    setSavingOp(null)

    if (Option.isSome(result)) {
      setDialogMode(null)
      notify('success', 'アラームを削除しました')
    }
  }

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

  const isEdit = dialogMode?.kind === 'edit'
  const isEditingRingingAlarm = isEdit && ringingIds.includes(dialogMode.alarm.id)
  const inputsDisabled = saving || isEditingRingingAlarm

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between pb-2">
        <h1 className="text-3xl font-bold">アラーム</h1>
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={openAddDialog}
          disabled={!ready}
          aria-label="アラームを追加"
          className="text-primary"
        >
          <Plus className="size-6" />
        </Button>
      </div>

      <Separator />

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {match(listState)
          .with({ kind: 'loading' }, () => <AlarmListSkeleton />)
          .with({ kind: 'empty' }, () => <AlarmListEmpty />)
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
                    onEdit={() => openEditDialog(alarm)}
                    onToggle={() => void handleToggle(alarm)}
                  />
                  {index < alarms.length - 1 && <Separator />}
                </li>
              ))}
            </ul>
          ))
          .exhaustive()}
      </div>

      {/* 追加 / 編集ダイアログ */}
      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => !open && !saving && setDialogMode(null)}
      >
        <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {match(isEdit)
                .with(true, () => 'アラームを編集')
                .with(false, () => 'アラームを追加')
                .exhaustive()}
            </DialogTitle>
          </DialogHeader>

          {isEditingRingingAlarm && (
            <Alert variant="info">
              <AlertDescription>
                このアラームは鳴動中のため変更・削除できません。停止してから操作してください。
              </AlertDescription>
            </Alert>
          )}

          <Input
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            disabled={inputsDisabled}
            aria-label="時刻"
            className="h-auto border-0 bg-transparent py-2 text-center text-4xl font-extralight tracking-wider tabular-nums focus-visible:ring-0 md:text-4xl"
          />

          <fieldset disabled={inputsDisabled} className="disabled:opacity-50">
            <legend className="mb-2 text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
              繰り返す曜日
            </legend>
            <div className="flex w-full gap-1.5">
              {ALL_DAYS.map((day) => {
                const selected = selectedDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={selected}
                    className={cn(
                      'aspect-square flex-1 rounded-full border text-sm font-bold transition-transform',
                      match(selected)
                        .with(true, () => 'scale-105 border-primary bg-primary text-primary-foreground')
                        .with(false, () => 'border-white/15 text-muted-foreground hover:bg-white/8')
                        .exhaustive(),
                    )}
                  >
                    {DAY_LABELS[day]}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset disabled={inputsDisabled} className="disabled:opacity-50">
            <legend className="mb-2 flex items-center gap-1 text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
              停止方法（必須）
              <InfoPopover>
                このアラームをどうやって止めるかを1つ選びます。鳴動中は、ここで選んだ地点まで
                移動しない限りアラームは止まりません。
              </InfoPopover>
            </legend>
            {match(stopMethods)
              .with([], () => (
                <Alert variant="warning">
                  <AlertDescription>
                    先に「停止」タブの「停止方法」から位置情報ベースの停止方法を登録してください。
                  </AlertDescription>
                </Alert>
              ))
              .otherwise((methods) => (
                <Select
                  value={selectedStopMethodId}
                  onValueChange={setSelectedStopMethodId}
                  disabled={inputsDisabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="停止方法を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {methods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
          </fieldset>

          <Label className="items-start gap-3 text-sm font-normal">
            <Checkbox
              checked={isNfcEnabled}
              onCheckedChange={(checked) => setIsNfcEnabled(checked === true)}
              disabled={inputsDisabled}
              className="mt-0.5"
            />
            NFC認証による二段階停止を有効化する
          </Label>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <div className="flex w-full gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                disabled={saving}
                onClick={() => setDialogMode(null)}
              >
                キャンセル
              </Button>
              <Button className="flex-1" disabled={inputsDisabled} onClick={() => void handleSave()}>
                保存
              </Button>
            </div>
            {isEdit && (
              <Button
                variant="ghost"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={saving || isEditingRingingAlarm}
                onClick={() => void handleDelete()}
              >
                <Trash2 />
                アラームを削除
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 保存中（エッジ応答待ち）のブロッキング表示 */}
      {saving && (
        <div className="fixed inset-0 z-60 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
          <Spinner className="size-8 text-primary" />
          <p className="font-bold">
            {match(savingOp)
              .with('delete', () => '削除しています…')
              .otherwise(() => '保存しています…')}
          </p>
          <p className="text-xs text-muted-foreground">エッジデバイスへの反映を確認しています</p>
        </div>
      )}

      {/* 未接続・エラー時のオーバーレイ */}
      {alarmManagement.kind === 'blocked' && (
        <ConnectionOverlay broker={broker} reasons={alarmManagement.reasons} />
      )}
    </div>
  )
}
