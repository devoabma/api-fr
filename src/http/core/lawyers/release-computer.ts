import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { API_PROTHEUS_DATA } from '@/lib/axios'
import { dayjs } from '@/lib/dayjs'
import { prisma } from '@/lib/prisma'
import { formattedCodeMac } from '@/utils'
import { cpfSchema } from '@/utils/validations/cpf'
import { getDailyQuota } from './helpers/daily-quota'
import { lawyerApiSchema, SITUACOES_LIBERADAS } from './schema/lawyer'

const releaseComputerSchema = {
  tags: ['lawyers'],
  summary: 'Libera um computador',
  body: z.object({
    cpf: cpfSchema,
    oab: z.string().trim().nonempty('OAB obrigatório'),
    birth: z.string().trim().nonempty('Data de nascimento obrigatória'),
    macCode: z.string().trim().nonempty('Mac Code obrigatório'),
  }),
  response: {
    200: z.object({
      message: z.string(),
      sessionId: z.cuid2(),
    }),
    400: z.object({
      message: z.string(),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
} satisfies FastifySchema

export async function releaseComputer(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/release-computer',
    {
      schema: releaseComputerSchema,
    },
    async (request, reply) => {
      const { cpf, oab, birth, macCode } = request.body

      const formattedMacCode = formattedCodeMac(macCode)

      if (formattedMacCode.length !== 17) {
        throw new BadRequestError('Mac Code inválido. Padrão de 17 caracteres.')
      }

      /** Consulta o advogado(a) na API da OAB */
      const response = await API_PROTHEUS_DATA('/', {
        params: {
          idOrg: 10,
          param: cpf,
        },
      })

      const result = lawyerApiSchema.safeParse(response.data)

      if (!result.success) {
        throw new NotFoundError('Consulta indisponível ou advogado(a) não encontrado.')
      }

      const { lawyer: consultedLawyer } = result.data

      if (!SITUACOES_LIBERADAS.includes(consultedLawyer.situacao)) {
        throw new BadRequestError('Advogado(a) inativo, entre em contato com a OAB.')
      }

      if (!consultedLawyer.adimplente) {
        throw new BadRequestError('Advogado(a) inadimplente. Regularize sua situação financeira na OAB.')
      }

      const formattedBirth = dayjs(consultedLawyer.dataNascimento).format('DDMMYYYY')

      if (consultedLawyer.cpf !== cpf || consultedLawyer.registro !== oab || formattedBirth !== birth) {
        throw new BadRequestError('Dados informados não conferem com os dados junto a OAB.')
      }

      /** Realiza a validação do computador e sala antes de cadastrar o Advogado(a) */
      const computer = await prisma.computers.findUnique({
        where: {
          macCode: formattedMacCode,
        },
        select: {
          id: true,
          inUse: true,
          maintenance: true,
          room: {
            select: {
              inactive: true,
              standardTime: true,
            },
          },
        },
      })

      if (!computer) {
        throw new NotFoundError('Computador não encontrado.')
      }

      if (computer.room.inactive) {
        throw new BadRequestError('Sala inativa. Entre em contato com a administração.')
      }

      if (computer.maintenance) {
        throw new BadRequestError('Computador em manutenção.')
      }

      /** Verifica se o advgado ja esta cadastrado, senao atualiza ele no banco */
      let lawyer = await prisma.lawyers.findUnique({
        where: {
          cpf,
        },
      })

      if (!lawyer) {
        lawyer = await prisma.lawyers.create({
          data: {
            name: consultedLawyer.nome,
            cpf,
            oab,
            email: consultedLawyer.email,
            birth: formattedBirth,
            category: consultedLawyer.categoria,
          },
        })
      } else if (
        lawyer.name !== consultedLawyer.nome ||
        lawyer.oab !== oab ||
        lawyer.email !== consultedLawyer.email ||
        lawyer.birth !== formattedBirth ||
        lawyer.category !== consultedLawyer.categoria
      ) {
        lawyer = await prisma.lawyers.update({
          where: {
            cpf,
          },
          data: {
            name: consultedLawyer.nome,
            oab,
            email: consultedLawyer.email,
            birth: formattedBirth,
            category: consultedLawyer.categoria,
          },
        })
      }

      /** Cria a sessao do advogado(a) */

      // Busca se existe uma sessão ativa para o advogado(a)
      const activeSession = await prisma.computerSessions.findFirst({
        where: {
          lawyerId: lawyer.id,
          endedAt: null,
        },
        select: {
          id: true,
          startedAt: true,
          computerId: true,
          computer: {
            select: {
              macCode: true,
              room: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
      })

      /**
       * A cota diária é definida pela sala onde o advogado(a) abriu a PRIMEIRA sessão do dia
       * e é consumida globalmente. Trocar de sala não gera cota nova.
       */
      const { remainingMinutes } = await getDailyQuota(lawyer.id, computer.room.standardTime)

      if (activeSession) {
        // Se o advogado já estiver usando outro computador, não permite liberar outro.
        if (activeSession.computer.macCode !== formattedMacCode) {
          throw new BadRequestError(`Advogado(a) com sessão ativa em ${activeSession.computer.room.name}.`)
        }

        const startedAt = dayjs(activeSession.startedAt).tz()
        const now = dayjs().tz()
        const differenceInMinutes = now.diff(startedAt, 'minute')

        // O limite da sessão em curso é o SALDO do dia, não o tempo cheio da sala.
        if (differenceInMinutes >= remainingMinutes) {
          await prisma.$transaction([
            prisma.computerSessions.update({
              where: {
                id: activeSession.id,
              },
              data: {
                endedAt: now.toDate(),
              },
            }),
            prisma.computers.update({
              where: {
                id: activeSession.computerId,
              },
              data: {
                inUse: false,
                currentLawyerId: null,
              },
            }),
            prisma.lawyers.update({
              where: {
                id: lawyer.id,
              },
              data: {
                // Marca que ele consumiu a cota HOJE — não pode ser null, senão o dia se perde.
                lastAccess: now.toDate(),
                remainingTime: 0,
              },
            }),
          ])

          return reply.status(200).send({
            message: 'Sessão encerrada devido ao tempo limite atingido. Por favor, tente novamente amanhã.',
            sessionId: activeSession.id,
          })
        } else {
          const remainingTime = remainingMinutes - differenceInMinutes

          throw new BadRequestError(`Advogado(a) já possui uma sessão ativa. Restam apenas ${remainingTime} minutos(s).`)
        }
      }

      /** INICIO DA NOVA SESSAO CASO NAO TENHA UMA ATIVA */

      // Cota do dia esgotada em qualquer sala — só libera no próximo dia.
      if (remainingMinutes <= 0) {
        throw new BadRequestError('Limite diário de uso atingido. Tente novamente amanhã.')
      }

      // Verifica se o computador já está sendo utilizado.
      if (computer.inUse) {
        throw new BadRequestError('Computador em uso.')
      }

      const startedAt = dayjs().tz().toDate()

      const [_, __, computerSession] = await prisma.$transaction([
        prisma.computers.update({
          where: {
            macCode: formattedMacCode,
          },
          data: {
            inUse: true,
            currentLawyerId: lawyer.id,
          },
        }),
        prisma.lawyers.update({
          where: {
            id: lawyer.id,
          },
          data: {
            lastAccess: startedAt,
            remainingTime: remainingMinutes,
          },
        }),
        prisma.computerSessions.create({
          data: {
            lawyerId: lawyer.id,
            computerId: computer.id,
            startedAt,
          },
        }),
      ])

      return reply.status(200).send({
        message: 'Computador liberado com sucesso.',
        sessionId: computerSession.id,
      })
    }
  )
}
