import { env, isAuthentikSyncEnabled } from '@/config/env'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { syncDirectory } from '@/lib/authentik'

import type { DirectorySyncResult } from '@/lib/authentik'

export async function ensureMasterUser() {
  if (!env.MASTER_USER_EMAIL || !env.MASTER_USER_PASSWORD) return null

  const email = env.MASTER_USER_EMAIL.toLowerCase()
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  if (!existing) {
    await auth.api.signUpEmail({
      body: {
        email,
        password: env.MASTER_USER_PASSWORD,
        name: env.MASTER_USER_NAME,
      },
    })
  }

  await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN', emailVerified: true, active: true },
  })

  return email
}

export async function bootstrap(): Promise<{
  master: string | null
  directory: DirectorySyncResult | null
}> {
  const master = await ensureMasterUser()
  const directory = isAuthentikSyncEnabled ? await syncDirectory() : null
  return { master, directory }
}
