## Contexto

O modelo `EmployeesRooms` é a tabela de junção entre `Employees` e `Rooms`, com `@@unique([employeeId, roomId])` para impedir duplicidade no banco. Faltava o caso de uso administrativo para criar esses vínculos. O endpoint recebe um `employeeId` e uma lista de `roomIds` e cria os registros correspondentes, validando antes os pré-requisitos de integridade e de negócio.

## Decisões

### Validações de leitura fora de transação

As consultas de validação (`findUnique` do funcionário, `findMany` das salas, `findMany` dos vínculos existentes) são leituras sem dependência de consistência entre si — a verificação do funcionário e das salas roda em paralelo via `Promise.all`. Transação só envolve a escrita.

### Ordem das guardas

1. `checkIfEmployeeIsAdmin()` → `401` se não-admin/sem token.
2. Funcionário inexistente → `404`.
3. Uma ou mais salas não encontradas (`rooms.length !== roomIds.length`) → `400`.
4. Alguma sala-alvo inativa → `400`, listando os nomes.
5. Vínculo já existente para alguma sala → `400`, listando os nomes.
6. Cria os vínculos e responde `200`.

### Não vincular a sala inativa

A regra de negócio do roadmap é aplicada filtrando `rooms` por `inactive` preenchido; havendo qualquer sala inativa, a operação é interrompida com `400` antes de qualquer escrita, citando os nomes para feedback claro ao cliente.

### `roomIds` exige ao menos um item e é deduplicado

O schema usa `z.array(z.cuid2()).min(1)` para rejeitar lista vazia — que de outra forma passaria por todas as guardas e responderia sucesso sem criar nada. Antes das validações, os IDs são deduplicados (`[...new Set(roomIds)]`): IDs repetidos (`[A, A]`) quebrariam a checagem `rooms.length !== roomIds.length` com um erro enganoso de "sala não encontrada".

### Rejeição de duplicidade na aplicação, não só no banco

Embora `@@unique([employeeId, roomId])` proteja no nível do banco, a checagem prévia em `employeesRooms.findMany` permite devolver `400` com a lista de salas já vinculadas (mensagem clara) em vez de deixar estourar uma violação de constraint genérica.

### Escrita atômica via `createMany` idempotente

Os vínculos são criados em um único `prisma.employeesRooms.createMany`, que já é atômico (um só INSERT). O `skipDuplicates: true`, combinado ao `@@unique([employeeId, roomId])`, torna a operação idempotente e elimina o TOCTOU teórico entre a checagem de vínculos existentes e a escrita (uma corrida entre requisições não estoura `P2002`).

### Autorização por rota

Segue o padrão das demais rotas de funcionário: `.register(auth)` na cadeia de construção e `checkIfEmployeeIsAdmin()` como primeira linha do handler.
