// ============================================================================
// ROTAS DO NÚCLEO ENTERPRISE DE INGRESSOS E CONTROLE DE ACESSO (FASE 29.10)
// Disk Core • Ingressos, Credenciais Seguras, Transferências, Reemissão e Acesso
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

export const ticketsAccessRouter = Router()

// Banco em memória mockado com persistência durante execução do servidor
interface MockCredential {
  id: string
  ticketId: string
  version: number
  code: string
  qrPayload: string
  secureHash: string
  status: 'ATIVA' | 'REVOGADA_REEMISSAO' | 'REVOGADA_TRANSFERENCIA' | 'REVOGADA_CANCELAMENTO' | 'CONSUMIDA'
  issuedAt: string
  revokedAt?: string
  revocationReason?: string
}

interface MockTransfer {
  id: string
  ticketId: string
  fromHolderName: string
  fromHolderDocument: string
  fromHolderEmail: string
  toHolderName: string
  toHolderDocument: string
  toHolderEmail: string
  toHolderPhone: string
  transferredAt: string
  transferredBy: 'COMPRADOR' | 'OPERADOR_SAC' | 'ADMIN'
  oldCredentialVersion: number
  newCredentialVersion: number
  notes?: string
}

interface MockTicket {
  id: string
  sequentialNumber: string // 8 dígitos numéricos sequenciais (ex: '00010481')
  orderId: string
  eventId: number
  eventName: string
  sector: string
  seat?: string
  lot: string
  modality: 'INTEIRA' | 'MEIA_ENTRADA' | 'CORTESIA' | 'PROMO'
  modalityLabel?: string
  priceCents: number
  feeCents: number
  currency: 'BRL'
  buyerName: string
  buyerDocument: string
  buyerEmail: string
  buyerPhone: string
  holderName: string
  holderDocument: string
  holderEmail: string
  holderPhone: string
  status: 'EMITIDO' | 'ATIVO' | 'TRANSFERIDO' | 'REEMITIDO' | 'UTILIZADO' | 'CANCELADO' | 'BLOQUEADO'
  statusLabelPtBr: string
  currentCredentialVersion: number
  currentCredentialCode: string
  transferCount: number
  checkInAt?: string
  checkInGate?: string
  checkInDevice?: string
  checkInOperator?: string
  createdAt: string
  updatedAt: string
  sacProtocol?: string
  canceledByDepartment?: string
  cancellationReason?: string
}

let sequentialCounter = 10486
function nextSequentialTicketNumber(): string {
  sequentialCounter += 1
  return String(sequentialCounter).padStart(8, '0')
}

function computeDaysSincePurchase(createdAtIso: string): number {
  const createdMs = new Date(createdAtIso).getTime()
  if (Number.isNaN(createdMs)) return 0
  return Math.max(0, Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24)))
}

const CPF_ALLOWED_DEPARTMENTS = new Set(['SAC', 'ESTORNO', 'FINANCEIRO', 'ADMIN'])

function canDepartmentConsultCpf(department?: string): boolean {
  if (!department) return true
  return CPF_ALLOWED_DEPARTMENTS.has(department.toUpperCase())
}

function isCpfSearchTerm(raw: string): boolean {
  const trimmed = raw.trim()
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(trimmed)) return true
  const digits = trimmed.replace(/\D/g, '')
  // 11 dígitos numéricos = CPF (8 dígitos numéricos = número sequencial do ingresso!)
  return digits.length === 11
}

function maskCpf(doc: string): string {
  const d = doc.replace(/\D/g, '')
  if (d.length === 11) {
    return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
  }
  return '***.***.***-**'
}

function enrichTicketWithGovernance(t: MockTicket, department?: string) {
  const createdMs = new Date(t.createdAt).getTime()
  const diffDays = Math.max(0, Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24)))
  const within7DaysWindow = diffDays <= 7
  const allowFullCpf = canDepartmentConsultCpf(department)

  return {
    ...t,
    buyerDocument: allowFullCpf ? t.buyerDocument : maskCpf(t.buyerDocument),
    holderDocument: allowFullCpf ? t.holderDocument : maskCpf(t.holderDocument),
    daysSincePurchase: diffDays,
    within7DaysWindow
  }
}

// Ingressos iniciais realistas com Número Sequencial de 8 Dígitos Numéricos
let tickets: MockTicket[] = [
  {
    id: 'TKT-2026-00010481',
    sequentialNumber: '00010481',
    orderId: 'ORD-928371',
    eventId: 1,
    eventName: 'Orquestra Sinfônica — Noite de Clássicos',
    sector: 'Plateia Premium A',
    lot: '1º Lote Antecipado',
    modality: 'INTEIRA',
    priceCents: 24000,
    feeCents: 2400,
    currency: 'BRL',
    buyerName: 'Maria Silva Santos',
    buyerDocument: '049.281.938-12',
    buyerEmail: 'maria.santos@email.com.br',
    buyerPhone: '(41) 98822-1099',
    holderName: 'Lucas Fernandes Pereira',
    holderDocument: '512.981.234-99',
    holderEmail: 'lucas.pereira@email.com',
    holderPhone: '(41) 99182-3344',
    status: 'ATIVO',
    statusLabelPtBr: 'Ativo para Entrada',
    currentCredentialVersion: 2,
    currentCredentialCode: 'SEC-00010481-V2-7d8a9e',
    transferCount: 1,
    // Comprado há 2 dias (dentro do prazo legal de 7 dias CDC)
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'TKT-2026-00010482',
    sequentialNumber: '00010482',
    orderId: 'ORD-928371',
    eventId: 1,
    eventName: 'Orquestra Sinfônica — Noite de Clássicos',
    sector: 'Plateia Premium A',
    lot: '1º Lote Antecipado',
    modality: 'MEIA_ENTRADA',
    priceCents: 12000,
    feeCents: 1200,
    currency: 'BRL',
    buyerName: 'Maria Silva Santos',
    buyerDocument: '049.281.938-12',
    buyerEmail: 'maria.santos@email.com.br',
    buyerPhone: '(41) 98822-1099',
    holderName: 'Maria Silva Santos',
    holderDocument: '049.281.938-12',
    holderEmail: 'maria.santos@email.com.br',
    holderPhone: '(41) 98822-1099',
    status: 'UTILIZADO',
    statusLabelPtBr: 'Check-in Realizado',
    currentCredentialVersion: 1,
    currentCredentialCode: 'SEC-00010482-V1-3b4c5d',
    transferCount: 0,
    checkInAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    checkInGate: 'Portão Principal Sul',
    checkInDevice: 'Catraca 02 - Ótica',
    checkInOperator: 'Juliana Castro (Portaria)',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'TKT-2026-00010483',
    sequentialNumber: '00010483',
    orderId: 'ORD-928372',
    eventId: 1,
    eventName: 'Orquestra Sinfônica — Noite de Clássicos',
    sector: 'Camarote Lateral B',
    lot: 'Lote Promocional',
    modality: 'INTEIRA',
    priceCents: 35000,
    feeCents: 3500,
    currency: 'BRL',
    buyerName: 'Carlos Eduardo Nogueira',
    buyerDocument: '718.992.100-43',
    buyerEmail: 'carlos.nogueira@adv.com.br',
    buyerPhone: '(41) 99911-2233',
    holderName: 'Carlos Eduardo Nogueira',
    holderDocument: '718.992.100-43',
    holderEmail: 'carlos.nogueira@adv.com.br',
    holderPhone: '(41) 99911-2233',
    status: 'ATIVO',
    statusLabelPtBr: 'Ativo para Entrada',
    currentCredentialVersion: 1,
    currentCredentialCode: 'SEC-00010483-V1-9f1e2a',
    transferCount: 0,
    // Comprado há 14 dias (fora do prazo de 7 dias — cancelamento somente via SAC!)
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'TKT-2026-00010484',
    sequentialNumber: '00010484',
    orderId: 'ORD-928374',
    eventId: 1,
    eventName: 'Orquestra Sinfônica — Noite de Clássicos',
    sector: 'Pista Superior',
    lot: '2º Lote',
    modality: 'INTEIRA',
    priceCents: 18000,
    feeCents: 1800,
    currency: 'BRL',
    buyerName: 'Fernanda Martins Costa',
    buyerDocument: '331.442.889-01',
    buyerEmail: 'fernanda.costa@empresa.com',
    buyerPhone: '(41) 98777-6655',
    holderName: 'Fernanda Martins Costa',
    holderDocument: '331.442.889-01',
    holderEmail: 'fernanda.costa@empresa.com',
    holderPhone: '(41) 98777-6655',
    status: 'BLOQUEADO',
    statusLabelPtBr: 'Bloqueado Administrativamente',
    currentCredentialVersion: 1,
    currentCredentialCode: 'SEC-00010484-V1-8c7b6a',
    transferCount: 0,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'TKT-2026-00010485',
    sequentialNumber: '00010485',
    orderId: 'CORT-00010485',
    eventId: 1,
    eventName: 'Orquestra Sinfônica — Noite de Clássicos',
    sector: 'Camarote Lateral B',
    lot: 'Cota Cortesia Produção',
    modality: 'CORTESIA',
    priceCents: 0,
    feeCents: 0,
    currency: 'BRL',
    buyerName: 'Produtora DiskIngressos (Cortesia)',
    buyerDocument: '14.552.890/0001-10',
    buyerEmail: 'cortesias@diskingressos.com.br',
    buyerPhone: '(41) 3315-0000',
    holderName: 'Roberto Almeida Prado (Convidado VIP)',
    holderDocument: '405.812.900-25',
    holderEmail: 'roberto.prado@convidado.com.br',
    holderPhone: '(41) 99654-1122',
    status: 'ATIVO',
    statusLabelPtBr: 'Cortesia Ativa (Cancelável por Suporte Eventos)',
    currentCredentialVersion: 1,
    currentCredentialCode: 'SEC-00010485-V1-cort01',
    transferCount: 0,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'TKT-2026-00010486',
    sequentialNumber: '00010486',
    orderId: 'CORT-00010486',
    eventId: 1,
    eventName: 'Orquestra Sinfônica — Noite de Clássicos',
    sector: 'Plateia Premium A',
    lot: 'Cota Imprensa & Patrocínio',
    modality: 'CORTESIA',
    priceCents: 0,
    feeCents: 0,
    currency: 'BRL',
    buyerName: 'Assessoria de Imprensa (Cortesia)',
    buyerDocument: '14.552.890/0001-10',
    buyerEmail: 'imprensa@diskingressos.com.br',
    buyerPhone: '(41) 3315-0000',
    holderName: 'Camila Vasconcelos (Imprensa)',
    holderDocument: '629.104.338-70',
    holderEmail: 'camila.vasconcelos@midia.com.br',
    holderPhone: '(41) 99123-7890',
    status: 'ATIVO',
    statusLabelPtBr: 'Cortesia Ativa (Cancelável por Suporte Eventos)',
    currentCredentialVersion: 1,
    currentCredentialCode: 'SEC-00010486-V1-cort02',
    transferCount: 0,
    createdAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString()
  }
]

let credentials: MockCredential[] = [
  {
    id: 'CRED-TKT-00010481-V1',
    ticketId: 'TKT-2026-00010481',
    version: 1,
    code: 'SEC-TKT-00010481-V1-1a2b3c',
    qrPayload: 'DI|TKT-2026-00010481|V1|1a2b3c4d5e6f',
    secureHash: 'f4b321a0823901bce471029abde1230192',
    status: 'REVOGADA_TRANSFERENCIA',
    issuedAt: '2026-09-15T14:20:05Z',
    revokedAt: '2026-09-15T15:10:00Z',
    revocationReason: 'Transferência de titularidade para Lucas Fernandes Pereira'
  },
  {
    id: 'CRED-TKT-00010481-V2',
    ticketId: 'TKT-2026-00010481',
    version: 2,
    code: 'SEC-TKT-00010481-V2-7d8a9e',
    qrPayload: 'DI|TKT-2026-00010481|V2|7d8a9ef01234',
    secureHash: 'a8b92019c81726aefd90128390123456789',
    status: 'ATIVA',
    issuedAt: '2026-09-15T15:10:00Z'
  },
  {
    id: 'CRED-TKT-00010482-V1',
    ticketId: 'TKT-2026-00010482',
    version: 1,
    code: 'SEC-TKT-00010482-V1-3b4c5d',
    qrPayload: 'DI|TKT-2026-00010482|V1|3b4c5d6e7f8a',
    secureHash: 'bb928172901293810293810293812093812',
    status: 'CONSUMIDA',
    issuedAt: '2026-09-15T14:20:05Z'
  },
  {
    id: 'CRED-TKT-00010483-V1',
    ticketId: 'TKT-2026-00010483',
    version: 1,
    code: 'SEC-TKT-00010483-V1-9f1e2a',
    qrPayload: 'DI|TKT-2026-00010483|V1|9f1e2a3b4c5d',
    secureHash: 'cc102938475610293847561029384756102',
    status: 'ATIVA',
    issuedAt: '2026-09-15T14:22:10Z'
  },
  {
    id: 'CRED-TKT-00010484-V1',
    ticketId: 'TKT-2026-00010484',
    version: 1,
    code: 'SEC-TKT-00010484-V1-8c7b6a',
    qrPayload: 'DI|TKT-2026-00010484|V1|8c7b6a5d4e3f',
    secureHash: 'dd192837465019283746501928374650192',
    status: 'REVOGADA_CANCELAMENTO',
    issuedAt: '2026-09-15T14:26:00Z',
    revokedAt: '2026-09-15T16:00:00Z',
    revocationReason: 'Bloqueio preventivo pelo operador de segurança'
  },
  {
    id: 'CRED-TKT-00010485-V1',
    ticketId: 'TKT-2026-00010485',
    version: 1,
    code: 'SEC-TKT-00010485-V1-4c9a1b',
    qrPayload: 'DI|TKT-2026-00010485|V1|4c9a1b8e7f6d',
    secureHash: 'ee551928374650192837465019283746501',
    status: 'ATIVA',
    issuedAt: '2026-09-15T14:30:00Z'
  },
  {
    id: 'CRED-TKT-00010486-V1',
    ticketId: 'TKT-2026-00010486',
    version: 1,
    code: 'SEC-TKT-00010486-V1-2d8f3e',
    qrPayload: 'DI|TKT-2026-00010486|V1|2d8f3e9a1c4b',
    secureHash: 'ff661928374650192837465019283746502',
    status: 'ATIVA',
    issuedAt: '2026-09-15T14:35:00Z'
  }
]

let transfers: MockTransfer[] = [
  {
    id: 'TRF-2026-001',
    ticketId: 'TKT-2026-00010481',
    fromHolderName: 'Maria Silva Santos',
    fromHolderDocument: '049.281.938-12',
    fromHolderEmail: 'maria.santos@email.com.br',
    toHolderName: 'Lucas Fernandes Pereira',
    toHolderDocument: '512.981.234-99',
    toHolderEmail: 'lucas.pereira@email.com',
    toHolderPhone: '(41) 99182-3344',
    transferredAt: '2026-09-15T15:10:00Z',
    transferredBy: 'COMPRADOR',
    oldCredentialVersion: 1,
    newCredentialVersion: 2,
    notes: 'Transferência solicitada via aplicativo pelo comprador titular'
  }
]

// Portões e Dispositivos de Acesso
let gates = [
  {
    id: 'GATE-SUL-01',
    eventId: 1,
    name: 'Portão Sul (Principal)',
    location: 'Acesso Avenidas Silva Jardim × Marechal Floriano',
    sectorsAllowed: ['Plateia Premium A', 'Camarote Lateral B', 'Pista Superior'],
    status: 'ONLINE',
    activeDevicesCount: 6,
    totalEntriesCount: 1420,
    entriesLastHour: 380
  },
  {
    id: 'GATE-NORTE-02',
    eventId: 1,
    name: 'Portão Norte (VIP & Acessibilidade)',
    location: 'Acesso Rua Engenheiros Rebouças',
    sectorsAllowed: ['Plateia Premium A', 'Camarote Lateral B'],
    status: 'ONLINE',
    activeDevicesCount: 3,
    totalEntriesCount: 640,
    entriesLastHour: 195
  },
  {
    id: 'GATE-LESTE-03',
    eventId: 1,
    name: 'Portão Leste (Pista Superior & Promocional)',
    location: 'Acesso Praça Afonso Camargo',
    sectorsAllowed: ['Pista Superior'],
    status: 'ONLINE',
    activeDevicesCount: 4,
    totalEntriesCount: 890,
    entriesLastHour: 230
  }
]

let devices = [
  {
    id: 'DEV-COL-01',
    gateId: 'GATE-SUL-01',
    gateName: 'Portão Sul (Principal)',
    name: 'Coletor Android Portaria 01',
    deviceType: 'COLETOR_ANDROID',
    operatorId: 'OP-401',
    operatorName: 'Juliana Castro',
    batteryLevel: 94,
    isCharging: false,
    syncStatus: 'SINCRONIZADO',
    cachedTicketsCount: 4800,
    pendingValidationsCount: 0,
    lastHeartbeat: new Date().toISOString()
  },
  {
    id: 'DEV-CAT-02',
    gateId: 'GATE-SUL-01',
    gateName: 'Portão Sul (Principal)',
    name: 'Catraca Ótica Automatizada 02',
    deviceType: 'CATRACA_ELETRONICA',
    operatorId: 'OP-SYS-AUTO',
    operatorName: 'Controle de Acesso Automático',
    batteryLevel: 100,
    isCharging: true,
    syncStatus: 'SINCRONIZADO',
    cachedTicketsCount: 4800,
    pendingValidationsCount: 0,
    lastHeartbeat: new Date().toISOString()
  },
  {
    id: 'DEV-APP-03',
    gateId: 'GATE-NORTE-02',
    gateName: 'Portão Norte (VIP & Acessibilidade)',
    name: 'Disk Acesso Móvel VIP 01',
    deviceType: 'APP_DISK_ACESSO',
    operatorId: 'OP-502',
    operatorName: 'Rodrigo Medeiros (Supervisor)',
    batteryLevel: 78,
    isCharging: false,
    syncStatus: 'SINCRONIZADO',
    cachedTicketsCount: 4800,
    pendingValidationsCount: 0,
    lastHeartbeat: new Date().toISOString()
  }
]

let validationLogs = [
  {
    id: 'VAL-99120',
    ticketId: 'TKT-2026-00010482',
    credentialVersion: 1,
    credentialCode: 'SEC-TKT-00010482-V1-3b4c5d',
    holderName: 'Maria Silva Santos',
    sector: 'Plateia Premium A',
    gateId: 'GATE-SUL-01',
    gateName: 'Portão Sul (Principal)',
    deviceId: 'DEV-CAT-02',
    operatorName: 'Catraca Ótica Automatizada 02',
    result: 'PERMITIDO',
    resultMessage: 'Entrada autorizada com sucesso',
    validatedAt: '2026-09-15T17:45:12Z',
    isOffline: false
  }
]

let conflicts: any[] = [
  {
    id: 'CONF-001',
    ticketId: 'TKT-2026-00010481',
    holderName: 'Lucas Fernandes Pereira',
    sector: 'Plateia Premium A',
    reason: 'VERSAO_ANTERIOR_APRESENTADA',
    reasonLabelPtBr: 'Credencial Revogada (Tentativa de usar versão v1 após transferência)',
    status: 'RESOLVIDO_BARRADO',
    firstEntry: {
      gateName: 'Portão Sul',
      deviceName: 'Coletor 01',
      operatorName: 'Juliana Castro',
      at: '2026-09-15T17:30:00Z'
    },
    conflictAttempt: {
      gateName: 'Portão Sul',
      deviceName: 'Coletor 02',
      operatorName: 'Juliana Castro',
      at: '2026-09-15T17:30:15Z'
    },
    resolutionNotes: 'Portador da credencial v1 antiga foi orientado a procurar o titular com a versão v2 ativa.',
    resolvedAt: '2026-09-15T17:32:00Z',
    resolvedBy: 'Rodrigo Medeiros (Supervisor)'
  }
]

function findTicketIndexByIdOrSequential(idOrSeq: string | string[] | undefined): number {
  const raw = Array.isArray(idOrSeq) ? idOrSeq[0] : idOrSeq || ''
  const clean = String(raw).trim()
  return tickets.findIndex(
    t => t.id.toLowerCase() === clean.toLowerCase() || t.sequentialNumber === clean
  )
}

// ----------------------------------------------------------------------------
// ENDPOINTS DE INGRESSOS
// ----------------------------------------------------------------------------

// 1. Listar / Consultar Ingressos (com Governança de CPF e Consulta Universal por 8 Dígitos)
ticketsAccessRouter.get('/', (req: Request, res: Response) => {
  const { q, eventId, status, sector, modality, department: rawDept } = req.query
  const department = String(rawDept || 'SAC').toUpperCase()
  let result = [...tickets]

  if (eventId) {
    result = result.filter(t => t.eventId === Number(eventId))
  }
  if (status && status !== 'TODOS') {
    result = result.filter(t => t.status === status)
  }
  if (sector && sector !== 'TODOS') {
    result = result.filter(t => t.sector === sector)
  }
  if (modality && modality !== 'TODOS') {
    result = result.filter(t => t.modality === modality)
  }

  if (q && typeof q === 'string' && q.trim().length > 0) {
    const cleanQ = q.trim()
    // Regra de Governança: Consulta por CPF restrita exclusivamente aos setores SAC, ESTORNO e FINANCEIRO
    if (isCpfSearchTerm(cleanQ) && !canDepartmentConsultCpf(department)) {
      return res.status(403).json({
        success: false,
        code: 'CPF_RESTRICTED',
        error: 'Consulta por CPF é restrita exclusivamente aos setores de SAC, Estorno e Financeiro. Utilize o número sequencial de 8 dígitos do ingresso.'
      })
    }

    const s = cleanQ.toLowerCase()
    const digitsOnly = cleanQ.replace(/\D/g, '')
    const cpfAllowed = canDepartmentConsultCpf(department)

    result = result.filter(t => {
      const matchSeq =
        t.sequentialNumber.includes(cleanQ) ||
        (digitsOnly.length > 0 && digitsOnly.length <= 8 && t.sequentialNumber.includes(digitsOnly))
      const matchBasic =
        matchSeq ||
        t.id.toLowerCase().includes(s) ||
        t.orderId.toLowerCase().includes(s) ||
        t.holderName.toLowerCase().includes(s) ||
        t.buyerName.toLowerCase().includes(s) ||
        t.currentCredentialCode.toLowerCase().includes(s)

      if (matchBasic) return true

      if (cpfAllowed) {
        const holderDigits = t.holderDocument.replace(/\D/g, '')
        const buyerDigits = t.buyerDocument.replace(/\D/g, '')
        return (
          t.holderDocument.toLowerCase().includes(s) ||
          t.buyerDocument.toLowerCase().includes(s) ||
          (digitsOnly.length >= 3 && (holderDigits.includes(digitsOnly) || buyerDigits.includes(digitsOnly)))
        )
      }
      return false
    })
  }

  const enriched = result.map(t => enrichTicketWithGovernance(t, department))

  res.json({
    success: true,
    department,
    cpfLookupAllowed: canDepartmentConsultCpf(department),
    total: enriched.length,
    data: enriched
  })
})

// 1B. Emitir Novo Ingresso / Cortesia com Número Sequencial de 8 Dígitos Numéricos
ticketsAccessRouter.post('/issue', (req: Request, res: Response) => {
  const {
    eventId = 1,
    eventName = 'Festival Sinfônico de Inverno 2026',
    sector = 'Plateia Premium A',
    seat = 'Sem Lugar Marcado',
    modality = 'INTEIRA',
    pricePaid,
    buyerName = 'Cliente Bilheteria SafeSaff',
    buyerDocument = '318.492.104-55',
    buyerEmail = 'cliente@safesaff.com.br',
    holderName,
    holderDocument,
    holderEmail,
    holderPhone = '(41) 99811-2200'
  } = req.body || {}

  const seqNum = nextSequentialTicketNumber()
  const ticketId = `TKT-2026-${seqNum}`
  const isCortesia = modality === 'CORTESIA'
  const modalityLabels: Record<string, string> = {
    INTEIRA: 'Inteira Lote Atual',
    MEIA_ENTRADA: 'Meia-Entrada Legal',
    SOLIDARIO: 'Ingresso Solidário',
    CORTESIA: 'Cortesia Produção / Suporte de Eventos',
    PROMO: 'Promocional Clube Disk'
  }
  const randomSalt = crypto.randomBytes(3).toString('hex')
  const credCode = `SEC-TKT-${seqNum}-V1-${randomSalt}`
  const nowIso = new Date().toISOString()

  const priceCentsVal = isCortesia ? 0 : Math.round(Number(pricePaid ?? 340) * 100)
  const newTicket: MockTicket = {
    id: ticketId,
    sequentialNumber: seqNum,
    orderId: isCortesia ? `CORT-2026-${seqNum.slice(-4)}` : `PED-2026-${seqNum.slice(-6)}`,
    eventId: Number(eventId),
    eventName,
    sector,
    seat,
    lot: isCortesia ? 'Cota Cortesia Eventos' : 'Lote Vigente',
    modality,
    modalityLabel: modalityLabels[modality] || 'Inteira',
    priceCents: priceCentsVal,
    feeCents: isCortesia ? 0 : Math.round(priceCentsVal * 0.1),
    currency: 'BRL',
    buyerName,
    buyerDocument,
    buyerEmail,
    buyerPhone: holderPhone,
    holderName: holderName || buyerName,
    holderDocument: holderDocument || buyerDocument,
    holderEmail: holderEmail || buyerEmail,
    holderPhone,
    status: 'ATIVO',
    statusLabelPtBr: isCortesia ? 'Ativo para Entrada (Cortesia)' : 'Ativo para Entrada',
    currentCredentialVersion: 1,
    currentCredentialCode: credCode,
    transferCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso
  }

  tickets.unshift(newTicket)

  const newCred: MockCredential = {
    id: `CRED-TKT-${seqNum}-V1`,
    ticketId,
    version: 1,
    code: credCode,
    qrPayload: `DI|${ticketId}|V1|${crypto.randomBytes(6).toString('hex')}`,
    secureHash: crypto.createHash('sha256').update(credCode).digest('hex'),
    status: 'ATIVA',
    issuedAt: nowIso
  }
  credentials.push(newCred)

  res.status(201).json({
    success: true,
    message: `Ingresso #${seqNum} (${newTicket.modalityLabel}) emitido com número sequencial de 8 dígitos.`,
    ticket: enrichTicketWithGovernance(newTicket, 'SAC'),
    credential: newCred
  })
})

// 2. Detalhes do Ingresso (por ID ou Número Sequencial de 8 Dígitos) + Histórico
ticketsAccessRouter.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  const department = String(req.query.department || 'SAC').toUpperCase()
  if (id === 'access') return next()

  const ticketIndex = findTicketIndexByIdOrSequential(id)
  if (ticketIndex === -1) {
    return res.status(404).json({ success: false, error: 'Ingresso não encontrado.' })
  }

  const ticket = tickets[ticketIndex]
  const ticketCredentials = credentials.filter(c => c.ticketId === ticket.id)
  const ticketTransfers = transfers.filter(t => t.ticketId === ticket.id)

  res.json({
    success: true,
    ticket: enrichTicketWithGovernance(ticket, department),
    credentials: ticketCredentials,
    transfers: ticketTransfers
  })
})

// 3. Transferir Titularidade (Comprador ≠ Titular + Revoga v(N) e Ativa v(N+1))
ticketsAccessRouter.post('/:id/transfer', (req: Request, res: Response) => {
  const { id } = req.params
  const { newHolderName, newHolderDocument, newHolderEmail, newHolderPhone, transferredBy, notes } = req.body

  if (!newHolderName || !newHolderDocument || !newHolderEmail) {
    return res.status(400).json({
      success: false,
      error: 'Nome, CPF e e-mail do novo titular são obrigatórios para transferência.'
    })
  }

  const ticketIndex = findTicketIndexByIdOrSequential(id)
  if (ticketIndex === -1) {
    return res.status(404).json({ success: false, error: 'Ingresso não encontrado.' })
  }

  const ticket = tickets[ticketIndex]
  if (ticket.status === 'UTILIZADO') {
    return res.status(400).json({
      success: false,
      error: 'Não é possível transferir um ingresso que já realizou check-in no evento.'
    })
  }
  if (ticket.status === 'CANCELADO' || ticket.status === 'BLOQUEADO') {
    return res.status(400).json({
      success: false,
      error: `Ingresso com status ${ticket.status} não pode ser transferido.`
    })
  }

  // Revoga a credencial ativa anterior
  const previousVersion = ticket.currentCredentialVersion
  const activeCred = credentials.find(c => c.ticketId === ticket.id && c.status === 'ATIVA')
  if (activeCred) {
    activeCred.status = 'REVOGADA_TRANSFERENCIA'
    activeCred.revokedAt = new Date().toISOString()
    activeCred.revocationReason = `Transferência de titularidade para ${newHolderName} (${newHolderDocument})`
  }

  // Emite nova versão v(N+1)
  const nextVersion = previousVersion + 1
  const randomSalt = crypto.randomBytes(3).toString('hex')
  const newCredentialCode = `SEC-TKT-${ticket.sequentialNumber}-V${nextVersion}-${randomSalt}`
  const newQrPayload = `DI|${ticket.id}|V${nextVersion}|${crypto.randomBytes(6).toString('hex')}`

  const newCredential: MockCredential = {
    id: `CRED-TKT-${ticket.sequentialNumber}-V${nextVersion}`,
    ticketId: ticket.id,
    version: nextVersion,
    code: newCredentialCode,
    qrPayload: newQrPayload,
    secureHash: crypto.createHash('sha256').update(newCredentialCode).digest('hex'),
    status: 'ATIVA',
    issuedAt: new Date().toISOString()
  }
  credentials.push(newCredential)

  // Registra no histórico de transferências
  const transferRecord: MockTransfer = {
    id: `TRF-${Date.now().toString().slice(-6)}`,
    ticketId: ticket.id,
    fromHolderName: ticket.holderName,
    fromHolderDocument: ticket.holderDocument,
    fromHolderEmail: ticket.holderEmail,
    toHolderName: newHolderName,
    toHolderDocument: newHolderDocument,
    toHolderEmail: newHolderEmail,
    toHolderPhone: newHolderPhone || '',
    transferredAt: new Date().toISOString(),
    transferredBy: transferredBy || 'OPERADOR_SAC',
    oldCredentialVersion: previousVersion,
    newCredentialVersion: nextVersion,
    notes: notes || 'Transferência realizada com auditoria Disk Core.'
  }
  transfers.push(transferRecord)

  // Atualiza o registro do ingresso
  tickets[ticketIndex] = {
    ...ticket,
    holderName: newHolderName,
    holderDocument: newHolderDocument,
    holderEmail: newHolderEmail,
    holderPhone: newHolderPhone || ticket.holderPhone,
    status: 'ATIVO',
    statusLabelPtBr: 'Ativo para Entrada',
    currentCredentialVersion: nextVersion,
    currentCredentialCode: newCredentialCode,
    transferCount: ticket.transferCount + 1,
    updatedAt: new Date().toISOString()
  }

  res.json({
    success: true,
    message: 'Titularidade transferida com sucesso. Nova credencial gerada e versão anterior revogada.',
    ticket: enrichTicketWithGovernance(tickets[ticketIndex], 'SAC'),
    newCredential,
    transfer: transferRecord
  })
})

// 4. Reemissão Segura Antifraude (Invalida v(N) e Emite v(N+1) mantendo titular)
ticketsAccessRouter.post('/:id/reissue', (req: Request, res: Response) => {
  const { id } = req.params
  const { reason } = req.body

  const ticketIndex = findTicketIndexByIdOrSequential(id)
  if (ticketIndex === -1) {
    return res.status(404).json({ success: false, error: 'Ingresso não encontrado.' })
  }

  const ticket = tickets[ticketIndex]
  if (ticket.status === 'UTILIZADO') {
    return res.status(400).json({
      success: false,
      error: 'Ingresso já utilizado não pode ser reemitido.'
    })
  }

  // Revoga a credencial anterior
  const previousVersion = ticket.currentCredentialVersion
  const activeCred = credentials.find(c => c.ticketId === ticket.id && c.status === 'ATIVA')
  if (activeCred) {
    activeCred.status = 'REVOGADA_REEMISSAO'
    activeCred.revokedAt = new Date().toISOString()
    activeCred.revocationReason = reason || 'Reemissão preventiva antifraude solicitada pelo operador.'
  }

  // Emite nova versão v(N+1)
  const nextVersion = previousVersion + 1
  const randomSalt = crypto.randomBytes(3).toString('hex')
  const newCredentialCode = `SEC-TKT-${ticket.sequentialNumber}-V${nextVersion}-${randomSalt}`
  const newQrPayload = `DI|${ticket.id}|V${nextVersion}|${crypto.randomBytes(6).toString('hex')}`

  const newCredential: MockCredential = {
    id: `CRED-TKT-${ticket.sequentialNumber}-V${nextVersion}`,
    ticketId: ticket.id,
    version: nextVersion,
    code: newCredentialCode,
    qrPayload: newQrPayload,
    secureHash: crypto.createHash('sha256').update(newCredentialCode).digest('hex'),
    status: 'ATIVA',
    issuedAt: new Date().toISOString()
  }
  credentials.push(newCredential)

  tickets[ticketIndex] = {
    ...ticket,
    status: 'ATIVO',
    statusLabelPtBr: 'Ativo para Entrada (Reemitido)',
    currentCredentialVersion: nextVersion,
    currentCredentialCode: newCredentialCode,
    updatedAt: new Date().toISOString()
  }

  res.json({
    success: true,
    message: 'Ingresso reemitido com sucesso. QR Code anterior foi revogado e não permitirá entrada.',
    ticket: enrichTicketWithGovernance(tickets[ticketIndex], 'SAC'),
    newCredential
  })
})

// 5. Bloquear / Cancelar Ingresso com Regras de Governança (7 Dias CDC, SAC e Suporte de Eventos p/ Cortesia)
function handleBlockOrCancelTicket(req: Request, res: Response) {
  const { id } = req.params
  const { reason, action = 'CANCELAR', department: rawDept, sacProtocol } = req.body || {}
  const department = String(rawDept || 'SAC').toUpperCase()

  const ticketIndex = findTicketIndexByIdOrSequential(id)
  if (ticketIndex === -1) {
    return res.status(404).json({ success: false, error: 'Ingresso não encontrado.' })
  }

  const ticket = tickets[ticketIndex]
  const daysSincePurchase = computeDaysSincePurchase(ticket.createdAt)
  const within7DaysWindow = daysSincePurchase <= 7

  if (action === 'CANCELAR') {
    // Regra 1: Suporte de Eventos pode cancelar CORTESIA, mas NÃO ingresso de cliente
    if (department === 'SUPORTE_EVENTOS') {
      if (ticket.modality !== 'CORTESIA') {
        return res.status(403).json({
          success: false,
          code: 'EVENT_SUPPORT_ONLY_COURTESY',
          error: 'O Suporte de Eventos possui permissão apenas para cancelar ingressos de CORTESIA. Ingressos de clientes pagos só podem ser cancelados pelo cliente (em até 7 dias) ou via atendimento do SAC.'
        })
      }
    }

    // Regra 2: Cliente tem prazo de 7 dias após a compra; após 7 dias somente via atendimento do SAC
    if (department === 'CLIENTE') {
      if (ticket.modality === 'CORTESIA') {
        return res.status(403).json({
          success: false,
          code: 'COURTESY_CANCEL_RESTRICTED',
          error: 'Ingressos de cortesia devem ser cancelados pelo Suporte de Eventos ou SAC.'
        })
      }
      if (!within7DaysWindow) {
        return res.status(403).json({
          success: false,
          code: 'WINDOW_7_DAYS_EXPIRED_SAC_ONLY',
          daysSincePurchase,
          error: `Prazo de 7 dias após a compra encerrado (${daysSincePurchase} dias corridos). Após 7 dias, o cancelamento somente é permitido via atendimento do SAC.`
        })
      }
    }
  }

  const newStatus = action === 'CANCELAR' ? 'CANCELADO' : 'BLOQUEADO'
  const originLabel =
    department === 'SUPORTE_EVENTOS'
      ? 'Suporte de Eventos (Cortesia)'
      : department === 'CLIENTE'
        ? 'Autoatendimento Cliente (Prazo 7 Dias)'
        : `Atendimento ${department}${sacProtocol ? ` [${sacProtocol}]` : ''}`

  const newLabel =
    action === 'CANCELAR'
      ? `Cancelado — ${originLabel}`
      : `Bloqueado Administrativamente (${originLabel})`

  // Revoga credencial ativa
  const activeCred = credentials.find(c => c.ticketId === ticket.id && c.status === 'ATIVA')
  if (activeCred) {
    activeCred.status = 'REVOGADA_CANCELAMENTO'
    activeCred.revokedAt = new Date().toISOString()
    activeCred.revocationReason = reason || `${newLabel}.`
  }

  tickets[ticketIndex] = {
    ...ticket,
    status: newStatus,
    statusLabelPtBr: newLabel,
    canceledByDepartment: action === 'CANCELAR' ? department : ticket.canceledByDepartment,
    cancellationReason: action === 'CANCELAR' ? (reason || newLabel) : ticket.cancellationReason,
    sacProtocol: sacProtocol || ticket.sacProtocol,
    updatedAt: new Date().toISOString()
  }

  return res.json({
    success: true,
    message: `Ingresso #${ticket.sequentialNumber} ${newStatus.toLowerCase()} com sucesso via ${originLabel}. Credencial QR revogada imediatamente.`,
    ticket: enrichTicketWithGovernance(tickets[ticketIndex], department)
  })
}

ticketsAccessRouter.post('/:id/block', handleBlockOrCancelTicket)
ticketsAccessRouter.post('/:id/cancel', handleBlockOrCancelTicket)

// ----------------------------------------------------------------------------
// ENDPOINTS DO CONTROLE DE ACESSO (DISK ACESSO)
// ----------------------------------------------------------------------------

// 6. Resumo Executivo de Controle de Acesso
ticketsAccessRouter.get('/access/summary', (req: Request, res: Response) => {
  const total = tickets.length
  const active = tickets.filter(t => t.status === 'ATIVO' || t.status === 'REEMITIDO').length
  const used = tickets.filter(t => t.status === 'UTILIZADO').length
  const transferred = tickets.filter(t => t.transferCount > 0).length
  const reissued = credentials.filter(c => c.status === 'REVOGADA_REEMISSAO').length
  const blocked = tickets.filter(t => t.status === 'BLOQUEADO' || t.status === 'CANCELADO').length
  const activeConflicts = conflicts.filter(c => c.status === 'PENDENTE').length

  res.json({
    success: true,
    summary: {
      totalTickets: total,
      activeTickets: active,
      usedTickets: used,
      reissuedTickets: reissued,
      transferredTickets: transferred,
      blockedTickets: blocked,
      checkinPercentage: total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0,
      liveGatesOnline: gates.filter(g => g.status === 'ONLINE').length,
      devicesConnected: devices.length,
      activeConflictsCount: activeConflicts
    }
  })
})

// 7. Listar Portões
ticketsAccessRouter.get('/access/gates', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: gates
  })
})

// 8. Listar Dispositivos (Coletores e Catracas)
ticketsAccessRouter.get('/access/devices', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: devices
  })
})

// 9. Histórico de Validações
ticketsAccessRouter.get('/access/validations', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: validationLogs.slice().reverse()
  })
})

// 10. Central de Conflitos
ticketsAccessRouter.get('/access/conflicts', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: conflicts
  })
})

// 11. Resolver Conflito de Acesso
ticketsAccessRouter.post('/access/conflicts/:id/resolve', (req: Request, res: Response) => {
  const { id } = req.params
  const { resolution, notes, resolvedBy } = req.body // resolution: 'RESOLVIDO_ACESSO_CONFIRMADO' | 'RESOLVIDO_BARRADO'

  const confIndex = conflicts.findIndex(c => c.id === id)
  if (confIndex === -1) {
    return res.status(404).json({ success: false, error: 'Conflito não encontrado.' })
  }

  conflicts[confIndex] = {
    ...conflicts[confIndex],
    status: resolution || 'RESOLVIDO_BARRADO',
    resolutionNotes: notes || 'Conflito resolvido pela supervisão de portaria.',
    resolvedAt: new Date().toISOString(),
    resolvedBy: resolvedBy || 'Supervisor de Portaria'
  }

  res.json({
    success: true,
    message: 'Conflito de acesso atualizado com sucesso.',
    conflict: conflicts[confIndex]
  })
})

// 12. Validador Ótico de Acesso (Simulação da Catraca / App Disk Acesso)
ticketsAccessRouter.post('/access/validate', (req: Request, res: Response) => {
  const {
    credentialCode,
    gateId,
    deviceId,
    operatorName,
    isOffline,
    supervisorOverride,
    overrideReason
  } = req.body

  if (!credentialCode) {
    return res.status(400).json({ success: false, error: 'Código de validação é obrigatório.' })
  }

  const gate = gates.find(g => g.id === gateId) || gates[0]
  const device = devices.find(d => d.id === deviceId) || devices[0]
  const opName = operatorName || device.operatorName

  // Busca a credencial correspondente
  const cred = credentials.find(c => c.code === credentialCode || c.qrPayload.includes(credentialCode))

  if (!cred) {
    const logEntry = {
      id: `VAL-${Date.now().toString().slice(-6)}`,
      ticketId: 'DESCONHECIDO',
      credentialVersion: 0,
      credentialCode,
      holderName: 'Não Identificado',
      sector: 'Indefinido',
      gateId: gate.id,
      gateName: gate.name,
      deviceId: device.id,
      operatorName: opName,
      result: 'REVOGADO' as const,
      resultMessage: 'Código QR não reconhecido pela base de dados do Disk Core.',
      validatedAt: new Date().toISOString(),
      isOffline: Boolean(isOffline)
    }
    validationLogs.push(logEntry)
    return res.json({
      success: false,
      result: 'REVOGADO',
      message: 'Código de validação inválido ou não encontrado.',
      log: logEntry
    })
  }

  const ticketIndex = tickets.findIndex(t => t.id === cred.ticketId)
  if (ticketIndex === -1) {
    return res.status(404).json({ success: false, error: 'Ingresso correspondente não existe.' })
  }
  const ticket = tickets[ticketIndex]

  // Supervisor Override
  if (supervisorOverride) {
    const logEntry = {
      id: `VAL-${Date.now().toString().slice(-6)}`,
      ticketId: ticket.id,
      credentialVersion: cred.version,
      credentialCode: cred.code,
      holderName: ticket.holderName,
      sector: ticket.sector,
      gateId: gate.id,
      gateName: gate.name,
      deviceId: device.id,
      operatorName: opName,
      result: 'OVERRIDE_SUPERVISOR' as const,
      resultMessage: `Liberação manual autorizada pelo supervisor. Justificativa: ${overrideReason || 'Liberação direta em catraca'}`,
      validatedAt: new Date().toISOString(),
      isOffline: Boolean(isOffline),
      supervisorOverrideReason: overrideReason || 'Liberação manual pelo supervisor'
    }
    validationLogs.push(logEntry)

    tickets[ticketIndex] = {
      ...ticket,
      status: 'UTILIZADO',
      statusLabelPtBr: 'Check-in Realizado (Override)',
      checkInAt: new Date().toISOString(),
      checkInGate: gate.name,
      checkInDevice: device.name,
      checkInOperator: opName,
      updatedAt: new Date().toISOString()
    }

    return res.json({
      success: true,
      result: 'OVERRIDE_SUPERVISOR',
      message: 'Entrada autorizada via Override de Supervisor.',
      ticket: tickets[ticketIndex],
      log: logEntry
    })
  }

  // Validação: Credencial Revogada
  if (cred.status !== 'ATIVA') {
    const logEntry = {
      id: `VAL-${Date.now().toString().slice(-6)}`,
      ticketId: ticket.id,
      credentialVersion: cred.version,
      credentialCode: cred.code,
      holderName: ticket.holderName,
      sector: ticket.sector,
      gateId: gate.id,
      gateName: gate.name,
      deviceId: device.id,
      operatorName: opName,
      result: 'REVOGADO' as const,
      resultMessage: `Credencial revogada (${cred.status}). Motivo: ${cred.revocationReason || 'Versão substituída'}`,
      validatedAt: new Date().toISOString(),
      isOffline: Boolean(isOffline)
    }
    validationLogs.push(logEntry)

    // Cria conflito para análise de portaria se for versão anterior
    if (cred.version < ticket.currentCredentialVersion) {
      conflicts.push({
        id: `CONF-${Date.now().toString().slice(-6)}`,
        ticketId: ticket.id,
        holderName: ticket.holderName,
        sector: ticket.sector,
        reason: 'VERSAO_ANTERIOR_APRESENTADA',
        reasonLabelPtBr: `Apresentada versão v${cred.version}, mas versão ativa é v${ticket.currentCredentialVersion}`,
        status: 'PENDENTE',
        firstEntry: {
          gateName: gate.name,
          deviceName: device.name,
          operatorName: opName,
          at: new Date().toISOString()
        },
        conflictAttempt: {
          gateName: gate.name,
          deviceName: device.name,
          operatorName: opName,
          at: new Date().toISOString()
        }
      })
    }

    return res.json({
      success: false,
      result: 'REVOGADO',
      message: `Acesso negado: Credencial Revogada (versão v${cred.version}). A versão ativa é a v${ticket.currentCredentialVersion}.`,
      log: logEntry
    })
  }

  // Validação: Ingresso Cancelado ou Bloqueado
  if (ticket.status === 'BLOQUEADO' || ticket.status === 'CANCELADO') {
    const logEntry = {
      id: `VAL-${Date.now().toString().slice(-6)}`,
      ticketId: ticket.id,
      credentialVersion: cred.version,
      credentialCode: cred.code,
      holderName: ticket.holderName,
      sector: ticket.sector,
      gateId: gate.id,
      gateName: gate.name,
      deviceId: device.id,
      operatorName: opName,
      result: 'CANCELADO' as const,
      resultMessage: `Ingresso com status ${ticket.status} no Disk Core. Entrada bloqueada.`,
      validatedAt: new Date().toISOString(),
      isOffline: Boolean(isOffline)
    }
    validationLogs.push(logEntry)

    return res.json({
      success: false,
      result: 'CANCELADO',
      message: `Acesso negado: Ingresso bloqueado ou cancelado (${ticket.statusLabelPtBr}).`,
      log: logEntry
    })
  }

  // Validação: Ingresso Já Utilizado (Dupla Entrada)
  if (ticket.status === 'UTILIZADO') {
    const logEntry = {
      id: `VAL-${Date.now().toString().slice(-6)}`,
      ticketId: ticket.id,
      credentialVersion: cred.version,
      credentialCode: cred.code,
      holderName: ticket.holderName,
      sector: ticket.sector,
      gateId: gate.id,
      gateName: gate.name,
      deviceId: device.id,
      operatorName: opName,
      result: 'DUPLICADO' as const,
      resultMessage: `Tentativa de reuso. Ingresso já utilizado em ${ticket.checkInAt} no ${ticket.checkInGate}.`,
      validatedAt: new Date().toISOString(),
      isOffline: Boolean(isOffline)
    }
    validationLogs.push(logEntry)

    // Cria conflito na central de conflitos
    conflicts.push({
      id: `CONF-${Date.now().toString().slice(-6)}`,
      ticketId: ticket.id,
      holderName: ticket.holderName,
      sector: ticket.sector,
      reason: 'DUPLA_ENTRADA_MESMO_INGRESSO',
      reasonLabelPtBr: 'Tentativa de reuso de ingresso já validado anteriormente',
      status: 'PENDENTE',
      firstEntry: {
        gateName: ticket.checkInGate || 'Portão Anterior',
        deviceName: ticket.checkInDevice || 'Catraca',
        operatorName: ticket.checkInOperator || 'Operador',
        at: ticket.checkInAt || 'Horário anterior'
      },
      conflictAttempt: {
        gateName: gate.name,
        deviceName: device.name,
        operatorName: opName,
        at: new Date().toISOString()
      }
    })

    return res.json({
      success: false,
      result: 'DUPLICADO',
      message: `Alerta de Duplicidade: Ingresso já deu entrada em ${ticket.checkInAt} no ${ticket.checkInGate}!`,
      log: logEntry
    })
  }

  // Validação: Setor do Portão
  if (!gate.sectorsAllowed.includes(ticket.sector)) {
    const logEntry = {
      id: `VAL-${Date.now().toString().slice(-6)}`,
      ticketId: ticket.id,
      credentialVersion: cred.version,
      credentialCode: cred.code,
      holderName: ticket.holderName,
      sector: ticket.sector,
      gateId: gate.id,
      gateName: gate.name,
      deviceId: device.id,
      operatorName: opName,
      result: 'SETOR_INVALIDO' as const,
      resultMessage: `Portão incorreto para o setor "${ticket.sector}". Portões autorizados: ${gate.sectorsAllowed.join(', ')}`,
      validatedAt: new Date().toISOString(),
      isOffline: Boolean(isOffline)
    }
    validationLogs.push(logEntry)

    return res.json({
      success: false,
      result: 'SETOR_INVALIDO',
      message: `Acesso não permitido neste portão. O setor do ingresso é "${ticket.sector}".`,
      log: logEntry
    })
  }

  // Sucesso: Validação Autorizada
  cred.status = 'CONSUMIDA'
  tickets[ticketIndex] = {
    ...ticket,
    status: 'UTILIZADO',
    statusLabelPtBr: 'Check-in Realizado',
    checkInAt: new Date().toISOString(),
    checkInGate: gate.name,
    checkInDevice: device.name,
    checkInOperator: opName,
    updatedAt: new Date().toISOString()
  }

  const logEntry = {
    id: `VAL-${Date.now().toString().slice(-6)}`,
    ticketId: ticket.id,
    credentialVersion: cred.version,
    credentialCode: cred.code,
    holderName: ticket.holderName,
    sector: ticket.sector,
    gateId: gate.id,
    gateName: gate.name,
    deviceId: device.id,
    operatorName: opName,
    result: 'PERMITIDO' as const,
    resultMessage: 'Validação ótica confirmada. Catraca liberada.',
    validatedAt: new Date().toISOString(),
    isOffline: Boolean(isOffline)
  }
  validationLogs.push(logEntry)

  // Incrementa contadores
  gate.totalEntriesCount += 1
  gate.entriesLastHour += 1

  res.json({
    success: true,
    result: 'PERMITIDO',
    message: `Acesso Liberado! Bem-vindo(a), ${ticket.holderName}.`,
    ticket: tickets[ticketIndex],
    log: logEntry
  })
})
