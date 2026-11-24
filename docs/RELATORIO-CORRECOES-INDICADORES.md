# OpenCharts — Relatório de correções dos indicadores

## Ambiente

- Base: `22116c426b39e22ce941296a01005eae3b167657`
- Local: worktree isolado; instalação principal preservada.
- Escopo: C01, M01–M11 e L01 de `AUDITORIA-GERAL-INDICADORES.md`.
- Operações externas: nenhum commit, push, merge, deploy, GitHub Actions ou ordem financeira.

## Resultado

| Classificação | Identificados | Corrigidos | Pendentes de código |
|---|---:|---:|---:|
| Críticos | 1 | 1 | 0 |
| Médios | 11 | 11 | 0 |
| Leves | 1 | 1 | 0 |

Dois erros TypeScript adicionais, ocultos anteriormente pelo C01, também foram corrigidos em `useIndicators.ts`: largura incompatível com Lightweight Charts 4 e uso de cores não pertencentes a `PaneColors`.

## Correções por identificador

| ID | Causa raiz | Correção | Arquivos principais | Teste/resultado | Status |
|---|---|---|---|---|---|
| C01 | Fragmentos corrompidos no estado do menu | Restauradas as declarações de estado e preferências do template | `ChartTemplatesMenu.tsx` | Typecheck e build aprovados | Corrigido e testado |
| M01 | Chave HTF não considerava `maxBars` | Limite incluído na identidade do cache; teste de troca de limite | `session-history.ts`, `indicator-session-history.test.ts` | Teste direcionado aprovado | Corrigido e testado |
| M02 | Biblioteca e histórico persistidos separadamente | Persistência agrupada em uma única operação IndexedDB | `database.ts`, `storage.ts` | Suíte SDK e completa aprovadas; falha real de navegador pendente | Corrigido, aguardando validação integral |
| M03 | Remoção não limpava revisões | Desinstalação remove definição e histórico de forma coordenada | `storage.ts` | Suíte SDK aprovada | Corrigido e testado |
| M04 | Fachada descartava `accountId` | `accountId` encaminhado para sessão e início do replay | `services/api.ts` | Typecheck e suíte completa aprovados | Corrigido, aguardando smoke de replay |
| M05 | Datas sem sufixo UTC | Limites da sessão construídos em UTC | `services/replay.ts`, `features.test.ts` | Teste direcionado aprovado | Corrigido e testado |
| M06 | Fetch sem prazo/cancelamento | Timeout de 15 s por tentativa, abort e limpeza do inflight | `hyperliquid/info.ts`, `info.test.ts` | Teste de timeout aprovado | Corrigido e testado |
| M07 | Storage ocultava exceções | Falhas agora são propagadas ao chamador | `services/api.ts`, `drawing-persistence.test.ts` | Teste de rejeição aprovado | Corrigido e testado |
| M08 | Read-modify-write concorrente | Fila serial de mutações de desenhos | `services/api.ts`, `drawing-persistence.test.ts` | Teste concorrente aprovado | Corrigido e testado |
| M09 | Remoção limitada ao catálogo atual | Busca usa união do catálogo com índice persistido | `services/api.ts`, `drawing-persistence.test.ts` | Símbolo apenas no índice coberto | Corrigido e testado |
| M10 | Restore completo fazia merge | Templates e desenhos são substituídos com rollback compensatório | `services/api.ts`, `chart-templates.ts`, `drawing-persistence.test.ts` | Testes de snapshot/rollback aprovados | Corrigido, aguardando validação integral |
| M11 | Teste dependia de texto inglês | Contrato de erro alinhado sem reduzir validação de cobertura | `session-history.ts`, `indicator-session-history.test.ts` | Teste aprovado | Corrigido e testado |
| L01 | Escape redundante no tokenizador | Regex corrigida sem alterar a gramática | `expression.ts` | ESLint e testes aprovados | Corrigido e testado |

## Arquivos alterados

- `src/pages/trading/ChartTemplatesMenu.tsx`
- `src/pages/trading/useIndicators.ts`
- `src/lib/indicator-sdk/database.ts`
- `src/lib/indicator-sdk/storage.ts`
- `src/lib/indicator-sdk/session-history.ts`
- `src/lib/indicator-sdk/expression.ts`
- `src/services/api.ts`
- `src/services/api/chart-templates.ts`
- `src/services/replay.ts`
- `src/hyperliquid/info.ts`
- `src/__tests__/features.test.ts`
- `src/__tests__/indicator-session-history.test.ts`
- `src/__tests__/drawing-persistence.test.ts`
- `src/hyperliquid/__tests__/info.test.ts`
- `docs/AUDITORIA-GERAL-INDICADORES.md`
- `docs/RELATORIO-CORRECOES-INDICADORES.md`

## Validação executada

| Verificação | Resultado |
|---|---|
| Testes direcionados SDK | 11/11 aprovados |
| Testes direcionados persistência | 5/5 aprovados |
| Testes direcionados replay/REST | 29/29 aprovados |
| `npm.cmd run typecheck` | Aprovado |
| `npm.cmd run lint` | Aprovado, sem erros ou warnings |
| `npm.cmd test` | 77 arquivos aprovados, 1 ignorado; 870 testes aprovados, 1 ignorado |
| `npm.cmd run build` | Aprovado; 3.678 módulos transformados |
| `npm.cmd run check:size` | Aprovado; 1.081,6 KB bruto e 317,6 KB gzip, dentro do orçamento |
| `git diff --check` | Aprovado |

Warnings não bloqueantes do build permanecem: comentários `@__PURE__` do Zod/Rollup, importação simultaneamente estática e dinâmica de `TradingViewWidgets.tsx` e chunk principal acima de 500 KB. Não foram alterados por estarem fora dos identificadores da auditoria.

## Revisão final

- Nenhuma função existente foi removida ou substituída por implementação paralela.
- `xyz:GOLD` continua identificado como perpétuo HIP-3.
- Nenhuma regra de criação de candles foi adicionada.
- Os cortes temporais de replay/HTF permanecem restritos ao cursor.
- O importador continua declarativo e não executa TypeScript arbitrário.
- Backups anteriores continuam aceitos; a restauração completa agora substitui o snapshot e mantém rollback compensatório para stores externos.

## Pendências para a próxima etapa

- Executar matriz manual de `docs/indicator-validation.md` em navegador.
- Validar reinicialização/hidratação IndexedDB e falhas reais de quota/storage.
- Validar visualmente gráfico único/duplo, panes, HTF/DST, previews, temas, responsividade e acessibilidade.
- Executar E2E seguro, sem ordens reais, conforme o Prompt 03.
- Atualizar a instalação principal somente após essa validação e autorização específica.
