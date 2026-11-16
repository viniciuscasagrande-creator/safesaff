import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlignCenterHorizontal,
  CheckCircle2,
  Compass,
  Crosshair,
  Eye,
  Grid,
  Hand,
  Layers,
  Lock,
  MousePointer,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Square,
  Tag,
  Ticket,
  Trash2,
  Unlock,
  Upload,
  UserCheck,
  Users,
  Wand2,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import type {
  SeatShapeType,
  SeatStatusType,
  SeatmapSeatPoint,
  SeatmapZoneElement
} from '../../data/events'
import {
  safesaffSeatmapEngine,
  type SeatTicketBinding,
  type SeatmapLotRule
} from '../../services/safesaffSeatmapEngine.service'

export type SeatsIoMode = 'designer' | 'event_manager' | 'checkout_preview'

export type SeatsIoDesignerTool =
  | 'select_lasso'
  | 'pan'
  | 'draw_row'
  | 'draw_block'
  | 'draw_table'
  | 'draw_ga_zone'
  | 'focal_point'
  | 'eraser'

export type SeatsIoChannelKey = 'online_web' | 'box_office_pos' | 'promoters' | 'courtesy_vip'

export interface SeatsIoCategory {
  id: string
  name: string
  color: string
  priceBRL: number
  halfPriceBRL: number
  lotId: string
  isAccessible?: boolean
}

export const DEFAULT_SEATSIO_CATEGORIES: SeatsIoCategory[] = [
  {
    id: 'cat-premium',
    name: 'Plateia Premium (Ouro)',
    color: '#2563EB',
    priceBRL: 180,
    halfPriceBRL: 90,
    lotId: 'lot-premium-1'
  },
  {
    id: 'cat-central',
    name: 'Plateia Central',
    color: '#0284C7',
    priceBRL: 140,
    halfPriceBRL: 70,
    lotId: 'lot-central-1'
  },
  {
    id: 'cat-lateral',
    name: 'Plateia Lateral A / C',
    color: '#4F46E5',
    priceBRL: 110,
    halfPriceBRL: 55,
    lotId: 'lot-lateral-1'
  },
  {
    id: 'cat-camarote',
    name: 'Camarote / Box VIP',
    color: '#7C3AED',
    priceBRL: 220,
    halfPriceBRL: 110,
    lotId: 'lot-camarote-1'
  },
  {
    id: 'cat-pcd',
    name: 'Acessível PCD / Acompanhante ♿',
    color: '#0891B2',
    priceBRL: 70,
    halfPriceBRL: 70,
    lotId: 'lot-central-1',
    isAccessible: true
  }
]

// 5 Cores Oficiais de Disponibilidade / Seleção do Motor Próprio SafeSaff
export const SAFESAFF_5_STATE_COLORS = {
  available: {
    label: 'Disponível',
    hex: '#2563EB', // Azul
    border: '#60A5FA',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40'
  },
  selected: {
    label: 'Selecionado',
    hex: '#10B981', // Verde Esmeralda Brilhante
    border: '#A7F3D0',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  },
  sold: {
    label: 'Vendido',
    hex: '#DC2626', // Vermelho
    border: '#FCA5A5',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
  },
  reserved: {
    label: 'Reservado (Hold)',
    hex: '#EA580C', // Laranja / Âmbar
    border: '#FDBA74',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  },
  blocked: {
    label: 'Bloqueado',
    hex: '#0F172A', // Grafite Escuro / Preto
    border: '#475569',
    badgeBg: 'bg-slate-800 text-slate-300 border-slate-600'
  }
}

export const SEATSIO_CHANNELS: {
  key: SeatsIoChannelKey
  name: string
  color: string
  badge: string
}[] = [
  { key: 'online_web', name: 'Site & App Oficial (Online)', color: '#3B82F6', badge: 'WEB' },
  { key: 'box_office_pos', name: 'Bilheteria Física & PDV', color: '#10B981', badge: 'PDV' },
  { key: 'promoters', name: 'Promoters & Afiliados', color: '#F59E0B', badge: 'PRM' },
  { key: 'courtesy_vip', name: 'Cortesia & Patrocinadores', color: '#EC4899', badge: 'VIP' }
]

interface Props {
  mode: SeatsIoMode
  onModeChange: (m: SeatsIoMode) => void
  seats: SeatmapSeatPoint[]
  zones: SeatmapZoneElement[]
  onCommitSeats: (nextSeats: SeatmapSeatPoint[]) => void
  onCommitZones: (nextZones: SeatmapZoneElement[]) => void
  bgDataUrl?: string
  bgWidthPx: number
  bgHeightPx: number
  bgOpacity: number
  seatShape: SeatShapeType
  onShapeChange: (s: SeatShapeType) => void
  basePriceBRL: number
  eventCode?: string
  eventTitle?: string
  onOpenBgModal: () => void
  onSwitchToClassicMode: () => void
}

export const SeatsIoChartEngine: React.FC<Props> = ({
  mode,
  onModeChange,
  seats,
  zones,
  onCommitSeats,
  onCommitZones,
  bgDataUrl,
  bgWidthPx,
  bgHeightPx,
  bgOpacity,
  seatShape,
  onShapeChange,
  basePriceBRL,
  eventCode = '4088',
  eventTitle = 'Whindersson Nunes - Isso Definitivamente Não é um Culto',
  onOpenBgModal,
  onSwitchToClassicMode
}) => {
  const [categories, setCategories] = useState<SeatsIoCategory[]>(() =>
    DEFAULT_SEATSIO_CATEGORIES.map((c, idx) =>
      idx === 1 && basePriceBRL > 0
        ? { ...c, priceBRL: basePriceBRL, halfPriceBRL: Math.round(basePriceBRL / 2) }
        : c
    )
  )
  const [activeCategoryId, setActiveCategoryId] = useState<string>('cat-central')
  const [designerTool, setDesignerTool] = useState<SeatsIoDesignerTool>('select_lasso')

  // Vínculos em Tempo Real com Pedidos, Ingressos (8 dígitos), Lotes e Catraca
  const [ticketBindings, setTicketBindings] = useState<Record<string, SeatTicketBinding>>(() =>
    safesaffSeatmapEngine.loadBindings()
  )
  const [lots, setLots] = useState<SeatmapLotRule[]>(() => safesaffSeatmapEngine.loadLots())
  const [livePulseActive, setLivePulseActive] = useState<boolean>(false)

  // Assinatura de sincronização em tempo real sem recarregar a página
  useEffect(() => {
    return safesaffSeatmapEngine.subscribeRealtime(() => {
      setTicketBindings(safesaffSeatmapEngine.loadBindings())
      setLots(safesaffSeatmapEngine.loadLots())
    })
  }, [])

  // Simulador Live Pulse (atualiza disponibilidade em tempo real sem recarregar a página)
  useEffect(() => {
    if (!livePulseActive) return
    const timer = window.setInterval(() => {
      const freeList = seats.filter(s => s.status === 'free')
      if (freeList.length === 0) return
      const randomSeat = freeList[Math.floor(Math.random() * freeList.length)]
      const nextStatus: SeatStatusType = Math.random() > 0.35 ? 'sold' : 'reserved'
      onCommitSeats(
        seats.map(s => (s.id === randomSeat.id ? { ...s, status: nextStatus } : s))
      )
      setBestAvailFeedback(
        `⚡ Tempo Real (Sem Reload): ${randomSeat.sectorName} • ${randomSeat.rowLabel} • ${
          randomSeat.label
        } atualizado para ${nextStatus === 'sold' ? 'VENDIDO' : 'RESERVADO (HOLD)'}.`
      )
    }, 3200)
    return () => window.clearInterval(timer)
  }, [livePulseActive, seats])

  // Seleção múltipla (Marquee Lasso, Shift+Clique, ou Seleção de Fila/Setor)
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
  const [lassoRect, setLassoRect] = useState<{
    startX: number
    startY: number
    curX: number
    curY: number
  } | null>(null)
  const [draggingSelectedSeats, setDraggingSelectedSeats] = useState<{
    originX: number
    originY: number
    initialPositions: Record<string, { x: number; y: number }>
  } | null>(null)

  // Pan e Zoom do Canvas
  const [zoom, setZoom] = useState<number>(68)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState<boolean>(false)
  const [panOrigin, setPanOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [semanticSectorOverview, setSemanticSectorOverview] = useState<boolean>(false)

  // Ponto Focal do Palco
  const [focalPoint, setFocalPoint] = useState<{ x: number; y: number }>({
    x: Math.round(bgWidthPx / 2),
    y: 95
  })

  // Parâmetros do Gerador de Setores, Fileiras Curvas e Assentos
  const [rowBuilderRowsCount, setRowBuilderRowsCount] = useState<number>(3)
  const [rowBuilderSeatsPerRow, setRowBuilderSeatsPerRow] = useState<number>(12)
  const [rowBuilderCurve, setRowBuilderCurve] = useState<number>(16)
  const [rowBuilderSeatSpacing, setRowBuilderSeatSpacing] = useState<number>(22)
  const [rowBuilderRowSpacing, setRowBuilderRowSpacing] = useState<number>(28)
  const [rowBuilderNumbering, setRowBuilderNumbering] = useState<'sequential' | 'odd' | 'even'>('sequential')
  const [rowBuilderSectorName, setRowBuilderSectorName] = useState<string>('PLATEIA B - Central')
  const [rowBuilderStartRowLetter, setRowBuilderStartRowLetter] = useState<string>('A')

  // Parâmetros do Gerador de Mesas
  const [tableSeatsCount, setTableSeatsCount] = useState<number>(8)
  const [tableRadiusPx, setTableRadiusPx] = useState<number>(36)
  const [tablePrefix, setTablePrefix] = useState<string>('MESA VIP')

  // Formulário Rápido de Emissão de Pedido / Ingresso / Reserva no Painel Lateral
  const [issueHolderName, setIssueHolderName] = useState<string>('Carlos Eduardo Mendes')
  const [issueHolderCpf, setIssueHolderCpf] = useState<string>('049.281.938-12')
  const [issueHolderEmail, setIssueHolderEmail] = useState<string>('carlos.mendes@email.com.br')
  const [issueModality, setIssueModality] = useState<
    'INTEIRA' | 'MEIA_ENTRADA' | 'CORTESIA'
  >('INTEIRA')
  const [issueChannel, setIssueChannel] = useState<SeatsIoChannelKey>('online_web')
  const [isIssuingOrder, setIsIssuingOrder] = useState<boolean>(false)

  // Event Manager sub-abas
  const [managerTab, setManagerTab] = useState<
    'inspector' | 'statuses' | 'lots_integration' | 'best_available'
  >('inspector')
  const [seatChannels, setSeatChannels] = useState<Record<string, SeatsIoChannelKey>>({})
  const [activeChannelBrush, setActiveChannelBrush] = useState<SeatsIoChannelKey>('online_web')

  // Best Available
  const [bestAvailCount, setBestAvailCount] = useState<number>(2)
  const [bestAvailCategoryFilter, setBestAvailCategoryFilter] = useState<string>('ALL')
  const [preventOrphanSeat, setPreventOrphanSeat] = useState<boolean>(true)
  const [bestAvailFeedback, setBestAvailFeedback] = useState<string | null>(null)

  // Checkout Preview
  const [buyerSelectedSeats, setBuyerSelectedSeats] = useState<
    Record<string, 'inteira' | 'meia'>
  >({})
  const [buyerCategoryFilter, setBuyerCategoryFilter] = useState<string>('ALL')
  const [hoveredSeat, setHoveredSeat] = useState<SeatmapSeatPoint | null>(null)

  const canvasRef = useRef<HTMLDivElement | null>(null)

  // Resolve a Categoria de cada poltrona
  const resolveSeatCategory = (seat: SeatmapSeatPoint): SeatsIoCategory => {
    if (seat.description?.startsWith('cat-')) {
      const byDesc = categories.find(c => c.id === seat.description)
      if (byDesc) return byDesc
    }
    if (seat.label.includes('♿') || seat.description?.includes('PCD')) {
      return categories.find(c => c.isAccessible) || categories[categories.length - 1]
    }
    const secUpper = seat.sectorName.toUpperCase()
    if (secUpper.includes('CAMAROTE') || secUpper.includes('MESA')) {
      return categories.find(c => c.id === 'cat-camarote') || categories[0]
    }
    if (secUpper.includes('PREMIUM') || ['FILA A', 'FILA B', 'FILA C'].includes(seat.rowLabel)) {
      return categories.find(c => c.id === 'cat-premium') || categories[0]
    }
    if (
      secUpper.includes('LATERAL') ||
      secUpper.includes('PLATEIA A') ||
      secUpper.includes('PLATEIA C')
    ) {
      return categories.find(c => c.id === 'cat-lateral') || categories[2]
    }
    return categories.find(c => c.id === 'cat-central') || categories[1]
  }

  // Assento único selecionado no Inspector Lateral (quando 1 ou mais estão selecionados, foca no primeiro para detalhe individual)
  const primarySelectedSeat = useMemo(() => {
    if (selectedSeatIds.length === 0) return null
    return seats.find(s => s.id === selectedSeatIds[0]) || null
  }, [seats, selectedSeatIds])

  const primarySeatBinding = useMemo(() => {
    if (!primarySelectedSeat) return null
    return ticketBindings[primarySelectedSeat.id] || null
  }, [primarySelectedSeat, ticketBindings])

  // Estatísticas em tempo real (Disponíveis, Selecionados, Vendidos, Reservados, Bloqueados e Check-ins)
  const stats = useMemo(() => {
    const total = seats.length
    const free = seats.filter(s => s.status === 'free').length
    const sold = seats.filter(s => s.status === 'sold').length
    const reserved = seats.filter(s => s.status === 'reserved').length
    const blocked = seats.filter(s => s.status === 'blocked').length
    const selectedCount =
      mode === 'checkout_preview'
        ? Object.keys(buyerSelectedSeats).length
        : selectedSeatIds.length
    const checkedInCount = Object.values(ticketBindings).filter(
      b => b.status === 'CHECKED_IN'
    ).length

    const byCategory: Record<string, { total: number; free: number }> = {}
    categories.forEach(c => {
      byCategory[c.id] = { total: 0, free: 0 }
    })
    seats.forEach(s => {
      const cat = resolveSeatCategory(s)
      if (!byCategory[cat.id]) byCategory[cat.id] = { total: 0, free: 0 }
      byCategory[cat.id].total += 1
      if (s.status === 'free') byCategory[cat.id].free += 1
    })

    return {
      total,
      free,
      sold,
      reserved,
      blocked,
      selectedCount,
      checkedInCount,
      byCategory
    }
  }, [seats, categories, selectedSeatIds, buyerSelectedSeats, mode, ticketBindings])

  // Lista única de Setores e Fileiras existentes no Mapa
  const distinctSectors = useMemo(() => {
    const set = new Set<string>()
    seats.forEach(s => set.add(s.sectorName))
    return Array.from(set)
  }, [seats])

  // Agrupamento de setores para Semantic Zoom (LOD)
  const sectorClusters = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string
        minX: number
        maxX: number
        minY: number
        maxY: number
        total: number
        free: number
        sold: number
        minPrice: number
        color: string
      }
    >()
    seats.forEach(s => {
      const cat = resolveSeatCategory(s)
      const cur = map.get(s.sectorName)
      if (!cur) {
        map.set(s.sectorName, {
          name: s.sectorName,
          minX: s.x,
          maxX: s.x,
          minY: s.y,
          maxY: s.y,
          total: 1,
          free: s.status === 'free' ? 1 : 0,
          sold: s.status === 'sold' ? 1 : 0,
          minPrice: cat.halfPriceBRL,
          color: cat.color
        })
      } else {
        cur.minX = Math.min(cur.minX, s.x)
        cur.maxX = Math.max(cur.maxX, s.x)
        cur.minY = Math.min(cur.minY, s.y)
        cur.maxY = Math.max(cur.maxY, s.y)
        cur.total += 1
        if (s.status === 'free') cur.free += 1
        if (s.status === 'sold') cur.sold += 1
        cur.minPrice = Math.min(cur.minPrice, cat.halfPriceBRL)
      }
    })
    return Array.from(map.values())
  }, [seats, categories])

  // Regra Anti-Assento Isolado (Orphan Seat Rule)
  const orphanSeatWarnings = useMemo(() => {
    if (!preventOrphanSeat) return []
    const buyerIds = new Set(Object.keys(buyerSelectedSeats))
    if (buyerIds.size === 0) return []

    const rowsMap = new Map<string, SeatmapSeatPoint[]>()
    seats.forEach(s => {
      const key = `${s.sectorName}::${s.rowLabel}`
      const arr = rowsMap.get(key) || []
      arr.push(s)
      rowsMap.set(key, arr)
    })

    const warnings: string[] = []
    rowsMap.forEach(rowSeats => {
      if (!rowSeats.some(s => buyerIds.has(s.id))) return
      const sorted = [...rowSeats].sort((a, b) => a.seatNumber - b.seatNumber)
      for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i]
        const isCurEmpty = cur.status === 'free' && !buyerIds.has(cur.id)
        if (!isCurEmpty) continue

        const leftOccupied =
          i === 0 || sorted[i - 1].status !== 'free' || buyerIds.has(sorted[i - 1].id)
        const rightOccupied =
          i === sorted.length - 1 ||
          sorted[i + 1].status !== 'free' ||
          buyerIds.has(sorted[i + 1].id)

        const adjacentToBuyer =
          (i > 0 && buyerIds.has(sorted[i - 1].id)) ||
          (i < sorted.length - 1 && buyerIds.has(sorted[i + 1].id))

        if (leftOccupied && rightOccupied && adjacentToBuyer) {
          warnings.push(`${cur.sectorName} • ${cur.rowLabel} • ${cur.label}`)
        }
      }
    })
    return warnings
  }, [seats, buyerSelectedSeats, preventOrphanSeat])

  // Atualizar propriedade individual ou em lote dos assentos selecionados
  const updateSelectedSeats = (patch: Partial<SeatmapSeatPoint>) => {
    if (selectedSeatIds.length === 0) return
    const selSet = new Set(selectedSeatIds)
    onCommitSeats(seats.map(s => (selSet.has(s.id) ? { ...s, ...patch } : s)))
  }

  // Selecionar toda a Fileira ou todo o Setor do assento atual
  const selectEntireRow = (sectorName: string, rowLabel: string) => {
    const ids = seats
      .filter(s => s.sectorName === sectorName && s.rowLabel === rowLabel)
      .map(s => s.id)
    setSelectedSeatIds(ids)
    setBestAvailFeedback(
      `Selecionados todos os ${ids.length} assentos da ${rowLabel} (${sectorName}).`
    )
  }

  const selectEntireSector = (sectorName: string) => {
    const ids = seats.filter(s => s.sectorName === sectorName).map(s => s.id)
    setSelectedSeatIds(ids)
    setBestAvailFeedback(
      `Selecionados todos os ${ids.length} assentos do setor ${sectorName}.`
    )
  }

  // Alinhar Horizontalmente (mesmo Y) e Distribuir Uniformemente (eixo X) os assentos selecionados
  const alignSelectedSeatsHorizontally = () => {
    if (selectedSeatIds.length < 2) return
    const selSet = new Set(selectedSeatIds)
    const selectedList = seats
      .filter(s => selSet.has(s.id))
      .sort((a, b) => a.x - b.x)
    const avgY = Number(
      (
        selectedList.reduce((acc, s) => acc + s.y, 0) / selectedList.length
      ).toFixed(2)
    )
    const minX = selectedList[0].x
    const maxX = selectedList[selectedList.length - 1].x
    const stepX =
      selectedList.length > 1 ? (maxX - minX) / (selectedList.length - 1) : 22

    const posMap = new Map<string, { x: number; y: number }>()
    selectedList.forEach((s, idx) => {
      posMap.set(s.id, {
        x: Number((minX + idx * stepX).toFixed(2)),
        y: avgY
      })
    })

    onCommitSeats(
      seats.map(s => {
        const p = posMap.get(s.id)
        return p ? { ...s, x: p.x, y: p.y } : s
      })
    )
    setBestAvailFeedback(
      `${selectedList.length} assentos alinhados e espaçados uniformemente.`
    )
  }

  // Orientar poltronas para o Ponto Focal no Palco
  const orientSeatsToFocalPoint = (onlySelected: boolean) => {
    const selSet = new Set(selectedSeatIds)
    const next = seats.map(s => {
      if (onlySelected && selSet.size > 0 && !selSet.has(s.id)) return s
      const dx = focalPoint.x - s.x
      const dy = focalPoint.y - s.y
      const angleDeg = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI)
      return { ...s, rotation: angleDeg }
    })
    onCommitSeats(next)
    setBestAvailFeedback(
      onlySelected && selSet.size > 0
        ? `${selSet.size} poltronas orientadas para o Ponto Focal do Palco.`
        : `Todas as ${seats.length} poltronas foram orientadas para o Ponto Focal do Palco.`
    )
  }

  // Aplicar Categoria às poltronas selecionadas
  const applyCategoryToSelected = (catId: string) => {
    const cat = categories.find(c => c.id === catId)
    if (!cat || selectedSeatIds.length === 0) return
    const selSet = new Set(selectedSeatIds)
    const next = seats.map(s =>
      selSet.has(s.id)
        ? {
            ...s,
            description: cat.id,
            colorHex: cat.color,
            priceBRL: cat.priceBRL
          }
        : s
    )
    onCommitSeats(next)
    setBestAvailFeedback(
      `Categoria "${cat.name}" (R$ ${cat.priceBRL}) atribuída a ${selectedSeatIds.length} assentos.`
    )
  }

  // Aplicar Status em Lote às poltronas selecionadas
  const applyStatusToSelected = (status: SeatStatusType) => {
    if (selectedSeatIds.length === 0) return
    const selSet = new Set(selectedSeatIds)
    onCommitSeats(seats.map(s => (selSet.has(s.id) ? { ...s, status } : s)))
    setBestAvailFeedback(
      `Status atualizado em tempo real para ${selectedSeatIds.length} assento(s) sem recarregar a página.`
    )
  }

  // Emitir Pedido + Ingresso (ou Reserva Hold) real via safesaffSeatmapEngine para os assentos selecionados
  const handleIssueOrderOrHoldForSelection = async (actionMode: 'SELL' | 'RESERVE_HOLD') => {
    const targetSeats = seats.filter(s => selectedSeatIds.includes(s.id))
    if (targetSeats.length === 0) return
    setIsIssuingOrder(true)
    try {
      const firstCat = resolveSeatCategory(targetSeats[0])
      const unitPrice =
        issueModality === 'CORTESIA'
          ? 0
          : issueModality === 'MEIA_ENTRADA'
          ? firstCat.halfPriceBRL
          : firstCat.priceBRL

      const res = await safesaffSeatmapEngine.sellOrReserveSeats({
        seatsToProcess: targetSeats,
        allSeats: seats,
        mode: actionMode,
        eventCode,
        eventName: eventTitle,
        lotId: firstCat.lotId,
        categoryId: firstCat.id,
        categoryName: firstCat.name,
        modality: issueModality,
        unitPriceBRL: unitPrice,
        holderName: issueHolderName,
        holderDocument: issueHolderCpf,
        holderEmail: issueHolderEmail,
        holderPhone: '(41) 99811-2200',
        salesChannel: issueChannel,
        holdMinutes: 15
      })

      onCommitSeats(res.updatedSeats)
      setTicketBindings(safesaffSeatmapEngine.loadBindings())
      setLots(safesaffSeatmapEngine.loadLots())
      setBestAvailFeedback(
        actionMode === 'SELL'
          ? `✅ Pedido ${res.orderId} emitido! ${res.issuedBindings.length} ingresso(s) numerado(s) de 8 dígitos gerados na Central de Ingressos e Controle de Acesso.`
          : `⏳ Reserva Hold (${res.orderId}) criada por 15 minutos para ${res.issuedBindings.length} assento(s).`
      )
    } finally {
      setIsIssuingOrder(false)
    }
  }

  // Algoritmo Best Available
  const runSeatsIoBestAvailable = () => {
    const rowsMap = new Map<string, SeatmapSeatPoint[]>()
    seats.forEach(s => {
      if (s.status !== 'free') return
      if (bestAvailCategoryFilter !== 'ALL') {
        const cat = resolveSeatCategory(s)
        if (cat.id !== bestAvailCategoryFilter) return
      }
      const key = `${s.sectorName}::${s.rowLabel}`
      const arr = rowsMap.get(key) || []
      arr.push(s)
      rowsMap.set(key, arr)
    })

    let bestBlock: SeatmapSeatPoint[] | null = null
    let bestScore = Infinity

    rowsMap.forEach(rowSeats => {
      const sorted = [...rowSeats].sort((a, b) => a.seatNumber - b.seatNumber)
      if (sorted.length < bestAvailCount) return

      for (let i = 0; i <= sorted.length - bestAvailCount; i++) {
        const candidate = sorted.slice(i, i + bestAvailCount)
        let contiguous = true
        for (let k = 1; k < candidate.length; k++) {
          const dist = Math.hypot(
            candidate[k].x - candidate[k - 1].x,
            candidate[k].y - candidate[k - 1].y
          )
          if (dist > 48) {
            contiguous = false
            break
          }
        }
        if (!contiguous) continue

        let orphanPenalty = 0
        if (preventOrphanSeat) {
          const leftRemaining = i
          const rightRemaining = sorted.length - (i + bestAvailCount)
          if (leftRemaining === 1 || rightRemaining === 1) {
            orphanPenalty = 5000
          }
        }

        const avgDist =
          candidate.reduce(
            (acc, s) => acc + Math.hypot(s.x - focalPoint.x, s.y - focalPoint.y),
            0
          ) / candidate.length

        const score = avgDist + orphanPenalty
        if (score < bestScore) {
          bestScore = score
          bestBlock = candidate
        }
      }
    })

    if (!bestBlock) {
      setBestAvailFeedback(
        `Nenhum bloco contíguo de ${bestAvailCount} assento(s) livre(s) encontrado.`
      )
      return
    }

    const found: SeatmapSeatPoint[] = bestBlock
    const ids = found.map(s => s.id)
    setSelectedSeatIds(ids)

    const nextBuyer: Record<string, 'inteira' | 'meia'> = {}
    ids.forEach(id => {
      nextBuyer[id] = 'inteira'
    })
    setBuyerSelectedSeats(nextBuyer)

    const first = found[0]
    const last = found[found.length - 1]
    setBestAvailFeedback(
      `✨ Best Available selecionou ${found.length} lugares: ${first.sectorName} • ${first.rowLabel} (${first.label} a ${last.label})!`
    )
  }

  // Carimbar Bloco de Fileiras Curvas / Setor
  const stampCurvedRowBlockAt = (centerX: number, centerY: number) => {
    const activeCat = categories.find(c => c.id === activeCategoryId) || categories[1]
    const created: SeatmapSeatPoint[] = []
    const rowsTotal = designerTool === 'draw_row' ? 1 : Math.max(1, rowBuilderRowsCount)
    const seatsTotal = Math.max(2, rowBuilderSeatsPerRow)
    const startCharCode = rowBuilderStartRowLetter.trim().toUpperCase().charCodeAt(0) || 65

    for (let r = 0; r < rowsTotal; r++) {
      const rowLetter = String.fromCharCode(startCharCode + r)
      const rowLabel = `FILA ${rowLetter}`
      for (let i = 0; i < seatsTotal; i++) {
        const norm = seatsTotal > 1 ? (i / (seatsTotal - 1)) * 2 - 1 : 0
        const offsetX = norm * ((seatsTotal - 1) * rowBuilderSeatSpacing * 0.5)
        const curveOffsetY = norm * norm * rowBuilderCurve
        const x = Number((centerX + offsetX).toFixed(2))
        const y = Number((centerY + r * rowBuilderRowSpacing + curveOffsetY).toFixed(2))

        const tangentAngle = Math.round(
          (Math.atan2(
            2 * norm * rowBuilderCurve,
            (seatsTotal - 1) * rowBuilderSeatSpacing * 0.5
          ) *
            180) /
            Math.PI
        )

        const seatNumber =
          rowBuilderNumbering === 'odd'
            ? 1 + i * 2
            : rowBuilderNumbering === 'even'
            ? 2 + i * 2
            : i + 1
        const numStr = String(seatNumber).padStart(2, '0')

        created.push({
          id: `${rowBuilderSectorName}:${rowLabel}:Polt. ${numStr}-${Date.now()}-${r}-${i}`,
          label: `Polt. ${numStr}`,
          rowLabel,
          seatNumber,
          sectorId: rowBuilderSectorName,
          sectorName: rowBuilderSectorName,
          x,
          y,
          width: 20,
          height: 27,
          rotation: -tangentAngle,
          nominal: true,
          description: activeCat.id,
          colorHex: activeCat.color,
          shape: seatShape,
          status: 'free',
          priceBRL: activeCat.priceBRL
        })
      }
    }

    onCommitSeats([...seats, ...created])
    setSelectedSeatIds(created.map(s => s.id))
    setBestAvailFeedback(
      `Criado setor/bloco "${rowBuilderSectorName}" com ${rowsTotal} fileira(s) e ${created.length} assentos.`
    )
  }

  // Carimbar Mesa Redonda com Poltronas ao Redor
  const stampRoundTableAt = (centerX: number, centerY: number) => {
    const activeCat = categories.find(c => c.id === activeCategoryId) || categories[3]
    const tableNum = zones.filter(z => z.kind === 'table_center').length + 1
    const tableLabel = `${tablePrefix} ${String(tableNum).padStart(2, '0')}`

    const newZone: SeatmapZoneElement = {
      id: `table-zone-${Date.now()}`,
      kind: 'table_center',
      label: tableLabel,
      x: Math.round(centerX - tableRadiusPx),
      y: Math.round(centerY - tableRadiusPx),
      width: tableRadiusPx * 2,
      height: tableRadiusPx * 2,
      color: activeCat.color,
      capacity: tableSeatsCount
    }

    const chairOrbitRadius = tableRadiusPx + 18
    const createdSeats: SeatmapSeatPoint[] = []
    for (let i = 0; i < tableSeatsCount; i++) {
      const angleRad = (i / tableSeatsCount) * Math.PI * 2 - Math.PI / 2
      const sx = Number((centerX + Math.cos(angleRad) * chairOrbitRadius).toFixed(2))
      const sy = Number((centerY + Math.sin(angleRad) * chairOrbitRadius).toFixed(2))
      const rotDeg = Math.round((angleRad * 180) / Math.PI - 90)
      const seatNum = i + 1
      const numStr = String(seatNum).padStart(2, '0')

      createdSeats.push({
        id: `${tableLabel}:${tableLabel}:Polt. ${numStr}-${Date.now()}-${i}`,
        label: `Polt. ${numStr}`,
        rowLabel: tableLabel,
        seatNumber: seatNum,
        sectorId: 'MESAS VIP BISTRÔ',
        sectorName: 'MESAS VIP BISTRÔ',
        x: sx,
        y: sy,
        width: 20,
        height: 27,
        rotation: rotDeg,
        nominal: true,
        description: activeCat.id,
        colorHex: activeCat.color,
        shape: seatShape,
        status: 'free',
        priceBRL: activeCat.priceBRL
      })
    }

    onCommitZones([...zones, newZone])
    onCommitSeats([...seats, ...createdSeats])
    setSelectedSeatIds(createdSeats.map(s => s.id))
    setBestAvailFeedback(`${tableLabel} criada com ${tableSeatsCount} assentos ao redor.`)
  }

  // Carimbar Área de Pista / General Admission
  const stampGeneralAdmissionZoneAt = (centerX: number, centerY: number) => {
    const activeCat = categories.find(c => c.id === activeCategoryId) || categories[2]
    const gaCount = zones.filter(z => z.kind === 'pista').length + 1
    const newZone: SeatmapZoneElement = {
      id: `ga-zone-${Date.now()}`,
      kind: 'pista',
      label: `ÁREA PISTA / GA ${gaCount} (Cap. 300)`,
      x: Math.round(centerX - 110),
      y: Math.round(centerY - 45),
      width: 220,
      height: 90,
      color: activeCat.color,
      capacity: 300
    }
    onCommitZones([...zones, newZone])
    setBestAvailFeedback(`Área General Admission (Pista) adicionada à planta.`)
  }

  // Mouse handlers do Canvas (Pan, Arraste de Poltronas Selecionadas, Lasso Marquee ou Ferramentas)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (designerTool === 'pan' || e.button === 1) {
      setIsPanning(true)
      setPanOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      return
    }
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    const cx = Number(((e.clientX - rect.left) / scale).toFixed(2))
    const cy = Number(((e.clientY - rect.top) / scale).toFixed(2))

    if (mode === 'designer') {
      if (designerTool === 'focal_point') {
        setFocalPoint({ x: Math.round(cx), y: Math.round(cy) })
        setBestAvailFeedback(
          `Ponto Focal do Palco reposicionado para (${Math.round(cx)}, ${Math.round(cy)}).`
        )
        return
      }
      if (designerTool === 'draw_row' || designerTool === 'draw_block') {
        stampCurvedRowBlockAt(cx, cy)
        return
      }
      if (designerTool === 'draw_table') {
        stampRoundTableAt(cx, cy)
        return
      }
      if (designerTool === 'draw_ga_zone') {
        stampGeneralAdmissionZoneAt(cx, cy)
        return
      }
    }

    if (designerTool === 'select_lasso' && mode !== 'checkout_preview') {
      setLassoRect({ startX: cx, startY: cy, curX: cx, curY: cy })
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({ x: e.clientX - panOrigin.x, y: e.clientY - panOrigin.y })
      return
    }
    if (draggingSelectedSeats && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const scale = zoom / 100
      const cx = (e.clientX - rect.left) / scale
      const cy = (e.clientY - rect.top) / scale
      const dx = cx - draggingSelectedSeats.originX
      const dy = cy - draggingSelectedSeats.originY
      onCommitSeats(
        seats.map(s => {
          const init = draggingSelectedSeats.initialPositions[s.id]
          if (!init) return s
          return {
            ...s,
            x: Number((init.x + dx).toFixed(2)),
            y: Number((init.y + dy).toFixed(2))
          }
        })
      )
      return
    }
    if (!lassoRect || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    const cx = Number(((e.clientX - rect.left) / scale).toFixed(2))
    const cy = Number(((e.clientY - rect.top) / scale).toFixed(2))
    setLassoRect(prev => (prev ? { ...prev, curX: cx, curY: cy } : null))
  }

  const handleCanvasMouseUp = () => {
    if (isPanning) {
      setIsPanning(false)
    }
    if (draggingSelectedSeats) {
      setDraggingSelectedSeats(null)
    }
    if (lassoRect) {
      const minX = Math.min(lassoRect.startX, lassoRect.curX)
      const maxX = Math.max(lassoRect.startX, lassoRect.curX)
      const minY = Math.min(lassoRect.startY, lassoRect.curY)
      const maxY = Math.max(lassoRect.startY, lassoRect.curY)
      if (Math.abs(maxX - minX) > 6 || Math.abs(maxY - minY) > 6) {
        const inside = seats
          .filter(s => s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY)
          .map(s => s.id)
        setSelectedSeatIds(inside)
      }
      setLassoRect(null)
    }
  }

  // Clique e início de arraste em um assento individual
  const handleSeatMouseDown = (e: React.MouseEvent, seat: SeatmapSeatPoint) => {
    if (mode === 'checkout_preview' || designerTool !== 'select_lasso') return
    if (selectedSeatIds.includes(seat.id) && canvasRef.current) {
      e.stopPropagation()
      const rect = canvasRef.current.getBoundingClientRect()
      const scale = zoom / 100
      const cx = (e.clientX - rect.left) / scale
      const cy = (e.clientY - rect.top) / scale
      const initialPositions: Record<string, { x: number; y: number }> = {}
      seats.forEach(s => {
        if (selectedSeatIds.includes(s.id)) {
          initialPositions[s.id] = { x: s.x, y: s.y }
        }
      })
      setDraggingSelectedSeats({ originX: cx, originY: cy, initialPositions })
    }
  }

  const handleSeatClick = (e: React.MouseEvent, seat: SeatmapSeatPoint) => {
    e.stopPropagation()

    if (mode === 'checkout_preview') {
      if (seat.status !== 'free') return
      setBuyerSelectedSeats(prev => {
        const next = { ...prev }
        if (next[seat.id]) {
          delete next[seat.id]
        } else {
          next[seat.id] = 'inteira'
        }
        return next
      })
      return
    }

    if (mode === 'designer' && designerTool === 'eraser') {
      onCommitSeats(seats.filter(s => s.id !== seat.id))
      setSelectedSeatIds(prev => prev.filter(id => id !== seat.id))
      return
    }

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setSelectedSeatIds(prev =>
        prev.includes(seat.id) ? prev.filter(id => id !== seat.id) : [...prev, seat.id]
      )
    } else {
      setSelectedSeatIds([seat.id])
    }
  }

  // Cálculo do Carrinho no Checkout Preview
  const buyerCartItems = useMemo(() => {
    return Object.entries(buyerSelectedSeats)
      .map(([seatId, modality]) => {
        const seat = seats.find(s => s.id === seatId)
        if (!seat) return null
        const cat = resolveSeatCategory(seat)
        const price = modality === 'meia' ? cat.halfPriceBRL : cat.priceBRL
        return { seat, cat, modality, price }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [buyerSelectedSeats, seats, categories])

  const buyerTotalBRL = useMemo(
    () => buyerCartItems.reduce((acc, item) => acc + item.price, 0),
    [buyerCartItems]
  )

  return (
    <div
      className="bg-[#0B0F19] text-slate-100 rounded-xl border border-slate-800 shadow-2xl overflow-hidden select-none"
      data-testid="seatsio-chart-engine"
    >
      {/* =====================================================================
          1. BARRA SUPERIOR DO MOTOR PRÓPRIO SAFESAFF (INSPIRADO NO SEATS.IO)
      ===================================================================== */}
      <div className="bg-[#111827] border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black text-xs tracking-wide shadow">
            <Compass size={15} />
            <span>SafeSaff SeatEngine</span>
            <span className="text-[10px] font-semibold bg-black/30 px-1.5 py-0.5 rounded">
              Padrão Seats.io Nativo
            </span>
          </div>

          {/* 3 Modos Operacionais do Motor */}
          <div className="flex items-center bg-[#0B0F19] p-1 rounded-lg border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => onModeChange('designer')}
              data-testid="seatsio-mode-designer"
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                mode === 'designer'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wand2 size={14} />
              <span>1. Editor Visual de Planta</span>
            </button>

            <button
              type="button"
              onClick={() => onModeChange('event_manager')}
              data-testid="seatsio-mode-manager"
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                mode === 'event_manager'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers size={14} />
              <span>2. Operação, Ingressos & Catraca</span>
            </button>

            <button
              type="button"
              onClick={() => onModeChange('checkout_preview')}
              data-testid="seatsio-mode-checkout"
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                mode === 'checkout_preview'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingCart size={14} />
              <span>3. Checkout Online (Comprador)</span>
            </button>
          </div>
        </div>

        {/* Simulador Tempo Real (Sem Reload) + Upload Planta + Alternância Árvore Clássica */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLivePulseActive(prev => !prev)}
            data-testid="btn-toggle-live-pulse"
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
              livePulseActive
                ? 'bg-emerald-600 text-white border-emerald-400 animate-pulse'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
            title="Atualiza disponibilidade de assentos em tempo real sem recarregar a página"
          >
            <Activity size={13} />
            <span>{livePulseActive ? 'Live Tempo Real: ATIVO' : 'Testar Live Tempo Real'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenBgModal}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Upload size={13} />
            <span>Planta 96 DPI</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToClassicMode}
            data-testid="btn-switch-classic-estrutura"
            className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold text-amber-300 cursor-pointer"
          >
            Árvore Clássica (M/L)
          </button>
        </div>
      </div>

      {/* =====================================================================
          1.5 LEGENDA OFICIAL DE 5 CORES POR STATUS + CONTADORES EM TEMPO REAL
      ===================================================================== */}
      <div className="bg-[#090D16] border-b border-slate-800/90 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Disponibilidade em Tempo Real:
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-300 font-bold text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
            Disponível: {stats.free}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            Selecionado: {stats.selectedCount}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
            Vendido: {stats.sold}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" />
            Reservado (Hold): {stats.reserved}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-slate-300 font-bold text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F172A] border border-slate-400" />
            Bloqueado: {stats.blocked}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold text-[11px]">
            <UserCheck size={12} />
            Check-in Catraca: {stats.checkedInCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSemanticSectorOverview(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
              semanticSectorOverview
                ? 'bg-indigo-600 text-white border-indigo-400'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Eye size={13} />
            <span>{semanticSectorOverview ? 'Visão Macro Setores' : 'Visão de Assentos'}</span>
          </button>

          <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 p-0.5">
            {(
              [
                { id: 'circle' as const, label: 'Bolinha' },
                { id: 'armchair' as const, label: 'Poltrona' },
                { id: 'square' as const, label: 'Quadrado' }
              ] as const
            ).map(sh => (
              <button
                key={sh.id}
                type="button"
                onClick={() => onShapeChange(sh.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                  seatShape === sh.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sh.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {bestAvailFeedback && (
        <div className="bg-indigo-950/90 border-b border-indigo-500/40 px-4 py-2 text-xs text-indigo-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400 shrink-0" />
            <span>{bestAvailFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setBestAvailFeedback(null)}
            className="text-indigo-300 hover:text-white font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Aviso em Tempo Real de Assento Isolado */}
      {mode === 'checkout_preview' && orphanSeatWarnings.length > 0 && (
        <div className="bg-rose-950/95 border-b border-rose-500/50 px-4 py-2 text-xs text-rose-200 flex items-center justify-between">
          <span>
            ⚠️ <strong>Regra Anti-Assento Isolado:</strong> Sua seleção deixa 1 assento vazio isolado em{' '}
            <strong>{orphanSeatWarnings.slice(0, 2).join(', ')}</strong>. Selecione assentos contíguos.
          </span>
        </div>
      )}

      {/* =====================================================================
          2. BARRA DE FILTRO POR SETOR / CATEGORIA & LOTES VINCULADOS
      ===================================================================== */}
      <div className="bg-[#0F172A] border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Tag size={12} /> Setores & Lotes:
          </span>

          <button
            type="button"
            onClick={() => setBuyerCategoryFilter('ALL')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
              buyerCategoryFilter === 'ALL'
                ? 'bg-white text-slate-950 border-white'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            Todos ({stats.free} livres)
          </button>

          {categories.map(cat => {
            const catStat = stats.byCategory[cat.id] || { total: 0, free: 0 }
            const isFilterActive = buyerCategoryFilter === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategoryId(cat.id)
                  setBuyerCategoryFilter(prev => (prev === cat.id ? 'ALL' : cat.id))
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                  isFilterActive
                    ? 'bg-slate-800 text-white border-white ring-1 ring-white'
                    : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:border-slate-500'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span>{cat.name}</span>
                <span className="text-emerald-400 font-bold">R$ {cat.priceBRL}</span>
                <span className="text-[10px] text-slate-400">({catStat.free})</span>
              </button>
            )
          })}
        </div>

        {/* Seleção rápida de todos os livres / limpar */}
        {mode !== 'checkout_preview' && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setSelectedSeatIds(seats.filter(s => s.status === 'free').map(s => s.id))
              }
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 cursor-pointer"
            >
              Selecionar Todos Livres
            </button>
            {selectedSeatIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSeatIds([])}
                className="px-2 py-1 rounded bg-rose-950/80 border border-rose-500/40 text-[11px] font-semibold text-rose-200 cursor-pointer"
              >
                Limpar ({selectedSeatIds.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          3. WORKSPACE PRINCIPAL (DOCK DE DESENHO + CANVAS INTERATIVO + PAINEL DE CONTROLE)
      ===================================================================== */}
      <div className="flex items-stretch h-[700px] relative">
        {/* -----------------------------------------------------------------
            DOCK ESQUERDO DE FERRAMENTAS DE DESENHO & SELEÇÃO
        ----------------------------------------------------------------- */}
        {mode !== 'checkout_preview' && (
          <div className="w-16 bg-[#111827] border-r border-slate-800 flex flex-col items-center py-3 gap-2 shrink-0 z-20">
            {(
              [
                {
                  id: 'select_lasso' as const,
                  icon: MousePointer,
                  label: 'Selecionar / Laço Multi-Assentos e Arrastar (V)',
                  short: 'Seleção'
                },
                {
                  id: 'pan' as const,
                  icon: Hand,
                  label: 'Arrastar Planta (H)',
                  short: 'Mover'
                },
                {
                  id: 'draw_row' as const,
                  icon: Plus,
                  label: 'Criar Fileira de Assentos (R)',
                  short: '+ Fileira'
                },
                {
                  id: 'draw_block' as const,
                  icon: Grid,
                  label: 'Criar Setor / Bloco de Fileiras Curvas (B)',
                  short: '+ Setor'
                },
                {
                  id: 'draw_table' as const,
                  icon: Users,
                  label: 'Criar Mesa com Assentos (T)',
                  short: '+ Mesa'
                },
                {
                  id: 'draw_ga_zone' as const,
                  icon: Square,
                  label: 'Criar Área Pista / Sem Lugar Marcado (G)',
                  short: '+ Pista'
                },
                {
                  id: 'focal_point' as const,
                  icon: Crosshair,
                  label: 'Posicionar Ponto Focal no Palco (F)',
                  short: 'Palco'
                },
                {
                  id: 'eraser' as const,
                  icon: Trash2,
                  label: 'Apagar Assento no Clique (Del)',
                  short: 'Excluir'
                }
              ] as const
            ).map(tool => {
              const Icon = tool.icon
              const active = designerTool === tool.id
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setDesignerTool(tool.id)}
                  title={tool.label}
                  data-testid={`seatsio-tool-${tool.id}`}
                  className={`w-13 py-2 rounded-xl flex flex-col items-center justify-center gap-1 border transition cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg'
                      : 'bg-slate-900/70 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-[9px] font-bold leading-none">{tool.short}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* -----------------------------------------------------------------
            CENTRO: MAPA DE ASSENTOS INTERATIVO (ZOOM, ARRASTE, LAÇO, 5 CORES)
        ----------------------------------------------------------------- */}
        <div
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          className="flex-1 bg-[#070B12] relative overflow-auto flex items-start justify-center p-6"
          style={{
            cursor:
              designerTool === 'pan' || isPanning
                ? 'grab'
                : mode === 'designer' &&
                  ['draw_row', 'draw_block', 'draw_table', 'draw_ga_zone', 'focal_point'].includes(
                    designerTool
                  )
                ? 'crosshair'
                : 'default'
          }}
        >
          {/* Barra Flutuante de Zoom e Ações Rápidas de Lote no Topo do Canvas */}
          <div className="sticky top-2 left-4 z-30 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl px-3 py-1.5 flex flex-wrap items-center gap-2 shadow-xl">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(35, z - 10))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
              title="Diminuir Zoom"
            >
              <ZoomOut size={15} />
            </button>
            <span className="font-mono text-xs font-bold text-white w-12 text-center">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(165, z + 10))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(68)
                setPan({ x: 0, y: 0 })
                setSemanticSectorOverview(false)
              }}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 cursor-pointer"
            >
              Centralizar
            </button>

            {selectedSeatIds.length > 1 && mode !== 'checkout_preview' && (
              <>
                <div className="h-4 w-[1px] bg-slate-700 mx-1" />
                <button
                  type="button"
                  onClick={alignSelectedSeatsHorizontally}
                  className="px-2 py-0.5 rounded bg-indigo-600/30 border border-indigo-400/50 text-indigo-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  title="Alinhar horizontalmente e distribuir igualmente os assentos selecionados"
                >
                  <AlignCenterHorizontal size={12} />
                  <span>Alinhar & Espaçar ({selectedSeatIds.length})</span>
                </button>
              </>
            )}
          </div>

          {/* Superfície Escalável da Planta do Evento */}
          <div
            ref={canvasRef}
            className="relative bg-white rounded-lg shadow-2xl transition-transform"
            style={{
              width: `${bgWidthPx}px`,
              height: `${bgHeightPx}px`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
              transformOrigin: 'top center'
            }}
          >
            {/* Imagem de Fundo / Planta Baixa */}
            {bgDataUrl && (
              <img
                src={bgDataUrl}
                alt="Planta do Evento SafeSaff"
                draggable={false}
                className="pointer-events-none absolute inset-0 w-full h-full object-contain"
                style={{ opacity: bgOpacity / 100 }}
              />
            )}

            {/* Ponto Focal do Palco */}
            <div
              title={`Ponto Focal do Palco (${focalPoint.x}, ${focalPoint.y})`}
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${focalPoint.x}px`, top: `${focalPoint.y}px` }}
            >
              <div className="w-8 h-8 rounded-full bg-amber-500/30 border-2 border-amber-400 flex items-center justify-center animate-pulse shadow-lg">
                <Crosshair size={16} className="text-amber-950" />
              </div>
              <span className="mt-0.5 px-1.5 py-0.2 rounded bg-slate-900/90 text-amber-300 text-[9px] font-bold whitespace-nowrap">
                PONTO FOCAL PALCO
              </span>
            </div>

            {/* Zonas (Mesas Redondas e Áreas Pista / GA) */}
            {zones.map(z => {
              const isRoundTable = z.kind === 'table_center'
              return (
                <div
                  key={z.id}
                  className={`absolute flex flex-col items-center justify-center text-center font-bold shadow-md ${
                    isRoundTable ? 'rounded-full' : 'rounded-xl'
                  }`}
                  style={{
                    left: `${z.x}px`,
                    top: `${z.y}px`,
                    width: `${z.width}px`,
                    height: `${z.height}px`,
                    backgroundColor: isRoundTable ? '#1E293B' : `${z.color}33`,
                    border: `2.5px solid ${z.color}`,
                    color: isRoundTable ? '#F8FAFC' : '#0F172A'
                  }}
                >
                  <span className="text-[9px] font-extrabold px-1 leading-tight">
                    {z.label}
                  </span>
                </div>
              )
            })}

            {/* Visão Semântica de Setores (LOD Zoom Out) */}
            {semanticSectorOverview ? (
              sectorClusters.map(cluster => (
                <button
                  key={cluster.name}
                  type="button"
                  onClick={() => {
                    setSemanticSectorOverview(false)
                    setZoom(100)
                  }}
                  style={{
                    left: `${cluster.minX - 18}px`,
                    top: `${cluster.minY - 18}px`,
                    width: `${Math.max(140, cluster.maxX - cluster.minX + 36)}px`,
                    height: `${Math.max(85, cluster.maxY - cluster.minY + 36)}px`,
                    backgroundColor: `${cluster.color}D9`,
                    borderColor: '#FFFFFF'
                  }}
                  className="absolute z-30 rounded-2xl border-2 shadow-2xl flex flex-col items-center justify-center p-3 text-white hover:scale-103 transition cursor-pointer backdrop-blur-xs"
                >
                  <span className="text-xs font-black uppercase tracking-wider drop-shadow">
                    {cluster.name}
                  </span>
                  <span className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-950/80 text-[11px] font-extrabold text-emerald-300">
                    {cluster.free} livres • {cluster.sold} vendidos • R$ {cluster.minPrice}+
                  </span>
                  <span className="mt-1 text-[10px] font-semibold text-white/90">
                    Clique para abrir assentos →
                  </span>
                </button>
              ))
            ) : (
              /* Assentos Individuais com as 5 Cores Oficiais (Disponível, Selecionado, Vendido, Reservado, Bloqueado) */
              seats.map(seat => {
                const cat = resolveSeatCategory(seat)
                const isSelectedInStudio = selectedSeatIds.includes(seat.id)
                const isSelectedByBuyer = !!buyerSelectedSeats[seat.id]
                const isSelected = isSelectedInStudio || isSelectedByBuyer
                const isDimmedByFilter =
                  buyerCategoryFilter !== 'ALL' && cat.id !== buyerCategoryFilter
                const binding = ticketBindings[seat.id]
                const isCheckedIn = binding?.status === 'CHECKED_IN'

                const w = seatShape === 'armchair' ? seat.width || 20 : 18
                const h = seatShape === 'armchair' ? seat.height || 27 : 18

                // 5 Cores Distintas: Selecionado (#10B981), Disponível (Azul/Categoria), Vendido (#DC2626), Reservado (#EA580C), Bloqueado (#0F172A)
                const fillHex = isSelected
                  ? SAFESAFF_5_STATE_COLORS.selected.hex
                  : seat.status === 'free'
                  ? cat.color || SAFESAFF_5_STATE_COLORS.available.hex
                  : seat.status === 'sold'
                  ? SAFESAFF_5_STATE_COLORS.sold.hex
                  : seat.status === 'reserved'
                  ? SAFESAFF_5_STATE_COLORS.reserved.hex
                  : SAFESAFF_5_STATE_COLORS.blocked.hex

                const borderHex = isSelected
                  ? '#FFFFFF'
                  : isCheckedIn
                  ? '#22D3EE'
                  : seat.status === 'free'
                  ? '#0F172A'
                  : seat.status === 'sold'
                  ? '#7F1D1D'
                  : seat.status === 'reserved'
                  ? '#9A3412'
                  : '#475569'

                return (
                  <button
                    key={seat.id}
                    type="button"
                    onMouseDown={e => handleSeatMouseDown(e, seat)}
                    onClick={e => handleSeatClick(e, seat)}
                    onMouseEnter={() => setHoveredSeat(seat)}
                    onMouseLeave={() =>
                      setHoveredSeat(prev => (prev?.id === seat.id ? null : prev))
                    }
                    style={{
                      left: `${seat.x - w / 2}px`,
                      top: `${seat.y - h / 2}px`,
                      width: `${w}px`,
                      height: `${h}px`,
                      transform: `rotate(${seat.rotation || 0}deg)`,
                      backgroundColor: fillHex,
                      opacity: isDimmedByFilter ? 0.22 : 1,
                      borderColor: borderHex
                    }}
                    className={`absolute flex items-center justify-center p-0 border-2 transition-transform ${
                      seatShape === 'circle'
                        ? 'rounded-full'
                        : seatShape === 'square'
                        ? 'rounded-[4px]'
                        : 'rounded-t-md rounded-b-xs'
                    } ${
                      isSelected
                        ? 'z-30 scale-130 ring-2 ring-amber-400 shadow-lg'
                        : 'z-10 hover:scale-125 cursor-pointer'
                    }`}
                  >
                    {isSelected ? (
                      <span className="text-[9px] font-black text-white">✓</span>
                    ) : isCheckedIn ? (
                      <span className="text-[8px] font-black text-cyan-200">✓</span>
                    ) : (
                      <span className="text-[7px] font-extrabold text-white leading-none drop-shadow">
                        {seat.seatNumber}
                      </span>
                    )}
                  </button>
                )
              })
            )}

            {/* Retângulo de Seleção em Laço (Marquee Selection Box) */}
            {lassoRect && (
              <div
                className="pointer-events-none absolute z-40 border-2 border-emerald-400 bg-emerald-500/20 rounded-xs"
                style={{
                  left: `${Math.min(lassoRect.startX, lassoRect.curX)}px`,
                  top: `${Math.min(lassoRect.startY, lassoRect.curY)}px`,
                  width: `${Math.abs(lassoRect.curX - lassoRect.startX)}px`,
                  height: `${Math.abs(lassoRect.curY - lassoRect.startY)}px`
                }}
              />
            )}

            {/* Tooltip Flutuante Rico ao passar o mouse em um assento */}
            {hoveredSeat && !semanticSectorOverview && (
              <div
                className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full w-60 bg-slate-950/95 text-white rounded-xl border border-slate-700 shadow-2xl overflow-hidden"
                style={{
                  left: `${hoveredSeat.x}px`,
                  top: `${Math.max(10, hoveredSeat.y - 16)}px`
                }}
              >
                {(() => {
                  const cat = resolveSeatCategory(hoveredSeat)
                  const b = ticketBindings[hoveredSeat.id]
                  const statusLabel =
                    hoveredSeat.status === 'free'
                      ? 'Disponível'
                      : hoveredSeat.status === 'sold'
                      ? 'Vendido'
                      : hoveredSeat.status === 'reserved'
                      ? 'Reservado (Hold)'
                      : 'Bloqueado'
                  return (
                    <>
                      <div
                        className="px-3 py-1.5 text-[11px] font-black text-white flex items-center justify-between"
                        style={{ backgroundColor: cat.color }}
                      >
                        <span className="truncate">{cat.name}</span>
                        <span>R$ {cat.priceBRL}</span>
                      </div>
                      <div className="p-2.5 space-y-1 text-[11px]">
                        <div className="font-bold text-white">{hoveredSeat.sectorName}</div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span>
                            Fila: <strong>{hoveredSeat.rowLabel}</strong>
                          </span>
                          <span>
                            Assento: <strong>{hoveredSeat.label}</strong>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800">
                          <span className="font-bold text-amber-300">Status: {statusLabel}</span>
                          <span className="text-emerald-400">Meia: R$ {cat.halfPriceBRL}</span>
                        </div>
                        {b && (
                          <div className="pt-1 border-t border-slate-800 text-[10px] text-cyan-300 space-y-0.5">
                            <div>
                              Pedido: <strong>{b.orderId}</strong> • Ingresso:{' '}
                              <strong>#{b.sequentialNumber}</strong>
                            </div>
                            <div className="truncate">Titular: {b.holderName}</div>
                            {b.status === 'CHECKED_IN' && (
                              <div className="text-emerald-400 font-bold">
                                ✓ Check-in Realizado ({b.checkInGate})
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </div>

        {/* -----------------------------------------------------------------
            PAINEL LATERAL DE CONTROLE, INSPECTOR DE ASSENTO E INTEGRAÇÃO DE LOTES/INGRESSOS/ACESSO
        ----------------------------------------------------------------- */}
        <div className="w-88 bg-[#111827] border-l border-slate-800 flex flex-col shrink-0 text-xs overflow-y-auto">
          {/* =================================================================
              PAINEL LATERAL DO ASSENTO SELECIONADO (SEMPRE VISÍVEL QUANDO HÁ SELEÇÃO NO MODO DESIGNER OU EVENT MANAGER)
          ================================================================= */}
          {mode !== 'checkout_preview' && primarySelectedSeat && (
            <div className="p-3.5 border-b border-slate-800 bg-slate-900/90 space-y-3" data-testid="selected-seat-side-panel">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    {selectedSeatIds.length === 1
                      ? 'Assento Selecionado'
                      : `${selectedSeatIds.length} Assentos Selecionados (Lote)`}
                  </span>
                  <h4 className="text-sm font-black text-white">
                    {primarySelectedSeat.sectorName} • {primarySelectedSeat.rowLabel} •{' '}
                    {primarySelectedSeat.label}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSeatIds([])}
                  className="text-slate-400 hover:text-white font-bold px-1.5 py-0.5 rounded bg-slate-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Atalhos para selecionar Fila Inteira ou Setor Inteiro */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    selectEntireRow(
                      primarySelectedSeat.sectorName,
                      primarySelectedSeat.rowLabel
                    )
                  }
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 cursor-pointer"
                >
                  Selecionar {primarySelectedSeat.rowLabel} Inteira
                </button>
                <button
                  type="button"
                  onClick={() => selectEntireSector(primarySelectedSeat.sectorName)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 cursor-pointer truncate"
                >
                  Selecionar Setor Inteiro
                </button>
              </div>

              {/* Edição Direta de Setor, Fileira, Rótulo e Posição */}
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="text-[10px] text-slate-400">Setor</label>
                  <input
                    type="text"
                    value={primarySelectedSeat.sectorName}
                    onChange={e => updateSelectedSeats({ sectorName: e.target.value, sectorId: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Fileira</label>
                  <input
                    type="text"
                    value={primarySelectedSeat.rowLabel}
                    onChange={e => updateSelectedSeats({ rowLabel: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Assento</label>
                  <input
                    type="text"
                    value={primarySelectedSeat.label}
                    onChange={e => updateSelectedSeats({ label: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="text-[10px] text-slate-400">Pos X (px)</label>
                  <input
                    type="number"
                    value={primarySelectedSeat.x}
                    onChange={e => updateSelectedSeats({ x: Number(e.target.value) })}
                    className="w-full mt-0.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-[11px] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Pos Y (px)</label>
                  <input
                    type="number"
                    value={primarySelectedSeat.y}
                    onChange={e => updateSelectedSeats({ y: Number(e.target.value) })}
                    className="w-full mt-0.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-[11px] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Rotação (°)</label>
                  <input
                    type="number"
                    value={primarySelectedSeat.rotation || 0}
                    onChange={e => updateSelectedSeats({ rotation: Number(e.target.value) })}
                    className="w-full mt-0.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-[11px] font-mono"
                  />
                </div>
              </div>

              {/* Botões Rápidos de Status (Disponível, Reservado, Vendido, Bloqueado) */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Mudar Disponibilidade Imediata ({selectedSeatIds.length}):
                </label>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => applyStatusToSelected('free')}
                    className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                      primarySelectedSeat.status === 'free'
                        ? 'bg-blue-600 text-white border-blue-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    Livre
                  </button>
                  <button
                    type="button"
                    onClick={() => applyStatusToSelected('reserved')}
                    className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                      primarySelectedSeat.status === 'reserved'
                        ? 'bg-amber-600 text-white border-amber-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    Reserva
                  </button>
                  <button
                    type="button"
                    onClick={() => applyStatusToSelected('sold')}
                    className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                      primarySelectedSeat.status === 'sold'
                        ? 'bg-rose-600 text-white border-rose-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    Vendido
                  </button>
                  <button
                    type="button"
                    onClick={() => applyStatusToSelected('blocked')}
                    className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                      primarySelectedSeat.status === 'blocked'
                        ? 'bg-slate-700 text-white border-slate-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    Bloquear
                  </button>
                </div>
              </div>

              {/* =============================================================
                  CARD DE GOVERNANÇA: INTEGRAÇÃO COM PEDIDOS, INGRESSOS (8 DÍGITOS) E CONTROLE DE ACESSO
              ============================================================= */}
              {primarySeatBinding ? (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                      <Ticket size={12} /> Ingresso & Controle de Acesso
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
                      #{primarySeatBinding.sequentialNumber}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Pedido:</span>
                      <strong className="text-white font-mono">{primarySeatBinding.orderId}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Lote Vinculado:</span>
                      <strong className="text-amber-300 truncate block">
                        {primarySeatBinding.lotName}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Titular:</span>
                      <strong className="text-white truncate block">
                        {primarySeatBinding.holderName}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">CPF / Modalidade:</span>
                      <strong className="text-emerald-400">
                        {primarySeatBinding.modality} (R$ {primarySeatBinding.priceBRL})
                      </strong>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <QrCode size={11} className="text-cyan-400" />
                      {primarySeatBinding.credentialCode}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {primarySeatBinding.status === 'CHECKED_IN'
                        ? '✓ NA CATRACA'
                        : primarySeatBinding.status === 'RESERVED_HOLD'
                        ? 'HOLD ATIVO'
                        : 'EMITIDO'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {primarySeatBinding.status === 'RESERVED_HOLD' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await safesaffSeatmapEngine.confirmReservedSeat(
                            primarySelectedSeat,
                            seats
                          )
                          onCommitSeats(res.updatedSeats)
                          setTicketBindings(safesaffSeatmapEngine.loadBindings())
                          setBestAvailFeedback(
                            `✅ Reserva convertida em Venda Confirmada (#${res.binding?.sequentialNumber})!`
                          )
                        }}
                        className="py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer"
                      >
                        ✓ Confirmar Venda
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = safesaffSeatmapEngine.performSeatAccessCheckIn(
                            primarySelectedSeat.id,
                            'Portão Principal A',
                            'Catraca Ótica 01'
                          )
                          if (updated) {
                            setTicketBindings(safesaffSeatmapEngine.loadBindings())
                            setBestAvailFeedback(
                              `🛂 Check-in de Controle de Acesso validado na Catraca para o Ingresso #${updated.sequentialNumber}!`
                            )
                          }
                        }}
                        disabled={primarySeatBinding.status === 'CHECKED_IN'}
                        className="py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-[10px] cursor-pointer"
                      >
                        {primarySeatBinding.status === 'CHECKED_IN'
                          ? '✓ Check-in Realizado'
                          : '🛂 Validar na Catraca'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const res = safesaffSeatmapEngine.releaseAndRefundSeat(
                          primarySelectedSeat.id,
                          seats
                        )
                        onCommitSeats(res.updatedSeats)
                        setTicketBindings(safesaffSeatmapEngine.loadBindings())
                        setBestAvailFeedback(
                          `🔄 Ingresso cancelado/estornado e poltrona ${primarySelectedSeat.label} liberada em tempo real!`
                        )
                      }}
                      className="py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 text-rose-300 font-bold text-[10px] cursor-pointer"
                    >
                      Estornar & Liberar
                    </button>
                  </div>
                </div>
              ) : (
                /* Emissão Rápida de Pedido / Ingresso Nominal ou Reserva Hold para os Assentos Selecionados */
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                    Emitir Venda / Reserva p/ Seleção ({selectedSeatIds.length})
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      placeholder="Nome do Titular"
                      value={issueHolderName}
                      onChange={e => setIssueHolderName(e.target.value)}
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-[11px]"
                    />
                    <input
                      type="text"
                      placeholder="CPF"
                      value={issueHolderCpf}
                      onChange={e => setIssueHolderCpf(e.target.value)}
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-[11px] font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={issueModality}
                      onChange={e =>
                        setIssueModality(
                          e.target.value as 'INTEIRA' | 'MEIA_ENTRADA' | 'CORTESIA'
                        )
                      }
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-[11px]"
                    >
                      <option value="INTEIRA">Modalidade: Inteira</option>
                      <option value="MEIA_ENTRADA">Modalidade: Meia-Entrada</option>
                      <option value="CORTESIA">Modalidade: Cortesia</option>
                    </select>
                    <select
                      value={issueChannel}
                      onChange={e => setIssueChannel(e.target.value as SeatsIoChannelKey)}
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-[11px]"
                    >
                      {SEATSIO_CHANNELS.map(ch => (
                        <option key={ch.key} value={ch.key}>
                          {ch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={isIssuingOrder}
                      onClick={() => handleIssueOrderOrHoldForSelection('SELL')}
                      data-testid="btn-issue-ticket-from-map"
                      className="py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      🎟️ Emitir Venda ({selectedSeatIds.length})
                    </button>
                    <button
                      type="button"
                      disabled={isIssuingOrder}
                      onClick={() => handleIssueOrderOrHoldForSelection('RESERVE_HOLD')}
                      data-testid="btn-reserve-hold-from-map"
                      className="py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      ⏳ Reservar Hold 15m
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODO 1: FERRAMENTAS DE CRIAÇÃO DE SETORES, FILEIRAS E MESAS */}
          {mode === 'designer' && (
            <div className="p-4 space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Editor Visual da Planta
                </span>
                <h3 className="text-sm font-black text-white mt-0.5">
                  Setores, Fileiras Curvas & Mesas
                </h3>
              </div>

              {/* Atribuição de Categoria em Lote */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <label className="block text-[11px] font-bold text-slate-200">
                  Vincular Categoria & Lote à Seleção ({selectedSeatIds.length}):
                </label>
                <div className="grid grid-cols-1 gap-1">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => applyCategoryToSelected(cat.id)}
                      disabled={selectedSeatIds.length === 0}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 flex items-center justify-between text-left cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-semibold text-slate-200">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <span className="font-bold text-emerald-400">R$ {cat.priceBRL}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => orientSeatsToFocalPoint(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/30 text-indigo-200 font-bold text-[11px] cursor-pointer"
                  >
                    🎯 Orientar p/ Palco
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSeatIds.length === 0) return
                      const sel = new Set(selectedSeatIds)
                      onCommitSeats(seats.filter(s => !sel.has(s.id)))
                      setSelectedSeatIds([])
                    }}
                    disabled={selectedSeatIds.length === 0}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 disabled:opacity-40 text-rose-300 font-bold text-[11px] cursor-pointer"
                  >
                    🗑️ Excluir Seleção
                  </button>
                </div>
              </div>

              {/* Parametrização do Gerador de Setores e Fileiras Curvas */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">
                    Criar Setor / Fileiras de Assentos
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Paramétrico
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Nome do Setor</label>
                    <input
                      type="text"
                      list="safesaff-sectors-datalist"
                      value={rowBuilderSectorName}
                      onChange={e => setRowBuilderSectorName(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                    />
                    <datalist id="safesaff-sectors-datalist">
                      {distinctSectors.map(sec => (
                        <option key={sec} value={sec} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Fila Inicial</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={rowBuilderStartRowLetter}
                      onChange={e => setRowBuilderStartRowLetter(e.target.value.toUpperCase())}
                      className="w-full mt-0.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">
                      Qtd. Fileiras: <strong>{rowBuilderRowsCount}</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={rowBuilderRowsCount}
                      onChange={e => setRowBuilderRowsCount(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">
                      Assentos / Fila: <strong>{rowBuilderSeatsPerRow}</strong>
                    </label>
                    <input
                      type="range"
                      min={4}
                      max={30}
                      value={rowBuilderSeatsPerRow}
                      onChange={e => setRowBuilderSeatsPerRow(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 flex justify-between">
                    <span>Curvatura da Fileira (Arco):</span>
                    <strong className="text-amber-300">{rowBuilderCurve}°</strong>
                  </label>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    value={rowBuilderCurve}
                    onChange={e => setRowBuilderCurve(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: 'sequential' as const, label: '1, 2, 3...' },
                      { id: 'odd' as const, label: 'Ímpares 1,3,5' },
                      { id: 'even' as const, label: 'Pares 2,4,6' }
                    ] as const
                  ).map(rule => (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => setRowBuilderNumbering(rule.id)}
                      className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${
                        rowBuilderNumbering === rule.id
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {rule.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDesignerTool('draw_block')
                    setBestAvailFeedback(
                      'Clique no ponto desejado da planta para adicionar o novo bloco de fileiras.'
                    )
                  }}
                  className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow cursor-pointer"
                >
                  + Inserir Bloco de Fileiras no Clique
                </button>
              </div>

              {/* Gerador de Mesas */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="font-bold text-emerald-400 block">
                  Criar Mesas Numeradas (Bistrô / Gala)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">
                      Assentos na Mesa: <strong>{tableSeatsCount}</strong>
                    </label>
                    <input
                      type="range"
                      min={4}
                      max={12}
                      step={2}
                      value={tableSeatsCount}
                      onChange={e => setTableSeatsCount(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">
                      Raio: <strong>{tableRadiusPx}px</strong>
                    </label>
                    <input
                      type="range"
                      min={26}
                      max={54}
                      value={tableRadiusPx}
                      onChange={e => setTableRadiusPx(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDesignerTool('draw_table')
                    setBestAvailFeedback('Clique na planta para posicionar uma nova Mesa.')
                  }}
                  className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                >
                  + Inserir Mesa Redonda no Clique
                </button>
              </div>
            </div>
          )}

          {/* MODO 2: OPERAÇÃO DO EVENTO, LOTES, INGRESSOS & CONTROLE DE ACESSO */}
          {mode === 'event_manager' && (
            <div className="p-4 space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Operação Integrada do Evento
                </span>
                <h3 className="text-sm font-black text-white mt-0.5">
                  Lotes, Ingressos, Pedidos & Acesso
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setManagerTab('lots_integration')}
                  className={`py-1.5 rounded text-[10px] font-bold cursor-pointer ${
                    managerTab === 'lots_integration' || managerTab === 'inspector'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Lotes & Portões
                </button>
                <button
                  type="button"
                  onClick={() => setManagerTab('statuses')}
                  className={`py-1.5 rounded text-[10px] font-bold cursor-pointer ${
                    managerTab === 'statuses'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Operação Lote
                </button>
                <button
                  type="button"
                  onClick={() => setManagerTab('best_available')}
                  className={`py-1.5 rounded text-[10px] font-bold cursor-pointer ${
                    managerTab === 'best_available'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Best Avail.
                </button>
              </div>

              {(managerTab === 'lots_integration' || managerTab === 'inspector') && (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-slate-400">
                    Lotes e Portões de Controle de Acesso sincronizados em tempo real com os setores da planta:
                  </p>
                  {lots.map(lot => (
                    <div
                      key={lot.id}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-white">{lot.name}</strong>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          R$ {lot.basePriceBRL}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Setor: <strong>{lot.sectorName}</strong></span>
                        <span>Meia: R$ {lot.halfPriceBRL}</span>
                      </div>
                      <div className="text-[10px] text-cyan-300 flex items-center justify-between pt-1 border-t border-slate-800">
                        <span>🛂 {lot.gateName}</span>
                        <span>
                          Vendidos: <strong>{lot.soldCount}</strong> • Hold:{' '}
                          <strong>{lot.reservedCount}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectEntireSector(lot.sectorName)}
                        className="w-full mt-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 cursor-pointer"
                      >
                        Selecionar Assentos do Setor no Mapa
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {managerTab === 'statuses' && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                  <p className="text-[11px] text-slate-300">
                    Operação em lote para <strong>{selectedSeatIds.length}</strong> assento(s) selecionado(s):
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyStatusToSelected('free')}
                      disabled={selectedSeatIds.length === 0}
                      className="px-3 py-2 rounded-lg bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30 disabled:opacity-40 text-blue-300 font-bold flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Unlock size={14} /> Liberar Disponibilidade (Free)
                      </span>
                      <span>{stats.free}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyStatusToSelected('reserved')}
                      disabled={selectedSeatIds.length === 0}
                      className="px-3 py-2 rounded-lg bg-amber-600/20 border border-amber-500/40 hover:bg-amber-600/30 disabled:opacity-40 text-amber-300 font-bold flex items-center justify-between cursor-pointer"
                    >
                      <span>⏳ Reservar em Lote (Hold)</span>
                      <span>{stats.reserved}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyStatusToSelected('sold')}
                      disabled={selectedSeatIds.length === 0}
                      className="px-3 py-2 rounded-lg bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 disabled:opacity-40 text-rose-300 font-bold flex items-center justify-between cursor-pointer"
                    >
                      <span>🎟️ Marcar como Vendido em Lote</span>
                      <span>{stats.sold}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyStatusToSelected('blocked')}
                      disabled={selectedSeatIds.length === 0}
                      className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Lock size={14} /> Bloquear Assentos (Produção)
                      </span>
                      <span>{stats.blocked}</span>
                    </button>
                  </div>
                </div>
              )}

              {managerTab === 'best_available' && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <span className="font-bold text-amber-400 block">
                    Motor de Melhor Assento Disponível (Best Available)
                  </span>
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">
                      Quantidade de Lugares Juntos: <strong>{bestAvailCount}</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={bestAvailCount}
                      onChange={e => setBestAvailCount(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">
                      Filtrar Categoria:
                    </label>
                    <select
                      value={bestAvailCategoryFilter}
                      onChange={e => setBestAvailCategoryFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                    >
                      <option value="ALL">Qualquer Categoria</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} — R$ {c.priceBRL}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={runSeatsIoBestAvailable}
                    data-testid="btn-run-best-available"
                    className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg cursor-pointer"
                  >
                    ✨ Buscar Melhores Assentos
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MODO 3: CHECKOUT FLOORPLAN (SIMULADOR DE COMPRA ONLINE COM EMISSÃO REAL DE PEDIDO E INGRESSOS) */}
          {mode === 'checkout_preview' && (
            <div className="p-4 flex flex-col h-full justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      Checkout de Ingressos Online
                    </span>
                    <h3 className="text-sm font-black text-white">
                      Carrinho ({buyerCartItems.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={runSeatsIoBestAvailable}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer"
                  >
                    ⚡ Sugerir Melhores
                  </button>
                </div>

                {buyerCartItems.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 text-center space-y-2">
                    <ShoppingCart size={26} className="mx-auto text-slate-500" />
                    <p className="text-xs font-semibold text-slate-300">
                      Clique nos assentos disponíveis (em azul/roxo) para selecionar seus lugares.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {buyerCartItems.map(({ seat, cat, modality, price }) => (
                      <div
                        key={seat.id}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold text-white">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span>
                              {seat.rowLabel} • {seat.label}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setBuyerSelectedSeats(prev => {
                                const next = { ...prev }
                                delete next[seat.id]
                                return next
                              })
                            }
                            className="text-slate-400 hover:text-rose-400 text-xs font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400">{seat.sectorName}</div>
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setBuyerSelectedSeats(prev => ({
                                  ...prev,
                                  [seat.id]: 'inteira'
                                }))
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                modality === 'inteira'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Inteira
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setBuyerSelectedSeats(prev => ({
                                  ...prev,
                                  [seat.id]: 'meia'
                                }))
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                modality === 'meia'
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Meia-Entrada
                            </button>
                          </div>
                          <span className="font-black text-emerald-400 text-xs">
                            R$ {price.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fechamento do Pedido integrado ao safesaffSeatmapEngine + ticketsAccessService */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total do Pedido:</span>
                  <span className="text-base font-black text-emerald-400">
                    R$ {buyerTotalBRL.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={
                    buyerCartItems.length === 0 ||
                    orphanSeatWarnings.length > 0 ||
                    isIssuingOrder
                  }
                  onClick={async () => {
                    setIsIssuingOrder(true)
                    try {
                      const selectedSeatsList = buyerCartItems.map(i => i.seat)
                      const firstCat = buyerCartItems[0].cat
                      const avgPrice =
                        buyerTotalBRL / Math.max(1, buyerCartItems.length)
                      const res = await safesaffSeatmapEngine.sellOrReserveSeats({
                        seatsToProcess: selectedSeatsList,
                        allSeats: seats,
                        mode: 'SELL',
                        eventCode,
                        eventName: eventTitle,
                        lotId: firstCat.lotId,
                        categoryId: firstCat.id,
                        categoryName: firstCat.name,
                        modality: 'INTEIRA',
                        unitPriceBRL: avgPrice,
                        holderName: issueHolderName,
                        holderDocument: issueHolderCpf,
                        holderEmail: issueHolderEmail,
                        holderPhone: '(41) 99811-2200',
                        salesChannel: 'online_web'
                      })
                      onCommitSeats(res.updatedSeats)
                      setTicketBindings(safesaffSeatmapEngine.loadBindings())
                      setLots(safesaffSeatmapEngine.loadLots())
                      setBuyerSelectedSeats({})
                      setBestAvailFeedback(
                        `✅ Pedido ${res.orderId} concluído! ${res.issuedBindings.length} ingresso(s) emitidos com QR Code e disponíveis no Controle de Acesso.`
                      )
                    } finally {
                      setIsIssuingOrder(false)
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                >
                  Finalizar Pedido & Emitir Ingressos ({buyerCartItems.length})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
