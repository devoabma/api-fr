## 1. Versão no modelo

- [x] 1.1 Adicionar `appVersion String? @db.VarChar(40)` e `appVersionReportedAt DateTime?` a `Computers`, com o teto alinhado ao `MAX_VERSION_LENGTH` do protocolo
- [x] 1.2 Escrever a migração `20260825170000_versao_do_desktop_na_estacao` — duas colunas nulas, sem backfill
- [x] 1.3 Documentar no schema por que o carimbo **não** é "visto por último" e por que ausência não apaga
- [x] 1.4 Aplicar com `prisma migrate deploy` e conferir que as máquinas existentes ficaram com `NULL` nas duas colunas (conferido no `information_schema`: `varchar(40)` e `timestamp`, ambas nulas; as 3 máquinas cadastradas ficaram sem versão e sem carimbo)

## 2. Saneamento da versão recebida

- [x] 2.1 `registerMessageSchema`: o `transform` passa a devolver `undefined` quando o saneamento não deixa nada (`"###"` virava `""` e seria gravado como versão)
- [x] 2.2 Reescrever o comentário do campo — de "só aparece no log" para "ausência é caso previsto e o servidor preserva o que já sabia"

## 3. Gravação no registro

- [x] 3.1 `recordReportedVersion(macCode, version)` no handler: sai sem tocar em nada quando a versão não vem
- [x] 3.2 `updateMany` em vez de `update`, para MAC fora do cadastro afetar zero linhas em vez de lançar `P2025`
- [x] 3.3 Gravar o valor cru, sem comparar com o anterior — o rollback do cliente faz a versão diminuir legitimamente
- [x] 3.4 Nunca lançar: falha vira `console.error` e o registro segue, mesmo padrão de `findComputerLabel`
- [x] 3.5 Rodar em `Promise.all` com `findComputerLabel`, para não somar latência ao ack que destrava a tela

## 4. Exposição nas listagens

- [x] 4.1 `GET /rooms/get-all`: dois campos no `select` dos computadores e no schema Zod da resposta
- [x] 4.2 `GET /computers/get-all`: idem, com o `describe` explicando o que `null` significa
- [x] 4.3 Confirmar que `GET /computers/online/:roomId?` **não** muda — versão é cadastro, não conexão

## 5. Painel (`web-fr`)

- [x] 5.1 `ComputerProps` ganha `appVersion` e `appVersionReportedAt`, com o aviso de que o carimbo não é "vista por último"
- [x] 5.2 `ComputerVersionView` e `compareVersions` em `computer-view.ts` — comparação por segmento, porque `'1.0.10' < '1.0.7'` em texto
- [x] 5.3 `buildComputerViews` calcula a maior versão da sala e marca quem está abaixo (`isOutdated`)
- [x] 5.4 `ComputerCard`: badge `v1.0.7` no cabeçalho, âmbar quando defasada, `v—` quando nunca informou
- [x] 5.5 Tooltip diz a data de quando **informou** e, na ausência, os dois motivos possíveis sem afirmar erro

## 6. Verificação

- [x] 6.1 `npx tsc --noEmit` sem erros nos dois repositórios
- [x] 6.2 `npx biome check` sem issues nos dois repositórios
- [x] 6.3 `prisma generate` aceita o schema
- [ ] 6.4 Validar com o Desktop: registrar uma estação e conferir `app_version` / `app_version_reported_at` no banco
- [ ] 6.5 Provar as três regras em campo: reconectar sem o campo (valor preservado), reconectar com versão menor (grava a menor), MAC não cadastrado (nenhuma linha afetada, sem erro no log)

## 7. Documentação

- [x] 7.1 `docs/DATABASE.md`: os dois campos em `computers` + as três leituras erradas que o modelo recusa
- [x] 7.2 `docs/DOC.md`: contrato do `register` — a versão passa a ser guardada, com a tabela das quatro regras
- [x] 7.3 `docs/ROADMAP.md`: item novo no canal e as duas listagens atualizadas
