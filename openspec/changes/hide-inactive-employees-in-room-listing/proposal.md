## Why

Desligar um funcionário no Sala Livre é **soft delete**: a rota de inativação apenas preenche `employees.inactive`, e o vínculo em `employees_rooms` continua existindo. Como `GET /rooms/get-all` seleciona `employeesRooms` sem nenhum filtro, quem saiu da OAB continua aparecendo como equipe da sala no painel — a lista de "quem atende nesta sala" fica poluída com pessoas que não trabalham mais aqui, e o front não tem como distinguir, porque o response nem devolve o `inactive` do funcionário.

## What Changes

- **Filtro de vínculo por funcionário ativo em `GET /rooms/get-all`**: o `select.employeesRooms` passa a receber `where: { employees: { inactive: null } }`, de modo que apenas funcionários ativos são devolvidos na equipe de cada sala.
- O contrato do response não muda (mesmos campos), apenas o conteúdo do array `employeesRooms` — que agora omite os vínculos de funcionários desligados.
- Vale para os dois papéis: ADMIN (que vê o inventário completo, inclusive salas inativas) e MEMBER (que vê apenas as próprias salas ativas) recebem a mesma equipe filtrada.

## Capabilities

### Modified Capabilities
- `room`: a listagem de salas passa a devolver, em `employeesRooms`, somente os vínculos cujo funcionário está ativo (`employees.inactive = null`).

## Impact

- Código: altera apenas `src/http/core/rooms/get-all.ts`.
- Banco: nenhuma migração; usa `employees.inactive` já existente.
- Contrato HTTP: sem breaking change de schema. Um cliente que exibia a equipe da sala deixa de ver funcionários desligados — comportamento desejado.
- Escopo: as demais consultas que usam `employeesRooms` (`put-into-maintenance`, `take-out-of-maintenance`, `get-all-releases`) são filtros de permissão sobre o funcionário **autenticado** (que por definição está ativo) e não precisam do mesmo ajuste.
