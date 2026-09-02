import cron from 'node-cron'
import { env } from '@/http/env'
import { getCurrentPublishedVersion, savePublishedVersion } from '../core/app-version/save-published-version'

/**
 * Espelha o manifesto público na tabela de versões publicadas.
 *
 * É a **rede de segurança**, não a fonte: quem avisa primeiro é o `POST /app/version`, no instante
 * da publicação. Este job existe para o dia em que aquele aviso não chegar — script que falhou,
 * API reiniciando, rede ruim no momento exato do envio.
 *
 * De 5 em 5 minutos porque é o `max-age` que a própria publicação define no arquivo. Perguntar mais
 * rápido não adianta: a CDN devolveria a mesma cópia.
 *
 * Uma consulta por processo, nunca por usuário do painel. Dez funcionários com a tela aberta não
 * podem virar dez consultas ao bucket para descobrir o mesmo número — o painel lê da tabela.
 */

// 6 campos (segundo minuto hora dia mês dia-da-semana): no segundo 0 de cada 5º minuto.
const CRON_EXPRESSION = '0 */5 * * * *'

/**
 * Teto da leitura do arquivo público.
 *
 * O arquivo tem ~1 KB e vem de CDN; 10 segundos já é generoso. O teto existe para o job não ficar
 * pendurado até a próxima rodada quando o DNS ou a CDN oscilam — pendurado ele não erra, mas também
 * não tenta de novo.
 */
const FETCH_TIMEOUT_IN_MS = 10_000

/**
 * Uma rodada do espelho.
 *
 * **Falha nunca vira "não há versão".** Bucket lento, DNS oscilando, timeout, 500 na CDN: em todos
 * esses casos o valor conhecido fica de pé e o job tenta de novo em 5 minutos. Apagar a versão
 * publicada por causa de uma oscilação de rede faria o painel anunciar que o parque inteiro está em
 * dia — e ninguém atualizaria nada naquele dia.
 *
 * Exportada para poder ser chamada à mão numa verificação, sem esperar o cron.
 */
export async function mirrorPublishedVersion(): Promise<void> {
  const current = await getCurrentPublishedVersion().catch(() => null)

  try {
    const response = await fetch(env.APP_MANIFEST_URL, {
      // Com o `ETag` da última leitura, a esmagadora maioria das rodadas volta `304` sem corpo:
      // tráfego praticamente zero para uma novidade que acontece uma vez por mês.
      headers: current?.etag ? { 'If-None-Match': current.etag } : {},
      signal: AbortSignal.timeout(FETCH_TIMEOUT_IN_MS),
    })

    // Nada mudou desde a última leitura. É o caminho normal, e não merece uma linha de log a cada
    // 5 minutos.
    if (response.status === 304) {
      return
    }

    if (!response.ok) {
      console.warn(`[Espelho ⚠️ ] Manifesto respondeu ${response.status}; mantida a versão conhecida.`)

      return
    }

    // `text()`, não `json()`: o que vai para o banco é o corpo cru, byte a byte, porque é ele que a
    // fase 2 (`GET /app/version`) devolve às estações.
    const envelope = await response.text()

    const result = await savePublishedVersion({
      envelope,
      origin: 'MIRROR',
      etag: response.headers.get('etag'),
    })

    if (result.status === 'saved') {
      console.log(`[Espelho 📦] Versão ${result.version} descoberta no manifesto público e guardada.`)

      return
    }

    // Os dois casos esperados, e não defeitos: logo depois de uma publicação avisada por `POST`, a
    // CDN ainda entrega a cópia velha do cache por até 5 minutos. Ela pode trazer um número de
    // versão anterior (`older`) ou o **mesmo** número com uma onda que já foi substituída
    // (`stale_rollout`) — subir a fatia do parque republica o mesmo `1.0.8` a 10%, 50%, 100%. A
    // guarda de `savePublishedVersion` é o que impede o espelho de desfazer o que o aviso trouxe.
    if (result.reason === 'older') {
      console.log(`[Espelho ↩️ ] Manifesto público ainda anuncia a ${result.version}; mantida a versão mais nova.`)

      return
    }

    if (result.reason === 'stale_rollout') {
      console.log(`[Espelho ↩️ ] Manifesto público traz uma onda antiga da ${result.version}; mantida a publicação mais recente.`)

      return
    }

    console.warn(`[Espelho ⚠️ ] Manifesto público ilegível (${result.reason}); mantida a versão conhecida.`)
  } catch (err) {
    // Inclui o timeout do `AbortSignal`. Sem versão nova, mas também sem estrago: o que já estava
    // guardado continua valendo.
    console.error('[Espelho ❌] Falha ao ler o manifesto público; mantida a versão conhecida:', err)
  }
}

export function startMirrorAppVersionJob() {
  // `noOverlap` porque uma leitura lenta não pode empilhar com a próxima: duas rodadas ao mesmo
  // tempo brigariam para escrever a mesma linha, sem nenhum ganho.
  cron.schedule(CRON_EXPRESSION, mirrorPublishedVersion, {
    name: 'mirror-app-version',
    timezone: env.TIMEZONE,
    noOverlap: true,
  })

  // Uma leitura no arranque para a API não passar os primeiros 5 minutos sem saber a versão
  // publicada — o que deixaria o painel inteiro em "não sei" logo depois de cada deploy.
  //
  // `void` porque o boot não espera por rede: se falhar, o próprio job tenta de novo em 5 minutos.
  void mirrorPublishedVersion()
}
