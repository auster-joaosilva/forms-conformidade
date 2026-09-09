import { fileURLToPath } from 'node:url'
import { serve } from 'srvx'
import { serveStatic } from 'srvx/static'

import handler from './dist/server/server.js'

serve({
  port: Number(process.env.PORT ?? 3000),
  hostname: '0.0.0.0',
  middleware: [
    serveStatic({ dir: fileURLToPath(new URL('./dist/client', import.meta.url)) }),
  ],
  fetch: (request) => handler.fetch(request),
})
