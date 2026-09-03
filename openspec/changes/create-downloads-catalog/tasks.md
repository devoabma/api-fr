## 1. Banco

- [x] 1.1 Reverter o comentário `///` de `AppVersions.version` apagado sem commit no working tree
- [x] 1.2 Adicionar o enum `DownloadKinds` e o modelo `Downloads` ao `schema.prisma`, com os comentários `///` explicando o porquê de cada decisão
- [x] 1.3 Gerar a migration com `--create-only` e comentar o SQL à mão, registrando por que o índice é comum e não `UNIQUE` parcial
- [x] 1.4 Aplicar com `prisma migrate dev` e regenerar o client

## 2. Regra de negócio e validação

- [x] 2.1 Criar `helpers/ensure-single-active.ts` como porta única da regra "um ativo por tipo"
- [x] 2.2 Criar `utils/validations/download-url.ts` com o protocolo fechado em `http`/`https`

## 3. Casos de uso

- [x] 3.1 `create.ts` — `POST /downloads/create`, ADMIN, checando a unicidade **antes** de gravar
- [x] 3.2 `get-all.ts` — `GET /downloads/get-all`, rota única com recorte por papel via `getCurrentEmployee()`
- [x] 3.3 `update.ts` — `PATCH /downloads/update/:id`, ADMIN, com `kind` fora do body e `!== undefined` nos campos limpáveis
- [x] 3.4 `deactivate.ts` — `PATCH /downloads/deactivate/:id`, ADMIN
- [x] 3.5 `activate.ts` — `PATCH /downloads/activate/:id`, ADMIN, revalidando a unicidade

## 4. Registro e correção de contrato

- [x] 4.1 Registrar as cinco rotas em `routes/index.ts` sob o prefixo `/downloads`
- [x] 4.2 Trocar o `400` declarado à mão pelo `badRequestSchema` nas quatro rotas que o declaram — o serializador do Fastify descartava o array `errors` do errorHandler, e o front recebia "erro na validação" sem saber qual campo errou

## 5. Verificação

- [x] 5.1 `npx tsc --noEmit` sem erros (exit 0 conferido, não a saída filtrada)
- [x] 5.2 `npx biome check --write src` sem pendências
- [x] 5.3 Bateria de 20 chamadas reais contra a API: 201/400/401/404 em cada fluxo, unicidade por tipo no create e no activate, recorte por papel no get-all, e as URLs `javascript:` e `file:` recusadas
- [x] 5.4 Conferir que o `400` de validação voltou a trazer `errors` com os campos, e que o `400` de regra de negócio segue só com `message`
- [x] 5.5 Limpar do banco de desenvolvimento os registros criados no teste

## 6. Documentação

- [x] 6.1 `docs/DATABASE.md`: enum `DownloadKinds`, modelo 10 com as quatro decisões escondidas, e as linhas de tabela isolada no mapa de relacionamentos
- [x] 6.2 `docs/ROADMAP.md`: seção 8 com RF e RN, incluindo os dois itens em aberto (auditoria e contador)
