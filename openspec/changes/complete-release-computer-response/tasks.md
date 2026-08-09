## 1. Contrato da API

- [x] 1.1 Declarar `lawyerName`, `remainingTime` e `expiresAt` no response `200` de `release-computer`
- [x] 1.2 `expiresAt` como `z.iso.datetime().nullable()` — ISO 8601 UTC, nulo quando não abre sessão
- [x] 1.3 Preencher o caminho de liberação concedida com o saldo e `startedAt + remainingMinutes`
- [x] 1.4 Preencher o caminho de sessão estourada com `remainingTime: 0` e `expiresAt: null`
- [x] 1.5 Conferir que a conta de `expiresAt` bate com a do job `auto-close-sessions` (`startedAt + (lawyer.remainingTime ?? room.standardTime)`)

## 2. Cliente desktop (`app-fr`)

- [x] 2.1 Adicionar `ExpiresAt` (`DateTimeOffset?`) ao DTO `LiberacaoResponse`
- [x] 2.2 Propagar até `ResultadoDeLiberacao.ExpiraEm`, com parâmetro opcional em `Autorizar` para não quebrar chamadores
- [x] 2.3 Atualizar o stub do teste de liberação para o contrato real, incluindo `expiresAt`
- [x] 2.4 Asserção de que o sufixo `Z` sobrevive à desserialização (`DateTimeOffset` com offset zero)
- [x] 2.5 Stub do cenário de cota zerada com `expiresAt: null`

## 3. Verificação

- [x] 3.1 `npx tsc --noEmit` sem erros
- [x] 3.2 `npx biome check src/` sem issues
- [x] 3.3 `npx tsup` build de produção sem erros
- [x] 3.4 `dotnet build` da solução sem warnings nem erros
- [x] 3.5 `dotnet test` — 32 testes passando
- [x] 3.6 Confirmar que `z.iso.datetime()` aceita a saída de `dayjs().toISOString()` e o valor nulo
- [x] 3.7 Confirmar no diff que nenhuma validação, status code ou escrita no banco foi alterada
- [ ] 3.8 Liberar um computador pelo app desktop real e confirmar que o quiosque abre com nome e cronômetro
- [ ] 3.9 Conferir no `curl` que `expiresAt` chega com sufixo `Z` e bate com o horário de encerramento observado

## 4. Dívida registrada

- [ ] 4.1 Avaliar geração dos DTOs do cliente a partir do OpenAPI publicado em `/docs`, para eliminar a divergência de contrato na origem
- [ ] 4.2 Trocar a contagem local do `SessaoViewModel` (`DateTime.Now + cota`) pelo `ExpiraEm` absoluto
- [ ] 4.3 Avaliar suíte de testes HTTP na API — hoje nenhum teste automatizado cobre o response das rotas
