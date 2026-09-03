import { z } from 'zod'

/**
 * Endereço de um arquivo para download.
 *
 * O que importa aqui é o `protocol` fechado em `http`/`https`. Um `z.url()` solto aceita
 * `javascript:alert(1)` e `file:///C:/...` como URLs perfeitamente válidas — e este campo termina
 * dentro de um `href` que o funcionário clica no painel. Fechar o protocolo na entrada é o que
 * impede que um link colado errado (ou de má-fé) vire execução de script no navegador de quem
 * está só tentando baixar o instalador.
 *
 * O teto de 2048 é o limite prático de URL que navegadores e proxies tratam sem reclamar; acima
 * disso o problema não é o banco, é o link não funcionar em algum ponto do caminho.
 */
export const downloadUrlSchema = z
  .url({
    protocol: /^https?$/,
    error: 'URL inválida. Informe um endereço http(s) completo (ex: https://.../SalaLivreSetup.exe).',
  })
  .trim()
  .max(2048, 'URL longa demais. O limite é de 2048 caracteres.')
  .describe('Endereço público e direto do arquivo, com protocolo (ex: https://.../SalaLivreSetup.exe).')
