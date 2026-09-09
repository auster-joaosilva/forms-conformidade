import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { genericOAuth } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { env, isAuthentikLoginEnabled } from '@/config/env'
import { prisma } from '@/lib/prisma'
import { syncUserByEmail } from '@/lib/authentik'

export const AUTHENTIK_PROVIDER_ID = 'authentik'

function discoveryUrl() {
  const issuer = env.AUTHENTIK_ISSUER_URL!.endsWith('/')
    ? env.AUTHENTIK_ISSUER_URL!
    : `${env.AUTHENTIK_ISSUER_URL!}/`
  return new URL('.well-known/openid-configuration', issuer).toString()
}

export const auth = betterAuth({
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: [AUTHENTIK_PROVIDER_ID],
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', input: false, defaultValue: 'COLLABORATOR' },
      position: { type: 'string', input: false, required: false },
      authentikId: { type: 'string', input: false, required: false },
      active: { type: 'boolean', input: false, defaultValue: true },
      lastSyncedAt: { type: 'date', input: false, required: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { email: true },
          })
          if (!user) return
          await syncUserByEmail(user.email).catch((error: unknown) => {
            console.error('Authentik user sync failed', error)
          })
        },
      },
    },
  },
  plugins: [
    ...(isAuthentikLoginEnabled
      ? [
          genericOAuth({
            config: [
              {
                providerId: AUTHENTIK_PROVIDER_ID,
                discoveryUrl: discoveryUrl(),
                clientId: env.AUTHENTIK_CLIENT_ID!,
                clientSecret: env.AUTHENTIK_CLIENT_SECRET!,
                scopes: ['openid', 'profile', 'email'],
              },
            ],
          }),
        ]
      : []),
    tanstackStartCookies(),
  ],
})
