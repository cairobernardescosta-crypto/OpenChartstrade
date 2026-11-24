# OpenCharts — Auditoria geral de código e funcionalidades

> Atualização de correção: C01, M01–M11 e L01 foram tratados no worktree isolado. Typecheck, lint, 869 testes, build e orçamento de bundle passaram. A validação manual/E2E permanece para a etapa integral seguinte. Consulte `RELATORIO-CORRECOES-INDICADORES.md`.

## 1. Escopo e ambiente

- Branch auditada: `feat/xauusd-market-audit`
- Commit remoto auditado: `22116c426b39e22ce941296a01005eae3b167657`
- Ambiente: worktree isolado; checkout local de uso não foi atualizado.
- Estado local de uso: HEAD `2287877`, 47 commits atrás do remoto e `package.json` modificado.
- Método: inspeção estática direcionada, documentação consolidada e verificações locais.
- Restrições respeitadas: nenhuma correção, ordem, ação GitHub, merge, push ou deploy.

## 2. Resumo

O commit auditado possui **1 problema crítico, 11 médios e 1 leve**. A falha crítica impede typecheck e build. A suíte unitária também contém uma divergência entre contrato e implementação. As proteções centrais do SDK, do Worker, do replay de indicadores e do mercado `xyz:GOLD` estão presentes, mas a matriz manual permanece pendente e não permite certificar a interface, persistência em navegador, HTF/DST e restauração completa.

| Classe | Quantidade |
|---|---:|
| Crítico | 1 |
| Médio | 11 |
| Leve | 1 |

## 3. Problemas encontrados

### C01 — Arquivo de templates corrompido

- Classificação: Crítico
- Funcionalidade: templates de gráfico, compilação e inicialização.
- Arquivo: `src/pages/trading/ChartTemplatesMenu.tsx:251-254`
- Evidência: existem fragmentos inválidos `useS  const...` e `ilable */}}};`; typecheck retorna cinco erros sintáticos e o build falha no mesmo ponto.
- Causa raiz: conteúdo truncado/mesclado incorretamente no componente.
- Impacto: a branch não compila nem produz aplicação distribuível.
- Correção recomendada: reconstruir apenas as declarações corrompidas com base no contrato do componente e no histórico Git.
- Dependências: preferências do gráfico, templates e autosave.
- Critério de aprovação: typecheck e build com exit code 0, testes do menu e smoke test de salvar/carregar template.

### M01 — Cache HTF ignora limite administrativo

- Arquivos: `src/lib/indicator-sdk/session-history.ts:15-23`, `src/pages/trading/useIndicators.ts:373`
- Evidência: a chave interna não contém `maxBars`, embora o chamador o use na chave externa.
- Impacto: após reduzir o limite, dados calculados com orçamento anterior podem ser reutilizados por até 15 s.
- Correção: incluir `maxBars`/plano completo na chave ou invalidar o cache.
- Dependências: histórico HTF, administração e cache de sessão.
- Aprovação: teste 20.000→100 confirma que nenhuma resposta excede 100 barras.

### M02 — Atualização global não é atomicamente persistida

- Arquivos: `src/lib/indicator-sdk/storage.ts:19`, `src/lib/indicator-sdk/database.ts:30`
- Evidência: histórico e biblioteca são gravados em chamadas/transações separadas.
- Impacto: falha entre gravações deixa definição e revisão divergentes.
- Correção: transação multi-chave e publicação do estado apenas após sucesso.
- Aprovação: falha injetada entre seções não deixa estado parcial.

### M03 — Desinstalação mantém histórico órfão

- Arquivos: `src/lib/indicator-sdk/storage.ts:20,26`, `src/pages/trading/indicators/IndicatorLibraryMenu.tsx:102`
- Evidência: remove a biblioteca e overrides, mas não o histórico exportável.
- Impacto: revisões antigas podem reaparecer ao reinstalar o mesmo ID e ocupar backup.
- Correção: definir política e apagar atomicamente o histórico, ou expor retenção/limpeza claramente.
- Aprovação: exportação pós-desinstalação não contém o ID, salvo retenção explicitamente escolhida.

### M04 — Replay omite eventos de negociação da conta

- Arquivos: `src/services/api.ts:347-350`, `src/services/replay.ts:71-75,103-120`
- Evidência: a fachada chama `getSession`/`start` sem `accountId`; posições fechadas só são consultadas quando ele existe.
- Impacto: marcadores de saída não aparecem pelo fluxo real da API.
- Correção: encaminhar `accountId` nas duas chamadas.
- Aprovação: teste da fachada comprova consulta da conta e `tradeEvents` preenchido.

### M05 — Limites de replay dependem do fuso local

- Arquivo: `src/services/replay.ts:66-68`
- Evidência: `new Date("YYYY-MM-DDT00:00:00")` usa fuso local enquanto candles usam epoch/UTC.
- Impacto: sessão deslocada e dias de 23/25 h em mudanças de DST.
- Correção: usar UTC explícito ou timezone de mercado definido.
- Aprovação: limites idênticos em fusos diferentes e testes de DST.

### M06 — REST Hyperliquid sem timeout/cancelamento

- Arquivo: `src/hyperliquid/info.ts:170-183,233-267`
- Evidência: chamadas `fetch` e promessas deduplicadas não recebem `AbortSignal` nem prazo.
- Impacto: símbolos, cotações, histórico ou replay podem ficar presos; requisições obsoletas continuam ativas.
- Correção: `AbortController`, timeout e limpeza garantida do mapa inflight.
- Aprovação: fetch pendente rejeita no prazo e a deduplicação é liberada.

### M07 — Falhas de persistência de desenhos são mascaradas

- Arquivo: `src/services/api.ts:73-81,95-118`
- Evidência: erros do storage são engolidos e save/remove/clear podem aparentar sucesso.
- Impacto: perda silenciosa de desenhos após recarregar e rollback/diagnóstico inviável.
- Correção: propagar erro ou retornar resultado explícito com feedback.
- Aprovação: rejeição de `storage.set` torna a operação visivelmente falha.

### M08 — Concorrência pode perder desenhos

- Arquivo: `src/services/api.ts:95-100`
- Evidência: read-modify-write sem fila/transação por símbolo e índice.
- Impacto: dois saves simultâneos podem sobrescrever um ao outro.
- Correção: serialização por símbolo ou operação atômica no storage.
- Aprovação: `Promise.all` de dois saves preserva ambos.

### M09 — Remoção ignora símbolos fora do catálogo atual

- Arquivo: `src/services/api.ts:87,99,102-115`
- Evidência: remoção percorre `getSymbols()`, apesar de existir `DRAW_INDEX`.
- Impacto: desenho de ativo removido/indisponível pode permanecer e ressurgir.
- Correção: usar união do catálogo com o índice persistido.
- Aprovação: desenho de símbolo existente apenas no índice é removido.

### M10 — Backup completo restaura por mesclagem

- Arquivos: `src/services/api.ts:90`, `src/services/api/chart-templates.ts:40`
- Evidência: desenhos são mesclados por ID e templates por nome; itens posteriores ausentes no backup são preservados.
- Impacto: restauração não reproduz o snapshot chamado de completo.
- Correção: separar claramente modos substituir/mesclar e tornar substituição transacional quando escolhida.
- Aprovação: modo completo resulta em estado equivalente ao backup; modo mesclar é explicitamente identificado.

### M11 — Teste e mensagem de histórico divergem

- Arquivos: `src/__tests__/indicator-session-history.test.ts:6`, `src/lib/indicator-sdk/session-history.ts:31`
- Evidência: o teste espera `Incomplete`; a implementação retorna mensagem em português. Resultado: 1 teste falho.
- Impacto: suíte bloqueada e contrato de erro inconsistente.
- Correção: decidir contrato estável (código de erro preferível) e alinhar teste/UI.
- Aprovação: teste passa sem enfraquecer a validação de cobertura incompleta.

### L01 — Regra ESLint violada

- Arquivo: `src/lib/indicator-sdk/expression.ts:10`
- Evidência: `no-useless-escape` reporta escape desnecessário.
- Impacto: lint permanece vermelho; sem impacto funcional comprovado.
- Correção: remover apenas o escape redundante preservando o tokenizador.
- Aprovação: lint e testes de expressões com exit code 0.

## 4. Funcionalidades aprovadas por inspeção/teste

- Importador declarativo: esquema limitado, tamanho máximo e ausência de execução arbitrária (`schema.ts`, `expression.ts`).
- Objetos gráficos: tipos e IDs validados; replay bloqueia coordenadas futuras (`graphics.ts`, `graphic-renderer.ts:14`).
- Worker: máximo de 20.000 candles, fila de 4, timeout de 2 s e limpeza das pendências (`worker-client.ts:8-12`).
- HTF: timezone IANA/DST e rejeição de horário civil inexistente (`session.ts:11-23`); cobertura incompleta não fabrica OHLC (`session-history.ts:25-31`).
- Revisões: limite de 20 e ordenação por data (`revisions.ts:5-7`).
- Backup: v1/v2 validado antes de mutações e rollback compensatório implementado (`backup.ts:11-26`).
- Mercado: `xyz:GOLD` preservado como perpétuo HIP-3/commodity, com asset ID derivado do DEX (`symbols.ts:126-147,189-218`; teste de integração `gold.integration.test.ts:66-139`).
- Histórico Hyperliquid: corte temporal estrito e ausência de candles fabricados (`marketData.ts:324-380`).
- Caches de candles: separados por símbolo, timeframe, limite e versão de replay (`queries.ts:127-154`).
- WebSocket: subscriptions, mapas e ticks limpos no disconnect (`marketData.ts:466-474`).

Essas aprovações são de contrato/inspeção e testes automatizados disponíveis; não substituem a validação visual/manual.

## 5. Parcialmente implementado ou limitado

- Backup de workspace não inclui desenhos secundários ainda não persistidos e pode ter rollback incompleto fora do IndexedDB.
- Calendário automático é recorrente e não representa feriados, fechamentos excepcionais ou manutenção.
- Restauração completa atualmente tem semântica de mesclagem.
- Atomicidade existe para estados do SDK na restauração, não para todos os stores externos.
- Diagnóstico de memória é estimativa, não heap medido nem quota rígida.

## 6. Pendente de validação

Conforme `docs/indicator-validation.md:3,24-35`, continuam pendentes em navegador: importação/edição completa, independência entre gráficos, panes e sincronização visual, HTF/DST/sessões noturnas, replay por retrocesso, troca rápida de símbolo, previews dos oito objetos, hidratação/reinicialização, concorrência entre abas, backups legados/rollback, acessibilidade, responsividade e temas. E2E não foi executado para evitar qualquer risco de operação financeira e por não constar na lista automatizada obrigatória desta auditoria.

## 7. Verificações automatizadas

| Comando | Resultado |
|---|---|
| `npm.cmd ci` | Aprovado; 430 pacotes, 0 vulnerabilidades; alerta de script `esbuild` não coberto por `allowScripts`. |
| `npm.cmd run typecheck` | Falhou: 5 erros sintáticos em `ChartTemplatesMenu.tsx`. |
| `npm.cmd run lint` | Falhou: 2 erros e 8 warnings. Erros em `expression.ts:10` e parsing de `ChartTemplatesMenu.tsx:251`. |
| `npm.cmd test` | Falhou: 75 arquivos passaram, 1 falhou, 1 ignorado; 861 testes passaram, 1 falhou, 1 ignorado. |
| `npm.cmd run build` | Falhou após 1.909 módulos pela corrupção em `ChartTemplatesMenu.tsx:251`. |
| `npm.cmd run check:size` | Falhou porque o build não produziu `dist/index.html`. |

Warnings observados, ainda sem regressão funcional comprovada: `ComplianceGate.tsx:49`, `TradingPage.tsx:120,171,181,219`, `chartData.ts:70`, `IndicatorBackupPanel.tsx:11` e `useIndicators.ts:389`.

## 8. Fases de correção e critérios

1. **Restaurar compilação** — corrigir C01. Aprovação: typecheck, lint e build verdes.
2. **Restaurar contratos automatizados** — corrigir M11 e L01. Aprovação: toda suíte unitária e lint verdes.
3. **Integridade de dados** — M02, M03, M07, M08, M09 e M10. Aprovação: testes de falha, concorrência, atomicidade e equivalência de backup.
4. **Replay e mercado** — M04, M05 e M06. Aprovação: testes por conta, timezone/DST, timeout e cancelamento.
5. **HTF e limites** — M01. Aprovação: testes de invalidação do cache e limites administrativos.
6. **Validação manual isolada** — executar integralmente `docs/indicator-validation.md`. Aprovação: matriz preenchida com evidências reais, incluindo dois gráficos, replay, persistência, responsividade e acessibilidade.
7. **Regressão final** — repetir typecheck, lint, testes, build, size e E2E seguro sem ordens reais.

## 9. Conclusão

O commit `22116c4` não está apto para entrega porque não compila e contém riscos de integridade em persistência, backup e replay. As bases de segurança do SDK e a identificação correta de `xyz:GOLD` foram confirmadas. A prioridade objetiva é remover o bloqueio sintático antes de validar ou corrigir as demais fases.
