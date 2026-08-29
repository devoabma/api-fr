## ADDED Requirements

### Requirement: Vivacidade separada de prontidão

A API SHALL expor duas rotas de saúde distintas, porque as duas perguntas têm consumidores diferentes e reações diferentes a um "não":

| Rota | Pergunta | Consumidor | Toca no banco |
| --- | --- | --- | --- |
| `GET /health` | o processo está atendendo? | `HEALTHCHECK` do contêiner | não |
| `GET /ready` | dá para atender de verdade? | selo do painel web | sim |

`GET /health` MUST NOT consultar o banco nem qualquer dependência externa, e MUST responder `200 { status: 'ok' }` sempre que o processo estiver atendendo.

O `HEALTHCHECK` do contêiner MUST apontar para `/health` e MUST NOT ser migrado para `/ready`. Para o orquestrador, "não saudável" significa **reiniciar o contêiner**, e reiniciar a API não conserta banco fora do ar: derruba os WebSockets dos Desktops de todas as salas e, se a queda persistir, produz laço de reinício. Com o banco em scale-to-zero, um cold start bastaria para disparar isso.

Ambas as rotas MUST ser públicas, sem autenticação.

#### Scenario: Processo de pé, banco fora do ar

- **WHEN** o processo está atendendo mas o banco não responde
- **THEN** `GET /health` responde `200`
- **AND** `GET /ready` responde `503`
- **AND** o contêiner permanece marcado como saudável, sem ser reiniciado

#### Scenario: Cold start do banco durante o healthcheck

- **WHEN** o banco está acordando de scale-to-zero
- **THEN** `GET /health` continua respondendo `200`, porque não depende do banco

### Requirement: Sonda de prontidão do banco

`GET /ready` SHALL sondar o banco com uma consulta de leitura trivial (`SELECT 1`) e responder:

- `200 { status: 'ok', database: 'up' }` quando a sonda conclui com sucesso;
- `503 { status: 'error', database: 'down' }` quando a sonda falha **ou** estoura o tempo.

A sonda MUST ter teto de tempo próprio, mais curto que o `connectionTimeoutMillis` do pool de conexões. O tempo do pool é dimensionado para o cold start do banco e protege as rotas de dado; numa sonda ele inverte de sinal, porque a espera seria maior justamente quando o banco está mal — e quem perguntou desistiria antes por timeout do cliente, recebendo erro de rede genérico no lugar do `503` legível. Estourar o tempo MUST ser tratado como resposta, não como erro a propagar.

Nem a sonda nem o temporizador MUST rejeitar: o perdedor da corrida entre os dois MUST resolver, para não deixar uma rejeição não tratada para trás a cada `503`.

O temporizador MUST NOT segurar o processo no encerramento (`unref`).

A sonda MUST NOT escrever no banco e MUST NOT consultar dependências externas (storage, e-mail, API de terceiros): elas caem sozinhas sem impedir a API de atender, e incluí-las tornaria o selo do painel vermelho por motivo que o painel não sabe explicar.

#### Scenario: Banco respondendo

- **WHEN** o banco responde à sonda dentro do teto de tempo
- **THEN** a API responde `200` com `database: 'up'`

#### Scenario: Banco inalcançável

- **WHEN** o endereço do banco não responde
- **THEN** a API responde `503` com `database: 'down'` dentro do teto da sonda
- **AND** não espera o `connectionTimeoutMillis` completo do pool
- **AND** nenhuma rejeição não tratada é produzida

#### Scenario: Credencial inválida

- **WHEN** a sonda falha por erro do banco em vez de tempo esgotado
- **THEN** a API responde `503` com `database: 'down'`, sem vazar a mensagem do erro no corpo

### Requirement: Registro da rota de prontidão depois do rate limit

`GET /ready` SHALL ser registrada dentro do callback `.after()` do plugin de rate limit, e MUST NOT ser declarada em nível de raiz junto de `/health`.

O plugin de rate limit instala o limitador por rota, através de um hook `onRoute`, que só enxerga rotas registradas depois dele. Rotas declaradas em nível de raiz são registradas de forma síncrona, antes de qualquer plugin adiado — logo, **nunca recebem limitador**, independentemente da posição no arquivo. Para `/health` isso é indiferente (já isento e sem custo); para `/ready` seria um buraco, por ser rota pública sem autenticação que faz a API abrir conexão com o banco.

O teto MUST ser declarado em `config.rateLimit` da própria rota. O padrão de `preHandler` usado no handler de rota inexistente MUST NOT ser copiado para cá: ele existe porque o 404 não é rota registrada e escapa do mecanismo de `onRoute`.

#### Scenario: Prontidão consultada em excesso

- **WHEN** um IP consulta `GET /ready` mais de 60 vezes em um minuto
- **THEN** as primeiras 60 respondem normalmente e as seguintes respondem `429`
- **AND** as respostas trazem os headers `x-ratelimit-*`

#### Scenario: Painel consultando o selo

- **WHEN** o painel web consulta `GET /ready` a cada 30 segundos em várias abas
- **THEN** o teto não é atingido em uso legítimo

### Requirement: Prontidão legível pelo navegador

`GET /ready` SHALL responder com os headers de CORS da origem configurada em `WEB_URL`, incluindo o preflight, de modo que o painel web consiga ler o estado — inclusive o `503`.

Um `503` de `/ready` MUST ser interpretado pelo painel como "API no ar, banco fora", diagnóstico distinto de "API fora" (que se manifesta como falha de rede). As duas situações levam a ações diferentes e MUST NOT ser exibidas com a mesma mensagem.

#### Scenario: Painel em outra origem

- **WHEN** o painel servido em `WEB_URL` consulta `GET /ready`
- **THEN** o preflight responde `204` e a resposta traz `access-control-allow-origin` com a origem do painel

### Requirement: Limites declarados da sonda

A sonda de prontidão SHALL afirmar alcançabilidade do banco, e MUST NOT ser lida como afirmação de latência ou de saúde geral.

Um banco que responde `SELECT 1` dentro do teto, mas lento a ponto de inutilizar as rotas de dado, MUST sair como `up`. Introduzir um limiar de latência MUST ser tratado como decisão à parte: um limiar mal escolhido produz alarme falso a cada cold start, o que é pior que não medir.

#### Scenario: Banco alcançável porém lento

- **WHEN** o banco responde à sonda dentro do teto, mas as rotas de dado estão lentas
- **THEN** `GET /ready` responde `200` com `database: 'up'`
