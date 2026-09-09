import { Badge } from '@/components/ui/badge'
import {
  recordStatusLabels,
  recordTypeLabels,
} from '@/features/non-conformities/schemas'

import type {
  RecordStatus,
  RecordType,
} from '@/features/non-conformities/schemas'

const statusVariants: Record<
  RecordStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'outline',
  OPEN: 'secondary',
  IN_PROGRESS: 'secondary',
  UNDER_VERIFICATION: 'default',
  CLOSED: 'default',
  CANCELLED: 'destructive',
}

export function StatusBadge({ status }: { status: RecordStatus }) {
  return (
    <Badge variant={statusVariants[status]}>{recordStatusLabels[status]}</Badge>
  )
}

export function TypeBadge({ type }: { type: RecordType }) {
  return (
    <Badge variant={type === 'CORRECTIVE' ? 'destructive' : 'outline'}>
      {recordTypeLabels[type]}
    </Badge>
  )
}
