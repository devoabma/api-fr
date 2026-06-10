## 1. Implementação (concluída)

- [x] 1.1 Criar `src/http/core/employees/authenticate.ts` com a rota `POST /session/auth` tipada (`ZodTypeProvider`)
- [x] 1.2 Validar `body` com Zod: `cpf` via `cpfSchema` e `password` com mínimo de 8 caracteres
- [x] 1.3 Buscar o funcionário por CPF com `select` enxuto (`id`, `role`, `passwordHash`, `inactive`)
- [x] 1.4 Retornar `400` genérico ("Credenciais inválidas") quando o funcionário não existir
- [x] 1.5 Bloquear funcionário inativo com `400` antes de comparar a senha
- [x] 1.6 Comparar a senha com `bcrypt.compare` e retornar `400` genérico em caso de falha
- [x] 1.7 Emitir JWT com `sub` e `role` e expiração de 1 dia via `reply.jwtSign`
- [x] 1.8 Responder `200` com o token no corpo e definir o cookie httpOnly (`TOKEN_COOKIE_NAME`) com flags por ambiente

## 2. Registro da rota

- [x] 2.1 Registrar `authenticate` em `src/http/routes/index.ts` com prefixo `/employees` (endpoint efetivo `POST /employees/session/auth`)
- [x] 2.2 Migrar o segredo do JWT para `env.JWT_SECRET` (`src/http/env.ts` e `src/http/app.ts`)

## 3. Verificação

- [ ] 3.1 Login feliz: funcionário ativo com credenciais corretas recebe `200`, token no corpo e cookie httpOnly
- [ ] 3.2 Senha incorreta e CPF inexistente retornam o mesmo `400` genérico
- [ ] 3.3 Funcionário inativo recebe `400` de inativo sem emissão de token
- [ ] 3.4 Confirmar flags do cookie por ambiente (`secure`/`sameSite` em prod vs dev)

## 4. Melhorias futuras (opcional)

- [ ] 4.1 Criar `.env.example` com `JWT_SECRET=` (o schema de env agora exige essa variável)
- [ ] 4.2 Comparar contra hash dummy quando o funcionário não existir, mitigando ataque de timing
- [ ] 4.3 Avaliar refresh token usando a tabela `Tokens` já modelada
