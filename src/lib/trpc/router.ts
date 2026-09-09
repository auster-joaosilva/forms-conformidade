import { createTRPCRouter } from '@/lib/trpc/init'
import { nonConformitiesRouter } from '@/features/non-conformities/server/router'
import { directoryRouter } from '@/features/directory/server/router'

export const trpcRouter = createTRPCRouter({
  records: nonConformitiesRouter,
  directory: directoryRouter,
})

export type TRPCRouter = typeof trpcRouter
