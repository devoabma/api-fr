## ADDED Requirements

### Requirement: Teto global de requisições por IP

A API SHALL impor um teto de 300 requisições por minuto por IP de origem, aplicado no hook `onRequest` — antes de o corpo da requisição ser lido e parseado.

A política de limites MUST ficar concentrada em `src/http/rate-limit.ts`; rotas MUST referenciar a política por `config.rateLimit` em vez de declarar números próprios.

O plugin de rate limit MUST ser registrado antes das rotas da aplicação, porque o limitador é instalado por rota registrada depois dele. Registrá-lo depois MUST ser tratado como defeito: a API subiria sem erro e sem limitar nada.

As rotas `/health` e `/docs` (e seus subcaminhos) MUST ser isentas do limite, por serem healthcheck de infraestrutura e documentação. A comparação MUST considerar apenas o caminho, desprezando a query string, de modo que `/health?probe=1` também seja isento.

Uma falha do store de contagem MUST NOT recusar a requisição (`skipOnError`): o limitador é defesa contra abuso, não regra de negócio, e MUST NOT ser capaz de indisponibilizar a API.

#### Scenario: Requisição dentro do teto global

- **WHEN** um IP faz menos de 300 requisições no intervalo de um minuto
- **THEN** as requisições seguem o fluxo normal
- **AND** a resposta traz os headers `x-ratelimit-limit`, `x-ratelimit-remaining` e `x-ratelimit-reset`

#### Scenario: Teto global estourado

- **WHEN** um IP ultrapassa 300 requisições no intervalo de um minuto
- **THEN** a API responde `429` sem executar o handler da rota

#### Scenario: Healthcheck não é limitado

- **WHEN** o Docker consulta `GET /health` repetidamente, com ou sem query string
- **THEN** todas as chamadas respondem `200`, sem consumir o balde do IP

#### Scenario: Falha do store de contagem

- **WHEN** o store de contagem falha ao registrar a requisição
- **THEN** a requisição é atendida normalmente, em vez de recusada

### Requirement: Teto específico nas rotas públicas caras

A API SHALL impor tetos mais restritos nas rotas públicas cujo custo por chamada é alto — comparação de senha, envio de e-mail, consulta à API externa e escrita em storage:

| Rota | Teto | Janela | Chave |
| --- | --- | --- | --- |
| `POST /employees/session/auth` | 5 | 10 minutos | IP + CPF |
| `POST /employees/password-recovery` | 5 | 15 minutos | IP |
| `POST /employees/reset-password` | 10 | 10 minutos | IP |
| `POST /lawyers/release-computer` | 10 | 1 minuto | IP + macCode |
| `POST /lawyers/close-computer/:sessionId` | 30 | 1 minuto | IP |
| `POST /printers/send-to-print/:macCode` | 15 | 5 minutos | IP + macCode |

A chave do limite MUST sempre incluir o IP de origem. Uma chave derivada apenas de identificador enviado pelo cliente sem autenticação (CPF, macCode) MUST NOT ser usada: ela permitiria a um terceiro esgotar o balde da vítima cujo identificador foi informado, negando o serviço a quem está legitimamente na frente do terminal.

O identificador do recurso (CPF, macCode) MUST refinar a chave, nunca substituir o IP — de modo que terminais distintos atrás do mesmo IP público (NAT) mantenham baldes independentes e que uma pessoa errando a senha não bloqueie o escritório inteiro.

Quando a chave depender de campo do corpo da requisição, o limite MUST ser aplicado em `preValidation`, primeiro ponto do ciclo em que `request.body` está disponível. Quando depender apenas de `request.params` ou do IP, MUST permanecer em `onRequest`.

`POST /employees/password-recovery` MUST usar `continueExceeding`, reiniciando a janela a cada tentativa barrada, por ser a rota que dispara e-mail para terceiros.

#### Scenario: Força bruta de senha na mesma conta

- **WHEN** o mesmo IP tenta autenticar o mesmo CPF mais de 5 vezes em 10 minutos
- **THEN** a partir da 6ª tentativa a API responde `429` sem comparar a senha

#### Scenario: Outra conta a partir do mesmo IP

- **WHEN** um IP esgota as tentativas de um CPF e em seguida tenta autenticar um CPF diferente
- **THEN** a nova tentativa é avaliada normalmente, em balde próprio

#### Scenario: Terceiro tenta bloquear um terminal conhecido

- **WHEN** alguém de outro IP dispara chamadas a `POST /printers/send-to-print/:macCode` com o macCode de um terminal em uso, até estourar o teto
- **THEN** quem estoura o teto recebe `429`
- **AND** o terminal legítimo, saindo de outro IP com o mesmo macCode, continua atendido normalmente

#### Scenario: Vários terminais atrás do mesmo IP público

- **WHEN** terminais distintos de uma mesma sala, saindo pelo mesmo IP público, enviam arquivos para impressão
- **THEN** cada terminal consome o próprio balde, porque o macCode difere entre eles

### Requirement: Limite em rota inexistente

A API SHALL aplicar um teto de 60 requisições por minuto por IP às requisições que não casam com nenhuma rota registrada.

O limitador do plugin é instalado por rota registrada e, portanto, MUST NOT ser assumido como suficiente para URLs desconhecidas: o `setNotFoundHandler` MUST declarar limitador próprio, sob pena de varredura de diretório e fuzzing de endpoint ficarem ilimitados.

#### Scenario: Varredura de endpoints inexistentes

- **WHEN** um IP requisita mais de 60 URLs inexistentes no intervalo de um minuto
- **THEN** as primeiras 60 respondem `404` com `{ message, route }` e as seguintes respondem `429`

### Requirement: Descoberta do IP real do cliente

A instância Fastify SHALL ser criada com `trustProxy` alimentado pela configuração de ambiente, para que `request.ip` seja o IP do cliente e não o do proxy reverso à frente da API.

Com a API atrás de proxy e `trustProxy` desligado, todas as requisições MUST ser entendidas como vindas de um único IP — o que transformaria cada teto por IP num teto único compartilhado por todos os clientes. Essa configuração MUST ser tratada como incorreta em produção.

#### Scenario: API atrás de proxy reverso

- **WHEN** a API roda atrás de proxy e `TRUST_PROXY` está configurado para a topologia real
- **THEN** os tetos contam por cliente final, e clientes em redes distintas não compartilham balde

### Requirement: Resposta padrão de excesso de requisições

A API SHALL responder `429` com corpo `{ message, retryAfterInSeconds }` quando qualquer teto for estourado, onde `retryAfterInSeconds` é o tempo restante da janela arredondado para cima.

A resposta MUST acompanhar os headers `retry-after`, `x-ratelimit-limit`, `x-ratelimit-remaining` e `x-ratelimit-reset`. O tempo de espera MUST ser repetido no corpo, de modo que o app desktop e o front consigam exibir a contagem regressiva lendo apenas o JSON tipado.

Toda rota com teto específico MUST declarar `429` no seu schema de resposta.

#### Scenario: Cliente estoura um teto

- **WHEN** um cliente ultrapassa o teto de uma rota
- **THEN** a API responde `429` com `message` explicando que houve requisições demais
- **AND** `retryAfterInSeconds` traz o mesmo valor do header `retry-after`
