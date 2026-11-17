# Central de Documentação — DiskIngressos Enterprise (SafeSaff)

Bem-vindo à central de documentação e engenharia da plataforma **DiskIngressos Enterprise (SafeSaff)**. Este diretório consolida especificações de arquitetura, Design System 2.0, contratos de dados, relatórios de homologação e histórico de evolução do sistema.

---

## 📁 Estrutura de Diretórios

```text
safesaff/
├── contracts/                 # Contratos canônicos JSON de APIs e Dashboard
├── config/                    # Políticas de CI/CD, ambientes e proteção de módulos
├── docs/
│   ├── architecture/          # Decisões de arquitetura, Design System 2.0, SAC IA e banco Neon
│   ├── phases/                # Especificações detalhadas das fases de engenharia (Fases 10 a 30)
│   │   └── manifests/         # Manifestos JSON das fases de release
│   ├── prompts/               # Prompts e diretrizes operacionais de execução
│   ├── reports/               # Relatórios executivos, auditorias corretivas e homologação
│   └── README.md              # Índice central da documentação
├── prisma/                    # Schemas Prisma (SQLite local e PostgreSQL Neon)
├── scripts/                   # Scripts de verificação, gates de CI e deploy guard
├── server/                    # API Backend Express/TypeScript
├── src/                       # Aplicação Frontend React + Vite + Design System 2.0
└── tests/                     # Suítes de testes E2E (Playwright) e contratos unitários
```

---

## 🏛️ 1. Arquitetura & Design System (`docs/architecture/`)

- [**02_PLANO_TECNICO_CORRECAO_GLOBAL.md**](./architecture/02_PLANO_TECNICO_CORRECAO_GLOBAL.md): Plano técnico do Design System Global e padronização de temas Claro/Escuro.
- [**DESIGN_SYSTEM_GLOBAL_V1.md**](./architecture/DESIGN_SYSTEM_GLOBAL_V1.md): Especificação da paleta aprovada (Grafite, Branco, Azul Elétrico, Violeta, Ciano e Laranja).
- [**DESIGN_SYSTEM_MIGRATION_MAP.md**](./architecture/DESIGN_SYSTEM_MIGRATION_MAP.md): Mapa de migração dos componentes compartilhados.
- [**ARQUITETURA_DASHBOARD_SAC_IA.md**](./architecture/ARQUITETURA_DASHBOARD_SAC_IA.md): Arquitetura do Dashboard SAC, Copiloto IA e Assistente Virtual N1.
- [**ARQUITETURA-CHAT-INTERNO-ERP-HELPDESK.md**](./architecture/ARQUITETURA-CHAT-INTERNO-ERP-HELPDESK.md): Arquitetura do Chat SAC em tempo real com distribuição automática e limite de 3 conversas.
- [**ARQUITETURA-NOVA-NAVEGACAO-PREMIUM-MEGA.md**](./architecture/ARQUITETURA-NOVA-NAVEGACAO-PREMIUM-MEGA.md): Arquitetura da Sidebar Corporativa e de Evento em formato Mega-Menu.
- [**PLANO_EXPANSAO_NEON_SAC_IA.md**](./architecture/PLANO_EXPANSAO_NEON_SAC_IA.md) & [**MODELO_DE_DADOS_PROPOSTO.md**](./architecture/MODELO_DE_DADOS_PROPOSTO.md): Modelagem de dados PostgreSQL/Neon para SAC e IA.
- [**BACKEND_ARCHITECTURE.md**](./architecture/BACKEND_ARCHITECTURE.md) & [**SECURITY_ARCHITECTURE.md**](./architecture/SECURITY_ARCHITECTURE.md): Arquitetura de API, RBAC e isolamento multi-tenant.
- [**DEPLOY_CHECKLIST.md**](./architecture/DEPLOY_CHECKLIST.md) & [**BUILD_REQUIRED.md**](./architecture/BUILD_REQUIRED.md): Requisitos de compilação e publicação na Vercel.

---

## 📋 2. Fases de Engenharia (`docs/phases/`)

- [**03_FASE30_DESIGN_SYSTEM_2_0_RESPONSIVIDADE_E_HOMOLOGACAO.md**](./phases/03_FASE30_DESIGN_SYSTEM_2_0_RESPONSIVIDADE_E_HOMOLOGACAO.md): Homologação da Fase 30 (Design System 2.0, Responsividade Mobile/Tablet/Desktop e Checklist 12/12).
- [**CHAT_SAC_IMPLEMENTACAO.md**](./phases/CHAT_SAC_IMPLEMENTACAO.md) & [**IMPLEMENTACAO_COPILOTO_SAC.md**](./phases/IMPLEMENTACAO_COPILOTO_SAC.md): Implementação operacional da Central SAC — Chat e Copiloto IA.
- [**HOTFIX_SUBMENU_PREMIUM_2026-11-16.md**](./phases/HOTFIX_SUBMENU_PREMIUM_2026-11-16.md): Refinamento dos submenus de 1 coluna na barra lateral.
- [**INTEGRACAO_FASE_26_17_7_1.md**](./phases/INTEGRACAO_FASE_26_17_7_1.md) & [**README_IMPLANTACAO.md**](./phases/README_IMPLANTACAO.md): Guias de integração e implantação.
- Histórico completo das Fases 10 a 29 e subpasta `manifests/`.

---

## 📊 3. Relatórios & Auditorias (`docs/reports/`)

- [**01_RELATORIO_DEFEITOS_UI_TEMAS.md**](./reports/01_RELATORIO_DEFEITOS_UI_TEMAS.md): Auditoria corretiva de interface e contraste Claro/Escuro (UI-001 a UI-009).
- [**RELATORIO_AUDITORIA_CORRETIVA_SAC_20261116.md**](./reports/RELATORIO_AUDITORIA_CORRETIVA_SAC_20261116.md): Auditoria corretiva dos 16 itens (`VIS-01..05` e `COD-01..11`) do SAC Dashboard e Chat.
- Relatórios de homologação e matrizes de regressão das Fases 21 a 29.
