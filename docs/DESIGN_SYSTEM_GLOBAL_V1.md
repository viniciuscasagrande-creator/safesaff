# SafeSaff ERP — Design System Global v1.0 (Reformulação Global dos Temas Claro & Escuro)

## 1. Direção Visual Aprovada
- **Moderno e Corporativo (Grafite, Branco e Neon Controlado):**
  - Sem verde como cor de marca ou ação primária.
  - **Modo Claro (`light`):** fundo geral `#F5F7FA`, cards `#FFFFFF`, bordas `#DCE2EA`, navegação lateral grafite `#161D29` com texto `#F7F9FC` e item ativo azul elétrico `#155EEF`, texto principal `#111827` e secundário `#526074`.
  - **Modo Escuro (`dark`):** fundo geral `#0B1018`, cards `#151C27`, modais/popovers `#1D2735`, navegação lateral `#0B1018`, bordas `#344154`, texto principal `#F7F9FC` e secundário `#B5C0D0`, destaques neon controlados (`#388BFF`, `#B66CFF`, `#24DEFF`, `#FF9A35`).

## 2. Tabela Oficial de Tokens Semânticos

| Token | Modo Claro (`light`) | Modo Escuro (`dark`) | Função no Ecossistema SafeSaff |
| :--- | :--- | :--- | :--- |
| `canvas` (`--disk-bg-app`) | `#F5F7FA` | `#0B1018` | Fundo geral das páginas |
| `surface` (`--disk-bg-surface`) | `#FFFFFF` | `#151C27` | Cards, painéis e tabelas |
| `surface-raised` (`--disk-bg-elevated`) | `#FFFFFF` | `#1D2735` | Modais, drawers e popovers |
| `sidebar` (`--disk-layout-sidebar-bg`) | `#161D29` | `#0B1018` | Navegação lateral unificada |
| `text-primary` (`--disk-text-primary`) | `#111827` | `#F7F9FC` | Títulos, valores KPI e texto principal |
| `text-secondary` (`--disk-text-secondary`) | `#526074` | `#B5C0D0` | Subtítulos, rótulos e metadados |
| `border` (`--disk-border-default`) | `#DCE2EA` | `#344154` | Contornos de 1px em cards e inputs |
| `action-primary` (`--disk-color-primary`) | `#155EEF` | `#388BFF` | Botões primários, links e item ativo |
| `accent-cyan` (`--disk-color-info`) | `#009AC2` | `#24DEFF` | Indicadores analíticos e séries de gráficos |
| `accent-violet` (`--disk-color-ai`) | `#7942D8` | `#B66CFF` | Inteligência Artificial (Cliente N1 + Copiloto SAC) |
| `accent-orange` (`--disk-color-warning`) | `#BD5D00` | `#FF9A35` | Alertas de SLA, fila e atenção |
| `danger` (`--disk-color-danger`) | `#C1273C` | `#FF5A78` | Erro, bloqueio e prazo crítico |
| `success` (`--disk-color-success`) | `#16734A` | `#43D9A3` | Confirmação semântica de sucesso |

## 3. Padronização por Módulo Aplicada
1. **AppShell, Header e Sidebar (`src/styles/safesaff-premium-mega-nav.css`, `src/styles/disk-limitless-shell-v6.css`, `src/app/layout/AppHeader.tsx`):**
   - Sidebar grafite (`#161D29` no claro / `#0B1018` no escuro) com alto contraste em ambos os temas, item ativo em Azul Elétrico (`#155EEF` / `#388BFF`) e badges em Violeta (`#7942D8` / `#B66CFF`).
2. **SAC — Dashboard de Atendimento (`src/components/sac/dashboard/SacDashboardPage.tsx`):**
   - 4 KPIs corporativos com ícones em Azul Elétrico, Violeta Neon, Laranja SLA e Ciano; faixa operacional grafite de alto contraste para Fila (com Alerta Sonoro Web Audio API), Atendentes e Produtividade; gráficos em Azul Elétrico/Violeta; anéis de SLA por prioridade (`98,7% Alta`, `96,1% Média`, `93,2% Baixa`); Gerenciador de Skills e seção de IA adaptáveis aos dois temas.
3. **Central SAC — Chat + IA (`src/components/sac/SacChatPage.tsx`):**
   - Mensagens do cliente em superfície neutra, respostas do atendente humano em Azul Elétrico (`#155EEF`), Assistente Virtual N1 e Sugestões Privadas do Copiloto IA em Violeta Neon (`#7942D8` / `#B66CFF`) e indicadores de SLA em Laranja (`#BD5D00` / `#FF9A35`).
4. **Demais Módulos do ERP (`src/styles/disk-layout-image-2.css`):**
   - Regras de modo escuro devidamente escopadas em `html.dark` e suporte completo a `html:not(.dark)` para Event OS, Cockpit, Inventário, Central de Clientes, Hub de Atendimento, Financeiro, Contabilidade e Administração.
