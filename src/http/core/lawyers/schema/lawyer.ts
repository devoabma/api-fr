import { z } from 'zod'

export const lawyerSituationSchema = z.enum([
  'ATIVO PLENO',
  'ATIVO COM IMPEDIMENTO',
  'EXECUTADO',
  'SUSPENSO POR PROCESSO',
  'SUSPENSO EM OUTRA SECCIONAL',
  // Situação que o Protheus passou a devolver e ainda não foi mapeada aqui
  'NAO ATIVO',
])

export type LawyerSituation = z.infer<typeof lawyerSituationSchema>

export const SITUACOES_LIBERADAS: LawyerSituation[] = [
  'ATIVO PLENO',
  'ATIVO COM IMPEDIMENTO',
  'EXECUTADO',
  'SUSPENSO POR PROCESSO',
  'SUSPENSO EM OUTRA SECCIONAL',
]

export const lawyerApiSchema = z.object({
  lawyer: z.object({
    nome: z.string(),
    registro: z.string(),
    categoria: z.string(),
    cpf: z.string(),
    adimplente: z.boolean(),
    email: z.string(),
    dataNascimento: z.string(),
    situacao: lawyerSituationSchema.catch('NAO ATIVO'),
  }),
})

export type LawyersApiProps = z.infer<typeof lawyerApiSchema>
