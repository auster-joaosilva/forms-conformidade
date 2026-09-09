import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from '@/lib/trpc/init'
import { prisma } from '@/lib/prisma'
import { isAuthentikLoginEnabled, isAuthentikSyncEnabled } from '@/config/env'
import { syncDirectory } from '@/lib/authentik'
import { userRoles } from '@/features/directory/schemas'

export const directoryRouter = createTRPCRouter({
  authConfig: publicProcedure.query(() => ({
    authentikLoginEnabled: isAuthentikLoginEnabled,
    authentikSyncEnabled: isAuthentikSyncEnabled,
  })),

  me: publicProcedure.query(({ ctx }) => ctx.user),

  departments: protectedProcedure.query(() =>
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        authentikGroupId: true,
        _count: { select: { members: true, records: true } },
      },
    }),
  ),

  users: protectedProcedure.query(() =>
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        active: true,
        authentikId: true,
        lastSyncedAt: true,
        departments: { select: { department: { select: { id: true, name: true } } } },
      },
    }),
  ),

  allUsers: adminProcedure.query(() =>
    prisma.user.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        active: true,
        authentikId: true,
        lastSyncedAt: true,
        departments: { select: { department: { select: { id: true, name: true } } } },
      },
    }),
  ),

  setUserRole: adminProcedure
    .input(z.object({ userId: z.string().min(1), role: z.enum(userRoles) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id && input.role !== 'ADMIN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Você não pode remover sua própria permissão de admin',
        })
      }
      await prisma.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      })
      return { userId: input.userId }
    }),

  setUserActive: adminProcedure
    .input(z.object({ userId: z.string().min(1), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id && !input.active) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Você não pode desativar seu próprio usuário',
        })
      }
      await prisma.user.update({
        where: { id: input.userId },
        data: { active: input.active },
      })
      return { userId: input.userId }
    }),

  sync: adminProcedure.mutation(async () => {
    if (!isAuthentikSyncEnabled) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Configure AUTHENTIK_ISSUER_URL e AUTHENTIK_API_TOKEN para sincronizar',
      })
    }
    return syncDirectory()
  }),
})
