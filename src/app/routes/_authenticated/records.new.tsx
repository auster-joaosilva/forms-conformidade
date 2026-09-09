import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTRPC } from '@/lib/trpc/react'
import { paths } from '@/config/paths'
import { useCurrentUser } from '@/features/auth/components/auth-guard'
import { RecordForm } from '@/features/non-conformities/components/record-form'
import { emptyRecordForm } from '@/features/non-conformities/schemas'

export const Route = createFileRoute('/_authenticated/records/new')({
  component: NewRecordPage,
})

function NewRecordPage() {
  const trpc = useTRPC()
  const navigate = useNavigate()
  const user = useCurrentUser()

  const createRecord = useMutation(
    trpc.records.create.mutationOptions({
      onSuccess: (record) => {
        toast.success('Registro criado como rascunho')
        void navigate({ to: paths.record(record.id) })
      },
      onError: (error) => toast.error(error.message),
    }),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to={paths.records}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Novo registro
          </h1>
          <p className="text-muted-foreground text-sm">
            O número do RACP é gerado automaticamente ao salvar.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <RecordForm
            defaultValues={{
              ...emptyRecordForm,
              departmentId: user.departmentIds[0] ?? '',
            }}
            isSubmitting={createRecord.isPending}
            canEditManagerFields={user.role !== 'COLLABORATOR'}
            submitLabel="Criar registro"
            onSubmit={(values) => createRecord.mutate(values)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
