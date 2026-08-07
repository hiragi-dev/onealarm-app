import { describe, expect, it } from 'vitest'

import type { Alarm } from '@/lib/alarm'
import { deriveRingingView } from '@/lib/ringing-view'
import type { StopMethod } from '@/lib/stop-method'

/**
 * 「エッジが鳴らしている＝停止画面が出る」ことの検証。
 *
 * デバイス側の鳴動が状態に届くことは client.test.ts（fake-edge）で担保済み。
 * ここはその状態から「停止画面を出す/出さない・何を出す」の判断だけを、
 * DOM を持ち込まずに固定する。
 */

const STOP_METHOD: StopMethod = {
  id: 'sm-office',
  label: 'オフィス',
  lat: 35.68,
  lng: 139.76,
  radiusMeters: 20,
  createdAt: 0,
}

const ALARM: Alarm = {
  id: 'alarm-1',
  time: '06:30',
  daysOfWeek: ['Mon'],
  isEnabled: true,
  stopMethodId: 'sm-office',
  isNfcEnabled: false,
}

const ringing = (ids: string[]) => ({ isRinging: ids.length > 0, ringingIds: ids })

describe('deriveRingingView', () => {
  it('鳴っていなければ silent（＝停止画面を出さない）', () => {
    expect(
      deriveRingingView({ ringingStatus: null, alarms: [], stopMethods: [], position: null }),
    ).toEqual({ kind: 'silent' })

    expect(
      deriveRingingView({
        ringingStatus: ringing([]),
        alarms: [ALARM],
        stopMethods: [STOP_METHOD],
        position: null,
      }),
    ).toEqual({ kind: 'silent' })
  })

  it('鳴っていれば ringing になる（＝停止画面が出る）', () => {
    const view = deriveRingingView({
      ringingStatus: ringing(['alarm-1']),
      alarms: [ALARM],
      stopMethods: [STOP_METHOD],
      position: null,
    })
    expect(view.kind).toBe('ringing')
  })

  it('鳴動中のアラームに停止方法が無ければ no-method', () => {
    const view = deriveRingingView({
      ringingStatus: ringing(['alarm-1']),
      alarms: [{ ...ALARM, stopMethodId: null }],
      stopMethods: [STOP_METHOD],
      position: null,
    })
    expect(view).toEqual({ kind: 'ringing', target: { kind: 'no-method' } })
  })

  it('停止方法はあるが現在地が未取得なら距離は null（測位待ち）', () => {
    const view = deriveRingingView({
      ringingStatus: ringing(['alarm-1']),
      alarms: [ALARM],
      stopMethods: [STOP_METHOD],
      position: null,
    })
    expect(view).toMatchObject({
      kind: 'ringing',
      target: { kind: 'with-method', distanceToTarget: null, hasArrived: false, position: null },
    })
  })

  it('地図に打つための現在地座標を距離と併せて返す', () => {
    const position = { lat: 35.7, lng: 139.76 }
    const view = deriveRingingView({
      ringingStatus: ringing(['alarm-1']),
      alarms: [ALARM],
      stopMethods: [STOP_METHOD],
      position,
    })
    expect(view).toMatchObject({ target: { kind: 'with-method', position } })
  })

  it('半径の外なら未到達、半径の内なら到達', () => {
    const far = deriveRingingView({
      ringingStatus: ringing(['alarm-1']),
      alarms: [ALARM],
      stopMethods: [STOP_METHOD],
      // 緯度 0.02 度 ≒ 2km 北。20m 半径の外
      position: { lat: 35.7, lng: 139.76 },
    })
    expect(far).toMatchObject({ target: { kind: 'with-method', hasArrived: false } })

    const near = deriveRingingView({
      ringingStatus: ringing(['alarm-1']),
      alarms: [ALARM],
      stopMethods: [STOP_METHOD],
      // 停止地点と同一 → 距離 0 で半径内
      position: { lat: STOP_METHOD.lat, lng: STOP_METHOD.lng },
    })
    expect(near).toMatchObject({ target: { kind: 'with-method', hasArrived: true } })
    if (near.kind === 'ringing' && near.target.kind === 'with-method') {
      expect(near.target.distanceToTarget).toBeCloseTo(0)
    }
  })

  it('複数同時鳴動は先頭のアラームで判定する', () => {
    const second: Alarm = { ...ALARM, id: 'alarm-2', stopMethodId: null }
    const view = deriveRingingView({
      ringingStatus: ringing(['alarm-1', 'alarm-2']),
      alarms: [ALARM, second],
      stopMethods: [STOP_METHOD],
      position: null,
    })
    // 先頭 alarm-1 は停止方法を持つので with-method（2件目の未設定に引きずられない）
    expect(view).toMatchObject({ kind: 'ringing', target: { kind: 'with-method' } })
  })
})
