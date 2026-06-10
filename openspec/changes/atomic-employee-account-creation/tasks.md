## 1. Implementação (concluída)

- [x] 1.1 Envolver o `create` do funcionário e o `resend.emails.send` em `prisma.$transaction`, usando o cliente transacional `tx`
- [x] 1.2 Tratar o retorno do Resend: dar `throw` quando `error` for retornado para abortar a transação
- [x] 1.3 Capturar a falha com `try/catch` e responder `400` com mensagem de que o funcionário não foi cadastrado
- [x] 1.4 Manter a resposta `201` apenas quando criação e envio forem bem-sucedidos

## 2. Verificação

- [ ] 2.1 Testar cenário feliz: cadastro válido persiste o funcionário e responde `201`
- [ ] 2.2 Testar falha de e-mail (simular erro do Resend): confirmar rollback (nenhum registro no banco) e resposta `400`
- [ ] 2.3 Confirmar que CPF/e-mail duplicados continuam retornando `400` sem disparar e-mail

## 3. Melhorias futuras (opcional)

- [ ] 3.1 Logar a causa raiz no `catch` com `request.log.error` para facilitar diagnóstico
- [ ] 3.2 Avaliar mover o envio de e-mail para fila assíncrona caso a rota ganhe volume
