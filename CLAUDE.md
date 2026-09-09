# forms-conformidade

Aplicação web do formulário `RQ-0XX` do SGQ — Registro de Não Conformidade, Ação
Corretiva ou Preventiva (RACP). Documento de origem:
`docs/00-Registro-de-Não-Conformidade-Ação-Corretiva-ou-Preventiva-Modelo.docx`.
Usuários vêm do Authentik local, registros ficam no Postgres compartilhado,
anexos no MinIO. Deploy no Dokploy.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | dev server na 3000 |
| `npm run typecheck` | `tsc --noEmit` — precisa ficar limpo |
| `npm test` | `node:test` via tsx |
| `npm run build` | build SSR + client em `dist/` |
| `npm start` | servidor de produção (`server.mjs`) |
| `npm run generate-routes` | regera `src/app/routeTree.gen.ts` (o vite faz isso sozinho) |
| `npm run db:migrate` | cria/aplica migração em dev |
| `npm run db:deploy` | `prisma migrate deploy` (usado no container) |
| `npm run db:seed` | master user + sincronização do Authentik |
| `npm run db:studio` | Prisma Studio |

Os scripts `db:*` (exceto `db:deploy`) carregam `.env.local` via `dotenv-cli`.

Antes de concluir qualquer mudança: `npm run typecheck && npm test && npm run build`.

## Stack

TanStack Start 1.168 (React 19, file router) · tRPC 11 + superjson · Prisma 7
com driver adapter `@prisma/adapter-pg` · Better Auth 1.5 · Tailwind 4 +
shadcn/ui (new-york) · zod 4 · react-hook-form · minio 8 · srvx (host HTTP).

## Estrutura (bulletproof-react)

```
src/
  app/routes/            uma rota por arquivo (TanStack Router)
  components/ui/         shadcn/ui — não editar à mão, usar o CLI
  components/layouts/    layout da aplicação
  config/                env.ts (zod, server-only) e paths.ts
  features/
    auth/                guarda de sessão e usuário atual
    directory/           usuários, departamentos, permissões, sync do Authentik
    non-conformities/    o RACP
  lib/                   auth, auth-client, authentik, bootstrap, prisma,
                         storage, trpc/, query/, utils
  types/                 declarações globais
  utils/                 helpers puros (+ `*.test.ts` ao lado)
```

Cada feature é dona do seu domínio:

```
features/<feature>/
  schemas.ts             zod + labels — compartilhado cliente/servidor
  types.ts               tipos derivados do router (inferRouterOutputs) e mappers
  components/            UI da feature
  server/router.ts       router tRPC da feature (só o servidor importa)
```

Regras de colocação:

- Código usado por **uma** feature vive dentro dela. Só promova para
  `src/components`, `src/lib` ou `src/utils` quando o segundo consumidor aparecer.
- Rotas em `src/app/routes` são finas: `createFileRoute` + composição de
  componentes da feature. Lógica não mora em arquivo de rota.
- Novo router tRPC: crie em `features/<feature>/server/router.ts` e registre em
  `src/lib/trpc/router.ts`. Esse arquivo só compõe, não implementa.

## Fronteira cliente/servidor

Isto é o que mais dá errado aqui. `src/config/env.ts` lê `process.env` e
`src/lib/{prisma,auth,authentik,storage,bootstrap}.ts` e todo
`features/*/server/**` são **server-only**.

- Em código de cliente, importe desses módulos apenas com `import type`.
- Tipos que o cliente precisa ficam em `features/<feature>/types.ts` ou
  `schemas.ts`, nunca no módulo de servidor. `SessionUser` vive em
  `features/directory/types.ts` justamente por isso — `src/lib/trpc/init.ts`
  reexporta o tipo.
- Enums do Prisma não vão para o cliente. As uniões de string em `schemas.ts`
  são a fonte da verdade compartilhada.

## Dados (tRPC + React Query)

- Contexto e procedures em `src/lib/trpc/init.ts`: `publicProcedure`,
  `protectedProcedure`, `managerProcedure` (gestor ou admin), `adminProcedure`.
- O contexto resolve o usuário do banco a cada request e trata usuário inativo
  como não autenticado.
- **Sem prefetch em loader.** O client tRPC do SSR aponta para
  `localhost:3000` sem cookies, então toda query autenticada rodaria anônima.
  Use `useQuery` (não `useSuspenseQuery`) nos componentes: o SSR renderiza o
  estado pendente e o browser busca. Se algum dia precisar de prefetch, resolva
  o repasse de cookies primeiro.
- Invalidação por chave: `queryClient.invalidateQueries({ queryKey: trpc.x.y.queryKey(...) })`.
- Upload de arquivo não passa por tRPC (superjson não serializa `File`): rotas
  HTTP em `src/app/routes/api.*.ts`.

## Autorização

Papéis: `ADMIN`, `MANAGER` (gestor), `COLLABORATOR` (colaborador). Vêm do banco,
definidos pelo admin na tela *Usuários* — a sincronização do Authentik **não**
sobrescreve (só `MASTER_USER_EMAIL` é forçado para `ADMIN`).

- Visibilidade: `visibilityWhere(user)` em
  `features/non-conformities/server/router.ts`. Admin vê tudo; os demais veem
  registros do seu departamento, os que criaram, os que têm ação atribuída ou
  nos quais são envolvidos.
- Edição: `assertEditable(user, record)`. Encerrado/cancelado é imutável;
  colaborador só edita o que criou em `DRAFT`/`OPEN`.
- Campos de gestor (seções 5, 6 e assinaturas) são removidos do payload em
  `scalarPayload()` quando o autor é colaborador — nunca confie no `disabled` da UI.
- Transições de situação: mapa `allowedTransitions`. Encerrar exige resultado,
  data e responsável da verificação da eficácia.

Toda regra nova de permissão entra no servidor primeiro; a UI só reflete.

## Auth (Better Auth + Authentik)

- `src/lib/auth.ts` — adapter Prisma, `emailAndPassword` (fallback do master),
  `genericOAuth` com `providerId: 'authentik'` e `discoveryUrl`.
- Nesta versão o `genericOAuth` registra o provider como **social provider**:
  no cliente use `authClient.signIn.social({ provider: 'authentik' })`.
  Não existe `signIn.oauth2` nem `genericOAuthClient`.
- `accountLinking.trustedProviders: ['authentik']` liga o login OIDC ao usuário
  já criado pela sincronização (match por e-mail).
- `databaseHooks.session.create.after` sincroniza nome/cargo/departamentos do
  usuário que entrou. Falha ali nunca deve quebrar o login (fica em try/catch).
- Redirect URI no Authentik: `<APP_URL>/api/auth/callback/authentik`.
- `src/lib/authentik.ts` — API v3 do Authentik (`/core/groups/`, `/core/users/`),
  paginação por `pagination.next`, service accounts e usuários sem e-mail são
  ignorados. Grupos viram `Department` (`authentikGroupId` é a chave estável).
- `src/lib/bootstrap.ts` — idempotente: garante o master user e roda o sync.
  Exposto em `POST /api/bootstrap` (sessão admin **ou** header
  `x-bootstrap-token` igual ao `BETTER_AUTH_SECRET`, comparado com
  `timingSafeEqual`). O entrypoint do container chama isso no start.

### Filtros do sync

Três variáveis, listas separadas por vírgula, `*` como curinga, comparação sem
case (`src/utils/pattern.ts`, com teste em `pattern.test.ts`):

| Variável | Efeito |
| --- | --- |
| `AUTHENTIK_GROUP_ALLOWLIST` | se preenchida, **só** esses grupos viram departamento |
| `AUTHENTIK_GROUP_DENYLIST` | usada quando o allowlist está vazio; padrão `authentik *` |
| `AUTHENTIK_USER_DENYLIST` | e-mails a ignorar (ex.: `*@fornecedor.com.br`) |

Allowlist tem precedência sobre denylist. Service accounts e usuários sem e-mail
são sempre ignorados, independente de configuração.

`pruneFilteredDepartments()` apaga departamentos que passaram a ser filtrados,
mas **só os que não têm registro vinculado** — filtro errado nunca derruba
histórico.

`deactivateFilteredUsers()` desativa (nunca apaga) contas já cadastradas que
passaram a bater no denylist — sem isso o filtro valeria só para inserção e a
conta antiga continuaria entrando por OIDC. `MASTER_USER_EMAIL` é sempre
poupado. Ausência no diretório **não** desativa ninguém: só o denylist explícito
conta, para uma resposta parcial da API não virar desativação em massa.

## Banco (Prisma)

- Generator `prisma-client` com saída em `src/generated/prisma` — **gitignored**,
  rode `npx prisma generate` depois de mexer no schema (o Dockerfile já faz).
- Conexão só via `src/lib/prisma.ts` (singleton + `PrismaPg`). Nunca instanciar
  `PrismaClient` em outro lugar.
- Tabelas do Better Auth (`User`, `Session`, `Account`, `Verification`) estão no
  mesmo schema. `User` é a **única** tabela de usuário: os campos do app
  (`role`, `position`, `authentikId`, `active`, `lastSyncedAt`) são
  `additionalFields` com `input: false`.
- Numeração do RACP: `NNN/AAAA`, `max(sequence)+1` por ano protegido pelo índice
  único `@@unique([year, sequence])` com retry em `P2002`.
- `prisma.config.ts` lê `process.env.DATABASE_URL ?? ''`, **não** o helper
  `env()` do Prisma: `env()` lança exceção quando a variável falta e isso quebra
  o `prisma generate` no build da imagem, que não tem (nem deve ter) a URL. Quem
  precisa de conexão valida antes: `docker-entrypoint.sh` e `src/config/env.ts`.
- Sem banco à mão, gere migração com
  `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o prisma/migrations/<n>_<nome>/migration.sql`.
  (`--to-schema-datamodel` foi removido no Prisma 7.)

## Anexos (MinIO)

`src/lib/storage.ts`. O Postgres guarda metadados + `objectKey`; o arquivo vai
para o MinIO com chave `records/<recordId>/<uuid>-<arquivo>`.

- Upload envia ao storage e remove o objeto se a criação do registro falhar.
- Download é sempre pela aplicação (`GET /api/attachments/<id>`), que valida
  permissão e faz stream. **Não** gerar URL pública ou pré-assinada — a checagem
  por departamento/envolvido se perderia.
- Validar tipo (allowlist de MIME) e tamanho (`MAX_UPLOAD_BYTES`) no servidor.

## Convenções de código

- **Idioma**: identificadores, nomes de arquivo, comentários e mensagens de
  commit de código em inglês; texto de UI e mensagens de erro para o usuário em
  pt-BR.
- **Nomes de arquivo**: `kebab-case.ts[x]`. Componentes em `PascalCase`,
  funções e variáveis em `camelCase`, constantes de módulo em `SCREAMING_SNAKE`.
- **Sem comentários desnecessários.** Comentário só para o que o código não
  consegue dizer. Simplificação deliberada leva prefixo `ponytail:` nomeando o
  teto e o caminho de upgrade.
- **Aliases**: use `@/...`. O `#/...` também resolve (tsconfig + `imports` do
  package.json) mas o CLI do shadcn quebra com ele (`EPERM mkdir`), então
  `components.json` está em `@/` e o código novo segue `@/`.
- **Formulários**: react-hook-form + `standardSchemaResolver` com o schema zod da
  feature. Mantenha input e output do schema idênticos — sem `.default()` no
  schema de formulário; use `''` para "vazio" em selects e converta para `null`
  no servidor (`nullableId`).
- **Datas**: `<input type="date">` e os helpers de `src/utils/date.ts`.
  Armazenar via `parseDateInput` (meio-dia UTC) evita virada de dia em -03.
  Não adicionar biblioteca de data.
- **UI**: componentes shadcn via `npx shadcn@latest add <nome>`. Não deixar
  componente instalado sem uso. Tema é o
  [tweakcn](https://tweakcn.com/r/themes/cmlhfpjhw000004l4f4ax3m7z) — mexa nos
  tokens de `src/styles.css`, não em cores soltas nas classes.
- **Ícones**: lucide-react.
- **Toasts**: `sonner` (`toast.success` / `toast.error`), `<Toaster/>` no root.

## Testes

`node:test` + `node:assert/strict`, rodados por `tsx --test`. Arquivo
`*.test.ts` ao lado do código. Sem framework, sem fixtures.

Lógica não trivial (branch, loop, parser, permissão, dinheiro) deixa **um**
check executável — o menor que falha se a lógica quebrar. One-liner trivial não
precisa de teste.

## Env

Tudo validado em `src/config/env.ts` (zod, falha rápido no boot). Variável nova:
adicione ao schema, ao `docker-compose.yml` e ao `.env.example` — os três.
`.env.local` é local e gitignored.

Flags derivadas: `isAuthentikLoginEnabled`, `isAuthentikSyncEnabled`.

## Build e host

- `vite build` gera `dist/server/server.js` (só exporta `{ fetch }`) e
  `dist/client`. Quem serve é `server.mjs` com `srvx` + `srvx/static`.
- Rotas de servidor usam a opção `server: { handlers: { ... } }` do
  `createFileRoute`. A tipagem dessa opção vem de um module augmentation que só
  entra no programa por causa de `src/types/tanstack-start.d.ts`. **Não apague
  esse arquivo** ou o `tsc` passa a reclamar de `server` em todas as rotas de API.
- O diretório de rotas está configurado em **dois** lugares e com bases
  diferentes: `vite.config.ts` (`router.routesDirectory: 'app/routes'`, relativo
  a `src/`) e `tsr.config.json` (`src/app/routes`, relativo à raiz). Mudar um sem
  o outro quebra o build ou o CLI.

## Infra (Dokploy — somente leitura)

Nunca alterar nada no Dokploy por MCP. Ler para entender, e entregar
compose/env para o time aplicar.

| Recurso | Fato |
| --- | --- |
| Postgres compartilhado | container `postgres` (`postgres:17`), rede externa `shared-postgres` |
| Authentik | `auth.auster.local`, container `authentik-server`, portas 9000 |
| MinIO | container `minio`, API 9000, console 9001, rede `dokploy-network`; externo em `s3.auster.local` / `minio.auster.local` |
| Domínios | `*.auster.local` via Traefik, HTTPS com certificado interno |
| DNS interno | `10.10.30.242` (necessário no container para resolver `*.auster.local`) |
| TLS interno | self-signed → `NODE_TLS_REJECT_UNAUTHORIZED=0` |

Convenção dos serviços Node do time: build local via `Dockerfile`, redes
`shared-postgres` + `dokploy-network` + `default`, `dns` interno, e env no
padrão `POSTGRES_*` / `AUTHENTIK_*` / `MASTER_USER_*` / `S3_*`.

**As labels do Traefik são geradas pelo Dokploy** a partir da aba *Domains* —
não colocar label no `docker-compose.yml`.

## Git

- Commits em pt-BR, formato convencional (`feat:`, `fix:`, `refactor:`, `docs:`).
  Corpo em bullets quando a mudança tem mais de um efeito.
- **Sem `Co-Authored-By`** e sem linha de ferramenta.
- Não commitar `.env.local`, `dist/`, `src/generated/`.
- `docs/` é ignorado exceto `docs/*.docx` (o formulário-fonte é versionado).

## Decisões já tomadas (não re-litigar sem motivo)

- Anexos no MinIO, não no Postgres nem em disco local.
- PDF pela impressão do navegador (`/print/records/<id>` + `@media print`), sem
  biblioteca de PDF.
- Uma única tabela `User` compartilhada entre Better Auth e o domínio.
- Papéis no app, grupos no Authentik. Grupo do Authentik nunca define papel.
- Guarda de sessão no cliente (`AuthGuard`), sem `beforeLoad` no servidor.
