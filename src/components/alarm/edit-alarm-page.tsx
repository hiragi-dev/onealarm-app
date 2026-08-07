import * as React from 'react'
import { Effect, Option } from 'effect'
import { match } from 'ts-pattern'
import { ArrowLeft, Trash2 } from 'lucide-react'

import { DayOfWeekPicker } from '@/components/alarm/day-of-week-picker'
import { InfoPopover } from '@/components/common/info-popover'
import { LocationPickerMap } from '@/components/map/location-picker-map'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { useDemo } from '@/contexts/demo-context'
import { useNotify } from '@/contexts/notification-context'
import { useRunEffectState } from '@/lib/effect-react'
import { defaultTimeValue, formatDaysOfWeek, type Alarm, type DayOfWeek } from '@/lib/alarm'
import type { StopMethod } from '@/lib/stop-method'
import { validateAlarmForm } from '@/lib/validation'

type SavingOp = 'edit' | 'delete'

/**
 * 既存アラームの編集。一覧から独立したフルページで、曜日・停止方法・NFCを
 * カード単位のセクションとして見せる。停止方法カードには実際の地図プレビューを
 * 埋め込み、「ここまで歩かないと止まらない」場所をその場で確認できるようにする。
 */
export function EditAlarmPage({
  alarm,
  isRinging,
  stopMethods,
  onClose,
}: {
  /** 編集対象。null のときは非表示（アニメーションのため常時マウントしておく） */
  alarm: Alarm | null
  isRinging: boolean
  stopMethods: StopMethod[]
  onClose: () => void
}) {
  const { editAlarm, deleteAlarm } = useDemo()
  const notify = useNotify()
  const { run: runSave, pending: saving } = useRunEffectState()
  const [savingOp, setSavingOp] = React.useState<SavingOp | null>(null)

  const [timeInput, setTimeInput] = React.useState(defaultTimeValue())
  const [selectedDays, setSelectedDays] = React.useState<DayOfWeek[]>([])
  const [selectedStopMethodId, setSelectedStopMethodId] = React.useState('')
  const [isNfcEnabled, setIsNfcEnabled] = React.useState(false)

  // 開いたときの alarm の値で1度だけ初期化する（保存中に一覧側の値が変わっても
  // 編集中の入力を上書きしない）
  const lastInitId = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!alarm) {
      lastInitId.current = null
      return
    }
    if (lastInitId.current === alarm.id) return
    lastInitId.current = alarm.id
    setTimeInput(alarm.time)
    setSelectedDays(alarm.daysOfWeek)
    setSelectedStopMethodId(alarm.stopMethodId ?? '')
    setIsNfcEnabled(alarm.isNfcEnabled)
  }, [alarm])

  const selectedMethod = stopMethods.find((m) => m.id === selectedStopMethodId)
  const inputsDisabled = saving || isRinging

  const handleSave = async () => {
    if (!alarm) return
    const effect = validateAlarmForm({
      time: timeInput,
      daysOfWeek: selectedDays,
      stopMethodId: selectedStopMethodId,
      isNfcEnabled,
    }).pipe(
      Effect.flatMap((form) =>
        editAlarm(alarm.id, {
          time: form.time,
          daysOfWeek: [...form.daysOfWeek],
          stopMethodId: form.stopMethodId,
          isNfcEnabled: form.isNfcEnabled,
          isEnabled: alarm.isEnabled,
        }),
      ),
    )

    setSavingOp('edit')
    const result = await runSave(effect)
    setSavingOp(null)

    if (Option.isSome(result)) {
      onClose()
      notify('success', 'アラームを変更しました')
    }
  }

  const handleDelete = async () => {
    if (!alarm) return
    setSavingOp('delete')
    const result = await runSave(deleteAlarm(alarm.id))
    setSavingOp(null)

    if (Option.isSome(result)) {
      onClose()
      notify('success', 'アラームを削除しました')
    }
  }

  return (
    <Dialog open={alarm !== null} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent fullScreen showCloseButton={false} className="gap-0 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>アラームを編集</DialogTitle>
        </DialogHeader>

        {/* fullScreen Dialog は body 直下にポータルされ、アプリ本体が持つ max-w-md の
            モバイル幅カラムの外に出てしまう。デスクトップ幅で全幅に間延びしないよう、
            中身だけをここで同じ幅に収める */}
        <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <div className="flex shrink-0 items-center gap-1 px-2 pt-3 pb-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="一覧に戻る"
            disabled={saving}
            onClick={onClose}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <p className="flex-1 text-center text-base font-bold">アラームを編集</p>
          <Button
            variant="ghost"
            className="px-3 font-bold text-primary hover:bg-transparent hover:text-primary"
            disabled={inputsDisabled}
            onClick={() => void handleSave()}
          >
            保存
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
          {isRinging && (
            <Alert variant="info" className="mb-4">
              <AlertDescription>
                このアラームは鳴動中のため変更・削除できません。停止してから操作してください。
              </AlertDescription>
            </Alert>
          )}

          <div className="pb-2 text-center">
            <Input
              type="time"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              disabled={inputsDisabled}
              aria-label="時刻"
              className="mx-auto h-auto w-auto justify-center border-0 bg-transparent py-1 text-center text-6xl font-extralight tracking-wider tabular-nums focus-visible:ring-0 md:text-6xl [&::-webkit-calendar-picker-indicator]:hidden"
            />
            <p className="text-sm text-muted-foreground">{formatDaysOfWeek(selectedDays)}</p>
          </div>

          <div className="mt-5 rounded-2xl border border-white/8 bg-white/4 p-4">
            <p className="mb-2 text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
              繰り返す曜日
            </p>
            <DayOfWeekPicker
              value={selectedDays}
              onChange={setSelectedDays}
              disabled={inputsDisabled}
            />
          </div>

          <div className="mt-3 rounded-2xl border border-white/8 bg-white/4 p-4">
            <div className="mb-2 flex items-center gap-1">
              <p className="text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                停止方法（必須）
              </p>
              <InfoPopover>
                このアラームをどうやって止めるかを1つ選びます。鳴動中は、ここで選んだ地点まで
                移動しない限りアラームは止まりません。
              </InfoPopover>
            </div>

            {match(stopMethods)
              .with([], () => (
                <Alert variant="warning">
                  <AlertDescription>
                    先に「停止」タブの「停止方法」から位置情報ベースの停止方法を登録してください。
                  </AlertDescription>
                </Alert>
              ))
              .otherwise((methods) => (
                <>
                  {selectedMethod && (
                    <div className="pointer-events-none mb-3 h-28 overflow-hidden rounded-xl [&_.leaflet-control-zoom]:hidden">
                      <LocationPickerMap
                        initialCenter={selectedMethod}
                        value={selectedMethod}
                        onSelect={() => {}}
                        radiusMeters={selectedMethod.radiusMeters}
                        readOnly
                      />
                    </div>
                  )}
                  <Select
                    value={selectedStopMethodId}
                    onValueChange={setSelectedStopMethodId}
                    disabled={inputsDisabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="停止方法を選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {methods.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.label}（半径{method.radiusMeters}m）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ))}
          </div>

          <div className="mt-3 rounded-2xl border border-white/8 bg-white/4 p-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">NFC認証</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  到着後にNFCタグへのタッチも必要にします
                </p>
              </div>
              <Switch
                checked={isNfcEnabled}
                onCheckedChange={(checked) => setIsNfcEnabled(checked === true)}
                disabled={inputsDisabled}
              />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-destructive/25 bg-destructive/6 p-4">
            <Button
              variant="ghost"
              className="w-full justify-start px-0 font-bold text-destructive hover:bg-transparent hover:text-destructive"
              disabled={saving || isRinging}
              onClick={() => void handleDelete()}
            >
              <Trash2 />
              このアラームを削除
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">鳴動中は削除できません</p>
          </div>
        </div>
        </div>
      </DialogContent>

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
    </Dialog>
  )
}
