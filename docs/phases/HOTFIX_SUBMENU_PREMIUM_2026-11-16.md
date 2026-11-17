# Hotfix — Submenus Premium (16/11/2026)

## Problema observado
O painel de submenu utilizava duas colunas em uma sidebar estreita. Isso comprimía os rótulos, quebrava palavras e deixava nomes como “Operação Contábil”, “DRE Gerencial” e “Fiscal & Compliance” truncados.

## Correção
- Submenus do menu corporativo e do contexto de evento passam a usar uma coluna vertical.
- Cada opção ocupa toda a largura disponível.
- Ícones mantêm largura fixa e alinhamento consistente.
- Rótulos podem quebrar em duas linhas sem reticências ou corte.
- Badges permanecem alinhados à direita.
- Estados hover e ativo mantêm o padrão premium.
- Ajustes responsivos aplicados também ao drawer mobile.

## Compatibilidade
A correção é exclusivamente CSS. Não altera chaves de navegação, callbacks, rotas, permissões, contratos de estorno ou lógica de seleção de módulos.

## Validação executada
- `npm run check:lucide`: aprovado.
- Build e TypeScript: não executados nesta sessão porque `node_modules` não está instalado. Executar `npm ci`, `npm run typecheck` e `npm run build` antes do deploy.
