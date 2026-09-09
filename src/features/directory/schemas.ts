export const userRoles = ['ADMIN', 'MANAGER', 'COLLABORATOR'] as const

export type UserRole = (typeof userRoles)[number]

export const userRoleLabels: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Gestor',
  COLLABORATOR: 'Colaborador',
}

export const userRoleDescriptions: Record<UserRole, string> = {
  ADMIN: 'Acesso total, gestão de permissões e sincronização do Authentik',
  MANAGER: 'Verifica eficácia, assina e encerra registros do seu departamento',
  COLLABORATOR: 'Abre registros, executa ações e dá ciência',
}
