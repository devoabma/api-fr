## 1. Rota de logout

- [x] 1.1 Criar `src/http/core/employees/logout.ts` com `POST /session/logout` e schema de resposta `200 { message }`
- [x] 1.2 Limpar o cookie repetindo `path`, `domain`, `httpOnly`, `secure` e `sameSite` exatamente como em `authenticate.ts`
- [x] 1.3 Deixar a rota sem exigência de autenticação, para que a sessão expirada também consiga sair
- [x] 1.4 Registrar `logoutEmployee` em `src/http/routes/index.ts` sob o prefixo `/employees`

## 2. Parser de `application/json`

- [x] 2.1 Substituir o parser padrão em `src/http/app.ts` para que corpo vazio vire `{}`
- [x] 2.2 Manter JSON malformado como erro, traduzido em `BadRequestError` com mensagem em pt-BR
- [x] 2.3 Comentar no `app.ts` os dois diagnósticos que o parser antigo mascarava (404 e validação do Zod)

## 3. Rede de segurança para 4xx do framework

- [x] 3.1 Responder com o próprio `statusCode` quando o erro já trouxer um valor entre 400 e 499, antes do `catch`-all de `500`
- [x] 3.2 Traduzir a mensagem por `code` em vez de repassar o texto interno do Fastify, que vem em inglês
- [x] 3.3 Manter um texto genérico em pt-BR para código não mapeado

## 4. Verificação

- [x] 4.1 `npx tsc --noEmit` sem erros
- [x] 4.2 `npx biome check src/` sem issues
- [x] 4.3 Confirmar via `app.inject()` que o logout com `Content-Type: application/json` e sem corpo responde `200` e emite `Set-Cookie` com `Expires` em 1970 e `Max-Age=0`
- [x] 4.4 Confirmar que o logout responde `200` também sem header `Content-Type` e com `application/json; charset=utf-8`
- [x] 4.5 Confirmar que rota inexistente com `Content-Type: application/json` e sem corpo volta a responder `404 { message, route }`
- [x] 4.6 Confirmar que corpo vazio em rota que exige corpo chega ao Zod e devolve a lista de campos faltando
- [x] 4.7 Confirmar que JSON malformado responde `400 Corpo da requisição não é um JSON válido.`
- [x] 4.8 Confirmar que corpo acima do limite responde `413` com mensagem em pt-BR, e não mais `500`
- [x] 4.9 Confirmar que rota autenticada sem cookie continua respondendo `401` com a mensagem de sessão inválida

## 5. Documentação

- [x] 5.1 Marcar o logout em `docs/ROADMAP.md` (seção 1 — Funcionários)
- [x] 5.2 Registrar em `docs/ROADMAP.md` (seção 0 — Infraestrutura) o parser de JSON e o tratamento dos 4xx do framework
- [x] 5.3 Documentar em `docs/DOC.md` o encerramento de sessão como RF e a regra de que só a API apaga o cookie `httpOnly`
