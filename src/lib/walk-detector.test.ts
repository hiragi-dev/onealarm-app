import { describe, expect, it } from 'vitest'

import {
  feedSample,
  INITIAL_WALK_DETECTOR_STATE,
  isWalking,
  magnitudeOf,
  WALKING_TIMEOUT_MS,
  type WalkDetectorState,
} from '@/lib/walk-detector'

/**
 * 歩行検知の判定の検証。実機のセンサー値は再現できないので、
 * 「歩くとこう揺れる」を合成した波形で固定する。
 */

/** 周期 periodMs・振幅 amplitude の揺れを durationMs ぶん、sampleMs 間隔で食わせる */
function walk(
  state: WalkDetectorState,
  options: { from: number; durationMs: number; periodMs: number; amplitude: number; sampleMs?: number },
): { state: WalkDetectorState; steps: number } {
  const sampleMs = options.sampleMs ?? 50
  let steps = 0
  for (let t = options.from; t < options.from + options.durationMs; t += sampleMs) {
    const phase = ((t - options.from) / options.periodMs) * 2 * Math.PI
    const magnitude = options.amplitude * Math.sin(phase)
    const result = feedSample(state, magnitude, t)
    state = result.state
    if (result.stepped) steps++
  }
  return { state, steps }
}

describe('walk-detector', () => {
  it('重力込みの加速度から重力ぶんを引いた大きさにする', () => {
    expect(magnitudeOf({ x: 0, y: 9.81, z: 0 })).toBeCloseTo(0)
    expect(magnitudeOf({ x: 0, y: 12.81, z: 0 })).toBeCloseTo(3)
  })

  it('1 秒に 2 歩の揺れを 3 秒流すと歩行中になり、歩数も数える', () => {
    const { state, steps } = walk(INITIAL_WALK_DETECTOR_STATE, {
      from: 0,
      durationMs: 3000,
      periodMs: 500,
      amplitude: 3,
    })
    expect(steps).toBeGreaterThanOrEqual(5)
    expect(state.stepCount).toBe(steps)
    expect(isWalking(state, 3000)).toBe(true)
  })

  it('小さな揺れ（しきい値未満）は歩と数えない', () => {
    const { state, steps } = walk(INITIAL_WALK_DETECTOR_STATE, {
      from: 0,
      durationMs: 3000,
      periodMs: 500,
      amplitude: 0.8,
    })
    expect(steps).toBe(0)
    expect(isWalking(state, 3000)).toBe(false)
  })

  it('1 歩だけでは歩行中にならない', () => {
    const { state } = walk(INITIAL_WALK_DETECTOR_STATE, {
      from: 0,
      durationMs: 500,
      periodMs: 500,
      amplitude: 3,
    })
    expect(state.stepCount).toBe(1)
    expect(isWalking(state, 500)).toBe(false)
  })

  it('歩が途絶えると、サンプルが来なくても時間で歩行中が解除される', () => {
    const { state } = walk(INITIAL_WALK_DETECTOR_STATE, {
      from: 0,
      durationMs: 3000,
      periodMs: 500,
      amplitude: 3,
    })
    expect(isWalking(state, 3000)).toBe(true)
    expect(isWalking(state, 3000 + WALKING_TIMEOUT_MS + 1)).toBe(false)
  })

  it('速すぎるピーク（250ms 未満の間隔）は同じ 1 歩のノイズとして無視する', () => {
    const { state } = walk(INITIAL_WALK_DETECTOR_STATE, {
      from: 0,
      durationMs: 1000,
      periodMs: 100,
      amplitude: 3,
      sampleMs: 10,
    })
    // 100ms 周期なら 10 ピークあるが、250ms 間隔の制限で 4 歩程度に抑えられる
    expect(state.stepCount).toBeLessThanOrEqual(4)
  })
})
