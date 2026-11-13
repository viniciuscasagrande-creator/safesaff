import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  Grid,
  Layers,
  Lock,
  MapPin,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  ScanFace,
  Settings2,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trash2,
  Users,
  Wallet,
  Zap
} from 'lucide-react'
import type {
  BatchTurnTrigger,
  EventItem,
  EventOperationalRules,
  EventPaymentConfig,
  EventScheduledLot,
  EventSeatingMapConfig,
  EventSeatingSector,
  EventStatus,
  EventTicketModality
} from '../data/events'

type Props = {
  mode: 'new' | 'edit'
  event?: EventItem | null
  onCancel: () => void
  onSave: (event: EventItem) => void
}

const CARD_BRANDS_CATALOG = [
  { id: 'visa', name: 'Visa', badge: 'VISA', tone: 'bg-blue-600 text-white', supportsDebit: true },
  { id: 'mastercard', name: 'Mastercard', badge: 'MC', tone: 'bg-amber-600 text-white', supportsDebit: true },
  { id: 'elo', name: 'Elo', badge: 'ELO', tone: 'bg-slate-900 text-amber-400', supportsDebit: true },
  { id: 'amex', name: 'American Express', badge: 'AMEX', tone: 'bg-sky-600 text-white', supportsDebit: false },
  { id: 'hipercard', name: 'Hipercard', badge: 'HIPER', tone: 'bg-rose-700 text-white', supportsDebit: false },
  { id: 'diners', name: 'Diners Club', badge: 'DINERS', tone: 'bg-indigo-700 text-white', supportsDebit: false },
  { id: 'cabal', name: 'Cabal', badge: 'CABAL', tone: 'bg-emerald-700 text-white', supportsDebit: true }
]

const GATEWAYS_CATALOG = [
  {
    id: 'pagarme',
    name: 'Pagar.me (Stone Co.)',
    tag: 'Recomendado • Split Nativo',
    feeInfo: 'Crédito 2,89% • PIX 0,79%',
    supports: ['PIX', 'Crédito 12x', 'Débito', 'Split Automático']
  },
  {
    id: 'asaas',
    name: 'Asaas Pagamentos',
    tag: 'Especialista PIX & Antecipação',
    feeInfo: 'PIX R$ 0,99 • Crédito 2,99%',
    supports: ['PIX Instantâneo', 'Crédito 12x', 'Boleto', 'Antecipação']
  },
  {
    id: 'stripe',
    name: 'Stripe Brasil',
    tag: 'Global • Apple Pay & Google Pay',
    feeInfo: 'Cartões Nacionais e Internacionais',
    supports: ['Crédito 12x', 'Débito', 'Carteiras Digitais', '3DS 2.0']
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago Pro',
    tag: 'Alta Aprovação & Antifraude',
    feeInfo: 'PIX 0,89% • Crédito até 12x',
    supports: ['PIX', 'Crédito 12x', 'Débito', 'Saldo MP']
  },
  {
    id: 'cielo',
    name: 'Cielo E-Commerce 3.0',
    tag: 'Adquirência Direta Enterprise',
    feeInfo: 'Negociação Direta MDR',
    supports: ['Crédito 12x', 'Débito 3DS', 'QR PIX', 'Todas as Bandeiras']
  },
  {
    id: 'rede',
    name: 'e.Rede (Itaú)',
    tag: 'Liquidação D+2 Itaú',
    feeInfo: 'MDR Corporativo',
    supports: ['Crédito 12x', 'Débito', 'PIX', 'Antecipação']
  },
  {
    id: 'getnet',
    name: 'Getnet Santander',
    tag: 'Checkout & TEF / PDV Integrado',
    feeInfo: 'Online + Maquininhas PDV',
    supports: ['Crédito 12x', 'Débito', 'PIX', 'Bilheteria Física']
  },
  {
    id: 'adyen',
    name: 'Adyen Enterprise',
    tag: 'Otimização Global RevenueAccelerate',
    feeInfo: 'Interchange++ Enterprise',
    supports: ['Crédito 12x', 'Débito', 'Apple/Google Pay', '3DS Inteligente']
  }
]

const DEFAULT_PAYMENT_CONFIG: EventPaymentConfig = {
  pixEnabled: true,
  pixExpirationMinutes: 15,
  pixDiscountPercent: 0,
  debitCardEnabled: true,
  debitRequire3DS: true,
  creditCardEnabled: true,
  maxInstallments: 12,
  interestFreeInstallments: 3,
  installmentInterestModel: 'buyer_pays',
  monthlyInterestRatePercent: 1.99,
  minInstallmentValueBRL: 20,
  cardBrands: ['visa', 'mastercard', 'elo', 'amex', 'hipercard'],
  primaryGateway: 'pagarme',
  fallbackGateway: 'rede',
  pixGateway: 'asaas',
  antifraudProvider: 'clearsale',
  digitalWalletsEnabled: true,
  boletoEnabled: false,
  posPhysicalEnabled: true
}

const DEFAULT_MODALITIES: EventTicketModality[] = [
  {
    id: 'mod-inteira',
    name: 'Inteira',
    code: 'inteira',
    enabled: true,
    discountPercent: 0,
    quotaPercent: 100,
    maxPerCpf: 6,
    requiresDocument: false,
    description: 'Ingresso individual padrão com valor integral do lote.'
  },
  {
    id: 'mod-meia-legal',
    name: 'Meia-Entrada Legal (Estudante / Idoso / PCD / ID Jovem / Prof.)',
    code: 'meia_legal',
    enabled: true,
    discountPercent: 50,
    quotaPercent: 40,
    maxPerCpf: 2,
    requiresDocument: true,
    description: '50% de desconto garantido pela Lei Federal 12.933/2013 mediante validação de documento.'
  },
  {
    id: 'mod-solidario',
    name: 'Ingresso Solidário / Social (1kg de Alimento)',
    code: 'solidario',
    enabled: true,
    discountPercent: 30,
    quotaPercent: 50,
    maxPerCpf: 4,
    requiresDocument: false,
    description: 'Desconto social aberto a todos mediante doação de 1kg de alimento não perecível na portaria.'
  },
  {
    id: 'mod-promocional',
    name: 'Meia Promocional / Clube Disk / Parceiro',
    code: 'promocional',
    enabled: false,
    discountPercent: 40,
    quotaPercent: 25,
    maxPerCpf: 4,
    requiresDocument: false,
    description: 'Tarifa promocional para assinantes Clube Disk, clientes parceiros ou ações de pré-venda.'
  },
  {
    id: 'mod-infantil',
    name: 'Infantil / Kids (Até 12 anos)',
    code: 'infantil',
    enabled: false,
    discountPercent: 50,
    quotaPercent: 15,
    maxPerCpf: 4,
    requiresDocument: true,
    description: 'Valor reduzido para crianças acompanhadas dos pais ou responsável legal.'
  },
  {
    id: 'mod-cortesia',
    name: 'Cortesia / Convidado VIP Nominal',
    code: 'cortesia',
    enabled: true,
    discountPercent: 100,
    quotaPercent: 5,
    maxPerCpf: 2,
    requiresDocument: true,
    description: 'Ingresso gratuito nominal (R$ 0,00) exclusivo para lista de convidados, imprensa e patrocinadores.'
  },
  {
    id: 'mod-combo',
    name: 'Passaporte / Combo Grupo (4 Ingressos)',
    code: 'combo',
    enabled: false,
    discountPercent: 20,
    quotaPercent: 20,
    maxPerCpf: 8,
    requiresDocument: false,
    description: 'Desconto progressivo automático na compra conjunta de múltiplos acessos.'
  }
]

const DEFAULT_SCHEDULED_LOTS: EventScheduledLot[] = [
  {
    id: 'lot-1',
    order: 1,
    name: '1º Lote — Lançamento / Pré-Venda',
    sector: 'Plateia Central',
    basePriceBRL: 140,
    convenienceFeePercent: 10,
    quantity: 400,
    turnTrigger: 'quantity_or_date',
    startsAt: '2026-11-15T10:00',
    endsAt: '2026-12-15T23:59',
    nextLotId: 'lot-2',
    alertThresholdPercent: 85,
    status: 'ativo',
    enabledModalities: ['inteira', 'meia_legal', 'solidario', 'cortesia']
  },
  {
    id: 'lot-2',
    order: 2,
    name: '2º Lote — Virada Automática',
    sector: 'Plateia Central',
    basePriceBRL: 180,
    convenienceFeePercent: 10,
    quantity: 500,
    turnTrigger: 'quantity_or_date',
    startsAt: '2026-12-16T00:00',
    endsAt: '2027-01-31T23:59',
    nextLotId: 'lot-3',
    alertThresholdPercent: 90,
    status: 'agendado',
    enabledModalities: ['inteira', 'meia_legal', 'solidario']
  },
  {
    id: 'lot-3',
    order: 3,
    name: '3º Lote — Lote Final',
    sector: 'Plateia Central',
    basePriceBRL: 220,
    convenienceFeePercent: 10,
    quantity: 300,
    turnTrigger: 'quantity_or_date',
    startsAt: '2027-02-01T00:00',
    endsAt: '2027-03-15T20:00',
    nextLotId: '',
    alertThresholdPercent: 95,
    status: 'agendado',
    enabledModalities: ['inteira', 'meia_legal']
  }
]

const DEFAULT_SEATING_MAP: EventSeatingMapConfig = {
  mode: 'marked',
  layoutTemplate: 'auditorium',
  stagePosition: 'top',
  allowBuyerSeatSelection: true,
  preventOrphanSingleSeat: true,
  cartSeatHoldMinutes: 10,
  sectors: [
    {
      id: 'sec-1',
      name: 'Plateia Central',
      type: 'marked_rows',
      color: '#0EA5E9',
      capacity: 120,
      rowsCount: 8,
      seatsPerRow: 15,
      rowNaming: 'alpha',
      pcdSeatsCount: 6,
      blockedSeatsCount: 4,
      gate: 'Portão Principal A'
    },
    {
      id: 'sec-2',
      name: 'Balcão Nobre Superior',
      type: 'marked_rows',
      color: '#8B5CF6',
      capacity: 90,
      rowsCount: 6,
      seatsPerRow: 15,
      rowNaming: 'alpha',
      pcdSeatsCount: 4,
      blockedSeatsCount: 2,
      gate: 'Portão Superior B'
    }
  ],
  customSeatOverrides: {
    'sec-1:A-1': 'pcd',
    'sec-1:A-2': 'pcd',
    'sec-1:A-14': 'pcd',
    'sec-1:A-15': 'pcd',
    'sec-1:B-7': 'vip',
    'sec-1:B-8': 'vip',
    'sec-1:B-9': 'vip',
    'sec-1:H-14': 'blocked',
    'sec-1:H-15': 'blocked'
  }
}

const DEFAULT_OPERATIONAL_RULES: EventOperationalRules = {
  maxTicketsPerCpf: 6,
  nominalTicketsRequired: true,
  allowTicketTransfer: true,
  transferDeadlineHoursBefore: 24,
  ageRating: '16+',
  facialRecognitionEnabled: true,
  dynamicQrCodeAntiPrint: true,
  convenienceFeePercent: 10,
  feePaidBy: 'buyer',
  payoutSchedule: 'd_plus_2_post_event',
  autoBatchTurnEnabled: true,
  whatsappTurnNotification: true
}

const blank: EventItem = {
  id: 0,
  code: '',
  title: '',
  subtitle: '',
  venue: 'Teatro Positivo (Grande Auditório)',
  address: 'Rua Prof. Pedro Viriato Parigot de Souza, 5300 - Campo Comprido',
  city: 'Curitiba - PR',
  date: '20/03/2027 21:00',
  endDate: '20/03/2027 23:45',
  doorsOpenTime: '19:30',
  total: '0,00',
  sales: 0,
  available: 1200,
  courtesy: 50,
  occupancy: '0.0%',
  cover: 'symphonic',
  badge: 'LANÇAMENTO OFICIAL',
  status: 'ativo',
  category: 'Show & Música',
  producer: 'DiskIngressos Produções',
  visibility: 'publico',
  producerId: 1,
  description: '',
  paymentConfig: DEFAULT_PAYMENT_CONFIG,
  ticketModalities: DEFAULT_MODALITIES,
  scheduledLots: DEFAULT_SCHEDULED_LOTS,
  seatingMapConfig: DEFAULT_SEATING_MAP,
  operationalRules: DEFAULT_OPERATIONAL_RULES
}

function formatBRL(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function rowLabel(index: number, naming: 'alpha' | 'numeric'): string {
  if (naming === 'numeric') return `F${index + 1}`
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (index < 26) return letters[index]
  return `${letters[Math.floor(index / 26) - 1]}${letters[index % 26]}`
}

export default function EventFormPage({ mode, event, onCancel, onSave }: Props) {
  const [form, setForm] = useState<EventItem>(() => ({
    ...blank,
    ...(event || {}),
    paymentConfig: event?.paymentConfig || DEFAULT_PAYMENT_CONFIG,
    ticketModalities: event?.ticketModalities || DEFAULT_MODALITIES,
    scheduledLots: event?.scheduledLots || DEFAULT_SCHEDULED_LOTS,
    seatingMapConfig: event?.seatingMapConfig || DEFAULT_SEATING_MAP,
    operationalRules: event?.operationalRules || DEFAULT_OPERATIONAL_RULES
  }))

  const [activeSection, setActiveSection] = useState<'all' | 1 | 2 | 3 | 4 | 5 | 6>('all')
  const [globalTurnRule, setGlobalTurnRule] = useState<BatchTurnTrigger>('quantity_or_date')
  const [rolloverUnsoldQty, setRolloverUnsoldQty] = useState(true)

  // Modalidade Customizada
  const [newModalityName, setNewModalityName] = useState('')
  const [newModalityDiscount, setNewModalityDiscount] = useState('35')
  const [newModalityQuota, setNewModalityQuota] = useState('20')
  const [newModalityDoc, setNewModalityDoc] = useState(true)

  // Mapa Interativo
  const [activeMapSectorId, setActiveMapSectorId] = useState<string>('sec-1')
  const [seatClickBrush, setSeatClickBrush] = useState<'free' | 'blocked' | 'pcd' | 'vip'>('blocked')

  useEffect(() => {
    if (event) {
      setForm({
        ...blank,
        ...event,
        paymentConfig: event.paymentConfig || DEFAULT_PAYMENT_CONFIG,
        ticketModalities: event.ticketModalities || DEFAULT_MODALITIES,
        scheduledLots: event.scheduledLots || DEFAULT_SCHEDULED_LOTS,
        seatingMapConfig: event.seatingMapConfig || DEFAULT_SEATING_MAP,
        operationalRules: event.operationalRules || DEFAULT_OPERATIONAL_RULES
      })
    } else {
      setForm({
        ...blank,
        paymentConfig: DEFAULT_PAYMENT_CONFIG,
        ticketModalities: DEFAULT_MODALITIES,
        scheduledLots: DEFAULT_SCHEDULED_LOTS,
        seatingMapConfig: DEFAULT_SEATING_MAP,
        operationalRules: DEFAULT_OPERATIONAL_RULES
      })
    }
  }, [event, mode])

  const payment = form.paymentConfig || DEFAULT_PAYMENT_CONFIG
  const modalities = form.ticketModalities || DEFAULT_MODALITIES
  const lots = form.scheduledLots || DEFAULT_SCHEDULED_LOTS
  const seatingMap = form.seatingMapConfig || DEFAULT_SEATING_MAP
  const rules = form.operationalRules || DEFAULT_OPERATIONAL_RULES

  const updateField = <K extends keyof EventItem>(key: K, value: EventItem[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const updatePayment = (patch: Partial<EventPaymentConfig>) => {
    setForm(prev => ({
      ...prev,
      paymentConfig: { ...(prev.paymentConfig || DEFAULT_PAYMENT_CONFIG), ...patch }
    }))
  }

  const updateSeatingMap = (patch: Partial<EventSeatingMapConfig>) => {
    setForm(prev => ({
      ...prev,
      seatingMapConfig: { ...(prev.seatingMapConfig || DEFAULT_SEATING_MAP), ...patch }
    }))
  }

  const updateRules = (patch: Partial<EventOperationalRules>) => {
    setForm(prev => ({
      ...prev,
      operationalRules: { ...(prev.operationalRules || DEFAULT_OPERATIONAL_RULES), ...patch }
    }))
  }

  // Totais calculados automaticamente a partir dos lotes e mapa
  const totalLotsCapacity = useMemo(
    () => lots.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0),
    [lots]
  )
  const totalMapCapacity = useMemo(
    () => seatingMap.sectors.reduce((acc, s) => acc + (Number(s.capacity) || 0), 0),
    [seatingMap.sectors]
  )
  const potentialGrossRevenue = useMemo(
    () => lots.reduce((acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.basePriceBRL) || 0), 0),
    [lots]
  )
  const firstLotPrice = lots[0]?.basePriceBRL || 140

  // Simulador de parcelas 1x até maxInstallments (até 12x)
  const installmentSimulation = useMemo(() => {
    const list: Array<{ n: number; installmentValue: number; totalValue: number; hasInterest: boolean }> = []
    const max = Math.min(12, Math.max(1, payment.maxInstallments || 1))
    const freeLimit = payment.installmentInterestModel === 'producer_absorbs' ? max : (payment.interestFreeInstallments || 1)
    const monthlyRate = (payment.monthlyInterestRatePercent || 1.99) / 100

    for (let n = 1; n <= max; n++) {
      const hasInterest = n > freeLimit && payment.installmentInterestModel !== 'producer_absorbs'
      const totalValue = hasInterest
        ? firstLotPrice * Math.pow(1 + monthlyRate, n)
        : firstLotPrice
      const installmentValue = totalValue / n
      list.push({ n, installmentValue, totalValue, hasInterest })
    }
    return list
  }, [firstLotPrice, payment.maxInstallments, payment.interestFreeInstallments, payment.installmentInterestModel, payment.monthlyInterestRatePercent])

  // Handlers de Modalidades
  const toggleModality = (id: string) => {
    const next = modalities.map(m => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    updateField('ticketModalities', next)
  }

  const updateModalityField = (id: string, patch: Partial<EventTicketModality>) => {
    const next = modalities.map(m => (m.id === id ? { ...m, ...patch } : m))
    updateField('ticketModalities', next)
  }

  const addCustomModality = () => {
    if (!newModalityName.trim()) return
    const created: EventTicketModality = {
      id: `mod-custom-${Date.now()}`,
      name: newModalityName.trim(),
      code: 'custom',
      enabled: true,
      discountPercent: Math.min(100, Math.max(0, Number(newModalityDiscount) || 0)),
      quotaPercent: Math.min(100, Math.max(1, Number(newModalityQuota) || 20)),
      maxPerCpf: 4,
      requiresDocument: newModalityDoc,
      description: 'Modalidade personalizada configurada para este evento.'
    }
    updateField('ticketModalities', [...modalities, created])
    setNewModalityName('')
  }

  const removeModality = (id: string) => {
    updateField('ticketModalities', modalities.filter(m => m.id !== id))
  }

  // Handlers de Lotes Agendados
  const applyGlobalTurnRule = (rule: BatchTurnTrigger) => {
    setGlobalTurnRule(rule)
    updateField(
      'scheduledLots',
      lots.map(l => ({ ...l, turnTrigger: rule }))
    )
  }

  const addScheduledLot = () => {
    const nextOrder = lots.length + 1
    const prevLot = lots[lots.length - 1]
    const newId = `lot-${Date.now()}`
    const defaultSector = seatingMap.sectors[0]?.name || 'Pista / Geral'
    const newLot: EventScheduledLot = {
      id: newId,
      order: nextOrder,
      name: `${nextOrder}º Lote — Virada Programada`,
      sector: prevLot?.sector || defaultSector,
      basePriceBRL: prevLot ? Math.round(prevLot.basePriceBRL * 1.2) : 150,
      convenienceFeePercent: rules.convenienceFeePercent || 10,
      quantity: prevLot ? prevLot.quantity : 400,
      turnTrigger: globalTurnRule,
      startsAt: prevLot?.endsAt || '2027-02-01T00:00',
      endsAt: '2027-03-15T23:59',
      nextLotId: '',
      alertThresholdPercent: 85,
      status: nextOrder === 1 ? 'ativo' : 'agendado',
      enabledModalities: modalities.filter(m => m.enabled).map(m => m.code)
    }

    const updatedPrev = lots.map((l, idx) =>
      idx === lots.length - 1 && !l.nextLotId ? { ...l, nextLotId: newId } : l
    )
    updateField('scheduledLots', [...updatedPrev, newLot])
  }

  const generateAutomaticLotLadder = () => {
    const defaultSector = seatingMap.sectors[0]?.name || 'Pista / Geral'
    const basePrice = lots[0]?.basePriceBRL || 120
    const enabledCodes = modalities.filter(m => m.enabled).map(m => m.code)
    const ladder: EventScheduledLot[] = [
      {
        id: 'lot-auto-1',
        order: 1,
        name: '1º Lote — Lançamento Promocional',
        sector: defaultSector,
        basePriceBRL: basePrice,
        convenienceFeePercent: rules.convenienceFeePercent,
        quantity: 400,
        turnTrigger: globalTurnRule,
        startsAt: '2026-11-15T10:00',
        endsAt: '2026-12-20T23:59',
        nextLotId: 'lot-auto-2',
        alertThresholdPercent: 85,
        status: 'ativo',
        enabledModalities: enabledCodes
      },
      {
        id: 'lot-auto-2',
        order: 2,
        name: '2º Lote — Virada Intermediária',
        sector: defaultSector,
        basePriceBRL: Math.round(basePrice * 1.25),
        convenienceFeePercent: rules.convenienceFeePercent,
        quantity: 500,
        turnTrigger: globalTurnRule,
        startsAt: '2026-12-21T00:00',
        endsAt: '2027-02-01T23:59',
        nextLotId: 'lot-auto-3',
        alertThresholdPercent: 90,
        status: 'agendado',
        enabledModalities: enabledCodes
      },
      {
        id: 'lot-auto-3',
        order: 3,
        name: '3º Lote — Virada Final',
        sector: defaultSector,
        basePriceBRL: Math.round(basePrice * 1.5),
        convenienceFeePercent: rules.convenienceFeePercent,
        quantity: 400,
        turnTrigger: globalTurnRule,
        startsAt: '2027-02-02T00:00',
        endsAt: '2027-03-20T20:00',
        nextLotId: '',
        alertThresholdPercent: 95,
        status: 'agendado',
        enabledModalities: enabledCodes
      }
    ]
    updateField('scheduledLots', ladder)
  }

  const updateLot = (id: string, patch: Partial<EventScheduledLot>) => {
    updateField(
      'scheduledLots',
      lots.map(l => (l.id === id ? { ...l, ...patch } : l))
    )
  }

  const removeLot = (id: string) => {
    if (lots.length <= 1) return
    const filtered = lots.filter(l => l.id !== id).map((l, i) => ({
      ...l,
      order: i + 1,
      nextLotId: l.nextLotId === id ? '' : l.nextLotId
    }))
    updateField('scheduledLots', filtered)
  }

  // Handlers de Mapa e Setores
  const changeMapMode = (newMode: 'unmarked' | 'marked' | 'hybrid') => {
    if (newMode === 'unmarked') {
      const standingSectors: EventSeatingSector[] = [
        {
          id: 'sec-free-1',
          name: 'Pista Geral',
          type: 'standing_free',
          color: '#0EA5E9',
          capacity: 1000,
          rowsCount: 0,
          seatsPerRow: 0,
          rowNaming: 'alpha',
          pcdSeatsCount: 20,
          blockedSeatsCount: 0,
          gate: 'Portão A - Pista'
        },
        {
          id: 'sec-free-2',
          name: 'Frontstage / Área VIP',
          type: 'standing_free',
          color: '#F59E0B',
          capacity: 400,
          rowsCount: 0,
          seatsPerRow: 0,
          rowNaming: 'alpha',
          pcdSeatsCount: 10,
          blockedSeatsCount: 0,
          gate: 'Portão B - Acesso VIP'
        },
        {
          id: 'sec-free-3',
          name: 'Camarote Open Bar',
          type: 'standing_free',
          color: '#8B5CF6',
          capacity: 250,
          rowsCount: 0,
          seatsPerRow: 0,
          rowNaming: 'alpha',
          pcdSeatsCount: 8,
          blockedSeatsCount: 0,
          gate: 'Portão C - Camarote'
        }
      ]
      updateSeatingMap({
        mode: 'unmarked',
        layoutTemplate: 'festival_standing',
        allowBuyerSeatSelection: false,
        sectors: standingSectors
      })
      setActiveMapSectorId('sec-free-1')
    } else if (newMode === 'marked') {
      updateSeatingMap({
        mode: 'marked',
        layoutTemplate: 'auditorium',
        allowBuyerSeatSelection: true,
        sectors: DEFAULT_SEATING_MAP.sectors
      })
      setActiveMapSectorId(DEFAULT_SEATING_MAP.sectors[0].id)
    } else {
      const hybridSectors: EventSeatingSector[] = [
        {
          id: 'sec-hyb-1',
          name: 'Camarote / Cadeiras Numeradas',
          type: 'marked_rows',
          color: '#F59E0B',
          capacity: 96,
          rowsCount: 6,
          seatsPerRow: 16,
          rowNaming: 'alpha',
          pcdSeatsCount: 6,
          blockedSeatsCount: 4,
          gate: 'Portão VIP Numerado'
        },
        {
          id: 'sec-hyb-2',
          name: 'Mesas Bistrô (6 Lugares)',
          type: 'marked_tables',
          color: '#8B5CF6',
          capacity: 72,
          rowsCount: 3,
          seatsPerRow: 4,
          tablesCount: 12,
          seatsPerTable: 6,
          rowNaming: 'numeric',
          pcdSeatsCount: 4,
          blockedSeatsCount: 0,
          gate: 'Portão Lounge'
        },
        {
          id: 'sec-hyb-3',
          name: 'Pista Arena (Sem Lugar Marcado)',
          type: 'standing_free',
          color: '#10B981',
          capacity: 800,
          rowsCount: 0,
          seatsPerRow: 0,
          rowNaming: 'alpha',
          pcdSeatsCount: 15,
          blockedSeatsCount: 0,
          gate: 'Portão Geral Pista'
        }
      ]
      updateSeatingMap({
        mode: 'hybrid',
        layoutTemplate: 'arena_360',
        allowBuyerSeatSelection: true,
        sectors: hybridSectors
      })
      setActiveMapSectorId('sec-hyb-1')
    }
  }

  const addSectorToMap = () => {
    const isMarked = seatingMap.mode !== 'unmarked'
    const newSec: EventSeatingSector = {
      id: `sec-${Date.now()}`,
      name: `Novo Setor ${seatingMap.sectors.length + 1}`,
      type: isMarked ? 'marked_rows' : 'standing_free',
      color: ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899'][seatingMap.sectors.length % 5],
      capacity: isMarked ? 80 : 500,
      rowsCount: isMarked ? 5 : 0,
      seatsPerRow: isMarked ? 16 : 0,
      rowNaming: 'alpha',
      pcdSeatsCount: 4,
      blockedSeatsCount: 0,
      gate: `Portão ${String.fromCharCode(65 + seatingMap.sectors.length)}`
    }
    updateSeatingMap({ sectors: [...seatingMap.sectors, newSec] })
    setActiveMapSectorId(newSec.id)
  }

  const updateMapSector = (id: string, patch: Partial<EventSeatingSector>) => {
    const next = seatingMap.sectors.map(s => {
      if (s.id !== id) return s
      const updated = { ...s, ...patch }
      if (updated.type === 'marked_rows') {
        updated.capacity = Math.max(1, (updated.rowsCount || 1) * (updated.seatsPerRow || 1))
      } else if (updated.type === 'marked_tables') {
        updated.capacity = Math.max(1, (updated.tablesCount || 1) * (updated.seatsPerTable || 4))
      }
      return updated
    })
    updateSeatingMap({ sectors: next })
  }

  const removeMapSector = (id: string) => {
    if (seatingMap.sectors.length <= 1) return
    const next = seatingMap.sectors.filter(s => s.id !== id)
    updateSeatingMap({ sectors: next })
    if (activeMapSectorId === id && next[0]) setActiveMapSectorId(next[0].id)
  }

  const toggleSeatOverride = (sectorId: string, rLabel: string, seatNumber: number) => {
    const key = `${sectorId}:${rLabel}-${seatNumber}`
    const current = { ...(seatingMap.customSeatOverrides || {}) }
    if (seatClickBrush === 'free') {
      delete current[key]
    } else if (current[key] === seatClickBrush) {
      delete current[key]
    } else {
      current[key] = seatClickBrush
    }
    updateSeatingMap({ customSeatOverrides: current })
  }

  const toggleCardBrand = (brandId: string) => {
    const exists = payment.cardBrands.includes(brandId)
    if (exists && payment.cardBrands.length === 1) return
    const next = exists
      ? payment.cardBrands.filter(b => b !== brandId)
      : [...payment.cardBrands, brandId]
    updatePayment({ cardBrands: next })
  }

  const submit = () => {
    if (!form.title.trim() || !form.venue.trim() || !form.date.trim()) {
      alert('Por favor, preencha o Nome do Evento, Local e Data/Hora de Início.')
      return
    }
    const finalAvailable = totalLotsCapacity > 0 ? totalLotsCapacity : (totalMapCapacity || form.available || 500)
    const courtesyMod = modalities.find(m => m.code === 'cortesia' && m.enabled)
    const finalCourtesy = courtesyMod
      ? Math.round((finalAvailable * (courtesyMod.quotaPercent || 5)) / 100)
      : (form.courtesy || 0)

    const savedEvent: EventItem = {
      ...form,
      id: form.id || Date.now(),
      code: form.code || String(Math.floor(4000 + Math.random() * 5000)),
      available: finalAvailable,
      courtesy: finalCourtesy,
      paymentConfig: payment,
      ticketModalities: modalities,
      scheduledLots: lots,
      seatingMapConfig: seatingMap,
      operationalRules: rules
    }
    onSave(savedEvent)
  }

  const activeSectorObj = seatingMap.sectors.find(s => s.id === activeMapSectorId) || seatingMap.sectors[0]

  const showSection = (n: 1 | 2 | 3 | 4 | 5 | 6) => activeSection === 'all' || activeSection === n

  return (
    <div className="space-y-4 w-full max-w-none pb-12" data-testid="event-form-page">
      {/* Cabeçalho Principal */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0F172A] border border-slate-800 rounded-2xl p-5 text-white shadow-lg">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 mb-2 cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>Voltar para Todos os Eventos</span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              EVENTOS / {mode === 'new' ? 'MONTAGEM COMPLETA DE NOVO EVENTO' : 'EDIÇÃO AVANÇADA'}
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Motor Bilheteria 360° • Pagamentos, Lotes Agendados & Mapa
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
            {mode === 'new' ? 'Criar e Configurar Novo Evento' : `Editar Evento: ${form.title}`}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Configure dados básicos, mapa com ou sem lugar marcado, modalidades (Inteira/Meia/Solidário), lotes agendados por quantidade ou data e métodos de pagamento (PIX, Débito, Crédito até 12x, Bandeiras e Gateways).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-xs font-bold text-slate-200 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            data-testid="btn-save-event"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition cursor-pointer"
          >
            <Save size={17} />
            <span>{mode === 'new' ? 'Salvar e Publicar Evento' : 'Salvar Alterações do Evento'}</span>
          </button>
        </div>
      </section>

      {/* Barra de Navegação das 6 Etapas / Visão Completa */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setActiveSection('all')}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeSection === 'all'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Sparkles size={14} />
          <span>Visão Completa (Todas as 6 Etapas)</span>
        </button>

        {[
          { step: 1 as const, label: '1. Dados & Local', icon: MapPin },
          { step: 2 as const, label: '2. Mapa (Com/Sem Lugar Marcado)', icon: Grid },
          { step: 3 as const, label: '3. Modalidades (Inteira/Meia/etc.)', icon: Ticket },
          { step: 4 as const, label: '4. Lotes & Virada Agendada', icon: Layers },
          { step: 5 as const, label: '5. Pagamentos, 12x, Bandeiras & Gateway', icon: CreditCard },
          { step: 6 as const, label: '6. Regras, Biometria & Taxas', icon: ShieldCheck }
        ].map(({ step, label, icon: Icon }) => (
          <button
            key={step}
            type="button"
            onClick={() => setActiveSection(step)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSection === step
                ? 'bg-sky-500 text-slate-950 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-800'
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Layout Principal + Resumo Executivo Lateral */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-8 space-y-5">
          {/* =====================================================================
              SEÇÃO 1: IDENTIFICAÇÃO DO EVENTO, LOCAL E DATAS
          ===================================================================== */}
          {showSection(1) && (
            <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold">
                    <Ticket size={19} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">Etapa 1 de 6</span>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      Identificação do Evento, Localização e Datas
                    </h2>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-400">Dados principais da vitrine</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nome Principal do Evento *
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => updateField('title', e.target.value)}
                    placeholder="Ex.: Turnê Especial 2027 • Grande Concerto em Curitiba"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Categoria Oficial
                  </label>
                  <select
                    value={form.category || 'Show & Música'}
                    onChange={e => updateField('category', e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="Show & Música">Show & Música</option>
                    <option value="Festival">Festival</option>
                    <option value="Teatro & Espetáculo">Teatro & Espetáculo</option>
                    <option value="Stand-up & Comédia">Stand-up & Comédia</option>
                    <option value="Congresso & Palestra">Congresso & Palestra</option>
                    <option value="Esportivo">Esportivo</option>
                    <option value="Gastronômico">Gastronômico</option>
                    <option value="Infantil & Família">Infantil & Família</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Subtítulo / Slogan da Turnê
                  </label>
                  <input
                    type="text"
                    value={form.subtitle || ''}
                    onChange={e => updateField('subtitle', e.target.value)}
                    placeholder="Ex.: Edição Histórica 30 Anos"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Produtora Responsável
                  </label>
                  <input
                    type="text"
                    value={form.producer || 'DiskIngressos Produções'}
                    onChange={e => updateField('producer', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Selo / Badge de Destaque na Loja
                  </label>
                  <input
                    type="text"
                    value={form.badge || ''}
                    onChange={e => updateField('badge', e.target.value)}
                    placeholder="Ex.: PRÉ-VENDA EXCLUSIVA, ÚLTIMOS LUGARES"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Local / Casa de Eventos *
                  </label>
                  <input
                    type="text"
                    value={form.venue}
                    onChange={e => updateField('venue', e.target.value)}
                    placeholder="Ex.: Teatro Positivo, Ópera de Arame, Pedreira..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cidade / UF *
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => updateField('city', e.target.value)}
                    placeholder="Curitiba - PR"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Endereço Completo
                  </label>
                  <input
                    type="text"
                    value={form.address || ''}
                    onChange={e => updateField('address', e.target.value)}
                    placeholder="Rua, número e bairro"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Data e Hora de Início *
                  </label>
                  <input
                    type="text"
                    value={form.date}
                    onChange={e => updateField('date', e.target.value)}
                    placeholder="DD/MM/AAAA HH:MM"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Data e Hora de Término
                  </label>
                  <input
                    type="text"
                    value={form.endDate || ''}
                    onChange={e => updateField('endDate', e.target.value)}
                    placeholder="DD/MM/AAAA HH:MM"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Abertura dos Portões
                  </label>
                  <input
                    type="text"
                    value={form.doorsOpenTime || '19:30'}
                    onChange={e => updateField('doorsOpenTime', e.target.value)}
                    placeholder="Ex.: 19:00"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Descrição / Release Completo do Evento
                  </label>
                  <textarea
                    rows={2}
                    value={form.description || ''}
                    onChange={e => updateField('description', e.target.value)}
                    placeholder="Descreva a programação, atrações, regras de meia-entrada e orientações ao público..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </section>
          )}

          {/* =====================================================================
              SEÇÃO 2: CRIAÇÃO DE MAPA COM OU SEM LUGAR MARCADO
          ===================================================================== */}
          {showSection(2) && (
            <section
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5"
              data-testid="section-seating-map"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold">
                    <Grid size={19} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Etapa 2 de 6 • Engenharia de Mapa</span>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      Criação de Mapa do Evento (Com ou Sem Lugar Marcado)
                    </h2>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  Capacidade no Mapa: {totalMapCapacity.toLocaleString('pt-BR')} lugares
                </span>
              </div>

              {/* Escolha do Tipo de Mapa */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    id: 'marked' as const,
                    title: 'Com Lugar Marcado (Numerado)',
                    desc: 'Assentos numerados por fileira e poltrona (A1, A2...) ou mesas. O cliente escolhe seu lugar exato no mapa.',
                    badge: 'Teatros, Auditórios & Cadeiras'
                  },
                  {
                    id: 'unmarked' as const,
                    title: 'Sem Lugar Marcado (Setor Livre)',
                    desc: 'Venda por capacidade de setor (Pista, Frontstage, Área VIP, Camarote) sem cadeira fixa.',
                    badge: 'Shows, Festivais & Pistas'
                  },
                  {
                    id: 'hybrid' as const,
                    title: 'Mapa Híbrido (Numerado + Livre)',
                    desc: 'Combina setores de cadeiras/mesas numeradas com pista ou camarote sem lugar marcado no mesmo evento.',
                    badge: 'Arenas, Rodeios & Grandes Shows'
                  }
                ].map(opt => {
                  const active = seatingMap.mode === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => changeMapMode(opt.id)}
                      data-testid={`map-mode-${opt.id}`}
                      className={`text-left p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                        active
                          ? 'border-purple-500 bg-purple-500/10 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 hover:border-slate-400 dark:hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                            {opt.badge}
                          </span>
                          {active && <CheckCircle2 size={16} className="text-purple-400 shrink-0" />}
                        </div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">{opt.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{opt.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Regras do Mapa no Checkout */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seatingMap.allowBuyerSeatSelection}
                    disabled={seatingMap.mode === 'unmarked'}
                    onChange={e => updateSeatingMap({ allowBuyerSeatSelection: e.target.checked })}
                    className="mt-0.5 rounded text-purple-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Escolha de Assento pelo Comprador
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {seatingMap.mode === 'unmarked'
                        ? 'Desativado no modo Sem Lugar Marcado'
                        : 'Permite clicar na poltrona/mesa desejada durante o checkout'}
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seatingMap.preventOrphanSingleSeat}
                    disabled={seatingMap.mode === 'unmarked'}
                    onChange={e => updateSeatingMap({ preventOrphanSingleSeat: e.target.checked })}
                    className="mt-0.5 rounded text-purple-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Trava Anti-Cadeira Órfã (Assento Isolado)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Impede deixar 1 poltrona vazia isolada entre assentos vendidos
                    </span>
                  </div>
                </label>

                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                    Tempo de Reserva de Lugar no Carrinho (Hold)
                  </label>
                  <select
                    value={seatingMap.cartSeatHoldMinutes}
                    onChange={e => updateSeatingMap({ cartSeatHoldMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={10}>10 minutos de bloqueio no checkout</option>
                    <option value={15}>15 minutos de bloqueio no checkout</option>
                    <option value={20}>20 minutos de bloqueio no checkout</option>
                    <option value={30}>30 minutos de bloqueio no checkout</option>
                  </select>
                </div>
              </div>

              {/* Lista e Configuração de Setores do Mapa */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Setores Configurados no Mapa ({seatingMap.sectors.length})
                  </h3>
                  <button
                    type="button"
                    onClick={addSectorToMap}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Adicionar Setor ao Mapa</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {seatingMap.sectors.map(sec => (
                    <div
                      key={sec.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end">
                        <div className="lg:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Nome do Setor / Área
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={sec.color}
                              onChange={e => updateMapSector(sec.id, { color: e.target.value })}
                              className="w-7 h-8 rounded cursor-pointer border-0 bg-transparent"
                              title="Cor do Setor no Mapa"
                            />
                            <input
                              type="text"
                              value={sec.name}
                              onChange={e => updateMapSector(sec.id, { name: e.target.value })}
                              className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Modo do Setor
                          </label>
                          <select
                            value={sec.type}
                            onChange={e =>
                              updateMapSector(sec.id, {
                                type: e.target.value as EventSeatingSector['type'],
                                rowsCount: e.target.value === 'marked_rows' ? 6 : 0,
                                seatsPerRow: e.target.value === 'marked_rows' ? 15 : 0,
                                tablesCount: e.target.value === 'marked_tables' ? 12 : undefined,
                                seatsPerTable: e.target.value === 'marked_tables' ? 6 : undefined
                              })
                            }
                            className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          >
                            <option value="marked_rows">Lugar Marcado (Fileiras/Poltronas)</option>
                            <option value="marked_tables">Mesas / Bistrôs Numerados</option>
                            <option value="standing_free">Sem Lugar Marcado (Pista Livre)</option>
                          </select>
                        </div>

                        {sec.type === 'marked_rows' && (
                          <>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Fileiras (Ex: A–H)
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={40}
                                value={sec.rowsCount}
                                onChange={e => updateMapSector(sec.id, { rowsCount: Math.max(1, Number(e.target.value)) })}
                                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Poltronas / Fileira
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={sec.seatsPerRow}
                                onChange={e => updateMapSector(sec.id, { seatsPerRow: Math.max(1, Number(e.target.value)) })}
                                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>
                          </>
                        )}

                        {sec.type === 'marked_tables' && (
                          <>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Qtd. de Mesas
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={sec.tablesCount || 10}
                                onChange={e => updateMapSector(sec.id, { tablesCount: Math.max(1, Number(e.target.value)) })}
                                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Lugares por Mesa
                              </label>
                              <input
                                type="number"
                                min={2}
                                max={12}
                                value={sec.seatsPerTable || 6}
                                onChange={e => updateMapSector(sec.id, { seatsPerTable: Math.max(1, Number(e.target.value)) })}
                                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              />
                            </div>
                          </>
                        )}

                        {sec.type === 'standing_free' && (
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Capacidade Total do Setor Livre
                            </label>
                            <input
                              type="number"
                              min={10}
                              value={sec.capacity}
                              onChange={e => updateMapSector(sec.id, { capacity: Math.max(1, Number(e.target.value)) })}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Capacidade</span>
                            <span className="text-xs font-black text-purple-400">
                              {sec.capacity.toLocaleString('pt-BR')} lug.
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setActiveMapSectorId(sec.id)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                                activeSectorObj?.id === sec.id
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              Ver Mapa
                            </button>
                            {seatingMap.sectors.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeMapSector(sec.id)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                title="Remover setor"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Simulador e Editor Visual do Mapa */}
              <div className="rounded-2xl border border-slate-800 bg-[#0B1120] p-4 text-white space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400 block">
                      Pré-Visualização Interativa do Mapa de Palco & Setores
                    </span>
                    <h4 className="text-sm font-bold text-white">
                      {seatingMap.mode === 'unmarked'
                        ? 'Mapa de Setores Livres (Sem Lugar Marcado)'
                        : `Editor de Assentos Numerados — Setor: ${activeSectorObj?.name || 'Principal'}`}
                    </h4>
                  </div>

                  {activeSectorObj && activeSectorObj.type === 'marked_rows' && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400 mr-1">Clique no assento para marcar:</span>
                      {[
                        { id: 'free' as const, label: 'Livre', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                        { id: 'blocked' as const, label: 'Bloqueio Produção', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
                        { id: 'pcd' as const, label: 'Assento PCD', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
                        { id: 'vip' as const, label: 'Reserva VIP', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
                      ].map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSeatClickBrush(b.id)}
                          className={`px-2.5 py-1 rounded-md border font-bold cursor-pointer ${b.cls} ${
                            seatClickBrush === b.id ? 'ring-2 ring-white' : 'opacity-70'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Palco Visual */}
                <div className="w-full max-w-xl mx-auto py-2 px-6 rounded-b-3xl bg-gradient-to-r from-slate-800 via-purple-900/60 to-slate-800 border-x border-b border-purple-500/40 text-center shadow-inner">
                  <span className="text-[11px] font-black tracking-[0.25em] uppercase text-purple-200">
                    PALCO PRINCIPAL / VISÃO DA PLATEIA
                  </span>
                </div>

                {/* Seletor rápido de setor para visualizar */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {seatingMap.sectors.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveMapSectorId(s.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                        activeSectorObj?.id === s.id
                          ? 'bg-white text-slate-950 border-white'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span>{s.name}</span>
                      <span className="text-[10px] opacity-75">({s.capacity} lug.)</span>
                    </button>
                  ))}
                </div>

                {/* Renderização das Fileiras Numeradas, Mesas ou Blocos de Pista Livre */}
                {activeSectorObj?.type === 'marked_rows' && (
                  <div className="overflow-x-auto py-2">
                    <div className="inline-flex flex-col gap-1.5 min-w-full items-center">
                      {Array.from({ length: Math.min(12, activeSectorObj.rowsCount || 6) }).map((_, rIdx) => {
                        const rName = rowLabel(rIdx, activeSectorObj.rowNaming || 'alpha')
                        const seatsCount = Math.min(22, activeSectorObj.seatsPerRow || 14)
                        return (
                          <div key={rName} className="flex items-center gap-1.5">
                            <span className="w-6 text-right text-[11px] font-black text-slate-400 mr-1">
                              {rName}
                            </span>
                            {Array.from({ length: seatsCount }).map((__, sIdx) => {
                              const seatNum = sIdx + 1
                              const overrideKey = `${activeSectorObj.id}:${rName}-${seatNum}`
                              const state = seatingMap.customSeatOverrides?.[overrideKey]
                              const colorClass =
                                state === 'blocked'
                                  ? 'bg-rose-600 text-white border-rose-400'
                                  : state === 'pcd'
                                  ? 'bg-sky-500 text-slate-950 border-sky-300'
                                  : state === 'vip'
                                  ? 'bg-amber-400 text-slate-950 border-amber-200'
                                  : 'bg-emerald-500/25 hover:bg-emerald-500/50 text-emerald-200 border-emerald-500/40'
                              return (
                                <button
                                  key={seatNum}
                                  type="button"
                                  onClick={() => toggleSeatOverride(activeSectorObj.id, rName, seatNum)}
                                  title={`Setor ${activeSectorObj.name} • Fileira ${rName} Assento ${seatNum} (${state || 'Livre'})`}
                                  className={`w-6 h-6 rounded-t-md text-[10px] font-bold border transition cursor-pointer flex items-center justify-center ${colorClass}`}
                                >
                                  {seatNum}
                                </button>
                              )
                            })}
                            <span className="w-6 text-left text-[11px] font-black text-slate-400 ml-1">
                              {rName}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {activeSectorObj?.type === 'marked_tables' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 py-2">
                    {Array.from({ length: Math.min(18, activeSectorObj.tablesCount || 12) }).map((_, tIdx) => (
                      <div
                        key={tIdx}
                        className="p-2.5 rounded-xl border border-purple-500/40 bg-purple-950/30 flex flex-col items-center justify-center text-center"
                      >
                        <span className="text-xs font-black text-purple-200">Mesa #{tIdx + 1}</span>
                        <span className="text-[10px] text-slate-400">{activeSectorObj.seatsPerTable || 6} Cadeira(s)</span>
                      </div>
                    ))}
                  </div>
                )}

                {activeSectorObj?.type === 'standing_free' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
                    {seatingMap.sectors.map(s => (
                      <div
                        key={s.id}
                        className="p-4 rounded-xl border flex flex-col justify-between"
                        style={{
                          borderColor: s.color,
                          backgroundColor: `${s.color}18`
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-white">{s.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900/80 text-slate-200">
                            {s.type === 'standing_free' ? 'Sem Lugar Marcado' : 'Numerado'}
                          </span>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between">
                          <span className="text-lg font-black text-white">
                            {s.capacity.toLocaleString('pt-BR')} ingressos
                          </span>
                          <span className="text-[11px] text-slate-300">{s.gate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* =====================================================================
              SEÇÃO 3: MODALIDADES DE INGRESSO (INTEIRA, MEIA-ENTRADA, SOLIDÁRIO...)
          ===================================================================== */}
          {showSection(3) && (
            <section
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4"
              data-testid="section-ticket-modalities"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
                    <Ticket size={19} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Etapa 3 de 6 • Políticas de Preço</span>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      Modalidades de Ingresso (Inteira, Meia-Entrada, Solidário, VIP e Customizadas)
                    </h2>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {modalities.filter(m => m.enabled).length} modalidades ativas
                </span>
              </div>

              <div className="space-y-2.5">
                {modalities.map(mod => {
                  const samplePrice = firstLotPrice * (1 - (mod.discountPercent || 0) / 100)
                  return (
                    <div
                      key={mod.id}
                      className={`p-3.5 rounded-xl border transition ${
                        mod.enabled
                          ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/15'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-70'
                      }`}
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                        <div className="lg:col-span-5 flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={mod.enabled}
                            onChange={() => toggleModality(mod.id)}
                            className="mt-1 h-4 w-4 rounded text-emerald-600 cursor-pointer"
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                {mod.name}
                              </span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                {mod.discountPercent === 0
                                  ? '100% Integral'
                                  : mod.discountPercent === 100
                                  ? 'Gratuito (R$ 0,00)'
                                  : `-${mod.discountPercent}% Desconto`}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{mod.description}</p>
                          </div>
                        </div>

                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                            Desconto (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={mod.discountPercent}
                            disabled={mod.code === 'inteira'}
                            onChange={e =>
                              updateModalityField(mod.id, {
                                discountPercent: Math.min(100, Math.max(0, Number(e.target.value)))
                              })
                            }
                            className="w-full px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                            Cota Máx. (%)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={mod.quotaPercent}
                            onChange={e =>
                              updateModalityField(mod.id, {
                                quotaPercent: Math.min(100, Math.max(1, Number(e.target.value)))
                              })
                            }
                            className="w-full px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div className="lg:col-span-2">
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={mod.requiresDocument}
                              onChange={e => updateModalityField(mod.id, { requiresDocument: e.target.checked })}
                              className="rounded text-emerald-600"
                            />
                            <span>Exigir Comprovante</span>
                          </label>
                          <span className="block text-[11px] font-black text-emerald-400 mt-1">
                            1º Lote: {formatBRL(samplePrice)}
                          </span>
                        </div>

                        <div className="lg:col-span-1 flex justify-end">
                          {mod.code === 'custom' && (
                            <button
                              type="button"
                              onClick={() => removeModality(mod.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                              title="Remover modalidade"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Adicionar Nova Modalidade Personalizada */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-dashed border-slate-300 dark:border-slate-700">
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 block mb-2">
                  + Adicionar Nova Modalidade Personalizada (Ex.: Sócio Torcedor, Associado, Convênio, Camarote Duplo)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nome da Modalidade</label>
                    <input
                      type="text"
                      value={newModalityName}
                      onChange={e => setNewModalityName(e.target.value)}
                      placeholder="Ex.: Meia Professor / Sócio Clube"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Desconto (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={newModalityDiscount}
                      onChange={e => setNewModalityDiscount(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Cota Limite (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newModalityQuota}
                      onChange={e => setNewModalityQuota(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addCustomModality}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 h-[32px]"
                  >
                    <Plus size={14} />
                    <span>Incluir Modalidade</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* =====================================================================
              SEÇÃO 4: CONFIGURAÇÃO DE LOTES E VIRADA AGENDADA (QUANTIDADE OU DATA)
          ===================================================================== */}
          {showSection(4) && (
            <section
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5"
              data-testid="section-scheduled-lots"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                    <Layers size={19} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      Etapa 4 de 6 • Automação de Virada de Lote
                    </span>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      Configuração de Lotes e Estrutura de Virada Agendada (Por Quantidade ou Por Data)
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={generateAutomaticLotLadder}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles size={13} className="text-amber-400" />
                    <span>Gerar Escada 1º, 2º e 3º Lote</span>
                  </button>
                  <button
                    type="button"
                    onClick={addScheduledLot}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>Adicionar Lote Agendado</span>
                  </button>
                </div>
              </div>

              {/* Regra Global de Virada de Lote */}
              <div className="space-y-2.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Escolha a Regra de Virada Automática de Lote:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {[
                    {
                      id: 'quantity_or_date' as BatchTurnTrigger,
                      title: 'Por Quantidade OU Data (Híbrido)',
                      desc: 'Vira automaticamente quando esgotar a quantidade do lote OU quando chegar na data/hora agendada (o que ocorrer primeiro).'
                    },
                    {
                      id: 'quantity' as BatchTurnTrigger,
                      title: 'Somente por Quantidade',
                      desc: 'O próximo lote abre automaticamente no exato segundo em que o lote atual vender 100% da sua carga.'
                    },
                    {
                      id: 'date' as BatchTurnTrigger,
                      title: 'Somente por Data / Hora Agendada',
                      desc: 'Vira pontualmente na data e horário programados no cronograma, encerrando o lote anterior.'
                    },
                    {
                      id: 'manual' as BatchTurnTrigger,
                      title: 'Virada Manual pela Operação',
                      desc: 'Não vira sozinho; aguarda o comando manual do produtor ou diretor comercial.'
                    }
                  ].map(rule => {
                    const active = globalTurnRule === rule.id
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        onClick={() => applyGlobalTurnRule(rule.id)}
                        data-testid={`batch-turn-rule-${rule.id}`}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                          active
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-black text-slate-900 dark:text-white">{rule.title}</span>
                          {active && <Check size={14} className="text-amber-400 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{rule.desc}</p>
                      </button>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-5 pt-1 text-xs text-slate-600 dark:text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rolloverUnsoldQty}
                      onChange={e => setRolloverUnsoldQty(e.target.checked)}
                      className="rounded text-amber-500"
                    />
                    <span className="font-semibold">
                      Transferir saldo remanescente não vendido para o próximo lote quando virar por data
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rules.whatsappTurnNotification}
                      onChange={e => updateRules({ whatsappTurnNotification: e.target.checked })}
                      className="rounded text-amber-500"
                    />
                    <span className="font-semibold">
                      Notificar produtor quando o lote atingir 85% da quantidade ou 24h antes da virada
                    </span>
                  </label>
                </div>
              </div>

              {/* Fila Encadeada de Lotes */}
              <div className="space-y-3">
                {lots.map((lot, idx) => {
                  const activeMods = modalities.filter(m => m.enabled)
                  return (
                    <div
                      key={lot.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 space-y-3 relative"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                            {idx + 1}º
                          </span>
                          <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                            {lot.status === 'ativo' ? 'LOTE DE ABERTURA IMEDIATA' : 'LOTE AGENDADO NA FILA AUTOMÁTICA'}
                          </span>
                          {lot.nextLotId && (
                            <span className="text-[11px] font-semibold text-slate-400">
                              ➔ Vira para:{' '}
                              <strong className="text-slate-200">
                                {lots.find(x => x.id === lot.nextLotId)?.name || 'Próximo Lote'}
                              </strong>
                            </span>
                          )}
                        </div>
                        {lots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLot(lot.id)}
                            className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} />
                            <span>Remover Lote</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                        <div className="lg:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Identificação do Lote
                          </label>
                          <input
                            type="text"
                            value={lot.name}
                            onChange={e => updateLot(lot.id, { name: e.target.value })}
                            className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Setor do Mapa
                          </label>
                          <select
                            value={lot.sector}
                            onChange={e => updateLot(lot.id, { sector: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          >
                            {seatingMap.sectors.map(s => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                            <option value="Pista / Geral">Pista / Geral</option>
                            <option value="Área VIP / Frontstage">Área VIP / Frontstage</option>
                            <option value="Camarote">Camarote</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Valor Base Inteira (R$)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="5"
                            value={lot.basePriceBRL}
                            onChange={e => updateLot(lot.id, { basePriceBRL: Math.max(0, Number(e.target.value)) })}
                            className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Qtd. para Virar Lote
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={lot.quantity}
                            onChange={e => updateLot(lot.id, { quantity: Math.max(1, Number(e.target.value)) })}
                            className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Gatilho de Virada
                          </label>
                          <select
                            value={lot.turnTrigger}
                            onChange={e => updateLot(lot.id, { turnTrigger: e.target.value as BatchTurnTrigger })}
                            className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          >
                            <option value="quantity_or_date">Qtd. OU Data (Automático)</option>
                            <option value="quantity">Ao Esgotar Quantidade</option>
                            <option value="date">Na Data/Hora Agendada</option>
                            <option value="manual">Manual</option>
                          </select>
                        </div>
                      </div>

                      {/* Linha de Agendamento Temporal e Sucessão */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Início Agendado das Vendas
                          </label>
                          <input
                            type="datetime-local"
                            value={lot.startsAt}
                            onChange={e => updateLot(lot.id, { startsAt: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Data/Hora Limite p/ Virada de Lote
                          </label>
                          <input
                            type="datetime-local"
                            value={lot.endsAt}
                            onChange={e => updateLot(lot.id, { endsAt: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Ao Virar, Ativar Automaticamente:
                          </label>
                          <select
                            value={lot.nextLotId || ''}
                            onChange={e => updateLot(lot.id, { nextLotId: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          >
                            <option value="">Encerrar vendas do setor</option>
                            {lots
                              .filter(other => other.id !== lot.id)
                              .map(other => (
                                <option key={other.id} value={other.id}>
                                  {other.name} ({formatBRL(other.basePriceBRL)})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Status Inicial na Fila
                          </label>
                          <select
                            value={lot.status}
                            onChange={e => updateLot(lot.id, { status: e.target.value as EventScheduledLot['status'] })}
                            className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          >
                            <option value="ativo">Ativo na Abertura</option>
                            <option value="agendado">Agendado (Aguardando Virada)</option>
                            <option value="pausado">Pausado Manualmente</option>
                          </select>
                        </div>
                      </div>

                      {/* Tabela automática de valores por modalidade neste lote */}
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400">Preços calculados neste lote:</span>
                        {activeMods.map(m => {
                          const p = lot.basePriceBRL * (1 - (m.discountPercent || 0) / 100)
                          const fee = rules.feePaidBy === 'buyer' ? p * ((rules.convenienceFeePercent || 10) / 100) : 0
                          return (
                            <span
                              key={m.id}
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                            >
                              {m.name.split('(')[0].trim()}: <strong className="text-emerald-400">{formatBRL(p)}</strong>
                              {fee > 0 && <span className="text-[10px] text-slate-400"> (+{formatBRL(fee)} taxa)</span>}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* =====================================================================
              SEÇÃO 5: MÉTODOS DE PAGAMENTO (PIX, DÉBITO, CRÉDITO ATÉ 12X, BANDEIRAS E GATEWAY)
          ===================================================================== */}
          {showSection(5) && (
            <section
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5"
              data-testid="section-payment-methods"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center font-bold">
                    <CreditCard size={19} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                      Etapa 5 de 6 • Checkout, Adquirência & Parcelamento
                    </span>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      Métodos de Pagamento (PIX, Cartão de Débito e Crédito até 12x), Bandeiras e Gateways
                    </h2>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Gateway Ativo: {GATEWAYS_CATALOG.find(g => g.id === payment.primaryGateway)?.name || payment.primaryGateway}
                </span>
              </div>

              {/* 5.1 Cards de Métodos: PIX, Cartão de Débito e Cartão de Crédito */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* PIX */}
                <div
                  className={`p-4 rounded-xl border transition space-y-3 ${
                    payment.pixEnabled
                      ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-950/15'
                      : 'border-slate-200 dark:border-slate-800 opacity-65'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode size={18} className="text-emerald-400" />
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">PIX Instantâneo</h3>
                    </div>
                    <input
                      type="checkbox"
                      checked={payment.pixEnabled}
                      onChange={e => updatePayment({ pixEnabled: e.target.checked })}
                      className="h-4 w-4 rounded text-emerald-500 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Liquidação em segundos com QR Code dinâmico e liberação imediata do ingresso.
                  </p>
                  {payment.pixEnabled && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Tempo de Expiração do QR Code PIX
                        </label>
                        <select
                          value={payment.pixExpirationMinutes}
                          onChange={e => updatePayment({ pixExpirationMinutes: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          <option value={10}>10 minutos (Alta rotatividade)</option>
                          <option value={15}>15 minutos (Recomendado)</option>
                          <option value={30}>30 minutos</option>
                          <option value={60}>60 minutos</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Desconto Incentivo no PIX (%)
                        </label>
                        <select
                          value={payment.pixDiscountPercent}
                          onChange={e => updatePayment({ pixDiscountPercent: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          <option value={0}>Sem desconto adicional (0%)</option>
                          <option value={3}>3% de desconto no PIX</option>
                          <option value={5}>5% de desconto no PIX</option>
                          <option value={10}>10% de desconto no PIX</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* CARTÃO DE DÉBITO */}
                <div
                  className={`p-4 rounded-xl border transition space-y-3 ${
                    payment.debitCardEnabled
                      ? 'border-sky-500/50 bg-sky-500/5 dark:bg-sky-950/15'
                      : 'border-slate-200 dark:border-slate-800 opacity-65'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet size={18} className="text-sky-400" />
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">Cartão de Débito</h3>
                    </div>
                    <input
                      type="checkbox"
                      checked={payment.debitCardEnabled}
                      onChange={e => updatePayment({ debitCardEnabled: e.target.checked })}
                      className="h-4 w-4 rounded text-sky-500 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pagamento à vista no débito online (Visa Electron, Maestro, Elo Débito) e PDV.
                  </p>
                  {payment.debitCardEnabled && (
                    <div className="space-y-2 pt-1">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={payment.debitRequire3DS}
                          onChange={e => updatePayment({ debitRequire3DS: e.target.checked })}
                          className="rounded text-sky-500"
                        />
                        <span>Exigir Autenticação 3DS 2.0 (Zero Risco de Chargeback)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={payment.digitalWalletsEnabled}
                          onChange={e => updatePayment({ digitalWalletsEnabled: e.target.checked })}
                          className="rounded text-sky-500"
                        />
                        <span>Habilitar Apple Pay & Google Pay</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* CARTÃO DE CRÉDITO (1X ATÉ 12X) */}
                <div
                  className={`p-4 rounded-xl border transition space-y-3 ${
                    payment.creditCardEnabled
                      ? 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-950/15'
                      : 'border-slate-200 dark:border-slate-800 opacity-65'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard size={18} className="text-amber-400" />
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        Cartão de Crédito (Até {payment.maxInstallments}x)
                      </h3>
                    </div>
                    <input
                      type="checkbox"
                      checked={payment.creditCardEnabled}
                      onChange={e => updatePayment({ creditCardEnabled: e.target.checked })}
                      className="h-4 w-4 rounded text-amber-500 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Venda à vista ou parcelada em até 12x com escolha de bandeiras, juros e gateway.
                  </p>
                  {payment.creditCardEnabled && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Limite Máximo de Parcelas (1x a 12x)
                        </label>
                        <select
                          value={payment.maxInstallments}
                          onChange={e => {
                            const max = Number(e.target.value)
                            updatePayment({
                              maxInstallments: max,
                              interestFreeInstallments: Math.min(payment.interestFreeInstallments, max)
                            })
                          }}
                          data-testid="select-max-installments"
                          className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          {Array.from({ length: 12 }).map((_, i) => {
                            const n = i + 1
                            return (
                              <option key={n} value={n}>
                                {n === 1 ? 'Somente 1x à vista no Crédito' : `Parcelamento em até ${n}x no Cartão de Crédito`}
                              </option>
                            )
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Parcelas Sem Juros para o Comprador
                        </label>
                        <select
                          value={payment.interestFreeInstallments}
                          onChange={e => updatePayment({ interestFreeInstallments: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                          {Array.from({ length: payment.maxInstallments }).map((_, i) => {
                            const n = i + 1
                            return (
                              <option key={n} value={n}>
                                {n === 1
                                  ? `1x sem juros (${payment.maxInstallments > 1 ? `2x a ${payment.maxInstallments}x com juros` : 'À vista'})`
                                  : n === payment.maxInstallments
                                  ? `Todas as ${n}x sem juros para o cliente`
                                  : `Até ${n}x sem juros (${n + 1}x a ${payment.maxInstallments}x com juros)`}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 5.2 Seletor Rápido Visual de Parcelas (Botões 1x até 12x) + Simulador */}
              {payment.creditCardEnabled && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block">
                        Configuração Rápida de Parcelamento no Cartão de Crédito (1x até 12x)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Clique no número máximo de parcelas permitido no checkout deste evento:
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400">Juros a.m.:</span>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        max={10}
                        value={payment.monthlyInterestRatePercent}
                        onChange={e => updatePayment({ monthlyInterestRatePercent: Number(e.target.value) })}
                        className="w-16 px-2 py-1 text-xs font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  {/* Botões 1x a 12x */}
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const n = idx + 1
                      const selected = payment.maxInstallments === n
                      const activeRange = n <= payment.maxInstallments
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() =>
                            updatePayment({
                              maxInstallments: n,
                              interestFreeInstallments: Math.min(payment.interestFreeInstallments, n)
                            })
                          }
                          data-testid={`installment-btn-${n}x`}
                          className={`py-2 rounded-lg text-xs font-black border transition cursor-pointer ${
                            selected
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm scale-105'
                              : activeRange
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {n}x
                        </button>
                      )
                    })}
                  </div>

                  {/* Simulador das parcelas para o 1º Lote */}
                  <div className="pt-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      Simulação Real no Checkout (Base 1º Lote: {formatBRL(firstLotPrice)})
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {installmentSimulation.map(item => (
                        <div
                          key={item.n}
                          className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-slate-900 dark:text-white">{item.n}x</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                item.hasInterest
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'bg-emerald-500/15 text-emerald-400'
                              }`}
                            >
                              {item.hasInterest ? 'c/ juros' : 'sem juros'}
                            </span>
                          </div>
                          <div className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                            {formatBRL(item.installmentValue)}
                          </div>
                          <div className="text-[10px] text-slate-400">Total: {formatBRL(item.totalValue)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 5.3 Seleção de Bandeiras de Cartão Aceitas no Evento */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Bandeiras de Cartão Habilitadas no Evento ({payment.cardBrands.length} selecionadas)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Escolha quais bandeiras de cartão de crédito e débito serão aceitas neste evento:
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updatePayment({ cardBrands: CARD_BRANDS_CATALOG.map(b => b.id) })}
                      className="text-xs font-bold text-cyan-400 hover:underline cursor-pointer"
                    >
                      Marcar Todas
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => updatePayment({ cardBrands: ['visa', 'mastercard', 'elo', 'amex'] })}
                      className="text-xs font-bold text-slate-400 hover:underline cursor-pointer"
                    >
                      Principais (Visa/Master/Elo/Amex)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                  {CARD_BRANDS_CATALOG.map(brand => {
                    const active = payment.cardBrands.includes(brand.id)
                    return (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() => toggleCardBrand(brand.id)}
                        data-testid={`card-brand-${brand.id}`}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                          active
                            ? 'border-cyan-500 bg-cyan-500/10 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${brand.tone}`}>
                            {brand.badge}
                          </span>
                          {active && <CheckCircle2 size={14} className="text-cyan-400" />}
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 dark:text-white">{brand.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {brand.supportsDebit ? 'Crédito & Débito' : 'Somente Crédito'}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 5.4 Seleção de Gateway de Pagamento Principal, PIX e Contingência */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Escolha do Gateway de Pagamento e Adquirente do Evento
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Defina por qual gateway e adquirente as transações de Cartão e PIX deste evento serão processadas:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {GATEWAYS_CATALOG.map(gw => {
                    const active = payment.primaryGateway === gw.id
                    return (
                      <button
                        key={gw.id}
                        type="button"
                        onClick={() => updatePayment({ primaryGateway: gw.id })}
                        data-testid={`gateway-${gw.id}`}
                        className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                          active
                            ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-400'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-extrabold text-amber-400 uppercase">{gw.tag}</span>
                            {active && <CheckCircle2 size={15} className="text-amber-400 shrink-0" />}
                          </div>
                          <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">{gw.name}</div>
                          <div className="text-[11px] font-semibold text-emerald-400 mt-0.5">{gw.feeInfo}</div>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {gw.supports.map(s => (
                            <span
                              key={s}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Roteamento de Contingência e Antifraude */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Gateway Dedicado para PIX
                    </label>
                    <select
                      value={payment.pixGateway}
                      onChange={e => updatePayment({ pixGateway: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      <option value="same">Usar o mesmo Gateway Principal ({payment.primaryGateway.toUpperCase()})</option>
                      <option value="asaas">Asaas PIX Instantâneo (Taxa Reduzida)</option>
                      <option value="pagarme">Pagar.me Stone PIX</option>
                      <option value="mercadopago">Mercado Pago PIX Direto</option>
                      <option value="banco_inter">API PIX Direto Banco Inter / Santander</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Gateway de Contingência (Fallback Anti-Queda)
                    </label>
                    <select
                      value={payment.fallbackGateway}
                      onChange={e => updatePayment({ fallbackGateway: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      <option value="rede">e.Rede Itaú (Retentativa Automática)</option>
                      <option value="cielo">Cielo 3.0 (Retentativa Automática)</option>
                      <option value="pagarme">Pagar.me Stone</option>
                      <option value="stripe">Stripe Brasil</option>
                      <option value="none">Desativado (Sem retentativa multi-adquirente)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Motor Antifraude doEvento
                    </label>
                    <select
                      value={payment.antifraudProvider}
                      onChange={e => updatePayment({ antifraudProvider: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      <option value="clearsale">ClearSale Total + Score Biométrico</option>
                      <option value="konduto">Konduto AI Real-Time</option>
                      <option value="cybersource">Cybersource Visa Enterprise</option>
                      <option value="gateway_3ds">Antifraude Nativo do Gateway + 3DS 2.0</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* =====================================================================
              SEÇÃO 6: REGRAS DE COMPRA, BIOMETRIA FACIAL, TAXAS & PUBLICAÇÃO
          ===================================================================== */}
          {showSection(6) && (
            <section
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4"
              data-testid="section-operational-rules"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center font-bold">
                    <ShieldCheck size={19} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                      Etapa 6 de 6 • Segurança, Taxas Comerciais & Publicação
                    </span>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      Controle de Acesso, Biometria Facial, Limite por CPF e Taxa de Conveniência
                    </h2>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Taxa de Conveniência (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step="0.5"
                    value={rules.convenienceFeePercent}
                    onChange={e => updateRules({ convenienceFeePercent: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Quem Paga a Taxa de Conveniência
                  </label>
                  <select
                    value={rules.feePaidBy}
                    onChange={e => updateRules({ feePaidBy: e.target.value as 'buyer' | 'producer' })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="buyer">Repassada ao Comprador no Checkout</option>
                    <option value="producer">Absorvida pelo Produtor (Sem taxa na vitrine)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Limite Máximo de Ingressos por CPF
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={rules.maxTicketsPerCpf}
                    onChange={e => updateRules({ maxTicketsPerCpf: Math.max(1, Number(e.target.value)) })}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Classificação Indicativa
                  </label>
                  <select
                    value={rules.ageRating}
                    onChange={e => updateRules({ ageRating: e.target.value as EventOperationalRules['ageRating'] })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="Livre">Livre para todos os públicos</option>
                    <option value="10+">10 anos</option>
                    <option value="12+">12 anos</option>
                    <option value="14+">14 anos</option>
                    <option value="16+">16 anos</option>
                    <option value="18+">18 anos (Proibido menores)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules.facialRecognitionEnabled}
                    onChange={e => updateRules({ facialRecognitionEnabled: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded text-cyan-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ScanFace size={15} className="text-cyan-400" />
                      Validação de Acesso por Biometria Facial (SafeSaff FaceID)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Habilita check-in facial nas catracas e bloqueia cambismo automatizado.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules.dynamicQrCodeAntiPrint}
                    onChange={e => updateRules({ dynamicQrCodeAntiPrint: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded text-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Lock size={15} className="text-amber-400" />
                      QR Code Dinâmico Anti-Print (Rotação TOTP 30s)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Impede entrada com captura de tela (print) estática falsificada.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules.nominalTicketsRequired}
                    onChange={e => updateRules({ nominalTicketsRequired: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded text-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Ingressos 100% Nominais por CPF
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Exige Nome Completo e CPF individual de cada portador antes da emissão do QR Code.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules.allowTicketTransfer}
                    onChange={e => updateRules({ allowTicketTransfer: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded text-purple-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Permitir Transferência de Titularidade pelo App (Até {rules.transferDeadlineHoursBefore}h antes)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      O titular pode transferir o ingresso com segurança e rastreio de auditoria.
                    </span>
                  </div>
                </label>
              </div>

              {/* Status e Visibilidade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status de Publicação
                  </label>
                  <select
                    value={form.status}
                    onChange={e => updateField('status', e.target.value as EventStatus)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="ativo">Ativo — Vendas Liberadas Conforme Cronograma</option>
                    <option value="rascunho">Rascunho — Em Preparação Interna</option>
                    <option value="inativo">Inativo / Pausado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Visibilidade na Loja
                  </label>
                  <select
                    value={form.visibility || 'publico'}
                    onChange={e => updateField('visibility', e.target.value as 'publico' | 'privado')}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="publico">Público — Listado no Portal DiskIngressos</option>
                    <option value="privado">Privado — Acesso Somente via Link Exclusivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tema Visual do Card
                  </label>
                  <select
                    value={form.cover || 'symphonic'}
                    onChange={e => updateField('cover', e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="symphonic">Sinfônico / Teatro Gold</option>
                    <option value="rock">Show & Arena Neon</option>
                    <option value="nature">Festival Open Air</option>
                    <option value="comedy">Stand-up & Teatro</option>
                    <option value="custom">Corporativo / Custom</option>
                  </select>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* =====================================================================
            COLUNA LATERAL: RESUMO EXECUTIVO 360° EM TEMPO REAL
        ===================================================================== */}
        <aside className="xl:col-span-4 space-y-4 sticky top-4">
          <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-5 text-white shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block">
                  Resumo Operacional do Evento
                </span>
                <h3 className="text-base font-black text-white">
                  {form.title || 'Novo Evento em Configuração'}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {form.status}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Local:</span>
                <strong className="text-white text-right">{form.venue || 'Não informado'}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Cidade / Data:</span>
                <strong className="text-white">
                  {form.city} • {form.date}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Tipo de Mapa:</span>
                <strong className="text-purple-400">
                  {seatingMap.mode === 'marked'
                    ? 'Com Lugar Marcado (Numerado)'
                    : seatingMap.mode === 'unmarked'
                    ? 'Sem Lugar Marcado (Livre)'
                    : 'Mapa Híbrido'}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Setores no Mapa:</span>
                <strong className="text-white">
                  {seatingMap.sectors.length} setores ({totalMapCapacity.toLocaleString('pt-BR')} lug.)
                </strong>
              </div>
            </div>

            {/* Resumo de Lotes & Virada */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Layers size={14} /> Lotes & Virada Agendada
                </span>
                <span className="font-black text-white">{lots.length} lotes</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Regra:{' '}
                <strong className="text-slate-200">
                  {globalTurnRule === 'quantity_or_date'
                    ? 'Virada por Quantidade OU Data'
                    : globalTurnRule === 'quantity'
                    ? 'Virada por Quantidade'
                    : globalTurnRule === 'date'
                    ? 'Virada por Data Agendada'
                    : 'Manual'}
                </strong>
              </p>
              <div className="space-y-1 pt-1">
                {lots.map(l => (
                  <div key={l.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 truncate max-w-[165px]">{l.name}</span>
                    <span className="text-slate-400">
                      {l.quantity} un. × <strong className="text-emerald-400">{formatBRL(l.basePriceBRL)}</strong>
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Potencial Bruto dos Lotes:</span>
                <strong className="text-emerald-400 text-sm">{formatBRL(potentialGrossRevenue)}</strong>
              </div>
            </div>

            {/* Resumo de Pagamentos, Bandeiras e Gateway */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <CreditCard size={14} /> Pagamentos & Gateway
                </span>
                <span className="text-[11px] font-extrabold text-amber-400 uppercase">
                  {payment.primaryGateway}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {payment.pixEnabled && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                    PIX ({payment.pixExpirationMinutes}min)
                  </span>
                )}
                {payment.debitCardEnabled && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300">
                    Cartão Débito
                  </span>
                )}
                {payment.creditCardEnabled && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                    Crédito até {payment.maxInstallments}x ({payment.interestFreeInstallments}x s/ juros)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 pt-1">
                Bandeiras:{' '}
                <strong className="text-slate-200 uppercase">
                  {payment.cardBrands.join(', ')}
                </strong>
              </div>
            </div>

            {/* Resumo das Modalidades */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <span className="text-xs font-bold text-emerald-400 block">
                Modalidades Habilitadas ({modalities.filter(m => m.enabled).length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {modalities
                  .filter(m => m.enabled)
                  .map(m => (
                    <span
                      key={m.id}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700"
                    >
                      {m.name.split('(')[0].trim()} ({m.discountPercent === 0 ? '100%' : `-${m.discountPercent}%`})
                    </span>
                  ))}
              </div>
            </div>

            <button
              type="button"
              onClick={submit}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save size={18} />
              <span>{mode === 'new' ? 'Publicar e Salvar Novo Evento' : 'Salvar Alterações do Evento'}</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
