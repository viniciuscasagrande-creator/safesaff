# SafeSaff — Plano técnico de correção global dos temas
**Versão:** 1.0 — 16/11/2026  
**Decisão visual aprovada:** claro branco/grafite; escuro grafite profundo; destaques em azul elétrico, ciano, violeta e laranja. Não usar verde como cor da identidade principal. Verde pode continuar reservado a estados semânticos de sucesso se necessário.

## 1. Objetivos e não objetivos
**Objetivos:** erradicar ações ilegíveis; unificar tokens e componentes; manter equivalência funcional entre claro, escuro e sistema; cobrir todas as telas; reduzir estilos locais conflitantes; permitir validação automatizada.  
**Não objetivos:** alterar fluxos de estorno, regras financeiras, modelos Prisma, infraestrutura Neon, permissões ou lógica de SAC.

## 2. Modelo-alvo do Design System
**Fonte da verdade:** `src/index.css` (ou arquivo de tokens importado por ele), classes semânticas do Tailwind e componentes de UI centralizados. `ThemeProvider.tsx` controla a classe `.dark`, `data-theme` e preferência persistida; sem temas paralelos dentro de páginas.

### Tokens obrigatórios
- Superfícies: `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `muted`, `muted-foreground`, `border`, `input`.
- Ações: `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`.
- Estados: `success`, `warning`, `info` e variantes `soft`, cada uma com texto correspondente de contraste validado.
- Interação: `ring`, `focus`, `disabled`, `hover`, `selected`, `invalid`.
- Gráficos: variáveis específicas `chart-1` a `chart-6` definidas por tema, sem embutir hexadecimais diretamente em cada visualização.

### Paleta inicial de referência — sujeita a teste de contraste
| Token | Claro | Escuro |
|---|---|---|
| `background` | `#F5F7FA` | `#0B1018` |
| `foreground` | `#111827` | `#F7F9FC` |
| `card` | `#FFFFFF` | `#151C27` |
| `card-foreground` | `#111827` | `#F7F9FC` |
| `border` | `#DCE3ED` | `#344153` |
| `primary` | `#155EEF` | `#388BFF` |
| `primary-foreground` | `#FFFFFF` | `#071321` |
| `secondary` | `#E9EDF4` | `#253244` |
| `secondary-foreground` | `#192337` | `#F7F9FC` |
| `accent` | `#ECE4FF` | `#35234C` |
| `accent-foreground` | `#5C2FB0` | `#E9D7FF` |

A paleta é um ponto de partida de engenharia. Toda combinação de texto/fundo, inclusive hover, focus e disabled, precisa passar pelo teste de contraste antes da publicação. Neon deve ser realce, não texto pequeno indiscriminado.

## 3. Correção de P0: botões
1. Inspecionar no ambiente publicado os botões em **Financeiro > Estornos > Fila de Aprovações Pendentes**, sobretudo **Analisar**, para recuperar o seletor vencedor da cascata e o estado real do elemento.
2. Corrigir a causa no componente ou no estilo correspondente — **não** criar uma regra global improvisada como `.dark button { color: white }`.
3. Refatorar `src/components/ui/Button.tsx` para que `primary`, `secondary`, `ghost`, `context`, `danger` e `outline` (se adotado) usem somente pares semânticos de cores para cada tema. Não manter `bg-white` sem `text` compatível garantido.
4. Substituir cores fixas nas variantes e criar estados explícitos: hover, active, focus-visible, disabled, loading. `disabled` deve continuar legível; nunca esconder label por `opacity` excessiva.
5. Garantir precedência controlada de classes passadas via `className`; revisar se `text-white` herdado do módulo ou utilitário supera a variante pretendida.
6. Adicionar exemplos visuais documentados das variantes em claro e escuro (Storybook ou página de laboratório de componentes) e snapshots para desktop/mobile.

### Exemplo ilustrativo da orientação de classes (não é patch pronto)
```tsx
const variants = {
  primary: 'bg-primary text-primary-foreground hover:brightness-95',
  secondary: 'bg-secondary text-secondary-foreground hover:brightness-95',
  ghost: 'bg-transparent text-foreground hover:bg-muted',
  danger: 'bg-destructive text-destructive-foreground hover:brightness-95',
};
```

## 4. Estrutura de arquivos: ordem de intervenção
| Ordem | Arquivo ou área | Ação |
|---|---|---|
| 1 | `src/design-system/providers/ThemeProvider.tsx` | Confirmar sincronização `.dark`, `data-theme`, tema do sistema, persistência e ausência de FOUC. |
| 2 | `src/index.css` | Consolidar tokens e especificar claro/escuro de maneira única. |
| 3 | `tailwind.config.js` | Garantir mapeamento semântico dos tokens; documentar depreciação de `brand.*` fixa. |
| 4 | `src/components/ui/Button.tsx` e outros componentes UI | Padronizar ações, formulários, dialogs, menus, tabelas, badges, tooltips, toasts, datepicker. |
| 5 | `src/pages/finance/FinanceRefundsPage.tsx`, `advanced/RefundsScreen.tsx`, `finance-disputes-*.css` | Remover conflitos específicos de Estornos e Financeiro após comparar com rota ativa. |
| 6 | Shell: sidebar, header, breadcrumb, navegação | Confirmar modo escuro e claro em todo o ERP sem duplicação de estilos. |
| 7 | Demais módulos de negócio | Migrar por lotes com inventário de rotas e componentes. |
| 8 | Gráficos / SVG / bibliotecas externas | Mapear paleta de séries e textos em ambos os temas. |

## 5. Procedimento de migração sem quebrar o ERP
**Fase A — Congelamento e baseline:** criar branch Git de correção visual, salvar commit e screenshots da versão atual em claro/escuro; levantar rotas, imports CSS e componentes. Definir feature flag para liberação gradual.  
**Fase B — P0 financeiro:** corrigir botão ilegível e testar ações de Estornos sem executar operações financeiras reais; inspecionar também botões em modais e tabelas.  
**Fase C — Núcleo visual:** atualizar tokens, Tailwind e componentes; mapear usos `bg-white`, `text-white`, valores `#hex`, `!important`, `style={{...}}` e seletores `.dark`; converter usos não semânticos.  
**Fase D — Módulos:** migrar em lotes: shell/autenticação → Financeiro/Estornos → SAC/IA → Eventos/Ingressos/Vendas → demais módulos e relatórios. Revisar desktop e mobile.  
**Fase E — Homologação:** testes automatizados e manuais com contas de perfis distintos; registros de evidência por rota, tema e estado.  
**Fase F — Liberação:** canary/feature flag, métricas de erro no frontend, comparação de screenshots e plano de reversão por commit.

## 6. Critérios de aceite obrigatórios
- Nenhum botão de ação tem texto ilegível, recortado ou invisível em nenhum tema/estado.
- Contraste de texto normal **>= 4,5:1**, texto grande **>= 3:1**, componentes não textuais e indicadores de foco **>= 3:1** quando aplicável (WCAG AA).
- Toggle claro/escuro/sistema altera todas as superfícies, componentes, portais e overlays sem recarregar; preferência é persistida.
- Cada rota passa nos estados: padrão, hover, foco pelo teclado, loading, vazio, erro, sucesso, disabled, modal aberto, tabela selecionada e responsivo.
- Ações financeiras existentes conservam regras, permissões e resultados; testes funcionais ficam verdes.
- Nenhuma rota recebe novo `bg-white`/`text-white` sem par de contraste explícito e revisão.
- Mudanças em CSS global devem ter diffs visuais de regressão aprovados.
- Uma única navegação e um único header por contexto; módulos não recriam shell.

## 7. Testes propostos
**Unitários:** componentes de botão com todas as variantes/estados e data-theme; ThemeProvider de sistema, persistência e alternância.  
**Visual:** Playwright screenshots em tema claro e escuro para rotas prioritárias, resoluções 1440×900, 1280×800 e 390×844, com comparação controlada.  
**Acessibilidade:** axe-core/Playwright ou equivalente, medição automatizada de contraste e revisão de foco/teclado; testes reais de interação em controles financeiros.  
**Funcionais:** abrir formulário Estorno, abrir detalhe, visualizar botões de autorizar/recusar, verificar comportamento de `disabled`, navegação entre módulos, temas, dialogs e toasts; nunca confirmar estorno real nos testes de UI.  
**E2E:** autenticar perfis distintos e executar apenas fluxos seguros em ambiente de homologação.

## 8. Modelo da matriz de homologação
| Módulo | Claro | Escuro | Mobile | Teclado/Contraste | Regressão funcional | Status |
|---|---|---|---|---|---|---|
| Financeiro > Estornos | Pendente | P0 conhecido | Pendente | Pendente | Pendente | **Bloqueado** |
| Dashboard geral | Pendente | Pendente | Pendente | Pendente | Pendente | Não testado |
| SAC > Dashboard | Pendente | Pendente | Pendente | Pendente | Pendente | Não testado |
| SAC > Chat/IA | Pendente | Pendente | Pendente | Pendente | Pendente | Não testado |
| Eventos e Ingressos | Pendente | Pendente | Pendente | Pendente | Pendente | Não testado |
| Financeiro > demais páginas | Pendente | Pendente | Pendente | Pendente | Pendente | Não testado |
| Administração/Configurações | Pendente | Pendente | Pendente | Pendente | Pendente | Não testado |

Preencher inventário de **todas as rotas reais** da versão publicada e expandir esta matriz antes da liberação.

## 9. Rollback e proteção
- Versionar o design system e manter commit/tag do estado anterior.
- Não acoplar reforma visual a migrações do Neon ou alteração de APIs.
- Habilitar rollout por ambiente/feature flag; usar monitoramento de erros JS e métricas de acessibilidade.
- Se surgir P0 em página crítica, reverter a reforma visual independentemente de funções de negócio.

## 10. Dependências para um patch exato
Obter o **ZIP ou commit da versão atualmente implantada**, incluindo bundle/folhas de estilo de Estornos, além de URL de homologação e logs de console, quando disponíveis. Comparar a compilação atual com o backup de 16/11/2026. Só então publicar patch de CSS preciso e homologado. O presente documento é um plano técnico e **não realiza alterações no sistema**.
