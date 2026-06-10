## Context

A API já tinha dois casos de uso (`create-account`, `authenticate`), mas cada um tratava erros localmente com `reply.status(...).send(...)`, duplicando mensagens e códigos. Além disso, não havia nenhuma rota protegida — o JWT era emitido no login, mas nada o consumia ainda. Esta change introduz a infraestrutura transversal (error handler + middleware de auth) e a usa na primeira rota autenticada (perfil).

## Goals / Non-Goals

**Goals:**
- Centralizar a tradução de erros em um único `setErrorHandler`, eliminando os `reply.status` espalhados.
- Oferecer erros de domínio expressivos (`BadRequestError`, `NotFoundError`, `UnauthorizedError`) que os casos de uso lançam sem conhecer o código HTTP.
- Disponibilizar `getIdCurrentEmployee()` e `checkIfEmployeeIsAdmin()` em qualquer rota que registre o plugin `auth`.
- Entregar `GET /employees/profile` como primeira rota protegida.

**Non-Goals:**
- Autorização por rota declarativa/global (cada rota ainda registra `auth` explicitamente).
- Refresh token, logout e troca de senha.
- Integração real com a API externa (Protheus) — apenas o `AxiosError` já é mapeado, antecipando o consumo.

## Decisions

- **Error handler único em `app.setErrorHandler`**: o handler é registrado antes das rotas em `src/http/app.ts`. Casos de uso lançam erros de domínio; o handler decide o status. Isso remove o acoplamento entre regra de negócio e contrato HTTP.
- **Classes de erro minimalistas**: `BadRequestError`/`NotFoundError` estendem `Error` sem corpo; `UnauthorizedError` tem mensagem padrão ("Não autorizado..."), já que é o erro mais lançado pelo middleware sem contexto específico.
- **Credenciais inválidas viram `401` (era `400`)**: semanticamente, falha de autenticação é `401 Unauthorized`. A mensagem genérica é mantida para não permitir enumeração de usuários. É uma mudança de contrato consciente sobre `employee-authentication`.
- **`auth` como `fastify-plugin` com hook `preHandler`**: encapsulado em `fastifyPlugin` para que os decoradores de `request` vazem para a instância que registra o plugin (sem o wrapper, o encapsulamento do Fastify isolaria os decoradores). O `preHandler` apenas instala as funções; a verificação do JWT só ocorre quando a rota chama `getIdCurrentEmployee()`, permitindo que o handler escolha quando exigir auth.
- **`getIdCurrentEmployee` lazy**: retorna uma função em vez de validar imediatamente, dando flexibilidade para rotas que precisam do id condicionalmente. `checkIfEmployeeIsAdmin` reusa `getIdCurrentEmployee` e consulta apenas `role`.
- **E-mail de boas-vindas fora da transação e não-fatal** (revisão de `employee-account-creation`): a transação anterior fazia rollback do cadastro se o Resend falhasse. Decidiu-se priorizar a persistência do funcionário — o e-mail é secundário e reenviável; a falha apenas loga via `request.log.error`. Isso remove a dependência do banco no provedor de e-mail.
- **`AxiosError` mapeado para `404`**: antecipa o consumo da API externa de advogados; quando a consulta falhar ou o advogado não existir, a resposta é padronizada.

## Risks / Trade-offs

- [Mudança de contrato `400` → `401` no login] → Clientes (desktop/web) precisam tratar `401`. Aceitável pois ambos ainda estão em desenvolvimento.
- [Funcionário pode existir sem e-mail enviado] → Trade-off aceito: o e-mail é reenviável e a conta não deve depender da disponibilidade do Resend. A falha fica registrada no log para reprocessamento futuro.
- [Cada rota precisa registrar `auth` manualmente] → Mais verboso, porém explícito; evita proteger rotas públicas por engano. Um middleware global pode ser avaliado depois.
- [`UnauthorizedError` genérico no `getIdCurrentEmployee`] → Não distingue token ausente de expirado; suficiente para o estágio atual.
