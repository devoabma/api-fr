## 1. Caso de uso de edição (concluída)

- [x] 1.1 Criar `update.ts` com rota `PUT /employees/update/:id` protegida por `auth`
- [x] 1.2 `checkIfEmployeeIsAdmin()` como primeira etapa do handler
- [x] 1.3 Validar `:id` (cuid2) e body opcional (`name`, `email`, `role`) com Zod
- [x] 1.4 `404` quando o funcionário não existe
- [x] 1.5 `400` quando o e-mail informado já pertence a outro funcionário
- [x] 1.6 Gravar apenas os campos informados (spread condicional) e responder `200`
- [x] 1.7 Declarar `security: [{ bearerAuth: [] }]` e schemas de resposta `200`/`400`/`404`

## 2. Registro e verificação

- [x] 2.1 Registrar a rota em `routes/index.ts` sob o prefixo `/employees`
- [x] 2.2 `npx tsc --noEmit` sem erros
- [x] 2.3 `biome check` sem issues nos arquivos alterados
- [ ] 2.4 Validar manualmente os fluxos `200`/`400`/`404`/`401`
