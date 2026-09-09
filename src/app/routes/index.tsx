import { createFileRoute, redirect } from '@tanstack/react-router'

import { paths } from '@/config/paths'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: paths.records })
  },
})
