# SafeSaff / DiskIngressos — Diretrizes Permanentes do Agente

## 1. Fluxo Obrigatório de Git + Deploy em Produção (Vercel)

Sempre que concluir qualquer modificação, correção ou evolução solicitada pelo usuário:

1. Executar os testes de contrato e gates obrigatórios:
   - `node --test tests/ui-theme-contrast-contract.test.mjs tests/sac-kpis.test.mjs`
   - `npm run verify:protected-modules`
   - `npm run check:lucide`
   - `node scripts/verify-finance-release.mjs`
2. Preparar, comitar e enviar para o GitHub:
   - `git add -A`
   - `git commit -m "<tipo>(<escopo>): <descrição>"`
   - `git push origin main`
3. **Publicar imediatamente na Vercel em produção:**
   - `vercel --prod --yes`
   - Confirmar que o alias `https://safesaff.vercel.app` recebeu o novo bundle (apenas `git push origin main` não atualiza o alias de produção sem `vercel --prod --yes`).

---

## 2. Design System 2.0 (Temas Claro e Escuro — WCAG 2.2 AA)

- **Tema Claro:** Fundo `#F5F7FA`, Cards `#FFFFFF`, Sidebar Grafite `#161D29`, Azul Elétrico `#155EEF`, Roxo `#7942D8`, Laranja `#BD5D00`, Ciano `#009AC2`, Texto Principal `#111827`, Texto Secundário `#526074`, Bordas `#DCE2EA`.
- **Tema Escuro:** Fundo `#0B1018`, Cards `#151C27`, Superfície Elevada `#1D2735`, Azul Neon `#388BFF`, Roxo Neon `#B66CFF`, Laranja `#FF9A35`, Ciano `#24DEFF`, Texto Principal `#F7F9FC`, Texto Secundário `#B5C0D0`, Bordas `#344154`.
- **Proibido:** usar botões ou cards com cores fixas sem par explícito Claro/Escuro (ex.: nunca usar `bg-white` sem texto escuro correspondente no claro e `dark:bg-[#151C27]` no escuro, nem deixar cards de conteúdo com fundo escuro `#161D29` fixo no tema claro).

---

## 3. Responsividade Global Mobile (`< 768px`) e Desktop (`>= 768px`)

- **Isolamento estrito da Sidebar Desktop:** Toda regra que defina largura fixa (`350px`, `310px`, `64px`, `76px`), `flex: 0 0 ...` ou `position: sticky` para `#main-module-sidebar`, `.safesaff-sidebar` ou `.event-context-sidebar` **DEVE** ficar dentro de `@media (min-width: 768px)`.
- **Gaveta Mobile (`@media (max-width: 767px)`):** `#main-module-sidebar` e `.event-context-sidebar` devem usar `position: fixed !important; inset: 0 auto 0 0 !important; z-index: 1005 !important; transform: translateX(-105%) !important;` quando fechados e `transform: translateX(0) !important;` quando abertos (`.mobile-nav-open` / `.sidebar-mobile-expanded`).
- **Conteúdo Mobile 100% da Largura:** Em `@media (max-width: 767px)`, `#main-app-content` ocupa `flex: 1 1 100% !important; width: 100% !important; max-width: 100vw !important;` e a rolagem vertical nativa (`html, body, #root { height: auto !important; overflow-y: auto !important; }`) nunca deve ser bloqueada exceto enquanto o drawer mobile estiver aberto (`body.mobile-nav-open`).
- **Sem Duplicidade de Gaveta:** Nunca renderizar um segundo drawer mobile sobreposto ao `#main-module-sidebar`.
