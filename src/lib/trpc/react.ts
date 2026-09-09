import { createTRPCContext } from '@trpc/tanstack-react-query'

import type { TRPCRouter } from '@/lib/trpc/router'

export const { TRPCProvider, useTRPC } = createTRPCContext<TRPCRouter>()
