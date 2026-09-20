import {
  Clock,
  Deferred,
  Duration,
  Effect,
  Either,
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
  alarmCommandFields,
  encodeCommand,
  parseDeviceMessage,
  topicsFor,
  type AlarmInput,
  type Command,
  type DeviceMessageKind,
} from '@/lib/edge/protocol'
import type { EdgeTransport, TransportEvent } from '@/lib/edge/transport'

/**
 * エッジデバイスとのやりとりを担う本体。transport（ポート）の上に載る。
 *
 * ## セッション永続に依存しない
 *
 * 切断中にブローカーがメッセージを溜めておいてくれることを一切あてにしない。
 * 代わりに、接続イベントを受けるたびに必ず
 *   1. 返事のトピック（alarms / ringing_status / status）を購読し直す
 *   2. list / ringing_status / status を送って全部取り直す
 * を行い、届いた一覧・鳴動状態で手元を丸ごと置き換える。
 * 差分を積み上げないので「切断中に取りこぼした1通のせいで表示が恒久的にずれる」
 * という壊れ方が構造的に起きない。
 *
 * ## ack が無い実機との付き合い方
 *
 * 実機は add / edit / delete / stop に返事をしない。そこで変更系のコマンドは
 * 「送ったら直後に list（stop なら ringing_status）を送り、その返事が届くまで待つ」
 * を 1 回の操作とする。返事が全状態なので、届いた時点で手元も新しくなっている。
 *
 * ## エッジの生死
 *
 * LWT も retain も使わないため、デバイスが生きているかは**応答が返るかどうか**だけで
 * 判断する。返事が届けば online、待っても来なければ offline、接続していない間は unknown。
 * 実機は止まったときに鳴動状態を配信しないので、接続中は一定間隔で
 * ringing_status と status を問い合わせ続ける（生存確認も兼ねる）。
 */

export type EdgeState = {
  readonly broker: BrokerStatus
  readonly edge: EdgeDeviceStatus
  readonly alarms: readonly Alarm[]
  readonly ringing: RingingStatus | null
  /**
   * 一覧を最後に受け取った時刻。null は「今の手元の内容は確かめられていない」。
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
  /**
   * 追加。ID はデバイスが採番するので、返事の一覧から「増えた 1 件」を探して返す。
   * 同時に 2 件以上増えていて特定できなければ null
   */
  readonly addAlarm: (alarm: AlarmInput) => Effect.Effect<string | null, CommandError>
  readonly editAlarm: (id: string, alarm: AlarmInput) => Effect.Effect<void, CommandError>
  readonly deleteAlarm: (id: string) => Effect.Effect<void, CommandError>
  readonly stopRinging: Effect.Effect<void, CommandError>
  /** 歩行中の一時停止。返事は無いので送るだけ */
  readonly pauseRinging: (
    durationMs: number,
  ) => Effect.Effect<void, BrokerNotConnectedError | EdgeOfflineError>
}

export type EdgeClientOptions = {
  readonly deviceId: string
  /** 返事を待つ上限 */
  readonly responseTimeout?: Duration.DurationInput
  /** 接続中に鳴動状態と生存を問い合わせる間隔 */
  readonly pollInterval?: Duration.DurationInput
}

const DEFAULT_RESPONSE_TIMEOUT = Duration.seconds(5)
const DEFAULT_POLL_INTERVAL = Duration.seconds(3)

const INITIAL_STATE: EdgeState = {
  broker: 'disconnected',
  edge: 'unknown',
  alarms: [],
  ringing: null,
  syncedAt: null,
}

/** 返事待ち 1 件。切断時にどの操作が宙に浮いたかを言えるよう operation を持つ */
type Waiter = {
  readonly kind: DeviceMessageKind
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
    const pollInterval = Duration.decode(options.pollInterval ?? DEFAULT_POLL_INTERVAL)

    const state = yield* SubscriptionRef.make(INITIAL_STATE)
    const waiters = yield* Ref.make<readonly Waiter[]>([])

    const send = (command: Command) =>
      transport.publish(topics.command, encodeCommand(command))

    /**
     * 接続のたびに行う同期。ここがこの設計の要。
     * 購読はブローカーに覚えさせないので毎回張り直し、状態は毎回まるごと取り直す。
     */
    const resync = Effect.gen(function* () {
      yield* transport.subscribe(topics.alarms)
      yield* transport.subscribe(topics.ringingStatus)
      yield* transport.subscribe(topics.status)
      yield* send({ type: 'list' })
      yield* send({ type: 'ringing_status' })
      yield* send({ type: 'status' })
    })

    /** 接続が切れた（切った）ときの状態の落とし方。ループからも disconnect からも呼ぶ */
    const applyDisconnected = Effect.gen(function* () {
      // 待っている返事はもう届かない。タイムアウトまで待たせず即座に諦めさせる
      const pending = yield* Ref.getAndSet(waiters, [])
      yield* Effect.forEach(
        pending,
        (w) =>
          Deferred.fail(w.deferred, new BrokerNotConnectedError({ operation: w.operation })),
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

    /** 返事が届いたら、その種類を待っている全員を起こす */
    const resolveWaiters = (kind: DeviceMessageKind) =>
      Effect.gen(function* () {
        const pending = yield* Ref.get(waiters)
        const matched = pending.filter((w) => w.kind === kind)
        yield* Ref.set(
          waiters,
          pending.filter((w) => w.kind !== kind),
        )
        yield* Effect.forEach(matched, (w) => Deferred.succeed(w.deferred, undefined), {
          discard: true,
        })
      })

    const handleDeviceMessage = (topic: string, payload: string) =>
      Effect.gen(function* () {
        const decoded = parseDeviceMessage(topics, topic, payload)
        // 壊れた電文で常駐ループを落とさない。1通捨てて次を待つ
        if (Either.isLeft(decoded)) return
        const message = decoded.right
        const now = yield* Clock.currentTimeMillis

        switch (message.kind) {
          case 'alarms':
            yield* SubscriptionRef.update(state, (s) => ({
              ...s,
              edge: 'online' as const,
              // 差分を当てるのではなく置き換える
              alarms: sortAlarmsByTime(message.alarms),
              syncedAt: now,
            }))
            break
          case 'ringing':
            yield* SubscriptionRef.update(state, (s) => ({
              ...s,
              edge: 'online' as const,
              ringing: message.ringing,
            }))
            break
          case 'status':
            // 応答が返った＝デバイスは生きている
            yield* SubscriptionRef.update(state, (s) => ({ ...s, edge: 'online' as const }))
            break
        }
        yield* resolveWaiters(message.kind)
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
          return handleDeviceMessage(event.topic, event.payload)
      }
    }

    // 常駐ループ。transport からのイベントを1本で捌く
    yield* Queue.take(transport.events).pipe(
      Effect.flatMap(handleEvent),
      Effect.forever,
      Effect.forkScoped,
    )

    /**
     * 「次に届く kind の返事」を待つ約束を先に取っておく。送る前に取るのは、
     * 送った直後に返事が届いてしまい待ち始める前に通り過ぎる、を防ぐため。
     * 返ってくる Effect を yield すると、返事が届くか、タイムアウトするか、切断されるまで待つ
     */
    const expectReply = (kind: DeviceMessageKind, operation: string) =>
      Effect.gen(function* () {
        const deferred = yield* Deferred.make<void, BrokerNotConnectedError>()
        const waiter: Waiter = { kind, operation, deferred }
        yield* Ref.update(waiters, (list) => [...list, waiter])
        return Deferred.await(deferred).pipe(
          Effect.timeoutFail({
            duration: timeout,
            onTimeout: () => new EdgeTimeoutError({ operation, timeoutMs }),
          }),
          // 応答が返らない＝デバイスが応答しなくなったと見なす。
          // LWT も retain も使わない以上、生死の材料は応答の有無しかない
          Effect.tapErrorTag('EdgeTimeoutError', () =>
            SubscriptionRef.update(state, (s) => ({ ...s, edge: 'offline' as const })),
          ),
          Effect.ensuring(Ref.update(waiters, (list) => list.filter((w) => w !== waiter))),
        )
      })

    /** 全状態（一覧）が届くまで待つ。届かなければデバイスが応答しないと判断する */
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
        // 購読し直しと取り直しは接続イベントを受けた常駐ループが行う。
        // ここは「一覧が届いた」ことをもって接続完了とする
        yield* awaitSynced
      },
    )

    const disconnect = transport.disconnect.pipe(Effect.zipRight(applyDisconnected))

    const guard = (operation: string) =>
      Effect.gen(function* () {
        const current = yield* SubscriptionRef.get(state)
        if (current.broker !== 'connected') {
          return yield* Effect.fail(new BrokerNotConnectedError({ operation }))
        }
        if (current.edge === 'offline') {
          return yield* Effect.fail(new EdgeOfflineError({ operation }))
        }
      })

    /**
     * 返事のあるコマンドを送って、その返事を待つ。
     * 変更系（返事が無い）は先に送っておき、続けて query（list 等）を送ってその返事で締める
     */
    const request = (
      operation: string,
      before: readonly Command[],
      query: Command,
      replyKind: DeviceMessageKind,
    ): Effect.Effect<void, CommandError> =>
      Effect.gen(function* () {
        yield* guard(operation)
        const reply = yield* expectReply(replyKind, operation)
        yield* Effect.forEach(before, send, { discard: true })
        yield* send(query)
        yield* reply
      })

    /**
     * 接続中は鳴動状態と生存を問い合わせ続ける。実機は止まったときに鳴動状態を配信しないので、
     * これが無いと「鳴り止んだ」を知る手段が無い。生存確認は guard を通さない。
     * offline と判定した後も問い合わせ続けないと、復帰を検知できないため
     */
    yield* Effect.gen(function* () {
      const current = yield* SubscriptionRef.get(state)
      if (current.broker !== 'connected') return
      const reply = yield* expectReply('status', '生存確認')
      yield* send({ type: 'ringing_status' })
      yield* send({ type: 'status' })
      yield* reply.pipe(Effect.ignore)
    }).pipe(
      // 待ってから問い合わせる。接続直後は resync が取りに行っているので二重に送らない
      (poll) => Effect.sleep(pollInterval).pipe(Effect.zipRight(poll)),
      Effect.forever,
      Effect.forkScoped,
    )

    const alarmIds = SubscriptionRef.get(state).pipe(Effect.map((s) => s.alarms.map((a) => a.id)))

    return {
      state,
      connect,
      disconnect,
      addAlarm: (alarm) =>
        Effect.gen(function* () {
          const before = new Set(yield* alarmIds)
          yield* request(
            'アラームを追加',
            [{ type: 'add', ...alarmCommandFields(alarm) }],
            { type: 'list' },
            'alarms',
          )
          const added = (yield* alarmIds).filter((id) => !before.has(id))
          return added.length === 1 ? added[0] : null
        }),
      editAlarm: (id, alarm) =>
        request(
          'アラームを変更',
          [{ type: 'edit', id, ...alarmCommandFields(alarm) }],
          { type: 'list' },
          'alarms',
        ),
      deleteAlarm: (id) =>
        request('アラームを削除', [{ type: 'delete', id }], { type: 'list' }, 'alarms'),
      stopRinging: request(
        '停止コマンドを送信',
        [{ type: 'stop' }],
        { type: 'ringing_status' },
        'ringing',
      ),
      pauseRinging: (durationMs) =>
        guard('一時停止を送信').pipe(
          Effect.zipRight(send({ type: 'pause', duration_ms: durationMs })),
        ),
    }
  })
}
