## Context

O fluxo de acesso do funcionário já cobre a criação de conta (`employee-account-creation`). Falta a etapa de login: trocar credenciais por uma sessão autenticada. A API é consumida por dois clientes — app desktop e front web — que têm formas distintas de armazenar o token. A stack já registra `@fastify/jwt` e `@fastify/cookie` em `src/http/app.ts`, e a senha é armazenada como hash bcrypt (`passwordHash`) desde o cadastro.

## Goals / Non-Goals

**Goals:**
- Autenticar funcionário por CPF + senha e emitir um JWT de curta duração (1 dia).
- Atender desktop (token no corpo) e web (cookie httpOnly) com uma única resposta.
- Não vazar informação sobre a existência do CPF (mensagem de erro genérica).
- Impedir login de funcionário inativo.

**Non-Goals:**
- Refresh token / rotação de sessão (a tabela `Tokens` existe, mas não é usada aqui).
- Recuperação de senha e logout.
- Middleware de autorização por rota (`onRequest`/verificação de role) — fica para uma capability posterior.

## Decisions

- **Token no corpo E em cookie httpOnly**: o desktop não compartilha o cookie jar do browser, então recebe o token no corpo; o web usa o cookie httpOnly para mitigar XSS. Alternativa descartada: apenas cookie — inviabilizaria o desktop; apenas corpo — perderia a proteção httpOnly no web.
- **Mensagem de erro genérica para CPF inexistente e senha incorreta**: evita enumeração de usuários. Os dois casos retornam o mesmo `400 "Credenciais inválidas"`.
- **`inactive` como `DateTime?` tratado por truthiness**: o schema usa data nula/preenchida em vez de boolean; `if (employee.inactive)` cobre o caso de inativo. O bloqueio de inativo é verificado após localizar o funcionário e antes de comparar a senha.
- **Expiração do JWT (1d) alinhada ao `maxAge` do cookie (60*60*24)**: mantém token e cookie expirando juntos, evitando cookie válido com JWT expirado.
- **`select` enxuto na consulta**: busca apenas `id`, `role`, `passwordHash` e `inactive`, o mínimo para autenticar e montar o payload.

## Risks / Trade-offs

- [Segredo do JWT] → Resolvido: lido de `env.JWT_SECRET` (obrigatório no schema de env), não mais fixo em código. Manter o valor fora do versionamento.
- [Ordem das verificações pode permitir distinção de timing entre "CPF inexistente" e "senha errada"] → Aceitável neste estágio; mensagem já é genérica. Mitigação futura: comparar contra um hash dummy quando o funcionário não existir.
- [`sameSite: 'none'` exige `secure: true`] → Já garantido pois ambos só se aplicam em produção; em dev usa `lax` + `secure:false`.
- [Senha trafega em texto na requisição] → Mitigado por HTTPS em produção (`secure`); fora do escopo desta change.
