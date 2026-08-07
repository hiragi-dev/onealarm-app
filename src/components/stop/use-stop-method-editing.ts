import * as React from 'react'
import { Effect, Option } from 'effect'
import { match } from 'ts-pattern'

import { useDemo } from '@/contexts/demo-context'
import { useNotify } from '@/contexts/notification-context'
import { useRunEffect } from '@/lib/effect-react'
import type { GeoPoint } from '@/lib/geo'
import { DEFAULT_STOP_METHOD_RADIUS_METERS, type StopMethod } from '@/lib/stop-method'
import { deriveStopMethodRows } from '@/lib/stop-method-view'
import { validateStopMethodForm } from '@/lib/validation'

/**
 * 停止方法の一覧・登録・変更・削除の状態と手続き。
 *
 * 一覧の描画（stop-method-settings.tsx）からこちらを引き剥がしてあるのは、
 * 「保存できるか」「消せるか」の判断がガード（鳴動中・使用中）と検証にまたがるため。
 * 画面側は成否に応じて開いているものを閉じるだけでよくなる。
 */

/** 編集の対象。新規追加か、既存の停止方法の変更か */
type EditorTarget = { kind: 'add' } | { kind: 'edit'; id: string }

export type StopMethodEditorState = {
  target: EditorTarget
  /** 地図で地点を決める → 名前を付ける の2歩 */
  step: 'pick' | 'details'
  label: string
  point: GeoPoint | null
  radiusMeters: number
}

export function useStopMethodEditing() {
  const {
    stopMethods,
    alarms,
    ringingStatus,
    currentPosition,
    startWatching,
    addStopMethod,
    updateStopMethod,
    deleteStopMethod,
  } = useDemo()
  const run = useRunEffect()
  const notify = useNotify()

  // 地図で内容を確認しているだけの停止方法（閲覧専用）
  const [viewingId, setViewingId] = React.useState<string | null>(null)
  const [editor, setEditor] = React.useState<StopMethodEditorState | null>(null)

  const rows = deriveStopMethodRows({ stopMethods, alarms })
  const viewing = stopMethods.find((m) => m.id === viewingId)

  // 鳴動中に停止地点を書き換えられると、鳴っているアラームの停止条件を
  // その場で今いる場所へずらせてしまう。停止するまで変更させない
  const isRinging = (ringingStatus?.ringingIds ?? []).length > 0
  const blocked = editor?.target.kind === 'edit' && isRinging

  // 現在地は地図（初期中心・現在地表示）でしか使わないので、
  // 一覧を眺めているだけの間は測位を始めない
  const mapOpen = viewingId !== null || editor !== null
  React.useEffect(() => {
    if (!mapOpen) return
    void run(startWatching)
  }, [mapOpen, run, startWatching])

  const openAdd = React.useCallback(() => {
    setEditor({
      target: { kind: 'add' },
      step: 'pick',
      label: '',
      // 地図をタップして選ぶまではピンを立てない
      point: null,
      radiusMeters: DEFAULT_STOP_METHOD_RADIUS_METERS,
    })
  }, [])

  const openEdit = React.useCallback((method: StopMethod) => {
    setViewingId(null)
    setEditor({
      target: { kind: 'edit', id: method.id },
      step: 'pick',
      label: method.label,
      point: { lat: method.lat, lng: method.lng },
      radiusMeters: method.radiusMeters,
    })
  }, [])

  const updateEditor = React.useCallback((next: Partial<StopMethodEditorState>) => {
    setEditor((prev) => prev && { ...prev, ...next })
  }, [])

  const save = React.useCallback(async () => {
    if (!editor) return
    const target = editor.target

    // 検証と保存を1本の Effect につなぐ。検証で落ちれば保存は走らない
    const effect = validateStopMethodForm({
      label: editor.label,
      point: editor.point,
      radiusMeters: editor.radiusMeters,
    }).pipe(
      Effect.flatMap((input) =>
        match(target)
          .with({ kind: 'add' }, () => addStopMethod(input))
          .with({ kind: 'edit' }, ({ id }) => updateStopMethod(id, input))
          .exhaustive(),
      ),
    )

    const result = await run(effect)
    if (Option.isNone(result)) return

    setEditor(null)
    notify(
      'success',
      match(target.kind)
        .with('add', () => '停止方法を登録しました')
        .with('edit', () => '停止方法を変更しました')
        .exhaustive(),
    )
  }, [addStopMethod, editor, notify, run, updateStopMethod])

  const remove = React.useCallback(
    async (id: string) => {
      const result = await run(deleteStopMethod(id))
      if (Option.isSome(result)) notify('success', '停止方法を削除しました')
    },
    [deleteStopMethod, notify, run],
  )

  return {
    rows,
    isRinging,
    currentPosition,
    viewing,
    openView: setViewingId,
    closeView: () => setViewingId(null),
    editor,
    blocked,
    openAdd,
    openEdit,
    updateEditor,
    closeEditor: () => setEditor(null),
    save,
    remove,
  }
}

export type StopMethodEditing = ReturnType<typeof useStopMethodEditing>
