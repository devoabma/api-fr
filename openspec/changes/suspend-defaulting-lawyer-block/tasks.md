## 1. Configuração

- [x] 1.1 Criar `allowDefaultingLawyersSchema` em `src/http/env.ts`, com default `'false'` e transform que só aceita a string `true` (após `trim`/`toLowerCase`)
- [x] 1.2 Adicionar `ALLOW_DEFAULTING_LAWYERS` ao `envSchema`
- [x] 1.3 Documentar a semântica dos dois valores em JSDoc, no padrão já usado por `trustProxySchema`
- [x] 1.4 Registrar a variável em `.env.example` com o valor padrão `"false"`

## 2. Regra de negócio

- [x] 2.1 Importar `env` em `src/http/core/lawyers/release-computer.ts`
- [x] 2.2 Condicionar o bloqueio: `if (!env.ALLOW_DEFAULTING_LAWYERS && !consultedLawyer.adimplente)`
- [x] 2.3 Manter a checagem de `SITUACOES_LIBERADAS` **acima** e fora da flag — a exceção vale só para pendência financeira
- [x] 2.4 Comentar no código o vínculo com a variável de ambiente, para que a leitura da rota não dependa de conhecer o `env`

## 3. Visibilidade operacional

- [x] 3.1 Emitir aviso destacado no boot (`src/http/server.ts`) quando a flag estiver ligada, junto do banner de inicialização

## 4. Verificação

- [x] 4.1 `npx tsc --noEmit` sem erros
- [x] 4.2 `npx biome check` sem issues nos três arquivos alterados
- [x] 4.3 Confirmar o parse pelo módulo `env` real: variável ausente → `false`; `"true"` → `true`; `"1"` → `false`
- [x] 4.4 Confirmar que o valor chega tipado como `boolean` (e não string) no consumo da rota
- [ ] 4.5 Confirmar em produção, no primeiro uso real da exceção, que o aviso vermelho aparece nos logs do container após o restart

## 5. Documentação

- [x] 5.1 Registrar a ressalva na regra de negócio em `docs/DOC.md` ("salvo quando a OAB determinar liberação geral")
- [x] 5.2 Atualizar `docs/ROADMAP.md` no item "Só liberar se estiver adimplente", apontando a flag
- [x] 5.3 Documentar a decisão (env vs. tabela de configuração) e o padrão seguro do parse em `design.md`
