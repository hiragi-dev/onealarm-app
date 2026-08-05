import { Effect, Either, Queue, Ref, type Scope } from 'effect'

import type { Alarm } from '@/lib/alarm'
import { BrokerUnreachableError } from '@/lib/errors'
import {
  encodeDeviceMessagePayload,
  parseCommandEnvelope,
  topicsFor,
  type CommandEnvelope,
  type DeviceState,
} from '@/lib/edge/protocol'
import type { EdgeTransport, TransportEvent } from '@/lib/edge/transport'

/**
 * テスト用の transport 実装と、その先にいるダミーのエッジデバイス。
 *
 * ## ここで意図的に「できない」ようにしていること
 *
 * 実ブローカーを使わない代わりに、この fake は本物より**冷たく**振る舞う。
 *
 * - 切断中に publish されたメッセージは捨てる。再接続しても二度と届かない
 * - 切断すると購読も消える。再接続後に subscribe し直さないと何も受け取れない
 * - retain がない。後から繋いだ人に過去の値を配ることはない
 *
 * つまり、ブローカーのセッション永続や retain に頼るコードを書くと必ずテストが落ちる。
 * fake が本物より甘いと「テストは通るが実機で壊れる」が起きるので、逆に振ってある。
 * この3点を捨てても成立する設計にしておけば、ブローカーの実装差に悩まされない
 * （DECISION.md のテスト戦略）。
 */

export type FakeEdgeOptions = {
  readonly deviceId: string
  readonly alarms?: readonly Alarm[]
  readonly ringing?: { isRinging: boolean; ringingIds: string[] }
}

export type FakeDevice = {
  readonly getState: Effect.Effect<DeviceState>
  /**
   * アプリの操作によらない状態変化（時刻の到来で鳴り出す、本体のボタンで止まる等）。
   * 変化した状態は publish するが、アプリが切断中なら当然届かない。
   */
  readonly mutate: (f: (state: DeviceState) => DeviceState) => Effect.Effect<void>
  /** false にすると受信しても黙る。電源off・フリーズで応答が返らない状況 */
  readonly setResponsive: (responsive: boolean) => Effect.Effect<void>
  /** デバイスが受け取ったコマンドの記録。届いた順に入る */
  readonly receivedCommands: Effect.Effect<readonly CommandEnvelope[]>
}

export type FakeBroker = {
  /** false にすると connect が BrokerUnreachableError で失敗する */
  readonly setReachable: (reachable: boolean, reason?: 'network' | 'auth') => Effect.Effect<void>
  /** アプリの意思と無関係に接続が切れる。電波断・ブローカー再起動 */
  readonly dropConnection: Effect.Effect<void>
  /** アプリが今この瞬間に購読しているトピック */
  readonly subscriptions: Effect.Effect<readonly string[]>
  /**
   * 任意のペイロードをアプリに流し込む。壊れた電文や、遅れて届いた ack のように
   * まっとうなデバイスからは出てこないものを再現するための口。
   */
  readonly injectDeviceMessage: (payload: string) => Effect.Effect<void>
}

export type FakeEdge = {
  readonly transport: EdgeTransport
  readonly device: FakeDevice
  readonly broker: FakeBroker
}

const EMPTY_RINGING = { isRinging: false, ringingIds: [] as string[] }

export function makeFakeEdge(
  options: FakeEdgeOptions,
): Effect.Effect<FakeEdge, never, Scope.Scope> {
  return Effect.gen(function* () {
    const topics = topicsFor(options.deviceId)

    const events = yield* Effect.acquireRelease(Queue.unbounded<TransportEvent>(), Queue.shutdown)

    const connected = yield* Ref.make(false)
    const reachable = yield* Ref.make<{ ok: boolean; reason: 'network' | 'auth' }>({
      ok: true,
      reason: 'network',
    })
    const subscriptions = yield* Ref.make<readonly string[]>([])
    const responsive = yield* Ref.make(true)
    const received = yield* Ref.make<readonly CommandEnvelope[]>([])
    const alarmSeq = yield* Ref.make(0)
    const deviceState = yield* Ref.make<DeviceState>({
      alarms: [...(options.alarms ?? [])],
      ringing: options.ringing ?? { ...EMPTY_RINGING },
    })

    /** デバイス → アプリ。購読していなければ捨てる。溜めもしない */
    const deliverToApp = (payload: string) =>
      Effect.gen(function* () {
        const isConnected = yield* Ref.get(connected)
        const subscribed = (yield* Ref.get(subscriptions)).includes(topics.event)
        if (!isConnected || !subscribed) return
        yield* Queue.offer(events, { kind: 'message', topic: topics.event, payload })
      })

    const publishState = Effect.gen(function* () {
      const state = yield* Ref.get(deviceState)
      yield* deliverToApp(encodeDeviceMessagePayload({ kind: 'state', state }))
    })

    const nextAlarmId = Ref.updateAndGet(alarmSeq, (n) => n + 1).pipe(
      Effect.map((n) => `alarm-${n}`),
    )

    /**
     * コマンドの適用。
     *
     * 応答は必ず「新しい全状態 → ack」の順で返す。逆にすると、ack を受けた呼び出し側が
     * まだ古い一覧を見ている瞬間ができてしまう。この順序は取り決めの一部。
     */
    const handleCommand = (envelope: CommandEnvelope) =>
      Effect.gen(function* () {
        const { command } = envelope

        switch (command.kind) {
          case 'get-state':
            // 状態を返すことが応答そのものなので ack は返さない
            yield* publishState
            return
          case 'set-power':
            break
          case 'add-alarm': {
            const id = yield* nextAlarmId
            yield* Ref.update(deviceState, (s) => ({
              ...s,
              alarms: [...s.alarms, { id, ...command.alarm }],
            }))
            break
          }
          case 'edit-alarm':
            yield* Ref.update(deviceState, (s) => ({
              ...s,
              alarms: s.alarms.map((a) =>
                a.id === command.id ? { id: a.id, ...command.alarm } : a,
              ),
            }))
            break
          case 'delete-alarm':
            // 存在しないIDでも成功扱いにする。再送で二度届いても結果が変わらないように
            yield* Ref.update(deviceState, (s) => ({
              ...s,
              alarms: s.alarms.filter((a) => a.id !== command.id),
            }))
            break
          case 'stop-ringing':
            yield* Ref.update(deviceState, (s) => ({ ...s, ringing: { ...EMPTY_RINGING } }))
            break
        }

        yield* publishState
        yield* deliverToApp(
          encodeDeviceMessagePayload({ kind: 'ack', requestId: envelope.requestId }),
        )
      })

    const transport: EdgeTransport = {
      events,

      connect: Effect.gen(function* () {
        const { ok, reason } = yield* Ref.get(reachable)
        if (!ok) return yield* Effect.fail(new BrokerUnreachableError({ reason }))
        yield* Ref.set(connected, true)
        yield* Queue.offer(events, { kind: 'connected' })
      }),

      disconnect: Effect.gen(function* () {
        const wasConnected = yield* Ref.getAndSet(connected, false)
        // 購読はブローカー側に残らない
        yield* Ref.set(subscriptions, [])
        if (wasConnected) yield* Queue.offer(events, { kind: 'disconnected' })
      }),

      subscribe: (topic) =>
        Effect.gen(function* () {
          if (!(yield* Ref.get(connected))) return
          yield* Ref.update(subscriptions, (list) =>
            list.includes(topic) ? list : [...list, topic],
          )
        }),

      publish: (topic, payload) =>
        Effect.gen(function* () {
          // 未接続の publish は送信待ちに積まれず消える
          if (!(yield* Ref.get(connected))) return
          if (topic !== topics.command) return

          const decoded = parseCommandEnvelope(payload)
          if (Either.isLeft(decoded)) return
          yield* Ref.update(received, (list) => [...list, decoded.right])

          if (!(yield* Ref.get(responsive))) return
          yield* handleCommand(decoded.right)
        }),
    }

    const device: FakeDevice = {
      getState: Ref.get(deviceState),
      mutate: (f) => Ref.update(deviceState, f).pipe(Effect.zipRight(publishState)),
      setResponsive: (value) => Ref.set(responsive, value),
      receivedCommands: Ref.get(received),
    }

    const broker: FakeBroker = {
      setReachable: (ok, reason = 'network') => Ref.set(reachable, { ok, reason }),
      dropConnection: Effect.gen(function* () {
        const wasConnected = yield* Ref.getAndSet(connected, false)
        yield* Ref.set(subscriptions, [])
        if (wasConnected) yield* Queue.offer(events, { kind: 'disconnected' })
      }),
      subscriptions: Ref.get(subscriptions),
      injectDeviceMessage: deliverToApp,
    }

    return { transport, device, broker }
  })
}
