# Design

## 1. Detectar a janela perdida pela própria fila, sem tabela de controle

A limitação assumida em `weekly-print-cleanup` era explícita: "se o processo estiver fora do ar às 23:59:59 de sexta, a limpeza só ocorre na sexta seguinte". Aceitável para o dado, mas o problema real é ninguém **saber** que isso aconteceu.

O caminho óbvio seria registrar cada execução numa tabela `job_runs` e comparar no boot. Foi descartado nesta entrega: exige migração para uma informação que o banco **já responde**. Se existe impressão com `created_at` anterior à última sexta 23:59:59 que já passou, então a limpeza daquela janela não aconteceu — ou não terminou. Não há terceiro estado, porque o corte por `cutoff` garante que tudo anterior à janela deveria ter sido apagado nela.

O efeito colateral é que a checagem não distingue "API estava fora" de "o Storage recusou os lotes". O e-mail assume isso no texto: informa o fato (há impressões anteriores à janela X ainda na fila) e aponta a causa mais provável, em vez de afirmar uma que não pode provar.

## 2. `lastScheduledRun()`: a sexta que já passou, não a próxima

`dayjs().day(5)` anda dentro da **semana corrente**, que começa no domingo. Num domingo ou numa segunda, a sexta devolvida ainda está no futuro — usá-la como corte varreria a semana inteira e dispararia alerta falso todo começo de semana.

Daí o ajuste: se o candidato é posterior à referência, subtrai sete dias. Verificado nos casos de borda — sexta antes das 23:59, sexta depois das 23:59, sábado, domingo, segunda e quarta — sempre devolvendo a última janela efetivamente vencida.

## 3. O relatório nunca derruba o job

O envio fica em `try/catch` e trata `{ error }` do Resend apenas com log, seguindo a regra já aplicada em `create-account`: e-mail é efeito colateral, não parte da transação.

Aqui o argumento é ainda mais forte. No caminho `failed`, o job já falhou; deixar o envio estourar por cima trocaria o erro real por um erro de e-mail no log. No caminho `success`, a limpeza já aconteceu e é irreversível — não há o que desfazer em resposta a um e-mail que não saiu.

## 4. E-mail em toda execução, inclusive quando não havia nada a limpar

A tentação é só avisar quando dá problema. Rejeitada: um canal que só fala quando algo quebra é indistinguível de um canal quebrado. Com um e-mail semanal de "concluída", a **ausência** dele na sexta passa a ser sinal — e é exatamente o caso que o alerta de janela perdida cobre no boot seguinte.

O custo é uma mensagem por semana, não por evento.

## 5. `deleteBatch()` devolvendo o erro em vez de `0`

Antes, falha do Storage e "lote vazio de removíveis" retornavam o mesmo `0`. Para o log tanto fazia; para o relatório, não: `failedCount > 0` é o que separa `partial` de `success`, e sem a mensagem o e-mail diria que algo falhou sem dizer o quê.

O retorno virou `{ deleted, error }` e o erro é prefixado com o número do lote. O e-mail mostra no máximo cinco mensagens — o suficiente para diagnosticar (as falhas de Storage tendem a ser a mesma repetida) sem virar despejo de stack trace.

## 6. `failedCount` derivado, não contado

`failedCount` é `totalFound - deletedCount`, não um contador incrementado nos erros. A diferença aparece no caso em que o `deleteMany` do Prisma apaga menos linhas do que o lote pedia — algo já removido por outro caminho, por exemplo. A subtração reflete o que de fato sobrou na fila; um contador de exceções não veria isso.
