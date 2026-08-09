## Why

O app desktop das salas só conversa com a API por HTTP, e só quando o advogado age. Isso deixa três buracos que nenhuma rota REST fecha bem:

- **O Desktop não sabe o que aconteceu longe dele.** Sessão encerrada pelo cron (`auto-close-sessions`), computador colocado em manutenção pelo funcionário, sala inativada — tudo isso acontece fora da máquina e hoje só chega por polling ou não chega.
- **O `closeSession` do cron já tem o `TODO: Lançamento do WebSocket para notificar o Desktop Client`** desde que o job foi escrito. O gancho existe, o canal não.
- **O Desktop reinicia com sessão viva no banco.** Sem canal permanente, ele volta cego e precisa descobrir o próprio estado por conta.

Esta entrega cria **apenas o transporte**: um WebSocket Server dentro da mesma aplicação Fastify, com registro da estação e mapa de conexões em memória. Nenhuma regra de negócio passa por ele ainda. O objetivo é ter um canal funcional e confiável para o dev do Desktop implementar o lado dele em paralelo, antes de qualquer evento real trafegar.

## What Changes

- **Dependência nova**: `@fastify/websocket@^11.3.0` (traz `ws` como dependência transitiva). Mesma aplicação, mesma porta, mesmo processo — nenhum serviço separado.
- **`src/http/websocket/` (novo módulo)**, no mesmo nível de `src/http/jobs/`, porque não é caso de uso REST e não cabe em `src/http/core/<entidade>/<ação>.ts`:

  | Arquivo | Responsabilidade |
  | --- | --- |
  | `protocol.ts` | Mensagens tipadas com Zod, discriminadas por `type`; close codes; `sendMessage`/`sendError` |
  | `connections.ts` | Singleton `computerConnections` — `Map<macCode, ComputerConnection>` |
  | `handler.ts` | Ciclo de vida de uma conexão: registro, mensagem inválida, pong, close, error |
  | `authorization.ts` | Gancho do handshake, hoje sempre autorizado |
  | `index.ts` | `websocketPlugin`, rota, heartbeat, limpeza no shutdown |

- **Endpoint `GET /ws/computers` (upgrade)**: fora do Swagger (`schema: { hide: true }`), porque o Scalar não representa upgrade de protocolo.
- **Protocolo inicial**: cliente envia `{ "type": "register", "macCode": "..." }`; servidor responde `{ "type": "registered", macCode, connectedAt }` ou `{ "type": "error", code, message }`. Os eventos futuros (`computer_released`, `session_started`, `session_finished`, `heartbeat`) entram como novos membros da união discriminada, sem quebrar o que existe.
- **`macCode` normalizado por `formattedCodeMac`** — o mesmo helper usado em `create-computer` e `release-computer`. A chave do mapa fica idêntica ao valor gravado em `computers.macCode`.
- **Close codes na faixa privada** (4000–4999), para o Desktop decidir se e quando reconectar: `4408` timeout de registro, `4409` substituído por nova conexão, `4401` reservado para autenticação, `4503` shutdown da API.
- **Heartbeat de ping/pong a cada 30s**, com descarte de quem não responde.
- **`maxPayload` de 4KB** no servidor `ws`.
- **Nenhuma migração, nenhuma tabela.** Conexão é estado volátil; persistir criaria uma tabela que mente sobre quem está online.

## Capabilities

### Added Capabilities
- `websocket-gateway`: a API passa a manter um canal permanente com os Desktops das salas, identificando cada estação por `macCode` e mantendo o registro das conexões ativas em memória.

## Impact

- Novos: `src/http/websocket/{index,protocol,connections,handler,authorization}.ts`.
- Alterados: `src/http/app.ts` (registro do `websocketPlugin` antes de `appRoutes`), `src/http/server.ts` (linha de boot informando o endpoint), `package.json`.
- Contrato HTTP: nenhuma rota REST nova nem alterada.
- Banco: nenhuma migração.
- Configuração: nenhuma variável de ambiente nova.

## Behavior Change

Nada muda para os clientes atuais. A API passa a aceitar upgrade para WebSocket em `/ws/computers`, caminho que antes respondia `404`.

O upgrade passa pelo teto global de rate limit (300 req/min por IP), como qualquer requisição HTTP. Não foi dado teto próprio ao handshake: uma sala inteira reiniciando ao mesmo tempo sai pelo mesmo IP, e um teto apertado transformaria queda de energia em sala fora do ar.

## Known Limitations

1. **O `macCode` é afirmação do cliente, não identidade verificada.** Qualquer processo que alcance a porta se declara `AA-BB-CC-DD-EE-01` e recebe os eventos daquele computador. Enquanto a credencial de estação não existir, **nenhum dado sensível pode trafegar pelo canal** — o que esta entrega respeita, já que ela não transporta nada além do próprio registro.

2. **CORS não protege este canal.** WebSocket não é barrado pela same-origin policy do navegador: o `origin: '*'` do `@fastify/cors` não tem efeito aqui, e uma página aberta em qualquer aba consegue abrir a conexão. A defesa é a credencial de estação somada à recusa de `Origin` de navegador — o Desktop nunca envia esse header. Registrado como TODO em `authorization.ts`.

3. **O mapa é por processo.** Com mais de uma réplica da API, cada instância enxergaria só os Desktops conectados nela, e um evento publicado na réplica A não alcançaria a estação conectada na réplica B. Irrelevante hoje (instância única no Coolify), mas é o que decide se o próximo passo precisa de Redis pub/sub.

4. **Reiniciar a API desconecta todos os Desktops.** É o comportamento esperado (fechamos com `4503` para o cliente reconectar com backoff), mas significa que todo deploy provoca uma janela de reconexão simultânea de todas as salas.
