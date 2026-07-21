import { dayjs } from '@/lib/dayjs'
import { prisma } from '@/lib/prisma'

interface DailyQuota {
  /** Cota do dia em minutos, definida pela sala da PRIMEIRA sessão do dia. */
  dailyLimitMinutes: number
  /** Minutos já consumidos hoje somando todas as sessões finalizadas, em qualquer sala. */
  usedMinutes: number
  /** Saldo restante do dia (nunca negativo). */
  remainingMinutes: number
}

/**
 * Calcula a cota diária GLOBAL de um advogado(a).
 *
 * Regra de negócio compartilhada entre a liberação e o encerramento de computador:
 * a cota é definida pela sala onde ele abriu a PRIMEIRA sessão do dia e é consumida
 * globalmente — trocar de sala não gera cota nova. Considera apenas sessões já
 * finalizadas (endedAt != null); o tempo de uma eventual sessão em curso deve ser
 * somado pelo chamador.
 *
 * @param lawyerId Advogado(a) alvo do cálculo.
 * @param fallbackStandardTime Cota usada quando ainda não há sessão finalizada hoje
 *   (normalmente o `standardTime` da sala que está sendo liberada/encerrada).
 */
export async function getDailyQuota(lawyerId: string, fallbackStandardTime: number): Promise<DailyQuota> {
  const now = dayjs().tz()
  const todayStart = now.startOf('day')
  const todayEnd = now.endOf('day')

  const finishedSessionsToday = await prisma.computerSessions.findMany({
    where: {
      lawyerId,
      endedAt: { not: null },
      startedAt: {
        gte: todayStart.toDate(),
        lte: todayEnd.toDate(),
      },
    },
    select: {
      startedAt: true,
      endedAt: true,
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
    orderBy: {
      startedAt: 'asc',
    },
  })

  const usedMinutes = finishedSessionsToday.reduce(
    (total, item) => total + dayjs(item.endedAt).diff(dayjs(item.startedAt), 'minute'),
    0
  )

  const dailyLimitMinutes = finishedSessionsToday.at(0)?.computer.room.standardTime ?? fallbackStandardTime

  const remainingMinutes = Math.max(dailyLimitMinutes - usedMinutes, 0)

  return { dailyLimitMinutes, usedMinutes, remainingMinutes }
}
