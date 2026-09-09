import { env, isAuthentikSyncEnabled } from '@/config/env'
import { prisma } from '@/lib/prisma'
import { matchesAnyPattern } from '@/utils/pattern'

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
  skippedGroups: number
  skippedUsers: number
  removedDepartments: number
  deactivatedUsers: number
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
      // O Authentik responde 403 tanto para token inválido quanto para falta de
      // permissão; o corpo é o que distingue os dois casos.
      const detail = await response.text().catch(() => '')
      throw new Error(
        `Authentik API ${path} respondeu ${response.status} ${response.statusText}${
          detail ? `: ${detail.slice(0, 300)}` : ''
        }`,
      )
    }

    const body = (await response.json()) as AuthentikPage<T>
    items.push(...body.results)
    page = body.pagination?.next ?? 0
  }

  return items
}

function isDepartmentGroup(name: string) {
  if (env.AUTHENTIK_GROUP_ALLOWLIST.length > 0) {
    return matchesAnyPattern(name, env.AUTHENTIK_GROUP_ALLOWLIST)
  }
  return !matchesAnyPattern(name, env.AUTHENTIK_GROUP_DENYLIST)
}

function isDirectoryUser(user: AuthentikUser) {
  if (!user.email) return false
  if (user.type.includes('service_account')) return false
  return !matchesAnyPattern(user.email, env.AUTHENTIK_USER_DENYLIST)
}

function positionOf(user: AuthentikUser) {
  const title = user.attributes?.title ?? user.attributes?.position
  return typeof title === 'string' && title.length > 0 ? title : null
}

async function upsertDepartments(groups: Array<AuthentikGroup>) {
  for (const group of groups.filter((group) => isDepartmentGroup(group.name))) {
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

// Remove departamentos que passaram a ser filtrados. Só apaga os que nao tem
// registro vinculado, para nunca derrubar histórico por causa de um filtro errado.
async function pruneFilteredDepartments() {
  const candidates = await prisma.department.findMany({
    where: { records: { none: {} } },
    select: { id: true, name: true },
  })
  const stale = candidates.filter(
    (department) => !isDepartmentGroup(department.name),
  )
  if (stale.length === 0) return 0

  const { count } = await prisma.department.deleteMany({
    where: { id: { in: stale.map((department) => department.id) } },
  })
  return count
}

// Desativa (nunca apaga) contas que passaram a ser filtradas: sem isso o
// denylist só impediria a inserção e a conta antiga continuaria logando.
// Só considera o denylist explícito -- ausência no diretório não desativa
// ninguém, para uma resposta parcial da API nunca virar desativação em massa.
async function deactivateFilteredUsers() {
  if (env.AUTHENTIK_USER_DENYLIST.length === 0) return 0

  const candidates = await prisma.user.findMany({
    where: { active: true, authentikId: { not: null } },
    select: { id: true, email: true },
  })

  const masterEmail = env.MASTER_USER_EMAIL?.toLowerCase()
  const filtered = candidates.filter(
    (user) =>
      user.email !== masterEmail &&
      matchesAnyPattern(user.email, env.AUTHENTIK_USER_DENYLIST),
  )
  if (filtered.length === 0) return 0

  const { count } = await prisma.user.updateMany({
    where: { id: { in: filtered.map((user) => user.id) } },
    data: { active: false },
  })
  return count
}

export async function syncDirectory(): Promise<DirectorySyncResult> {
  requireSyncConfig()

  const allGroups = await fetchPages<AuthentikGroup>('/core/groups/')
  const groups = allGroups.filter((group) => isDepartmentGroup(group.name))
  await upsertDepartments(groups)
  const removedDepartments = await pruneFilteredDepartments()

  const allUsers = await fetchPages<AuthentikUser>('/core/users/', {
    include_groups: 'true',
  })
  const users = allUsers.filter(isDirectoryUser)

  for (const user of users) {
    await upsertUser(user)
  }

  const deactivatedUsers = await deactivateFilteredUsers()

  return {
    departments: groups.length,
    users: users.length,
    skippedGroups: allGroups.length - groups.length,
    skippedUsers: allUsers.length - users.length,
    removedDepartments,
    deactivatedUsers,
  }
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
