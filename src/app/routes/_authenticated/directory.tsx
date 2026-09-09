import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useTRPC } from '@/lib/trpc/react'
import { formatDateTime } from '@/utils/date'
import { useCurrentUser } from '@/features/auth/components/auth-guard'
import {
  userRoleDescriptions,
  userRoleLabels,
  userRoles,
} from '@/features/directory/schemas'

import type { UserRole } from '@/features/directory/schemas'

export const Route = createFileRoute('/_authenticated/directory')({
  component: DirectoryPage,
})

function DirectoryPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const currentUser = useCurrentUser()

  const users = useQuery(trpc.directory.allUsers.queryOptions())
  const departments = useQuery(trpc.directory.departments.queryOptions())
  const config = useQuery(trpc.directory.authConfig.queryOptions())

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.directory.allUsers.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.directory.departments.queryKey(),
      }),
    ])

  const sync = useMutation(
    trpc.directory.sync.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `Sincronizado: ${result.users} usuários e ${result.departments} departamentos`,
        )
        void invalidate()
      },
      onError: (error) => toast.error(error.message),
    }),
  )

  const setRole = useMutation(
    trpc.directory.setUserRole.mutationOptions({
      onSuccess: () => {
        toast.success('Permissão atualizada')
        void invalidate()
      },
      onError: (error) => toast.error(error.message),
    }),
  )

  const setActive = useMutation(
    trpc.directory.setUserActive.mutationOptions({
      onSuccess: () => {
        toast.success('Usuário atualizado')
        void invalidate()
      },
      onError: (error) => toast.error(error.message),
    }),
  )

  if (currentUser.role !== 'ADMIN') {
    return (
      <p className="text-muted-foreground">
        Apenas administradores podem gerenciar usuários.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground text-sm">
            Usuários e departamentos vêm do Authentik. As permissões do
            aplicativo são definidas aqui.
          </p>
        </div>
        <Button
          disabled={sync.isPending || !config.data?.authentikSyncEnabled}
          onClick={() => sync.mutate()}
        >
          {sync.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Sincronizar com o Authentik
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {userRoles.map((role) => (
          <Card key={role}>
            <CardHeader className="gap-1">
              <CardTitle className="text-sm">{userRoleLabels[role]}</CardTitle>
              <CardDescription className="text-xs">
                {userRoleDescriptions[role]}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Departamentos ({departments.data?.length ?? 0})
          </CardTitle>
          <CardDescription>
            Espelham os grupos do Authentik.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {departments.isPending && <Skeleton className="h-6 w-72" />}
          {departments.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Nenhum departamento sincronizado.
            </p>
          )}
          {departments.data?.map((department) => (
            <Badge key={department.id} variant="secondary">
              {department.name} · {department._count.members} membro(s) ·{' '}
              {department._count.records} registro(s)
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Usuários ({users.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Departamentos</TableHead>
                <TableHead className="w-40">Permissão</TableHead>
                <TableHead className="w-44">Sincronizado</TableHead>
                <TableHead className="w-28">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.isPending && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              )}

              {users.data?.map((user) => (
                <TableRow key={user.id} className={user.active ? '' : 'opacity-50'}>
                  <TableCell className="font-medium">
                    {user.name}
                    {user.position && (
                      <span className="text-muted-foreground block text-xs">
                        {user.position}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.departments.length === 0 && (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                      {user.departments.map((entry) => (
                        <Badge key={entry.department.id} variant="outline">
                          {entry.department.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      disabled={setRole.isPending}
                      onValueChange={(value) =>
                        setRole.mutate({
                          userId: user.id,
                          role: value as UserRole,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {userRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {userRoleLabels[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {user.authentikId
                      ? formatDateTime(user.lastSyncedAt)
                      : 'Local'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={user.active ? 'ghost' : 'outline'}
                      size="sm"
                      disabled={setActive.isPending}
                      onClick={() =>
                        setActive.mutate({
                          userId: user.id,
                          active: !user.active,
                        })
                      }
                    >
                      {user.active ? 'Desativar' : 'Ativar'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
