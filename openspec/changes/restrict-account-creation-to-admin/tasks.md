## 1. Proteger a rota de criação (concluída)

- [x] 1.1 Importar o plugin `auth` em `create-account.ts`
- [x] 1.2 Encadear `.register(auth)` após `.withTypeProvider()` e antes do `.post(...)`
- [x] 1.3 Garantir que `await request.checkIfEmployeeIsAdmin()` seja a primeira etapa do handler
- [x] 1.4 Declarar `security: [{ bearerAuth: [] }]` no schema da rota para refletir a proteção na doc OpenAPI

## 2. Verificação

- [x] 2.1 `npx tsc --noEmit` sem erros (decoradores tipados e disponíveis na rota)
- [ ] 2.2 `POST /employees/create-account` sem token retorna `401`
- [ ] 2.3 `POST /employees/create-account` com token de não-admin retorna `401`
- [ ] 2.4 `POST /employees/create-account` com token de ADMIN cria o funcionário e retorna `201`
