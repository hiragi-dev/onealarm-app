import {
  Clock,
  Deferred,
  Duration,
  Effect,
  Either,
  HashMap,
  Option,
  Queue,
  Ref,
  Stream,
  SubscriptionRef,
  type Scope,
} from 'effect'

import { sortAlarmsByTime, type Alarm, type RingingStatus } from '@/lib/alarm'
import type { BrokerStatus, EdgeDeviceStatus } from '@/lib/app-state'
import {
  BrokerNotConnectedError,
  EdgeOfflineError,
  EdgeTimeoutError,
  type BrokerUnreachableError,
} from '@/lib/errors'
import {
  encodeCommandEnvelope,
  parseDeviceMessage,
  topicsFor,
  type AlarmInput,
  type Command,
} from '@/lib/edge/protocol'
import type { EdgeTransport, TransportEvent } from '@/lib/edge/transport'

/**
 * エッジデバイスとのやりとりを担う本体。transport（ポート）の上に載る。
 *
 * ## セッション永続に依存しない
 *
 * 切断中にブローカーがメッセージを溜めておいてくれることを一切あてにしない。
 * 代わりに、接続イベントを受けるたびに必ず
 *   1. イベントトピックを購読し直す
 *   2. 全状態（get-state）を要求する
 * を行い、届いた state で手元を丸ごと置き換える。
 * 差分を積み上げないので「切断中に取りこぼした1通のせいで表示が恒久的にずれる」
 * という壊れ方が構造的に起きない。
 *
 * ## エッジの生死
 *
 * LWT も retain も使わないため、デバイスが生きているかは**応答が返るかどうか**だけで
 * 判断する。state が届けば online、応答が時間内に来なければ offline、
 * 接続していない間は unknown。
 */

export type EdgeState = {
  readonly broker: BrokerStatus
  readonly edge: EdgeDeviceStatus
  readonly alarms: readonly Alarm[]
  readonly ringing: RingingStatus | null
  /**
   * 全状態を最後に受け取った時刻。null は「今の手元の内容は確かめられていない」。
   * 接続中・再接続直後もここは null に戻る（UI はスケルトンを出せばよい）。
   */
  readonly syncedAt: number | null
}

/** コマンド送信が失敗しうる理由 */
export type CommandError = BrokerNotConnectedError | EdgeOfflineError | EdgeTimeoutError

export type EdgeClient = {
  /** 現在の状態。UI からは購読して使う */
  readonly state: SubscriptionRef.SubscriptionRef<EdgeState>
  readonly connect: Effect.Effect<void, BrokerUnreachableError | EdgeTimeoutError>
  readonly disconnect: Effect.Effect<void>
  readonly setPower: (power: 'on' | 'off') => Effect.Effect<void, CommandError>
  readonly addAlarm: (alarm: AlarmInput) => Effect.Effect<void, CommandError>
  readonly editAlarm: (id: string, alarm: AlarmInput) => Effect.Effect<void, CommandError>
  readonly deleteAlarm: (id: string) => Effect.Effect<void, CommandError>
  readonly stopRinging: Effect.Effect<void, CommandError>
}

export type EdgeClientOptions = {
  readonly deviceId: string
  /** ack と接続時の全状態取得を待つ上限 */
  readonly responseTimeout?: Duration.DurationInput
}

const DEFAULT_RESPONSE_TIMEOUT = Duration.seconds(5)

const INITIAL_STATE: EdgeState = {
  broker: 'disconnected',
  edge: 'unknown',
  alarms: [],
  ringing: null,
  syncedAt: null,
}

/** 応答待ちのコマンド1件。切断時にどの操作が宙に浮いたかを言えるよう operation を持つ */
type PendingRequest = {
  readonly operation: string
  readonly deferred: Deferred.Deferred<void, BrokerNotConnectedError>
}

export function makeEdgeClient(
  transport: EdgeTransport,
  options: EdgeClientOptions,
): Effect.Effect<EdgeClient, never, Scope.Scope> {
  return Effect.gen(function* () {
    const topics = topicsFor(options.deviceId)
    const timeout = Duration.decode(options.responseTimeout ?? DEFAULT_RESPONSE_TIMEOUT)
    const timeoutMs = Duration.toMillis(timeout)

    const state = yield* SubscriptionRef.make(INITIAL_STATE)
    const pending = yield* Ref.make(HashMap.empty<string, PendingRequest>())
    const requestSeq = yield* Ref.make(0)

    // requestId は連番。乱数にしないのはテストで電文をそのまま比較できるようにするため
    const nextRequestId = Ref.updateAndGet(requestSeq, (n) => n + 1).pipe(
      Effect.map((n) => `req-${n}`),
    )

    const send = (command: Command) =>
      Effect.gen(function* () {
        const requestId = yield* nextRequestId
        yield* transport.publish(topics.command, encodeCommandEnvelope({ requestId, command }))
        return requestId
      })

    /**
     * 接続のたびに行う同期。ここがこの設計の要。
     * 購読はブローカーに覚えさせないので毎回張り直し、状態は毎回まるごと取り直す。
     */
    const resync = Effect.gen(function* () {
      yield* transport.subscribe(topics.event)
      yield* send({ kind: 'get-state' })
    })

    /** 接続が切れた（切った）ときの状態の落とし方。ループからも disconnect からも呼ぶ */
    const applyDisconnected = Effect.gen(function* () {
      // 待っている ack はもう届かない。タイムアウトまで待たせず即座に諦めさせる
      const requests = yield* Ref.getAndSet(pending, HashMap.empty<string, PendingRequest>())
      yield* Effect.forEach(
        HashMap.values(requests),
        (request) =>
          Deferred.fail(
            request.deferred,
            new BrokerNotConnectedError({ operation: request.operation }),
          ),
        { discard: true },
      )
      yield* SubscriptionRef.update(state, (s) => ({
        ...s,
        broker: 'disconnected' as const,
        edge: 'unknown' as const,
        ringing: null,
        syncedAt: null,
      }))
    })

    const handleDeviceMessage = (payload: string) =>
      Effect.gen(function* () {
        const decoded = parseDeviceMessage(payload)
        // 壊れた電文で常駐ループを落とさない。1通捨てて次を待つ
        if (Either.isLeft(decoded)) return
        const message = decoded.right

        if (message.kind === 'state') {
          const now = yield* Clock.currentTimeMillis
          yield* SubscriptionRef.update(state, (s) => ({
            ...s,
            // 応答が返った＝デバイスは生きている
            edge: 'online' as const,
            // 差分を当てるのではなく置き換える
            alarms: sortAlarmsByTime(message.state.alarms),
            ringing: message.state.ringing,
            syncedAt: now,
          }))
          return
        }

        const request = HashMap.get(yield* Ref.get(pending), message.requestId)
        // 知らない requestId の ack（遅れて届いた・重複した）は捨てる
        if (Option.isNone(request)) return
        yield* Deferred.succeed(request.value.deferred, undefined)
      })

    const handleEvent = (event: TransportEvent) => {
      switch (event.kind) {
        case 'connected':
          return SubscriptionRef.update(state, (s) => ({
            ...s,
            broker: 'connected' as const,
            // 繋がった直後はまだ何も分かっていない。ここを維持すると
            // 切断前の古い一覧を「確認済み」として扱ってしまう
            edge: 'unknown' as const,
            ringing: null,
            syncedAt: null,
          })).pipe(Effect.zipRight(resync))
        case 'disconnected':
          return applyDisconnected
        case 'message':
          return event.topic === topics.event ? handleDeviceMessage(event.payload) : Effect.void
      }
    }

    // 常駐ループ。transport からのイベントを1本で捌く
    yield* Queue.take(transport.events).pipe(
      Effect.flatMap(handleEvent),
      Effect.forever,
      Effect.forkScoped,
    )

    /** 全状態が届くまで待つ。届かなければデバイスが応答しないと判断する */
    const awaitSynced = state.changes.pipe(
      Stream.filter((s) => s.syncedAt !== null),
      Stream.runHead,
      Effect.timeoutFail({
        duration: timeout,
        onTimeout: () => new EdgeTimeoutError({ operation: '接続', timeoutMs }),
      }),
      Effect.tapError(() =>
        SubscriptionRef.update(state, (s) => ({ ...s, edge: 'offline' as const })),
      ),
      Effect.asVoid,
    )

    const connect: Effect.Effect<void, BrokerUnreachableError | EdgeTimeoutError> = Effect.gen(
      function* () {
        yield* SubscriptionRef.update(state, (s) => ({
          ...s,
          broker: 'connecting' as const,
          ringing: null,
          syncedAt: null,
        }))
        yield* transport.connect.pipe(
          // 失敗したまま「接続中…」に見え続けないよう、状態を落としてから伝える
          Effect.tapError(() =>
            SubscriptionRef.update(state, (s) => ({ ...s, broker: 'error' as const })),
          ),
        )
        // 購読し直しと get-state は接続イベントを受けた常駐ループが行う。
        // ここは「全状態が届いた」ことをもって接続完了とする
        yield* awaitSynced
      },
    )

    const disconnect = transport.disconnect.pipe(Effect.zipRight(applyDisconnected))

    const request = (operation: string, command: Command): Effect.Effect<void, CommandError> =>
      Effect.gen(function* () {
        const current = yield* SubscriptionRef.get(state)
        if (current.broker !== 'connected') {
          return yield* Effect.fail(new BrokerNotConnectedError({ operation }))
        }
        if (current.edge !== 'online') {
          return yield* Effect.fail(new EdgeOfflineError({ operation }))
        }

        const deferred = yield* Deferred.make<void, BrokerNotConnectedError>()
        const requestId = yield* nextRequestId
        yield* Ref.update(pending, HashMap.set(requestId, { operation, deferred }))
        yield* transport.publish(topics.command, encodeCommandEnvelope({ requestId, command }))

        return yield* Deferred.await(deferred).pipe(
          Effect.timeoutFail({
            duration: timeout,
            onTimeout: () => new EdgeTimeoutError({ operation, timeoutMs }),
          }),
          // 応答が返らない＝デバイスが応答しなくなったと見なす。
          // LWT も retain も使わない以上、生死の材料は応答の有無しかない
          Effect.tapErrorTag('EdgeTimeoutError', () =>
            SubscriptionRef.update(state, (s) => ({ ...s, edge: 'offline' as const })),
          ),
          Effect.ensuring(Ref.update(pending, HashMap.remove(requestId))),
        )
      })

    return {
      state,
      connect,
      disconnect,
      setPower: (power) =>
        request(`電源${power === 'on' ? 'ON' : 'OFF'}コマンドを送信`, { kind: 'set-power', power }),
      addAlarm: (alarm) => request('アラームを追加', { kind: 'add-alarm', alarm }),
      editAlarm: (id, alarm) => request('アラームを変更', { kind: 'edit-alarm', id, alarm }),
      deleteAlarm: (id) => request('アラームを削除', { kind: 'delete-alarm', id }),
      stopRinging: request('停止コマンドを送信', { kind: 'stop-ringing' }),
    }
  })
}
