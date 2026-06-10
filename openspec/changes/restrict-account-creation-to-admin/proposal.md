## Why

O endpoint `POST /employees/create-account` já chamava `request.checkIfEmployeeIsAdmin()` no handler, mas a rota não registrava o plugin `auth`. Sem `.register(auth)`, os decoradores (`getIdCurrentEmployee`, `checkIfEmployeeIsAdmin`) não existem na instância — o que tornava a chamada um erro de runtime e deixava a criação de funcionário, na prática, desprotegida/indisponível. Esta change conecta a fundação de autorização (`request-authorization`) ao cadastro, cumprindo a regra de negócio "Somente ADMIN cadastra funcionários".

## What Changes

- **`create-account.ts`**: a rota passa a registrar o plugin `auth` (`.register(auth)`) na cadeia de construção, antes do `.post(...)`. Com isso, `request.checkIfEmployeeIsAdmin()` fica disponível e é executada como primeira etapa do handler.
- **Efeito de contrato HTTP**: requisições sem JWT ou com token inválido/expirado passam a responder `401`; funcionários autenticados sem papel `ADMIN` também respondem `401` (acesso negado). Apenas funcionários `ADMIN` autenticados conseguem criar contas.

## Capabilities

### Modified Capabilities
- `employee-account-creation`: a criação de funcionário passa a exigir um funcionário autenticado com papel `ADMIN`, via registro do plugin `auth` na rota e execução de `checkIfEmployeeIsAdmin()` antes de qualquer validação de negócio.

## Impact

- Código alterado: `src/http/core/employees/create-account.ts` (registra `auth`; sem mudança de lógica de validação/persistência).
- Contrato HTTP: clientes do app desktop/front web precisam enviar o JWT de um `ADMIN` ao chamar `POST /employees/create-account`; chamadas anônimas ou de não-admins passam a receber `401`.
- Depende de `request-authorization` (plugin `auth` e augmentação de tipos), já entregue na change `employee-profile-and-error-foundation`.
