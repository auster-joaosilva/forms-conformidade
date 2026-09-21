# Registro de Não Conformidade, Ação Corretiva ou Preventiva (RACP)

Aplicação web que substitui o formulário `RQ-0XX` do Sistema de Gestão da
Qualidade (`docs/00-Registro-de-Não-Conformidade-Ação-Corretiva-ou-Preventiva-Modelo.docx`).
Os registros ficam no Postgres compartilhado e os usuários vêm do Authentik local.

## Mapa do formulário

| Documento | Aplicação |
| --- | --- |
| Nº RACP | gerado automaticamente (`001/2026`, sequência por ano) |
| Preventiva / Corretiva | campo `type` |
| 1. Definição do problema + Data + Origem | `problemDescription`, `problemDate`, `origin` |
| 2. Pré-análise da causa e ação de contenção | `containmentAction` |
| 3. Análise da causa raiz (+ anexos) | `rootCauseAnalysis` + anexos `ROOT_CAUSE` |
| 4. Ação a ser tomada (O que / Quem / Quando / Onde) | tabela `Action`, com responsável do diretório e marcação de conclusão |
| 5. Método de verificação da eficácia | `verificationMethod` (documental, visual, entrevista, outro) |
| 6. Verificação da eficácia + Data + Responsável | `effectivenessResult`, `effectivenessDate`, `effectivenessVerifiedBy` |
| 7. Ciência dos envolvidos (Nome / Cargo / Data / Assinatura) | tabela `Acknowledgement`; a assinatura é a ciência eletrônica com data e hora |
| Assinaturas Responsável Técnico / Gerente Geral | `technicalManager*`, `generalManager*` |

`/print/records/<id>` reproduz o formulário em A4 com cabeçalho, rodapé e
assinaturas para impressão ou PDF (via impressão do navegador).

## Fluxo de situações

`DRAFT` → `OPEN` (emitir) → `IN_PROGRESS` (ao cadastrar ações) →
`UNDER_VERIFICATION` → `CLOSED`. `CANCELLED` a partir de qualquer situação aberta.
O encerramento exige resultado, data e responsável da verificação da eficácia.

## Permissões

Os usuários e os departamentos são espelhos do Authentik (grupos = departamentos).
A permissão da aplicação é definida pelo admin em **Usuários**:

- **Colaborador** — abre registros, edita os que criou enquanto em rascunho/aberto, executa ações atribuídas a ele e dá ciência.
- **Gestor** — tudo do colaborador nos seus departamentos, mais seções 5 e 6, assinaturas, envio para verificação e encerramento.
- **Admin** — acesso a todos os registros, gestão de permissões e sincronização do Authentik.

Visibilidade de um registro: admins veem tudo; os demais veem os registros do seu
departamento, os que criaram, os que têm ação atribuída ou nos quais estão como envolvidos.

## Stack

TanStack Start (React 19) · tRPC · Prisma 7 + Postgres · Better Auth (OIDC
genérico do Authentik) · Tailwind 4 + shadcn/ui com o tema
[tweakcn](https://tweakcn.com/r/themes/cmlhfpjhw000004l4f4ax3m7z).

Estrutura no padrão [bulletproof-react](https://github.com/alan2207/bulletproof-react):

```
src/
  app/routes/              rotas (arquivo por rota, TanStack Router)
  components/ui/           shadcn/ui
  components/layouts/      layout da aplicação
  config/                  env e paths
  features/
    auth/                  guarda de sessão e usuário atual
    directory/             usuários, departamentos e permissões
    non-conformities/      schemas, componentes e router tRPC do RACP
  lib/                     auth, prisma, authentik, trpc, query
  utils/                   helpers (datas)
```

Cada feature guarda o próprio `schemas.ts`, `types.ts`, `components/` e
`server/router.ts` (o router tRPC daquele domínio). `src/lib/trpc/router.ts`
apenas compõe os routers das features.

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local   # ajuste DATABASE_URL e BETTER_AUTH_SECRET
npm run db:migrate           # cria o schema
npm run db:seed              # cria o master user e sincroniza o Authentik (se configurado)
npm run dev
```

Sem Authentik configurado, use `AUTH_MODE=password` e entre com
`MASTER_USER_EMAIL` / `MASTER_USER_PASSWORD`.

```bash
npm run typecheck
npm test
npm run build && npm start
```

## Configuração do Authentik

1. **Provider** — *Applications > Providers > Create > OAuth2/OpenID Provider*
   - Client type: `Confidential`
   - Redirect URI: `https://conformidade.auster.local/api/auth/callback/authentik`
   - Scopes: `openid`, `profile`, `email`
   - Copie *Client ID*, *Client Secret* e o **OpenID Configuration Issuer**
     (`https://auth.auster.local/application/o/<slug>/`) para `AUTHENTIK_ISSUER_URL`.
2. **Application** — *Applications > Applications > Create*, slug
   `forms-conformidade`, vinculada ao provider acima.
3. **Token de API** — crie um service account e um token em
   *Directory > Tokens & App passwords* com permissão de leitura de usuários e
   grupos. Esse token (`AUTHENTIK_API_TOKEN`) é usado para cadastrar **todos**
   os usuários do diretório e criar os departamentos a partir dos grupos.

Sincronização:

- no start do container (`BOOTSTRAP_ON_START=true`) — cria o master user e importa todo o diretório;
- a cada login — atualiza nome, cargo e departamentos do usuário que entrou;
- sob demanda — botão **Sincronizar com o Authentik** em *Usuários*;
- opcionalmente, um *Schedule* no Dokploy chamando
  `POST /api/bootstrap` com o header `x-bootstrap-token: $BETTER_AUTH_SECRET`.

As permissões da aplicação (admin/gestor/colaborador) **não** são sobrescritas
pela sincronização — só o `MASTER_USER_EMAIL` é forçado para admin.

### Filtrando o que entra

Nem todo grupo do Authentik é um departamento (`authentik Admins`, grupos de
service account) e nem todo usuário deve entrar no app. Três variáveis,
separadas por vírgula, aceitando `*` como curinga:

- `AUTHENTIK_GROUP_ALLOWLIST` — se preenchida, só esses grupos viram
  departamento. Ex.: `Fiscal,Contábil,Departamento Pessoal,TI`
- `AUTHENTIK_GROUP_DENYLIST` — usada quando o allowlist está vazio.
  Padrão: `authentik *`
- `AUTHENTIK_USER_DENYLIST` — e-mails a ignorar. Ex.: `*@fornecedor.com.br`

Service accounts e usuários sem e-mail são sempre ignorados. Departamento que
passa a ser filtrado é removido no sync seguinte **se não tiver registros**;
com registros, permanece. Usuário já cadastrado que passa a ser filtrado não é
apagado — desative pela tela de Usuários.

## Deploy no Dokploy

O `docker-compose.yml` segue o padrão dos outros serviços (`crm.auster.local`,
`meet.auster.local`): build local, redes externas `shared-postgres` e
`dokploy-network`, DNS interno e a CA do AD CS montada em
`/etc/ssl/certs/auster-ca.pem` com `NODE_EXTRA_CA_CERTS` apontando para ela.
As labels do Traefik são geradas pelo próprio Dokploy
a partir da aba *Domains* — não as adicione no compose.

1. No Postgres compartilhado (`DB Compartilhado > postgres`), crie o banco e o usuário:

   ```sql
   CREATE USER forms_conformidade WITH PASSWORD '...';
   CREATE DATABASE forms_conformidade OWNER forms_conformidade;
   ```

2. Crie um projeto/serviço **Compose** no Dokploy apontando para este repositório
   (`Compose Path: ./docker-compose.yml`).
3. Preencha as variáveis de ambiente do serviço com base em `.env.example`.
4. Em *Domains*, adicione `conformidade.auster.local`, porta `3000`, HTTPS.
5. Deploy. O entrypoint roda `prisma migrate deploy` e, em seguida, o bootstrap
   (master user + importação do diretório do Authentik).

## Anexos

Os arquivos ficam no MinIO existente; o Postgres guarda só os metadados
(`Attachment.objectKey`, nome, tipo, tamanho, seção e quem enviou). O bucket é
criado na primeira subida, e a chave do objeto é
`records/<recordId>/<uuid>-<arquivo>`.

Dentro do `dokploy-network` o app fala com o container `minio` na porta 9000 em
HTTP (`S3_ENDPOINT=minio`, `S3_USE_SSL=false`); de fora, use
`s3.auster.local` na 443 com `S3_USE_SSL=true`.

O download passa pela aplicação (`GET /api/attachments/<id>`), que valida a
permissão e faz stream do objeto — não são geradas URLs públicas ou pré-assinadas.
Tipos aceitos: PDF, PNG, JPEG, WebP, TXT, CSV, DOC(X) e XLS(X), até
`MAX_UPLOAD_BYTES` (10 MB por padrão).
