import * as React from 'react'
import { Effect, Option } from 'effect'
import { match } from 'ts-pattern'
import { ArrowLeft, MapPin, Pencil, X } from 'lucide-react'

import { DayOfWeekPicker } from '@/components/alarm/day-of-week-picker'
import { InfoPopover } from '@/components/common/info-popover'
import { LocationPickerMap } from '@/components/map/location-picker-map'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { useDemo } from '@/contexts/demo-context'
import { useNotify } from '@/contexts/notification-context'
import { useRunEffect, useRunEffectState } from '@/lib/effect-react'
import {
  defaultTimeValue,
  formatAlarmTime,
  formatDaysOfWeek,
  type DayOfWeek,
} from '@/lib/alarm'
import type { StopMethod } from '@/lib/stop-method'
import { validateAlarmForm } from '@/lib/validation'
import { cn } from '@/lib/utils'

const STEP_COUNT = 4
type StepIndex = 0 | 1 | 2 | 3

/** 確認ステップの1行。値と、そのステップへ戻る鉛筆ボタンを出す。 */
function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string
  value: string
  onEdit: () => void
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[0.68rem] tracking-[0.06em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label={`${label}を変更`} onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
    </div>
  )
}

/**
 * 新規アラーム作成。時刻→曜日→停止方法→確認、の1画面1テーマで進めるステップウィザード。
 *
 * 停止方法は「どこまで行けば止まるか」という、このアプリの根幹に関わる決定なので、
 * 他の項目と並べたプルダウンではなく、専用のステップとして選ばせる。
 */
export function AddAlarmWizard({
  open,
  onOpenChange,
  stopMethods,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stopMethods: StopMethod[]
}) {
  const { addAlarm, currentPosition, startWatching } = useDemo()
  const notify = useNotify()
  const run = useRunEffect()
  const { run: runSave, pending: saving } = useRunEffectState()

  // 停止方法ステップの地図プレビューで現在地ボタンを使えるよう、開いたら現在地取得を始めておく
  React.useEffect(() => {
    if (!open) return
    void run(startWatching)
  }, [open, run, startWatching])

  const [step, setStep] = React.useState<StepIndex>(0)
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

  // 次に開いたときに前回の入力を持ち越さないよう、閉じる瞬間にリセットする
  // （開いた瞬間に effect でリセットすると cascading render になるため避ける）
  const resetForm = () => {
    setStep(0)
    setTimeInput(defaultTimeValue())
    setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    setSelectedStopMethodId('')
    setIsNfcEnabled(false)
  }

  const handleClose = () => {
    if (saving) return
    resetForm()
    onOpenChange(false)
  }

  const selectedMethod = stopMethods.find((m) => m.id === selectedStopMethodId)

  const canProceed = match(step)
    .with(0, () => timeInput.length > 0)
    .with(1, () => selectedDays.length > 0)
    .with(2, () => selectedStopMethodId !== '')
    .otherwise(() => true)

  const goBack = () => setStep((s) => (s === 0 ? s : ((s - 1) as StepIndex)))
  const goNext = () => setStep((s) => (s === STEP_COUNT - 1 ? s : ((s + 1) as StepIndex)))

  const handleSave = async () => {
    const effect = validateAlarmForm({
      time: timeInput,
      daysOfWeek: selectedDays,
      stopMethodId: selectedStopMethodId,
      isNfcEnabled,
    }).pipe(
      Effect.flatMap((form) =>
        addAlarm({
          time: form.time,
          daysOfWeek: [...form.daysOfWeek],
          stopMethodId: form.stopMethodId,
          isNfcEnabled: form.isNfcEnabled,
          isEnabled: true,
        }),
      ),
    )

    const result = await runSave(effect)
    if (Option.isSome(result)) {
      resetForm()
      onOpenChange(false)
      notify('success', 'アラームを追加しました')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent fullScreen showCloseButton={false} className="gap-0 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>アラームを追加</DialogTitle>
        </DialogHeader>

        {/* fullScreen Dialog は body 直下にポータルされ、アプリ本体が持つ max-w-md の
            モバイル幅カラムの外に出てしまう。デスクトップ幅で全幅に間延びしないよう、
            中身だけをここで同じ幅に収める */}
        <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <div className="flex shrink-0 items-center gap-3 px-4 pt-3 pb-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={step === 0 ? '閉じる' : '前のステップに戻る'}
            disabled={saving}
            onClick={() => (step === 0 ? handleClose() : goBack())}
          >
            {match(step === 0)
              .with(true, () => <X className="size-4" />)
              .with(false, () => <ArrowLeft className="size-4" />)
              .exhaustive()}
          </Button>
          <div className="flex flex-1 gap-1">
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <div
                key={i}
                className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-white/10')}
              />
            ))}
          </div>
        </div>
        <p className="shrink-0 px-4 pb-3 text-[0.7rem] text-muted-foreground tabular-nums">
          STEP {step + 1} / {STEP_COUNT}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
          {match(step)
            .with(0, () => (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                <h2 className="text-xl font-bold">何時に鳴らしますか？</h2>
                <p className="mb-2 text-sm text-muted-foreground">
                  この時刻に、設定した曜日でアラームが鳴ります。
                </p>
                <Input
                  type="time"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  disabled={saving}
                  aria-label="時刻"
                  className="mx-auto h-auto w-auto justify-center border-0 bg-transparent py-2 text-center text-5xl font-extralight tracking-wider tabular-nums focus-visible:ring-0 md:text-5xl [&::-webkit-calendar-picker-indicator]:hidden"
                />
              </div>
            ))
            .with(1, () => (
              <div className="flex h-full flex-col justify-center gap-1">
                <h2 className="text-center text-xl font-bold">どの曜日に鳴らしますか？</h2>
                <p className="mb-6 text-center text-sm text-muted-foreground">
                  1つ以上選んでください。
                </p>
                <DayOfWeekPicker value={selectedDays} onChange={setSelectedDays} disabled={saving} />
              </div>
            ))
            .with(2, () => (
              <div className="pt-2">
                <div className="mb-1 flex items-center gap-1">
                  <h2 className="text-xl font-bold">どこまで行けば止めますか？</h2>
                  <InfoPopover>
                    鳴動中は、ここで選んだ地点まで移動しない限りアラームは止まりません。
                  </InfoPopover>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">
                  選んだ地点に着くまで、アラームは鳴り続けます。
                </p>
                {match(stopMethods)
                  .with([], () => (
                    <Alert variant="warning">
                      <AlertDescription>
                        先に「停止」タブの「停止方法」から位置情報ベースの停止方法を登録してください。
                      </AlertDescription>
                    </Alert>
                  ))
                  .otherwise((methods) => (
                    <div className="space-y-2">
                      {methods.map((method) => {
                        const selected = selectedStopMethodId === method.id
                        return (
                          <div
                            key={method.id}
                            className={cn(
                              'overflow-hidden rounded-2xl border transition-colors',
                              selected
                                ? 'border-primary bg-primary/8'
                                : 'border-white/10 bg-white/4',
                            )}
                          >
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setSelectedStopMethodId(method.id)}
                              aria-pressed={selected}
                              aria-expanded={selected}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:pointer-events-none disabled:opacity-50"
                            >
                              <span
                                className={cn(
                                  'flex size-9 shrink-0 items-center justify-center rounded-full',
                                  selected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-white/8 text-muted-foreground',
                                )}
                              >
                                <MapPin className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold">{method.label}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  到達判定 半径{method.radiusMeters}m
                                </span>
                              </span>
                            </button>

                            {/* 選んだ地点だけをその場で開いて地図を見せる（アコーディオン）。
                                画面遷移させず、かつ全件ぶんの地図を同時に描画しない */}
                            {selected && (
                              <div className="h-32 border-t border-primary/20 [&_.leaflet-control-zoom]:hidden">
                                <LocationPickerMap
                                  initialCenter={method}
                                  value={method}
                                  onSelect={() => {}}
                                  radiusMeters={method.radiusMeters}
                                  currentPosition={currentPosition}
                                  readOnly
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
              </div>
            ))
            .with(3, () => (
              <div className="pt-2">
                <h2 className="text-xl font-bold">この内容で決定しますか？</h2>
                <p className="mb-2 text-sm text-muted-foreground">
                  保存すると一覧に反映されます。
                </p>
                <div className="divide-y divide-border">
                  <SummaryRow
                    label="時刻"
                    value={formatAlarmTime(timeInput)}
                    onEdit={() => setStep(0)}
                  />
                  <SummaryRow
                    label="繰り返す曜日"
                    value={formatDaysOfWeek(selectedDays)}
                    onEdit={() => setStep(1)}
                  />
                  <SummaryRow
                    label="停止方法"
                    value={
                      selectedMethod
                        ? `${selectedMethod.label} ・ 半径${selectedMethod.radiusMeters}m`
                        : '未選択'
                    }
                    onEdit={() => setStep(2)}
                  />
                  <div className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.68rem] tracking-[0.06em] text-muted-foreground uppercase">
                        NFC認証
                      </p>
                      <p className="mt-0.5 text-sm font-semibold">
                        {isNfcEnabled ? '有効' : '無効'}
                      </p>
                    </div>
                    <Switch
                      checked={isNfcEnabled}
                      onCheckedChange={(checked) => setIsNfcEnabled(checked === true)}
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>
            ))
            .exhaustive()}
        </div>

        <div className="flex shrink-0 gap-2 px-4 pt-3 pb-6">
          <Button
            variant="ghost"
            className="flex-1 border border-border"
            disabled={step === 0 || saving}
            onClick={goBack}
          >
            戻る
          </Button>
          {/* 最終ステップだけ「保存」に変わる。押した先が別物なので同じボタンを使い回さない */}
          {match(step < STEP_COUNT - 1)
            .with(true, () => (
              <Button className="flex-1" disabled={!canProceed || saving} onClick={goNext}>
                次へ
              </Button>
            ))
            .with(false, () => (
              <Button className="flex-1" disabled={saving} onClick={() => void handleSave()}>
                この内容で保存する
              </Button>
            ))
            .exhaustive()}
        </div>
        </div>
      </DialogContent>

      {saving && (
        <div className="fixed inset-0 z-60 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
          <Spinner className="size-8 text-primary" />
          <p className="font-bold">保存しています…</p>
          <p className="text-xs text-muted-foreground">エッジデバイスへの反映を確認しています</p>
        </div>
      )}
    </Dialog>
  )
}
