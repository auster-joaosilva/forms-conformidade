import { Outlet, createFileRoute } from '@tanstack/react-router'

import { AppLayout } from '@/components/layouts/app-layout'
import { AuthGuard } from '@/features/auth/components/auth-guard'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <AuthGuard>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </AuthGuard>
  )
}
