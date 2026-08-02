import cron from 'node-cron'
import { env } from '@/http/env'
import { dayjs } from '@/lib/dayjs'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'

const BUCKET = 'prints'

// 6 campos (segundo minuto hora dia mês dia-da-semana): toda sexta-feira às 23:59:59
const CRON_EXPRESSION = '59 59 23 * * 5'

// O Storage aceita várias chaves por chamada, mas lotes menores evitam payloads gigantes
// e limitam o estrago caso uma remoção falhe no meio da limpeza.
const BATCH_SIZE = 100

function extractStoragePath(fileUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const markerIndex = fileUrl.indexOf(marker)

  if (markerIndex === -1) return null

  const path = fileUrl.slice(markerIndex + marker.length).split('?')[0]

  if (!path) return null

  return decodeURIComponent(path)
}

async function deleteBatch(batch: { id: string; fileUrl: string }[]) {
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

      return 0
    }
  }

  const { count } = await prisma.printers.deleteMany({
    where: { id: { in: idsToDelete } },
  })

  return count
}

export async function deleteWeeklyPrints() {
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

    return 0
  }

  let deletedCount = 0

  for (let i = 0; i < prints.length; i += BATCH_SIZE) {
    const batch = prints.slice(i, i + BATCH_SIZE)

    deletedCount += await deleteBatch(batch)
  }

  console.log(
    `[DeleteWeeklyPrints ✅] Limpeza semanal concluída: ${deletedCount} de ${prints.length} impressão(ões) removida(s).`
  )

  return deletedCount
}

export function startDeleteWeeklyPrintsJob() {
  cron.schedule(
    CRON_EXPRESSION,
    async () => {
      try {
        await deleteWeeklyPrints()
      } catch (err) {
        console.error('[DeleteWeeklyPrints ❌] Erro na limpeza semanal de impressões:', err)
      }
    },
    {
      name: 'delete-weekly-prints',
      timezone: env.TIMEZONE,
      noOverlap: true,
    }
  )
}
