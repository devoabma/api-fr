import { z } from 'zod'

/**
 * As 27 unidades federativas do Brasil.
 *
 * Lista fechada de propósito: a UF da sala vira filtro de publicação de versão no Desktop,
 * e uma sigla digitada errada não daria erro em lugar nenhum — a máquina simplesmente
 * deixaria de casar com a onda dirigida ao estado dela, calada.
 */
export const UFS = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const

export type Uf = (typeof UFS)[number]

/**
 * Aceita a sigla em qualquer caixa e devolve sempre em maiúsculas — o painel manda de um
 * `select`, mas a API é consumida por mais de um cliente e `"ma"` não é erro do usuário.
 *
 * O `.describe` carrega a lista para o Swagger: como a normalização vem antes do `enum`, o
 * JSON Schema gerado a partir da entrada enxerga só `string` e perderia as siglas.
 */
export const ufSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.enum(UFS, 'UF inválida. Use a sigla de 2 letras do estado (ex: MA).'))
  .describe(`Sigla do estado da sala, em maiúsculas. Valores aceitos: ${UFS.join(', ')}.`)
