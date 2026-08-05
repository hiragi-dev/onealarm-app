import {
  Duration,
  Effect,
  Either,
  Exit,
  Fiber,
  SubscriptionRef,
  TestClock,
  TestContext,
} from 'effect'
import { describe, expect, it } from 'vitest'

import type { Alarm } from '@/lib/alarm'
import { deriveAlarmManagementReadiness, brokerConnectionFromStatus } from '@/lib/app-state'
import { makeEdgeClient, type EdgeClient, type EdgeState } from '@/lib/edge/client'
import { makeFakeEdge, type FakeBroker, type FakeDevice } from '@/lib/edge/fake-edge'
import type { AlarmInput } from '@/lib/edge/protocol'

/**
 * fake の transport（= セッション永続も retain も持たない通信路）の上で
 * EdgeClient の本物のロジックを動かすテスト。
 *
 * 検証したいことの中心は「ブローカーが何も覚えていなくても手元の状態が
 * デバイスの実際の状態に収束するか」で、そこが担保できていれば
 * ブローカーの実装差やセッションの有効期限を気にしなくてよくなる。
 */

const DEVICE_ID = 'onealarm-test-01'
const TIMEOUT = Duration.seconds(5)

const ALARM_INPUT: AlarmInput = {
  time: '06:30',
  daysOfWeek: ['Mon', 'Tue'],
  isEnabled: true,
  stopMethodId: 'sm-office',
  isNfcEnabled: false,
}

const EXISTING_ALARM: Alarm = {
  id: 'alarm-existing',
  time: '22:00',
  daysOfWeek: ['Sat'],
  isEnabled: true,
  stopMethodId: 'sm-station',
  isNfcEnabled: false,
}

type Fixture = {
  readonly client: EdgeClient
  readonly device: FakeDevice
  readonly broker: FakeBroker
  /** 現在の状態を読む近道 */
  readonly read: Effect.Effect<EdgeState>
}

/**
 * 走らせている fiber（EdgeClient の常駐ループなど）に処理の順番を回す。
 * TestClock は自分で進めない限り時間が流れないので、時間に関係のない
 * やりとりが片付くのを待つにはこれで足りる。
 */
const settle = Effect.yieldNow().pipe(Effect.repeatN(20))

function withEdge(
  run: (fixture: Fixture) => Effect.Effect<unknown, unknown>,
  options: { alarms?: readonly Alarm[] } = {},
): Promise<unknown> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const { transport, device, broker } = yield* makeFakeEdge({
        deviceId: DEVICE_ID,
        alarms: options.alarms,
      })
      const client = yield* makeEdgeClient(transport, {
        deviceId: DEVICE_ID,
        responseTimeout: TIMEOUT,
      })
      return yield* run({ client, device, broker, read: SubscriptionRef.get(client.state) })
    }).pipe(Effect.scoped, Effect.provide(TestContext.TestContext)),
  )
}

describe('接続', () => {
  it('接続すると購読し直し、全状態を取り直す', () =>
    withEdge(
      ({ client, device, broker, read }) =>
        Effect.gen(function* () {
          yield* client.connect

          expect(yield* broker.subscriptions).toEqual([`onealarm/${DEVICE_ID}/evt`])
          expect((yield* device.receivedCommands).map((c) => c.command.kind)).toEqual(['get-state'])

          const state = yield* read
          expect(state.broker).toBe('connected')
          expect(state.edge).toBe('online')
          expect(state.alarms.map((a) => a.id)).toEqual([EXISTING_ALARM.id])
          expect(state.syncedAt).not.toBeNull()
        }),
      { alarms: [EXISTING_ALARM] },
    ))

  it('再接続のたびに購読と全状態取得をやり直す', () =>
    withEdge(({ client, device, broker, read }) =>
      Effect.gen(function* () {
        yield* client.connect
        yield* broker.dropConnection
        yield* settle

        // 切断で購読は消える。ブローカーは何も覚えていない
        expect(yield* broker.subscriptions).toEqual([])

        yield* client.connect

        expect(yield* broker.subscriptions).toEqual([`onealarm/${DEVICE_ID}/evt`])
        expect((yield* device.receivedCommands).map((c) => c.command.kind)).toEqual([
          'get-state',
          'get-state',
        ])
        expect((yield* read).syncedAt).not.toBeNull()
      }),
    ))

  it('切断中の変化は1通も届かないが、再接続すればデバイスの現状に追いつく', () =>
    withEdge(
      ({ client, device, broker, read }) =>
        Effect.gen(function* () {
          yield* client.connect
          expect((yield* read).alarms.map((a) => a.id)).toEqual([EXISTING_ALARM.id])

          yield* broker.dropConnection
          yield* settle

          // 切断中にデバイス側だけが変わる。この publish はどこにも溜まらず消える
          yield* device.mutate(() => ({
            alarms: [{ ...EXISTING_ALARM, id: 'alarm-added-while-offline', time: '05:00' }],
            ringing: { isRinging: true, ringingIds: ['alarm-added-while-offline'] },
          }))
          yield* settle

          // 届いていないので、切断中の手元は「分からない」まま
          const offline = yield* read
          expect(offline.syncedAt).toBeNull()
          expect(offline.ringing).toBeNull()

          yield* client.connect

          // 差分を1つも受け取っていないのに、デバイスの現状と一致する
          const online = yield* read
          expect(online.alarms.map((a) => a.id)).toEqual(['alarm-added-while-offline'])
          expect(online.ringing).toEqual({
            isRinging: true,
            ringingIds: ['alarm-added-while-offline'],
          })
        }),
      { alarms: [EXISTING_ALARM] },
    ))

  it('切断すると「確認済み」の印を落とす', () =>
    withEdge(
      ({ client, broker, read }) =>
        Effect.gen(function* () {
          yield* client.connect
          expect((yield* read).syncedAt).not.toBeNull()

          yield* broker.dropConnection
          yield* settle

          const state = yield* read
          expect(state.broker).toBe('disconnected')
          expect(state.edge).toBe('unknown')
          expect(state.ringing).toBeNull()
          // 一覧の中身は残るが「確かめられていない」扱いになる（UI はスケルトンにできる）
          expect(state.syncedAt).toBeNull()
          expect(state.alarms.map((a) => a.id)).toEqual([EXISTING_ALARM.id])
        }),
      { alarms: [EXISTING_ALARM] },
    ))

  it('ブローカーに繋がらなければ BrokerUnreachableError になり、状態は error になる', () =>
    withEdge(({ client, broker, read }) =>
      Effect.gen(function* () {
        yield* broker.setReachable(false, 'auth')

        const result = yield* Effect.either(client.connect)
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('BrokerUnreachableError')
        }
        expect((yield* read).broker).toBe('error')
      }),
    ))

  it('デバイスが応答しなければ接続がタイムアウトし、ブローカーは繋がったまま edge が offline になる', () =>
    withEdge(({ client, device, read }) =>
      Effect.gen(function* () {
        yield* device.setResponsive(false)

        const fiber = yield* Effect.fork(Effect.either(client.connect))
        yield* settle
        yield* TestClock.adjust(Duration.seconds(6))
        const result = yield* Fiber.join(fiber)

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('EdgeTimeoutError')
        }

        const state = yield* read
        // 通信路は生きている。応答が無いのはデバイスの側
        expect(state.broker).toBe('connected')
        expect(state.edge).toBe('offline')

        const readiness = deriveAlarmManagementReadiness(
          brokerConnectionFromStatus(state.broker),
          state.edge,
        )
        expect(readiness).toEqual({ kind: 'blocked', reasons: [{ kind: 'edge-offline' }] })
      }),
    ))
})

describe('コマンド', () => {
  it('アラームを追加すると、ID はデバイスが採番した値で一覧に入る', () =>
    withEdge(({ client, read }) =>
      Effect.gen(function* () {
        yield* client.connect
        yield* client.addAlarm(ALARM_INPUT)

        // ack が返った時点で手元の一覧も新しくなっている（状態→ack の順で返る取り決め）
        const state = yield* read
        expect(state.alarms).toHaveLength(1)
        expect(state.alarms[0]?.id).toBe('alarm-1')
        expect(state.alarms[0]?.time).toBe(ALARM_INPUT.time)
      }),
    ))

  it('変更・削除もデバイスの返す全状態で置き換わる', () =>
    withEdge(
      ({ client, read }) =>
        Effect.gen(function* () {
          yield* client.connect

          yield* client.editAlarm(EXISTING_ALARM.id, { ...ALARM_INPUT, time: '07:15' })
          expect((yield* read).alarms[0]?.time).toBe('07:15')

          yield* client.deleteAlarm(EXISTING_ALARM.id)
          expect((yield* read).alarms).toEqual([])
        }),
      { alarms: [EXISTING_ALARM] },
    ))

  it('同じ削除が二度届いても結果は変わらない', () =>
    withEdge(
      ({ client, read }) =>
        Effect.gen(function* () {
          yield* client.connect
          yield* client.deleteAlarm(EXISTING_ALARM.id)
          yield* client.deleteAlarm(EXISTING_ALARM.id)
          expect((yield* read).alarms).toEqual([])
        }),
      { alarms: [EXISTING_ALARM] },
    ))

  it('未接続では送信そのものを行わない', () =>
    withEdge(({ client, device }) =>
      Effect.gen(function* () {
        const result = yield* Effect.either(client.setPower('on'))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('BrokerNotConnectedError')
        }
        // 送信待ちに積まれることもない
        expect(yield* device.receivedCommands).toEqual([])
      }),
    ))

  it('応答が返らないコマンドはタイムアウトし、以後は待たずに offline として失敗する', () =>
    withEdge(({ client, device, read }) =>
      Effect.gen(function* () {
        yield* client.connect
        yield* device.setResponsive(false)

        const fiber = yield* Effect.fork(Effect.either(client.setPower('on')))
        yield* settle
        yield* TestClock.adjust(Duration.seconds(6))
        const first = yield* Fiber.join(fiber)

        expect(Either.isLeft(first)).toBe(true)
        if (Either.isLeft(first)) {
          expect(first.left._tag).toBe('EdgeTimeoutError')
        }
        expect((yield* read).edge).toBe('offline')

        // 2回目は時間を進めずに即座に失敗する（もう応答しないと分かっているため）
        const second = yield* Effect.either(client.setPower('off'))
        expect(Either.isLeft(second)).toBe(true)
        if (Either.isLeft(second)) {
          expect(second.left._tag).toBe('EdgeOfflineError')
        }
      }),
    ))

  it('応答待ちの最中に切断したら、タイムアウトを待たずに諦める', () =>
    withEdge(({ client, device, broker }) =>
      Effect.gen(function* () {
        yield* client.connect
        yield* device.setResponsive(false)

        const fiber = yield* Effect.fork(Effect.either(client.addAlarm(ALARM_INPUT)))
        yield* settle
        yield* broker.dropConnection

        // TestClock を1msも進めずに決着する＝タイムアウト待ちではない
        const result = yield* Fiber.join(fiber)
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('BrokerNotConnectedError')
        }
      }),
    ))
})

describe('鳴動', () => {
  it('鳴動はデバイス側から届き、停止コマンドで消える', () =>
    withEdge(
      ({ client, device, read }) =>
        Effect.gen(function* () {
          yield* client.connect

          yield* device.mutate((s) => ({
            ...s,
            ringing: { isRinging: true, ringingIds: [EXISTING_ALARM.id] },
          }))
          yield* settle
          expect((yield* read).ringing).toEqual({
            isRinging: true,
            ringingIds: [EXISTING_ALARM.id],
          })

          yield* client.stopRinging
          expect((yield* read).ringing).toEqual({ isRinging: false, ringingIds: [] })
        }),
      { alarms: [EXISTING_ALARM] },
    ))
})

describe('まっとうでない受信', () => {
  it('壊れた電文と、知らない requestId の ack は捨てて動き続ける', () =>
    withEdge(({ client, broker, read }) =>
      Effect.gen(function* () {
        yield* client.connect

        yield* broker.injectDeviceMessage('これは JSON ですらない')
        yield* broker.injectDeviceMessage('{"kind":"unknown-kind"}')
        // 取り消されたあとに遅れて届いた ack のつもり
        yield* broker.injectDeviceMessage('{"kind":"ack","requestId":"req-999"}')
        yield* settle

        // 常駐ループが生きているので、続く操作は普通に通る
        yield* client.addAlarm(ALARM_INPUT)
        expect((yield* read).alarms).toHaveLength(1)
      }),
    ))

  it('重複した ack で次のコマンドが誤って完了しない', () =>
    withEdge(({ client, device, broker }) =>
      Effect.gen(function* () {
        yield* client.connect
        yield* client.addAlarm(ALARM_INPUT)

        // 直前のコマンドの ack がもう一度届く（requestId は使い終わっている）
        const used = (yield* device.receivedCommands).at(-1)?.requestId ?? ''
        yield* broker.injectDeviceMessage(`{"kind":"ack","requestId":"${used}"}`)
        yield* settle

        // 応答しないデバイスへの次のコマンドが、その ack で完了扱いにならない
        yield* device.setResponsive(false)
        const fiber = yield* Effect.fork(Effect.exit(client.addAlarm(ALARM_INPUT)))
        yield* settle
        yield* TestClock.adjust(Duration.seconds(6))
        const exit = yield* Fiber.join(fiber)

        expect(Exit.isFailure(exit)).toBe(true)
      }),
    ))
})
