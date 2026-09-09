import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { ClipboardList, LogOut, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { authClient } from '@/lib/auth-client'
import { paths } from '@/config/paths'
import { useCurrentUser } from '@/features/auth/components/auth-guard'
import { userRoleLabels } from '@/features/directory/schemas'
import { cn } from '@/lib/utils'

import type { ReactNode } from 'react'

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function AppLayout({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const navigation = [
    { to: paths.records, label: 'Registros', icon: ClipboardList },
    ...(user.role === 'ADMIN'
      ? [{ to: paths.directory, label: 'Usuários', icon: Users }]
      : []),
  ]

  async function signOut() {
    await authClient.signOut()
    await navigate({ to: paths.login })
  }

  return (
    <div className="bg-background min-h-svh">
      <header className="bg-card/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to={paths.records} className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-xl font-bold">
              RQ
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold">
                Registro de Não Conformidade
              </span>
              <span className="text-muted-foreground block text-xs">
                Ação corretiva ou preventiva
              </span>
            </span>
          </Link>

          <nav className="flex flex-1 items-center gap-1">
            {navigation.map((item) => (
              <Button
                key={item.to}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  pathname.startsWith(item.to) && 'bg-accent text-accent-foreground',
                )}
              >
                <Link to={item.to}>
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5">
                <Avatar className="size-8">
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium">{user.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {userRoleLabels[user.role]}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="space-y-1">
                <span className="block text-sm font-medium">{user.name}</span>
                <span className="text-muted-foreground block text-xs font-normal">
                  {user.email}
                </span>
                <Badge variant="secondary">{userRoleLabels[user.role]}</Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut}>
                <LogOut className="size-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
