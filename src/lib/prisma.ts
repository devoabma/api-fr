import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'

const connectionString = `${process.env.DATABASE_URL}`

const adapter = new PrismaPg({
  connectionString,
  // Mantém o socket TCP vivo para o Neon/PgBouncer não derrubar a conexão à toa
  keepAlive: true,
  // Recicla conexões ociosas antes do Neon matá-las (evita reusar socket "zumbi" -> ETIMEDOUT)
  idleTimeoutMillis: 10_000,
  // Tempo máximo para abrir uma nova conexão (cobre o cold start do scale-to-zero)
  connectionTimeoutMillis: 15_000,
  max: 10,
})
const prisma = new PrismaClient({ adapter })

export { prisma }
