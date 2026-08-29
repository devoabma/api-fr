import cron from 'node-cron'
import { env } from '@/http/env'
import { dayjs } from '@/lib/dayjs'
import { prisma } from '@/lib/prisma'
import { resend } from '@/lib/resend'
import { supabase } from '@/lib/supabase'
import WeeklyPrintsCleanupEmail, { type WeeklyPrintsCleanupStatus } from '@/utils/emails/weeklyPrintsCleanupEmail'

const BUCKET = 'prints'

// 6 campos (segundo minuto hora dia mês dia-da-semana): toda sexta-feira às 23:59:59
const CRON_EXPRESSION = '59 59 23 * * 5'

// Sexta-feira, no padrão do dayjs (domingo = 0).
const CLEANUP_WEEKDAY = 5

// O Storage aceita várias chaves por chamada, mas lotes menores evitam payloads gigantes
// e limitam o estrago caso uma remoção falhe no meio da limpeza.
const BATCH_SIZE = 100

// Só o suficiente para o e-mail dar o diagnóstico sem virar um despejo de stack trace.
const MAX_ERRORS_IN_REPORT = 5

type CleanupSummary = {
  totalFound: number
  deletedCount: number
  failedCount: number
  errors: string[]
}

function extractStoragePath(fileUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const markerIndex = fileUrl.indexOf(marker)

  if (markerIndex === -1) return null

  const path = fileUrl.slice(markerIndex + marker.length).split('?')[0]

  if (!path) return null

  return decodeURIComponent(path)
}

/**
 * Momento da última janela agendada (a sexta-feira 23:59:59 mais recente que já passou).
 * É o corte usado para saber se sobrou lixo de uma execução que não aconteceu.
 */
function lastScheduledRun(reference = dayjs().tz()) {
  const candidate = reference.day(CLEANUP_WEEKDAY).hour(23).minute(59).second(59).millisecond(0)

  // `.day()` anda dentro da semana corrente: no domingo, na segunda, etc., a sexta que ele
  // devolve ainda está no futuro — nesse caso a janela válida é a da semana anterior.
  return candidate.isAfter(reference) ? candidate.subtract(7, 'day') : candidate
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message

  if (typeof err === 'string') return err

  return JSON.stringify(err)
}

/**
 * O relatório é informativo: se o e-mail falhar, o job já fez (ou já deixou de fazer) o que
 * tinha que fazer, e derrubar a execução aqui só trocaria um problema por outro.
 */
async function sendCleanupReport(
  status: WeeklyPrintsCleanupStatus,
  { totalFound, deletedCount, failedCount, errors }: CleanupSummary
) {
  const runAt = dayjs().tz().format('DD/MM/YYYY [às] HH:mm:ss')

  const errorMessage = errors.length > 0 ? errors.slice(0, MAX_ERRORS_IN_REPORT).join('\n') : undefined

  try {
    const { error } = await resend.emails.send({
      from: '📧 Sala Livre <salalivre@hit.dev.br>',
      to: env.NODE_ENV === 'production' ? env.EMAIL_ADMIN : 'hilquiasfmelo@gmail.com',
      subject:
        status === 'success'
          ? '🗑️ Limpeza semanal de impressões concluída - Sala Livre'
          : '🚨 Limpeza semanal de impressões precisa de atenção - Sala Livre',
      react: WeeklyPrintsCleanupEmail({
        status,
        totalFound,
        deletedCount,
        failedCount,
        runAt,
        link: env.WEB_URL,
        errorMessage,
      }),
    })

    if (error) {
      console.error('[DeleteWeeklyPrints ❌] Falha ao enviar o relatório da limpeza semanal:', error)

      return
    }

    console.log(`[DeleteWeeklyPrints 📧] Relatório da limpeza semanal enviado (status: ${status}).`)
  } catch (err) {
    console.error('[DeleteWeeklyPrints ❌] Erro inesperado ao enviar o relatório da limpeza semanal:', err)
  }
}

async function deleteBatch(batch: { id: string; fileUrl: string }[]): Promise<{ deleted: number; error: string | null }> {
  const paths: string[] = []
  const idsToDelete: string[] = []

  for (const print of batch) {
    const path = extractStoragePath(print.fileUrl)

    if (path) {
      paths.push(path)
    } else {
      console.log(`[DeleteWeeklyPrints ⚠️ ] Impressão ${print.id} com URL fora do padrão do bucket, removendo apenas o registro.`)
    }

    idsToDelete.push(print.id)
  }

  if (paths.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths)

    if (error) {
      console.log('[DeleteWeeklyPrints ❌] Erro ao remover arquivos do Storage, lote mantido para a próxima execução:', error)

      return { deleted: 0, error: `Storage: ${error.message}` }
    }
  }

  const { count } = await prisma.printers.deleteMany({
    where: { id: { in: idsToDelete } },
  })

  return { deleted: count, error: null }
}

export async function deleteWeeklyPrints(): Promise<CleanupSummary> {
  // Corta pela data de início da execução: impressões enviadas enquanto o job roda
  // ficam para a semana seguinte, em vez de serem apagadas antes de irem para a fila física.
  const cutoff = dayjs().tz().toDate()

  const prints = await prisma.printers.findMany({
    where: { createdAt: { lte: cutoff } },
    select: { id: true, fileUrl: true },
    orderBy: { createdAt: 'asc' },
  })

  if (prints.length === 0) {
    console.log('[DeleteWeeklyPrints ✅] Nenhuma impressão para limpar nesta semana.')

    return { totalFound: 0, deletedCount: 0, failedCount: 0, errors: [] }
  }

  let deletedCount = 0

  const errors: string[] = []

  for (let i = 0; i < prints.length; i += BATCH_SIZE) {
    const batch = prints.slice(i, i + BATCH_SIZE)

    const { deleted, error } = await deleteBatch(batch)

    deletedCount += deleted

    if (error) {
      errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error}`)
    }
  }

  console.log(
    `[DeleteWeeklyPrints ✅] Limpeza semanal concluída: ${deletedCount} de ${prints.length} impressão(ões) removida(s).`
  )

  return {
    totalFound: prints.length,
    deletedCount,
    failedCount: prints.length - deletedCount,
    errors,
  }
}

async function runWeeklyCleanupWithReport() {
  try {
    const summary = await deleteWeeklyPrints()

    await sendCleanupReport(summary.failedCount > 0 ? 'partial' : 'success', summary)
  } catch (err) {
    console.error('[DeleteWeeklyPrints ❌] Erro na limpeza semanal de impressões:', err)

    // Sem o resumo não dá para saber quanto sobrou; o e-mail sai mesmo assim porque o
    // silêncio aqui é justamente o que deixa a fila crescer sem ninguém perceber.
    await sendCleanupReport('failed', {
      totalFound: 0,
      deletedCount: 0,
      failedCount: 0,
      errors: [describeError(err)],
    })
  }
}

/**
 * Com a API fora do ar na sexta à noite, o cron simplesmente não dispara — não existe de onde
 * mandar o alerta naquele momento. A checagem é feita então no boot seguinte: se ainda há
 * impressões anteriores à última janela agendada, a limpeza daquela sexta não aconteceu
 * (ou não terminou), e é isso que o e-mail informa.
 *
 * Roda uma única vez por processo, para que uma sequência de restarts com a fila suja não
 * vire uma enxurrada de e-mails iguais.
 */
export async function reportMissedWeeklyCleanup() {
  try {
    const cutoff = lastScheduledRun().toDate()

    const pendingCount = await prisma.printers.count({
      where: { createdAt: { lte: cutoff } },
    })

    if (pendingCount === 0) return

    console.warn(
      `[DeleteWeeklyPrints 🚨] ${pendingCount} impressão(ões) anteriores a ${dayjs(cutoff).tz().format('DD/MM/YYYY HH:mm:ss')} ainda na fila: a limpeza daquela sexta não foi executada.`
    )

    await sendCleanupReport('pending', {
      totalFound: pendingCount,
      deletedCount: 0,
      failedCount: pendingCount,
      errors: [`Janela agendada perdida: ${dayjs(cutoff).tz().format('DD/MM/YYYY [às] HH:mm:ss')}.`],
    })
  } catch (err) {
    console.error('[DeleteWeeklyPrints ❌] Erro ao verificar se a limpeza semanal foi perdida:', err)
  }
}

export function startDeleteWeeklyPrintsJob() {
  // Não espera o resultado: o servidor já está de pé e essa checagem é diagnóstico, não boot.
  void reportMissedWeeklyCleanup()

  cron.schedule(CRON_EXPRESSION, runWeeklyCleanupWithReport, {
    name: 'delete-weekly-prints',
    timezone: env.TIMEZONE,
    noOverlap: true,
  })
}
