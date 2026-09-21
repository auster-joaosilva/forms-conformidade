import { createFileRoute } from '@tanstack/react-router'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toCsv } from '@/utils/csv'
import { formatDate } from '@/utils/date'
import { formatCurrency } from '@/utils/currency'
import { recordListWhere } from '@/features/non-conformities/server/router'
import {
  recordFiltersSchema,
  recordStatusLabels,
  recordTypeLabels,
  verificationMethodLabels,
} from '@/features/non-conformities/schemas'

const CSV_HEADER = [
  'Número',
  'Tipo',
  'Situação',
  'Departamento',
  'Data do problema',
  'Origem',
  'Nome do cliente',
  'Responsável pelo erro',
  'Gerou ônus financeiro',
  'Para quem',
  'Valor do ônus financeiro',
  'Causa raiz',
  'Ação de contenção',
  'Método de verificação',
  'Resultado da eficácia',
  'Data da verificação da eficácia',
  'Criado em',
  'Encerrado em',
]

export const Route = createFileRoute('/api/records/export')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('Não autenticado', { status: 401 })

        const dbUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            role: true,
            active: true,
            departments: { select: { departmentId: true } },
          },
        })
        if (!dbUser || !dbUser.active) {
          return new Response('Não autenticado', { status: 401 })
        }

        const user = {
          id: dbUser.id,
          role: dbUser.role,
          departmentIds: dbUser.departments.map((entry) => entry.departmentId),
        }

        const searchParams = new URL(request.url).searchParams
        const parsedFilters = recordFiltersSchema.partial().safeParse({
          status: searchParams.get('status') ?? '',
          type: searchParams.get('type') ?? '',
          departmentId: searchParams.get('departmentId') ?? '',
          search: searchParams.get('search') ?? '',
        })
        const filters = parsedFilters.success ? parsedFilters.data : {}

        const records = await prisma.nonConformity.findMany({
          where: recordListWhere(user, filters),
          orderBy: [{ year: 'desc' as const }, { sequence: 'desc' as const }],
          select: {
            number: true,
            type: true,
            status: true,
            department: { select: { name: true } },
            problemDate: true,
            origin: true,
            clientName: true,
            errorResponsibleName: true,
            hasFinancialImpact: true,
            financialImpactTarget: true,
            financialImpactAmount: true,
            rootCauseAnalysis: true,
            containmentAction: true,
            verificationMethod: true,
            effectivenessResult: true,
            effectivenessDate: true,
            createdAt: true,
            closedAt: true,
          },
        })

        const rows = records.map((record) => [
          record.number,
          recordTypeLabels[record.type],
          recordStatusLabels[record.status],
          record.department.name,
          formatDate(record.problemDate),
          record.origin,
          record.clientName ?? '',
          record.errorResponsibleName ?? '',
          record.hasFinancialImpact ? 'Sim' : 'Não',
          record.financialImpactTarget ?? '',
          record.hasFinancialImpact
            ? formatCurrency(record.financialImpactAmount)
            : '',
          record.rootCauseAnalysis ?? '',
          record.containmentAction ?? '',
          record.verificationMethod
            ? verificationMethodLabels[record.verificationMethod]
            : '',
          record.effectivenessResult ?? '',
          record.effectivenessDate ? formatDate(record.effectivenessDate) : '',
          formatDate(record.createdAt),
          record.closedAt ? formatDate(record.closedAt) : '',
        ])

        const csv = toCsv([CSV_HEADER, ...rows])
        const fileName = `racp-indicadores-${new Date().toISOString().slice(0, 10)}.csv`

        return new Response(`﻿${csv}`, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
            'Cache-Control': 'private, no-store',
          },
        })
      },
    },
  },
})
