import { describe, expect, it } from 'vitest'

import { canCreateAlarm, type StopMethod } from '@/lib/stop-method'

const method: StopMethod = {
  id: 'sm-1',
  label: '会社',
  lat: 35.6812,
  lng: 139.7671,
  radiusMeters: 30,
  createdAt: 0,
}

describe('canCreateAlarm', () => {
  it('停止方法が1つも無ければ作成できない', () => {
    expect(canCreateAlarm([])).toBe(false)
  })

  it('停止方法が1つ以上あれば作成できる', () => {
    expect(canCreateAlarm([method])).toBe(true)
    expect(canCreateAlarm([method, { ...method, id: 'sm-2' }])).toBe(true)
  })
})
