import * as React from 'react'
import { Effect, Option } from 'effect'
import { match } from 'ts-pattern'
import { ArrowLeft, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'

import { InfoPopover } from '@/components/common/info-popover'
import { LocationPickerMap } from '@/components/map/location-picker-map'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useDemo } from '@/contexts/demo-context'
import { useNotify } from '@/contexts/notification-context'
import { useRunEffect } from '@/lib/effect-react'
import { FALLBACK_CENTER } from '@/lib/dummy-data'
import type { GeoPoint } from '@/lib/geo'
import { DEFAULT_STOP_METHOD_RADIUS_METERS, type StopMethod } from '@/lib/stop-method'
import { validateStopMethodForm } from '@/lib/validation'
import { cn } from '@/lib/utils'

/** 編集フローのステップ: まず地図で地点を選び、次に名前を入力する */
type EditorStep = 'pick' | 'details'

/** 編集ダイアログの対象。新規追加か、既存の停止方法の編集か */
type Editor = { kind: 'add' } | { kind: 'edit'; id: string }

/**
 * 「停止」タブの「停止方法」。位置情報ベースの停止地点を登録・編集・削除する。
 *
 * 保存できるかどうかの判定は validateStopMethodForm（Schema）に任せ、
 * 「使用中だから消せない」「鳴動中だから変えられない」は demo-provider が
 * Effect のエラーとして返す。ここでは成否に応じて画面を閉じるだけにしている。
 */
export function StopMethodSettings() {
  const {
    stopMethods,
    addStopMethod,
    updateStopMethod,
    deleteStopMethod,
    alarms,
    ringingStatus,
    currentPosition,
    startWatching,
  } = useDemo()
  const run = useRunEffect()
  const notify = useNotify()

  const [editor, setEditor] = React.useState<Editor | null>(null)
  const [step, setStep] = React.useState<EditorStep>('pick')
  const [label, setLabel] = React.useState('')
  const [radiusMeters, setRadiusMeters] = React.useState(DEFAULT_STOP_METHOD_RADIUS_METERS)
  const [picked, setPicked] = React.useState<GeoPoint | null>(null)
  // 地図で内容を確認しているだけの停止方法（閲覧専用）
  const [viewingId, setViewingId] = React.useState<string | null>(null)

  const mapOpen = editor !== null || viewingId !== null

  // 地図を開いたら現在地を掴めるようにしておく（地図の初期中心・現在地表示に使う）
  React.useEffect(() => {
    if (!mapOpen) return
    void run(startWatching)
  }, [mapOpen, run, startWatching])

  const usedStopMethodIds = new Set(
    alarms.map((a) => a.stopMethodId).filter((id): id is string => !!id),
  )

  const viewing = stopMethods.find((m) => m.id === viewingId)

  // 鳴動中に停止地点を書き換えられると、鳴っているアラームの停止条件を
  // その場で好きな場所にずらせてしまう。停止するまで変更させない
  const isRinging = (ringingStatus?.ringingIds ?? []).length > 0
  const editBlockedByRinging = editor?.kind === 'edit' && isRinging

  const openAddDialog = () => {
    setLabel('')
    setRadiusMeters(DEFAULT_STOP_METHOD_RADIUS_METERS)
    // 地図をタップして選ぶまではピンを立てない
    setPicked(null)
    setStep('pick')
    setEditor({ kind: 'add' })
  }

  const openEditDialog = (method: StopMethod) => {
    setLabel(method.label)
    setRadiusMeters(method.radiusMeters)
    setPicked({ lat: method.lat, lng: method.lng })
    setStep('pick')
    setViewingId(null)
    setEditor({ kind: 'edit', id: method.id })
  }

  const handleSave = async () => {
    if (!editor) return
    const target = editor

    // 検証と保存を1本の Effect につなぐ。検証で落ちれば保存は走らない
    const effect = validateStopMethodForm({ label, point: picked, radiusMeters }).pipe(
      Effect.flatMap((input) =>
        match(target)
          .with({ kind: 'add' }, () => addStopMethod(input))
          .with({ kind: 'edit' }, ({ id }) => updateStopMethod(id, input))
          .exhaustive(),
      ),
    )

    const result = await run(effect)
    if (Option.isSome(result)) {
      setEditor(null)
      notify(
        'success',
        match(target.kind)
          .with('add', () => '停止方法を登録しました')
          .with('edit', () => '停止方法を変更しました')
          .exhaustive(),
      )
    }
  }

  const handleDelete = async (id: string) => {
    const result = await run(deleteStopMethod(id))
    if (Option.isSome(result)) notify('success', '停止方法を削除しました')
  }

  const editorInitialCenter = picked ?? currentPosition ?? FALLBACK_CENTER

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h2 className="text-lg font-semibold">停止方法（位置情報）</h2>
          <InfoPopover>
            ここで登録した停止方法は、「アラーム」タブでアラームごとに1つ選んで割り当てます。
            鳴動中のアラームに割り当てられた地点まで移動すると、自動的にアラームを停止します。
          </InfoPopover>
        </div>
        <Button onClick={openAddDialog}>
          <Plus />
          追加
        </Button>
      </div>

      {match(stopMethods)
        .with([], () => (
          <div className="flex flex-col items-center gap-2 py-10">
            <MapPin className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">まだ停止方法が登録されていません</p>
            <p className="text-xs text-muted-foreground/60">
              「追加」から地図で地点を選んで登録できます
            </p>
          </div>
        ))
        .otherwise((methods) => (
          <>
            <ul className="rounded-2xl border border-white/8 bg-white/4 px-4">
              {methods.map((method, index) => {
                const inUse = usedStopMethodIds.has(method.id)
                const inUseNote = match(inUse)
                  .with(true, () => ' ・ 使用中')
                  .with(false, () => '')
                  .exhaustive()
                return (
                  <li key={method.id}>
                    <div className="flex items-center gap-3 py-3">
                      <button
                        type="button"
                        onClick={() => setViewingId(method.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <MapPin className="size-5 shrink-0 text-primary" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{method.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            到達判定 半径{method.radiusMeters}m{inUseNote}
                          </span>
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${method.label} を削除`}
                        title={match(inUse)
                          .with(true, () => 'いずれかのアラームで使用中のため削除できません')
                          .with(false, () => undefined)
                          .exhaustive()}
                        disabled={inUse}
                        onClick={() => void handleDelete(method.id)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    {index < methods.length - 1 && <Separator />}
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-muted-foreground/60">
              タップすると地図で場所を確認・編集できます
            </p>
          </>
        ))}

      {/* 地図で内容を確認する（閲覧専用） */}
      <Dialog open={viewing !== undefined} onOpenChange={(open) => !open && setViewingId(null)}>
        <DialogContent fullScreen>
          <DialogHeader className="px-4 py-3 text-left">
            <DialogTitle>{viewing?.label}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            {viewing && (
              <LocationPickerMap
                initialCenter={{ lat: viewing.lat, lng: viewing.lng }}
                value={{ lat: viewing.lat, lng: viewing.lng }}
                onSelect={() => {}}
                readOnly
                currentPosition={currentPosition}
                radiusMeters={viewing.radiusMeters}
              />
            )}
          </div>
          <DialogFooter className="flex-row items-center gap-3 p-4">
            <p
              className={cn(
                'flex-1 text-sm',
                match(isRinging)
                  .with(true, () => 'text-warning')
                  .with(false, () => 'text-muted-foreground')
                  .exhaustive(),
              )}
            >
              {match(isRinging)
                .with(true, () => 'アラームが鳴っている間は変更できません')
                .with(false, () => `到達判定 半径${viewing?.radiusMeters}m`)
                .exhaustive()}
            </p>
            <Button disabled={isRinging} onClick={() => viewing && openEditDialog(viewing)}>
              <Pencil />
              編集
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 1: 地図で地点を選ぶ（全画面で最大限広く使う） */}
      <Dialog
        open={editor !== null && step === 'pick'}
        onOpenChange={(open) => !open && setEditor(null)}
      >
        <DialogContent fullScreen>
          <DialogHeader className="px-4 py-3 text-left">
            <DialogTitle>
              {match(editor)
                .with({ kind: 'edit' }, () => '停止地点を変更')
                .otherwise(() => '停止地点を選択')}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <LocationPickerMap
              initialCenter={editorInitialCenter}
              value={picked}
              onSelect={setPicked}
              currentPosition={currentPosition}
              radiusMeters={radiusMeters}
              onRadiusChange={setRadiusMeters}
              readOnly={editBlockedByRinging}
            />
          </div>
          <DialogFooter className="flex-row items-center gap-3 p-4">
            <p
              className={cn(
                'flex-1 text-sm',
                match(editBlockedByRinging)
                  .with(true, () => 'text-warning')
                  .with(false, () => 'text-muted-foreground')
                  .exhaustive(),
              )}
            >
              {match({ blocked: editBlockedByRinging, picked })
                .with({ blocked: true }, () => 'アラームが鳴り始めたため変更できません')
                .with({ picked: null }, () => '地図をタップして停止地点を選択してください')
                .otherwise(() => '地点を選択しました')}
            </p>
            <Button disabled={!picked || editBlockedByRinging} onClick={() => setStep('details')}>
              次へ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: 名前を入力する */}
      <Dialog
        open={editor !== null && step === 'details'}
        onOpenChange={(open) => !open && setEditor(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader className="flex-row items-center gap-2 text-left">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="地図に戻る"
              onClick={() => setStep('pick')}
            >
              <ArrowLeft />
            </Button>
            <DialogTitle>名前を設定</DialogTitle>
          </DialogHeader>

          {editBlockedByRinging && (
            <Alert variant="info">
              <AlertDescription>
                アラームが鳴り始めたため保存できません。停止してから変更してください。
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="stop-method-label">名前</Label>
            <Input
              id="stop-method-label"
              placeholder="例: 会社、駅前"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={editBlockedByRinging}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">到達判定 半径{radiusMeters}m</p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditor(null)}>
              キャンセル
            </Button>
            <Button disabled={editBlockedByRinging} onClick={() => void handleSave()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
