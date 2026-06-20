import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from 'bcryptjs'
import { PrismaClient } from 'generated/prisma/client'
import { Pool } from 'pg'
import { env } from '@/http/env'
import { resend } from '@/lib/resend'
import SendEmailEmployeeSignUp from '@/utils/emails/sendEmailEmployeeSignUp'

const connectionString = `${process.env.DATABASE_URL}`
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const ADMIN_NAME = 'Administrador Sala Livre'

async function main() {
  const password = env.PASSWORD_ADMIN
  const hashedPassword = await hash(password, 8)

  const user = await prisma.employees.findUnique({
    where: {
      email: env.EMAIL_ADMIN,
    },
    select: { id: true },
  })

  if (user) {
    console.log('> Administrador já cadastrado. Nenhuma ação necessária.')
    return
  }

  await prisma.employees.create({
    data: {
      name: ADMIN_NAME,
      cpf: env.CPF_ADMIN,
      email: env.EMAIL_ADMIN,
      passwordHash: hashedPassword,
      role: 'ADMIN',
    },
  })

  console.log('> Administrador cadastrado com sucesso!')

  // E-mail de confirmação fora do fluxo crítico: falha não derruba o seed.
  const { error } = await resend.emails.send({
    from: '📧 Sala Livre <nao-responda@hit.dev.br>',
    to: env.NODE_ENV === 'production' ? env.EMAIL_ADMIN : 'hilquiasfmelo@gmail.com',
    subject: '🎉 Bem-vindo à equipe! Aqui estão suas informações.',
    react: SendEmailEmployeeSignUp({
      name: ADMIN_NAME,
      cpf: env.CPF_ADMIN,
      email: env.EMAIL_ADMIN,
      tempPassword: password,
      link: `${env.WEB_URL}/sign-in`,
    }),
  })

  if (error) {
    console.error({ err: error, email: env.EMAIL_ADMIN }, 'Falha ao enviar e-mail de cadastro do administrador.')
  }
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
