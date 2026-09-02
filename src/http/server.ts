import { app } from './app'
import { env } from './env'
import { startAutoCloseSessionsJob } from './jobs/auto-close-sessions.cron'
import { startDeleteWeeklyPrintsJob } from './jobs/delete-weekly-prints.cron'
import { startMirrorAppVersionJob } from './jobs/mirror-app-version.cron'
import { WEBSOCKET_COMPUTERS_PATH } from './websocket'

app
  .listen({
    port: env.API_PORT,
    host: '0.0.0.0',
  })
  .then(() => {
    console.log(`
    🚀 \x1b[32m> Servidor iniciado com sucesso!
    📡 \x1b[33m> Aguardando conexões na porta ${env.API_PORT}.
    🔌 \x1b[33m> WebSocket dos Desktops ouvindo em ws://<host>:${env.API_PORT}${WEBSOCKET_COMPUTERS_PATH}.
    🕒 \x1b[33m> Monitorando sessões para encerramento automático...
    🗑️  \x1b[33m> Limpeza de impressões agendada para toda sexta-feira às 23:59:59...
    📦 \x1b[33m> Espelhando o manifesto do Desktop de 5 em 5 minutos...
       \x1b[33m
    `)

    // Exceção temporária e de alto impacto: precisa gritar a cada boot para não ficar ligada por esquecimento.
    if (env.ALLOW_DEFAULTING_LAWYERS) {
      console.warn(
        '\x1b[41m\x1b[97m ATENÇÃO \x1b[0m \x1b[33m> ALLOW_DEFAULTING_LAWYERS=true — Advogados(as) INADIMPLENTES estão liberados.\x1b[0m\n'
      )
    }

    startAutoCloseSessionsJob()
    startDeleteWeeklyPrintsJob()
    startMirrorAppVersionJob()
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
