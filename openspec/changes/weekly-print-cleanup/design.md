# Design

## 1. `node-cron` em vez do loop `setTimeout` usado em `auto-close-sessions`

`auto-close-sessions` reagenda a si mesmo a cada 60s porque só precisa de um **intervalo**. Aqui a exigência é um **instante de calendário** (sexta, 23:59:59, horário local), que envolve dia da semana e fuso — reimplementar isso com `setTimeout` significaria calcular o delta até a próxima sexta e lidar com desvio de relógio a cada semana. `node-cron` resolve isso com `timezone` nativo e já estava previsto como dependência.

Consequência: o job não "recupera" disparos perdidos. Se o processo estiver fora do ar às 23:59:59 de sexta, a limpeza só ocorre na sexta seguinte. Aceitável — o efeito é uma semana extra de retenção, não perda de dado.

## 2. Storage antes do banco, nunca o contrário

A ordem é: remover do bucket → apagar as linhas de `printers`. Se o Storage falhar, o lote **não** é apagado do banco.

O inverso criaria arquivo órfão: sem a linha em `printers`, o `file_url` é perdido e ninguém mais sabe que aquele objeto existe no bucket — ele passa a gerar custo permanente e a guardar documento pessoal de advogado(a) sem rastreio. Mantendo a linha, o próximo disparo tenta de novo.

O risco simétrico (arquivo apagado e linha mantida por falha no banco) é preferível e autocorrige: a listagem devolveria um `fileUrl` morto por até uma semana, e o disparo seguinte remove a linha.

## 3. Corte por `cutoff` em vez de "apagar tudo"

O `cutoff` é capturado no início da execução (`dayjs().tz().toDate()`) e usado como `createdAt: { lte: cutoff }`. Sem ele, uma impressão enviada durante a limpeza poderia ser apagada antes de qualquer funcionário vê-la. Com ele, o pior caso é o arquivo sobreviver uma semana a mais.

## 4. `TIMEZONE` em vez de `TZ`

`TZ` é reservada do Node/libc: definí-la muda o fuso do processo inteiro (`new Date()`, logs, drivers). Isso criaria duas fontes de verdade — o fuso do processo e o default do `dayjs` — e uma seccional que esquecesse de definir herdaria o UTC do container silenciosamente.

`TIMEZONE` é lida e validada pelo schema do `env`, é a única fonte do fuso da aplicação e permite manter o servidor em UTC. A validação usa `Intl.DateTimeFormat`, que consulta a base IANA embutida no Node — não há lista de fusos mantida à mão para envelhecer.

Falha no boot é intencional: um fuso digitado errado não produz erro visível, produz sessões encerradas na hora errada e limpeza disparada no dia errado. Melhor a API não subir.

## 5. Lotes de 100

O Storage aceita várias chaves por chamada, mas um `remove()` único com milhares de caminhos significa payload grande e falha tudo-ou-nada. Em lotes, uma falha isolada preserva o progresso dos lotes anteriores.

## 6. URL pública → caminho do bucket

`Printers` guarda apenas `file_url` (a URL pública), sem campo de path — diferente de `Employees.image_public_id`, que guarda o caminho. O caminho é então extraído do marcador `/object/public/prints/`, com `decodeURIComponent` para nomes escapados.

Registro cuja URL não casa com esse padrão (importado ou de outro bucket) tem **apenas a linha** apagada, com aviso no log: sem caminho válido não há o que remover, e mantê-lo faria o job reprocessar o mesmo registro toda semana para sempre.

Alternativa considerada e descartada nesta entrega: adicionar `file_path` ao modelo `Printers`. Exigiria migração e backfill dos registros existentes, para um ganho pequeno — a extração por marcador é determinística enquanto o upload continuar usando `getPublicUrl`.
