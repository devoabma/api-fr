## Contexto

A change `employee-profile-and-error-foundation` entregou o plugin `auth` (`src/http/middleware/auth.ts`) encapsulado com `fastify-plugin`, que decora `request` com `getIdCurrentEmployee()` e `checkIfEmployeeIsAdmin()`. O cadastro de funcionário já invocava `checkIfEmployeeIsAdmin()` no início do handler, mas a rota não registrava o plugin — uma inconsistência que precisava ser corrigida para a proteção valer de fato.

## Decisão

Registrar o plugin `auth` por rota, encadeando `.register(auth)` na construção da instância tipada:

```ts
app
  .withTypeProvider<ZodTypeProvider>()
  .register(auth)
  .post('/create-account', { schema: { ... } }, async (request, reply) => {
    await request.checkIfEmployeeIsAdmin()
    // ...
  })
```

Por que registrar por rota (e não global):

- Mantém o padrão já adotado em `get-profile.ts`, que também registra `auth` localmente.
- Deixa explícito, na própria definição da rota, que ela é protegida — facilita a leitura caso a caso.
- Evita acoplar todas as rotas a autenticação enquanto a API ainda terá endpoints públicos (ex.: `authenticate`).

A avaliação de um middleware de autorização global continua registrada como melhoria futura em `employee-profile-and-error-foundation/tasks.md` (item 6.1).

## Ordem de execução

1. `preHandler` do plugin `auth` decora `request` com os métodos de autenticação/autorização.
2. Handler chama `checkIfEmployeeIsAdmin()` → valida JWT (`getIdCurrentEmployee`) e busca o `role` do funcionário.
3. Se não-admin/sem token: `UnauthorizedError` (`401`), tratado pelo error handler global — nenhuma validação de CPF/e-mail nem persistência ocorre.
4. Se ADMIN: segue o fluxo de criação já existente.
