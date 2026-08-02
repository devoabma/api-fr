import { app } from './app'
import { env } from './env'
import { startAutoCloseSessionsJob } from './jobs/auto-close-sessions'
import { startDeleteWeeklyPrintsJob } from './jobs/delete-weekly-prints.cron'

app
  .listen({
    port: env.API_PORT,
    host: '0.0.0.0',
  })
  .then(() => {
    console.log(`
    🚀 \x1b[32m> Servidor iniciado com sucesso!
    📡 \x1b[33m> Aguardando conexões na porta ${env.API_PORT}.
    🕒 \x1b[33m> Monitorando sessões para encerramento automático...
    🗑️  \x1b[33m> Limpeza de impressões agendada para toda sexta-feira às 23:59:59...
       \x1b[33m
    `)

    startAutoCloseSessionsJob()
    startDeleteWeeklyPrintsJob()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
