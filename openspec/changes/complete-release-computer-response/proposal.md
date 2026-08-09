## Why

O app desktop foi escrito contra um contrato que a API nunca implementou, e o resultado é que **nenhuma liberação bem-sucedida chega à tela de sessão**.

`POST /lawyers/release-computer` declarava o response `200` como `{ message, sessionId }`. O cliente .NET lê quatro campos:

```csharp
var minutosRestantes = conteudo.RemainingTime ?? 0;   // sempre 0: o campo não existe
if (minutosRestantes <= 0)
    return ResultadoDeLiberacao.Recusar(conteudo.Message);
```

Como `remainingTime` nunca vem, o caminho feliz cai na guarda de cota esgotada. O advogado(a) lê **"Computador liberado com sucesso."** apresentado como recusa, o app não navega para o quiosque — e o servidor já gravou `inUse = true`, `currentLawyerId` e a sessão. A máquina fica ocupada até o `auto-close-sessions` expirá-la, 180 minutos depois.

A divergência passou despercebida porque o teste do cliente stuba a resposta que o servidor **deveria** dar:

```jsonc
{ "message": "ok", "sessionId": "sess-123", "lawyerName": "FULANO DE TAL", "remainingTime": 175 }
```

O stub afirmava o contrato em vez de verificá-lo, então os 32 testes passavam com o sistema quebrado em produção. Nenhum dos dois lados tinha como acusar: o `serializerCompiler` do `fastify-type-provider-zod` serializa **pelo schema**, descartando em silêncio qualquer campo não declarado.

Além de destravar a liberação, esta entrega introduz o campo que faltava para as duas pontas concordarem sobre **quando** a sessão acaba.

## What Changes

O response `200` de `POST /lawyers/release-computer` passa a declarar cinco campos:

| Campo | Tipo | Conteúdo |
| --- | --- | --- |
| `message` | `string` | inalterado |
| `sessionId` | `cuid2` | inalterado |
| `lawyerName` | `string` | nome do advogado(a) conforme gravado no banco |
| `remainingTime` | `int >= 0` | saldo do dia em minutos no instante da liberação |
| `expiresAt` | `ISO 8601 UTC \| null` | instante absoluto em que o servidor encerra a sessão |

Os dois caminhos que respondem `200` foram preenchidos de forma a permanecerem distinguíveis:

- **Liberação concedida**: `remainingTime = remainingMinutes`, `expiresAt = startedAt + remainingMinutes`.
- **Sessão anterior estourada e encerrada pela própria rota**: `remainingTime = 0`, `expiresAt = null`.

`expiresAt` reproduz exatamente a conta que o job `auto-close-sessions` aplica (`startedAt + (lawyer.remainingTime ?? room.standardTime)`), para que cliente e servidor expirem no mesmo instante em vez de em dois relógios diferentes.

No app desktop, o campo é propagado até a camada de Application: `LiberacaoResponse.ExpiresAt` → `ResultadoDeLiberacao.ExpiraEm` (`DateTimeOffset?`). O `SessaoViewModel` ainda **não** consome esse valor — a troca da contagem local pelo instante absoluto é entrega separada.

## Capabilities

### Modified Capabilities
- `lawyer`: o response de sucesso da liberação passa a carregar a identidade do advogado(a), o saldo do dia e o instante absoluto de expiração da sessão. Status codes, validações e efeitos no banco permanecem idênticos.

## Impact

- Alterado: `src/http/core/lawyers/release-computer.ts` (schema de response + dois `reply.send`).
- Contrato HTTP: **aditivo**. Nenhum campo removido ou renomeado; clientes que só liam `message` e `sessionId` seguem funcionando.
- Banco: nenhuma migração. `expiresAt` é calculado, não persistido — a fonte da verdade continua sendo `startedAt` + saldo.
- Cliente desktop (`app-fr`, repositório irmão): `SalaLivreApiClient`, `ResultadoDeLiberacao` e o teste de contrato da liberação.
- `docs/DOC.md`: a tabela de resposta da rota foi atualizada.
- `docs/ROADMAP.md`: nada a marcar — a liberação já constava como entregue, e este é o conserto do que estava dado como pronto.

## Behavior Change

**Sim, e é o ponto da entrega.** A liberação que hoje é recusada pelo cliente passa a abrir o quiosque. Do lado do servidor nada muda: as mesmas requisições produzem os mesmos status codes e as mesmas escritas no banco. O que muda é o corpo do `200` — e, por consequência, o que o app faz com ele.

## Known Limitations

1. **O stub mentiroso continua sendo stub.** O teste do cliente agora afirma o contrato correto, mas continua afirmando um contrato escrito à mão. Se a API mudar de novo, ele segue verde. A defesa real seria gerar os DTOs do cliente a partir do OpenAPI que a API já publica em `/docs`, ou um teste de contrato rodando contra a API de verdade. Fora do escopo desta entrega, mas é a causa-raiz e vai reaparecer.

2. **`expiresAt` é calculado no instante da resposta e não acompanha alterações posteriores.** Se a cota do advogado(a) mudar durante a sessão, ou se a sessão for encerrada antes da hora, o valor entregue na liberação fica velho — o cliente não tem como saber. Resolver isso é justamente o papel da comunicação em tempo real que está sendo desenhada; até lá, `expiresAt` é uma previsão feita na liberação, não um valor vivo.

3. **O `SessaoViewModel` ainda conta o tempo com `DateTime.Now + cota`.** O campo chegou ao cliente mas não está em uso: a contagem segue refém do relógio local, sujeita a hora errada e a suspensão da máquina. A troca é deliberadamente separada para manter esta entrega focada em destravar a liberação.

4. **Nenhum teste automatizado cobre o response da rota no lado da API.** A verificação foi `tsc`, `biome`, `tsup` e a suíte do cliente. O projeto não tem suíte de testes HTTP, então a garantia de que o schema serializa o que se espera veio de checagem manual do parse Zod — não de um teste que roda de novo amanhã.
