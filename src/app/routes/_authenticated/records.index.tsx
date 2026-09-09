import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ListChecks, Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { paths } from '@/config/paths'
import { formatDate } from '@/utils/date'
import {
  StatusBadge,
  TypeBadge,
} from '@/features/non-conformities/components/status-badge'
import {
  recordStatusLabels,
  recordStatuses,
  recordTypeLabels,
  recordTypes,
} from '@/features/non-conformities/schemas'

import type { RecordFilters } from '@/features/non-conformities/schemas'

export const Route = createFileRoute('/_authenticated/records/')({
  component: RecordsPage,
})

const ALL = '__all__'

function RecordsPage() {
  const trpc = useTRPC()
  const [filters, setFilters] = useState<RecordFilters>({
    status: '',
    type: '',
    departmentId: '',
    search: '',
  })

  const records = useQuery(trpc.records.list.queryOptions(filters))
  const departments = useQuery(trpc.directory.departments.queryOptions())
  const summary = useQuery(trpc.records.summary.queryOptions())

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Registros</h1>
          <p className="text-muted-foreground text-sm">
            Não conformidades, ações corretivas e preventivas
          </p>
        </div>
        <Button asChild>
          <Link to={paths.newRecord}>
            <Plus className="size-4" />
            Novo registro
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Em aberto"
          value={
            summary.data
              ? summary.data.counts.OPEN +
                summary.data.counts.IN_PROGRESS +
                summary.data.counts.UNDER_VERIFICATION
              : undefined
          }
          description="Aguardando ação ou verificação"
        />
        <SummaryCard
          title="Rascunhos"
          value={summary.data?.counts.DRAFT}
          description="Ainda não emitidos"
        />
        <SummaryCard
          title="Minhas ações"
          value={summary.data?.myActions}
          description="Ações pendentes atribuídas a você"
          icon={<ListChecks className="text-muted-foreground size-4" />}
        />
        <SummaryCard
          title="Ações atrasadas"
          value={summary.data?.overdueActions}
          description="Prazo vencido"
          icon={<AlertTriangle className="text-destructive size-4" />}
        />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Buscar por número, problema ou origem"
                value={filters.search}
                onChange={(event) =>
                  setFilters({ ...filters, search: event.target.value })
                }
              />
            </div>

            <Select
              value={filters.status || ALL}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  status: value === ALL ? '' : (value as RecordFilters['status']),
                })
              }
            >
              <SelectTrigger className="md:w-44">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as situações</SelectItem>
                {recordStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {recordStatusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.type || ALL}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  type: value === ALL ? '' : (value as RecordFilters['type']),
                })
              }
            >
              <SelectTrigger className="md:w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os tipos</SelectItem>
                {recordTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {recordTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.departmentId || ALL}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  departmentId: value === ALL ? '' : value,
                })
              }
            >
              <SelectTrigger className="md:w-52">
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os departamentos</SelectItem>
                {(departments.data ?? []).map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Nº RACP</TableHead>
                <TableHead className="w-28">Tipo</TableHead>
                <TableHead>Problema</TableHead>
                <TableHead className="w-44">Departamento</TableHead>
                <TableHead className="w-24">Data</TableHead>
                <TableHead className="w-24">Ações</TableHead>
                <TableHead className="w-36">Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.isPending &&
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {records.data?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground py-10 text-center"
                  >
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              )}

              {records.data?.map((record) => {
                const done = record.actions.filter(
                  (action) => action.completedAt !== null,
                ).length
                return (
                  <TableRow key={record.id} className="cursor-pointer">
                    <TableCell className="font-mono font-medium">
                      <Link to={paths.record(record.id)}>{record.number}</Link>
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={record.type} />
                    </TableCell>
                    <TableCell className="max-w-md">
                      <Link
                        to={paths.record(record.id)}
                        className="line-clamp-2 no-underline"
                      >
                        {record.problemDescription}
                      </Link>
                      <span className="text-muted-foreground block text-xs">
                        Origem: {record.origin}
                      </span>
                    </TableCell>
                    <TableCell>{record.department.name}</TableCell>
                    <TableCell>{formatDate(record.problemDate)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {done}/{record.actions.length}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string
  value: number | undefined
  description: string
  icon?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardDescription className="flex items-center gap-2">
          {icon}
          {title}
        </CardDescription>
        <CardTitle className="text-3xl">
          {value === undefined ? <Skeleton className="h-8 w-12" /> : value}
        </CardTitle>
        <p className="text-muted-foreground text-xs">{description}</p>
      </CardHeader>
    </Card>
  )
}
