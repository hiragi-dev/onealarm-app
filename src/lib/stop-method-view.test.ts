import { describe, expect, it } from 'vitest'

import type { Alarm } from '@/lib/alarm'
import type { StopMethod } from '@/lib/stop-method'
import { deriveStopMethodRows } from '@/lib/stop-method-view'

/**
 * 停止方法の一覧に出す情報の検証。
 *
 * 「使用中の停止方法は消せない」はこのアプリの前提（消すと止める手段が無くなる）で、
 * その判断の元になる紐づけをここで固定する。
 */

const method = (id: string): StopMethod => ({
  id,
  label: id,
  lat: 35.68,
  lng: 139.76,
  radiusMeters: 20,
  createdAt: 0,
})

const alarm = (id: string, time: string, stopMethodId: string | null): Alarm => ({
  id,
  time,
  daysOfWeek: ['Mon'],
  isEnabled: true,
  stopMethodId,
  isNfcEnabled: false,
})

describe('deriveStopMethodRows', () => {
  it('その停止方法で止まるアラームを時刻順に紐づけ、1件でもあれば使用中にする', () => {
    const rows = deriveStopMethodRows({
      stopMethods: [method('sm-a'), method('sm-b')],
      alarms: [alarm('al-2', '22:00', 'sm-a'), alarm('al-1', '06:30', 'sm-a')],
    })

    expect(rows[0].usedBy.map((a) => a.time)).toEqual(['06:30', '22:00'])
    expect(rows[0].inUse).toBe(true)
    expect(rows[1].usedBy).toEqual([])
    expect(rows[1].inUse).toBe(false)
  })

  it('停止方法が未設定のアラームはどの行にも紐づかない', () => {
    const rows = deriveStopMethodRows({
      stopMethods: [method('sm-a')],
      alarms: [alarm('al-1', '06:30', null)],
    })

    expect(rows[0].inUse).toBe(false)
  })

  it('無効なアラームでも使用中として扱う（有効にした途端に止められなくなるため）', () => {
    const rows = deriveStopMethodRows({
      stopMethods: [method('sm-a')],
      alarms: [{ ...alarm('al-1', '06:30', 'sm-a'), isEnabled: false }],
    })

    expect(rows[0].inUse).toBe(true)
  })
})
