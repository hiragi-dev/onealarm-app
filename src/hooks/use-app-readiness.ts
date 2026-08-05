import { useDemo } from '@/contexts/demo-context'
import {
  brokerConnectionFromStatus,
  deriveAlarmManagementReadiness,
  type AlarmManagementReadiness,
  type BrokerConnection,
} from '@/lib/app-state'

export type AppReadiness = {
  broker: BrokerConnection
  alarmManagement: AlarmManagementReadiness
}

/**
 * ストアの生の状態から「今アラーム関連の操作を行ってよいか」を app-state.ts の
 * 代数的データ型として導出する。保持している状態ではなく、都度計算する純粋な導出。
 */
export function useAppReadiness(): AppReadiness {
  const { status, edgeStatus } = useDemo()

  const broker = brokerConnectionFromStatus(status)
  const alarmManagement = deriveAlarmManagementReadiness(broker, edgeStatus)

  return { broker, alarmManagement }
}
