## ADDED Requirements

### Requirement: Identificação do funcionário autenticado

O sistema SHALL disponibilizar, via plugin `auth` registrado na rota, o método `request.getIdCurrentEmployee()` que valida o JWT da requisição (`jwtVerify`) e retorna o `sub` (id do funcionário). Quando o token estiver ausente ou inválido, o método MUST lançar `UnauthorizedError`.

#### Scenario: Token válido

- **WHEN** uma rota protegida chama `getIdCurrentEmployee()` com um JWT válido
- **THEN** o método retorna o `sub` do token (id do funcionário)

#### Scenario: Token ausente ou inválido

- **WHEN** `getIdCurrentEmployee()` é chamado sem token ou com token inválido/expirado
- **THEN** o método lança `UnauthorizedError`, resultando em resposta `401`

### Requirement: Exigência de papel ADMIN

O sistema SHALL disponibilizar `request.checkIfEmployeeIsAdmin()` que, a partir do funcionário autenticado, garante o papel `ADMIN`. Quando o funcionário não existir ou tiver papel diferente de `ADMIN`, o método MUST lançar `UnauthorizedError`.

#### Scenario: Funcionário ADMIN

- **WHEN** `checkIfEmployeeIsAdmin()` é chamado para um funcionário autenticado com `role: 'ADMIN'`
- **THEN** o método conclui sem lançar erro e a rota prossegue

#### Scenario: Funcionário sem permissão

- **WHEN** `checkIfEmployeeIsAdmin()` é chamado para um funcionário inexistente ou com `role` diferente de `ADMIN`
- **THEN** o método lança `UnauthorizedError` com mensagem de acesso negado, resultando em resposta `401`

### Requirement: Disponibilidade dos decoradores na instância

O plugin `auth` SHALL ser encapsulado com `fastify-plugin` para que os decoradores de `request` fiquem disponíveis na instância que o registra. Os métodos `getIdCurrentEmployee` e `checkIfEmployeeIsAdmin` MUST estar declarados em `FastifyRequest` (augmentação de tipos).

#### Scenario: Rota registra o plugin auth

- **WHEN** uma rota faz `.register(auth)` e chama os decoradores no handler
- **THEN** os métodos estão tipados e disponíveis em `request`
