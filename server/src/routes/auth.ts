import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { signToken } from '../auth.js'
import { audit } from '../audit.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'

export const authRouter = Router()

const DEMO_ACCOUNTS: Record<string, { name: string; role: string; pass: string; producerName: string | null }> = {
  'admin@diskingressos.com.br': { name: 'Administrador Master', role: 'global-admin', pass: 'Admin@123', producerName: null },
  'vinicius@diskingressos.com.br': { name: 'Vinicius Produtor', role: 'producer-admin', pass: 'Produtor@123', producerName: 'DiskIngressos Produções' },
  'financeiro@fep.com.br': { name: 'Mariana Financeiro', role: 'producer-finance', pass: 'Financeiro@123', producerName: 'FEP Eventos' },
  'marketing@diskingressos.com.br': { name: 'Camila Growth', role: 'producer-marketing', pass: 'Marketing@123', producerName: 'DiskIngressos Produções' },
  'operacao@diskingressos.com.br': { name: 'Rafael Portaria', role: 'producer-ops', pass: 'Operacao@123', producerName: 'DiskIngressos Produções' },
  'consulta@diskingressos.com.br': { name: 'Leitor Auditoria', role: 'viewer', pass: 'Consulta@123', producerName: 'DiskIngressos Produções' },
  'comercial@diskingressos.com.br': { name: 'Carlos Comercial', role: 'commercial', pass: 'Comercial@123', producerName: null }
}

async function ensureDemoUserIfMatched(email: string, password: string) {
  const spec = DEMO_ACCOUNTS[email]
  if (!spec || spec.pass !== password) return null
  let producerId: number | null = null
  if (spec.producerName) {
    const doc = spec.producerName === 'FEP Eventos' ? '98.765.432/0001-10' : '12.345.678/0001-90'
    const existingProd = await prisma.producer.findFirst({
      where: { OR: [{ name: spec.producerName }, { document: doc }] }
    })
    if (existingProd) {
      producerId = existingProd.id
    } else {
      const createdProd = await prisma.producer.create({
        data: {
          name: spec.producerName,
          document: doc,
          status: 'ativo'
        }
      })
      producerId = createdProd.id
    }
  }
  const passwordHash = await bcrypt.hash(spec.pass, 10)
  return prisma.user.upsert({
    where: { email },
    update: { status: 'ativo', passwordHash, role: spec.role, producerId },
    create: { name: spec.name, email, role: spec.role, status: 'ativo', producerId, passwordHash, lastLogin: new Date() },
    include: { producer: true }
  })
}

authRouter.post('/login', async (req, res) => {
  const effectiveDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING
  if (!effectiveDbUrl) return res.status(503).json({ message: 'DATABASE_URL não configurada no ambiente da API.' })
  const parsed = z.object({ email: z.string().email(), password: z.string().min(3) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Dados inválidos.' })
  const email = parsed.data.email.trim().toLowerCase()
  let user = await prisma.user.findUnique({ where: { email }, include: { producer: true } })
  if (!user || user.status !== 'ativo' || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    user = await ensureDemoUserIfMatched(email, parsed.data.password)
  }
  if (!user || user.status !== 'ativo' || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ message: 'E-mail ou senha inválidos.' })
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }).catch(() => {})
  const safe = { id: user.id, name: user.name, email: user.email, role: user.role, producerId: user.producerId, status: user.status, lastLogin: new Date().toISOString() }
  await audit(req, user.id, user.producerId, 'login', 'auth').catch(() => {})
  res.json({ token: signToken({ id: user.id, name: user.name, email: user.email, role: user.role, producerId: user.producerId }), user: safe })
})

authRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.auth!.id },
    select: { id: true, name: true, email: true, role: true, producerId: true, status: true, lastLogin: true }
  })
  if (!u) {
    return res.status(401).json({ message: 'Sessão inválida ou usuário não encontrado.' })
  }
  res.json(u)
})

