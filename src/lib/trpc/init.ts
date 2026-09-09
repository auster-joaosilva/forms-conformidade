import { TRPCError, initTRPC } from '@trpc/server'
import superjson from 'superjson'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import type { SessionUser } from '@/features/directory/types'

export type { SessionUser } from '@/features/directory/types'

export async function createTRPCContext({ request }: { request: Request }) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { user: null }

  const found = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      position: true,
      active: true,
      departments: { select: { departmentId: true } },
    },
  })

  if (!found || !found.active) return { user: null }

  const user: SessionUser = {
    id: found.id,
    name: found.name,
    email: found.email,
    role: found.role,
    position: found.position,
    departmentIds: found.departments.map((entry) => entry.departmentId),
  }

  return { user }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<TRPCContext>().create({ transformer: superjson })

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { user: ctx.user } })
})

export const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === 'COLLABORATOR') {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
  return next()
})

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'ADMIN') throw new TRPCError({ code: 'FORBIDDEN' })
  return next()
})
