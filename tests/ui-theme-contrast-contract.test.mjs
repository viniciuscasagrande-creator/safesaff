import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('UI-001 (P0): Estornos buttons (.estcc-btn, .estcc-btn-primary, .estcc-btn-analyze) have explicit high-contrast pairs in Light and Dark themes', () => {
  const estcc = read('src/pages/finance/finance-disputes-control-center.css')
  assert.match(estcc, /#disk-estornos-module \.estcc-btn-analyze[\s\S]*?background: #EFF6FF !important;[\s\S]*?color: #155EEF !important;/)
  assert.match(estcc, /html\.dark #disk-estornos-module \.estcc-btn-analyze[\s\S]*?color: #388BFF !important;/)
  assert.match(estcc, /html\.dark #disk-estornos-module \.estcc-btn:not\(\.estcc-btn-primary\)[\s\S]*?background: #1D2735 !important;[\s\S]*?color: #F7F9FC !important;/)
  assert.match(estcc, /#disk-estornos-module \.estcc-btn\.estcc-btn-primary[\s\S]*?background: #155EEF !important;[\s\S]*?color: #FFFFFF !important;/)
})

test('UI-002 (P0): Shared Button component (src/components/ui/Button.tsx) supports semantic Light and Dark variants without fixed white-on-white', () => {
  const btn = read('src/components/ui/Button.tsx')
  for (const variant of ['primary', 'secondary', 'outline', 'context', 'ghost', 'danger', 'success', 'warning']) {
    assert.ok(btn.includes(`${variant}:`), `Missing variant ${variant}`)
  }
  assert.match(btn, /dark:bg-\[#1D2735\]/)
  assert.match(btn, /dark:text-\[#F7F9FC\]/)
  assert.match(btn, /bg-\[#155EEF\]/)
})

test('UI-003 & UI-004 (P1): index.css, colors.css and tailwind.config.js use approved Graphite/White/Neon tokens', () => {
  const colors = read('src/design-system/tokens/colors.css')
  const index = read('src/index.css')
  const tw = read('tailwind.config.js')
  assert.match(colors, /--safesaff-action-primary: #155EEF/)
  assert.match(colors, /--safesaff-action-primary: #388BFF/)
  assert.match(index, /--primary: 220 87% 51%/)
  assert.match(tw, /blue: 'var\(--disk-color-primary, #155EEF\)'/)
})

test('UI-005 & UI-006 (P1): Estornos and Finance pages do not use text-slate-900 on dark colored buttons or raw var(--card, #fff)', () => {
  const refunds = read('src/pages/finance/FinanceRefundsPage.tsx')
  const styles = read('src/styles.css')
  assert.doesNotMatch(refunds, /bg-rose-600[^>]*text-slate-900/)
  assert.doesNotMatch(refunds, /hover:bg-\[#334155\] text-slate-700 hover:text-slate-900/)
  assert.doesNotMatch(styles, /var\(--card,\s*#fff\)/)
})

test('MOB-001 (P0): Mobile layout (<768px) does not lock 350px sticky sidebar width or render duplicate mobile drawers', () => {
  const layoutCss = read('src/styles/disk-layout-image-2.css')
  const shellV6 = read('src/styles/disk-limitless-shell-v6.css')
  const appShell = read('src/app/layout/AppShell.tsx')

  assert.match(layoutCss, /@media \(min-width: 768px\)[\s\S]*?#main-module-sidebar\.module-sidebar\.safesaff-sidebar/)
  assert.match(layoutCss, /@media \(max-width: 767px\)[\s\S]*?z-index: 1005 !important/)
  assert.match(layoutCss, /@media \(max-width: 767px\)[\s\S]*?#main-app-content[\s\S]*?width: 100% !important/)
  assert.doesNotMatch(shellV6, /@media\(max-width:1023px\)/)
  assert.doesNotMatch(appShell, /<MobileNavigation/)
})
