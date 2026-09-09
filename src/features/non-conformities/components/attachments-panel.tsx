import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, Paperclip, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTRPC } from '@/lib/trpc/react'
import {
  attachmentSectionLabels,
  attachmentSections,
} from '@/features/non-conformities/schemas'

import type { AttachmentSection } from '@/features/non-conformities/schemas'
import type { RecordDetail } from '@/features/non-conformities/types'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentsPanel({
  record,
  readOnly,
}: {
  record: RecordDetail
  readOnly: boolean
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [section, setSection] = useState<AttachmentSection>('ROOT_CAUSE')
  const [uploading, setUploading] = useState(false)

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.records.byId.queryKey({ id: record.id }),
    })

  const removeAttachment = useMutation(
    trpc.records.removeAttachment.mutationOptions({
      onSuccess: () => {
        toast.success('Anexo removido')
        void invalidate()
      },
      onError: (error) => toast.error(error.message),
    }),
  )

  async function upload(file: File) {
    setUploading(true)
    const body = new FormData()
    body.append('file', file)
    body.append('section', section)

    const response = await fetch(`/api/records/${record.id}/attachments`, {
      method: 'POST',
      body,
    })
    setUploading(false)

    if (!response.ok) {
      const message = await response.text()
      toast.error(message || 'Falha ao enviar o anexo')
      return
    }

    toast.success('Anexo enviado')
    void invalidate()
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={section}
            onValueChange={(value) => setSection(value as AttachmentSection)}
          >
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {attachmentSections.map((option) => (
                <SelectItem key={option} value={option}>
                  {attachmentSectionLabels[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
              event.target.value = ''
            }}
          />

          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Enviar anexo
          </Button>
        </div>
      )}

      {record.attachments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum anexo.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {record.attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-4 p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Paperclip className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {attachment.fileName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {attachmentSectionLabels[attachment.section]} ·{' '}
                    {formatSize(attachment.size)} · {attachment.uploadedBy.name}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button asChild variant="ghost" size="icon">
                  <a
                    href={`/api/attachments/${attachment.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="size-4" />
                  </a>
                </Button>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={removeAttachment.isPending}
                    onClick={() =>
                      removeAttachment.mutate({ attachmentId: attachment.id })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
