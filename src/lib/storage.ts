import { Schema } from 'effect'

/**
 * ブラウザに残す設定と停止方法。
 *
 * 接続設定と停止方法はエッジデバイスではなくこのアプリだけが持つ情報で、
 * 保存しないと起動のたびに入れ直しになる。localStorage に JSON で置き、
 * 読むときは Schema で検証して、壊れていたり形が古ければ既定値に戻す
 * （例外を外へ出さない。起動時に落ちる原因を設定の残骸にしない）。
 *
 * パスワードも平文で入る。この端末の同じオリジンからしか読めないが、
 * 端末を共有する相手には見えるので、その前提で扱う。
 */

const SETTINGS_KEY = 'onealarm.mqtt-settings'
const STOP_METHODS_KEY = 'onealarm.stop-methods'
const WALK_UNLOCK_POINTS_KEY = 'onealarm.walk-unlock-points'

export const MqttSettingsSchema = Schema.Struct({
  brokerUrl: Schema.String,
  deviceId: Schema.String,
  username: Schema.String,
  password: Schema.String,
})
export type MqttSettings = Schema.Schema.Type<typeof MqttSettingsSchema>

const StopMethodSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  lat: Schema.Number,
  lng: Schema.Number,
  radiusMeters: Schema.Number,
  createdAt: Schema.Number,
})
const StopMethodsSchema = Schema.Array(StopMethodSchema)
export type StoredStopMethod = Schema.Schema.Type<typeof StopMethodSchema>

/**
 * アラーム ID → 歩行検知を有効にする地点（停止方法の ID）。
 * デバイスはこの項目を保存しないので、受信した一覧にこれを重ねて Alarm を組み立てる
 */
const WalkUnlockPointsSchema = Schema.Record({ key: Schema.String, value: Schema.String })
export type WalkUnlockPoints = Schema.Schema.Type<typeof WalkUnlockPointsSchema>

function load<A, I>(key: string, schema: Schema.Schema<A, I>, fallback: A): A {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return Schema.decodeUnknownSync(Schema.parseJson(schema))(raw)
  } catch {
    return fallback
  }
}

function save<A, I>(key: string, schema: Schema.Schema<A, I>, value: A): void {
  try {
    localStorage.setItem(key, Schema.encodeSync(Schema.parseJson(schema))(value))
  } catch {
    // 容量超過やプライベートモードでは書けない。次回入れ直してもらう以外に無い
  }
}

export function loadMqttSettings(fallback: MqttSettings): MqttSettings {
  return load(SETTINGS_KEY, MqttSettingsSchema, fallback)
}

export function saveMqttSettings(settings: MqttSettings): void {
  save(SETTINGS_KEY, MqttSettingsSchema, settings)
}

export function loadStopMethods(fallback: readonly StoredStopMethod[]): readonly StoredStopMethod[] {
  return load(STOP_METHODS_KEY, StopMethodsSchema, fallback)
}

export function saveStopMethods(methods: readonly StoredStopMethod[]): void {
  save(STOP_METHODS_KEY, StopMethodsSchema, methods)
}

export function loadWalkUnlockPoints(): WalkUnlockPoints {
  return load(WALK_UNLOCK_POINTS_KEY, WalkUnlockPointsSchema, {})
}

export function saveWalkUnlockPoints(points: WalkUnlockPoints): void {
  save(WALK_UNLOCK_POINTS_KEY, WalkUnlockPointsSchema, points)
}
