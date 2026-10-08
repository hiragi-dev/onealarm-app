import { Clock, Effect, Either, Queue, Ref, type Scope } from 'effect'

import { sortAlarmsByTime, type Alarm, type RingingStatus } from '@/lib/alarm'
import { BrokerUnreachableError } from '@/lib/errors'
import {
  encodeAlarmsPayload,
  encodeStatusPayload,
  parseCommand,
  toAlarm,
  topicsFor,
  type Command,
} from '@/lib/edge/protocol'
import type { EdgeTransport, TransportEvent } from '@/lib/edge/transport'

/**
 * テスト用の transport 実装と、その先にいるダミーのエッジデバイス。
 * 開発ツールの「デモのデバイスに繋ぐ」もこれを使う。
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
 * fake が本物より甘いと「テストは通るが実機で壊れる」が起きるので、逆に振ってある
 * （DECISION.md のテスト戦略）。
 *
 * ## デバイスの振る舞いは実機（onealarm-fw）に合わせる
 *
 * - add / edit / delete / pause / stop は何も返さない（ack も一覧も）
 * - list / ringing_status / status にだけ返事をする
 * - 鳴動中は鳴動状態を自発的に配信する（実機は 1 秒ごと。ここでは状態が変わった時）
 *   が、止まったときは配信しない
 * - pause を受けると「黙っている期限」を持ち、鳴動状態にその旨を載せて配信する。
 *   期限切れは時間の経過で起きるので、そのときは何も言わない（下の encodeRingingStatus）
 * こちらも「実機より甘い fake」にならないよう、返さないものは返さない。
 */

export type DeviceState = {
  readonly alarms: readonly Alarm[]
  readonly ringing: RingingStatus
  /**
   * pause で黙っている期限（epoch ms）。null は黙っていない。
   * 実機（onealarm-fw）の g_muteActive / g_muteUntilMs 相当で、アラームごとではなく
   * 本体に 1 つだけ持つ。pause は上書き式で、送るたびに積み上がることはない
   */
  readonly mutedUntil: number | null
}

export type FakeEdgeOptions = {
  readonly deviceId: string
  readonly alarms?: readonly Alarm[]
  readonly ringing?: RingingStatus
}

export type FakeDevice = {
  readonly getState: Effect.Effect<DeviceState>
  /**
   * アプリの操作によらない状態変化（時刻の到来で鳴り出す、本体のボタンで止まる等）。
   * 鳴っていれば実機と同じく鳴動状態を publish するが、アプリが切断中なら当然届かない。
   */
  readonly mutate: (f: (state: DeviceState) => DeviceState) => Effect.Effect<void>
  /** false にすると受信しても黙る。電源off・フリーズで応答が返らない状況 */
  readonly setResponsive: (responsive: boolean) => Effect.Effect<void>
  /** デバイスが受け取ったコマンドの記録。届いた順に入る */
  readonly receivedCommands: Effect.Effect<readonly Command[]>
}

export type FakeBroker = {
  /** false にすると connect が BrokerUnreachableError で失敗する */
  readonly setReachable: (reachable: boolean, reason?: 'network' | 'auth') => Effect.Effect<void>
  /** アプリの意思と無関係に接続が切れる。電波断・ブローカー再起動 */
  readonly dropConnection: Effect.Effect<void>
  /** アプリが今この瞬間に購読しているトピック */
  readonly subscriptions: Effect.Effect<readonly string[]>
  /**
   * 任意のペイロードをアプリに流し込む。壊れた電文のように
   * まっとうなデバイスからは出てこないものを再現するための口。
   */
  readonly injectDeviceMessage: (topic: string, payload: string) => Effect.Effect<void>
}

export type FakeEdge = {
  readonly transport: EdgeTransport
  readonly device: FakeDevice
  readonly broker: FakeBroker
}

const EMPTY_RINGING: RingingStatus = { isRinging: false, ringingIds: [], mute: { kind: "unknown" } }

/**
 * ringing_status の電文（MQTT API v2.1）。
 *
 * protocol.ts の encoder を使わず、実機の ArduinoJson と同じく生の JSON を組む。
 * デバイスはアプリが読む項目より多くを送ってよい側なので、書き手がアプリの Schema を
 * 共有していると「今のアプリが読める形」しか送れなくなり、項目を増やした実機を
 * アプリ側だけで追従する流れをテストできない。実機はアプリの型を知らないのだから、
 * fake もそれに倣って知らないままにしておく。
 *
 * 残りの時間は「問われた時点」で数え直す（実機の isMuted() と同じ）。期限切れは
 * 時間の経過で起きるのでデバイス側に知らせる契機が無く、アプリは定期問い合わせで気づく。
 */
function encodeRingingStatus(ringing: RingingStatus, muteRemainingMs: number): string {
  // 鳴っていないのに黙っている、という状態は意味を持たないので電文では落とす。
  // 実機の表示も鳴動中にだけ PAUSED と出す（ringing && !isMuted()）
  const remaining = ringing.isRinging ? muteRemainingMs : 0
  return JSON.stringify({
    is_ringing: ringing.isRinging,
    ringing_ids: [...ringing.ringingIds],
    is_muted: remaining > 0,
    mute_remaining_ms: remaining,
  })
}

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
    const received = yield* Ref.make<readonly Command[]>([])
    const alarmSeq = yield* Ref.make(0)
    const deviceState = yield* Ref.make<DeviceState>({
      alarms: [...(options.alarms ?? [])],
      ringing: options.ringing ?? EMPTY_RINGING,
      mutedUntil: null,
    })

    /** デバイス → アプリ。購読していなければ捨てる。溜めもしない */
    const deliverToApp = (topic: string, payload: string) =>
      Effect.gen(function* () {
        const isConnected = yield* Ref.get(connected)
        const subscribed = (yield* Ref.get(subscriptions)).includes(topic)
        if (!isConnected || !subscribed) return
        yield* Queue.offer(events, { kind: 'message', topic, payload })
      })

    const publishAlarms = Effect.gen(function* () {
      const state = yield* Ref.get(deviceState)
      yield* deliverToApp(topics.alarms, encodeAlarmsPayload(sortAlarmsByTime([...state.alarms])))
    })

    const publishRinging = Effect.gen(function* () {
      const state = yield* Ref.get(deviceState)
      const now = yield* Clock.currentTimeMillis
      const remaining = state.mutedUntil === null ? 0 : Math.max(0, state.mutedUntil - now)

      yield* deliverToApp(topics.ringingStatus, encodeRingingStatus(state.ringing, remaining))
    })

    const nextAlarmId = Ref.updateAndGet(alarmSeq, (n) => n + 1).pipe(
      Effect.map((n) => `alarm-${n}`),
    )

    /** コマンドの適用。返事をするのは list / ringing_status / status だけ（実機と同じ） */
    const handleCommand = (command: Command) =>
      Effect.gen(function* () {
        switch (command.type) {
          case 'list':
            yield* publishAlarms
            return
          case 'ringing_status':
            yield* publishRinging
            return
          case 'status':
            yield* deliverToApp(topics.status, encodeStatusPayload(true))
            return
          case 'add': {
            const id = yield* nextAlarmId
            yield* Ref.update(deviceState, (s) => ({
              ...s,
              alarms: [...s.alarms, toAlarm({ id, ...command })],
            }))
            return
          }
          case 'edit':
            yield* Ref.update(deviceState, (s) => {
              const next = toAlarm(command)
              const exists = s.alarms.some((a) => a.id === command.id)
              return {
                ...s,
                // 実機は未知の id なら新規作成する
                alarms: exists ? s.alarms.map((a) => (a.id === command.id ? next : a)) : [...s.alarms, next],
              }
            })
            return
          case 'delete':
            // 存在しないIDでも何も起きない。再送で二度届いても結果が変わらないように
            yield* Ref.update(deviceState, (s) => ({
              ...s,
              alarms: s.alarms.filter((a) => a.id !== command.id),
            }))
            return
          case 'pause': {
            const now = yield* Clock.currentTimeMillis
            const state = yield* Ref.get(deviceState)
            // 実機は鳴っているアラームが無ければ pause を捨てる
            if (!state.ringing.isRinging) return
            yield* Ref.set(deviceState, {
              ...state,
              // 上書き。duration_ms が 0 以下なら黙るのをやめる
              mutedUntil: command.duration_ms > 0 ? now + command.duration_ms : null,
            })
            // ack は返さない。ただし黙ったことは状態の変化なので、鳴動状態として配信する
            yield* publishRinging
            return
          }
          case 'stop':
            yield* Ref.update(deviceState, (s) => ({ ...s, ringing: EMPTY_RINGING }))
            return
        }
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

          const decoded = parseCommand(payload)
          if (Either.isLeft(decoded)) return
          yield* Ref.update(received, (list) => [...list, decoded.right])

          if (!(yield* Ref.get(responsive))) return
          yield* handleCommand(decoded.right)
        }),
    }

    const device: FakeDevice = {
      getState: Ref.get(deviceState),
      mutate: (f) =>
        Ref.update(deviceState, f).pipe(
          Effect.zipRight(Ref.get(deviceState)),
          // 実機は鳴っている間だけ鳴動状態を配信する。止まったときは何も言わない
          Effect.flatMap((s) => (s.ringing.isRinging ? publishRinging : Effect.void)),
        ),
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
