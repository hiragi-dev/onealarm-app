import { describe, expect, it } from 'vitest'

import type { Alarm } from '@/lib/alarm'
import type { StopMethod } from '@/lib/stop-method'
import { deriveWalkGate } from '@/lib/walk-gate'

/**
 * 「歩行検知を有効にする地点」の判断の検証。
 *
 * NFC 認証を手で実行して歩行検知の一時停止を得る抜け道を塞ぐための仕組みなので、
 * 「着くまでは閉じている」「着いたら開く」「一度開いたら閉じ直さない」を固定する。
 */

const POINT: StopMethod = {
  id: 'sm-station',
  label: '駅',
  lat: 35.68,
  lng: 139.76,
  radiusMeters: 30,
  createdAt: 0,
}

const alarm = (walkUnlockPointId: string | null): Alarm => ({
  id: 'alarm-1',
  time: '06:30',
  daysOfWeek: ['Mon'],
  isEnabled: true,
  stopMethodId: 'sm-office',
  isNfcEnabled: false,
  walkUnlockPointId,
})

/** 半径 30m の地点から約 220m 離れた位置 */
const FAR = { lat: 35.682, lng: 139.76 }

describe('deriveWalkGate', () => {
  it('地点を設定していなければ最初から開いている', () => {
    expect(
      deriveWalkGate({ alarm: alarm(null), stopMethods: [POINT], position: FAR, unlocked: false }),
    ).toEqual({ kind: 'open' })
  })

  it('鳴っているアラームが無ければ開いている', () => {
    expect(
      deriveWalkGate({ alarm: undefined, stopMethods: [POINT], position: FAR, unlocked: false }),
    ).toEqual({ kind: 'open' })
  })

  it('地点から離れている間は閉じていて、距離を持つ', () => {
    const gate = deriveWalkGate({
      alarm: alarm('sm-station'),
      stopMethods: [POINT],
      position: FAR,
      unlocked: false,
    })
    expect(gate.kind).toBe('locked')
    if (gate.kind !== 'locked') return
    expect(gate.point.id).toBe('sm-station')
    expect(gate.distance).toBeGreaterThan(POINT.radiusMeters)
    expect(gate.arrived).toBe(false)
  })

  it('現在地が未取得でも閉じたまま。距離だけ null になる', () => {
    const gate = deriveWalkGate({
      alarm: alarm('sm-station'),
      stopMethods: [POINT],
      position: null,
      unlocked: false,
    })
    expect(gate).toMatchObject({ kind: 'locked', distance: null, arrived: false })
  })

  it('半径に入ると到達になる', () => {
    const gate = deriveWalkGate({
      alarm: alarm('sm-station'),
      stopMethods: [POINT],
      position: { lat: POINT.lat + 0.0001, lng: POINT.lng },
      unlocked: false,
    })
    expect(gate).toMatchObject({ kind: 'locked', arrived: true })
  })

  it('一度開いたら、地点を離れていても開いたまま', () => {
    expect(
      deriveWalkGate({
        alarm: alarm('sm-station'),
        stopMethods: [POINT],
        position: FAR,
        unlocked: true,
      }),
    ).toEqual({ kind: 'open' })
  })

  it('参照先の地点が消えていたら閉じない（開けられない鍵にしない）', () => {
    expect(
      deriveWalkGate({
        alarm: alarm('sm-deleted'),
        stopMethods: [POINT],
        position: FAR,
        unlocked: false,
      }),
    ).toEqual({ kind: 'open' })
  })
})
