import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from 'bcryptjs'
import { PrismaClient } from 'generated/prisma/client'
import { Pool } from 'pg'
import { env } from '@/http/env'

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const password = env.PASSWORD_ADMIN
  const hashedPassword = await hash(password, 8)

  await prisma.employees.upsert({
    where: {
      email: env.EMAIL_ADMIN,
    },
    update: {
      name: 'Administrador Sala Livre',
      cpf: env.CPF_ADMIN,
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
    create: {
      name: 'Administrador Sala Livre',
      cpf: env.CPF_ADMIN,
      email: env.EMAIL_ADMIN,
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
  })

  console.log('> Administrador garantido com sucesso!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
  .catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    await pool.end()
    process.exit(1)
  })
