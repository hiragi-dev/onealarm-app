import { Chunk, Effect, Queue, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'

import type { Alarm, RingingStatus } from '@/lib/alarm'
import { makeFakeEdge } from '@/lib/edge/fake-edge'
import { encodeCommand, topicsFor, type Command } from '@/lib/edge/protocol'
import type { EdgeTransport } from '@/lib/edge/transport'

/**
 * fake のデバイス（= 実機 onealarm-fw の代役）が送る電文そのものを確かめるテスト。
 *
 * EdgeClient を通さず transport から生のペイロードを読むのは、
 * **アプリがまだ読めない項目をデバイスが送れている**ことを確かめたいから。
 * アプリ側の Schema を通して検証すると、アプリが知らない項目は落ちてしまい
 * 「送れていない」と区別が付かなくなる。
 *
 * 確かめるのは pause（= 歩いている間の一時停止）で黙ったことを
 * 鳴動状態に載せて配信する振る舞いで、実機の g_muteActive / g_muteUntilMs に対応する。
 */

const DEVICE_ID = 'onealarm-test-01'
const TOPICS = topicsFor(DEVICE_ID)

const ALARM: Alarm = {
  id: 'alarm-1',
  time: '06:30',
  daysOfWeek: ['Mon'],
  isEnabled: true,
  stopMethodId: 'sm-office',
  walkUnlockPointId: null,
}

const RINGING: RingingStatus = { isRinging: true, ringingIds: [ALARM.id] }

type Fixture = {
  readonly send: (command: Command) => Effect.Effect<void>
  /** 前回読んだ時点から後に届いた ringing_status の電文を、JSON のまま */
  readonly ringingPayloads: Effect.Effect<unknown[]>
}

function withDevice(
  run: (fixture: Fixture) => Effect.Effect<unknown, unknown>,
  options: { ringing?: RingingStatus } = {},
): Promise<unknown> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const { transport } = yield* makeFakeEdge({
        deviceId: DEVICE_ID,
        alarms: [ALARM],
        ringing: options.ringing,
      })
      yield* transport.connect
      // 購読していないトピックは捨てられる。接続イベントは読み飛ばす
      yield* transport.subscribe(TOPICS.ringingStatus)
      yield* Queue.takeAll(transport.events)
      return yield* run({
        send: (command) => transport.publish(TOPICS.command, encodeCommand(command)),
        ringingPayloads: ringingPayloads(transport),
      })
    }).pipe(Effect.scoped, Effect.provide(TestContext.TestContext)),
  )
}

function ringingPayloads(transport: EdgeTransport): Effect.Effect<unknown[]> {
  return Queue.takeAll(transport.events).pipe(
    Effect.map((events) =>
      Chunk.toReadonlyArray(events)
        .filter((e) => e.kind === 'message' && e.topic === TOPICS.ringingStatus)
        .map((e) => JSON.parse(e.kind === 'message' ? e.payload : '')),
    ),
  )
}

describe('一時停止（pause）', () => {
  it('鳴動中に受けると、黙っていることと残り時間を鳴動状態に載せて配信する', () =>
    withDevice(
      ({ send, ringingPayloads }) =>
        Effect.gen(function* () {
          yield* send({ type: 'pause', duration_ms: 5000 })

          // ack は返さないが、黙ったことは状態の変化なので鳴動状態として届く
          expect(yield* ringingPayloads).toEqual([
            {
              is_ringing: true,
              ringing_ids: [ALARM.id],
              is_muted: true,
              mute_remaining_ms: 5000,
            },
          ])
        }),
      { ringing: RINGING },
    ))

  it('上書きで、送るたびに積み上がることはない', () =>
    withDevice(
      ({ send, ringingPayloads }) =>
        Effect.gen(function* () {
          yield* send({ type: 'pause', duration_ms: 5000 })
          yield* TestClock.adjust('2 seconds')
          yield* ringingPayloads
          // 歩行が続く間、WalkPauseBridge は期限が切れる前に送り直す
          yield* send({ type: 'pause', duration_ms: 5000 })

          // 残り 3 秒 + 5 秒 ではなく、5 秒で上書きされる
          expect(yield* ringingPayloads).toMatchObject([{ mute_remaining_ms: 5000 }])
        }),
      { ringing: RINGING },
    ))

  it('期限切れは自分からは言わない。問い合わせれば黙っていないと答える', () =>
    withDevice(
      ({ send, ringingPayloads }) =>
        Effect.gen(function* () {
          yield* send({ type: 'pause', duration_ms: 5000 })
          yield* ringingPayloads
          yield* TestClock.adjust('6 seconds')

          // 期限が切れても配信は無い（アプリ側の定期問い合わせで気づく）
          expect(yield* ringingPayloads).toEqual([])

          yield* send({ type: 'ringing_status' })
          expect(yield* ringingPayloads).toMatchObject([
            { is_ringing: true, is_muted: false, mute_remaining_ms: 0 },
          ])
        }),
      { ringing: RINGING },
    ))

  it('鳴っていなければ捨てる。配信もしない', () =>
    withDevice(({ send, ringingPayloads }) =>
      Effect.gen(function* () {
        yield* send({ type: 'pause', duration_ms: 5000 })
        expect(yield* ringingPayloads).toEqual([])

        yield* send({ type: 'ringing_status' })
        expect(yield* ringingPayloads).toMatchObject([
          { is_ringing: false, is_muted: false, mute_remaining_ms: 0 },
        ])
      }),
    ))

  it('止めた後は、黙っている期限が残っていても鳴動状態には載せない', () =>
    withDevice(
      ({ send, ringingPayloads }) =>
        Effect.gen(function* () {
          yield* send({ type: 'pause', duration_ms: 5000 })
          yield* send({ type: 'stop' })
          yield* ringingPayloads

          // 鳴っていないのに黙っている、という状態は意味を持たない
          yield* send({ type: 'ringing_status' })
          expect(yield* ringingPayloads).toMatchObject([
            { is_ringing: false, is_muted: false, mute_remaining_ms: 0 },
          ])
        }),
      { ringing: RINGING },
    ))
})
