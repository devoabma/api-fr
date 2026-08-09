## MODIFIED Requirements

### Requirement: Classes de erro de domínio

O sistema SHALL expor classes de erro de domínio em `src/http/_errors/` que os casos de uso usam para sinalizar falhas sem conhecer o código HTTP: `BadRequestError`, `NotFoundError`, `UnauthorizedError` e `TooManyRequestsError`. `UnauthorizedError` MUST ter uma mensagem padrão quando nenhuma for informada.

`TooManyRequestsError` MUST carregar `retryAfterInSeconds` — os segundos restantes até a janela do limite reabrir — e MUST ter mensagem padrão quando nenhuma for informada.

`TooManyRequestsError` existe porque `@fastify/rate-limit` **lança** o valor devolvido pelo seu `errorResponseBuilder`, que assim cai no error handler global. Sem uma classe de erro reconhecida, o excesso de requisições seria classificado como erro desconhecido e responderia `500`.

#### Scenario: UnauthorizedError sem mensagem

- **WHEN** `UnauthorizedError` é instanciado sem argumento
- **THEN** sua mensagem assume um texto padrão de "não autorizado"

#### Scenario: TooManyRequestsError sem mensagem

- **WHEN** `TooManyRequestsError` é instanciado apenas com o tempo de espera
- **THEN** sua mensagem assume um texto padrão informando que houve requisições demais
- **AND** `retryAfterInSeconds` preserva o valor informado

## ADDED Requirements

### Requirement: Tradução de excesso de requisições em 429

O error handler global SHALL traduzir `TooManyRequestsError` em resposta `429` com corpo `{ message, retryAfterInSeconds }`.

O tratamento MUST vir antes do `catch`-all de erro interno, para que o excesso de requisições nunca seja reportado como `500`.

Os headers de rate limit gravados antes do lançamento do erro MUST ser preservados na resposta produzida pelo error handler.

#### Scenario: Teto de requisições estourado

- **WHEN** o limitador lança `TooManyRequestsError`
- **THEN** a API responde `429` com a mensagem do erro e o tempo de espera em segundos
- **AND** a resposta mantém os headers `retry-after` e `x-ratelimit-*`
