/**
 * 加速度（重力込み）の大きさの変化から歩行を検知する。
 *
 * 旧アプリ（eager-alarm-app の useWalkingDetector）のアルゴリズムをそのまま純粋な
 * 状態機械に切り出したもの。センサーの購読（React / DeviceMotionEvent）と切り離して
 * あるので、合成した波形を流してテストできる。
 *
 * 判定: 大きさが上昇から下降に転じる「ピーク」を 1 歩と数え、直近 STEP_WINDOW_MS の間に
 * MIN_STEPS_IN_WINDOW 歩以上あれば歩行中。最後の 1 歩から WALKING_TIMEOUT_MS 経てば解除。
 * しきい値は簡易的なもので、端末の持ち方・機種によって精度は変わる。
 */

const GRAVITY = 9.81
/** 重力を除いた大きさがこの値（m/s²）を超えたピークだけを歩行によるものとみなす */
const PEAK_THRESHOLD = 1.2
/** ピーク間の最小間隔。これより短い間隔は同じ 1 歩のノイズとみなして無視する */
const MIN_STEP_INTERVAL_MS = 250
/** この時間内の歩数で歩行判定を行う */
const STEP_WINDOW_MS = 3000
/** STEP_WINDOW_MS 内にこの歩数以上あれば「歩行中」と判定する */
const MIN_STEPS_IN_WINDOW = 3
/** 最後の 1 歩からこの時間経過したら「歩行中」を解除する */
export const WALKING_TIMEOUT_MS = 1500

export type WalkDetectorState = {
  readonly lastMagnitude: number | null
  readonly rising: boolean
  readonly lastStepAt: number
  /** 直近の歩のタイムスタンプ（STEP_WINDOW_MS より古いものは落とす） */
  readonly recentSteps: readonly number[]
  readonly stepCount: number
}

export const INITIAL_WALK_DETECTOR_STATE: WalkDetectorState = {
  lastMagnitude: null,
  rising: false,
  // 「まだ 1 歩も無い」。0 にすると、時刻 0 付近から始めたとき最初の 1 歩が
  // MIN_STEP_INTERVAL_MS の間隔制限に引っかかる
  lastStepAt: Number.NEGATIVE_INFINITY,
  recentSteps: [],
  stepCount: 0,
}

export type Acceleration = { x: number; y: number; z: number }

/** 重力込みの加速度から、重力ぶんを引いた大きさへ */
export function magnitudeOf(g: Acceleration): number {
  return Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) - GRAVITY
}

/** 1 サンプルを食わせて次の状態を返す。stepped はこのサンプルで 1 歩と数えたか */
export function feedSample(
  state: WalkDetectorState,
  magnitude: number,
  now: number,
): { state: WalkDetectorState; stepped: boolean } {
  const last = state.lastMagnitude
  const isRising = last !== null && magnitude > last
  const next: WalkDetectorState = { ...state, lastMagnitude: magnitude, rising: isRising }
  if (last === null) return { state: next, stepped: false }

  const isPeak = state.rising && !isRising && magnitude > PEAK_THRESHOLD
  if (!isPeak || now - state.lastStepAt <= MIN_STEP_INTERVAL_MS) {
    return { state: next, stepped: false }
  }

  const recentSteps = [...state.recentSteps.filter((t) => now - t <= STEP_WINDOW_MS), now]
  return {
    state: { ...next, lastStepAt: now, recentSteps, stepCount: state.stepCount + 1 },
    stepped: true,
  }
}

/** 今、歩行中と言えるか。歩が途絶えていれば false（サンプルが来なくても時間で解除する） */
export function isWalking(state: WalkDetectorState, now: number): boolean {
  if (now - state.lastStepAt > WALKING_TIMEOUT_MS) return false
  return state.recentSteps.filter((t) => now - t <= STEP_WINDOW_MS).length >= MIN_STEPS_IN_WINDOW
}
