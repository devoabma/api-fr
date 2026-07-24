import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { NotFoundError } from '@/http/_errors/not-found'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'
import { formattedCodeMac } from '@/utils'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20mb

const sendToPrintSchema = {
  tags: ['printers'],
  summary: 'Envia um documento para impressão pelo advogado com sessão ativa no computador',
  consumes: ['multipart/form-data'],
  params: z.object({
    macCode: z.string().trim().nonempty('Mac Code obrigatório'),
  }),
  body: z.any().meta({
    type: 'object',
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description: 'Documento para impressão (PDF, Word, Excel, PowerPoint ou imagem), até 20MB.',
      },
    },
    required: ['file'],
  }),
  response: {
    200: z.object({
      message: z.string(),
      printId: z.cuid2(),
      fileUrl: z.url(),
    }),
    400: z.object({
      message: z.string(),
    }),
    404: z.object({
      message: z.string(),
    }),
    413: z.object({
      message: z.string(),
    }),
  },
} satisfies FastifySchema

export async function sendToPrint(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/send-to-print/:macCode',
    {
      schema: sendToPrintSchema,
    },
    async (request, reply) => {
      const { macCode } = request.params

      const formattedMacCode = formattedCodeMac(macCode)

      const computer = await prisma.computers.findUnique({
        where: { macCode: formattedMacCode },
        select: {
          id: true,
          currentLawyerId: true,
        },
      })

      if (!computer) {
        throw new NotFoundError('Computador não encontrado.')
      }

      if (!computer.currentLawyerId) {
        throw new BadRequestError('Nenhum advogado(a) com sessão ativa neste computador.')
      }

      const file = await request.file({
        limits: { fileSize: MAX_FILE_SIZE },
      })

      if (!file) {
        throw new BadRequestError('Nenhum arquivo foi enviado.')
      }

      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new BadRequestError('Tipo de arquivo inválido. Envie um PDF, Word, Excel, PowerPoint ou imagem.')
      }

      const buffer = await file.toBuffer()

      const fileExt = file.filename.split('.').pop() // Pega a extensão do arquivo
      const fileName = `${crypto.randomUUID()}.${fileExt}` // Gera um nome aleatório para o arquivo
      const filePath = `uploads/${fileName}`

      const { error } = await supabase.storage.from('prints').upload(filePath, buffer, {
        contentType: file.mimetype,
        upsert: false,
      })

      if (error) {
        console.error({ error })
        throw new BadRequestError('Erro ao enviar o arquivo para impressão.')
      }

      const { data } = supabase.storage.from('prints').getPublicUrl(filePath)

      const print = await prisma.printers.create({
        data: {
          fileUrl: data.publicUrl,
          computerId: computer.id,
          lawyerId: computer.currentLawyerId,
        },
      })

      return reply.status(200).send({
        message: 'Arquivo enviado para impressão com sucesso.',
        printId: print.id,
        fileUrl: print.fileUrl,
      })
    }
  )
}
