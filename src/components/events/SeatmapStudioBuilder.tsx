import React, { useMemo, useRef, useState } from 'react'
import {
  Circle,
  Copy,
  Crosshair,
  Download,
  Eraser,
  Grid,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Lock,
  Maximize2,
  MousePointer,
  Move,
  Paintbrush,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import type {
  EventSeatingMapConfig,
  SeatShapeType,
  SeatStatusType,
  SeatmapSeatPoint,
  SeatmapZoneElement
} from '../../data/events'

interface Props {
  seatingMap: EventSeatingMapConfig
  onChange: (patch: Partial<EventSeatingMapConfig>) => void
  basePriceBRL: number
}

type StudioTool =
  | 'select'
  | 'add_seat'
  | 'add_row'
  | 'add_table'
  | 'add_zone'
  | 'paint_status'
  | 'erase'

export const SEAT_STATUS_META: Record<
  SeatStatusType,
  {
    label: string
    shortLabel: string
    bgHex: string
    borderHex: string
    textHex: string
    badgeClass: string
    dotClass: string
  }
> = {
  free: {
    label: 'Lugar Livre (Disponível)',
    shortLabel: 'Livre (Azul)',
    bgHex: '#2563EB', // Azul
    borderHex: '#60A5FA',
    textHex: '#FFFFFF',
    badgeClass: 'bg-blue-600/20 text-blue-300 border-blue-500/40',
    dotClass: 'bg-blue-600 border-blue-400'
  },
  sold: {
    label: 'Lugar Vendido (Confirmado)',
    shortLabel: 'Vendido (Verde)',
    bgHex: '#16A34A', // Verde
    borderHex: '#4ADE80',
    textHex: '#FFFFFF',
    badgeClass: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
    dotClass: 'bg-emerald-600 border-emerald-400'
  },
  reserved: {
    label: 'Lugar Reservado (Hold / Cortesia)',
    shortLabel: 'Reservado (Vermelho)',
    bgHex: '#DC2626', // Vermelho
    borderHex: '#F87171',
    textHex: '#FFFFFF',
    badgeClass: 'bg-red-600/20 text-red-300 border-red-500/40',
    dotClass: 'bg-red-600 border-red-400'
  },
  blocked: {
    label: 'Lugar Bloqueado (Produção / Indisponível)',
    shortLabel: 'Bloqueado (Preto)',
    bgHex: '#090D16', // Preto
    borderHex: '#475569',
    textHex: '#94A3B8',
    badgeClass: 'bg-slate-950 text-slate-300 border-slate-600',
    dotClass: 'bg-black border-slate-500'
  }
}

// Plantas em SVG 96 DPI prontas para demonstração / uso imediato
function createPresetBlueprintDataUrl(preset: 'teatro' | 'mesas' | 'arena'): {
  dataUrl: string
  name: string
  width: number
  height: number
} {
  if (preset === 'teatro') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
      <rect width="960" height="600" fill="#0B1220"/>
      <g stroke="#1E293B" stroke-width="1" opacity="0.6">
        <line x1="0" y1="96" x2="960" y2="96"/><line x1="0" y1="192" x2="960" y2="192"/>
        <line x1="0" y1="288" x2="960" y2="288"/><line x1="0" y1="384" x2="960" y2="384"/>
        <line x1="0" y1="480" x2="960" y2="480"/>
        <line x1="96" y1="0" x2="96" y2="600"/><line x1="192" y1="0" x2="192" y2="600"/>
        <line x1="288" y1="0" x2="288" y2="600"/><line x1="384" y1="0" x2="384" y2="600"/>
        <line x1="480" y1="0" x2="480" y2="600"/><line x1="576" y1="0" x2="576" y2="600"/>
        <line x1="672" y1="0" x2="672" y2="600"/><line x1="768" y1="0" x2="768" y2="600"/>
        <line x1="864" y1="0" x2="864" y2="600"/>
      </g>
      <path d="M 180 30 L 780 30 L 730 95 L 230 95 Z" fill="#1E1B4B" stroke="#6366F1" stroke-width="2" stroke-dasharray="6,4"/>
      <text x="480" y="68" fill="#A5B4FC" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">PLANTA 96 DPI — PALCO / FOSSO DE ORQUESTRA</text>
      <rect x="90" y="125" width="780" height="260" rx="18" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="8,5"/>
      <text x="480" y="148" fill="#64748B" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">DEMARCAÇÃO DA PLANTA: PLATEIA CENTRAL (FILEIRAS A–G)</text>
      <rect x="110" y="405" width="740" height="155" rx="18" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="8,5"/>
      <text x="480" y="428" fill="#64748B" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">DEMARCAÇÃO DA PLANTA: BALCÃO NOBRE / CAMAROTES</text>
      <text x="940" y="588" fill="#475569" font-family="monospace" font-size="11" text-anchor="end">ESCALA OFICIAL 960x600px @ 96 DPI</text>
    </svg>`
    return {
      dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      name: 'planta-teatro-auditorio-96dpi.svg',
      width: 960,
      height: 600
    }
  }
  if (preset === 'mesas') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
      <rect width="960" height="600" fill="#0B1220"/>
      <rect x="240" y="25" width="480" height="70" rx="12" fill="#172554" stroke="#3B82F6" stroke-width="2"/>
      <text x="480" y="65" fill="#93C5FD" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">PALCO PRINCIPAL &amp; PASSARELA (96 DPI)</text>
      <circle cx="240" cy="210" r="55" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="5,5"/>
      <circle cx="480" cy="210" r="55" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="5,5"/>
      <circle cx="720" cy="210" r="55" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="5,5"/>
      <circle cx="240" cy="370" r="55" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="5,5"/>
      <circle cx="480" cy="370" r="55" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="5,5"/>
      <circle cx="720" cy="370" r="55" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="5,5"/>
      <rect x="80" y="475" width="800" height="90" rx="14" fill="none" stroke="#475569" stroke-width="2" stroke-dasharray="6,4"/>
      <text x="480" y="525" fill="#64748B" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">LOUNGE / CAMAROTES &amp; BISTRÔS</text>
      <text x="940" y="588" fill="#475569" font-family="monospace" font-size="11" text-anchor="end">PLANTA SALÃO DE MESAS @ 96 DPI</text>
    </svg>`
    return {
      dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      name: 'planta-salao-mesas-bistros-96dpi.svg',
      width: 960,
      height: 600
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
    <rect width="960" height="600" fill="#0B1220"/>
    <rect x="260" y="24" width="440" height="68" rx="10" fill="#31102F" stroke="#EC4899" stroke-width="2"/>
    <text x="480" y="64" fill="#F9A8D4" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">MAIN STAGE • ARENA MULTIUSO (96 DPI)</text>
    <rect x="220" y="120" width="520" height="220" rx="20" fill="#0F172A" stroke="#0EA5E9" stroke-width="2" stroke-dasharray="8,5"/>
    <text x="480" y="235" fill="#38BDF8" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">ÁREA FRONTSTAGE / PISTA PREMIUM</text>
    <rect x="60" y="120" width="130" height="420" rx="14" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-dasharray="6,4"/>
    <rect x="770" y="120" width="130" height="420" rx="14" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-dasharray="6,4"/>
    <rect x="220" y="365" width="520" height="175" rx="16" fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="6,4"/>
    <text x="480" y="390" fill="#FBBF24" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">ARQUIBANCADA CENTRAL NUMERADA</text>
  </svg>`
  return {
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    name: 'planta-arena-multiuso-96dpi.svg',
    width: 960,
    height: 600
  }
}

function buildInitialCanvasSeats(shape: SeatShapeType = 'circle'): SeatmapSeatPoint[] {
  const pts: SeatmapSeatPoint[] = []
  const rows = ['A', 'B', 'C', 'D', 'E']
  rows.forEach((r, rIdx) => {
    for (let s = 1; s <= 16; s++) {
      const x = 165 + (s - 1) * 42 + (s > 8 ? 24 : 0) // corredor central
      const y = 175 + rIdx * 40
      let status: SeatStatusType = 'free'
      if (r === 'A' && (s >= 6 && s <= 11)) status = 'sold'
      else if (r === 'B' && (s === 7 || s === 8)) status = 'reserved'
      else if (r === 'E' && (s === 1 || s === 16)) status = 'blocked'

      pts.push({
        id: `seat-${r}-${s}`,
        label: `${r}${s}`,
        rowLabel: r,
        seatNumber: s,
        sectorId: 'sec-1',
        sectorName: 'Plateia Central',
        x,
        y,
        shape,
        status
      })
    }
  })

  // Balcão Nobre (Fileiras H e I)
  ;['H', 'I'].forEach((r, rIdx) => {
    for (let s = 1; s <= 14; s++) {
      const x = 195 + (s - 1) * 44
      const y = 455 + rIdx * 42
      let status: SeatStatusType = 'free'
      if (r === 'H' && (s === 1 || s === 2)) status = 'reserved'
      if (r === 'I' && s === 14) status = 'blocked'
      pts.push({
        id: `seat-${r}-${s}`,
        label: `${r}${s}`,
        rowLabel: r,
        seatNumber: s,
        sectorId: 'sec-2',
        sectorName: 'Balcão Nobre Superior',
        x,
        y,
        shape,
        status
      })
    }
  })
  return pts
}

export const SeatmapStudioBuilder: React.FC<Props> = ({
  seatingMap,
  onChange,
  basePriceBRL
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const initialPreset = useMemo(() => createPresetBlueprintDataUrl('teatro'), [])

  const seatShape: SeatShapeType = seatingMap.seatShape || 'circle'
  const seatSizePx = seatingMap.seatSizePx || 24
  const bgDataUrl = seatingMap.backgroundImageDataUrl || initialPreset.dataUrl
  const bgFileName = seatingMap.backgroundFileName || initialPreset.name
  const bgDpi = seatingMap.backgroundDpi || 96
  const bgWidthPx = seatingMap.backgroundWidthPx || initialPreset.width
  const bgHeightPx = seatingMap.backgroundHeightPx || initialPreset.height
  const bgOpacity = seatingMap.backgroundOpacity ?? 85

  const seats: SeatmapSeatPoint[] = useMemo(
    () =>
      seatingMap.canvasSeats && seatingMap.canvasSeats.length > 0
        ? seatingMap.canvasSeats
        : buildInitialCanvasSeats(seatShape),
    [seatingMap.canvasSeats, seatShape]
  )

  const zones: SeatmapZoneElement[] = useMemo(
    () =>
      seatingMap.canvasZones || [
        {
          id: 'zone-stage',
          kind: 'stage',
          label: 'PALCO PRINCIPAL',
          x: 240,
          y: 34,
          width: 480,
          height: 54,
          color: '#6366F1'
        }
      ],
    [seatingMap.canvasZones]
  )

  // Estados da Barra de Ferramentas do Studio
  const [activeTool, setActiveTool] = useState<StudioTool>('paint_status')
  const [activeStatusBrush, setActiveStatusBrush] = useState<SeatStatusType>('free')
  const [activeSectorId, setActiveSectorId] = useState<string>(
    seatingMap.sectors[0]?.id || 'sec-1'
  )
  const [zoom, setZoom] = useState<number>(100)
  const [showGrid, setShowGrid] = useState<boolean>(true)
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)
  const [draggingSeatId, setDraggingSeatId] = useState<string | null>(null)
  const [draggingZoneId, setDraggingZoneId] = useState<string | null>(null)
  const [uploadAlert, setUploadAlert] = useState<string | null>(null)

  // Parâmetros para ferramenta de Inserir Fileira / Matriz (Novaoito / Seatmap.pro)
  const [rowPrefix, setRowPrefix] = useState('J')
  const [rowSeatsCount, setRowSeatsCount] = useState(12)
  const [rowsBatchCount, setRowsBatchCount] = useState(1)
  const [rowCurveDeg, setRowCurveDeg] = useState(0)

  // Parâmetros para ferramenta de Inserir Mesa (Eventuxi / Novaoito)
  const [tablePrefix, setTablePrefix] = useState('M1')
  const [tableSeatsCount, setTableSeatsCount] = useState(6)

  // Parâmetros para ferramenta de Zona (FuturaTickets)
  const [zoneKind, setZoneKind] = useState<'stage' | 'camarote' | 'pista'>('camarote')
  const [zoneTitle, setZoneTitle] = useState('Camarote VIP')

  // Contadores em Tempo Real por Status (Azul, Verde, Vermelho, Preto)
  const stats = useMemo(() => {
    const counts = { free: 0, sold: 0, reserved: 0, blocked: 0, total: seats.length }
    for (const s of seats) {
      counts[s.status] = (counts[s.status] || 0) + 1
    }
    return counts
  }, [seats])

  const commitSeats = (nextSeats: SeatmapSeatPoint[], extraPatch?: Partial<EventSeatingMapConfig>) => {
    onChange({
      canvasSeats: nextSeats,
      ...(extraPatch || {})
    })
  }

  // Trocar formato Bolinha (circle) <-> Quadrado (square)
  const handleShapeChange = (newShape: SeatShapeType) => {
    const updated = seats.map(s => ({ ...s, shape: newShape }))
    onChange({
      seatShape: newShape,
      canvasSeats: updated
    })
  }

  // Upload de arquivo PNG, SVG ou JPG/JPEG em 96 DPI
  const processUploadedFile = (file: File) => {
    const validTypes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/jpg']
    const ext = file.name.toLowerCase()
    const isExtValid =
      ext.endsWith('.png') || ext.endsWith('.svg') || ext.endsWith('.jpg') || ext.endsWith('.jpeg')

    if (!validTypes.includes(file.type) && !isExtValid) {
      setUploadAlert('Formato inválido. Envie o fundo do mapa em PNG, SVG, JPG ou JPEG (96 DPI).')
      return
    }

    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = String(ev.target?.result || '')
      const img = new Image()
      img.onload = () => {
        const w = img.naturalWidth || 960
        const h = img.naturalHeight || 600
        onChange({
          backgroundImageDataUrl: dataUrl,
          backgroundFileName: file.name,
          backgroundMimeType: file.type || 'image/png',
          backgroundDpi: 96,
          backgroundWidthPx: w,
          backgroundHeightPx: h
        })
        setUploadAlert(
          `Planta "${file.name}" carregada em 96 DPI (${w}×${h}px • ${(w / 96 * 2.54).toFixed(1)}cm × ${(h / 96 * 2.54).toFixed(1)}cm).`
        )
      }
      img.onerror = () => {
        onChange({
          backgroundImageDataUrl: dataUrl,
          backgroundFileName: file.name,
          backgroundMimeType: file.type || 'image/svg+xml',
          backgroundDpi: 96,
          backgroundWidthPx: 960,
          backgroundHeightPx: 600
        })
        setUploadAlert(`Planta vetorial "${file.name}" aplicada em escala 96 DPI (960×600px).`)
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processUploadedFile(file)
  }

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) processUploadedFile(file)
  }

  const applyPresetBlueprint = (preset: 'teatro' | 'mesas' | 'arena') => {
    const bp = createPresetBlueprintDataUrl(preset)
    if (preset === 'teatro') {
      onChange({
        backgroundImageDataUrl: bp.dataUrl,
        backgroundFileName: bp.name,
        backgroundDpi: 96,
        backgroundWidthPx: bp.width,
        backgroundHeightPx: bp.height,
        canvasSeats: buildInitialCanvasSeats(seatShape)
      })
    } else if (preset === 'mesas') {
      // Auto-gerar mesas estilo Eventuxi / Novaoito
      const tableCenters = [
        { code: 'M1', cx: 240, cy: 210 },
        { code: 'M2', cx: 480, cy: 210 },
        { code: 'M3', cx: 720, cy: 210 },
        { code: 'M4', cx: 240, cy: 370 },
        { code: 'M5', cx: 480, cy: 370 },
        { code: 'M6', cx: 720, cy: 370 }
      ]
      const generatedSeats: SeatmapSeatPoint[] = []
      const generatedZones: SeatmapZoneElement[] = [
        {
          id: 'zone-stage',
          kind: 'stage',
          label: 'PALCO PRINCIPAL',
          x: 240,
          y: 25,
          width: 480,
          height: 68,
          color: '#3B82F6'
        }
      ]
      tableCenters.forEach((t, tIdx) => {
        generatedZones.push({
          id: `tbl-center-${t.code}`,
          kind: 'table_center',
          label: `Mesa ${t.code}`,
          x: t.cx - 34,
          y: t.cy - 34,
          width: 68,
          height: 68,
          color: '#8B5CF6',
          capacity: 8
        })
        for (let i = 0; i < 8; i++) {
          const angle = (i * 2 * Math.PI) / 8
          const sx = Math.round(t.cx + Math.cos(angle) * 56)
          const sy = Math.round(t.cy + Math.sin(angle) * 56)
          const st: SeatStatusType =
            tIdx === 0 && i < 4 ? 'sold' : tIdx === 1 && i < 2 ? 'reserved' : tIdx === 5 && i >= 6 ? 'blocked' : 'free'
          generatedSeats.push({
            id: `seat-${t.code}-${i + 1}`,
            label: `${t.code}-${i + 1}`,
            rowLabel: t.code,
            seatNumber: i + 1,
            sectorId: seatingMap.sectors[0]?.id || 'sec-1',
            sectorName: 'Salão de Mesas VIP',
            x: sx,
            y: sy,
            shape: seatShape,
            status: st
          })
        }
      })
      onChange({
        backgroundImageDataUrl: bp.dataUrl,
        backgroundFileName: bp.name,
        backgroundDpi: 96,
        backgroundWidthPx: bp.width,
        backgroundHeightPx: bp.height,
        canvasSeats: generatedSeats,
        canvasZones: generatedZones
      })
    } else {
      // Arena Híbrida (FuturaTickets)
      const arenaSeats: SeatmapSeatPoint[] = []
      ;['A', 'B', 'C', 'D'].forEach((r, rIdx) => {
        for (let s = 1; s <= 12; s++) {
          arenaSeats.push({
            id: `seat-arq-${r}-${s}`,
            label: `${r}${s}`,
            rowLabel: r,
            seatNumber: s,
            sectorId: seatingMap.sectors[0]?.id || 'sec-1',
            sectorName: 'Arquibancada Numerada',
            x: 245 + (s - 1) * 42,
            y: 415 + rIdx * 34,
            shape: seatShape,
            status: r === 'A' && s <= 5 ? 'sold' : r === 'D' && s === 12 ? 'blocked' : 'free'
          })
        }
      })
      const arenaZones: SeatmapZoneElement[] = [
        {
          id: 'zone-stage',
          kind: 'stage',
          label: 'MAIN STAGE ARENA',
          x: 260,
          y: 24,
          width: 440,
          height: 68,
          color: '#EC4899'
        },
        {
          id: 'zone-pista',
          kind: 'pista',
          label: 'PISTA PREMIUM / FRONTSTAGE (SEM LUGAR MARCADO • 1.200 LUG.)',
          x: 220,
          y: 120,
          width: 520,
          height: 220,
          color: '#0EA5E9',
          capacity: 1200
        },
        {
          id: 'zone-camarote-esq',
          kind: 'camarote',
          label: 'CAMAROTE A',
          x: 60,
          y: 120,
          width: 130,
          height: 420,
          color: '#8B5CF6',
          capacity: 150
        },
        {
          id: 'zone-camarote-dir',
          kind: 'camarote',
          label: 'CAMAROTE B',
          x: 770,
          y: 120,
          width: 130,
          height: 420,
          color: '#8B5CF6',
          capacity: 150
        }
      ]
      onChange({
        backgroundImageDataUrl: bp.dataUrl,
        backgroundFileName: bp.name,
        backgroundDpi: 96,
        backgroundWidthPx: bp.width,
        backgroundHeightPx: bp.height,
        canvasSeats: arenaSeats,
        canvasZones: arenaZones
      })
    }
    setUploadAlert(`Planta 96 DPI "${bp.name}" aplicada com mapeamento interativo completo.`)
  }

  // Clique no Canvas para inserir poltronas, fileiras, mesas ou zonas
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return
    if (draggingSeatId || draggingZoneId) return

    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    const rawX = Math.round((e.clientX - rect.left) / scale)
    const rawY = Math.round((e.clientY - rect.top) / scale)
    const x = showGrid ? Math.round(rawX / 8) * 8 : rawX
    const y = showGrid ? Math.round(rawY / 8) * 8 : rawY

    const sectorObj =
      seatingMap.sectors.find(s => s.id === activeSectorId) ||
      seatingMap.sectors[0] || { id: 'sec-1', name: 'Setor Principal' }

    if (activeTool === 'add_seat') {
      const sameRowSeats = seats.filter(s => s.rowLabel === rowPrefix)
      const nextNum = sameRowSeats.length + 1
      const newSeat: SeatmapSeatPoint = {
        id: `seat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: `${rowPrefix}${nextNum}`,
        rowLabel: rowPrefix,
        seatNumber: nextNum,
        sectorId: sectorObj.id,
        sectorName: sectorObj.name,
        x,
        y,
        shape: seatShape,
        status: activeStatusBrush
      }
      commitSeats([...seats, newSeat])
      setSelectedSeatId(newSeat.id)
    } else if (activeTool === 'add_row') {
      const created: SeatmapSeatPoint[] = []
      const spacing = seatSizePx + 12
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const startIndex = Math.max(0, letters.indexOf(rowPrefix.toUpperCase()[0] || 'A'))

      for (let r = 0; r < rowsBatchCount; r++) {
        const rChar = letters[(startIndex + r) % 26]
        for (let s = 1; s <= rowSeatsCount; s++) {
          const offsetFromCenter = s - (rowSeatsCount + 1) / 2
          const curveOffsetY =
            rowCurveDeg !== 0
              ? Math.round(Math.pow(offsetFromCenter, 2) * (rowCurveDeg / 18))
              : 0
          const sx = Math.round(x + (s - 1) * spacing)
          const sy = Math.round(y + r * (seatSizePx + 14) + curveOffsetY)
          created.push({
            id: `seat-${Date.now()}-${r}-${s}`,
            label: `${rChar}${s}`,
            rowLabel: rChar,
            seatNumber: s,
            sectorId: sectorObj.id,
            sectorName: sectorObj.name,
            x: sx,
            y: sy,
            shape: seatShape,
            status: activeStatusBrush
          })
        }
      }
      commitSeats([...seats, ...created])
    } else if (activeTool === 'add_table') {
      const radius = Math.max(44, tableSeatsCount * 6)
      const newZone: SeatmapZoneElement = {
        id: `tbl-${Date.now()}`,
        kind: 'table_center',
        label: `Mesa ${tablePrefix}`,
        x: x - 30,
        y: y - 30,
        width: 60,
        height: 60,
        color: '#8B5CF6',
        capacity: tableSeatsCount
      }
      const tableSeats: SeatmapSeatPoint[] = []
      for (let i = 0; i < tableSeatsCount; i++) {
        const angle = (i * 2 * Math.PI) / tableSeatsCount
        const sx = Math.round(x + Math.cos(angle) * radius)
        const sy = Math.round(y + Math.sin(angle) * radius)
        tableSeats.push({
          id: `seat-${tablePrefix}-${Date.now()}-${i + 1}`,
          label: `${tablePrefix}-${i + 1}`,
          rowLabel: tablePrefix,
          seatNumber: i + 1,
          sectorId: sectorObj.id,
          sectorName: sectorObj.name,
          x: sx,
          y: sy,
          shape: seatShape,
          status: activeStatusBrush
        })
      }
      onChange({
        canvasSeats: [...seats, ...tableSeats],
        canvasZones: [...zones, newZone]
      })
    } else if (activeTool === 'add_zone') {
      const newZone: SeatmapZoneElement = {
        id: `zone-${Date.now()}`,
        kind: zoneKind,
        label: zoneTitle || (zoneKind === 'stage' ? 'PALCO' : zoneKind === 'camarote' ? 'CAMAROTE' : 'PISTA LIVRE'),
        x: Math.max(10, x - 90),
        y: Math.max(10, y - 40),
        width: zoneKind === 'stage' ? 280 : 180,
        height: zoneKind === 'stage' ? 60 : 90,
        color: zoneKind === 'stage' ? '#6366F1' : zoneKind === 'camarote' ? '#8B5CF6' : '#0EA5E9',
        capacity: zoneKind === 'stage' ? 0 : 200
      }
      onChange({
        canvasZones: [...zones, newZone]
      })
    }
  }

  // Clique em uma poltrona existente
  const handleSeatClick = (e: React.MouseEvent, seat: SeatmapSeatPoint) => {
    e.stopPropagation()
    if (activeTool === 'erase') {
      commitSeats(seats.filter(s => s.id !== seat.id))
      if (selectedSeatId === seat.id) setSelectedSeatId(null)
      return
    }
    if (activeTool === 'paint_status') {
      const updated = seats.map(s =>
        s.id === seat.id ? { ...s, status: activeStatusBrush } : s
      )
      commitSeats(updated)
      setSelectedSeatId(seat.id)
      return
    }
    setSelectedSeatId(seat.id)
  }

  // Arrastar poltrona ou zona (Drag and Drop no Canvas)
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingSeatId && !draggingZoneId) return
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    const rawX = Math.round((e.clientX - rect.left) / scale)
    const rawY = Math.round((e.clientY - rect.top) / scale)
    const x = showGrid ? Math.round(rawX / 8) * 8 : rawX
    const y = showGrid ? Math.round(rawY / 8) * 8 : rawY

    if (draggingSeatId) {
      const updated = seats.map(s => (s.id === draggingSeatId ? { ...s, x, y } : s))
      commitSeats(updated)
    } else if (draggingZoneId) {
      const updatedZones = zones.map(z =>
        z.id === draggingZoneId
          ? { ...z, x: Math.max(0, x - Math.round(z.width / 2)), y: Math.max(0, y - Math.round(z.height / 2)) }
          : z
      )
      onChange({ canvasZones: updatedZones })
    }
  }

  const stopDragging = () => {
    setDraggingSeatId(null)
    setDraggingZoneId(null)
  }

  const paintAllSeatsStatus = (status: SeatStatusType) => {
    commitSeats(seats.map(s => ({ ...s, status })))
  }

  const selectedSeatObj = seats.find(s => s.id === selectedSeatId) || null

  return (
    <div
      className="rounded-2xl border border-slate-800 bg-[#070C17] p-4 sm:p-5 text-white space-y-4 shadow-2xl"
      data-testid="seatmap-studio-builder"
    >
      {/* 1. Cabeçalho do Studio com Referências Oficiais */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Seatmap Studio Pro • 96 DPI Engine
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Arquitetura Inspirada em: <strong className="text-slate-200">Seatmap.pro</strong> •{' '}
              <strong className="text-slate-200">Novaoito</strong> •{' '}
              <strong className="text-slate-200">Eventuxi IA</strong> •{' '}
              <strong className="text-slate-200">FuturaTickets</strong>
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-white">
            Construtor Visual de Mapa de Assentos sobre Planta (PNG, SVG ou JPEG em 96 DPI)
          </h3>
          <p className="text-xs text-slate-400">
            Envie o fundo do mapa em 96 DPI, escolha poltronas em <strong>Bolinhas</strong> ou <strong>Quadrados</strong> e controle os lugares em tempo real: <span className="text-blue-400 font-bold">Azul (Livre)</span>, <span className="text-emerald-400 font-bold">Verde (Vendido)</span>, <span className="text-red-400 font-bold">Vermelho (Reservado)</span> e <span className="text-slate-300 font-bold">Preto (Bloqueado)</span>.
          </p>
        </div>

        {/* Plantas 96 DPI de Exemplo & IA Auto-Map */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => applyPresetBlueprint('teatro')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
          >
            Planta Teatro 96 DPI
          </button>
          <button
            type="button"
            onClick={() => applyPresetBlueprint('mesas')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
          >
            Planta Mesas IA (Eventuxi)
          </button>
          <button
            type="button"
            onClick={() => applyPresetBlueprint('arena')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
          >
            Planta Híbrida (FuturaTickets)
          </button>
        </div>
      </div>

      {/* 2. Área de Upload da Planta Baixa em PNG / SVG / JPG / JPEG @ 96 DPI */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDropFile}
        className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3.5 rounded-xl bg-slate-900/90 border border-dashed border-slate-700 items-center"
      >
        <div className="lg:col-span-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
            <Upload size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-white">
                Fundo do Mapa (PNG, SVG, JPG ou JPEG em 96 DPI)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {bgWidthPx}×{bgHeightPx}px @ {bgDpi} DPI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Arquivo ativo: <strong className="text-slate-200">{bgFileName}</strong> • Arraste sua planta aqui ou clique em Enviar Planta
            </p>
            {uploadAlert && (
              <p className="text-[11px] font-bold text-cyan-400 mt-1">{uploadAlert}</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 flex flex-wrap items-center justify-end gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.svg,.jpg,.jpeg,image/png,image/svg+xml,image/jpeg"
            onChange={handleFileInput}
            className="hidden"
            data-testid="input-upload-map-background"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-testid="btn-upload-map-background"
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <ImageIcon size={15} />
            <span>Enviar Fundo (PNG / SVG / JPEG 96 DPI)</span>
          </button>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400">Opacidade Planta:</span>
            <input
              type="range"
              min={15}
              max={100}
              value={bgOpacity}
              onChange={e => onChange({ backgroundOpacity: Number(e.target.value) })}
              className="w-20 accent-blue-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-200 w-9">{bgOpacity}%</span>
          </div>
        </div>
      </div>

      {/* 3. Barra de Controles: Formato (Bolinhas vs Quadrados) + Cores de Status (Azul, Verde, Vermelho, Preto) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* Seletor de Formato da Poltrona: Bolinhas ou Quadrados */}
        <div className="xl:col-span-4 p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              1. Formato das Poltronas
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Tamanho:</span>
              <input
                type="number"
                min={16}
                max={34}
                value={seatSizePx}
                onChange={e => onChange({ seatSizePx: Math.min(34, Math.max(16, Number(e.target.value) || 24)) })}
                className="w-12 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-white font-bold text-center"
              />
              <span>px</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleShapeChange('circle')}
              data-testid="btn-seat-shape-circle"
              className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                seatShape === 'circle'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-blue-400 border border-white inline-block" />
              <span>Bolinhas (Círculo)</span>
            </button>

            <button
              type="button"
              onClick={() => handleShapeChange('square')}
              data-testid="btn-seat-shape-square"
              className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                seatShape === 'square'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
              }`}
            >
              <span className="w-4 h-4 rounded-[3px] bg-blue-400 border border-white inline-block" />
              <span>Quadrados (Poltrona)</span>
            </button>
          </div>
        </div>

        {/* Legenda & Seletor de Cores de Status (Azul Livre, Verde Vendido, Vermelho Reservado, Preto Bloqueado) */}
        <div className="xl:col-span-8 p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              2. Status e Cores das Poltronas (Clique para ativar o pincel de status)
            </span>
            <span className="text-[11px] font-bold text-slate-300">
              Total Mapeado: <strong className="text-white">{stats.total} poltronas</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { key: 'free' as const, count: stats.free },
                { key: 'sold' as const, count: stats.sold },
                { key: 'reserved' as const, count: stats.reserved },
                { key: 'blocked' as const, count: stats.blocked }
              ] as const
            ).map(({ key, count }) => {
              const meta = SEAT_STATUS_META[key]
              const isSelected = activeStatusBrush === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveStatusBrush(key)
                    if (activeTool !== 'add_seat' && activeTool !== 'add_row' && activeTool !== 'add_table') {
                      setActiveTool('paint_status')
                    }
                  }}
                  data-testid={`status-brush-${key}`}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'ring-2 ring-white bg-slate-800 border-white'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 shrink-0 border ${
                        seatShape === 'circle' ? 'rounded-full' : 'rounded-[3px]'
                      }`}
                      style={{
                        backgroundColor: meta.bgHex,
                        borderColor: meta.borderHex
                      }}
                    />
                    <div>
                      <div className="text-xs font-black text-white leading-tight">{meta.shortLabel}</div>
                      <div className="text-[10px] text-slate-400">{count} poltrona(s)</div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 4. Barra de Ferramentas de Inserção e Edição no Mapa */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'select' as StudioTool, label: 'Mover / Arrastar (Drag & Drop)', icon: Move },
              { id: 'paint_status' as StudioTool, label: 'Pintar Status (Azul/Verde/Vermelho/Preto)', icon: Paintbrush },
              { id: 'add_seat' as StudioTool, label: 'Inserir Poltrona no Clique', icon: Plus },
              { id: 'add_row' as StudioTool, label: 'Inserir Fileira / Bloco (Novaoito)', icon: LayoutGrid },
              { id: 'add_table' as StudioTool, label: 'Inserir Mesa Redonda (Eventuxi)', icon: Circle },
              { id: 'add_zone' as StudioTool, label: 'Inserir Camarote / Pista / Palco', icon: Layers },
              { id: 'erase' as StudioTool, label: 'Excluir Poltrona', icon: Eraser }
            ].map(tool => {
              const Icon = tool.icon
              const active = activeTool === tool.id
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  data-testid={`studio-tool-${tool.id}`}
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tool.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowGrid(!showGrid)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                showGrid
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
              title="Grade 96 DPI"
            >
              Grade 96 DPI
            </button>
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(50, z - 10))}
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
              title="Diminuir Zoom"
            >
              <ZoomOut size={15} />
            </button>
            <span className="text-xs font-bold text-slate-300 px-1">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(160, z + 10))}
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              onClick={() => commitSeats([])}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer flex items-center gap-1"
              title="Limpar todas as poltronas para começar do zero"
            >
              <Trash2 size={13} />
              <span>Limpar Poltronas</span>
            </button>
          </div>
        </div>

        {/* Sub-opções dinâmicas conforme a ferramenta escolhida */}
        {activeTool === 'add_row' && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-800 items-end">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Letra Inicial da Fileira
              </label>
              <input
                type="text"
                maxLength={2}
                value={rowPrefix}
                onChange={e => setRowPrefix(e.target.value.toUpperCase() || 'A')}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-950 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Poltronas por Fileira
              </label>
              <input
                type="number"
                min={2}
                max={30}
                value={rowSeatsCount}
                onChange={e => setRowSeatsCount(Math.max(2, Number(e.target.value)))}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-950 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Qtd. de Fileiras Seguidas
              </label>
              <input
                type="number"
                min={1}
                max={15}
                value={rowsBatchCount}
                onChange={e => setRowsBatchCount(Math.max(1, Number(e.target.value)))}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-950 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Curvatura Arco Teatro
              </label>
              <input
                type="number"
                min={-10}
                max={10}
                value={rowCurveDeg}
                onChange={e => setRowCurveDeg(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-950 border border-slate-700 text-white"
              />
            </div>
            <div className="text-[11px] text-amber-300 font-semibold">
              ➔ Clique em qualquer ponto da planta abaixo para carimbar a(s) fileira(s).
            </div>
          </div>
        )}

        {activeTool === 'add_table' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800 items-end">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Código da Mesa
              </label>
              <input
                type="text"
                value={tablePrefix}
                onChange={e => setTablePrefix(e.target.value.toUpperCase() || 'M1')}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-950 border border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Poltronas ao Redor da Mesa
              </label>
              <select
                value={tableSeatsCount}
                onChange={e => setTableSeatsCount(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-950 border border-slate-700 text-white"
              >
                <option value={4}>4 Lugares por Mesa</option>
                <option value={6}>6 Lugares por Mesa</option>
                <option value={8}>8 Lugares por Mesa</option>
                <option value={10}>10 Lugares por Mesa</option>
                <option value={12}>12 Lugares por Mesa</option>
              </select>
            </div>
            <div className="sm:col-span-2 text-[11px] text-amber-300 font-semibold">
              ➔ Clique na planta para posicionar a mesa com {tableSeatsCount} poltronas ({seatShape === 'circle' ? 'bolinhas' : 'quadrados'}) ao redor.
            </div>
          </div>
        )}

        {activeTool === 'add_zone' && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800 items-end">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Tipo de Área / Bloco
              </label>
              <select
                value={zoneKind}
                onChange={e => setZoneKind(e.target.value as 'stage' | 'camarote' | 'pista')}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-950 border border-slate-700 text-white"
              >
                <option value="camarote">Camarote / Lounge</option>
                <option value="pista">Pista Sem Lugar Marcado</option>
                <option value="stage">Palco / Passarela / House Mix</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Rótulo no Mapa
              </label>
              <input
                type="text"
                value={zoneTitle}
                onChange={e => setZoneTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-950 border border-slate-700 text-white"
              />
            </div>
            <div className="sm:col-span-2 text-[11px] text-amber-300 font-semibold">
              ➔ Clique no mapa para adicionar o bloco de {zoneTitle || 'Setor'}.
            </div>
          </div>
        )}
      </div>

      {/* 5. Canvas Interativo 96 DPI com Fundo PNG/SVG/JPEG + Poltronas (Bolinhas/Quadrados) */}
      <div className="overflow-auto rounded-2xl border-2 border-slate-800 bg-[#050811] p-3 max-h-[640px]">
        <div
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
          data-testid="seatmap-96dpi-canvas"
          className="relative mx-auto select-none overflow-hidden rounded-xl border border-slate-700/80 shadow-2xl"
          style={{
            width: `${bgWidthPx}px`,
            height: `${bgHeightPx}px`,
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left',
            cursor:
              activeTool === 'add_seat' || activeTool === 'add_row' || activeTool === 'add_table' || activeTool === 'add_zone'
                ? 'crosshair'
                : activeTool === 'erase'
                ? 'not-allowed'
                : 'default',
            backgroundImage: showGrid
              ? 'radial-gradient(rgba(148, 163, 184, 0.16) 1px, transparent 1px)'
              : 'none',
            backgroundSize: '16px 16px'
          }}
        >
          {/* Imagem de Fundo Carregada em PNG / SVG / JPEG @ 96 DPI */}
          {bgDataUrl && (
            <img
              src={bgDataUrl}
              alt="Planta Baixa 96 DPI do Evento"
              draggable={false}
              className="pointer-events-none absolute inset-0 w-full h-full object-contain"
              style={{ opacity: bgOpacity / 100 }}
            />
          )}

          {/* Zonas Estruturais (Palco, Camarotes, Pistas, Centros de Mesa) */}
          {zones.map(z => (
            <div
              key={z.id}
              onMouseDown={e => {
                if (activeTool === 'select') {
                  e.stopPropagation()
                  setDraggingZoneId(z.id)
                } else if (activeTool === 'erase') {
                  e.stopPropagation()
                  onChange({ canvasZones: zones.filter(item => item.id !== z.id) })
                }
              }}
              className={`absolute flex flex-col items-center justify-center text-center font-black transition ${
                z.kind === 'table_center' ? 'rounded-full' : 'rounded-xl'
              } ${activeTool === 'select' ? 'cursor-move hover:ring-2 hover:ring-white' : ''}`}
              style={{
                left: `${z.x}px`,
                top: `${z.y}px`,
                width: `${z.width}px`,
                height: `${z.height}px`,
                backgroundColor: `${z.color}28`,
                border: `2px solid ${z.color}`,
                color: '#F8FAFC'
              }}
            >
              <span className="text-[11px] tracking-wider uppercase px-1 leading-tight">{z.label}</span>
              {z.capacity ? (
                <span className="text-[9px] font-semibold text-slate-300">{z.capacity} lug.</span>
              ) : null}
            </div>
          ))}

          {/* Poltronas Renderizadas como Bolinhas (circle) ou Quadrados (square) nas 4 Cores Oficiais */}
          {seats.map(seat => {
            const meta = SEAT_STATUS_META[seat.status] || SEAT_STATUS_META.free
            const isSelected = selectedSeatId === seat.id
            const half = Math.round(seatSizePx / 2)
            return (
              <button
                key={seat.id}
                type="button"
                onClick={e => handleSeatClick(e, seat)}
                onMouseDown={e => {
                  if (activeTool === 'select') {
                    e.stopPropagation()
                    setSelectedSeatId(seat.id)
                    setDraggingSeatId(seat.id)
                  }
                }}
                title={`Poltrona ${seat.label} • Setor: ${seat.sectorName} • Status: ${meta.label}`}
                data-testid={`canvas-seat-${seat.label}`}
                className={`absolute flex items-center justify-center font-extrabold transition shadow-sm ${
                  seat.shape === 'circle' ? 'rounded-full' : 'rounded-[4px]'
                } ${isSelected ? 'ring-2 ring-amber-400 scale-125 z-20' : 'hover:scale-115 z-10'}`}
                style={{
                  left: `${seat.x - half}px`,
                  top: `${seat.y - half}px`,
                  width: `${seatSizePx}px`,
                  height: `${seatSizePx}px`,
                  backgroundColor: meta.bgHex,
                  border: `2px solid ${meta.borderHex}`,
                  color: meta.textHex,
                  fontSize: seatSizePx >= 22 ? '9px' : '7px',
                  cursor: activeTool === 'select' ? 'grab' : 'pointer'
                }}
              >
                {seat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 6. Rodapé do Studio: Ações Rápidas em Massa e Inspector da Poltrona Selecionada */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1 items-center">
        <div className="lg:col-span-7 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-bold">Ações Rápidas em Massa:</span>
          <button
            type="button"
            onClick={() => paintAllSeatsStatus('free')}
            className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold cursor-pointer"
          >
            Marcar Todas Livres (Azul)
          </button>
          <button
            type="button"
            onClick={() => paintAllSeatsStatus('reserved')}
            className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 font-bold cursor-pointer"
          >
            Reservar Todas (Vermelho)
          </button>
          <button
            type="button"
            onClick={() => paintAllSeatsStatus('blocked')}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-600 font-bold cursor-pointer"
          >
            Bloquear Todas (Preto)
          </button>
        </div>

        <div className="lg:col-span-5 flex items-center justify-end">
          {selectedSeatObj ? (
            <div className="flex flex-wrap items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
              <span className="font-black text-amber-400">Poltrona {selectedSeatObj.label}</span>
              <span className="text-slate-400">({selectedSeatObj.x}px, {selectedSeatObj.y}px)</span>
              <select
                value={selectedSeatObj.status}
                onChange={e => {
                  const st = e.target.value as SeatStatusType
                  commitSeats(
                    seats.map(s => (s.id === selectedSeatObj.id ? { ...s, status: st } : s))
                  )
                }}
                className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-white font-bold text-xs"
              >
                <option value="free">🔵 Azul — Lugar Livre</option>
                <option value="sold">🟢 Verde — Lugar Vendido</option>
                <option value="reserved">🔴 Vermelho — Reservado</option>
                <option value="blocked">⚫ Preto — Bloqueado</option>
              </select>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">
              Dica: Clique em qualquer poltrona para pintar seu status ou selecione <strong>Mover / Arrastar</strong> para posicionar na planta.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
