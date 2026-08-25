## 1. Estado da sala no modelo

- [x] 1.1 Adicionar `uf String @db.Char(2)` a `Rooms` em `prisma/schema.prisma`, sem `@default`
- [x] 1.2 Escrever a migração `20260825120000_adicionada_uf_na_sala`: `ADD COLUMN ... NOT NULL DEFAULT 'MA'` seguido de `ALTER COLUMN ... DROP DEFAULT`
- [x] 1.3 Aplicar com `prisma migrate deploy` e conferir o backfill das salas existentes

## 2. Validação da sigla

- [x] 2.1 Criar `src/utils/validations/uf.ts` com `UFS` (27 siglas), `Uf` e `ufSchema`
- [x] 2.2 Normalizar entrada (`trim` + maiúsculas) antes do `enum`, para não recusar `"ma"`
- [x] 2.3 Levar a lista de valores ao Swagger via `.describe()`, já que o JSON Schema da entrada enxerga só `string`

## 3. Contratos HTTP

- [x] 3.1 `POST /rooms/create`: `uf: ufSchema.default('MA')` no corpo, gravado no `create`
- [x] 3.2 `PATCH /rooms/update/:id`: `uf: ufSchema.optional()`, aplicado ao `dataToUpdate` só quando enviado
- [x] 3.3 `GET /rooms/get-all`: `uf` no `select` do Prisma e no schema Zod da resposta

## 4. Canal WebSocket

- [x] 4.1 `findComputerLabel` passa a trazer `room.uf` e a devolvê-la junto do rótulo
- [x] 4.2 `uf?: string` na variante `registered` de `ServerMessage`, documentando por que o Desktop persiste o valor
- [x] 4.3 Incluir a UF no log do registro (`SALA GTI/MA (nº 10)`)

## 5. Verificação

- [x] 5.1 `npx tsc --noEmit` sem erros
- [x] 5.2 `npx biome check` sem issues
- [x] 5.3 Provar o schema: corpo sem `uf` vira `MA`, `" es "` vira `ES`, `"XX"` responde `400`
- [x] 5.4 Conferir no banco que `rooms.uf` é `NOT NULL`, sem `column_default`, e que as salas existentes ficaram com `MA`
- [ ] 5.5 Validar com o Desktop: registrar uma estação e conferir a `uf` no `registered`

## 6. Documentação

- [x] 6.1 `docs/DOC.md`: `uf` no contrato do `registered`, com a garantia dos três campos juntos
- [x] 6.2 `docs/DATABASE.md`: campo `uf` na tabela `rooms`
- [x] 6.3 `docs/ROADMAP.md`: itens de sala e do canal atualizados
