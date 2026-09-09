import { createFileRoute } from '@tanstack/react-router'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { env } from '@/config/env'
import {
  attachmentObjectKey,
  deleteObject,
  putObject,
} from '@/lib/storage'
import { attachmentSections } from '@/features/non-conformities/schemas'

import type { AttachmentSection } from '@/features/non-conformities/schemas'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
]

export const Route = createFileRoute('/api/records/$recordId/attachments')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
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

        const record = await prisma.nonConformity.findUnique({
          where: { id: params.recordId },
          select: {
            id: true,
            status: true,
            createdById: true,
            departmentId: true,
          },
        })
        if (!record) return new Response('Registro não encontrado', { status: 404 })

        const inDepartment = user.departments.some(
          (entry) => entry.departmentId === record.departmentId,
        )
        const isVisible =
          user.role === 'ADMIN' || inDepartment || record.createdById === user.id
        const isEditable =
          record.status !== 'CLOSED' && record.status !== 'CANCELLED'

        if (!isVisible || !isEditable) {
          return new Response('Sem permissão', { status: 403 })
        }

        const form = await request.formData()
        const file = form.get('file')
        const section = String(form.get('section') ?? '')

        if (!(file instanceof File)) {
          return new Response('Arquivo obrigatório', { status: 400 })
        }
        if (!attachmentSections.includes(section as AttachmentSection)) {
          return new Response('Seção inválida', { status: 400 })
        }
        if (file.size === 0) {
          return new Response('Arquivo vazio', { status: 400 })
        }
        if (file.size > env.MAX_UPLOAD_BYTES) {
          return new Response(
            `Arquivo maior que o limite de ${Math.floor(env.MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
            { status: 413 },
          )
        }
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          return new Response('Tipo de arquivo não permitido', { status: 415 })
        }

        const objectKey = attachmentObjectKey(record.id, file.name)
        await putObject(
          objectKey,
          Buffer.from(await file.arrayBuffer()),
          file.type,
        )

        try {
          const attachment = await prisma.attachment.create({
            data: {
              nonConformityId: record.id,
              section: section as AttachmentSection,
              fileName: file.name,
              mimeType: file.type,
              size: file.size,
              objectKey,
              uploadedById: user.id,
            },
            select: { id: true },
          })

          return Response.json(attachment, { status: 201 })
        } catch (error) {
          await deleteObject(objectKey).catch(() => undefined)
          throw error
        }
      },
    },
  },
})
