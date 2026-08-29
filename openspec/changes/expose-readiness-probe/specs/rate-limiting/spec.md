## MODIFIED Requirements

### Requirement: Teto global de requisições por IP

A API SHALL impor um teto de 300 requisições por minuto por IP de origem, aplicado no hook `onRequest` — antes de o corpo da requisição ser lido e parseado.

A política de limites MUST ficar concentrada em `src/http/rate-limit.ts`; rotas MUST referenciar a política por `config.rateLimit` em vez de declarar números próprios.

O plugin de rate limit MUST ser registrado antes das rotas da aplicação, porque o limitador é instalado por rota registrada depois dele. Registrá-lo depois MUST ser tratado como defeito: a API subiria sem erro e sem limitar nada.

As rotas `/health` e `/docs` (e seus subcaminhos) MUST ser isentas do limite, por serem healthcheck de infraestrutura e documentação. A comparação MUST considerar apenas o caminho, desprezando a query string, de modo que `/health?probe=1` também seja isento.

A rota de prontidão `/ready` MUST NOT ser incluída entre as isentas, ainda que seja rota de infraestrutura: diferentemente de `/health`, ela é pública, sem autenticação, e faz a API abrir conexão com o banco a cada chamada. Ela MUST declarar teto próprio de 60 requisições por minuto por IP.

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
- **AND** a resposta não traz headers `x-ratelimit-*`, porque o limitador não é instalado em rota de nível de raiz

#### Scenario: Prontidão é limitada

- **WHEN** um IP consulta `GET /ready` acima do teto de 60 por minuto
- **THEN** as chamadas excedentes respondem `429`, sem sondar o banco

#### Scenario: Falha do store de contagem

- **WHEN** o store de contagem falha ao registrar a requisição
- **THEN** a requisição é atendida normalmente, em vez de recusada
