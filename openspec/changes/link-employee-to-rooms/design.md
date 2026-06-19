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

### Rejeição de duplicidade na aplicação, não só no banco

Embora `@@unique([employeeId, roomId])` proteja no nível do banco, a checagem prévia em `employeesRooms.findMany` permite devolver `400` com a lista de salas já vinculadas (mensagem clara) em vez de deixar estourar uma violação de constraint genérica.

### Escrita atômica via `$transaction`

Os `create` de cada vínculo rodam dentro de `prisma.$transaction([...])`, garantindo que ou todos os vínculos da requisição são criados, ou nenhum — evitando estado parcial caso uma das inserções falhe.

### Autorização por rota

Segue o padrão das demais rotas de funcionário: `.register(auth)` na cadeia de construção e `checkIfEmployeeIsAdmin()` como primeira linha do handler.
