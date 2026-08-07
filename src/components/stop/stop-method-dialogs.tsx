import { match } from 'ts-pattern'
import { ArrowLeft, Pencil } from 'lucide-react'

import { LocationPickerMap } from '@/components/map/location-picker-map'
import type { StopMethodEditing } from '@/components/stop/use-stop-method-editing'
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
import type { GeoPoint } from '@/lib/geo'
import { FALLBACK_CENTER } from '@/lib/dummy-data'
import { DEFAULT_STOP_METHOD_RADIUS_METERS, type StopMethod } from '@/lib/stop-method'
import { cn } from '@/lib/utils'

/**
 * 停止方法の確認・地点選び・名前入力をダイアログで行う部品。
 *
 * UI 案のうち「一覧から開く」系はこの3枚を共有する。
 * 案ごとに書き写すと、鳴動中の文言や保存条件が案ごとにずれるため。
 */

/**
 * 確認・地点選び・名前入力の3枚をまとめて置く。
 * 一覧の見せ方だけが違う案は、これを1行置けば編集の道筋が揃う。
 */
export function StopMethodDialogs({ editing }: { editing: StopMethodEditing }) {
  const { editor, blocked, currentPosition } = editing

  return (
    <>
      <StopMethodViewDialog
        method={editing.viewing}
        onClose={editing.closeView}
        onEdit={editing.openEdit}
        currentPosition={currentPosition}
        isRinging={editing.isRinging}
      />

      <StopMethodPickDialog
        open={editor?.step === 'pick'}
        title={match(editor?.target)
          .with({ kind: 'edit' }, () => '停止地点を変更')
          .otherwise(() => '停止地点を選択')}
        initialCenter={editor?.point ?? currentPosition ?? FALLBACK_CENTER}
        picked={editor?.point ?? null}
        onPick={(point) => editing.updateEditor({ point })}
        radiusMeters={editor?.radiusMeters ?? DEFAULT_STOP_METHOD_RADIUS_METERS}
        onRadiusChange={(radiusMeters) => editing.updateEditor({ radiusMeters })}
        currentPosition={currentPosition}
        blocked={blocked}
        onCancel={editing.closeEditor}
        onNext={() => editing.updateEditor({ step: 'details' })}
      />

      <StopMethodNameDialog
        open={editor?.step === 'details'}
        label={editor?.label ?? ''}
        onLabelChange={(label) => editing.updateEditor({ label })}
        radiusMeters={editor?.radiusMeters ?? DEFAULT_STOP_METHOD_RADIUS_METERS}
        blocked={blocked}
        onBack={() => editing.updateEditor({ step: 'pick' })}
        onCancel={editing.closeEditor}
        onSave={() => void editing.save()}
      />
    </>
  )
}

/** 登録済みの停止方法を地図で確認する（閲覧専用） */
export function StopMethodViewDialog({
  method,
  onClose,
  onEdit,
  currentPosition,
  isRinging,
}: {
  method: StopMethod | undefined
  onClose: () => void
  onEdit: (method: StopMethod) => void
  currentPosition: GeoPoint | null
  isRinging: boolean
}) {
  return (
    <Dialog open={method !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent fullScreen>
        <DialogHeader className="px-4 py-3 text-left">
          <DialogTitle>{method?.label}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          {method && (
            <LocationPickerMap
              initialCenter={{ lat: method.lat, lng: method.lng }}
              value={{ lat: method.lat, lng: method.lng }}
              onSelect={() => {}}
              readOnly
              currentPosition={currentPosition}
              radiusMeters={method.radiusMeters}
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
              .with(false, () => `到達判定 半径${method?.radiusMeters}m`)
              .exhaustive()}
          </p>
          <Button disabled={isRinging} onClick={() => method && onEdit(method)}>
            <Pencil />
            編集
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 全画面の地図で地点と半径を決める（追加フローの1歩目） */
export function StopMethodPickDialog({
  open,
  title,
  initialCenter,
  picked,
  onPick,
  radiusMeters,
  onRadiusChange,
  currentPosition,
  blocked,
  onCancel,
  onNext,
}: {
  open: boolean
  title: string
  initialCenter: GeoPoint
  picked: GeoPoint | null
  onPick: (point: GeoPoint) => void
  radiusMeters: number
  onRadiusChange: (meters: number) => void
  currentPosition: GeoPoint | null
  /** 鳴動が始まって変更できなくなった状態 */
  blocked: boolean
  onCancel: () => void
  onNext: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent fullScreen>
        <DialogHeader className="px-4 py-3 text-left">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          <LocationPickerMap
            initialCenter={initialCenter}
            value={picked}
            onSelect={onPick}
            currentPosition={currentPosition}
            radiusMeters={radiusMeters}
            onRadiusChange={onRadiusChange}
            readOnly={blocked}
          />
        </div>
        <DialogFooter className="flex-row items-center gap-3 p-4">
          <p
            className={cn(
              'flex-1 text-sm',
              match(blocked)
                .with(true, () => 'text-warning')
                .with(false, () => 'text-muted-foreground')
                .exhaustive(),
            )}
          >
            {match({ blocked, picked })
              .with({ blocked: true }, () => 'アラームが鳴り始めたため変更できません')
              .with({ picked: null }, () => '地図をタップして停止地点を選択してください')
              .otherwise(() => '地点を選択しました')}
          </p>
          <Button disabled={!picked || blocked} onClick={onNext}>
            次へ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 名前を付けて保存する（追加フローの2歩目） */
export function StopMethodNameDialog({
  open,
  label,
  onLabelChange,
  radiusMeters,
  blocked,
  onBack,
  onCancel,
  onSave,
}: {
  open: boolean
  label: string
  onLabelChange: (label: string) => void
  radiusMeters: number
  blocked: boolean
  onBack: () => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader className="flex-row items-center gap-2 text-left">
          <Button variant="ghost" size="icon-sm" aria-label="地図に戻る" onClick={onBack}>
            <ArrowLeft />
          </Button>
          <DialogTitle>名前を設定</DialogTitle>
        </DialogHeader>

        {blocked && (
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
            onChange={(e) => onLabelChange(e.target.value)}
            disabled={blocked}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">到達判定 半径{radiusMeters}m</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            キャンセル
          </Button>
          <Button disabled={blocked} onClick={onSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
