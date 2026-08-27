## Why

`GET /employees/get-all` devolvia o funcionário sem as salas em que ele atua. A tela de colaboradores do painel web precisa desse dado por dois motivos, e o segundo é bloqueante:

1. **Exibição.** A administração lista a equipe para saber quem cobre qual sala. Sem o vínculo, a coluna não existe.
2. **Escrita.** `POST /employees/link-with-rooms` **recusa o lote inteiro com 400** quando qualquer sala do payload já está vinculada (`As salas X já foram vinculadas ao funcionário.`) — não é `skipDuplicates` na porta de entrada. O cliente precisa conhecer o estado atual para enviar apenas o delta; sem isso, o usuário toma erro ao remarcar uma sala que já estava marcada.

A alternativa seria o front inverter `GET /rooms/get-all`, que já traz `employeesRooms` embutido em cada sala. Não serve, por três razões:

- Aquela rota **filtra os vínculos por funcionário ativo** (`where: { employees: { inactive: null } }`, introduzido em `hide-inactive-employees-in-room-listing`). Correto lá — quem saiu da OAB não é equipe da sala no painel de operação — e errado aqui: todo funcionário desativado apareceria sem sala nenhuma, justamente na tela onde se confere o vínculo antes de reativá-lo. Ausência de dado com cara de dado.
- `rooms/get-all` é **escopada por papel** (MEMBER só enxerga salas ativas em que participa) enquanto `employees/get-all` é ADMIN-only. Uma tela ADMIN não deve se apoiar numa fonte cujo conteúdo muda conforme quem pergunta.
- Custaria uma segunda requisição e amarraria a tela de funcionários ao cache de salas, inclusive na invalidação após vincular/desvincular.

## What Changes

- **`employeesRooms` no response de `GET /employees/get-all`**: cada funcionário passa a trazer suas salas em `employeesRooms: [{ rooms: { id, name, uf, inactive } }]`, adicionado ao `select` do Prisma e ao schema Zod de resposta.
- **Formato aninhado pela tabela de junção**, simétrico ao que `rooms/get-all` já devolve na direção oposta (`employeesRooms: [{ employees: {...} }]`). O cliente já sabe desembrulhar essa forma.
- **Vínculos com sala inativa NÃO são filtrados**, deliberadamente — ao contrário do que `rooms/get-all` faz com funcionário inativo. Desativar uma sala não desfaz o vínculo no banco, e omiti-lo faria o cliente propor um vínculo que já existe, caindo no 400 descrito acima. O campo `inactive` acompanha cada sala para a tela decidir como sinalizar.
- **Ordenação alfabética dos vínculos** (`orderBy: { rooms: { name: 'asc' } }`), e não por data do vínculo: a lista é lida como conjunto ("de quais salas ele participa"), então é o nome que o olho procura. Sem `orderBy` explícito o Postgres não garante ordem alguma, e a mesma chamada devolveria as salas embaralhadas entre requisições.
- Nenhuma mudança de permissão (segue ADMIN-only), de quais funcionários entram na lista, nem da ordenação da lista principal (`createdAt` desc).

## Capabilities

### Modified Capabilities
- `employee-listing`: a listagem de funcionários passa a incluir, em cada item, as salas vinculadas com `id`, `name`, `uf` e `inactive`.

## Impact

- Código: altera apenas `src/http/core/employees/get-all.ts`.
- Banco: nenhuma migração; a tabela `employees_rooms` e a relação `Employees.employeesRooms` já existem.
- Contrato HTTP: campo **adicionado**, sem breaking change. O único consumidor da rota hoje é o painel web (`web-fr`), e nem o desktop nem outra rota da própria API a chamam.
- Consulta: o Prisma resolve a relação com um `IN` adicional sobre `employees_rooms` (não é N+1). A rota é ADMIN-only e a equipe é de dezenas de registros — sem impacto prático de custo.
- Comportamento: nada muda para quem já consumia a rota; quem ignora campos desconhecidos segue funcionando.
- Escopo: `link-with-rooms` e `unlink-with-rooms` não mudam — inclusive a recusa com 400 em vínculo repetido continua exatamente como está, que é o comportamento que motivou expor o estado atual.
