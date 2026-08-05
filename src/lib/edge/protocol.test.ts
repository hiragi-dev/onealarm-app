import { Either } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  encodeCommandEnvelope,
  encodeDeviceMessagePayload,
  parseCommandEnvelope,
  parseDeviceMessage,
  topicsFor,
  type CommandEnvelope,
  type DeviceMessage,
} from '@/lib/edge/protocol'

/**
 * 電文の読み書き。ここが片側だけ変わると、実機に繋いだ瞬間に静かに壊れるので、
 * 送る側と受け取る側の対称性をテストで固定しておく。
 */

describe('トピック', () => {
  it('デバイスIDで名前空間を切り、向きごとに1本ずつ', () => {
    expect(topicsFor('dev-1')).toEqual({
      command: 'onealarm/dev-1/cmd',
      event: 'onealarm/dev-1/evt',
    })
  })
})

describe('コマンド', () => {
  it('書いたものがそのまま読める', () => {
    const envelope: CommandEnvelope = {
      requestId: 'req-1',
      command: {
        kind: 'add-alarm',
        alarm: {
          time: '06:30',
          daysOfWeek: ['Mon', 'Sun'],
          isEnabled: true,
          stopMethodId: 'sm-1',
          isNfcEnabled: false,
        },
      },
    }

    const decoded = parseCommandEnvelope(encodeCommandEnvelope(envelope))
    expect(Either.isRight(decoded)).toBe(true)
    if (Either.isRight(decoded)) expect(decoded.right).toEqual(envelope)
  })

  it('知らない曜日は受け付けない', () => {
    const payload = JSON.stringify({
      requestId: 'req-1',
      command: {
        kind: 'add-alarm',
        alarm: {
          time: '06:30',
          daysOfWeek: ['Funday'],
          isEnabled: true,
          stopMethodId: null,
          isNfcEnabled: false,
        },
      },
    })
    expect(Either.isLeft(parseCommandEnvelope(payload))).toBe(true)
  })
})

describe('デバイスからの電文', () => {
  it('全状態を書いてそのまま読める', () => {
    const message: DeviceMessage = {
      kind: 'state',
      state: {
        alarms: [
          {
            id: 'alarm-1',
            time: '07:00',
            daysOfWeek: ['Fri'],
            isEnabled: false,
            stopMethodId: null,
            isNfcEnabled: true,
          },
        ],
        ringing: { isRinging: true, ringingIds: ['alarm-1'] },
      },
    }

    const decoded = parseDeviceMessage(encodeDeviceMessagePayload(message))
    expect(Either.isRight(decoded)).toBe(true)
    if (Either.isRight(decoded)) expect(decoded.right).toEqual(message)
  })

  it('壊れた電文・欠けた電文・知らない種類は Left になる', () => {
    expect(Either.isLeft(parseDeviceMessage('{'))).toBe(true)
    expect(Either.isLeft(parseDeviceMessage('{"kind":"state"}'))).toBe(true)
    expect(Either.isLeft(parseDeviceMessage('{"kind":"reboot"}'))).toBe(true)
  })
})
