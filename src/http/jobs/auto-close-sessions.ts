import { dayjs } from '@/lib/dayjs'
import { prisma } from '@/lib/prisma'

const INTERVAL_MS = 60 * 1000 // 1 minuto

const TRANSIENT_DB_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'P1001', 'P1017'])
const TRANSIENT_DB_ERROR_MESSAGE = /timeout exceeded when trying to connect/i

function isTransientDbError(err: unknown): boolean {
  if (!(err instanceof Error)) return false

  if ('code' in err && TRANSIENT_DB_ERROR_CODES.has(String((err as { code: unknown }).code))) {
    return true
  }

  return TRANSIENT_DB_ERROR_MESSAGE.test(err.message)
}

async function closeSession(sessionId: string, computerId: string, lawyerId: string, now: Date) {
  // Update condicional: só fecha se a sessão ainda estiver ativa. Isso evita que o job
  // "pise" numa sessão que já foi encerrada por /close-computer ou /release-computer
  // entre a leitura (findMany) e a escrita deste tick (janela de até 10s).
  const { count } = await prisma.computerSessions.updateMany({
    where: { id: sessionId, endedAt: null },
    data: { endedAt: now },
  })

  if (count === 0) return

  await prisma.$transaction([
    // Só libera o computador se ele ainda estiver vinculado a ESTE advogado(a): entre a
    // leitura e a escrita, o computador pode já ter sido liberado e reatribuído a outra
    // sessão/advogado(a), e não podemos derrubar essa sessão nova.
    prisma.computers.updateMany({
      where: { id: computerId, currentLawyerId: lawyerId },
      data: { inUse: false, currentLawyerId: null },
    }),
    // Mesma semântica do fechamento forçado por tempo em release-computer.ts: cota do
    // dia zerada e lastAccess marcando o instante do encerramento (nunca null).
    prisma.lawyers.update({
      where: { id: lawyerId },
      data: { remainingTime: 0, lastAccess: now },
    }),
  ])
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

      await closeSession(session.id, session.computerId, session.lawyerId, now.toDate())

      console.log(`[AutoClose ✅] Sessão ${session.id} encerrada automaticamente (tempo: ${diff}min, limite: ${limitMinutes}).`)
    } catch (err) {
      console.error(`[AutoClose ❌] Erro ao encerrar sessão ${session.id}:`, err)
    }
  }
}

export function startAutoCloseSessionsJob() {
  async function run() {
    try {
      await checkExpiredSessions()
    } catch (err) {
      if (isTransientDbError(err)) {
        console.warn(`[AutoClose ⚠️ ] Falha transitória de conexão com o banco, tentando de novo em ${INTERVAL_MS / 1000}s...`)
      } else {
        console.error('[AutoClose ❌] Erro ao verificar sessões expiradas:', err)
      }
    } finally {
      setTimeout(run, INTERVAL_MS) // ← só agenda o próximo DEPOIS de terminar
    }
  }

  run()
}
