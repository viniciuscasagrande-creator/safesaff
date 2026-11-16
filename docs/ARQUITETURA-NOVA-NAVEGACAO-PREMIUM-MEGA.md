# SafeSaff — Arquitetura de Navegação Premium Mega

**Versão:** 1.0  
**Base:** backup oficial de 16/11/2026  
**Escopo:** navegação corporativa + navegação contextual de eventos.

## Diretrizes

- Identidade visual premium, com painéis discretos, hierarquia tipográfica e estados ativos claros.
- Mega painéis em duas colunas no desktop e uma coluna em telas pequenas.
- A navegação permanece dentro do shell atual para respeitar o layout Limitless e o drawer mobile.
- Nenhuma rota, chave `PageKey`, regra de permissão ou callback de navegação é renomeado nesta entrega.
- Os identificadores `data-testid` existentes dos itens e seções são mantidos.

## Menu corporativo

1. **Dashboard** — acesso direto ao dashboard de perfil.
2. **Gestão de Eventos** — Todos os Eventos, Comercial, Novo Evento, Configurar Lotes e Participantes.
3. **Vendas e Atendimento** — Pedidos & Vendas, Suporte a Eventos, Terminais POS, Status Faciais e Atendimento/SAC.
4. **Operações e Tecnologia** — Núcleo Operacional e Central do Desenvolvedor.
5. **Financeiro** — hubs financeiros, contas, tesouraria, compras/fornecedores, controladoria, plano de contas, conciliação e relatórios.
6. **Estornos** — item independente, preservando contrato de navegação protegido.
7. **Contabilidade** — visão geral, operação contábil, DRE, demonstrações, fiscal/compliance e relatórios.
8. **Marketing** — dashboard, campanhas, campanhas prontas, status real, Meta Ads, GA4, TikTok Ads, Spotify Ads, WhatsApp, e-mail, automações, cupons, UTM, afiliados, pixels, atribuição e relatórios.
9. **Remarketing** — hub, dashboard, carrinhos, fluxos, WhatsApp, e-mail e recuperação de pagamentos.
10. **Administração e Segurança** — central administrativa, usuários, produtoras, permissões, auditoria e segurança; exibido conforme `canAdmin`.

O acesso a **Novo Evento** mantém a regra existente por perfil de usuário. O menu de Administração continua condicionado a `canAdmin`.

## Menu contextual de evento

- **Visão Geral e Operações:** Cockpit, Dashboard, Live Operations, Incident Center, Readiness, Event Day Command e Platform NOC.
- **Gestão e Inteligência:** inventário, consulta de clientes, Revenue Intelligence, busca global, Disk Intelligence, Forecast, Executive Dashboard e relatórios.
- **Vendas e Participantes:** consulta de ingresso e cortesias.
- **Marketing e Aquisição:** Pixel, UTM, GA4, tráfego, Meta Ads e Remarketing.
- **Financeiro do Evento:** borderô, custos/orçamento e divisão de receitas.
- **Configurações e Governança:** usuários, logs, permissões, Permission Engine, compliance, detalhes e condições comerciais.
- **Atalhos Operacionais:** lotes, participantes e núcleo operacional, preservando a condição de administração.

O seletor de evento e o retorno a Todos os Eventos permanecem no topo do contexto.

## Arquivos alterados

- `src/components/ModuleSidebar.tsx` — agrupamento corporativo e painéis mega.
- `src/components/EventContextSidebar.tsx` — agrupamento contextual por responsabilidade.
- `src/styles/sidebar-enterprise.css` — camada visual premium inicial.
- `src/styles/safesaff-premium-mega-nav.css` — overrides carregados após o shell Limitless para compatibilidade de layout.
- `src/main.tsx` — importação da camada visual final.

## Contratos preservados e verificações

- `AppSidebar` continua alternando entre menu corporativo e menu de evento pelo escopo SafeSaff.
- `PageKey`, `ModuleKey`, callbacks `onNavigate`, `onHome` e `onBack` não foram removidos nem renomeados.
- `canAdmin` e a regra de perfil para Novo Evento continuam aplicadas.
- Estornos permanece item independente e com o mesmo destino canônico.
- Testes estáticos executados: `audit-navigation-contracts.mjs`, `verify-protected-navigation.mjs` e `audit-button-contracts.mjs`.
- Typecheck/build E2E não foram concluídos nesta sessão porque o pacote de dependências não estava instalado e `npm ci` excedeu o tempo disponível. Executar `npm ci`, `npm run typecheck`, `npm run build` e os testes de navegação/responsividade antes do deploy.

## Próxima validação recomendada

Homologar em desktop, tablet e celular: abertura dos painéis, rolagem da sidebar, destaque da rota ativa, navegação com permissões diferentes, troca de evento e retorno ao menu corporativo.
