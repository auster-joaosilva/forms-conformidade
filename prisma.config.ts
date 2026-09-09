import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // ponytail: `prisma generate` roda sem banco (build da imagem), então a URL
    // é opcional aqui. Quem exige conexão (migrate, studio, seed) valida no
    // docker-entrypoint.sh ou no src/config/env.ts.
    url: process.env.DATABASE_URL ?? '',
  },
})
