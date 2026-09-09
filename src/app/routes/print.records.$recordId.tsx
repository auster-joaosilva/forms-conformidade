import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTRPC } from '@/lib/trpc/react'
import { AuthGuard } from '@/features/auth/components/auth-guard'
import { RecordSheet } from '@/features/non-conformities/components/record-sheet'

export const Route = createFileRoute('/print/records/$recordId')({
  component: () => (
    <AuthGuard>
      <PrintPage />
    </AuthGuard>
  ),
})

function PrintPage() {
  const { recordId } = Route.useParams()
  const trpc = useTRPC()
  const record = useQuery(trpc.records.byId.queryOptions({ id: recordId }))

  if (record.isPending) {
    return <p className="p-8 text-sm">Carregando registro…</p>
  }

  if (!record.data) {
    return <p className="p-8 text-sm">Registro não encontrado.</p>
  }

  return (
    <div className="bg-muted/40 min-h-svh p-6 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end">
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          Imprimir / salvar PDF
        </Button>
      </div>
      <RecordSheet record={record.data} />
    </div>
  )
}
