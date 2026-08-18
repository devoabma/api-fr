## ADDED Requirements

### Requirement: Corpo vazio em `application/json` não é erro

O sistema SHALL usar parser próprio para `application/json`: corpo vazio MUST ser entregue à rota como `{}`, e a validação do corpo MUST ficar a cargo do schema Zod de cada rota.

A troca existe porque clientes HTTP comuns (axios, fetch) enviam `Content-Type: application/json` mesmo em requisição sem corpo. O parser padrão do Fastify recusa esse caso, e a recusa acontece **antes do roteamento** — mascarando dois diagnósticos:

- **URL inexistente**, que respondia erro de corpo em vez de `404`, apontando a investigação para o lugar errado;
- **campos obrigatórios faltando**, porque o Zod nunca chegava a rodar e o front não recebia a lista de campos.

JSON malformado MUST continuar sendo erro, traduzido em `BadRequestError` com mensagem em pt-BR.

#### Scenario: Requisição sem corpo em rota que não exige corpo

- **WHEN** chega `POST` com `Content-Type: application/json` e corpo vazio
- **THEN** a rota recebe `{}` e responde normalmente

#### Scenario: Requisição sem corpo em rota que exige corpo

- **WHEN** chega `POST` sem corpo numa rota com schema de body
- **THEN** o Zod valida `{}` e a API responde `400` com a lista de campos faltando

#### Scenario: URL inexistente com Content-Type JSON

- **WHEN** chega `POST` para rota não registrada com `Content-Type: application/json` e sem corpo
- **THEN** a API responde `404` com `{ message, route }`

#### Scenario: JSON malformado

- **WHEN** o corpo não é JSON válido
- **THEN** a API responde `400` com mensagem em pt-BR informando que o corpo não é um JSON válido

### Requirement: Erros 4xx do framework não viram 500

O error handler global SHALL responder com o próprio `statusCode` quando o erro capturado já trouxer um valor entre 400 e 499, antes de cair no `catch`-all de erro interno.

Esses erros nascem no Fastify e indicam falha do cliente — corpo acima do limite, mídia não suportada, `Content-Length` inconsistente. Reportá-los como `500` MUST ser evitado por duas razões: diz ao cliente que o problema é do servidor, levando-o a repetir a mesma requisição inválida; e polui o log de erro com o que não é defeito da API.

A mensagem interna do framework MUST NOT ser repassada ao cliente — vem em inglês e descreve a biblioteca, não o domínio. O `code` do erro MUST ser traduzido para pt-BR, com texto genérico para código não mapeado.

Erros de domínio MUST continuar sendo tratados antes, pelas classes de `_errors/`. Nenhum código da aplicação define `statusCode`, de modo que este bloco captura exclusivamente erro de framework.

#### Scenario: Corpo acima do limite

- **WHEN** o corpo da requisição excede o limite do servidor
- **THEN** a API responde `413` com mensagem em pt-BR
- **AND** o erro não é registrado como falha interna

#### Scenario: Código de erro não mapeado

- **WHEN** o Fastify lança um erro 4xx cujo `code` não tem tradução
- **THEN** a API responde com o mesmo status e uma mensagem genérica em pt-BR

#### Scenario: Erro sem statusCode

- **WHEN** o erro capturado não traz `statusCode` — falha de banco, bug de código
- **THEN** a API segue respondendo `500` e registrando o erro no log
