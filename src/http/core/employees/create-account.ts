import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

export async function createAccount(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/create-account', {
    schema: {
      tags: ['employees'],
      summary: 'Cria um novo funcionário',
      body: z.object({
        name: z.string().trim().nonempty(),
        cpf: z.string().trim().nonempty(),
        email: z.email().trim(),
        password: z.string().trim().min(8),
      }),
      response: {
        201: z.object({
          message: z.string()
        })
      }
    }
  },
    async (request, reply) => {

      const { name, cpf, email, password } = request.body

      console.log(name, cpf, email, password)

      return reply.status(201).send({
        message: 'Funcionário criado com sucesso!'
      })
    })
}