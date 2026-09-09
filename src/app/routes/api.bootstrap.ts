import { timingSafeEqual } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'

import { env } from '@/config/env'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bootstrap } from '@/lib/bootstrap'

function hasValidToken(request: Request) {
  const provided = request.headers.get('x-bootstrap-token')
  if (!provided) return false
  const expected = Buffer.from(env.BETTER_AUTH_SECRET)
  const received = Buffer.from(provided)
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  )
}

async function isAdmin(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return false
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, active: true },
  })
  return Boolean(user?.active) && user?.role === 'ADMIN'
}

export const Route = createFileRoute('/api/bootstrap')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hasValidToken(request) && !(await isAdmin(request))) {
          return new Response('Sem permissão', { status: 403 })
        }

        try {
          return Response.json(await bootstrap())
        } catch (error) {
          console.error('Bootstrap failed', error)
          return new Response(
            error instanceof Error ? error.message : 'Falha no bootstrap',
            { status: 500 },
          )
        }
      },
    },
  },
})
