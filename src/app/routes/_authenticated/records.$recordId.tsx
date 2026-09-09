import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Printer,
  Send,
  SquareCheckBig,
} from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { useTRPC } from '@/lib/trpc/react'
import { paths } from '@/config/paths'
import { formatDateTime } from '@/utils/date'
import { useCurrentUser } from '@/features/auth/components/auth-guard'
import { RecordForm } from '@/features/non-conformities/components/record-form'
import { AttachmentsPanel } from '@/features/non-conformities/components/attachments-panel'
import {
  StatusBadge,
  TypeBadge,
} from '@/features/non-conformities/components/status-badge'
import { toFormValues } from '@/features/non-conformities/types'

import type { RecordDetail } from '@/features/non-conformities/types'

export const Route = createFileRoute('/_authenticated/records/$recordId')({
  component: RecordDetailPage,
})

function RecordDetailPage() {
  const { recordId } = Route.useParams()
  const trpc = useTRPC()
  const record = useQuery(trpc.records.byId.queryOptions({ id: recordId }))

  if (record.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (record.isError || !record.data) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">
          Registro não encontrado ou sem permissão de acesso.
        </p>
        <Button asChild variant="outline">
          <Link to={paths.records}>Voltar para a lista</Link>
        </Button>
      </div>
    )
  }

  return <RecordDetail record={record.data} />
}

function RecordDetail({ record }: { record: RecordDetail }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const user = useCurrentUser()

  const isManager = user.role !== 'COLLABORATOR'
  const isClosed = record.status === 'CLOSED' || record.status === 'CANCELLED'
  const canEdit =
    !isClosed &&
    (isManager ||
      (record.createdById === user.id &&
        (record.status === 'DRAFT' || record.status === 'OPEN')))

  const myAcknowledgement = record.acknowledgements.find(
    (entry) => entry.userId === user.id,
  )

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.records.byId.queryKey({ id: record.id }),
      }),
      queryClient.invalidateQueries({ queryKey: trpc.records.list.queryKey() }),
      queryClient.invalidateQueries({
        queryKey: trpc.records.summary.queryKey(),
      }),
    ])

  function mutationHandlers(message: string) {
    return {
      onSuccess: () => {
        toast.success(message)
        void invalidate()
      },
      onError: (error: { message: string }) => toast.error(error.message),
    }
  }

  const updateRecord = useMutation(
    trpc.records.update.mutationOptions(mutationHandlers('Registro salvo')),
  )
  const submitRecord = useMutation(
    trpc.records.submit.mutationOptions(mutationHandlers('Registro emitido')),
  )
  const setStatus = useMutation(
    trpc.records.setStatus.mutationOptions(
      mutationHandlers('Situação atualizada'),
    ),
  )
  const acknowledge = useMutation(
    trpc.records.acknowledge.mutationOptions(
      mutationHandlers('Ciência registrada'),
    ),
  )
  const sign = useMutation(
    trpc.records.sign.mutationOptions(mutationHandlers('Assinatura registrada')),
  )

  const pendingActions = record.actions.filter(
    (action) => action.completedAt === null,
  ).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to={paths.records}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">
              RACP {record.number}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={record.type} />
              <StatusBadge status={record.status} />
              <Badge variant="outline">{record.department.name}</Badge>
              {pendingActions > 0 && (
                <Badge variant="secondary">
                  {pendingActions} ação(ões) pendente(s)
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={paths.recordPrint(record.id)} target="_blank" rel="noreferrer">
              <Printer className="size-4" />
              Imprimir
            </a>
          </Button>

          {record.status === 'DRAFT' && canEdit && (
            <Button
              disabled={submitRecord.isPending}
              onClick={() => submitRecord.mutate({ id: record.id })}
            >
              <Send className="size-4" />
              Emitir registro
            </Button>
          )}

          {isManager &&
            (record.status === 'OPEN' || record.status === 'IN_PROGRESS') && (
              <Button
                variant="secondary"
                disabled={setStatus.isPending}
                onClick={() =>
                  setStatus.mutate({
                    id: record.id,
                    status: 'UNDER_VERIFICATION',
                  })
                }
              >
                <SquareCheckBig className="size-4" />
                Enviar para verificação
              </Button>
            )}

          {isManager && record.status === 'UNDER_VERIFICATION' && (
            <Button
              disabled={setStatus.isPending}
              onClick={() =>
                setStatus.mutate({ id: record.id, status: 'CLOSED' })
              }
            >
              <CheckCircle2 className="size-4" />
              Encerrar
            </Button>
          )}

          {isManager && !isClosed && (
            <Button
              variant="ghost"
              disabled={setStatus.isPending}
              onClick={() =>
                setStatus.mutate({ id: record.id, status: 'CANCELLED' })
              }
            >
              <Ban className="size-4" />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {myAcknowledgement && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Ciência dos envolvidos</CardTitle>
              <CardDescription>
                {myAcknowledgement.acknowledgedAt
                  ? `Você deu ciência em ${formatDateTime(myAcknowledgement.acknowledgedAt)}`
                  : 'Você está na lista de envolvidos deste registro.'}
              </CardDescription>
            </div>
            {!myAcknowledgement.acknowledgedAt && (
              <Button
                disabled={acknowledge.isPending}
                onClick={() => acknowledge.mutate({ id: record.id })}
              >
                <BadgeCheck className="size-4" />
                Dar ciência
              </Button>
            )}
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registro</CardTitle>
          <CardDescription>
            Aberto por {record.createdBy.name} ·{' '}
            {formatDateTime(record.createdAt)}
            {record.closedAt
              ? ` · Encerrado em ${formatDateTime(record.closedAt)}`
              : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecordForm
            key={record.updatedAt.toString()}
            defaultValues={toFormValues(record)}
            isSubmitting={updateRecord.isPending}
            canEditManagerFields={isManager}
            disabled={!canEdit}
            onSubmit={(values) =>
              updateRecord.mutate({ id: record.id, values })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assinaturas</CardTitle>
          <CardDescription>
            A assinatura eletrônica substitui a assinatura manual do formulário
            impresso.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <SignatureBlock
            title="Responsável técnico"
            name={record.technicalManager?.name}
            signedAt={record.technicalManagerSignedAt}
            canSign={isManager && !isClosed}
            isPending={sign.isPending}
            onSign={() =>
              sign.mutate({ id: record.id, role: 'TECHNICAL_MANAGER' })
            }
          />
          <SignatureBlock
            title="Gerente geral"
            name={record.generalManager?.name}
            signedAt={record.generalManagerSignedAt}
            canSign={isManager && !isClosed}
            isPending={sign.isPending}
            onSign={() =>
              sign.mutate({ id: record.id, role: 'GENERAL_MANAGER' })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anexos</CardTitle>
          <CardDescription>
            Documentos de apoio das seções 3, 4, 6 e 7.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttachmentsPanel record={record} readOnly={!canEdit} />
        </CardContent>
      </Card>
    </div>
  )
}

function SignatureBlock({
  title,
  name,
  signedAt,
  canSign,
  isPending,
  onSign,
}: {
  title: string
  name: string | undefined
  signedAt: Date | null
  canSign: boolean
  isPending: boolean
  onSign: () => void
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">{title}</p>
      <Separator />
      {signedAt ? (
        <div>
          <p className="text-sm">{name}</p>
          <p className="text-muted-foreground text-xs">
            Assinado em {formatDateTime(signedAt)}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            {name ? `${name} — aguardando assinatura` : 'Não definido'}
          </p>
          {canSign && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={onSign}
            >
              <BadgeCheck className="size-4" />
              Assinar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
