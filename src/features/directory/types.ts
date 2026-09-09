import type { UserRole } from '@/features/directory/schemas'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: UserRole
  position: string | null
  departmentIds: Array<string>
}
