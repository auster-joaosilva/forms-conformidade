import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

import { useTRPC } from '@/lib/trpc/react'
import { paths } from '@/config/paths'

import type { ReactNode } from 'react'
import type { SessionUser } from '@/features/directory/types'

const CurrentUserContext = createContext<SessionUser | null>(null)

export function useCurrentUser(): SessionUser {
  const user = useContext(CurrentUserContext)
  if (!user) throw new Error('useCurrentUser requires an authenticated route')
  return user
}

export function useSessionQuery() {
  const trpc = useTRPC()
  return useQuery(trpc.directory.me.queryOptions())
}

function LoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
    </div>
  )
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useSessionQuery()

  if (isPending) return <LoadingScreen />

  if (!user) return <Navigate to={paths.login} replace />


  return (
    <CurrentUserContext.Provider value={user}>
      {children}
    </CurrentUserContext.Provider>
  )
}
