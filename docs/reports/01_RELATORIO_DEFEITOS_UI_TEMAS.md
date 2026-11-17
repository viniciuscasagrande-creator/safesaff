# SafeSaff / DiskIngressos — Auditoria corretiva de interface e temas
**Data:** 16/11/2026  
**Escopo:** tema claro e escuro, com foco inicial em Financeiro > Estornos e alcance em todo o frontend.  
**Natureza:** auditoria estática do backup + observação de captura de tela da implantação. Não é auditoria de produção com navegador e logs.

## 1. Resumo executivo
A captura enviada mostra botões de ação da fila de aprovações de Estornos com fundo muito claro e conteúdo praticamente ilegível no tema escuro. Isso impede identificação segura de ações financeiras. A versão do sistema presente na captura não foi disponibilizada como código-fonte atualizado; portanto, o defeito é **visualmente confirmado**, mas o seletor CSS específico responsável **não foi identificado**.

O backup `SafeSaff_BACKUP_GERAL_OFICIAL_20261116.zip` confirma coexistência de tokens semânticos para claro/escuro, uma paleta legada fixa em Tailwind, variantes de botões com cores fixas e CSS próprio para os módulos financeiros. Essa combinação oferece hipóteses técnicas concretas que deverão ser verificadas na compilação atual.

## 2. Evidências e constatações
| ID | Prioridade | Constatação | Evidência e localização | Confiança | Verificação de correção |
|---|---|---|---|---|---|
| UI-001 | **P0** | Ações de linha em Estornos ilegíveis, com fundo branco ou quase branco e texto de contraste insuficiente. | Captura `image(2).png`, bloco **Fila de Aprovações Pendentes**, coluna **Ação**. | Confirmado visualmente | Todos os botões ficam legíveis em claro/escuro, inclusive desabilitados; qualquer ação financeira é identificável. |
| UI-002 | **P0** | Variante `secondary` do botão compartilhado usa fundo branco fixo e texto slate fixo; variantes context e ghost também usam cores fixas. | `src/components/ui/Button.tsx`, objeto `variantClasses`. | Confirmado no backup | Variantes usam tokens semânticos que mudam com tema; testes dos estados. |
| UI-003 | **P1** | O tema global usa tokens HSL, mas mantém cores hexadecimais legadas sem equivalentes claros e escuros. | `src/index.css`, `:root` e `.dark`, bloco compatibilidade legado. | Confirmado no backup | Um catálogo de tokens define valores coerentes em ambos os temas; usos legados são migrados ou explicitamente isolados. |
| UI-004 | **P1** | Tailwind publica uma paleta fixa `brand` junto com tokens semânticos `primary`, `secondary` etc. | `tailwind.config.js`, `theme.extend.colors`. | Confirmado no backup | Código novo usa tokens semânticos, com lint e exceções documentadas. |
| UI-005 | **P1** | Estornos possui múltiplos estilos locais, potencialmente concorrentes com tokens globais. | `src/pages/finance/finance-disputes-control-center.css` e `finance-disputes-hub.css` (ambos no backup). | Confirmado no backup; impacto específico pendente | Mapeamento da cascata e auditoria de todos os componentes afetados. |
| UI-006 | **P1** | Existem classes com fundo branco explícito em uma página de estornos. | `src/pages/finance/FinanceRefundsPage.tsx`, entre outras ocorrências. | Confirmado no backup | Cada área é testada em dark/light e corrigida usando tokens; verificar qual página efetivamente corresponde à rota publicada. |
| UI-007 | **P1** | O `ThemeProvider` já aplica a classe `.dark`, `color-scheme` e `data-theme`; múltiplas estratégias de estilo precisam permanecer sincronizadas. | `src/design-system/providers/ThemeProvider.tsx`. | Confirmado no backup | Alternar Claro/Escuro/Sistema mantém classes, variáveis e componentes consistentes sem recarregar. |
| UI-008 | **P1** | Sem evidência de uma revisão funcional/visual completa da versão implantada. | Captura e materiais disponíveis; execução da versão publicada não acessível. | Lacuna de validação | Executar suíte visual e inspeção manual por rota/estado. |
| UI-009 | **P2** | Componentes e módulos podem usar tokens que representam cores de marca antigas em vez do padrão aprovado grafite/branco/neon. | Valores `--primary` laranja em `src/index.css` e `brand` fixa em Tailwind do backup; design aprovado posterior. | Confirmado no backup, status de publicação desconhecido | Centralizar paleta aprovada; verificar identidade em todas as áreas. |

## 3. O que a captura NÃO prova
- Não prova que o botão branco é gerado pelo componente `Button.tsx`; pode haver CSS de Estornos, estilo de linha, classe utilitária ou regra de estado em conflito.
- Não comprova que todas as rotas estão defeituosas; comprova ao menos um defeito de alto impacto na tela exibida e fragilidade estrutural no backup.
- Não comprova qual CSS está publicado hoje, a ordem final da cascata, nem se alguma ação está funcionalmente desabilitada por regra de negócio.
- Não comprova falha na API ou banco Neon. Esta é uma auditoria de aparência/usabilidade.

## 4. Causa raiz provável e procedimento de comprovação
**Hipótese principal:** estilos fixos (`bg-white`, `text-white`, `text-slate-*`), variantes e seletores específicos se combinam de forma distinta no modo escuro. Ao receber uma classe de texto branco do contexto ou um seletor mais específico, um botão de fundo branco pode ficar ilegível.

Para confirmar: abrir o ambiente publicado em modo escuro; inspecionar o botão **Analisar**; capturar `background-color`, `color`, `opacity`, `filter`, `-webkit-text-fill-color`, classes, cascata vencedora e ancestrais; verificar atributos `disabled`/`aria-disabled`; comparar com a compilação do backup. Repetir para as demais ações da tabela e para estados hover/focus/disabled.

## 5. Gravidade e política de bloqueio
**P0:** qualquer controle necessário para financeiro, estorno, cancelamento, reembolso, SAC ou controle de acesso que fique ilegível em qualquer tema. Bloqueia publicação da reformulação.  
**P1:** contraste abaixo da meta WCAG AA, componentes globais inconsistentes ou layouts com tema parcial. Corrigir antes da liberação ampla.  
**P2:** sombras, ornamentos, ajustes finos e densidade visual que não ocultem informação/ação.

## 6. Escopo da auditoria global
Cobrir shell (sidebar/header/breadcrumb), Dashboard geral, Gestão de Eventos, Ingressos, Vendas/Pedidos, Financeiro (Estornos/Conciliação/Contabilidade), SAC (Dashboard, Chat, Fila, Skills, IA), Relatórios, Usuários/Produtoras, Configurações, telas de autenticação, modais, formulários, tabelas, gráficos e versões responsivas. Esta é a **matriz de cobertura exigida**, não a alegação de que todas essas rotas foram validadas nesta auditoria.

## 7. Evidências de origem
- Captura enviada pelo usuário: `image(2).png`, Estornos em tema escuro, área **Fila de Aprovações Pendentes**.
- Backup: `SafeSaff_BACKUP_GERAL_OFICIAL_20261116.zip`.
- Arquivos diretamente inspecionados: `src/index.css`, `tailwind.config.js`, `src/components/ui/Button.tsx`, `src/design-system/providers/ThemeProvider.tsx`, `src/pages/finance/FinanceRefundsPage.tsx` e folhas CSS de Estornos.

## 8. Veredito
**Não homologar a reformulação visual global na situação apresentada.** Priorizar UI-001 e UI-002, estabelecer o padrão semântico e validar as páginas com uma matriz claro/escuro antes de considerar o trabalho concluído.
