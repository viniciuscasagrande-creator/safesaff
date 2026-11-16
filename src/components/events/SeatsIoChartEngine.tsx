import React, { useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Compass,
  Crosshair,
  Eye,
  Filter,
  Grid,
  Hand,
  Layers,
  Lock,
  Maximize2,
  MousePointer,
  Plus,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  Square,
  Tag,
  Trash2,
  Unlock,
  Upload,
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
  isAccessible?: boolean
}

export const DEFAULT_SEATSIO_CATEGORIES: SeatsIoCategory[] = [
  {
    id: 'cat-premium',
    name: 'Plateia Premium (Ouro)',
    color: '#F59E0B',
    priceBRL: 180,
    halfPriceBRL: 90
  },
  {
    id: 'cat-central',
    name: 'Plateia Central (Esmeralda)',
    color: '#10B981',
    priceBRL: 140,
    halfPriceBRL: 70
  },
  {
    id: 'cat-lateral',
    name: 'Plateia Lateral (Azul)',
    color: '#3B82F6',
    priceBRL: 110,
    halfPriceBRL: 55
  },
  {
    id: 'cat-camarote',
    name: 'Camarote / Box VIP',
    color: '#8B5CF6',
    priceBRL: 220,
    halfPriceBRL: 110
  },
  {
    id: 'cat-pcd',
    name: 'Acessível PCD / Acompanhante ♿',
    color: '#06B6D4',
    priceBRL: 70,
    halfPriceBRL: 70,
    isAccessible: true
  }
]

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

  // Seleção múltipla estilo Seats.io (Marquee / Lasso ou Shift+Click)
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
  const [lassoRect, setLassoRect] = useState<{
    startX: number
    startY: number
    curX: number
    curY: number
  } | null>(null)

  // Pan e Zoom do Canvas Seats.io
  const [zoom, setZoom] = useState<number>(68)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState<boolean>(false)
  const [panOrigin, setPanOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [semanticSectorOverview, setSemanticSectorOverview] = useState<boolean>(false)

  // Ponto Focal do Palco (Seats.io Focal Point para Best Available e Visão do Palco)
  const [focalPoint, setFocalPoint] = useState<{ x: number; y: number }>({
    x: Math.round(bgWidthPx / 2),
    y: 95
  })

  // Parâmetros do Gerador de Fileiras Curvas / Blocos Seats.io (Row & Section Tool)
  const [rowBuilderRowsCount, setRowBuilderRowsCount] = useState<number>(4)
  const [rowBuilderSeatsPerRow, setRowBuilderSeatsPerRow] = useState<number>(14)
  const [rowBuilderCurve, setRowBuilderCurve] = useState<number>(18) // -60 a +60
  const [rowBuilderSeatSpacing, setRowBuilderSeatSpacing] = useState<number>(22)
  const [rowBuilderRowSpacing, setRowBuilderRowSpacing] = useState<number>(28)
  const [rowBuilderNumbering, setRowBuilderNumbering] = useState<'sequential' | 'odd' | 'even'>('sequential')
  const [rowBuilderSectorName, setRowBuilderSectorName] = useState<string>('PLATEIA B - Central')
  const [rowBuilderStartRowLetter, setRowBuilderStartRowLetter] = useState<string>('A')

  // Parâmetros do Gerador de Mesas Seats.io (Table Tool)
  const [tableSeatsCount, setTableSeatsCount] = useState<number>(8)
  const [tableRadiusPx, setTableRadiusPx] = useState<number>(36)
  const [tablePrefix, setTablePrefix] = useState<string>('MESA VIP')

  // Event Manager: Sub-aba (Status vs Canais vs Best Available)
  const [managerTab, setManagerTab] = useState<'statuses' | 'channels' | 'best_available'>('statuses')
  const [seatChannels, setSeatChannels] = useState<Record<string, SeatsIoChannelKey>>({})
  const [activeChannelBrush, setActiveChannelBrush] = useState<SeatsIoChannelKey>('online_web')

  // Best Available (Seats.io Best Available Engine)
  const [bestAvailCount, setBestAvailCount] = useState<number>(2)
  const [bestAvailCategoryFilter, setBestAvailCategoryFilter] = useState<string>('ALL')
  const [preventOrphanSeat, setPreventOrphanSeat] = useState<boolean>(true)
  const [bestAvailFeedback, setBestAvailFeedback] = useState<string | null>(null)

  // Checkout Preview (Visão do Comprador Online Seats.io)
  const [buyerSelectedSeats, setBuyerSelectedSeats] = useState<
    Record<string, 'inteira' | 'meia'>
  >({})
  const [buyerCategoryFilter, setBuyerCategoryFilter] = useState<string>('ALL')
  const [hoveredSeat, setHoveredSeat] = useState<SeatmapSeatPoint | null>(null)

  const canvasRef = useRef<HTMLDivElement | null>(null)

  // Resolve a Categoria Seats.io de cada poltrona (pelo colorHex, descrição ou nome do setor)
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
    if (secUpper.includes('LATERAL') || secUpper.includes('PLATEIA A') || secUpper.includes('PLATEIA C')) {
      return categories.find(c => c.id === 'cat-lateral') || categories[2]
    }
    return categories.find(c => c.id === 'cat-central') || categories[1]
  }

  // Estatísticas globais e por categoria
  const stats = useMemo(() => {
    const total = seats.length
    const free = seats.filter(s => s.status === 'free').length
    const sold = seats.filter(s => s.status === 'sold').length
    const reserved = seats.filter(s => s.status === 'reserved').length
    const blocked = seats.filter(s => s.status === 'blocked').length

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

    return { total, free, sold, reserved, blocked, byCategory }
  }, [seats, categories])

  // Agrupamento de setores para o modo Semantic Zoom (LOD) do Seats.io
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
        cur.minPrice = Math.min(cur.minPrice, cat.halfPriceBRL)
      }
    })
    return Array.from(map.values())
  }, [seats, categories])

  // Detector de Assento Isolado (Orphan Seat Rule do Seats.io no Checkout Preview)
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
      // Verifica apenas filas nas quais o comprador selecionou algum assento
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

        // Só avisa se ao menos um dos lados for uma seleção atual do comprador
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

  // Orientar todas as poltronas selecionadas (ou todas do mapa) para o Ponto Focal no Palco
  const orientSeatsToFocalPoint = (onlySelected: boolean) => {
    const selSet = new Set(selectedSeatIds)
    const next = seats.map(s => {
      if (onlySelected && selSet.size > 0 && !selSet.has(s.id)) return s
      const dx = focalPoint.x - s.x
      const dy = focalPoint.y - s.y
      // Poltrona padrão aponta para cima (-Y), então calculamos o ângulo relativo ao eixo -Y
      const angleDeg = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI)
      return { ...s, rotation: angleDeg }
    })
    onCommitSeats(next)
    setBestAvailFeedback(
      onlySelected && selSet.size > 0
        ? `${selSet.size} poltronas rotacionadas automaticamente em direção ao Ponto Focal do Palco.`
        : `Todas as ${seats.length} poltronas foram orientadas automaticamente para o Ponto Focal do Palco.`
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

  // Aplicar Status (Event Manager) às poltronas selecionadas
  const applyStatusToSelected = (status: SeatStatusType) => {
    if (selectedSeatIds.length === 0) return
    const selSet = new Set(selectedSeatIds)
    onCommitSeats(seats.map(s => (selSet.has(s.id) ? { ...s, status } : s)))
  }

  // Aplicar Canal de Venda (Event Manager Channels) às poltronas selecionadas
  const applyChannelToSelected = (channel: SeatsIoChannelKey) => {
    if (selectedSeatIds.length === 0) return
    const patch: Record<string, SeatsIoChannelKey> = { ...seatChannels }
    selectedSeatIds.forEach(id => {
      patch[id] = channel
    })
    setSeatChannels(patch)
  }

  // Algoritmo Oficial "Best Available" do Seats.io (menor distância euclidiana ao Ponto Focal + contíguos na mesma fileira + sem órfãos)
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
        // Verifica se são assentos adjacentes fisicamente (distância média razoável)
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

        // Penalidade se deixar exatamente 1 assento livre isolado na ponta esquerda ou direita
        let orphanPenalty = 0
        if (preventOrphanSeat) {
          const leftRemaining = i
          const rightRemaining = sorted.length - (i + bestAvailCount)
          if (leftRemaining === 1 || rightRemaining === 1) {
            orphanPenalty = 5000
          }
        }

        // Distância média ao Ponto Focal do Palco
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
        `Nenhum bloco contíguo de ${bestAvailCount} assento(s) livre(s) encontrado para o filtro selecionado.`
      )
      return
    }

    const found: SeatmapSeatPoint[] = bestBlock
    const ids = found.map(s => s.id)
    setSelectedSeatIds(ids)

    // Se estiver no modo Checkout Preview, já adiciona ao carrinho do comprador
    const nextBuyer: Record<string, 'inteira' | 'meia'> = {}
    ids.forEach(id => {
      nextBuyer[id] = 'inteira'
    })
    setBuyerSelectedSeats(nextBuyer)

    const first = found[0]
    const last = found[found.length - 1]
    setBestAvailFeedback(
      `✨ Seats.io Best Available encontrou ${found.length} lugares ideais: ${first.sectorName} • ${first.rowLabel} (${first.label} a ${last.label}) a ${Math.round(bestScore)}px do Ponto Focal!`
    )
  }

  // Carimbar Bloco de Fileiras Curvas (Row / Section Generator do Seats.io)
  const stampCurvedRowBlockAt = (centerX: number, centerY: number) => {
    const activeCat = categories.find(c => c.id === activeCategoryId) || categories[1]
    const created: SeatmapSeatPoint[] = []
    const rowsTotal = designerTool === 'draw_row' ? 1 : Math.max(1, rowBuilderRowsCount)
    const seatsTotal = Math.max(2, rowBuilderSeatsPerRow)
    const startCharCode = (rowBuilderStartRowLetter.trim().toUpperCase().charCodeAt(0) || 65)

    for (let r = 0; r < rowsTotal; r++) {
      const rowLetter = String.fromCharCode(startCharCode + r)
      const rowLabel = `FILA ${rowLetter}`
      for (let i = 0; i < seatsTotal; i++) {
        // Posição normalizada de -1 a +1 ao longo da fileira
        const norm = seatsTotal > 1 ? (i / (seatsTotal - 1)) * 2 - 1 : 0
        const offsetX = norm * ((seatsTotal - 1) * rowBuilderSeatSpacing * 0.5)
        // Arco parabólico de curvatura estilo Seats.io
        const curveOffsetY = (norm * norm) * rowBuilderCurve
        const x = Number((centerX + offsetX).toFixed(2))
        const y = Number((centerY + r * rowBuilderRowSpacing + curveOffsetY).toFixed(2))

        // Tangente da parábola para rotacionar a poltrona suavemente acompanhando a curva
        const tangentAngle = Math.round(
          (Math.atan2(2 * norm * rowBuilderCurve, (seatsTotal - 1) * rowBuilderSeatSpacing * 0.5) *
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
          sectorId: 'sec-seatsio',
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
      `Criado bloco Seats.io com ${rowsTotal} fileira(s) e ${created.length} assentos curvos (${rowBuilderCurve}°).`
    )
  }

  // Carimbar Mesa Redonda com Poltronas ao Redor (Seats.io Table Tool)
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
        sectorId: 'sec-tables',
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
    setBestAvailFeedback(
      `${tableLabel} criada com ${tableSeatsCount} lugares ao redor (Seats.io Table Generator).`
    )
  }

  // Carimbar Área de Pista / General Admission (Seats.io GA Area)
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
    setBestAvailFeedback(`Área General Admission (Sem Lugar Marcado) inserida no mapa.`)
  }

  // Mouse handlers do Canvas (Pan, Lasso Marquee ou Ferramentas de Criação)
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

  // Clique em um assento individual
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
          1. BARRA SUPERIOR SEATS.IO (MODOS: DESIGNER | EVENT MANAGER | CHECKOUT | CLÁSSICO)
      ===================================================================== */}
      <div className="bg-[#111827] border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black text-xs tracking-wide shadow">
            <Compass size={15} />
            <span>seats.io</span>
            <span className="text-[10px] font-semibold bg-black/25 px-1.5 py-0.5 rounded">
              PRO ENGINE
            </span>
          </div>

          {/* 3 Modos Oficiais do Seats.io */}
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
              <span>1. Chart Designer (Criador)</span>
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
              <span>2. Event Manager (Operação & Canais)</span>
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
              <span>3. Checkout Floorplan (Visão Comprador)</span>
            </button>
          </div>
        </div>

        {/* Controles rápidos de Planta 96 DPI + Alternância para Estrutura Visual Clássica */}
        <div className="flex items-center gap-2">
          <div className="hidden xl:flex items-center gap-2 text-[11px] bg-[#0B0F19] px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">
              Capacidade: <strong className="text-white">{stats.total}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-emerald-400">
              Livres: <strong>{stats.free}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-rose-400">
              Vendidos: <strong>{stats.sold}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">
              Bloqueados: <strong>{stats.blocked}</strong>
            </span>
          </div>

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
            Ver Estrutura Clássica (Árvore M/L)
          </button>
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

      {/* Aviso em Tempo Real de Assento Isolado (Orphan Seat Protection do Seats.io) */}
      {mode === 'checkout_preview' && orphanSeatWarnings.length > 0 && (
        <div className="bg-rose-950/95 border-b border-rose-500/50 px-4 py-2 text-xs text-rose-200 flex items-center justify-between">
          <span>
            ⚠️ <strong>Regra Anti-Assento Isolado (Seats.io Orphan Seat Protection):</strong> Sua seleção atual deixa 1 assento vazio isolado em{' '}
            <strong>{orphanSeatWarnings.slice(0, 2).join(', ')}</strong>. Selecione assentos contíguos para continuar.
          </span>
        </div>
      )}

      {/* =====================================================================
          2. BARRA DE FILTROS DE CATEGORIA (NO MODO CHECKOUT) OU DOCK DE AÇÕES RÁPIDAS
      ===================================================================== */}
      <div className="bg-[#0F172A] border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Tag size={12} /> Categorias Seats.io:
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
            Todas ({stats.free} livres)
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

        {/* Zoom Semântico (Visão de Setores vs Assentos) + Formato */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSemanticSectorOverview(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
              semanticSectorOverview
                ? 'bg-indigo-600 text-white border-indigo-400'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
            title="Alterna entre visão macro de setores (LOD Zoom Out) e visão individual de poltronas"
          >
            <Eye size={13} />
            <span>{semanticSectorOverview ? 'Visão Macro Setores (LOD)' : 'Visão de Assentos'}</span>
          </button>

          <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 p-0.5">
            {(
              [
                { id: 'circle' as const, label: 'Bolinha Seats.io' },
                { id: 'armchair' as const, label: 'Poltrona 3D' },
                { id: 'square' as const, label: 'Bloco' }
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

      {/* =====================================================================
          3. WORKSPACE PRINCIPAL SEATS.IO (DOCK ESQUERDO + CANVAS INTERATIVO + INSPECTOR DIREITO)
      ===================================================================== */}
      <div className="flex items-stretch h-[680px] relative">
        {/* -----------------------------------------------------------------
            DOCK ESQUERDO DE FERRAMENTAS DO SEATS.IO CHART DESIGNER
        ----------------------------------------------------------------- */}
        {mode === 'designer' && (
          <div className="w-16 bg-[#111827] border-r border-slate-800 flex flex-col items-center py-3 gap-2 shrink-0 z-20">
            {(
              [
                {
                  id: 'select_lasso' as const,
                  icon: MousePointer,
                  label: 'Selecionar / Laço Multi-Assentos (V)',
                  short: 'Laço'
                },
                {
                  id: 'pan' as const,
                  icon: Hand,
                  label: 'Arrastar Mapa (Espaço / H)',
                  short: 'Pan'
                },
                {
                  id: 'draw_row' as const,
                  icon: Plus,
                  label: 'Desenhar Fileira Curva (R)',
                  short: 'Fila'
                },
                {
                  id: 'draw_block' as const,
                  icon: Grid,
                  label: 'Gerador de Bloco de Fileiras Curvas (B)',
                  short: 'Bloco'
                },
                {
                  id: 'draw_table' as const,
                  icon: Users,
                  label: 'Inserir Mesa Redonda / Bistrô (T)',
                  short: 'Mesa'
                },
                {
                  id: 'draw_ga_zone' as const,
                  icon: Square,
                  label: 'Inserir Área Pista / General Admission (G)',
                  short: 'Pista GA'
                },
                {
                  id: 'focal_point' as const,
                  icon: Crosshair,
                  label: 'Posicionar Ponto Focal no Palco (F)',
                  short: 'Focal'
                },
                {
                  id: 'eraser' as const,
                  icon: Trash2,
                  label: 'Apagar Assento no Clique (Del)',
                  short: 'Apagar'
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
                  className={`w-12 py-2 rounded-xl flex flex-col items-center justify-center gap-1 border transition cursor-pointer ${
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
            CENTRO: VIEWPORT INTERATIVO SEATS.IO (COM FOCAL POINT, LAÇO, TOOLTIP & MINI-MAPA)
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
          {/* Controles Flutuantes de Zoom no Topo do Canvas */}
          <div className="sticky top-2 left-4 z-30 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-xl">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(35, z - 10))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <span className="font-mono text-xs font-bold text-white w-12 text-center">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(160, z + 10))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
              title="Zoom In"
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
              Resetar Vista
            </button>

            {selectedSeatIds.length > 0 && mode !== 'checkout_preview' && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-indigo-600/30 border border-indigo-400/50 text-indigo-200 text-[11px] font-bold">
                {selectedSeatIds.length} selecionado(s)
              </span>
            )}
          </div>

          {/* Superfície Escalável do Mapa */}
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
            {/* Imagem de Fundo / Planta Baixa 96 DPI */}
            {bgDataUrl && (
              <img
                src={bgDataUrl}
                alt="Floorplan Seats.io"
                draggable={false}
                className="pointer-events-none absolute inset-0 w-full h-full object-contain"
                style={{ opacity: bgOpacity / 100 }}
              />
            )}

            {/* Ponto Focal do Palco (Seats.io Focal Point Target) */}
            <div
              title={`Ponto Focal Seats.io (${focalPoint.x}, ${focalPoint.y}) — Usado para Best Available e orientação de poltronas`}
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${focalPoint.x}px`, top: `${focalPoint.y}px` }}
            >
              <div className="w-8 h-8 rounded-full bg-amber-500/30 border-2 border-amber-400 flex items-center justify-center animate-pulse shadow-lg">
                <Crosshair size={16} className="text-amber-950" />
              </div>
              <span className="mt-0.5 px-1.5 py-0.2 rounded bg-slate-900/90 text-amber-300 text-[9px] font-bold whitespace-nowrap">
                PONTO FOCAL
              </span>
            </div>

            {/* Zonas (Mesas Redondas Bistrô e Áreas General Admission / Pista) */}
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

            {/* Visão Semântica de Setores (LOD Zoom Out estilo Seats.io) */}
            {semanticSectorOverview ? (
              sectorClusters.map(cluster => (
                <button
                  key={cluster.name}
                  type="button"
                  onClick={() => {
                    setSemanticSectorOverview(false)
                    setZoom(105)
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
                    {cluster.free} livres • A partir de R$ {cluster.minPrice}
                  </span>
                  <span className="mt-1 text-[10px] font-semibold text-white/90">
                    Clique para dar zoom nos assentos →
                  </span>
                </button>
              ))
            ) : (
              /* Assentos Individuais estilo Seats.io (Coloridos por Categoria quando Livres, Cinza Escuro quando Ocupados/Bloqueados) */
              seats.map(seat => {
                const cat = resolveSeatCategory(seat)
                const isSelectedInStudio = selectedSeatIds.includes(seat.id)
                const isSelectedByBuyer = !!buyerSelectedSeats[seat.id]
                const isDimmedByFilter =
                  buyerCategoryFilter !== 'ALL' && cat.id !== buyerCategoryFilter

                const w = seatShape === 'armchair' ? seat.width || 20 : 18
                const h = seatShape === 'armchair' ? seat.height || 27 : 18

                // Padrão visual Seats.io: Assentos livres ganham a cor viva da Categoria; Vendidos/Bloqueados ficam discretos
                const fillHex =
                  seat.status === 'free'
                    ? isSelectedByBuyer
                      ? '#10B981'
                      : cat.color
                    : seat.status === 'sold'
                    ? '#94A3B8'
                    : seat.status === 'reserved'
                    ? '#F97316'
                    : '#1E293B'

                const channelKey = seatChannels[seat.id]
                const channelObj = channelKey
                  ? SEATSIO_CHANNELS.find(c => c.key === channelKey)
                  : null

                return (
                  <button
                    key={seat.id}
                    type="button"
                    onClick={e => handleSeatClick(e, seat)}
                    onMouseEnter={() => setHoveredSeat(seat)}
                    onMouseLeave={() => setHoveredSeat(prev => (prev?.id === seat.id ? null : prev))}
                    style={{
                      left: `${seat.x - w / 2}px`,
                      top: `${seat.y - h / 2}px`,
                      width: `${w}px`,
                      height: `${h}px`,
                      transform: `rotate(${seat.rotation || 0}deg)`,
                      backgroundColor: fillHex,
                      opacity: isDimmedByFilter ? 0.22 : 1,
                      borderColor:
                        isSelectedInStudio || isSelectedByBuyer
                          ? '#FFFFFF'
                          : channelObj && mode === 'event_manager' && managerTab === 'channels'
                          ? channelObj.color
                          : '#0F172A'
                    }}
                    className={`absolute flex items-center justify-center p-0 border-2 transition-transform ${
                      seatShape === 'circle'
                        ? 'rounded-full'
                        : seatShape === 'square'
                        ? 'rounded-[4px]'
                        : 'rounded-t-md rounded-b-xs'
                    } ${
                      isSelectedInStudio || isSelectedByBuyer
                        ? 'z-30 scale-130 ring-2 ring-amber-400 shadow-lg'
                        : seat.status === 'free'
                        ? 'z-10 hover:scale-125 cursor-pointer'
                        : 'z-10 opacity-65 cursor-not-allowed'
                    }`}
                  >
                    {isSelectedByBuyer ? (
                      <span className="text-[9px] font-black text-white">✓</span>
                    ) : (
                      <span className="text-[7px] font-extrabold text-white leading-none drop-shadow">
                        {seat.seatNumber}
                      </span>
                    )}
                  </button>
                )
              })
            )}

            {/* Retângulo de Seleção em Laço (Marquee Selection Box do Seats.io) */}
            {lassoRect && (
              <div
                className="pointer-events-none absolute z-40 border-2 border-indigo-500 bg-indigo-500/20 rounded-xs"
                style={{
                  left: `${Math.min(lassoRect.startX, lassoRect.curX)}px`,
                  top: `${Math.min(lassoRect.startY, lassoRect.curY)}px`,
                  width: `${Math.abs(lassoRect.curX - lassoRect.startX)}px`,
                  height: `${Math.abs(lassoRect.curY - lassoRect.startY)}px`
                }}
              />
            )}

            {/* Tooltip Flutuante Rico estilo Seats.io ao passar o mouse em um assento */}
            {hoveredSeat && !semanticSectorOverview && (
              <div
                className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full w-56 bg-slate-950/95 text-white rounded-xl border border-slate-700 shadow-2xl overflow-hidden"
                style={{
                  left: `${hoveredSeat.x}px`,
                  top: `${Math.max(10, hoveredSeat.y - 16)}px`
                }}
              >
                {(() => {
                  const cat = resolveSeatCategory(hoveredSeat)
                  const distPx = Math.round(
                    Math.hypot(hoveredSeat.x - focalPoint.x, hoveredSeat.y - focalPoint.y)
                  )
                  const sightScore = Math.max(72, Math.min(99, 100 - Math.round(distPx / 45)))
                  return (
                    <>
                      <div
                        className="px-3 py-1.5 text-[11px] font-black text-slate-950 flex items-center justify-between"
                        style={{ backgroundColor: cat.color }}
                      >
                        <span className="truncate">{cat.name}</span>
                        <span>R$ {cat.priceBRL}</span>
                      </div>
                      <div className="p-2.5 space-y-1 text-[11px]">
                        <div className="font-bold text-white">{hoveredSeat.sectorName}</div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span>Fila: <strong>{hoveredSeat.rowLabel}</strong></span>
                          <span>Assento: <strong>{hoveredSeat.label}</strong></span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-emerald-400 pt-1 border-t border-slate-800">
                          <span>Visibilidade Palco: {sightScore}%</span>
                          <span>Meia: R$ {cat.halfPriceBRL}</span>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </div>

        {/* -----------------------------------------------------------------
            PAINEL DIREITO CONTEXTUAL SEATS.IO (DESIGNER / EVENT MANAGER / CHECKOUT CART)
        ----------------------------------------------------------------- */}
        <div className="w-80 bg-[#111827] border-l border-slate-800 flex flex-col shrink-0 text-xs overflow-y-auto">
          {/* MODO 1: SEATS.IO CHART DESIGNER INSPECTOR */}
          {mode === 'designer' && (
            <div className="p-4 space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Seats.io Chart Designer
                </span>
                <h3 className="text-sm font-black text-white mt-0.5">
                   Gerador Paramétrico & Categorias
                </h3>
              </div>

              {/* Ações em Lote para os Assentos Selecionados no Laço */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">
                    Seleção Atual ({selectedSeatIds.length})
                  </span>
                  {selectedSeatIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSeatIds([])}
                      className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Atribuir Categoria Seats.io à Seleção:
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

              {/* Parametrização do Gerador de Fileiras Curvas (Row / Section Block Tool) */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">
                    Gerador de Fileiras Curvas (Row Tool)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Arco Seats.io
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Setor Destino</label>
                    <input
                      type="text"
                      value={rowBuilderSectorName}
                      onChange={e => setRowBuilderSectorName(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Letra Fila Inicial</label>
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
                      Poltronas / Fila: <strong>{rowBuilderSeatsPerRow}</strong>
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
                    <span>Curvatura da Fileira (Curve):</span>
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

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Regra de Numeração Seats.io:
                  </label>
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
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDesignerTool('draw_block')
                    setBestAvailFeedback(
                      'Clique em qualquer ponto do mapa para carimbar o bloco de fileiras curvas.'
                    )
                  }}
                  className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow cursor-pointer"
                >
                  + Ativar Carimbo de Bloco Curvo no Mapa
                </button>
              </div>

              {/* Parametrização do Gerador de Mesas Redondas (Table Tool) */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="font-bold text-emerald-400 block">
                  Gerador de Mesas VIP / Bistrô (Table Tool)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">
                      Cadeiras na Mesa: <strong>{tableSeatsCount}</strong>
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
                      Raio da Mesa: <strong>{tableRadiusPx}px</strong>
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
                    setBestAvailFeedback('Clique no mapa para posicionar uma nova Mesa Redonda.')
                  }}
                  className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                >
                  + Inserir Mesa Redonda no Clique
                </button>
              </div>
            </div>
          )}

          {/* MODO 2: SEATS.IO EVENT MANAGER (STATUS, CANAIS & BEST AVAILABLE) */}
          {mode === 'event_manager' && (
            <div className="p-4 space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Seats.io Event Manager
                </span>
                <h3 className="text-sm font-black text-white mt-0.5">
                  Operação de Disponibilidade & Canais
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setManagerTab('statuses')}
                  className={`py-1.5 rounded text-[11px] font-bold cursor-pointer ${
                    managerTab === 'statuses'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Status
                </button>
                <button
                  type="button"
                  onClick={() => setManagerTab('channels')}
                  className={`py-1.5 rounded text-[11px] font-bold cursor-pointer ${
                    managerTab === 'channels'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Canais
                </button>
                <button
                  type="button"
                  onClick={() => setManagerTab('best_available')}
                  className={`py-1.5 rounded text-[11px] font-bold cursor-pointer ${
                    managerTab === 'best_available'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Best Avail.
                </button>
              </div>

              {managerTab === 'statuses' && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                  <p className="text-[11px] text-slate-300">
                    Selecione poltronas com o laço no mapa (<strong>{selectedSeatIds.length}</strong> selecionadas) e aplique o status operacional:
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyStatusToSelected('free')}
                      disabled={selectedSeatIds.length === 0}
                      className="px-3 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 disabled:opacity-40 text-emerald-300 font-bold flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Unlock size={14} /> Liberar p/ Venda (Free)
                      </span>
                      <span>{stats.free}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyStatusToSelected('blocked')}
                      disabled={selectedSeatIds.length === 0}
                      className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Lock size={14} /> Bloquear / House Hold
                      </span>
                      <span>{stats.blocked}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyStatusToSelected('reserved')}
                      disabled={selectedSeatIds.length === 0}
                      className="px-3 py-2 rounded-lg bg-amber-600/20 border border-amber-500/40 hover:bg-amber-600/30 disabled:opacity-40 text-amber-300 font-bold flex items-center justify-between cursor-pointer"
                    >
                      <span>⏳ Reserva Hold / Token</span>
                      <span>{stats.reserved}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyStatusToSelected('sold')}
                      disabled={selectedSeatIds.length === 0}
                      className="px-3 py-2 rounded-lg bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 disabled:opacity-40 text-rose-300 font-bold flex items-center justify-between cursor-pointer"
                    >
                      <span>🎟️ Marcar como Vendido (Booked)</span>
                      <span>{stats.sold}</span>
                    </button>
                  </div>
                </div>
              )}

              {managerTab === 'channels' && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                  <p className="text-[11px] text-slate-300">
                    Vincule lotes de assentos selecionados (<strong>{selectedSeatIds.length}</strong>) a canais exclusivos de venda Seats.io:
                  </p>
                  <div className="space-y-1.5">
                    {SEATSIO_CHANNELS.map(ch => (
                      <button
                        key={ch.key}
                        type="button"
                        onClick={() => {
                          setActiveChannelBrush(ch.key)
                          applyChannelToSelected(ch.key)
                        }}
                        className={`w-full px-3 py-2 rounded-lg border flex items-center justify-between text-left cursor-pointer ${
                          activeChannelBrush === ch.key
                            ? 'bg-slate-800 border-white text-white font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: ch.color }}
                          />
                          <span>{ch.name}</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 font-mono">
                          {ch.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {managerTab === 'best_available' && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <span className="font-bold text-amber-400 block">
                    Algoritmo Best Available (Seats.io)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Encontra automaticamente os melhores assentos contíguos mais próximos ao Ponto Focal do Palco sem gerar assentos órfãos isolados.
                  </p>

                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">
                      Quantidade de Assentos Contíguos: <strong>{bestAvailCount}</strong>
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
                      Filtrar por Categoria:
                    </label>
                    <select
                      value={bestAvailCategoryFilter}
                      onChange={e => setBestAvailCategoryFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                    >
                      <option value="ALL">Qualquer Categoria (Melhor Visão Global)</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} — R$ {c.priceBRL}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-[11px] text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preventOrphanSeat}
                      onChange={e => setPreventOrphanSeat(e.target.checked)}
                      className="rounded"
                    />
                    <span>Evitar deixar 1 assento isolado na fila (Orphan Rule)</span>
                  </label>

                  <button
                    type="button"
                    onClick={runSeatsIoBestAvailable}
                    data-testid="btn-run-best-available"
                    className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg cursor-pointer"
                  >
                    ✨ Executar Best Available Agora
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MODO 3: SEATS.IO CHECKOUT FLOORPLAN (SIMULADOR DE COMPRA DO CLIENTE) */}
          {mode === 'checkout_preview' && (
            <div className="p-4 flex flex-col h-full justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      Seats.io SeatingChart Checkout
                    </span>
                    <h3 className="text-sm font-black text-white">
                      Seus Ingressos ({buyerCartItems.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={runSeatsIoBestAvailable}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer"
                    title="Selecionar automaticamente os melhores assentos próximos ao palco"
                  >
                    ⚡ Sugerir Melhores
                  </button>
                </div>

                {buyerCartItems.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 text-center space-y-2">
                    <ShoppingCart size={26} className="mx-auto text-slate-500" />
                    <p className="text-xs font-semibold text-slate-300">
                      Clique nos assentos disponíveis no mapa para simular a experiência de compra Seats.io.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
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

              {/* Resumo de Fechamento do Checkout */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total Selecionado:</span>
                  <span className="text-base font-black text-emerald-400">
                    R$ {buyerTotalBRL.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={buyerCartItems.length === 0 || orphanSeatWarnings.length > 0}
                  onClick={() => {
                    const buyerIds = new Set(Object.keys(buyerSelectedSeats))
                    onCommitSeats(
                      seats.map(s => (buyerIds.has(s.id) ? { ...s, status: 'sold' } : s))
                    )
                    setBuyerSelectedSeats({})
                    setBestAvailFeedback(
                      `✅ Reserva confirmada via Seats.io API! ${buyerIds.size} ingresso(s) marcados como Vendidos.`
                    )
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                >
                  Confirmar Compra Simulada ({buyerCartItems.length})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
