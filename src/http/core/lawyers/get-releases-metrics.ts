import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { env } from '@/http/env'
import { auth } from '@/http/middleware/auth'
import { dayjs } from '@/lib/dayjs'
import { prisma } from '@/lib/prisma'
import { Prisma } from '../../../../generated/prisma/client'

/**
 * Uma sessão encerrada mais longa que isto não é atendimento: é registro defeituoso. O
 * `auto-close-sessions.cron` fecha as expiradas a cada minuto, mas se o serviço ficar fora
 * do ar ele as fecha depois com `endedAt = now` — e essa duração inflada fica gravada para
 * sempre. Sem o teto, um único registro desses desloca a média do ano inteiro.
 */
const MAX_PLAUSIBLE_SESSION_HOURS = 24

const MONTHS_IN_YEAR = 12

const getReleasesMetricsSchema = {
  tags: ['lawyers'],
  summary:
    'Agrega as liberações do ano em indicadores, séries por ano/mês, ranking de salas e de advogados. ADMIN vê todas as salas; MEMBER apenas as que participa. Atenção: `byRoom` ignora o `roomId` de propósito — é um ranking ENTRE salas',
  security: [{ bearerAuth: [] }],
  params: z.object({
    roomId: z.cuid2().optional(),
  }),
  querystring: z.object({
    year: z.coerce.number().int().min(2000).max(9999).optional(),
  }),
  response: {
    200: z.object({
      metrics: z.object({
        year: z.number().int(),
        kpis: z.object({
          totalReleases: z.number().int().nonnegative(),
          totalReleasesPreviousYearSamePeriod: z.number().int().nonnegative(),
          monthsWithData: z.number().int().nonnegative(),
          averagePerMonth: z.number().int().nonnegative(),
          averagePerMonthPreviousYearSamePeriod: z.number().int().nonnegative(),
          distinctLawyers: z.number().int().nonnegative(),
          distinctLawyersPreviousYearSamePeriod: z.number().int().nonnegative(),
          averageSessionMinutes: z.number().int().nonnegative(),
          averageSessionMinutesPreviousYearSamePeriod: z.number().int().nonnegative(),
          /** Sala que serve de referência para o limite de tempo: a filtrada, ou a mais movimentada. */
          referenceStandardTime: z
            .object({
              roomName: z.string(),
              minutes: z.number().int().nonnegative(),
            })
            .nullable(),
        }),
        byYear: z.array(
          z.object({
            year: z.number().int(),
            total: z.number().int().nonnegative(),
          })
        ),
        byMonth: z.array(
          z.object({
            month: z.number().int().min(1).max(MONTHS_IN_YEAR),
            /** `null` = mês que ainda não aconteceu. Zero e "ainda não ocorreu" são coisas diferentes. */
            total: z.number().int().nonnegative().nullable(),
          })
        ),
        byRoom: z.array(
          z.object({
            roomId: z.cuid2(),
            name: z.string(),
            total: z.number().int().nonnegative(),
          })
        ),
        byLawyer: z.array(
          z.object({
            lawyerId: z.cuid2(),
            name: z.string(),
            oab: z.string(),
            total: z.number().int().nonnegative(),
          })
        ),
      }),
    }),
  },
} satisfies FastifySchema

type YearRow = { year: number; total: number }
type MonthRow = { month: number; total: number }
type RoomRow = { roomId: string; total: number }
type LawyerRow = { lawyerId: string; name: string; oab: string; total: number }
type SummaryRow = {
  year: number
  totalReleases: number
  distinctLawyers: number
  monthsWithData: number
  averageSessionMinutes: number | string | null
}

type Summary = {
  totalReleases: number
  distinctLawyers: number
  monthsWithData: number
  averageSessionMinutes: number
}

const EMPTY_SUMMARY: Summary = {
  totalReleases: 0,
  distinctLawyers: 0,
  monthsWithData: 0,
  averageSessionMinutes: 0,
}

/**
 * `COUNT(*)::int` já volta como number, mas `AVG` devolve `numeric`, que o driver entrega
 * como string. Normalizar na fronteira evita que um "78.4" de texto escape para o schema
 * de resposta e quebre a serialização.
 */
function toInt(value: number | string | null): number {
  const parsed = Number(value ?? 0)

  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

export async function getReleasesMetrics(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get('/releases-metrics/:roomId?', { schema: getReleasesMetricsSchema }, async (request, reply) => {
      const { id: employeeId, role } = await request.getCurrentEmployee()
      const { roomId } = request.params
      const { year: requestedYear } = request.query

      const now = dayjs().tz()
      const currentYear = now.year()
      const year = requestedYear ?? currentYear

      // ADMIN enxerga todas as salas; MEMBER apenas aquelas em que está vinculado — o mesmo
      // recorte de `get-all-releases`. A autorização é resolvida aqui, em TypeScript, e as
      // queries agregadas recebem só a lista de ids já autorizada: nenhuma regra de papel
      // desce para o SQL.
      const roomWhere: Prisma.RoomsWhereInput = role === 'ADMIN' ? {} : { employeesRooms: { some: { employeeId } } }

      const visibleRooms = await prisma.rooms.findMany({
        where: roomWhere,
        select: { id: true, name: true, standardTime: true },
        orderBy: { name: 'asc' },
      })

      const visibleRoomIds = visibleRooms.map(room => room.id)
      const scopedRoomIds = roomId ? visibleRoomIds.filter(id => id === roomId) : visibleRoomIds

      // MEMBER que pede uma sala à qual não pertence não recebe erro: recebe zeros, como já
      // acontece em `get-all-releases`. O ranking entre salas continua real, porque ele lista
      // as salas do próprio funcionário — não a que foi pedida.
      const isOutOfScope = scopedRoomIds.length === 0
      const hasVisibleRooms = visibleRoomIds.length > 0

      const monthsOfSelectedYear = buildMonths(year, currentYear, now.month() + 1)

      // `started_at` é TIMESTAMP sem fuso, gravado em UTC pelo Prisma. A primeira conversão
      // diz ao Postgres o que o valor significa; a segunda o traz para o horário da Seccional.
      // Com um `AT TIME ZONE` só, o banco leria o valor como se já fosse local e erraria em
      // três horas — jogando a liberação das 23h de 31/12 para janeiro do ano seguinte.
      const scoped = (ids: string[]) => Prisma.sql`
        WITH scoped AS (
          SELECT
            cs.lawyer_id,
            cs.started_at,
            cs.ended_at,
            c.room_id,
            (cs.started_at AT TIME ZONE 'UTC' AT TIME ZONE ${env.TIMEZONE}) AS local_started_at
          FROM computer_sessions cs
          JOIN computers c ON c.id = cs.computer_id
          WHERE c.room_id IN (${Prisma.join(ids)})
        )
      `

      // Comparar "o mesmo período do ano anterior" por dia-do-ano erraria um dia sempre que
      // um dos dois anos fosse bissexto. Comparar o par (mês, dia) é exato.
      const isCurrentYear = year === currentYear
      const cutoffMonth = isCurrentYear ? now.month() + 1 : MONTHS_IN_YEAR
      const cutoffDay = isCurrentYear ? now.date() : 31

      const none = <T>(): Promise<T[]> => Promise.resolve([])

      const [yearRows, monthRows, roomRows, lawyerRows, summaryRows] = await Promise.all([
        isOutOfScope
          ? none<YearRow>()
          : prisma.$queryRaw<YearRow[]>`
              ${scoped(scopedRoomIds)}
              SELECT EXTRACT(YEAR FROM local_started_at)::int AS "year",
                     COUNT(*)::int AS "total"
              FROM scoped
              GROUP BY 1
              ORDER BY 1 ASC
            `,

        isOutOfScope
          ? none<MonthRow>()
          : prisma.$queryRaw<MonthRow[]>`
              ${scoped(scopedRoomIds)}
              SELECT EXTRACT(MONTH FROM local_started_at)::int AS "month",
                     COUNT(*)::int AS "total"
              FROM scoped
              WHERE EXTRACT(YEAR FROM local_started_at)::int = ${year}::int
              GROUP BY 1
              ORDER BY 1 ASC
            `,

        // Usa `visibleRoomIds`, não `scopedRoomIds`: este bloco é um ranking ENTRE salas, e
        // comparar uma sala com ela mesma não informa nada.
        !hasVisibleRooms
          ? none<RoomRow>()
          : prisma.$queryRaw<RoomRow[]>`
              ${scoped(visibleRoomIds)}
              SELECT room_id AS "roomId",
                     COUNT(*)::int AS "total"
              FROM scoped
              WHERE EXTRACT(YEAR FROM local_started_at)::int = ${year}::int
              GROUP BY 1
            `,

        isOutOfScope
          ? none<LawyerRow>()
          : prisma.$queryRaw<LawyerRow[]>`
              ${scoped(scopedRoomIds)}
              SELECT l.id AS "lawyerId",
                     l.name AS "name",
                     l.oab AS "oab",
                     COUNT(*)::int AS "total"
              FROM scoped s
              JOIN lawyers l ON l.id = s.lawyer_id
              WHERE EXTRACT(YEAR FROM s.local_started_at)::int = ${year}::int
              GROUP BY 1, 2, 3
              ORDER BY "total" DESC, l.name ASC
            `,

        isOutOfScope
          ? none<SummaryRow>()
          : prisma.$queryRaw<SummaryRow[]>`
              ${scoped(scopedRoomIds)}
              SELECT EXTRACT(YEAR FROM local_started_at)::int AS "year",
                     COUNT(*)::int AS "totalReleases",
                     COUNT(DISTINCT lawyer_id)::int AS "distinctLawyers",
                     COUNT(DISTINCT EXTRACT(MONTH FROM local_started_at))::int AS "monthsWithData",
                     AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60.0)
                       FILTER (
                         WHERE ended_at IS NOT NULL
                           AND ended_at > started_at
                           AND ended_at <= started_at + make_interval(hours => ${MAX_PLAUSIBLE_SESSION_HOURS}::int)
                       ) AS "averageSessionMinutes"
              FROM scoped
              WHERE EXTRACT(YEAR FROM local_started_at)::int IN (${year}::int, ${year - 1}::int)
                AND (
                  EXTRACT(MONTH FROM local_started_at)::int,
                  EXTRACT(DAY FROM local_started_at)::int
                ) <= (${cutoffMonth}::int, ${cutoffDay}::int)
              GROUP BY 1
            `,
      ])

      const summaryByYear = new Map(
        summaryRows.map(row => [
          toInt(row.year),
          {
            totalReleases: toInt(row.totalReleases),
            distinctLawyers: toInt(row.distinctLawyers),
            monthsWithData: toInt(row.monthsWithData),
            averageSessionMinutes: toInt(row.averageSessionMinutes),
          } satisfies Summary,
        ])
      )

      const totalsByRoom = new Map(roomRows.map(row => [row.roomId, toInt(row.total)]))

      const byRoom = visibleRooms
        // Sala sem movimento entra com zero: ela some do JOIN, mas é justamente a sala ociosa
        // que o ranking precisa mostrar.
        .map(room => ({ roomId: room.id, name: room.name, total: totalsByRoom.get(room.id) ?? 0 }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'))

      const filteredRoom = roomId ? visibleRooms.find(room => room.id === roomId) : undefined
      const busiestRoom = byRoom[0]?.total ? visibleRooms.find(room => room.id === byRoom[0].roomId) : undefined
      const referenceRoom = filteredRoom ?? busiestRoom

      const totalsByMonth = new Map(monthRows.map(row => [toInt(row.month), toInt(row.total)]))

      return reply.status(200).send({
        metrics: {
          year,
          kpis: buildKpis(
            summaryByYear.get(year) ?? EMPTY_SUMMARY,
            summaryByYear.get(year - 1) ?? EMPTY_SUMMARY,
            referenceRoom ? { roomName: referenceRoom.name, minutes: referenceRoom.standardTime } : null
          ),
          byYear: yearRows.map(row => ({ year: toInt(row.year), total: toInt(row.total) })),
          byMonth: monthsOfSelectedYear.map(({ month, total }) => ({
            month,
            // Mês futuro continua nulo mesmo quando há dados: "—" e "zero" dizem coisas diferentes.
            total: total === null ? null : (totalsByMonth.get(month) ?? 0),
          })),
          byRoom,
          byLawyer: lawyerRows.map(row => ({
            lawyerId: row.lawyerId,
            name: row.name,
            oab: row.oab,
            total: toInt(row.total),
          })),
        },
      })
    })
}

/**
 * Meses do ano consultado. No ano corrente, os que ainda não chegaram vêm como `null` — o
 * painel desenha "—" neles. Zerar um mês futuro afirmaria que ninguém usou a sala em dezembro.
 */
function buildMonths(year: number, currentYear: number, currentMonth: number) {
  return Array.from({ length: MONTHS_IN_YEAR }, (_, index) => {
    const month = index + 1
    const isFuture = year > currentYear || (year === currentYear && month > currentMonth)

    return { month, total: isFuture ? null : 0 }
  })
}

/** Média mensal do próprio recorte: dividir pelos meses com registro, não por doze. */
function averagePerMonth({ totalReleases, monthsWithData }: Summary) {
  return monthsWithData > 0 ? Math.round(totalReleases / monthsWithData) : 0
}

function buildKpis(current: Summary, previous: Summary, referenceStandardTime: { roomName: string; minutes: number } | null) {
  return {
    totalReleases: current.totalReleases,
    totalReleasesPreviousYearSamePeriod: previous.totalReleases,
    monthsWithData: current.monthsWithData,
    averagePerMonth: averagePerMonth(current),
    averagePerMonthPreviousYearSamePeriod: averagePerMonth(previous),
    distinctLawyers: current.distinctLawyers,
    distinctLawyersPreviousYearSamePeriod: previous.distinctLawyers,
    averageSessionMinutes: current.averageSessionMinutes,
    averageSessionMinutesPreviousYearSamePeriod: previous.averageSessionMinutes,
    referenceStandardTime,
  }
}
