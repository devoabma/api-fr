import { app } from './app'
import { env } from './env'
import { startAutoCloseSessionsJob } from './jobs/auto-close-sessions'

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
       \x1b[33m
    `)

    startAutoCloseSessionsJob()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
