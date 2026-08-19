## Why

A política de CORS foi fechada em `restrict-cors-to-web-origin` (origem única + `credentials: true`), mas ficou faltando um detalhe do `@fastify/cors`: quando a opção `methods` não é informada, o plugin responde o preflight com **apenas os métodos safelisted** — `access-control-allow-methods: GET,HEAD,POST`.

O front web é um painel administrativo: editar funcionário é `PUT`, colocar computador em manutenção é `PATCH`, excluir computador é `DELETE`. Nenhum desses métodos estava na lista, então o navegador barrava a chamada **antes de enviá-la**. O sintoma é o pior possível para depurar: o front recebe um erro de rede sem corpo e sem status, e a API não registra nada no log — a requisição real nunca chegou ao servidor. O preflight, por sua vez, respondia `204` normalmente, o que faz o problema parecer não estar no CORS.

## What Changes

- **Lista explícita de métodos no `@fastify/cors`**: `methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']` no registro em `src/http/app.ts`, cobrindo todos os verbos usados pelas rotas da API.
- **Comentário no `app.ts`** explicando o default do plugin e por que a falha é silenciosa (a API responde o preflight, quem bloqueia é o navegador).
- Sem mudança de contrato HTTP, de rota ou de banco: apenas o header `Access-Control-Allow-Methods` do preflight passa a listar os seis métodos.

## Capabilities

### Modified Capabilities
- `http-cors-policy`: o preflight passa a declarar também os métodos que alteram estado (`PUT`, `PATCH`, `DELETE`), além dos safelisted.

## Impact

- Código: altera apenas `src/http/app.ts`.
- Banco: nenhuma migração.
- Contrato HTTP: sem breaking change. O front web deixa de tomar erro de rede em toda rota de escrita.
- Clientes fora do navegador (desktop, Insomnia, `curl`) seguem inalterados — nunca passaram por preflight.
