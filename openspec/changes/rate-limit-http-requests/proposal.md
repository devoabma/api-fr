## Why

A API está no ar atrás do Cloudflare Tunnel (`docs/DEPLOY.md`) e expõe rotas públicas, sem autenticação, que fazem trabalho caro ou irreversível:

- `POST /employees/session/auth` — compara senha com bcrypt a cada tentativa. Sem teto, é força bruta de graça, e cada tentativa custa CPU do servidor.
- `POST /employees/password-recovery` — dispara e-mail pelo Resend. Sem teto, vira ferramenta de spam contra a caixa de entrada do funcionário e queima cota do provedor.
- `POST /lawyers/release-computer` — consulta a API do Protheus a cada chamada. Sem teto, um laço aponta a carga de terceiros para um sistema que não é nosso.
- `POST /printers/send-to-print/:macCode` — grava arquivo no bucket do Supabase. Sem teto, é enchimento de storage pago.

Nenhuma dessas rotas tinha qualquer limite: um laço de shell bastava para derrubar a API, estourar a cota do Resend ou lotar o bucket. O objetivo desta entrega é fechar essa porta com um teto por IP e tetos mais apertados nas rotas caras, respondendo `429` com um contrato explícito para o app desktop e o front conseguirem exibir a contagem regressiva.

## What Changes

- **Dependência nova**: `@fastify/rate-limit@^11.2.0`, com store em memória (sem Redis — a API roda em instância única no Coolify).
- **`src/http/rate-limit.ts` (novo)**: concentra a política de limites. Exporta `globalRateLimit` (opções do plugin) e `rateLimits` (config por rota), para que nenhuma rota espalhe números mágicos.
- **Teto global**: 300 requisições/minuto por IP, no hook `onRequest` (barra antes de ler e parsear o corpo). `/health` e `/docs` ficam de fora via `allowList` — healthcheck do Docker e documentação não devem competir por balde.
- **`skipOnError: true`**: se o store falhar, a requisição passa. Um limitador quebrado não pode virar indisponibilidade da API.
- **Tetos por rota** (substituem o global naquela rota — ver *Known Limitations*):

  | Rota | Teto | Janela | Chave |
  | --- | --- | --- | --- |
  | `POST /employees/session/auth` | 5 | 10 min | IP + CPF (`preValidation`) |
  | `POST /employees/password-recovery` | 5 | 15 min | IP (`continueExceeding`) |
  | `POST /employees/reset-password` | 10 | 10 min | IP |
  | `POST /lawyers/release-computer` | 10 | 1 min | IP + macCode (`preValidation`) |
  | `POST /lawyers/close-computer/:sessionId` | 30 | 1 min | IP |
  | `POST /printers/send-to-print/:macCode` | 15 | 5 min | IP + macCode |
  | rota inexistente (404) | 60 | 1 min | IP |

- **Rota inexistente ganha limite próprio**: o hook do plugin é instalado por rota registrada, então uma URL que não casa com nenhuma rota **não passava por limitador nenhum**. O `setNotFoundHandler` passou a receber um `preHandler` com teto de 60/min — sem isso, varredura de diretório era ilimitada.
- **`TooManyRequestsError` (novo) + tratamento no `errorHandler`**: o plugin faz `throw errorResponseBuilder(...)`, ou seja, o retorno do builder cai no error handler global. Sem uma classe conhecida, o `429` seria classificado como erro desconhecido e sairia como `500`.
- **`tooManyRequestsSchema` (novo)**: corpo `{ message, retryAfterInSeconds }`, declarado no `429` das rotas limitadas, para o cliente ler o tempo de espera sem depender de header.
- **`TRUST_PROXY` (nova variável de ambiente)**: define se o Fastify pode confiar no `x-forwarded-for` para descobrir o IP real. É o que faz o limite contar por cliente e não por proxy. Padrão `false`; em produção precisa ser `loopback,uniquelocal`.
- **`generateRecoveryCode` passa a usar `crypto.randomInt`** no lugar de `Math.random()`. Com limite de tentativas na recuperação de senha, o custo de adivinhar o código passa a ser o gargalo — e `Math.random()` não é imprevisível o bastante para sustentar isso.

## Capabilities

### Added Capabilities
- `rate-limiting`: a API passa a impor teto de requisições por IP e tetos específicos nas rotas públicas caras, respondendo `429` com tempo de espera.

### Modified Capabilities
- `http-error-handling`: o error handler global passa a traduzir `TooManyRequestsError` em `429` com `{ message, retryAfterInSeconds }`.
- `runtime-configuration`: nova variável `TRUST_PROXY`, que governa a descoberta do IP real do cliente.
- `employee-password-recovery`: o código de recuperação passa a ser gerado por fonte criptograficamente segura.

## Impact

- Novos: `src/http/rate-limit.ts`, `src/http/_errors/too-many-requests.ts`.
- Alterados: `src/http/app.ts` (opção `trustProxy`, registro do plugin, `setNotFoundHandler` com limitador), `src/http/env.ts` (`TRUST_PROXY`), `src/http/_errors/index.ts`, `src/http/_errors/schemas/error-responses.ts`, `src/utils/index.ts` (`randomInt`), e as 6 rotas limitadas (só `config.rateLimit` e o `429` no schema — nenhuma regra de negócio mudou).
- Contrato HTTP: nenhuma rota nova. As rotas limitadas ganham `429` como resposta possível, com headers `retry-after`, `x-ratelimit-limit`, `x-ratelimit-remaining` e `x-ratelimit-reset`.
- Banco: nenhuma migração.
- Configuração: `.env.example` e `docs/DEPLOY.md` documentam `TRUST_PROXY`, incluindo a tabela de valores e o sintoma de configuração errada.

## Behavior Change

Clientes que hoje disparam rajadas passam a receber `429`. O caso realista é o app desktop em tela de erro com retentativa em laço: acima de 300 req/min ele passa a ser barrado. É o comportamento desejado, mas o cliente precisa tratar `429` lendo `retryAfterInSeconds` em vez de retentar imediatamente.

Em desenvolvimento, com `TRUST_PROXY=false` e tudo saindo de `127.0.0.1`, front, Insomnia e app desktop dividem o mesmo balde. Reiniciar a API zera os contadores (store em memória).

## Known Limitations

1. **Rota com config própria não acumula o teto global.** O plugin instala **um** hook por rota: se `config.rateLimit` existe, os parâmetros da rota **substituem** os globais em vez de somar. Consequência prática: a partir de um único IP, alternar o CPF em `/employees/session/auth` ou o macCode em `/printers/send-to-print/:macCode` gera um balde novo a cada valor, sem esbarrar nos 300/min. O ataque continua caro (cada balde é pequeno) e a origem está atrás da Cloudflare, mas o teto global **não** é a rede de segurança que o nome sugere. Fechar isso exige um segundo limitador em camada, via `app.createRateLimit()` num hook `onRequest` próprio — não adotado agora para não duplicar entradas no store nem embaralhar os headers `x-ratelimit-*`.

2. **Limitador em `preValidation` não vê requisição malformada.** `/employees/session/auth` e `/lawyers/release-computer` limitam em `preValidation` porque precisam ler o corpo para compor a chave. Uma requisição com JSON inválido falha no parser antes disso e não conta no balde. O dano é baixo (nenhum bcrypt, nenhuma consulta externa), mas rajada de lixo nessas rotas não é contabilizada.

3. **`continueExceeding` na recuperação de senha pode virar bloqueio prolongado.** `/employees/password-recovery` é limitada por IP com `continueExceeding: true`: cada tentativa barrada reinicia a janela de 15 min. Como os funcionários da seccional saem por um único IP público, uma pessoa insistindo no botão mantém a recuperação bloqueada para todo o escritório enquanto continuar tentando. Alternativas — chavear por IP + CPF (`preValidation`) ou remover o `continueExceeding` — ficam registradas para decisão; a política atual foi mantida por ser a mais conservadora contra spam de e-mail.

4. **Store em memória não é compartilhado.** Com mais de uma réplica da API, cada instância teria o próprio contador e o teto efetivo seria multiplicado pelo número de réplicas. `@fastify/rate-limit` aceita Redis para esse cenário — desnecessário hoje, já que o deploy no Coolify usa instância única.
