import { createFileRoute } from '@tanstack/react-router'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const Route = createFileRoute('/api/attachments/$attachmentId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('Não autenticado', { status: 401 })

        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            role: true,
            active: true,
            departments: { select: { departmentId: true } },
          },
        })
        if (!user || !user.active) {
          return new Response('Não autenticado', { status: 401 })
        }

        const attachment = await prisma.attachment.findUnique({
          where: { id: params.attachmentId },
          include: {
            record: {
              select: {
                departmentId: true,
                createdById: true,
                actions: { select: { assigneeId: true } },
                acknowledgements: { select: { userId: true } },
              },
            },
          },
        })
        if (!attachment) return new Response('Não encontrado', { status: 404 })

        const { record } = attachment
        const canRead =
          user.role === 'ADMIN' ||
          record.createdById === user.id ||
          user.departments.some(
            (entry) => entry.departmentId === record.departmentId,
          ) ||
          record.actions.some((action) => action.assigneeId === user.id) ||
          record.acknowledgements.some((entry) => entry.userId === user.id)

        if (!canRead) return new Response('Sem permissão', { status: 403 })

        return new Response(new Uint8Array(attachment.content), {
          headers: {
            'Content-Type': attachment.mimeType,
            'Content-Length': String(attachment.size),
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
            'Cache-Control': 'private, no-store',
          },
        })
      },
    },
  },
})
