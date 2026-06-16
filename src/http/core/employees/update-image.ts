import type { FastifyInstance, FastifySchema } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '@/http/_errors/bad-request'
import { auth } from '@/http/middleware/auth'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'

const updateEmployeeImageSchema = {
  tags: ['employees'],
  summary: 'Atualiza a imagem de um funcionário',
  security: [{ bearerAuth: [] }],
  consumes: ['multipart/form-data'],
  // O arquivo é lido via request.file() (@fastify/multipart), então a validação
  // do body fica permissiva (z.any) e o schema OpenAPI é injetado via .meta()
  // apenas para o Scalar/Swagger exibir o campo de upload da foto.
  body: z.any().meta({
    type: 'object',
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description: 'Imagem do perfil do funcionário (JPG, PNG ou WEBP, até 5MB).',
      },
    },
    required: ['file'],
  }),
  response: {
    200: z.object({
      imageUrl: z.url(),
    }),
    400: z.object({
      message: z.string(),
    }),

    413: z.object({
      message: z.string(),
    }),
  },
} satisfies FastifySchema

export async function updateEmployeeImage(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/update-image',
      {
        schema: updateEmployeeImageSchema,
      },
      async (request, reply) => {
        const employeeId = await request.getIdCurrentEmployee()

        const file = await request.file()

        if (!file) {
          throw new BadRequestError('Nenhum arquivo foi enviado.')
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

        if (!allowedTypes.includes(file.mimetype)) {
          throw new BadRequestError('Tipo de arquivo inválido. Envie uma imagem JPG, PNG ou WEBP.')
        }

        const employee = await prisma.employees.findUnique({
          where: { id: employeeId },
        })

        const buffer = await file.toBuffer()

        const fileExt = file.filename.split('.').pop() // Pega a extensão do arquivo
        const fileName = `${crypto.randomUUID()}.${fileExt}` // Gera um nome aleatório para o arquivo
        const filePath = `uploads/${fileName}` // Define o caminho do arquivo

        const { error } = await supabase.storage.from('profiles').upload(filePath, buffer, {
          contentType: file.mimetype,
          upsert: false, // Impede que o arquivo seja sobrescrito
        })

        if (error) {
          console.log({ error })
          throw new BadRequestError('Erro ao atualizar a imagem do funcionário.')
        }

        const { data } = supabase.storage.from('profiles').getPublicUrl(filePath)

        await prisma.employees.update({
          where: { id: employeeId },
          data: {
            imageUrl: data.publicUrl,
            imagePublicId: filePath,
          },
        })

        // Imagem nova já gravada e ativa. Remove a antiga do bucket (não-fatal:
        // se falhar, sobra um arquivo órfão, mas o cadastro permanece consistente)
        if (employee && employee.imagePublicId) {
          const { error: removeError } = await supabase.storage.from('profiles').remove([employee.imagePublicId])

          if (removeError) {
            console.error('Falha ao remover a imagem antiga do bucket:', removeError)
          }
        }

        return reply.status(200).send({ imageUrl: data.publicUrl })
      }
    )
}
