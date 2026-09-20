import { Either } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  alarmCommandFields,
  encodeAlarmsPayload,
  encodeCommand,
  encodeRingingPayload,
  parseCommand,
  parseDeviceMessage,
  topicsFor,
  type Command,
} from '@/lib/edge/protocol'

/**
 * 電文の読み書き。ここが片側だけ変わると、実機に繋いだ瞬間に静かに壊れるので、
 * 実機（onealarm-fw）の JSON の形をそのまま固定しておく。
 */

const TOPICS = topicsFor('dev-1')

describe('トピック', () => {
  it('実機と同じ eager-alarm/<id>/ の 4 本', () => {
    expect(TOPICS).toEqual({
      command: 'eager-alarm/dev-1/command',
      alarms: 'eager-alarm/dev-1/alarms',
      status: 'eager-alarm/dev-1/status',
      ringingStatus: 'eager-alarm/dev-1/ringing_status',
    })
  })
})

describe('コマンド', () => {
  it('add は snake_case で、NFC は常に無効で送る', () => {
    const command: Command = {
      type: 'add',
      ...alarmCommandFields({
        time: '06:30',
        daysOfWeek: ['Mon', 'Sun'],
        isEnabled: true,
        stopMethodId: 'sm-1',
        walkUnlockPointId: 'sm-2',
      }),
    }
    const json = JSON.parse(encodeCommand(command))
    expect(json).toEqual({
      type: 'add',
      time: '06:30',
      days_of_week: ['Mon', 'Sun'],
      is_enabled: true,
      stop_method_id: 'sm-1',
      is_nfc_enabled: false,
    })
    // walkUnlockPointId はデバイスが知らないので送らない
    expect(json).not.toHaveProperty('walk_unlock_point_id')
  })

  it('書いたものがそのまま読める', () => {
    const command: Command = { type: 'pause', duration_ms: 5000 }
    const decoded = parseCommand(encodeCommand(command))
    expect(Either.isRight(decoded)).toBe(true)
    if (Either.isRight(decoded)) expect(decoded.right).toEqual(command)
  })

  it('知らない曜日は受け付けない', () => {
    const payload = JSON.stringify({
      type: 'add',
      time: '06:30',
      days_of_week: ['Funday'],
      is_enabled: true,
      stop_method_id: null,
      is_nfc_enabled: false,
    })
    expect(Either.isLeft(parseCommand(payload))).toBe(true)
  })
})

describe('デバイスからの電文', () => {
  it('一覧はアプリの Alarm に変換され、デバイスが持たない項目は既定値になる', () => {
    const payload = JSON.stringify([
      {
        id: 'alarm-1',
        time: '07:00',
        days_of_week: ['Fri'],
        is_enabled: false,
        stop_method_id: 'sm-1',
        // 実機が付けてくる余分な項目は無視する
        is_nfc_enabled: false,
        is_nfc_verified: false,
      },
      // 古い個体は is_enabled / stop_method_id を欠くことがある
      { id: 'alarm-2', time: '08:00', days_of_week: [] },
    ])
    const decoded = parseDeviceMessage(TOPICS, TOPICS.alarms, payload)
    expect(Either.isRight(decoded)).toBe(true)
    if (Either.isRight(decoded) && decoded.right.kind === 'alarms') {
      expect(decoded.right.alarms).toEqual([
        {
          id: 'alarm-1',
          time: '07:00',
          daysOfWeek: ['Fri'],
          isEnabled: false,
          stopMethodId: 'sm-1',
          walkUnlockPointId: null,
        },
        {
          id: 'alarm-2',
          time: '08:00',
          daysOfWeek: [],
          isEnabled: true,
          stopMethodId: null,
          walkUnlockPointId: null,
        },
      ])
    }
  })

  it('鳴動状態と生存はトピックで読み分ける', () => {
    const ringing = parseDeviceMessage(
      TOPICS,
      TOPICS.ringingStatus,
      encodeRingingPayload({ isRinging: true, ringingIds: ['alarm-1'] }),
    )
    expect(Either.isRight(ringing)).toBe(true)
    if (Either.isRight(ringing)) {
      expect(ringing.right).toEqual({
        kind: 'ringing',
        ringing: { isRinging: true, ringingIds: ['alarm-1'] },
      })
    }

    const status = parseDeviceMessage(TOPICS, TOPICS.status, '{"online":true}')
    expect(Either.isRight(status)).toBe(true)
    if (Either.isRight(status)) expect(status.right).toEqual({ kind: 'status', online: true })
  })

  it('fake が書いた一覧を読むと元に戻る（実装対称性）', () => {
    const alarms = [
      {
        id: 'a',
        time: '05:00',
        daysOfWeek: ['Mon' as const],
        isEnabled: true,
        stopMethodId: null,
        walkUnlockPointId: null,
      },
    ]
    const decoded = parseDeviceMessage(TOPICS, TOPICS.alarms, encodeAlarmsPayload(alarms))
    expect(Either.isRight(decoded)).toBe(true)
    if (Either.isRight(decoded) && decoded.right.kind === 'alarms') {
      expect(decoded.right.alarms).toEqual(alarms)
    }
  })

  it('壊れた電文・知らないトピックは Left になる', () => {
    expect(Either.isLeft(parseDeviceMessage(TOPICS, TOPICS.alarms, '{'))).toBe(true)
    expect(Either.isLeft(parseDeviceMessage(TOPICS, TOPICS.ringingStatus, '{}'))).toBe(true)
    expect(Either.isLeft(parseDeviceMessage(TOPICS, 'eager-alarm/dev-1/other', '{}'))).toBe(true)
  })
})
