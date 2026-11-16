import React, { useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Eraser,
  FolderPlus,
  Hand,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Maximize2,
  MousePointer,
  Move,
  Paintbrush,
  Plus,
  RotateCw,
  Search,
  Square,
  Trash2,
  Upload,
  X,
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
import { SeatsIoChartEngine, type SeatsIoMode } from './SeatsIoChartEngine'

interface Props {
  seatingMap: EventSeatingMapConfig
  onChange: (patch: Partial<EventSeatingMapConfig>) => void
  basePriceBRL: number
  eventCode?: string
  eventTitle?: string
  eventVenue?: string
  onUpdateEventMeta?: (patch: { code?: string; title?: string; venue?: string }) => void
}

type StudioTool =
  | 'pan'
  | 'select' // F6 - Mover / Selecionar
  | 'resize' // F7 - Redimensionar
  | 'rotate' // F8 - Rotacionar
  | 'paint_status'
  | 'add_seat'
  | 'add_row'
  | 'add_table'
  | 'add_zone'
  | 'erase'

type ColorPaletteMode = 'video_classic' | 'status_4colors'

// Metadados das 4 cores oficiais de status (Azul, Verde, Vermelho, Preto) + modo Clássico do Vídeo (Prata, Vermelho, Azul, Preto)
export const SEAT_STATUS_META: Record<
  SeatStatusType,
  {
    label: string
    shortLabel: string
    bgHex: string
    borderHex: string
    textHex: string
    classicBgHex: string
    classicBorderHex: string
    classicTextHex: string
    badgeClass: string
    dotClass: string
  }
> = {
  free: {
    label: 'Área Livre (Disponível para Venda)',
    shortLabel: 'Livre (Azul / Prata)',
    bgHex: '#2563EB', // Azul
    borderHex: '#60A5FA',
    textHex: '#FFFFFF',
    classicBgHex: '#D1D5DB', // Prata / Branco (como no vídeo Polt. Livre)
    classicBorderHex: '#6B7280',
    classicTextHex: '#111827',
    badgeClass: 'bg-blue-600/20 text-blue-300 border-blue-500/40',
    dotClass: 'bg-blue-600 border-blue-400'
  },
  sold: {
    label: 'Área Vendida (Confirmado)',
    shortLabel: 'Vendido (Verde / Vermelho)',
    bgHex: '#16A34A', // Verde
    borderHex: '#4ADE80',
    textHex: '#FFFFFF',
    classicBgHex: '#DC2626', // Vermelho (como no vídeo Polt. Vendida)
    classicBorderHex: '#7F1D1D',
    classicTextHex: '#FFFFFF',
    badgeClass: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
    dotClass: 'bg-emerald-600 border-emerald-400'
  },
  reserved: {
    label: 'Área Reservada (Hold / Cortesia)',
    shortLabel: 'Reservado (Vermelho)',
    bgHex: '#DC2626', // Vermelho
    borderHex: '#F87171',
    textHex: '#FFFFFF',
    classicBgHex: '#F59E0B', // Âmbar / Reservado no modo clássico
    classicBorderHex: '#92400E',
    classicTextHex: '#111827',
    badgeClass: 'bg-red-600/20 text-red-300 border-red-500/40',
    dotClass: 'bg-red-600 border-red-400'
  },
  blocked: {
    label: 'Área Bloqueada (Indisponível / Produção)',
    shortLabel: 'Bloqueado (Preto)',
    bgHex: '#090D16', // Preto
    borderHex: '#475569',
    textHex: '#94A3B8',
    classicBgHex: '#27272A', // Cinza Chumbo / Preto (como no vídeo Polt. Bloqueada)
    classicBorderHex: '#09090B',
    classicTextHex: '#D4D4D8',
    badgeClass: 'bg-slate-950 text-slate-300 border-slate-600',
    dotClass: 'bg-black border-slate-500'
  }
}

// Catálogo de Layouts Salvos (idêntico ao dropdown Layout do vídeo aos 01:31)
const SAVED_LAYOUT_PRESETS = [
  { id: 'marista-00', name: '00 Marista Maringá - 00 ok 2026', preset: 'marista' as const },
  { id: 'marista-01', name: '01 Marista Maringá - 02 ok 2026 A-H', preset: 'marista' as const },
  { id: 'marista-02', name: '02 Marista Maringá - 01 ok 2026', preset: 'marista' as const },
  { id: 'marista-03', name: '03 Marista Maringá - 03 ok 2026', preset: 'marista' as const },
  { id: 'marista-04', name: '04 Marista Maringá - 06 ok 2026', preset: 'marista' as const },
  { id: 'marista-05', name: '05 Marista Maringá - 02 ok 2026 - Bruna Louise', preset: 'marista' as const },
  { id: 'marista-06', name: '06 Marista Maringá - 07 ok 2026', preset: 'marista' as const },
  { id: 'marista-07', name: '07 Marista Maringá - 01 ok 2026 - LUNE', preset: 'marista' as const },
  { id: 'marista-08', name: '08 Marista Maringá - 08 ok 2026 Mauricio Meireles', preset: 'marista' as const },
  { id: 'teatro-96', name: '09 Teatro Positivo - Auditório 96 DPI', preset: 'teatro' as const },
  { id: 'mesas-96', name: '10 Salão de Mesas & Bistrôs VIP 96 DPI', preset: 'mesas' as const },
  { id: 'arena-96', name: '11 Arena Híbrida Multiuso 96 DPI', preset: 'arena' as const }
]

// Setores Master oficiais da Árvore "Estrutura" (idênticos ao vídeo)
const MARISTA_MASTER_SECTORS = [
  { id: 'CAMAROTE D', name: 'CAMAROTE D', rows: ['FILA O', 'FILA P', 'FILA Q'], rotation: 39, width: 242.7, height: 150.0 },
  { id: 'CAMAROTE E', name: 'CAMAROTE E', rows: ['FILA O', 'FILA P', 'FILA Q'], rotation: 0, width: 260.0, height: 110.0 },
  { id: 'CAMAROTE F', name: 'CAMAROTE F', rows: ['FILA O', 'FILA P', 'FILA Q'], rotation: -42, width: 242.7, height: 150.0 },
  {
    id: 'PLATEIA A - Lateral Esquerda',
    name: 'PLATEIA A - Lateral Esquerda',
    rows: ['FILA A', 'FILA B', 'FILA C', 'FILA D', 'FILA E', 'FILA F', 'FILA G', 'FILA H', 'FILA I', 'FILA J', 'FILA K', 'FILA L', 'FILA M', 'FILA N'],
    rotation: 39,
    width: 380.0,
    height: 460.0
  },
  {
    id: 'PLATEIA B - Central',
    name: 'PLATEIA B - Central',
    rows: ['FILA H', 'FILA I', 'FILA J', 'FILA K', 'FILA L', 'FILA M', 'FILA N'],
    rotation: 0,
    width: 440.0,
    height: 240.0
  },
  {
    id: 'PLATEIA B - Premium',
    name: 'PLATEIA B - Premium',
    rows: ['FILA A', 'FILA B', 'FILA C', 'FILA D', 'FILA E', 'FILA F', 'FILA G'],
    rotation: 0,
    width: 390.0,
    height: 240.0
  },
  {
    id: 'PLATEIA C - Lateral Direita',
    name: 'PLATEIA C - Lateral Direita',
    rows: ['FILA A', 'FILA B', 'FILA C', 'FILA D', 'FILA E', 'FILA F', 'FILA G', 'FILA H', 'FILA I', 'FILA J', 'FILA K', 'FILA L', 'FILA M', 'FILA N'],
    rotation: -42,
    width: 380.0,
    height: 460.0
  }
]

// Planta Vetorial 96 DPI idêntica ao Teatro Marista Maringá do vídeo
function createPresetBlueprintDataUrl(preset: 'marista' | 'teatro' | 'mesas' | 'arena'): {
  dataUrl: string
  name: string
  width: number
  height: number
} {
  if (preset === 'marista') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1360" height="860" viewBox="0 0 1360 860">
      <rect width="1360" height="860" fill="#FFFFFF"/>
      <!-- Borda externa da planta -->
      <rect x="8" y="8" width="1344" height="844" fill="none" stroke="#CBD5E1" stroke-width="1.5"/>

      <!-- PALCO -->
      <path d="M 410 15 L 950 15 L 950 110 L 820 175 L 540 175 L 410 110 Z" fill="#F8FAFC" stroke="#475569" stroke-width="2"/>
      <text x="680" y="102" fill="#0F172A" font-family="Arial, sans-serif" font-size="48" font-weight="bold" text-anchor="middle">PALCO</text>

      <!-- Corredor Cinza Superior em Leque -->
      <path d="M 410 110 L 540 175 L 820 175 L 950 110 L 1275 435 L 905 765 L 455 765 L 85 435 Z" fill="#E5E7EB" stroke="#CBD5E1" stroke-width="1"/>

      <!-- PLATEIA A (Asa Esquerda Amarela +39 deg) -->
      <polygon points="405,135 528,238 395,705 110,435" fill="#FACC15" stroke="#CA8A04" stroke-width="1.5"/>
      <text x="462" y="172" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="23" font-weight="bold" transform="rotate(39, 462, 172)" text-anchor="middle">PLATEIA A</text>

      <!-- Selos PCD (Cadeirante) Plateia A Fila A -->
      <g transform="translate(492, 212) rotate(39)">
        <rect x="0" y="0" width="16" height="16" rx="2" fill="#0284C7"/>
        <text x="8" y="13" fill="#FFFFFF" font-size="11" text-anchor="middle">♿</text>
        <rect x="18" y="0" width="16" height="16" rx="2" fill="#0284C7"/>
        <text x="26" y="13" fill="#FFFFFF" font-size="11" text-anchor="middle">♿</text>
      </g>

      <!-- PLATEIA B - PREMIUM (Centro Superior Verde) -->
      <polygon points="562,232 798,232 842,482 518,482" fill="#059669" stroke="#047857" stroke-width="1.5"/>
      <text x="680" y="218" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="24" font-weight="bold" text-anchor="middle">PLATEIA B</text>

      <!-- Selos PCD (Cadeirante) Plateia B Fila A -->
      <g transform="translate(755, 240)">
        <rect x="0" y="0" width="16" height="16" rx="2" fill="#0284C7"/>
        <text x="8" y="13" fill="#FFFFFF" font-size="11" text-anchor="middle">♿</text>
        <rect x="18" y="0" width="16" height="16" rx="2" fill="#0284C7"/>
        <text x="26" y="13" fill="#FFFFFF" font-size="11" text-anchor="middle">♿</text>
      </g>

      <!-- PLATEIA B - CENTRAL (Centro Inferior Laranja) -->
      <polygon points="518,482 842,482 892,750 468,750" fill="#F97316" stroke="#EA580C" stroke-width="1.5"/>

      <!-- PLATEIA C (Asa Direita Amarela -42 deg) -->
      <polygon points="955,135 1250,435 965,705 832,238" fill="#FACC15" stroke="#CA8A04" stroke-width="1.5"/>
      <text x="898" y="172" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="23" font-weight="bold" transform="rotate(-41, 898, 172)" text-anchor="middle">PLATEIA C</text>

      <!-- Letras das Filas A..N nos corredores centrais -->
      <g fill="#FFFFFF" font-family="Arial, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">
        <text x="544" y="258">A</text><text x="816" y="258">A</text>
        <text x="537" y="294">B</text><text x="823" y="294">B</text>
        <text x="530" y="330">C</text><text x="830" y="330">C</text>
        <text x="523" y="366">D</text><text x="837" y="366">D</text>
        <text x="516" y="402">E</text><text x="844" y="402">E</text>
        <text x="509" y="438">F</text><text x="851" y="438">F</text>
        <text x="502" y="474">G</text><text x="858" y="474">G</text>
        <text x="494" y="514">H</text><text x="866" y="514">H</text>
        <text x="486" y="550">I</text><text x="874" y="550">I</text>
        <text x="478" y="586">J</text><text x="882" y="586">J</text>
        <text x="470" y="622">K</text><text x="890" y="622">K</text>
        <text x="462" y="658">L</text><text x="898" y="658">L</text>
        <text x="454" y="694">M</text><text x="906" y="694">M</text>
        <text x="446" y="730">N</text><text x="914" y="730">N</text>
      </g>

      <!-- CAMAROTE D (Inferior Esquerdo Azul +39 deg) -->
      <g transform="translate(178, 520) rotate(39)">
        <rect x="0" y="0" width="135" height="90" fill="#1D4ED8" stroke="#1E40AF" stroke-width="1.5"/>
        <rect x="145" y="0" width="115" height="90" fill="#1D4ED8" stroke="#1E40AF" stroke-width="1.5"/>
        <text x="-14" y="25" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="13" font-weight="bold">O</text>
        <text x="-14" y="52" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="13" font-weight="bold">P</text>
        <text x="-14" y="79" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="13" font-weight="bold">Q</text>
        <text x="268" y="25" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="13" font-weight="bold">O</text>
        <text x="268" y="52" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="13" font-weight="bold">P</text>
        <text x="268" y="79" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="13" font-weight="bold">Q</text>
        <text x="130" y="114" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">CAMAROTE D</text>
      </g>

      <!-- CAMAROTE E (Inferior Central Azul 0 deg) -->
      <g transform="translate(545, 758)">
        <rect x="0" y="0" width="270" height="82" fill="#1D4ED8" stroke="#1E40AF" stroke-width="1.5"/>
        <text x="-16" y="22" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="14" font-weight="bold">O</text>
        <text x="-16" y="48" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="14" font-weight="bold">P</text>
        <text x="-16" y="74" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Q</text>
        <text x="280" y="22" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="14" font-weight="bold">O</text>
        <text x="280" y="48" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="14" font-weight="bold">P</text>
        <text x="280" y="74" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Q</text>
        <text x="135" y="99" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">CAMAROTE E</text>
      </g>

      <!-- CAMAROTE F (Inferior Direito Azul -41 deg) -->
      <g transform="translate(982, 690) rotate(-41)">
        <rect x="0" y="0" width="115" height="90" fill="#1D4ED8" stroke="#1E40AF" stroke-width="1.5"/>
        <rect x="125" y="0" width="135" height="90" fill="#1D4ED8" stroke="#1E40AF" stroke-width="1.5"/>
        <text x="-16" y="25" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="13" font-weight="bold">O</text>
        <text x="-16" y="52" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="13" font-weight="bold">P</text>
        <text x="-16" y="79" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="13" font-weight="bold">Q</text>
        <text x="268" y="25" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="13" font-weight="bold">O</text>
        <text x="268" y="52" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="13" font-weight="bold">P</text>
        <text x="268" y="79" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="13" font-weight="bold">Q</text>
        <text x="130" y="114" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle">CAMAROTE F</text>
      </g>
    </svg>`
    return {
      dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      name: '00 Marista Maringá - 00 ok 2026 (96 DPI)',
      width: 1360,
      height: 860
    }
  }

  if (preset === 'teatro') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
      <rect width="960" height="600" fill="#0B1220"/>
      <path d="M 180 30 L 780 30 L 730 95 L 230 95 Z" fill="#1E1B4B" stroke="#6366F1" stroke-width="2" stroke-dasharray="6,4"/>
      <text x="480" y="68" fill="#A5B4FC" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">PLANTA 96 DPI — PALCO / FOSSO DE ORQUESTRA</text>
      <rect x="90" y="125" width="780" height="260" rx="18" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="8,5"/>
      <rect x="110" y="405" width="740" height="155" rx="18" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="8,5"/>
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
    <rect x="60" y="120" width="130" height="420" rx="14" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-dasharray="6,4"/>
    <rect x="770" y="120" width="130" height="420" rx="14" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-dasharray="6,4"/>
  </svg>`
  return {
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    name: 'planta-arena-multiuso-96dpi.svg',
    width: 960,
    height: 600
  }
}

// Auxiliar para rotacionar coordenadas (x, y) em torno de uma origem
function rotatePoint(originX: number, originY: number, dx: number, dy: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  const rx = originX + dx * Math.cos(rad) - dy * Math.sin(rad)
  const ry = originY + dx * Math.sin(rad) + dy * Math.cos(rad)
  return { x: Number(rx.toFixed(2)), y: Number(ry.toFixed(2)) }
}

// Gera todas as poltronas do Teatro Marista Maringá exatamente como na estrutura do vídeo
function buildMaristaCanvasSeats(shape: SeatShapeType = 'armchair'): SeatmapSeatPoint[] {
  const pts: SeatmapSeatPoint[] = []

  // 1. CAMAROTE D (Filas O, P, Q • Polt. 01 a Polt. 14 • Rotação +39°)
  ;['O', 'P', 'Q'].forEach((rLetter, rIdx) => {
    for (let s = 1; s <= 12; s++) {
      const gap = s > 6 ? 14 : 0
      const pos = rotatePoint(190, 535, (s - 1) * 20 + gap, rIdx * 26, 39)
      const numStr = String(s).padStart(2, '0')
      let status: SeatStatusType = 'sold'
      if (rLetter === 'O' && s === 1) status = 'sold' // Polt. 01 selecionada no vídeo aos 00:12
      else if (rLetter === 'O' && s === 3) status = 'free' // Polt. 03 testada no vídeo aos 00:55
      else if (rLetter === 'Q' && s >= 4) status = 'free'
      else if (rLetter === 'P' && (s === 1 || s === 2 || s === 7 || s === 8)) status = 'blocked'

      pts.push({
        id: `CAMAROTE D:FILA ${rLetter}:Polt. ${numStr}`,
        label: `Polt. ${numStr}`,
        rowLabel: `FILA ${rLetter}`,
        seatNumber: s,
        sectorId: 'CAMAROTE D',
        sectorName: 'CAMAROTE D',
        x: s === 1 && rLetter === 'O' ? 112.29 : pos.x,
        y: s === 1 && rLetter === 'O' ? 497.48 : pos.y,
        width: 20,
        height: 27,
        rotation: 39,
        nominal: false,
        colorHex: '#FFFFFF',
        shape,
        status
      })
    }
  })

  // 2. CAMAROTE E (Filas O, P, Q • Polt. 15 a Polt. 26 • Rotação 0°)
  ;['O', 'P', 'Q'].forEach((rLetter, rIdx) => {
    for (let s = 1; s <= 12; s++) {
      const seatNum = 14 + s
      const numStr = String(seatNum).padStart(2, '0')
      let status: SeatStatusType = 'sold'
      if (rLetter === 'Q' && (s <= 4 || s >= 9)) status = 'free'
      pts.push({
        id: `CAMAROTE E:FILA ${rLetter}:Polt. ${numStr}`,
        label: `Polt. ${numStr}`,
        rowLabel: `FILA ${rLetter}`,
        seatNumber: seatNum,
        sectorId: 'CAMAROTE E',
        sectorName: 'CAMAROTE E',
        x: 562 + (s - 1) * 21,
        y: 772 + rIdx * 26,
        width: 20,
        height: 27,
        rotation: 0,
        nominal: false,
        colorHex: '#FFFFFF',
        shape,
        status
      })
    }
  })

  // 3. CAMAROTE F (Filas O, P, Q • Polt. 29 a Polt. 40 • Rotação -42°)
  ;['O', 'P', 'Q'].forEach((rLetter, rIdx) => {
    for (let s = 1; s <= 12; s++) {
      const seatNum = 28 + s
      const numStr = String(seatNum).padStart(2, '0')
      const gap = s > 6 ? 14 : 0
      const pos = rotatePoint(995, 682, (s - 1) * 20 + gap, rIdx * 26, -41)
      let status: SeatStatusType = 'sold'
      if (rLetter === 'O' && s >= 7) status = 'free'
      if (rLetter === 'P' && (s === 5 || s === 10)) status = 'free'
      if (rLetter === 'Q' && s >= 6) status = 'free'

      pts.push({
        id: `CAMAROTE F:FILA ${rLetter}:Polt. ${numStr}`,
        label: `Polt. ${numStr}`,
        rowLabel: `FILA ${rLetter}`,
        seatNumber: seatNum,
        sectorId: 'CAMAROTE F',
        sectorName: 'CAMAROTE F',
        x: pos.x,
        y: pos.y,
        width: 20,
        height: 27,
        rotation: -42,
        nominal: false,
        colorHex: '#FFFFFF',
        shape,
        status
      })
    }
  })

  // 4. PLATEIA A - Lateral Esquerda (Filas A a N • Rotação +39°)
  const rowsAtoN = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']
  rowsAtoN.forEach((rLetter, rIdx) => {
    const seatsCount = rIdx < 3 ? 9 : rIdx < 10 ? 11 : 9
    for (let s = 1; s <= seatsCount; s++) {
      const pos = rotatePoint(398 - rIdx * 18, 175 + rIdx * 21, (s - 1) * 19, 0, 39)
      const numStr = String(s).padStart(2, '0')
      let status: SeatStatusType = 'sold'
      if (rIdx >= 8 && s <= 6) status = 'free'
      else if (rIdx >= 6 && s === seatsCount) status = 'blocked'
      else if (rIdx === 4 && s === 3) status = 'free'

      pts.push({
        id: `PLATEIA A - Lateral Esquerda:FILA ${rLetter}:Polt. ${numStr}`,
        label: `Polt. ${numStr}`,
        rowLabel: `FILA ${rLetter}`,
        seatNumber: s,
        sectorId: 'PLATEIA A - Lateral Esquerda',
        sectorName: 'PLATEIA A - Lateral Esquerda',
        x: pos.x,
        y: pos.y,
        width: 20,
        height: 27,
        rotation: 39,
        nominal: false,
        colorHex: '#FFFFFF',
        shape,
        status
      })
    }
  })

  // 5. PLATEIA B - Premium (Filas A a G • Verde • Rotação 0°)
  ;['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((rLetter, rIdx) => {
    const count = 11 + Math.floor(rIdx / 2)
    const startX = 680 - ((count - 1) * 21) / 2
    for (let s = 1; s <= count; s++) {
      const seatNum = 15 + s
      const numStr = String(seatNum).padStart(2, '0')
      pts.push({
        id: `PLATEIA B - Premium:FILA ${rLetter}:Polt. ${numStr}`,
        label: `Polt. ${numStr}`,
        rowLabel: `FILA ${rLetter}`,
        seatNumber: seatNum,
        sectorId: 'PLATEIA B - Premium',
        sectorName: 'PLATEIA B - Premium',
        x: Math.round(startX + (s - 1) * 21),
        y: 252 + rIdx * 34,
        width: 20,
        height: 27,
        rotation: 0,
        nominal: false,
        colorHex: '#FFFFFF',
        shape,
        status: 'sold'
      })
    }
  })

  // 6. PLATEIA B - Central (Filas H a N • Laranja • Rotação 0°)
  ;['H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach((rLetter, rIdx) => {
    const count = 15 + Math.floor(rIdx / 2)
    const startX = 680 - ((count - 1) * 21) / 2
    for (let s = 1; s <= count; s++) {
      const seatNum = 15 + s
      const numStr = String(seatNum).padStart(2, '0')
      let status: SeatStatusType = 'sold'
      if (rLetter === 'H' && s === 5) status = 'free'
      else if (rLetter === 'I' && s === 11) status = 'free'
      else if (rLetter === 'J' && (s === 9 || s === 11 || s === 14)) status = 'free'
      else if (rLetter === 'K' && (s === 6 || s === 10 || s === 12)) status = 'free'
      else if (rLetter === 'L' && (s === 5 || s === 7 || s === 8 || s === 12 || s === 13)) status = 'free'
      else if (rLetter === 'M' && s >= 4 && s <= 15 && s % 2 === 0) status = 'free'
      else if (rLetter === 'N' && s >= 4 && s <= 16 && s !== 9 && s !== 10) status = 'free'

      pts.push({
        id: `PLATEIA B - Central:FILA ${rLetter}:Polt. ${numStr}`,
        label: `Polt. ${numStr}`,
        rowLabel: `FILA ${rLetter}`,
        seatNumber: seatNum,
        sectorId: 'PLATEIA B - Central',
        sectorName: 'PLATEIA B - Central',
        x: Math.round(startX + (s - 1) * 21),
        y: 500 + rIdx * 35,
        width: 20,
        height: 27,
        rotation: 0,
        nominal: false,
        colorHex: '#FFFFFF',
        shape,
        status
      })
    }
  })

  // 7. PLATEIA C - Lateral Direita (Filas A a N • Rotação -42° • Inclui Polt. 50 a Polt. 56 na FILA N!)
  rowsAtoN.forEach((rLetter, rIdx) => {
    const seatsCount = rIdx < 3 ? 9 : rIdx < 10 ? 11 : 7
    for (let s = 1; s <= seatsCount; s++) {
      const seatNum = rLetter === 'N' ? 49 + s : 45 + s // Polt. 50..56 na Fila N como no vídeo aos 01:19!
      const numStr = String(seatNum).padStart(2, '0')
      const pos = rotatePoint(858 + rIdx * 18, 285 + rIdx * 21, (s - 1) * 19, 0, -41)
      let status: SeatStatusType = 'sold'
      if (rIdx >= 7 && s >= 4) status = 'free'
      else if (rIdx >= 2 && rIdx <= 6 && s === 1) status = 'blocked'
      else if (rLetter === 'N' && seatNum === 51) status = 'free' // Polt. 51 selecionada no vídeo!

      pts.push({
        id: `PLATEIA C - Lateral Direita:FILA ${rLetter}:Polt. ${numStr}`,
        label: `Polt. ${numStr}`,
        rowLabel: `FILA ${rLetter}`,
        seatNumber: seatNum,
        sectorId: 'PLATEIA C - Lateral Direita',
        sectorName: 'PLATEIA C - Lateral Direita',
        x: rLetter === 'N' && seatNum === 51 ? 1218.88 : pos.x,
        y: rLetter === 'N' && seatNum === 51 ? 701.1 : pos.y,
        width: 20,
        height: 27,
        rotation: -42,
        nominal: false,
        colorHex: '#FFFFFF',
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
  basePriceBRL = 140,
  eventCode = '4088',
  eventTitle = 'Whindersson Nunes - Isso Definitivamente Não é um Culto - SESSÃO EXTRA 19H',
  eventVenue = 'Teatro Marista Maringá',
  onUpdateEventMeta
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const seatSpriteInputRef = useRef<HTMLInputElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const initialPreset = useMemo(() => createPresetBlueprintDataUrl('marista'), [])

  const seatShape: SeatShapeType = seatingMap.seatShape || 'armchair'
  const seatSizePx = seatingMap.seatSizePx || 20
  const bgDataUrl = seatingMap.backgroundImageDataUrl || initialPreset.dataUrl
  const bgFileName = seatingMap.backgroundFileName || initialPreset.name
  const bgDpi = seatingMap.backgroundDpi || 96
  const bgWidthPx = seatingMap.backgroundWidthPx || initialPreset.width
  const bgHeightPx = seatingMap.backgroundHeightPx || initialPreset.height
  const bgOpacity = seatingMap.backgroundOpacity ?? 100

  const seats: SeatmapSeatPoint[] = useMemo(
    () =>
      seatingMap.canvasSeats && seatingMap.canvasSeats.length > 0
        ? seatingMap.canvasSeats
        : buildMaristaCanvasSeats(seatShape),
    [seatingMap.canvasSeats, seatShape]
  )

  const zones: SeatmapZoneElement[] = useMemo(
    () => seatingMap.canvasZones || [],
    [seatingMap.canvasZones]
  )

  // Aba superior da janela "Evento" (Estrutura Visual ativa por padrão como no vídeo)
  const [activeEventTab, setActiveEventTab] = useState<string>('Estrutura Visual')
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('marista-00')
  const [paletteMode, setPaletteMode] = useState<ColorPaletteMode>('video_classic')

  // Painéis colapsáveis ("Esconder" Esquerda = Estrutura / Direita = Informações)
  const [leftTreeOpen, setLeftTreeOpen] = useState<boolean>(true)
  const [rightInspectorOpen, setRightInspectorOpen] = useState<boolean>(true)

  // Estado da Árvore Hierárquica "Estrutura" (Setor M -> Fila M -> Poltrona L)
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({
    'CAMAROTE D': true,
    'PLATEIA C - Lateral Direita': false
  })
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({
    'CAMAROTE D::FILA O': true,
    'PLATEIA C - Lateral Direita::FILA N': false
  })
  const [selectedNodeType, setSelectedNodeType] = useState<'seat' | 'sector' | 'row'>('seat')
  const [selectedSectorId, setSelectedSectorId] = useState<string>('CAMAROTE D')
  const [selectedRowKey, setSelectedRowKey] = useState<string>('CAMAROTE D::FILA O')
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(
    'CAMAROTE D:FILA O:Polt. 01'
  )

  // Ferramentas da Barra Superior do Canvas (Pan, F6 Mover, F7 Redimensionar, F8 Rotacionar)
  const [activeTool, setActiveTool] = useState<StudioTool>('pan')
  const [activeStatusBrush, setActiveStatusBrush] = useState<SeatStatusType>('free')
  const [zoom, setZoom] = useState<number>(60)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState<boolean>(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [draggingSeatId, setDraggingSeatId] = useState<string | null>(null)
  const [uploadAlert, setUploadAlert] = useState<string | null>(null)

  // Property Grid ("Informações")
  const [propSearch, setPropSearch] = useState<string>('')
  const [propSortAlphabetical, setPropSortAlphabetical] = useState<boolean>(false)
  const [focusedPropHelp, setFocusedPropHelp] = useState<{ title: string; desc: string }>({
    title: 'Bloquear',
    desc: 'Bloqueia a área para a venda.'
  })
  const [keepAspectRatio, setKeepAspectRatio] = useState<boolean>(false)

  // Modais do Vídeo:
  // 1. "Procurar Imagem para Área Bloqueada / Livre / Vendida" (Frames 07-08)
  const [imagePickerModalState, setImagePickerModalState] = useState<{
    open: boolean
    targetState: 'blocked' | 'free' | 'sold' | 'reserved'
    title: string
  }>({ open: false, targetState: 'blocked', title: 'Procurar Imagem para Área Bloqueada' })
  const [imagePickerSearch, setImagePickerSearch] = useState<string>('')
  const [customStateSprites, setCustomStateSprites] = useState<
    Partial<Record<SeatStatusType, string>>
  >({})

  // 2. "Pesquisar Imagem" ao clicar em "Alterar Fundo do Layout" (Frame 28)
  const [bgSearchModalOpen, setBgSearchModalOpen] = useState<boolean>(false)
  const [bgModalQuery, setBgModalQuery] = useState<string>('')

  // 3. Modal "Agendar Bloqueio / Desbloqueio" e Modal "Dicas"
  const [scheduleBlockModalOpen, setScheduleBlockModalOpen] = useState<boolean>(false)
  const [scheduleBlockDate, setScheduleBlockDate] = useState<string>('2026-11-20T18:00')
  const [tipsModalOpen, setTipsModalOpen] = useState<boolean>(false)

  // Motor Principal: Seats.io (Padrão Global de Bilheteria Online) vs Estrutura Visual Clássica
  const [studioExperience, setStudioExperience] = useState<'seatsio' | 'classic_estrutura'>('seatsio')
  const [seatsIoMode, setSeatsIoMode] = useState<SeatsIoMode>('designer')

  // Parâmetros rápidos de criação em lote
  const [rowPrefix, setRowPrefix] = useState('A')
  const [rowSeatsCount, setRowSeatsCount] = useState(12)

  // Contadores em Tempo Real por Status
  const stats = useMemo(() => {
    const counts = { free: 0, sold: 0, reserved: 0, blocked: 0, total: seats.length }
    for (const s of seats) {
      counts[s.status] = (counts[s.status] || 0) + 1
    }
    return counts
  }, [seats])

  // Árvore agrupada Setor (M) -> Fila (M) -> Poltronas (L)
  const treeStructure = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string
        name: string
        rows: Map<string, SeatmapSeatPoint[]>
        totalSeats: number
        availableSeats: number
      }
    >()

    for (const sec of MARISTA_MASTER_SECTORS) {
      const rowMap = new Map<string, SeatmapSeatPoint[]>()
      sec.rows.forEach(r => rowMap.set(r, []))
      map.set(sec.id, {
        id: sec.id,
        name: sec.name,
        rows: rowMap,
        totalSeats: 0,
        availableSeats: 0
      })
    }

    for (const seat of seats) {
      const secKey = seat.sectorName || seat.sectorId || 'CAMAROTE D'
      if (!map.has(secKey)) {
        map.set(secKey, {
          id: secKey,
          name: secKey,
          rows: new Map(),
          totalSeats: 0,
          availableSeats: 0
        })
      }
      const secEntry = map.get(secKey)!
      const rKey = seat.rowLabel.startsWith('FILA') ? seat.rowLabel : `FILA ${seat.rowLabel}`
      if (!secEntry.rows.has(rKey)) {
        secEntry.rows.set(rKey, [])
      }
      secEntry.rows.get(rKey)!.push(seat)
      secEntry.totalSeats += 1
      if (seat.status === 'free') secEntry.availableSeats += 1
    }

    return Array.from(map.values())
  }, [seats])

  const commitSeats = (
    nextSeats: SeatmapSeatPoint[],
    extraPatch?: Partial<EventSeatingMapConfig>
  ) => {
    onChange({
      canvasSeats: nextSeats,
      ...(extraPatch || {})
    })
  }

  const selectedSeatObj = useMemo(
    () => seats.find(s => s.id === selectedSeatId) || seats[0] || null,
    [seats, selectedSeatId]
  )

  const selectedMasterSectorMeta = useMemo(
    () =>
      MARISTA_MASTER_SECTORS.find(s => s.id === selectedSectorId) || MARISTA_MASTER_SECTORS[0],
    [selectedSectorId]
  )

  const selectedSectorTreeStats = useMemo(
    () => treeStructure.find(s => s.id === selectedSectorId),
    [treeStructure, selectedSectorId]
  )

  // Selecionar poltrona e expandir automaticamente Setor e Fila na árvore Estrutura
  const selectSeatAndRevealInTree = (seat: SeatmapSeatPoint) => {
    const secKey = seat.sectorName || seat.sectorId
    const rKey = seat.rowLabel.startsWith('FILA') ? seat.rowLabel : `FILA ${seat.rowLabel}`
    setSelectedNodeType('seat')
    setSelectedSeatId(seat.id)
    setSelectedSectorId(secKey)
    setSelectedRowKey(`${secKey}::${rKey}`)
    setExpandedSectors(prev => ({ ...prev, [secKey]: true }))
    setExpandedRows(prev => ({ ...prev, [`${secKey}::${rKey}`]: true }))
  }

  // Alternar Bloqueio ("Bloquear" checkbox no painel Informações, igual aos 00:55 e 01:21 do vídeo)
  const handleToggleBlockCheckbox = (checked: boolean) => {
    setFocusedPropHelp({
      title: 'Bloquear',
      desc: 'Bloqueia a área para a venda.'
    })

    if (selectedNodeType === 'seat' && selectedSeatObj) {
      const nextStatus: SeatStatusType = checked ? 'blocked' : 'free'
      commitSeats(
        seats.map(s => (s.id === selectedSeatObj.id ? { ...s, status: nextStatus } : s))
      )
    } else if (selectedNodeType === 'sector') {
      const nextStatus: SeatStatusType = checked ? 'blocked' : 'free'
      commitSeats(
        seats.map(s => (s.sectorName === selectedSectorId ? { ...s, status: nextStatus } : s))
      )
    } else if (selectedNodeType === 'row') {
      const [secId, rLabel] = selectedRowKey.split('::')
      const nextStatus: SeatStatusType = checked ? 'blocked' : 'free'
      commitSeats(
        seats.map(s =>
          s.sectorName === secId && s.rowLabel === rLabel ? { ...s, status: nextStatus } : s
        )
      )
    }
  }

  // Atualizar propriedade individual da Poltrona selecionada no Property Grid
  const updateSelectedSeatProp = (patch: Partial<SeatmapSeatPoint>) => {
    if (!selectedSeatObj) return
    commitSeats(seats.map(s => (s.id === selectedSeatObj.id ? { ...s, ...patch } : s)))
  }

  // Trocar formato das poltronas (Poltrona Teatro / Bolinhas / Quadrados)
  const handleShapeChange = (newShape: SeatShapeType) => {
    const updated = seats.map(s => ({ ...s, shape: newShape }))
    onChange({
      seatShape: newShape,
      canvasSeats: updated
    })
  }

  // Upload de arquivo PNG, SVG, JPG ou JPEG em 96 DPI (Fundo do Layout)
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
        const w = img.naturalWidth || 1360
        const h = img.naturalHeight || 860
        onChange({
          backgroundImageDataUrl: dataUrl,
          backgroundFileName: file.name,
          backgroundMimeType: file.type || 'image/png',
          backgroundDpi: 96,
          backgroundWidthPx: w,
          backgroundHeightPx: h
        })
        setUploadAlert(
          `Fundo do Layout "${file.name}" aplicado em 96 DPI (${w}×${h}px).`
        )
        setBgSearchModalOpen(false)
      }
      img.onerror = () => {
        onChange({
          backgroundImageDataUrl: dataUrl,
          backgroundFileName: file.name,
          backgroundMimeType: file.type || 'image/svg+xml',
          backgroundDpi: 96,
          backgroundWidthPx: 1360,
          backgroundHeightPx: 860
        })
        setUploadAlert(`Planta vetorial "${file.name}" aplicada em 96 DPI.`)
        setBgSearchModalOpen(false)
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processUploadedFile(file)
  }

  // Upload de imagem customizada para Poltrona (Área Bloqueada / Livre / Vendida)
  const handleSeatSpriteUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = String(ev.target?.result || '')
      setCustomStateSprites(prev => ({
        ...prev,
        [imagePickerModalState.targetState]: dataUrl
      }))
    }
    reader.readAsDataURL(file)
  }

  // Aplicar Layout salvo ao clicar em "Gerar Layout"
  const applyPresetBlueprint = (preset: 'marista' | 'teatro' | 'mesas' | 'arena', customLabel?: string) => {
    const bp = createPresetBlueprintDataUrl(preset)
    if (preset === 'marista') {
      const maristaSeats = buildMaristaCanvasSeats(seatShape)
      onChange({
        backgroundImageDataUrl: bp.dataUrl,
        backgroundFileName: customLabel || bp.name,
        backgroundDpi: 96,
        backgroundWidthPx: bp.width,
        backgroundHeightPx: bp.height,
        canvasSeats: maristaSeats,
        canvasZones: []
      })
      setZoom(60)
      setPanOffset({ x: 0, y: 0 })
    } else if (preset === 'teatro') {
      const pts: SeatmapSeatPoint[] = []
      ;['A', 'B', 'C', 'D', 'E', 'F'].forEach((r, rIdx) => {
        for (let s = 1; s <= 16; s++) {
          const numStr = String(s).padStart(2, '0')
          pts.push({
            id: `PLATEIA A - Lateral Esquerda:FILA ${r}:Polt. ${numStr}`,
            label: `Polt. ${numStr}`,
            rowLabel: `FILA ${r}`,
            seatNumber: s,
            sectorId: 'PLATEIA B - Premium',
            sectorName: 'PLATEIA B - Premium',
            x: 165 + (s - 1) * 40 + (s > 8 ? 24 : 0),
            y: 170 + rIdx * 38,
            width: 20,
            height: 27,
            rotation: 0,
            shape: seatShape,
            status: r === 'A' && s >= 5 && s <= 12 ? 'sold' : 'free'
          })
        }
      })
      onChange({
        backgroundImageDataUrl: bp.dataUrl,
        backgroundFileName: customLabel || bp.name,
        backgroundDpi: 96,
        backgroundWidthPx: bp.width,
        backgroundHeightPx: bp.height,
        canvasSeats: pts,
        canvasZones: []
      })
      setZoom(85)
    } else if (preset === 'mesas') {
      const tableCenters = [
        { code: 'M1', cx: 240, cy: 210 },
        { code: 'M2', cx: 480, cy: 210 },
        { code: 'M3', cx: 720, cy: 210 },
        { code: 'M4', cx: 240, cy: 370 },
        { code: 'M5', cx: 480, cy: 370 },
        { code: 'M6', cx: 720, cy: 370 }
      ]
      const generatedSeats: SeatmapSeatPoint[] = []
      const generatedZones: SeatmapZoneElement[] = []
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
          const numStr = String(i + 1).padStart(2, '0')
          generatedSeats.push({
            id: `CAMAROTE D:FILA O:Polt. ${t.code}-${numStr}`,
            label: `Polt. ${numStr}`,
            rowLabel: 'FILA O',
            seatNumber: i + 1,
            sectorId: 'CAMAROTE D',
            sectorName: 'CAMAROTE D',
            x: sx,
            y: sy,
            width: 20,
            height: 27,
            rotation: Math.round((angle * 180) / Math.PI + 90),
            shape: seatShape,
            status: tIdx === 0 && i < 4 ? 'sold' : 'free'
          })
        }
      })
      onChange({
        backgroundImageDataUrl: bp.dataUrl,
        backgroundFileName: customLabel || bp.name,
        backgroundDpi: 96,
        backgroundWidthPx: bp.width,
        backgroundHeightPx: bp.height,
        canvasSeats: generatedSeats,
        canvasZones: generatedZones
      })
      setZoom(85)
    } else {
      const arenaSeats: SeatmapSeatPoint[] = []
      ;['A', 'B', 'C', 'D'].forEach((r, rIdx) => {
        for (let s = 1; s <= 14; s++) {
          const numStr = String(s).padStart(2, '0')
          arenaSeats.push({
            id: `PLATEIA B - Central:FILA ${r}:Polt. ${numStr}`,
            label: `Polt. ${numStr}`,
            rowLabel: `FILA ${r}`,
            seatNumber: s,
            sectorId: 'PLATEIA B - Central',
            sectorName: 'PLATEIA B - Central',
            x: 225 + (s - 1) * 38,
            y: 410 + rIdx * 34,
            width: 20,
            height: 27,
            rotation: 0,
            shape: seatShape,
            status: r === 'A' && s <= 6 ? 'sold' : 'free'
          })
        }
      })
      onChange({
        backgroundImageDataUrl: bp.dataUrl,
        backgroundFileName: customLabel || bp.name,
        backgroundDpi: 96,
        backgroundWidthPx: bp.width,
        backgroundHeightPx: bp.height,
        canvasSeats: arenaSeats
      })
      setZoom(85)
    }
    setUploadAlert(`Layout "${customLabel || bp.name}" gerado com sucesso.`)
  }

  // Clique em área vazia do Canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return
    if (draggingSeatId || isPanning) return

    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    const x = Number(((e.clientX - rect.left) / scale).toFixed(2))
    const y = Number(((e.clientY - rect.top) / scale).toFixed(2))

    if (activeTool === 'add_seat') {
      const secName = selectedSectorId || 'CAMAROTE D'
      const rName = selectedRowKey.split('::')[1] || `FILA ${rowPrefix}`
      const sameRow = seats.filter(s => s.sectorName === secName && s.rowLabel === rName)
      const nextNum = sameRow.length + 1
      const numStr = String(nextNum).padStart(2, '0')
      const newSeat: SeatmapSeatPoint = {
        id: `${secName}:${rName}:Polt. ${numStr}-${Date.now()}`,
        label: `Polt. ${numStr}`,
        rowLabel: rName,
        seatNumber: nextNum,
        sectorId: secName,
        sectorName: secName,
        x,
        y,
        width: 20,
        height: 27,
        rotation: selectedSeatObj?.rotation ?? 0,
        shape: seatShape,
        status: activeStatusBrush
      }
      commitSeats([...seats, newSeat])
      selectSeatAndRevealInTree(newSeat)
    } else if (activeTool === 'add_row') {
      const secName = selectedSectorId || 'PLATEIA B - Central'
      const rName = `FILA ${rowPrefix}`
      const created: SeatmapSeatPoint[] = []
      for (let s = 1; s <= rowSeatsCount; s++) {
        const numStr = String(s).padStart(2, '0')
        created.push({
          id: `${secName}:${rName}:Polt. ${numStr}-${Date.now()}-${s}`,
          label: `Polt. ${numStr}`,
          rowLabel: rName,
          seatNumber: s,
          sectorId: secName,
          sectorName: secName,
          x: Number((x + (s - 1) * 22).toFixed(2)),
          y,
          width: 20,
          height: 27,
          rotation: selectedSeatObj?.rotation ?? 0,
          shape: seatShape,
          status: activeStatusBrush
        })
      }
      commitSeats([...seats, ...created])
    }
  }

  // Clique em uma Poltrona no Canvas
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
      selectSeatAndRevealInTree(seat)
      return
    }
    if (activeTool === 'rotate') {
      const nextRot = ((seat.rotation || 0) + 15) % 360
      commitSeats(seats.map(s => (s.id === seat.id ? { ...s, rotation: nextRot } : s)))
      selectSeatAndRevealInTree(seat)
      return
    }
    if (activeTool === 'resize') {
      const nextW = (seat.width || 20) >= 28 ? 20 : (seat.width || 20) + 2
      const nextH = (seat.height || 27) >= 35 ? 27 : (seat.height || 27) + 2
      commitSeats(
        seats.map(s => (s.id === seat.id ? { ...s, width: nextW, height: nextH } : s))
      )
      selectSeatAndRevealInTree(seat)
      return
    }
    selectSeatAndRevealInTree(seat)
  }

  // Arrastar Poltrona (F6) ou Pan do Mapa (Mão)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'pan') {
      setIsPanning(true)
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && activeTool === 'pan') {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
      return
    }
    if (!draggingSeatId || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    const x = Number(((e.clientX - rect.left) / scale).toFixed(2))
    const y = Number(((e.clientY - rect.top) / scale).toFixed(2))
    commitSeats(seats.map(s => (s.id === draggingSeatId ? { ...s, x, y } : s)))
  }

  const stopDragging = () => {
    setIsPanning(false)
    setDraggingSeatId(null)
  }

  // Duplicar Poltrona Selecionada (Botão Duplicar na barra do vídeo)
  const handleDuplicateSelectedSeat = () => {
    if (!selectedSeatObj) return
    const copyNum = selectedSeatObj.seatNumber + 1
    const numStr = String(copyNum).padStart(2, '0')
    const dup: SeatmapSeatPoint = {
      ...selectedSeatObj,
      id: `${selectedSeatObj.sectorName}:${selectedSeatObj.rowLabel}:Polt. ${numStr}-${Date.now()}`,
      label: `Polt. ${numStr}`,
      seatNumber: copyNum,
      x: Number((selectedSeatObj.x + 22).toFixed(2)),
      y: Number(selectedSeatObj.y.toFixed(2))
    }
    commitSeats([...seats, dup])
    selectSeatAndRevealInTree(dup)
  }

  // Excluir Área Selecionada (Botão X vermelho na barra do vídeo)
  const handleDeleteSelected = () => {
    if (!selectedSeatObj) return
    commitSeats(seats.filter(s => s.id !== selectedSeatObj.id))
  }

  // Renderiza o ícone realista de Poltrona de Teatro (20x27px) como no vídeo ou Bolinha/Quadrado
  const renderSeatVisual = (seat: SeatmapSeatPoint, isSelected: boolean) => {
    const meta = SEAT_STATUS_META[seat.status] || SEAT_STATUS_META.free
    const fillHex = paletteMode === 'video_classic' ? meta.classicBgHex : meta.bgHex
    const strokeHex = paletteMode === 'video_classic' ? meta.classicBorderHex : meta.borderHex
    const customSprite = customStateSprites[seat.status]

    if (customSprite) {
      return (
        <img
          src={customSprite}
          alt={seat.label}
          className="w-full h-full object-contain pointer-events-none"
        />
      )
    }

    if (seat.shape === 'armchair') {
      return (
        <svg
          viewBox="0 0 20 27"
          className="w-full h-full overflow-visible pointer-events-none"
        >
          {/* Encosto Superior Arredondado da Poltrona */}
          <rect
            x="2"
            y="1"
            width="16"
            height="7"
            rx="3"
            fill={fillHex}
            stroke={isSelected ? '#F59E0B' : strokeHex}
            strokeWidth={isSelected ? '2.2' : '1.2'}
          />
          {/* Assento Principal com Braços Laterais */}
          <rect
            x="1"
            y="7"
            width="18"
            height="17"
            rx="2.5"
            fill={fillHex}
            stroke={isSelected ? '#F59E0B' : strokeHex}
            strokeWidth={isSelected ? '2.2' : '1.2'}
          />
          {/* Detalhe de Sombra Interna da Almofada (Idêntico ao Sprite 25x32 do Vídeo) */}
          <line
            x1="4"
            y1="21"
            x2="16"
            y2="21"
            stroke={strokeHex}
            strokeWidth="1.2"
            opacity="0.7"
          />
        </svg>
      )
    }

    return null
  }

  // Filtro de busca nas propriedades do painel direito ("Informações")
  const matchesPropSearch = (label: string) => {
    if (!propSearch.trim()) return true
    return label.toLowerCase().includes(propSearch.trim().toLowerCase())
  }

  const isSelectedBlocked =
    selectedNodeType === 'seat'
      ? selectedSeatObj?.status === 'blocked'
      : selectedSectorTreeStats
      ? selectedSectorTreeStats.availableSeats === 0
      : false

  return (
    <div
      className="rounded-xl border border-slate-400 bg-[#F0F4F9] text-slate-900 shadow-2xl overflow-hidden select-none"
      data-testid="seatmap-studio-builder"
    >
      {/* =====================================================================
          0. SELETOR DE MOTOR DE MAPA: SEATS.IO ENGINE (PADRÃO MERCADO) VS ESTRUTURA CLÁSSICA
      ===================================================================== */}
      <div className="bg-[#0F172A] text-white px-3.5 py-2 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400">
            Motor de Mapa de Assentos:
          </span>
          <button
            type="button"
            onClick={() => setStudioExperience('seatsio')}
            data-testid="btn-engine-seatsio"
            className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 border transition cursor-pointer ${
              studioExperience === 'seatsio'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-400 shadow-lg'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <span>⚡ Modelo Referência Seats.io (Designer + Event Manager + Checkout)</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioExperience('classic_estrutura')}
            data-testid="btn-engine-classic"
            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              studioExperience === 'classic_estrutura'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <span>🏛️ Estrutura Visual Clássica (Árvore M/L & Vídeo)</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400">
          Sincronização Bidirecional Ativa • <strong>{stats.total}</strong> lugares mapeados
        </span>
      </div>

      {/* =====================================================================
          1. BARRA DE TOPO DO EVENTO & ABAS CLÁSSICAS (IDÊNTICA AO VÍDEO)
      ===================================================================== */}
      <div className="bg-gradient-to-b from-[#D8E6F7] to-[#C2D5EE] border-b border-slate-400 px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">Evento</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-700 text-white font-bold">
            Editor React • Estrutura Visual 96 DPI
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
          <span>Livre: <strong className="text-blue-700">{stats.free}</strong></span>
          <span>•</span>
          <span>Vendidas: <strong className="text-red-700">{stats.sold}</strong></span>
          <span>•</span>
          <span>Reservadas: <strong className="text-amber-700">{stats.reserved}</strong></span>
          <span>•</span>
          <span>Bloqueadas: <strong className="text-slate-900">{stats.blocked}</strong></span>
        </div>
      </div>

      {/* Campos Código, Nome e Local (Topo do Vídeo) */}
      <div className="bg-[#F8FAFC] px-3 py-2 border-b border-slate-300 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <label className="text-slate-600 font-semibold">Código:</label>
          <input
            type="text"
            value={eventCode}
            onChange={e => onUpdateEventMeta?.({ code: e.target.value })}
            className="w-20 px-2 py-1 rounded border border-slate-300 bg-slate-100 text-slate-700 font-mono text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-[260px]">
          <label className="text-slate-600 font-semibold">Nome:</label>
          <input
            type="text"
            value={eventTitle}
            onChange={e => onUpdateEventMeta?.({ title: e.target.value })}
            className="w-full px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-900 font-semibold text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 min-w-[240px]">
          <label className="text-slate-600 font-semibold">Local:</label>
          <select
            value={eventVenue}
            onChange={e => onUpdateEventMeta?.({ venue: e.target.value })}
            className="flex-1 px-2 py-1 rounded border border-slate-300 bg-white text-slate-900 font-semibold text-xs"
          >
            <option value="Teatro Marista Maringá">Teatro Marista Maringá</option>
            <option value="Teatro Positivo (Grande Auditório)">Teatro Positivo (Grande Auditório)</option>
            <option value="Guairão (Teatro Guaíra)">Guairão (Teatro Guaíra)</option>
            <option value="Ópera de Arame">Ópera de Arame</option>
            <option value="Teatro Regina Vogue">Teatro Regina Vogue</option>
          </select>
        </div>
      </div>

      {/* Abas Clássicas do Evento + Botões Configurar Bordero / Bordero / Despesas */}
      <div className="bg-[#EEF2F7] px-3 pt-1.5 border-b border-slate-300 flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-0.5">
          {[
            'Cadastro',
            'Imagens',
            'Informações',
            'Site',
            'Classificação',
            'Produtores',
            'Documentação',
            'Log Produtores',
            'Estrutura Visual',
            'Gerenciamento',
            'Agendamentos',
            'Log'
          ].map(tab => {
            const isVisual = tab === activeEventTab
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveEventTab(tab)}
                className={`px-2.5 py-1 text-[11px] rounded-t border-t border-x transition cursor-pointer ${
                  isVisual
                    ? 'bg-white border-slate-400 text-[#D97706] font-bold -mb-[1px] pb-1.5 shadow-2xs'
                    : 'bg-[#F8FAFC] border-slate-300 text-slate-700 hover:bg-white'
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1.5 pb-1">
          <button
            type="button"
            onClick={() => setUploadAlert('Módulo Configurar Borderô sincronizado com o Fechamento Financeiro do Evento.')}
            className="px-2.5 py-1 rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 text-[11px] font-semibold text-slate-800 cursor-pointer"
          >
            Configurar Bordero
          </button>
          <button
            type="button"
            onClick={() => setUploadAlert('Borderô oficial do evento pronto para visualização e exportação.')}
            className="px-2.5 py-1 rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 text-[11px] font-semibold text-slate-800 cursor-pointer"
          >
            Bordero
          </button>
          <button
            type="button"
            onClick={() => setUploadAlert('Lançamento de Despesas do Borderô vinculado ao evento.')}
            className="px-2.5 py-1 rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 text-[11px] font-semibold text-slate-800 cursor-pointer"
          >
            Despesas
          </button>
        </div>
      </div>

      {/* =====================================================================
          2. BARRA DE LAYOUT ("Layout:", "Gerar Layout", "Dicas", "Alterar Fundo do Layout")
      ===================================================================== */}
      <div className="bg-white px-3 py-2 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-slate-700 font-semibold">Layout:</label>
          <select
            value={selectedLayoutId}
            onChange={e => {
              const id = e.target.value
              setSelectedLayoutId(id)
              const found = SAVED_LAYOUT_PRESETS.find(item => item.id === id)
              if (found) applyPresetBlueprint(found.preset, found.name)
            }}
            data-testid="select-saved-layout"
            className="w-72 px-2 py-1 rounded border border-slate-400 bg-white text-slate-900 text-xs font-medium"
          >
            {SAVED_LAYOUT_PRESETS.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              const found = SAVED_LAYOUT_PRESETS.find(item => item.id === selectedLayoutId)
              applyPresetBlueprint(found?.preset || 'marista', found?.name)
            }}
            data-testid="btn-generate-layout"
            className="px-3 py-1 rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 text-slate-800 font-semibold cursor-pointer"
          >
            Gerar Layout
          </button>

          {/* Seletor Rápido do Formato da Poltrona e Esquema de Cores */}
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-300">
            <span className="text-[11px] text-slate-500 font-semibold">Formato:</span>
            <button
              type="button"
              onClick={() => handleShapeChange('armchair')}
              data-testid="btn-seat-shape-armchair"
              className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                seatShape === 'armchair'
                  ? 'bg-amber-500 text-slate-950 border-amber-600'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              Poltrona (Vídeo)
            </button>
            <button
              type="button"
              onClick={() => handleShapeChange('circle')}
              data-testid="btn-seat-shape-circle"
              className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                seatShape === 'circle'
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              Bolinhas
            </button>
            <button
              type="button"
              onClick={() => handleShapeChange('square')}
              data-testid="btn-seat-shape-square"
              className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                seatShape === 'square'
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              Quadrados
            </button>
          </div>

          <div className="flex items-center gap-1 pl-2 border-l border-slate-300">
            <span className="text-[11px] text-slate-500 font-semibold">Cores:</span>
            <button
              type="button"
              onClick={() => setPaletteMode('video_classic')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                paletteMode === 'video_classic'
                  ? 'bg-red-600 text-white border-red-700'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              Clássico Vídeo (Prata/Vermelho/Preto)
            </button>
            <button
              type="button"
              onClick={() => setPaletteMode('status_4colors')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                paletteMode === 'status_4colors'
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              4 Cores (Azul/Verde/Vermelho/Preto)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTipsModalOpen(true)}
            className="px-4 py-1 rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 text-slate-800 font-semibold cursor-pointer"
          >
            Dicas
          </button>

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
            onClick={() => setBgSearchModalOpen(true)}
            data-testid="btn-upload-map-background"
            className="px-3 py-1 rounded border border-slate-500 bg-gradient-to-b from-white to-slate-100 hover:from-amber-50 text-slate-900 font-semibold cursor-pointer shadow-2xs"
          >
            Alterar Fundo do Layout
          </button>
        </div>
      </div>

      {uploadAlert && (
        <div className="bg-amber-50 border-b border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900 flex items-center justify-between">
          <span>{uploadAlert}</span>
          <button
            type="button"
            onClick={() => setUploadAlert(null)}
            className="text-amber-700 hover:text-amber-950 font-bold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* =====================================================================
          2.9 MOTOR SEATS.IO (PADRÃO REFERÊNCIA DE MERCADO PARA VENDA DE INGRESSOS ONLINE)
      ===================================================================== */}
      {studioExperience === 'seatsio' && (
        <div className="p-2.5 bg-[#0B0F19] border-b border-slate-700">
          <SeatsIoChartEngine
            mode={seatsIoMode}
            onModeChange={setSeatsIoMode}
            seats={seats}
            zones={zones}
            onCommitSeats={commitSeats}
            onCommitZones={nextZones => onChange({ canvasZones: nextZones })}
            bgDataUrl={bgDataUrl}
            bgWidthPx={bgWidthPx}
            bgHeightPx={bgHeightPx}
            bgOpacity={bgOpacity}
            seatShape={seatShape}
            onShapeChange={handleShapeChange}
            basePriceBRL={basePriceBRL}
            eventCode={eventCode}
            eventTitle={eventTitle}
            onOpenBgModal={() => setBgSearchModalOpen(true)}
            onSwitchToClassicMode={() => setStudioExperience('classic_estrutura')}
          />
        </div>
      )}

      {/* =====================================================================
          3. ÁREA DE TRABALHO EM 3 COLUNAS (ESTRUTURA | MAPA REACT | INFORMAÇÕES)
      ===================================================================== */}
      <div className={studioExperience === 'seatsio' ? 'hidden' : 'flex items-stretch h-[700px] bg-[#E2E8F0] relative'}>
        {/* -----------------------------------------------------------------
            COLUNA 1 (ESQUERDA): ÁRVORE "ESTRUTURA" (M = Master / L = Lugar)
        ----------------------------------------------------------------- */}
        {leftTreeOpen && (
          <div className="w-60 bg-white border-r border-slate-400 flex flex-col shrink-0">
            <div className="bg-gradient-to-b from-[#DCEAFB] to-[#C6DDF7] px-2.5 py-1.5 border-b border-slate-400 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setActiveTool('add_seat')
                  setUploadAlert('Clique em qualquer posição do mapa para adicionar uma nova Poltrona (Área Lugar).')
                }}
                title="Adicionar nova área na Estrutura"
                className="p-0.5 rounded hover:bg-white/60 text-slate-700 cursor-pointer"
              >
                <FolderPlus size={14} />
              </button>
              <span className="text-xs font-bold text-slate-800">Estrutura</span>
              <span className="w-4" />
            </div>

            {/* Tree View com Setores (M), Filas (M) e Poltronas (L) */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-xs font-sans">
              {treeStructure.map(sec => {
                const isSecOpen = !!expandedSectors[sec.id]
                const isSecSelected =
                  selectedNodeType === 'sector' && selectedSectorId === sec.id
                return (
                  <div key={sec.id}>
                    <div
                      onClick={() => {
                        setSelectedNodeType('sector')
                        setSelectedSectorId(sec.id)
                        setExpandedSectors(prev => ({ ...prev, [sec.id]: !prev[sec.id] }))
                      }}
                      className={`flex items-center gap-1 px-1 py-1 rounded cursor-pointer ${
                        isSecSelected
                          ? 'bg-[#0078D7] text-white font-bold'
                          : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <span className="text-[10px] w-3 text-slate-500">
                        {isSecOpen ? '◢' : '▷'}
                      </span>
                      <span className="w-4 h-4 rounded-full bg-[#EA580C] text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-2xs">
                        M
                      </span>
                      <span className="truncate text-[11px]">{sec.name}</span>
                    </div>

                    {/* Nível 2: Filas dentro do Setor */}
                    {isSecOpen && (
                      <div className="pl-4 space-y-0.5 mt-0.5">
                        {Array.from(sec.rows.entries()).map(([rowName, rowSeats]) => {
                          const compositeRowKey = `${sec.id}::${rowName}`
                          const isRowOpen = !!expandedRows[compositeRowKey]
                          const isRowSelected =
                            selectedNodeType === 'row' && selectedRowKey === compositeRowKey
                          return (
                            <div key={compositeRowKey}>
                              <div
                                onClick={() => {
                                  setSelectedNodeType('row')
                                  setSelectedSectorId(sec.id)
                                  setSelectedRowKey(compositeRowKey)
                                  setExpandedRows(prev => ({
                                    ...prev,
                                    [compositeRowKey]: !prev[compositeRowKey]
                                  }))
                                }}
                                className={`flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer ${
                                  isRowSelected
                                    ? 'bg-[#0078D7] text-white font-bold'
                                    : 'hover:bg-slate-100 text-slate-800'
                                }`}
                              >
                                <span className="text-[10px] w-3 text-slate-500">
                                  {isRowOpen ? '◢' : '▷'}
                                </span>
                                <span className="w-4 h-4 rounded-full bg-[#EA580C] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                  M
                                </span>
                                <span className="truncate text-[11px]">{rowName}</span>
                              </div>

                              {/* Nível 3: Poltronas (L) dentro da Fila */}
                              {isRowOpen && (
                                <div className="pl-5 space-y-0.5 mt-0.5">
                                  {rowSeats.map(seat => {
                                    const isSeatSel = selectedSeatId === seat.id
                                    return (
                                      <div
                                        key={seat.id}
                                        onClick={() => selectSeatAndRevealInTree(seat)}
                                        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded cursor-pointer ${
                                          isSeatSel
                                            ? 'bg-[#0078D7] text-white font-bold'
                                            : 'hover:bg-amber-50 text-slate-700'
                                        }`}
                                      >
                                        <span className="w-4 h-4 rounded-full bg-[#3B82F6] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                          L
                                        </span>
                                        <span
                                          className={`truncate text-[11px] ${
                                            seat.status === 'blocked' && !isSeatSel
                                              ? 'line-through text-slate-400'
                                              : ''
                                          }`}
                                        >
                                          {seat.label}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Aba Vertical "Esconder" da Coluna Esquerda */}
        <div className="flex items-center bg-[#E2E8F0] z-20">
          <button
            type="button"
            onClick={() => setLeftTreeOpen(prev => !prev)}
            title={leftTreeOpen ? 'Esconder Estrutura' : 'Mostrar Estrutura'}
            className="h-24 w-5 rounded-r border-y border-r border-slate-400 bg-gradient-to-r from-white to-slate-200 hover:from-amber-50 flex items-center justify-center cursor-pointer shadow-xs"
          >
            <span className="text-[10px] font-semibold text-slate-700 [writing-mode:vertical-rl] rotate-180">
              {leftTreeOpen ? 'Esconder' : 'Estrutura'}
            </span>
          </button>
        </div>

        {/* -----------------------------------------------------------------
            COLUNA 2 (CENTRO): CANVAS INTERATIVO REACT (MAPA + TOOLBAR FLUTUANTE)
        ----------------------------------------------------------------- */}
        <div className="flex-1 bg-white border-x border-emerald-700 relative overflow-hidden flex flex-col">
          {/* Barra de Ferramentas Superior Flutuante (Idêntica ao Vídeo) */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur border border-slate-300 rounded shadow-md px-2.5 py-1 flex flex-wrap items-center gap-2 text-xs">
            {/* Zoom % + Slider */}
            <span className="font-mono text-[11px] font-semibold text-slate-800 w-14 text-right">
              {zoom.toFixed(2).replace('.', ',')}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(30, z - 10))}
              className="w-5 h-5 rounded border border-slate-400 bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold cursor-pointer"
              title="Diminuir Zoom"
            >
              -
            </button>
            <input
              type="range"
              min={30}
              max={150}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="w-24 accent-emerald-600 cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(150, z + 10))}
              className="w-5 h-5 rounded border border-slate-400 bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold cursor-pointer"
              title="Aumentar Zoom"
            >
              +
            </button>

            <button
              type="button"
              onClick={() => {
                setZoom(60)
                setPanOffset({ x: 0, y: 0 })
              }}
              className="px-2 py-0.5 rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 text-[11px] font-semibold text-slate-800 cursor-pointer"
            >
              Preencher
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="px-2 py-0.5 rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 hover:from-slate-50 text-[11px] font-semibold text-slate-800 cursor-pointer"
            >
              100%
            </button>

            <div className="h-5 w-[1px] bg-slate-300 mx-0.5" />

            {/* 4 Ferramentas de Manipulação do Vídeo: Mão (Pan), F6 (Mover), F7 (Redimensionar), F8 (Rotacionar) */}
            <button
              type="button"
              onClick={() => setActiveTool('pan')}
              data-testid="studio-tool-pan"
              title="Arrastar / Mover visualização do mapa"
              className={`w-7 h-7 rounded border flex items-center justify-center cursor-pointer ${
                activeTool === 'pan'
                  ? 'bg-[#F59E0B] border-[#B45309] text-slate-950 shadow-inner'
                  : 'bg-slate-50 border-slate-400 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Hand size={15} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('select')}
              data-testid="studio-tool-select"
              title="Selecionar ou mover uma área (F6)"
              className={`w-7 h-7 rounded border flex items-center justify-center cursor-pointer ${
                activeTool === 'select'
                  ? 'bg-[#F59E0B] border-[#B45309] text-slate-950 shadow-inner'
                  : 'bg-slate-50 border-slate-400 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Move size={15} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('resize')}
              data-testid="studio-tool-resize"
              title="Utilizado para redimensionar uma área (F7)"
              className={`w-7 h-7 rounded border flex items-center justify-center cursor-pointer ${
                activeTool === 'resize'
                  ? 'bg-[#F59E0B] border-[#B45309] text-slate-950 shadow-inner'
                  : 'bg-slate-50 border-slate-400 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Maximize2 size={15} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('rotate')}
              data-testid="studio-tool-rotate"
              title="Rotaciona uma área selecionada (F8)"
              className={`w-7 h-7 rounded border flex items-center justify-center cursor-pointer ${
                activeTool === 'rotate'
                  ? 'bg-[#F59E0B] border-[#B45309] text-slate-950 shadow-inner'
                  : 'bg-slate-50 border-slate-400 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <RotateCw size={15} />
            </button>

            <div className="h-5 w-[1px] bg-slate-300 mx-0.5" />

            {/* 4 Botões de Ação de Área do Vídeo: Nova Área, Duplicar, R*, X */}
            <button
              type="button"
              onClick={() => setActiveTool('add_seat')}
              data-testid="studio-tool-add_seat"
              title="Inserir nova Poltrona / Área Lugar no clique"
              className={`w-7 h-7 rounded border flex items-center justify-center cursor-pointer ${
                activeTool === 'add_seat'
                  ? 'bg-[#F59E0B] border-[#B45309] text-slate-950'
                  : 'bg-slate-50 border-slate-400 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Plus size={15} />
            </button>

            <button
              type="button"
              onClick={handleDuplicateSelectedSeat}
              title="Duplicar Poltrona / Área Selecionada"
              className="w-7 h-7 rounded border border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer"
            >
              <Copy size={14} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('paint_status')}
              data-testid="studio-tool-paint_status"
              title="Pintar Status / Renomear Área (R*)"
              className={`w-7 h-7 rounded border flex items-center justify-center font-serif font-black text-xs cursor-pointer ${
                activeTool === 'paint_status'
                  ? 'bg-[#F59E0B] border-[#B45309] text-slate-950'
                  : 'bg-slate-50 border-slate-400 text-slate-800 hover:bg-slate-100'
              }`}
            >
              R*
            </button>

            <button
              type="button"
              onClick={handleDeleteSelected}
              data-testid="studio-tool-erase"
              title="Excluir Área Selecionada"
              className="w-7 h-7 rounded border border-slate-400 bg-slate-50 hover:bg-rose-50 text-rose-600 flex items-center justify-center cursor-pointer"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Bússola Direcional 4 Setas no Canto Superior Esquerdo do Canvas (Idêntica ao Vídeo) */}
          <div className="absolute top-3 left-3 z-30 w-16 h-16 pointer-events-none">
            <button
              type="button"
              onClick={() => setPanOffset(p => ({ ...p, y: p.y + 45 }))}
              title="Mover Mapa para Cima"
              className="pointer-events-auto absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white/90 border border-slate-400 shadow flex items-center justify-center hover:bg-slate-100 cursor-pointer"
            >
              <ArrowUp size={12} className="text-slate-700" />
            </button>
            <button
              type="button"
              onClick={() => setPanOffset(p => ({ ...p, y: p.y - 45 }))}
              title="Mover Mapa para Baixo"
              className="pointer-events-auto absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white/90 border border-slate-400 shadow flex items-center justify-center hover:bg-slate-100 cursor-pointer"
            >
              <ArrowDown size={12} className="text-slate-700" />
            </button>
            <button
              type="button"
              onClick={() => setPanOffset(p => ({ ...p, x: p.x + 45 }))}
              title="Mover Mapa para a Esquerda"
              className="pointer-events-auto absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/90 border border-slate-400 shadow flex items-center justify-center hover:bg-slate-100 cursor-pointer"
            >
              <ArrowLeft size={12} className="text-slate-700" />
            </button>
            <button
              type="button"
              onClick={() => setPanOffset(p => ({ ...p, x: p.x - 45 }))}
              title="Mover Mapa para a Direita"
              className="pointer-events-auto absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/90 border border-slate-400 shadow flex items-center justify-center hover:bg-slate-100 cursor-pointer"
            >
              <ArrowRight size={12} className="text-slate-700" />
            </button>
          </div>

          {/* Barra Flutuante de Pincel de Status Rápido (Canto Inferior Esquerdo do Canvas) */}
          <div className="absolute bottom-2.5 left-3 z-30 bg-white/95 backdrop-blur border border-slate-300 rounded-lg shadow px-2.5 py-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-bold text-slate-600 mr-1">Pincel Status:</span>
            {(
              [
                { key: 'free' as const, label: 'Livre', count: stats.free },
                { key: 'sold' as const, label: 'Vendida', count: stats.sold },
                { key: 'reserved' as const, label: 'Reservada', count: stats.reserved },
                { key: 'blocked' as const, label: 'Bloqueada', count: stats.blocked }
              ] as const
            ).map(item => {
              const meta = SEAT_STATUS_META[item.key]
              const dotHex =
                paletteMode === 'video_classic' ? meta.classicBgHex : meta.bgHex
              const active = activeStatusBrush === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  data-testid={`status-brush-${item.key}`}
                  onClick={() => {
                    setActiveStatusBrush(item.key)
                    setActiveTool('paint_status')
                  }}
                  className={`px-2 py-0.5 rounded border flex items-center gap-1.5 font-semibold cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-xs border border-slate-500 inline-block"
                    style={{ backgroundColor: dotHex }}
                  />
                  <span>
                    {item.label} ({item.count})
                  </span>
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => {
                setActiveTool('add_row')
                setUploadAlert('Clique no mapa para carimbar uma fileira inteira de poltronas.')
              }}
              data-testid="studio-tool-add_row"
              className={`px-2 py-0.5 rounded border font-semibold cursor-pointer ${
                activeTool === 'add_row'
                  ? 'bg-amber-500 text-slate-950 border-amber-600'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              + Inserir Fila
            </button>
          </div>

          {/* Viewport Principal do Mapa com Pan + Zoom */}
          <div
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={stopDragging}
            onMouseLeave={stopDragging}
            className="flex-1 overflow-auto flex items-start justify-center p-6 bg-white"
            style={{
              cursor:
                activeTool === 'pan'
                  ? isPanning
                    ? 'grabbing'
                    : 'grab'
                  : activeTool === 'add_seat' || activeTool === 'add_row'
                  ? 'crosshair'
                  : 'default'
            }}
          >
            <div
              ref={canvasRef}
              onClick={handleCanvasClick}
              data-testid="seatmap-96dpi-canvas"
              className="relative select-none shadow-sm"
              style={{
                width: `${bgWidthPx}px`,
                height: `${bgHeightPx}px`,
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
                transformOrigin: 'top center'
              }}
            >
              {/* Fundo da Planta em 96 DPI (Teatro Marista Maringá ou Upload PNG/SVG/JPEG) */}
              {bgDataUrl && (
                <img
                  src={bgDataUrl}
                  alt="Fundo do Layout 96 DPI"
                  draggable={false}
                  className="pointer-events-none absolute inset-0 w-full h-full object-contain"
                  style={{ opacity: bgOpacity / 100 }}
                />
              )}

              {/* Zonas adicionais se existirem */}
              {zones.map(z => (
                <div
                  key={z.id}
                  className="absolute flex flex-col items-center justify-center text-center font-bold rounded-lg"
                  style={{
                    left: `${z.x}px`,
                    top: `${z.y}px`,
                    width: `${z.width}px`,
                    height: `${z.height}px`,
                    backgroundColor: `${z.color}33`,
                    border: `2px solid ${z.color}`,
                    color: '#0F172A'
                  }}
                >
                  <span className="text-[10px]">{z.label}</span>
                </div>
              ))}

              {/* Poltronas React Posicionadas e Rotacionadas (Polt. 01 .. Polt. 56) */}
              {seats.map(seat => {
                const meta = SEAT_STATUS_META[seat.status] || SEAT_STATUS_META.free
                const isSelected = selectedSeatId === seat.id
                const w = seat.shape === 'armchair' ? seat.width || 20 : seatSizePx
                const h = seat.shape === 'armchair' ? seat.height || 27 : seatSizePx
                const rot = seat.rotation || 0
                const fillHex =
                  paletteMode === 'video_classic' ? meta.classicBgHex : meta.bgHex
                const borderHex =
                  paletteMode === 'video_classic' ? meta.classicBorderHex : meta.borderHex

                return (
                  <button
                    key={seat.id}
                    type="button"
                    onClick={e => handleSeatClick(e, seat)}
                    onMouseDown={e => {
                      if (activeTool === 'select') {
                        e.stopPropagation()
                        selectSeatAndRevealInTree(seat)
                        setDraggingSeatId(seat.id)
                      }
                    }}
                    title={`${seat.sectorName} • ${seat.rowLabel} • ${seat.label} (${meta.label})`}
                    data-testid={`canvas-seat-${seat.label}`}
                    className={`absolute flex items-center justify-center p-0 transition-transform ${
                      seat.shape === 'circle'
                        ? 'rounded-full'
                        : seat.shape === 'square'
                        ? 'rounded-[3px]'
                        : ''
                    } ${isSelected ? 'z-20 scale-125 ring-2 ring-amber-400' : 'z-10 hover:scale-115'}`}
                    style={{
                      left: `${seat.x - w / 2}px`,
                      top: `${seat.y - h / 2}px`,
                      width: `${w}px`,
                      height: `${h}px`,
                      transform: `rotate(${rot}deg)`,
                      backgroundColor:
                        seat.shape === 'armchair' ? 'transparent' : fillHex,
                      border:
                        seat.shape === 'armchair'
                          ? 'none'
                          : `1.5px solid ${isSelected ? '#F59E0B' : borderHex}`,
                      cursor: activeTool === 'select' ? 'move' : 'pointer'
                    }}
                  >
                    {seat.shape === 'armchair' ? (
                      renderSeatVisual(seat, isSelected)
                    ) : (
                      <span className="text-[7px] font-extrabold text-white leading-none">
                        {seat.seatNumber}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Aba Vertical "Esconder" da Coluna Direita */}
        <div className="flex items-center bg-[#E2E8F0] z-20">
          <button
            type="button"
            onClick={() => setRightInspectorOpen(prev => !prev)}
            title={rightInspectorOpen ? 'Esconder Informações' : 'Mostrar Informações'}
            className="h-24 w-5 rounded-l border-y border-l border-slate-400 bg-gradient-to-l from-white to-slate-200 hover:from-amber-50 flex items-center justify-center cursor-pointer shadow-xs"
          >
            <span className="text-[10px] font-semibold text-slate-700 [writing-mode:vertical-rl] rotate-180">
              {rightInspectorOpen ? 'Esconder' : 'Informações'}
            </span>
          </button>
        </div>

        {/* -----------------------------------------------------------------
            COLUNA 3 (DIREITA): PROPERTY GRID "INFORMAÇÕES" (IDÊNTICO AO VÍDEO)
        ----------------------------------------------------------------- */}
        {rightInspectorOpen && (
          <div className="w-72 bg-white border-l border-slate-400 flex flex-col shrink-0 text-xs">
            {/* Cabeçalho "Informações" */}
            <div className="bg-gradient-to-b from-[#DCEAFB] to-[#C6DDF7] px-2.5 py-1.5 border-b border-slate-400 font-bold text-slate-800">
              Informações
            </div>

            {/* Barra de Busca + Botões Categorizado / A-Z */}
            <div className="bg-[#EEF2F7] p-1.5 border-b border-slate-300 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPropSortAlphabetical(false)}
                title="Por Categoria"
                className={`p-1 rounded border cursor-pointer ${
                  !propSortAlphabetical
                    ? 'bg-amber-200 border-amber-500 text-slate-900'
                    : 'bg-white border-slate-300 text-slate-600'
                }`}
              >
                <Layers size={13} />
              </button>
              <button
                type="button"
                onClick={() => setPropSortAlphabetical(true)}
                title="Ordem Alfabética (A-Z)"
                className={`px-1.5 py-0.5 rounded border text-[10px] font-bold cursor-pointer ${
                  propSortAlphabetical
                    ? 'bg-amber-200 border-amber-500 text-slate-900'
                    : 'bg-white border-slate-300 text-slate-600'
                }`}
              >
                A↓Z
              </button>

              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search"
                  value={propSearch}
                  onChange={e => setPropSearch(e.target.value)}
                  className="w-full pl-2 pr-6 py-0.5 rounded border border-slate-300 bg-white text-xs text-slate-800"
                />
                {propSearch ? (
                  <button
                    type="button"
                    onClick={() => setPropSearch('')}
                    className="absolute right-1.5 top-1 text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                ) : (
                  <span className="absolute right-1.5 top-1 text-rose-400 font-bold text-xs">
                    ✕
                  </span>
                )}
              </div>
            </div>

            {/* Tabela de Propriedades (Área, Dimensões, Imagens, Posicionamento) */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200 text-[11px]">
              {/* GRUPO 1: ÁREA */}
              <div className="bg-slate-100 px-2 py-1 font-bold text-slate-800 flex items-center gap-1">
                <span>◢</span>
                <span>Área</span>
              </div>

              {matchesPropSearch('Bloquear') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Bloquear',
                      desc: 'Bloqueia a área para a venda.'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span
                    className={`col-span-5 font-medium px-1 py-0.5 rounded ${
                      focusedPropHelp.title === 'Bloquear'
                        ? 'bg-[#2B4C7E] text-white'
                        : 'text-slate-700'
                    }`}
                  >
                    Bloquear
                  </span>
                  <div className="col-span-7 flex items-center gap-1.5 pl-1">
                    <input
                      type="checkbox"
                      checked={isSelectedBlocked}
                      onChange={e => handleToggleBlockCheckbox(e.target.checked)}
                      data-testid="checkbox-block-area"
                      className="rounded border-slate-400 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => setScheduleBlockModalOpen(true)}
                      className="px-1.5 py-0.5 rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 text-[10px] font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer truncate"
                    >
                      {isSelectedBlocked ? 'Agendar Desbloqueio' : 'Agendar Bloqueio'}
                    </button>
                  </div>
                </div>
              )}

              {matchesPropSearch('Color') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Color',
                      desc: 'Cor de preenchimento base da área selecionada.'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">Color</span>
                  <div className="col-span-7 pl-1 flex items-center gap-1">
                    <input
                      type="text"
                      value={selectedSeatObj?.colorHex || '#FFFFFF'}
                      onChange={e => updateSelectedSeatProp({ colorHex: e.target.value })}
                      className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-[11px] font-mono"
                    />
                  </div>
                </div>
              )}

              {matchesPropSearch('Desc.') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Desc.',
                      desc: 'Descrição complementar ou observação operacional da área.'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">Desc.</span>
                  <div className="col-span-7 pl-1">
                    <input
                      type="text"
                      value={selectedSeatObj?.description || ''}
                      onChange={e => updateSelectedSeatProp({ description: e.target.value })}
                      className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-[11px]"
                    />
                  </div>
                </div>
              )}

              {matchesPropSearch('Nome') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Nome',
                      desc: 'Identificador exibido na árvore Estrutura e no ingresso.'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">Nome</span>
                  <div className="col-span-7 pl-1">
                    <input
                      type="text"
                      value={
                        selectedNodeType === 'sector'
                          ? selectedSectorId
                          : selectedNodeType === 'row'
                          ? selectedRowKey.split('::')[1] || 'FILA O'
                          : selectedSeatObj?.label || 'Polt. 01'
                      }
                      onChange={e => {
                        if (selectedNodeType === 'seat') {
                          updateSelectedSeatProp({ label: e.target.value })
                        }
                      }}
                      className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-[11px] font-semibold"
                    />
                  </div>
                </div>
              )}

              {matchesPropSearch('Nominal') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Nominal',
                      desc: 'Exige identificação nominal (CPF e Nome) para emissão desta área.'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">Nominal</span>
                  <div className="col-span-7 pl-1">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedSeatObj?.nominal)}
                      onChange={e => updateSelectedSeatProp({ nominal: e.target.checked })}
                      className="rounded border-slate-400 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {matchesPropSearch('Qtd. Disponível') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Qtd. Disponível',
                      desc: 'Quantidade atual de lugares livres para venda nesta área.'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">Qtd. Disponível</span>
                  <div className="col-span-7 pl-1">
                    <input
                      type="number"
                      readOnly
                      value={
                        selectedNodeType === 'sector'
                          ? selectedSectorTreeStats?.availableSeats ?? 27
                          : selectedSeatObj?.status === 'free'
                          ? 1
                          : 0
                      }
                      className="w-full px-1.5 py-0.5 border border-slate-200 bg-slate-50 rounded text-right font-mono"
                    />
                  </div>
                </div>
              )}

              {matchesPropSearch('Qtd. Inicial') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Qtd. Inicial',
                      desc: 'Capacidade total configurada para a área.'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">Qtd. Inicial</span>
                  <div className="col-span-7 pl-1">
                    <input
                      type="number"
                      readOnly
                      value={
                        selectedNodeType === 'sector'
                          ? selectedSectorTreeStats?.totalSeats ?? 42
                          : 1
                      }
                      className="w-full px-1.5 py-0.5 border border-slate-200 bg-slate-50 rounded text-right font-mono"
                    />
                  </div>
                </div>
              )}

              {matchesPropSearch('Tipo da Área') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Tipo da Área',
                      desc: 'Define se o nó é Área Lugar (L - Poltrona) ou Área Master (M - Setor/Fila).'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">Tipo da Área</span>
                  <div className="col-span-7 pl-1">
                    <select
                      value={selectedNodeType === 'seat' ? 'Área Lugar' : 'Área Master'}
                      onChange={e =>
                        setSelectedNodeType(
                          e.target.value === 'Área Master' ? 'sector' : 'seat'
                        )
                      }
                      className="w-full px-1 py-0.5 border border-slate-300 rounded text-[11px] bg-white"
                    >
                      <option value="Área Lugar">Área Lugar</option>
                      <option value="Área Master">Área Master</option>
                    </select>
                  </div>
                </div>
              )}

              {/* GRUPO 2: DIMENSÕES */}
              <div className="bg-slate-100 px-2 py-1 font-bold text-slate-800 flex items-center gap-1">
                <span>◢</span>
                <span>Dimensões</span>
              </div>

              {matchesPropSearch('Altura') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Altura',
                      desc: 'Altura da poltrona ou setor em pixels (escala 96 DPI).'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">Altura</span>
                  <div className="col-span-7 pl-1">
                    <input
                      type="number"
                      step="1"
                      value={
                        selectedNodeType === 'sector'
                          ? selectedMasterSectorMeta.height
                          : selectedSeatObj?.height ?? 27
                      }
                      onChange={e =>
                        updateSelectedSeatProp({ height: Math.max(10, Number(e.target.value)) })
                      }
                      className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-right font-mono"
                    />
                  </div>
                </div>
              )}

              {matchesPropSearch('Largura') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Largura',
                      desc: 'Largura da poltrona ou setor em pixels (escala 96 DPI).'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">Largura</span>
                  <div className="col-span-7 pl-1">
                    <input
                      type="number"
                      step="1"
                      value={
                        selectedNodeType === 'sector'
                          ? selectedMasterSectorMeta.width
                          : selectedSeatObj?.width ?? 20
                      }
                      onChange={e =>
                        updateSelectedSeatProp({ width: Math.max(10, Number(e.target.value)) })
                      }
                      className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-right font-mono"
                    />
                  </div>
                </div>
              )}

              {/* GRUPO 3: IMAGENS (Área Bloqueada, Área Livre, Área Vendida) */}
              <div className="bg-slate-100 px-2 py-1 font-bold text-slate-800 flex items-center gap-1">
                <span>◢</span>
                <span>Imagens</span>
              </div>

              {(
                [
                  {
                    key: 'blocked' as const,
                    label: 'Área Bloqueada',
                    desc: 'Imagem mostrada quando a área está bloqueada.',
                    modalTitle: 'Procurar Imagem para Área Bloqueada',
                    previewBg: '#27272A'
                  },
                  {
                    key: 'free' as const,
                    label: 'Área Livre',
                    desc: 'Imagem mostrada quando a área está livre para venda.',
                    modalTitle: 'Procurar Imagem para Área Livre',
                    previewBg: paletteMode === 'video_classic' ? '#D1D5DB' : '#2563EB'
                  },
                  {
                    key: 'sold' as const,
                    label: 'Área Vendida',
                    desc: 'Imagem mostrada quando a área já foi vendida.',
                    modalTitle: 'Procurar Imagem para Área Vendida',
                    previewBg: paletteMode === 'video_classic' ? '#DC2626' : '#16A34A'
                  }
                ] as const
              ).map(imgRow => {
                if (!matchesPropSearch(imgRow.label)) return null
                const isFocused = focusedPropHelp.title === imgRow.label
                return (
                  <div
                    key={imgRow.key}
                    onClick={() =>
                      setFocusedPropHelp({ title: imgRow.label, desc: imgRow.desc })
                    }
                    className="grid grid-cols-12 items-center px-2 py-1.5 hover:bg-blue-50/50"
                  >
                    <span
                      className={`col-span-6 px-1 py-0.5 rounded ${
                        isFocused ? 'bg-[#2B4C7E] text-white font-semibold' : 'text-slate-700'
                      }`}
                    >
                      {imgRow.label}
                    </span>
                    <div className="col-span-6 flex items-center justify-between pl-1">
                      {/* Miniatura da Poltrona (igual ao vídeo) */}
                      <div
                        className="w-6 h-7 rounded-xs border border-slate-400 shadow-inner flex items-center justify-center"
                        style={{ backgroundColor: imgRow.previewBg }}
                      >
                        <div className="w-4 h-1.5 bg-white/30 rounded-xs -mt-3" />
                      </div>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          setFocusedPropHelp({ title: imgRow.label, desc: imgRow.desc })
                          setImagePickerModalState({
                            open: true,
                            targetState: imgRow.key,
                            title: imgRow.modalTitle
                          })
                        }}
                        data-testid={`btn-image-picker-${imgRow.key}`}
                        className="px-2 py-0.5 rounded border border-slate-400 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                      >
                        ...
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* GRUPO 4: POSICIONAMENTO (Manter proporção, Rotação, X, Y, Z) */}
              <div className="bg-slate-100 px-2 py-1 font-bold text-slate-800 flex items-center gap-1">
                <span>◢</span>
                <span>Posicionamento</span>
              </div>

              {matchesPropSearch('Manter proporção') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Manter proporção',
                      desc: 'Mantém a proporção entre Largura e Altura ao redimensionar (F7).'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-6 text-slate-700 px-1">Manter proporção</span>
                  <div className="col-span-6 pl-1">
                    <input
                      type="checkbox"
                      checked={keepAspectRatio}
                      onChange={e => setKeepAspectRatio(e.target.checked)}
                      className="rounded border-slate-400 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {matchesPropSearch('Rotação') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Rotação',
                      desc: 'Ângulo de inclinação da poltrona ou setor em graus (ex: 39, 0, -42).'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">Rotação</span>
                  <div className="col-span-7 pl-1">
                    <input
                      type="number"
                      value={
                        selectedNodeType === 'sector'
                          ? selectedMasterSectorMeta.rotation
                          : selectedSeatObj?.rotation ?? 0
                      }
                      onChange={e =>
                        updateSelectedSeatProp({ rotation: Number(e.target.value) })
                      }
                      className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-right font-mono"
                    />
                  </div>
                </div>
              )}

              {matchesPropSearch('X') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'X',
                      desc: 'Posição horizontal (eixo X) da área no mapa em pixels.'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">X</span>
                  <div className="col-span-7 pl-1">
                    <input
                      type="number"
                      step="0.5"
                      value={
                        selectedNodeType === 'sector' ? 0 : selectedSeatObj?.x ?? 112.29
                      }
                      onChange={e => updateSelectedSeatProp({ x: Number(e.target.value) })}
                      className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-right font-mono"
                    />
                  </div>
                </div>
              )}

              {matchesPropSearch('Y') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Y',
                      desc: 'Posição vertical (eixo Y) da área no mapa em pixels.'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">Y</span>
                  <div className="col-span-7 pl-1">
                    <input
                      type="number"
                      step="0.5"
                      value={
                        selectedNodeType === 'sector' ? 0 : selectedSeatObj?.y ?? 497.48
                      }
                      onChange={e => updateSelectedSeatProp({ y: Number(e.target.value) })}
                      className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-right font-mono"
                    />
                  </div>
                </div>
              )}

              {matchesPropSearch('Z') && (
                <div
                  onClick={() =>
                    setFocusedPropHelp({
                      title: 'Z',
                      desc: 'Ordem de camada / empilhamento (eixo Z) da área.'
                    })
                  }
                  className="grid grid-cols-12 items-center px-2 py-1 hover:bg-blue-50/50"
                >
                  <span className="col-span-5 text-slate-700 px-1">Z</span>
                  <div className="col-span-7 pl-1">
                    <input
                      type="number"
                      readOnly
                      value="0"
                      className="w-full px-1.5 py-0.5 border border-slate-200 bg-slate-50 rounded text-right font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Caixa Inferior de Ajuda Contextual da Propriedade Selecionada (Idêntica ao Vídeo) */}
            <div className="h-16 bg-[#E5EBF3] border-t border-slate-400 p-2 flex flex-col justify-center">
              <strong className="text-[11px] font-bold text-slate-900 block">
                {focusedPropHelp.title}
              </strong>
              <span className="text-[11px] text-slate-700 leading-tight">
                {focusedPropHelp.desc}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          MODAL 1: "PROCURAR IMAGEM PARA ÁREA BLOQUEADA / LIVRE / VENDIDA" (FRAMES 07-08)
      ===================================================================== */}
      {imagePickerModalState.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-lg border-2 border-[#7A96DF] bg-[#ECE9D8] shadow-2xl overflow-hidden text-xs text-slate-900">
            {/* Titlebar estilo Windows / Delphi do vídeo */}
            <div className="bg-gradient-to-r from-[#BFD3EE] via-[#D8E6F7] to-[#BFD3EE] px-3 py-1.5 border-b border-slate-400 flex items-center justify-between">
              <span className="font-semibold text-slate-800">
                {imagePickerModalState.title}
              </span>
              <button
                type="button"
                onClick={() =>
                  setImagePickerModalState(prev => ({ ...prev, open: false }))
                }
                className="px-2 py-0.5 rounded bg-[#E04343] hover:bg-red-600 text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-white space-y-3">
              <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-700 shrink-0">
                  Nome da Imagem:
                </label>
                <input
                  type="text"
                  value={imagePickerSearch}
                  onChange={e => setImagePickerSearch(e.target.value)}
                  className="flex-1 px-2 py-1 border border-slate-400 rounded"
                />
                <button
                  type="button"
                  onClick={() => {}}
                  className="px-3 py-1 rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 font-semibold cursor-pointer"
                >
                  Procurar
                </button>
                <input
                  ref={seatSpriteInputRef}
                  type="file"
                  accept=".png,.svg,.jpg,.jpeg"
                  onChange={handleSeatSpriteUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => seatSpriteInputRef.current?.click()}
                  className="px-3 py-1 rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 font-semibold cursor-pointer"
                >
                  Nova Imagem
                </button>
              </div>

              <div className="grid grid-cols-12 gap-3 h-56">
                {/* Lista de Sprites de Poltrona */}
                <div className="col-span-7 border border-slate-300 rounded p-2 overflow-y-auto space-y-1">
                  {[
                    { name: 'Poltrona Teatro Clássica 25x32 (Padrão)', shape: 'armchair' as const },
                    { name: 'Bolinha Circular 24x24 (Seatmap Pro)', shape: 'circle' as const },
                    { name: 'Quadrado Poltrona 24x24 (Novaoito)', shape: 'square' as const }
                  ]
                    .filter(i =>
                      i.name.toLowerCase().includes(imagePickerSearch.toLowerCase())
                    )
                    .map(item => (
                      <div
                        key={item.name}
                        onClick={() => handleShapeChange(item.shape)}
                        className={`px-2 py-1.5 rounded cursor-pointer flex items-center justify-between ${
                          seatShape === item.shape
                            ? 'bg-blue-600 text-white font-bold'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span>{item.name}</span>
                        <span className="text-[10px]">25 x 32 px</span>
                      </div>
                    ))}
                </div>

                {/* Painel Direito "Área" com Preview 25 x 32 (pixels) igual ao Frame 07 */}
                <div className="col-span-5 border border-slate-300 rounded p-2.5 flex flex-col justify-between bg-slate-50">
                  <div>
                    <div className="text-center font-bold text-slate-900 mb-1">Área</div>
                    <label className="block text-[11px] text-slate-600">Nome:</label>
                    <input
                      type="text"
                      readOnly
                      value={selectedSeatObj?.label || 'Polt. 01'}
                      className="w-full px-2 py-1 border border-slate-300 rounded bg-white font-semibold mb-2"
                    />
                    <label className="block text-[11px] text-slate-600 mb-1">Imagem:</label>
                    <div className="h-24 border border-slate-300 bg-white rounded flex items-center justify-center p-2">
                      <div className="w-12 h-16">
                        {selectedSeatObj && renderSeatVisual(selectedSeatObj, false)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Tamanho: 25 x 32 (pixels).
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCustomStateSprites(prev => {
                      const next = { ...prev }
                      delete next[imagePickerModalState.targetState]
                      return next
                    })
                    setImagePickerModalState(prev => ({ ...prev, open: false }))
                  }}
                  className="px-3 py-1 rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 font-semibold cursor-pointer"
                >
                  Sem Imagem
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setImagePickerModalState(prev => ({ ...prev, open: false }))
                  }
                  className="px-8 py-1 rounded border border-slate-500 bg-gradient-to-b from-white to-slate-100 font-bold cursor-pointer"
                >
                  Ok
                </button>
                <span className="w-20" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: "PESQUISAR IMAGEM" (AO CLICAR EM "ALTERAR FUNDO DO LAYOUT" - FRAME 28)
      ===================================================================== */}
      {bgSearchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-lg border-2 border-[#7A96DF] bg-white shadow-2xl overflow-hidden text-xs text-slate-900">
            <div className="bg-gradient-to-r from-[#BFD3EE] via-[#D8E6F7] to-[#BFD3EE] px-3 py-1.5 border-b border-slate-400 flex items-center justify-between">
              <span className="font-semibold text-slate-800">Pesquisar Imagem</span>
              <button
                type="button"
                onClick={() => setBgSearchModalOpen(false)}
                className="px-2 py-0.5 rounded bg-[#E04343] hover:bg-red-600 text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-700">Nome:</label>
                <input
                  type="text"
                  value={bgModalQuery}
                  onChange={e => setBgModalQuery(e.target.value)}
                  placeholder="Digite o nome da planta ou clique em Nova Imagem para enviar PNG/SVG/JPEG 96 DPI..."
                  className="flex-1 px-2 py-1 border border-slate-400 rounded"
                />
                <button
                  type="button"
                  onClick={() => {}}
                  className="px-3 py-1 rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 font-semibold cursor-pointer"
                >
                  Procurar
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 rounded border border-amber-500 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
                >
                  Nova Imagem (Upload 96 DPI)
                </button>
              </div>

              <div className="border border-slate-300 rounded h-60 overflow-y-auto bg-[#F3F4F6]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                      <th className="py-1.5 px-3 w-28 border-r border-slate-300">Imagem</th>
                      <th className="py-1.5 px-3">Nome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {SAVED_LAYOUT_PRESETS.filter(p =>
                      p.name.toLowerCase().includes(bgModalQuery.toLowerCase())
                    ).map(item => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedLayoutId(item.id)
                          applyPresetBlueprint(item.preset, item.name)
                          setBgSearchModalOpen(false)
                        }}
                        className="hover:bg-blue-50 cursor-pointer"
                      >
                        <td className="py-1.5 px-3 font-mono text-[10px] text-blue-700">
                          96 DPI Mapa
                        </td>
                        <td className="py-1.5 px-3 font-semibold text-slate-800">
                          {item.name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const found = SAVED_LAYOUT_PRESETS.find(
                      item => item.id === selectedLayoutId
                    )
                    if (found) applyPresetBlueprint(found.preset, found.name)
                    setBgSearchModalOpen(false)
                  }}
                  className="px-6 py-1 rounded border border-slate-500 bg-gradient-to-b from-white to-slate-100 font-bold cursor-pointer"
                >
                  Selecionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: "AGENDAR BLOQUEIO / DESBLOQUEIO"
      ===================================================================== */}
      {scheduleBlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border-2 border-[#7A96DF] bg-white shadow-2xl overflow-hidden text-xs text-slate-900">
            <div className="bg-gradient-to-r from-[#BFD3EE] to-[#D8E6F7] px-3 py-1.5 border-b border-slate-400 flex items-center justify-between">
              <span className="font-bold text-slate-800">
                {isSelectedBlocked ? 'Agendar Desbloqueio Automático' : 'Agendar Bloqueio de Área'}
              </span>
              <button
                type="button"
                onClick={() => setScheduleBlockModalOpen(false)}
                className="px-2 py-0.5 rounded bg-[#E04343] text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-slate-600">
                Área selecionada:{' '}
                <strong className="text-slate-900">
                  {selectedSeatObj?.label || selectedSectorId}
                </strong>
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Data e Hora Programada:
                </label>
                <input
                  type="datetime-local"
                  value={scheduleBlockDate}
                  onChange={e => setScheduleBlockDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setScheduleBlockModalOpen(false)}
                  className="px-3 py-1 rounded border border-slate-300 bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleToggleBlockCheckbox(!isSelectedBlocked)
                    setScheduleBlockModalOpen(false)
                    setUploadAlert(
                      `Agendamento registrado para ${selectedSeatObj?.label || selectedSectorId} em ${scheduleBlockDate}.`
                    )
                  }}
                  className="px-4 py-1 rounded bg-blue-600 text-white font-bold cursor-pointer"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: "DICAS" (ATALHOS F6, F7, F8 E INSTRUÇÕES DA ESTRUTURA VISUAL)
      ===================================================================== */}
      {tipsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg border-2 border-[#7A96DF] bg-white shadow-2xl overflow-hidden text-xs text-slate-900">
            <div className="bg-gradient-to-r from-[#BFD3EE] to-[#D8E6F7] px-3 py-1.5 border-b border-slate-400 flex items-center justify-between">
              <span className="font-bold text-slate-800">
                Dicas e Atalhos • Estrutura Visual (React)
              </span>
              <button
                type="button"
                onClick={() => setTipsModalOpen(false)}
                className="px-2 py-0.5 rounded bg-[#E04343] text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-2 text-slate-700">
              <p>
                • <strong>Árvore Estrutura (Esquerda)</strong>: Expanda os setores{' '}
                <span className="px-1 rounded bg-orange-600 text-white font-bold">M</span> e as
                filas <span className="px-1 rounded bg-orange-600 text-white font-bold">M</span>{' '}
                para localizar qualquer poltrona{' '}
                <span className="px-1 rounded bg-blue-600 text-white font-bold">L</span> (ex.:{' '}
                <code>Polt. 01</code>, <code>Polt. 51</code>).
              </p>
              <p>
                • <strong>Bloquear / Desbloquear Poltrona ou Setor</strong>: Selecione a poltrona
                no mapa ou na árvore e marque a caixa <strong>Bloquear</strong> no painel{' '}
                <strong>Informações</strong> à direita.
              </p>
              <p>
                • <strong>Ferramentas de Edição no Topo do Mapa</strong>: Mão (Pan),{' '}
                <strong>F6</strong> (Selecionar/Mover X,Y), <strong>F7</strong> (Redimensionar
                Largura/Altura) e <strong>F8</strong> (Rotacionar ângulo em graus).
              </p>
              <p>
                • <strong>Alterar Fundo do Layout (96 DPI)</strong>: Permite selecionar um layout
                salvo ou enviar qualquer planta em <strong>PNG, SVG, JPG ou JPEG em 96 DPI</strong>.
              </p>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setTipsModalOpen(false)}
                  className="px-5 py-1 rounded border border-slate-400 bg-slate-100 font-bold cursor-pointer"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
