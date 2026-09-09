import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from '@/lib/trpc/init'
import { prisma } from '@/lib/prisma'
import { parseDateInput } from '@/utils/date'
import {
  recordFiltersSchema,
  recordFormSchema,
  recordStatuses,
} from '@/features/non-conformities/schemas'

import type { SessionUser } from '@/lib/trpc/init'
import type {
  RecordFormValues,
  RecordStatus,
} from '@/features/non-conformities/schemas'

const recordInclude = {
  department: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, position: true } },
  effectivenessVerifiedBy: { select: { id: true, name: true } },
  technicalManager: { select: { id: true, name: true } },
  generalManager: { select: { id: true, name: true } },
  actions: {
    orderBy: { position: 'asc' as const },
    include: { assignee: { select: { id: true, name: true } } },
  },
  acknowledgements: {
    orderBy: { name: 'asc' as const },
    include: { user: { select: { id: true, name: true } } },
  },
  attachments: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      section: true,
      fileName: true,
      mimeType: true,
      size: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  },
}

const allowedTransitions: Record<RecordStatus, Array<RecordStatus>> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'UNDER_VERIFICATION', 'CANCELLED'],
  IN_PROGRESS: ['UNDER_VERIFICATION', 'CANCELLED'],
  UNDER_VERIFICATION: ['IN_PROGRESS', 'CLOSED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
}

function visibilityWhere(user: SessionUser) {
  if (user.role === 'ADMIN') return {}
  return {
    OR: [
      { departmentId: { in: user.departmentIds } },
      { createdById: user.id },
      { actions: { some: { assigneeId: user.id } } },
      { acknowledgements: { some: { userId: user.id } } },
    ],
  }
}

async function findVisibleRecord(id: string, user: SessionUser) {
  const record = await prisma.nonConformity.findFirst({
    where: { AND: [{ id }, visibilityWhere(user)] },
    include: recordInclude,
  })
  if (!record) throw new TRPCError({ code: 'NOT_FOUND' })
  return record
}

function assertEditable(
  user: SessionUser,
  record: { createdById: string; status: RecordStatus },
) {
  if (record.status === 'CLOSED' || record.status === 'CANCELLED') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Registro encerrado não pode ser alterado',
    })
  }
  if (user.role !== 'COLLABORATOR') return
  const isOwner = record.createdById === user.id
  const isEarlyStage = record.status === 'DRAFT' || record.status === 'OPEN'
  if (!isOwner || !isEarlyStage) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Sem permissão para alterar este registro',
    })
  }
}

function nullableId(value: string) {
  return value === '' ? null : value
}

// ponytail: sequence is max+1 guarded by the unique index; retries cover the rare
// concurrent insert. Swap for a Postgres sequence per year if volume grows.
async function allocateNumber(year: number) {
  const last = await prisma.nonConformity.findFirst({
    where: { year },
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  })
  const sequence = (last?.sequence ?? 0) + 1
  return { sequence, number: `${String(sequence).padStart(3, '0')}/${year}` }
}

function scalarPayload(values: RecordFormValues, user: SessionUser) {
  const base = {
    type: values.type,
    departmentId: values.departmentId,
    problemDescription: values.problemDescription,
    problemDate: parseDateInput(values.problemDate),
    origin: values.origin,
    containmentAction: values.containmentAction || null,
    rootCauseAnalysis: values.rootCauseAnalysis || null,
  }

  if (user.role === 'COLLABORATOR') return base

  return {
    ...base,
    verificationMethod: values.verificationMethod || null,
    verificationMethodDetail: values.verificationMethodDetail || null,
    effectivenessResult: values.effectivenessResult || null,
    effectivenessDate: values.effectivenessDate
      ? parseDateInput(values.effectivenessDate)
      : null,
    effectivenessVerifiedById: nullableId(values.effectivenessVerifiedById),
    technicalManagerId: nullableId(values.technicalManagerId),
    generalManagerId: nullableId(values.generalManagerId),
  }
}

async function replaceChildren(recordId: string, values: RecordFormValues) {
  const existingActions = new Map(
    (
      await prisma.action.findMany({
        where: { nonConformityId: recordId },
        select: { id: true, completedAt: true },
      })
    ).map((action) => [action.id, action.completedAt]),
  )

  const keptActionIds = values.actions
    .map((action) => action.id)
    .filter((id) => id !== '')
  const keptAcknowledgementIds = values.acknowledgements
    .map((entry) => entry.id)
    .filter((id) => id !== '')

  await prisma.action.deleteMany({
    where: { nonConformityId: recordId, id: { notIn: keptActionIds } },
  })
  await prisma.acknowledgement.deleteMany({
    where: { nonConformityId: recordId, id: { notIn: keptAcknowledgementIds } },
  })

  for (const [index, action] of values.actions.entries()) {
    const data = {
      position: index,
      what: action.what,
      who: action.who,
      assigneeId: nullableId(action.assigneeId),
      dueDate: parseDateInput(action.dueDate),
      where: action.where,
    }
    if (action.id) {
      const completedAt = action.completed
        ? (existingActions.get(action.id) ?? new Date())
        : null
      await prisma.action.update({
        where: { id: action.id },
        data: { ...data, completedAt },
      })
    } else {
      await prisma.action.create({
        data: {
          ...data,
          nonConformityId: recordId,
          completedAt: action.completed ? new Date() : null,
        },
      })
    }
  }

  for (const entry of values.acknowledgements) {
    const data = {
      userId: nullableId(entry.userId),
      name: entry.name,
      position: entry.position,
    }
    if (entry.id) {
      await prisma.acknowledgement.update({ where: { id: entry.id }, data })
    } else {
      await prisma.acknowledgement.create({
        data: { ...data, nonConformityId: recordId },
      })
    }
  }
}

export const nonConformitiesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(recordFiltersSchema.partial())
    .query(({ ctx, input }) =>
      prisma.nonConformity.findMany({
        where: {
          AND: [
            visibilityWhere(ctx.user),
            input.status ? { status: input.status } : {},
            input.type ? { type: input.type } : {},
            input.departmentId ? { departmentId: input.departmentId } : {},
            input.search
              ? {
                  OR: [
                    {
                      number: {
                        contains: input.search,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      problemDescription: {
                        contains: input.search,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      origin: {
                        contains: input.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  ],
                }
              : {},
          ],
        },
        orderBy: [{ year: 'desc' as const }, { sequence: 'desc' as const }],
        include: {
          department: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          actions: { select: { id: true, completedAt: true } },
        },
      }),
    ),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const grouped = await prisma.nonConformity.groupBy({
      by: ['status'],
      where: visibilityWhere(ctx.user),
      _count: { _all: true },
    })

    const counts = Object.fromEntries(
      recordStatuses.map((status) => [status, 0]),
    ) as Record<RecordStatus, number>

    for (const row of grouped) {
      counts[row.status] = row._count._all
    }

    const overdueActions = await prisma.action.count({
      where: {
        completedAt: null,
        dueDate: { lt: new Date() },
        record: {
          AND: [
            visibilityWhere(ctx.user),
            { status: { notIn: ['CLOSED', 'CANCELLED'] } },
          ],
        },
      },
    })

    const myActions = await prisma.action.count({
      where: {
        assigneeId: ctx.user.id,
        completedAt: null,
        record: { status: { notIn: ['CLOSED', 'CANCELLED'] } },
      },
    })

    return { counts, overdueActions, myActions }
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ ctx, input }) => findVisibleRecord(input.id, ctx.user)),

  create: protectedProcedure
    .input(recordFormSchema)
    .mutation(async ({ ctx, input }) => {
      const year = parseDateInput(input.problemDate).getUTCFullYear()

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { sequence, number } = await allocateNumber(year)
        try {
          const record = await prisma.nonConformity.create({
            data: {
              ...scalarPayload(input, ctx.user),
              year,
              sequence,
              number,
              status: 'DRAFT',
              createdById: ctx.user.id,
            },
            select: { id: true },
          })
          await replaceChildren(record.id, input)
          return record
        } catch (error) {
          const code = (error as { code?: string }).code
          if (code !== 'P2002' || attempt === 4) throw error
        }
      }

      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().min(1), values: recordFormSchema }))
    .mutation(async ({ ctx, input }) => {
      const record = await findVisibleRecord(input.id, ctx.user)
      assertEditable(ctx.user, record)

      await prisma.nonConformity.update({
        where: { id: record.id },
        data: scalarPayload(input.values, ctx.user),
      })
      await replaceChildren(record.id, input.values)

      if (record.status === 'OPEN' && input.values.actions.length > 0) {
        await prisma.nonConformity.update({
          where: { id: record.id },
          data: { status: 'IN_PROGRESS' },
        })
      }

      return { id: record.id }
    }),

  setStatus: managerProcedure
    .input(z.object({ id: z.string().min(1), status: z.enum(recordStatuses) }))
    .mutation(async ({ ctx, input }) => {
      const record = await findVisibleRecord(input.id, ctx.user)

      if (!allowedTransitions[record.status].includes(input.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Transição de ${record.status} para ${input.status} não permitida`,
        })
      }

      if (
        input.status === 'CLOSED' &&
        (!record.effectivenessResult ||
          !record.effectivenessDate ||
          !record.effectivenessVerifiedById)
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Preencha a verificação da eficácia (resultado, data e responsável) antes de encerrar',
        })
      }

      await prisma.nonConformity.update({
        where: { id: record.id },
        data: {
          status: input.status,
          closedAt: input.status === 'CLOSED' ? new Date() : null,
        },
      })

      return { id: record.id }
    }),

  submit: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const record = await findVisibleRecord(input.id, ctx.user)
      assertEditable(ctx.user, record)
      if (record.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Registro já emitido',
        })
      }
      await prisma.nonConformity.update({
        where: { id: record.id },
        data: { status: 'OPEN' },
      })
      return { id: record.id }
    }),

  completeAction: protectedProcedure
    .input(z.object({ actionId: z.string().min(1), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const action = await prisma.action.findUnique({
        where: { id: input.actionId },
        include: { record: { select: { id: true, status: true } } },
      })
      if (!action) throw new TRPCError({ code: 'NOT_FOUND' })

      const isAssignee = action.assigneeId === ctx.user.id
      const isManager = ctx.user.role !== 'COLLABORATOR'
      if (!isAssignee && !isManager) throw new TRPCError({ code: 'FORBIDDEN' })
      if (
        action.record.status === 'CLOSED' ||
        action.record.status === 'CANCELLED'
      ) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      await prisma.action.update({
        where: { id: action.id },
        data: { completedAt: input.completed ? new Date() : null },
      })

      return { recordId: action.record.id }
    }),

  acknowledge: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const entry = await prisma.acknowledgement.findFirst({
        where: { nonConformityId: input.id, userId: ctx.user.id },
      })
      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Você não está na lista de envolvidos deste registro',
        })
      }
      await prisma.acknowledgement.update({
        where: { id: entry.id },
        data: { acknowledgedAt: new Date() },
      })
      return { id: input.id }
    }),

  sign: managerProcedure
    .input(
      z.object({
        id: z.string().min(1),
        role: z.enum(['TECHNICAL_MANAGER', 'GENERAL_MANAGER']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const record = await findVisibleRecord(input.id, ctx.user)
      const data =
        input.role === 'TECHNICAL_MANAGER'
          ? {
              technicalManagerId: ctx.user.id,
              technicalManagerSignedAt: new Date(),
            }
          : {
              generalManagerId: ctx.user.id,
              generalManagerSignedAt: new Date(),
            }

      await prisma.nonConformity.update({ where: { id: record.id }, data })
      return { id: record.id }
    }),

  removeAttachment: protectedProcedure
    .input(z.object({ attachmentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await prisma.attachment.findUnique({
        where: { id: input.attachmentId },
        include: {
          record: { select: { id: true, status: true, createdById: true } },
        },
      })
      if (!attachment) throw new TRPCError({ code: 'NOT_FOUND' })
      assertEditable(ctx.user, attachment.record)
      if (
        ctx.user.role === 'COLLABORATOR' &&
        attachment.uploadedById !== ctx.user.id
      ) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }
      await prisma.attachment.delete({ where: { id: attachment.id } })
      return { recordId: attachment.record.id }
    }),
})
