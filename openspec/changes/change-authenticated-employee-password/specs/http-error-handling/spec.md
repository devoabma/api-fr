## ADDED Requirements

### Requirement: Schema de resposta 400 reutilizável

O sistema SHALL expor um schema Zod reutilizável (`badRequestSchema`) que descreve o contrato de resposta `400` produzido pelo error handler global. O schema MUST conter `message` (string, obrigatório) e `errors` (array opcional de `{ field, message }`), refletindo as duas formas de `400`: falha de validação Zod (com `errors`) e erro de regra de negócio via `BadRequestError` (apenas `message`). As rotas SHALL referenciar esse schema na resposta `400` em vez de declarar o contrato inline, mantendo o OpenAPI fiel ao retorno real do handler.

#### Scenario: Resposta de validação Zod documentada

- **WHEN** uma rota referencia `badRequestSchema` na resposta `400` e recebe um corpo inválido
- **THEN** o OpenAPI documenta `message` e a lista opcional `errors[]` de `{ field, message }`
- **AND** o corpo retornado pelo handler corresponde ao schema

#### Scenario: Resposta de regra de negócio documentada

- **WHEN** uma rota lança `BadRequestError`
- **THEN** o corpo retornado contém apenas `message`, ainda válido perante `badRequestSchema` (`errors` é opcional)
