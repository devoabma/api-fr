## MODIFIED Requirements

### Requirement: Métodos permitidos no preflight

O sistema SHALL responder ao preflight com `Access-Control-Allow-Methods` contendo todos os verbos usados pelas rotas da API: `GET`, `HEAD`, `POST`, `PUT`, `PATCH` e `DELETE`. A lista MUST ser declarada explicitamente na opção `methods` do `@fastify/cors`, porque o default do plugin são apenas os métodos safelisted (`GET,HEAD,POST`) e o painel web depende de `PUT`, `PATCH` e `DELETE`.

A ausência da lista MUST ser tratada como falha silenciosa: o preflight continua respondendo `204` e a API não registra nada, já que quem descarta a requisição real é o navegador, antes de enviá-la.

#### Scenario: Preflight de método que altera estado

- **WHEN** o navegador envia um `OPTIONS` com `Origin` igual a `WEB_URL` e `access-control-request-method: PATCH`
- **THEN** a API responde `204` com `access-control-allow-methods` incluindo `PATCH`
- **AND** o navegador prossegue com a requisição real

#### Scenario: Requisição de escrita do painel

- **WHEN** o front web chama uma rota `PUT`, `PATCH` ou `DELETE` da API
- **THEN** a chamada alcança o servidor e é respondida segundo as regras de autenticação e autorização da rota
- **AND** o front não recebe erro de rede sem corpo

#### Scenario: Cliente sem header Origin

- **WHEN** o app desktop ou o healthcheck chama qualquer rota, em qualquer método
- **THEN** não há preflight e a lista de métodos não interfere na resposta
