import cron from 'node-cron'
import { env } from '@/http/env'
import { notifySessionClosed, SESSION_CLOSED_REASONS } from '@/http/websocket'
import { dayjs } from '@/lib/dayjs'
import { prisma } from '@/lib/prisma'

// 5 campos (minuto hora dia mês dia-da-semana): a cada 1 minuto
const CRON_EXPRESSION = '* * * * *'

const TRANSIENT_DB_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'P1001', 'P1017'])
const TRANSIENT_DB_ERROR_MESSAGE = /timeout exceeded when trying to connect/i

function isTransientDbError(err: unknown): boolean {
  if (!(err instanceof Error)) return false

  if ('code' in err && TRANSIENT_DB_ERROR_CODES.has(String((err as { code: unknown }).code))) {
    return true
  }

  return TRANSIENT_DB_ERROR_MESSAGE.test(err.message)
}

type ExpiredSession = {
  sessionId: string
  computerId: string
  macCode: string
  lawyerId: string
}

async function closeSession({ sessionId, computerId, macCode, lawyerId }: ExpiredSession, now: Date) {
  const { count } = await prisma.computerSessions.updateMany({
    where: { id: sessionId, endedAt: null },
    data: { endedAt: now },
  })

  // Outro caminho (o botão do quiosque, o painel) chegou primeiro. Quem fechou já avisou
  // a estação; repetir o aviso aqui mandaria um encerramento para a sessão seguinte se o
  // advogado tivesse acabado de liberar a máquina de novo.
  if (count === 0) return

  await prisma.$transaction([
    prisma.computers.updateMany({
      where: { id: computerId, currentLawyerId: lawyerId },
      data: { inUse: false, currentLawyerId: null },
    }),
    prisma.lawyers.update({
      where: { id: lawyerId },
      data: { remainingTime: 0, lastAccess: now },
    }),
  ])

  // Sem o aviso, o Desktop só descobriria o fim ao tentar encerrar por conta própria — e
  // uma máquina com o relógio atrasado ficaria com a tela de sessão de pé em cima de uma
  // sessão que não existe mais no servidor.
  notifySessionClosed({
    macCode,
    sessionId,
    reason: SESSION_CLOSED_REASONS.EXPIRED,
    closedAt: now,
    // O job zera a cota do dia junto com o encerramento (ver o `update` acima).
    remainingTime: 0,
  })
}

async function checkExpiredSessions() {
  const now = dayjs().tz()

  const candidateSessions = await prisma.computerSessions.findMany({
    where: { endedAt: null },
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      computerId: true,
      lawyerId: true,
      lawyer: {
        select: {
          remainingTime: true,
          lastAccess: true,
        },
      },
      computer: {
        select: {
          // Endereço da estação no canal `/ws/computers`.
          macCode: true,
          room: {
            select: {
              standardTime: true,
            },
          },
        },
      },
    },
  })

  for (const session of candidateSessions) {
    try {
      const limitMinutes = session.lawyer.remainingTime ?? session.computer.room.standardTime

      const startedAt = dayjs(session.startedAt).tz()
      const diff = now.diff(startedAt, 'minute')

      if (diff < limitMinutes) continue

      await closeSession(
        {
          sessionId: session.id,
          computerId: session.computerId,
          macCode: session.computer.macCode,
          lawyerId: session.lawyerId,
        },
        now.toDate()
      )

      console.log(`[AutoClose ✅] Sessão ${session.id} encerrada automaticamente (tempo: ${diff}min, limite: ${limitMinutes}).`)
    } catch (err) {
      console.error(`[AutoClose ❌] Erro ao encerrar sessão ${session.id}:`, err)
    }
  }
}

export function startAutoCloseSessionsJob() {
  cron.schedule(
    CRON_EXPRESSION,
    async () => {
      try {
        await checkExpiredSessions()
      } catch (err) {
        if (isTransientDbError(err)) {
          console.warn('[AutoClose ⚠️ ] Falha transitória de conexão com o banco, tentando de novo no próximo minuto...')
        } else {
          console.error('[AutoClose ❌] Erro ao verificar sessões expiradas:', err)
        }
      }
    },
    {
      name: 'auto-close-sessions',
      timezone: env.TIMEZONE,
      // Se um tick demorar mais de 1 minuto, o próximo é descartado em vez de rodar em
      // paralelo — mesma garantia do setTimeout encadeado que existia aqui antes.
      noOverlap: true,
    }
  )
}
