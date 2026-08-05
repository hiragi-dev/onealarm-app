import { createFileRoute } from '@tanstack/react-router'

import { AlarmControl } from '@/components/alarm/alarm-control'

export const Route = createFileRoute('/')({
  component: AlarmControl,
})
