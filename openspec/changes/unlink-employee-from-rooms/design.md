## Contexto

`EmployeesRooms` é a tabela de junção entre `Employees` e `Rooms`. O caso de uso de criação (`link-with-rooms.ts`) já existe; faltava o inverso — remover vínculos. O endpoint recebe um `employeeId` e uma lista de `roomIds` e apaga os registros correspondentes em `employees_rooms`, validando antes a existência do funcionário e a existência de ao menos um vínculo.

## Decisões

### Verbo `POST` em vez de `DELETE` com body

A rota precisa receber `roomIds` (lista) no corpo. A RFC 9110 define que um body em `DELETE` "não tem semântica definida" e permite que implementações o descartem — proxies/CDNs (Cloudflare, API gateways) podem remover o corpo antes de chegar à API, causando um `400` por body vazio difícil de diagnosticar (o Fastify lê o body de `DELETE` em dev, então o bug só apareceria em produção atrás de um intermediário). Para eliminar essa classe de falha, a operação usa `POST`, que sempre preserva o corpo. Custo: abrir mão da pureza semântica do verbo `DELETE`.

### `deleteMany` medindo o resultado pelo `count`

Em vez de buscar os vínculos existentes (`findMany`) antes de apagar, a rota executa direto `deleteMany` e usa o `count` retornado para decidir o resultado: `count === 0` significa que nenhuma das salas informadas estava vinculada → `404`. Isso elimina uma ida ao banco e mantém a operação idempotente (apagar vínculo inexistente não estoura erro).

### Ordem das guardas

1. `checkIfEmployeeIsAdmin()` → `401` se não-admin/sem token.
2. Funcionário inexistente → `404` (mensagem específica "Funcionário não encontrado.").
3. `deleteMany` → se `count === 0`, nenhum vínculo encontrado → `404` (mensagem específica "Nenhum vínculo encontrado...").
4. Caso contrário, responde `200`.

A verificação do funcionário em separado (mesmo que `deleteMany` já retornasse `count: 0` para funcionário inexistente) permite distinguir "funcionário não existe" de "funcionário existe mas não tinha vínculo nessas salas", dando feedback mais claro ao cliente.

### `roomIds` exige ao menos um item e é deduplicado

O schema usa `z.array(z.cuid2()).min(1)` para rejeitar lista vazia. Antes do `deleteMany`, os IDs são deduplicados (`[...new Set(roomIds)]`), mantendo simetria com `link-with-rooms.ts`.

### Autorização por rota

Segue o padrão das demais rotas de funcionário: `.register(auth)` na cadeia de construção e `checkIfEmployeeIsAdmin()` como primeira linha do handler.
