import { env, isAuthentikSyncEnabled } from '@/config/env'
import { prisma } from '@/lib/prisma'

type AuthentikGroup = {
  pk: string
  name: string
}

type AuthentikUser = {
  pk: number
  uuid: string
  username: string
  name: string
  email: string
  is_active: boolean
  type: string
  groups_obj?: Array<AuthentikGroup>
  attributes?: Record<string, unknown>
}

type AuthentikPage<T> = {
  results: Array<T>
  pagination?: { next?: number }
}

export type DirectorySyncResult = {
  departments: number
  users: number
}

function requireSyncConfig() {
  if (!isAuthentikSyncEnabled) {
    throw new Error(
      'Authentik directory sync requires AUTHENTIK_ISSUER_URL and AUTHENTIK_API_TOKEN',
    )
  }
}

function apiUrl(path: string, params: Record<string, string> = {}) {
  const url = new URL(`/api/v3${path}`, new URL(env.AUTHENTIK_ISSUER_URL!).origin)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

async function fetchPages<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<Array<T>> {
  const items: Array<T> = []
  let page = 1

  while (page > 0) {
    const url = apiUrl(path, { ...params, page: String(page), page_size: '200' })
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.AUTHENTIK_API_TOKEN}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(
        `Authentik API ${path} responded with ${response.status} ${response.statusText}`,
      )
    }

    const body = (await response.json()) as AuthentikPage<T>
    items.push(...body.results)
    page = body.pagination?.next ?? 0
  }

  return items
}

function isDirectoryUser(user: AuthentikUser) {
  return Boolean(user.email) && !user.type.includes('service_account')
}

function positionOf(user: AuthentikUser) {
  const title = user.attributes?.title ?? user.attributes?.position
  return typeof title === 'string' && title.length > 0 ? title : null
}

async function upsertDepartments(groups: Array<AuthentikGroup>) {
  for (const group of groups) {
    await prisma.department.upsert({
      where: { authentikGroupId: group.pk },
      create: { name: group.name, authentikGroupId: group.pk },
      update: { name: group.name },
    })
  }
}

async function upsertUser(user: AuthentikUser) {
  const email = user.email.toLowerCase()
  const isMaster = email === env.MASTER_USER_EMAIL?.toLowerCase()

  const stored = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: user.name || user.username,
      authentikId: user.uuid,
      position: positionOf(user),
      active: user.is_active,
      emailVerified: true,
      role: isMaster ? 'ADMIN' : 'COLLABORATOR',
      lastSyncedAt: new Date(),
    },
    update: {
      name: user.name || user.username,
      authentikId: user.uuid,
      position: positionOf(user),
      active: user.is_active,
      lastSyncedAt: new Date(),
      ...(isMaster ? { role: 'ADMIN' as const } : {}),
    },
  })

  const groupIds = (user.groups_obj ?? []).map((group) => group.pk)
  const departments = await prisma.department.findMany({
    where: { authentikGroupId: { in: groupIds } },
    select: { id: true },
  })

  await prisma.$transaction([
    prisma.departmentMember.deleteMany({ where: { userId: stored.id } }),
    prisma.departmentMember.createMany({
      data: departments.map((department) => ({
        userId: stored.id,
        departmentId: department.id,
      })),
    }),
  ])

  return stored
}

export async function syncDirectory(): Promise<DirectorySyncResult> {
  requireSyncConfig()

  const groups = await fetchPages<AuthentikGroup>('/core/groups/')
  await upsertDepartments(groups)

  const users = (
    await fetchPages<AuthentikUser>('/core/users/', { include_groups: 'true' })
  ).filter(isDirectoryUser)

  for (const user of users) {
    await upsertUser(user)
  }

  return { departments: groups.length, users: users.length }
}

export async function syncUserByEmail(email: string) {
  if (!isAuthentikSyncEnabled) return

  const users = await fetchPages<AuthentikUser>('/core/users/', {
    email: email.toLowerCase(),
    include_groups: 'true',
  })
  const match = users.find(
    (user) => user.email.toLowerCase() === email.toLowerCase(),
  )
  if (!match || !isDirectoryUser(match)) return

  const groups = match.groups_obj ?? []
  if (groups.length > 0) {
    await upsertDepartments(groups)
  }
  await upsertUser(match)
}
