# OpenCharts — Validação final dos indicadores

## Identificação

- Data: 24/11/2026
- Branch: `feat/xauusd-market-audit`
- Diretório oficial: `D:\TRADING\OpenCharts`
- Versão oficial anterior: `2287877915ca94079a3a7e04ce02a20c2b0ca614`
- Commit remoto inicial: `22116c426b39e22ce941296a01005eae3b167657`
- Commit de código validado: `c93504fac4d49379684113301b8038ae0295db1d`
- Backup: `C:\Users\InfoHouse\Documents\Codex\2026-11-24\https-github-com-cairobernardescosta-crypto-openchartstrade\work\backups\OpenCharts-before-validation-20261124`
- Atalho: `D:\Dados\Desktop\OpenCharts.lnk`

O commit final da branch inclui este relatório e a permissão das duas versões de `esbuild`; a equivalência local/remota deve ser confirmada por `git rev-parse HEAD` após o push.

## Correções

| Classificação | Corrigidos | Críticos conhecidos restantes |
|---|---:|---:|
| Críticos | 1 | 0 |
| Médios | 11 | 0 |
| Leves | 1 | 0 |

Também foram corrigidos dois erros TypeScript revelados após C01, atomicidade/rollback encontrados na revisão final e a configuração de declarações da distribuição da biblioteca.

## Proteção e atualização

- Bundle Git completo verificado.
- Patch da árvore de trabalho e cópia do `package.json` anterior preservados.
- Arquivos `.env` da raiz foram copiados para o backup quando presentes.
- Nenhum segredo, carteira, backup pessoal ou dado financeiro foi incluído no diff.
- A alteração local `allowScripts` foi integrada; `esbuild@0.25.12` e `esbuild@0.28.2` foram declarados.
- A instalação oficial foi atualizada por fast-forward, sem mover o diretório.

## Validação automatizada

| Comando | Resultado real |
|---|---|
| `npm.cmd ci` | Aprovado; 430 pacotes, 0 vulnerabilidades. |
| `npm.cmd run typecheck` | Aprovado. |
| `npm.cmd run lint` | Exit code 0; 8 warnings conhecidos, 0 erros. |
| `npm.cmd test` | 77 arquivos aprovados, 1 ignorado; 870 testes aprovados, 1 ignorado. |
| `npm.cmd run build` | Aprovado; 3.678 módulos transformados. |
| `npm.cmd run check:size` | Aprovado; 1.082,0 KB bruto e 317,8 KB gzip. |
| `npm.cmd run build:lib` | Aprovado após excluir testes internos da geração de declarações. |
| `npm.cmd run check:package` | Aprovado; 5 exports, dependências externas e core sem dados demo. |
| `npm.cmd run e2e:hl -- --workers=1` | 21/21 aprovados em 2,4 minutos. |
| `git diff --check` | Aprovado. |

A execução E2E paralela teve 2 falhas intermitentes no onboarding falso; os dois cenários passaram isoladamente e a suíte completa serial passou. A infraestrutura E2E bloqueia rede externa e utiliza carteira/exchange falsos, portanto nenhuma ordem real foi enviada.

## Validação funcional

- A aplicação foi iniciada e respondeu HTTP 200.
- Chromium renderizou o terminal, gráfico com candles, volume, bid/ask, timeframes, replay, alternância de layout, toolbar e painéis sem tela de erro.
- Os 21 cenários E2E cobriram compliance, termos, taxas, onboarding, carteira falsa, mercados, candles, ticks, ordens falsas, TP/SL, reduce-only e bloqueio de ordem abaixo do mínimo.
- A suíte unitária cobriu importação, instalação, edição, remoção, revisões, parâmetros, expressões, panes, HTF, histórico independente, replay, objetos gráficos, cache, Worker, persistência, backups, templates e desenhos.
- A persistência foi validada por testes de falha, concorrência, substituição de snapshot e rollback. A restauração destrutiva de dados reais do usuário não foi executada.

## Hyperliquid

O smoke test somente leitura terminou com exit code 0:

- 354 mercados recebidos.
- `xyz:GOLD` identificado como Gold/Commodities, perpétuo HIP-3.
- DEX `xyz`, asset ID `110003`.
- Cinco candles reais de 1 hora recebidos.
- Cotação bid/ask recebida.
- Nenhuma ordem financeira enviada.

## Instalação e atalho

- Instalação oficial: `D:\TRADING\OpenCharts`.
- Build oficial aprovado após `npm.cmd ci`.
- Inicializador: `scripts/start-opencharts.ps1`.
- O inicializador reutiliza servidor existente ou inicia Vite oculto, aguarda HTTP e abre o Chrome em modo app; falhas exibem mensagem e log local.
- Atalho `OpenCharts.lnk` criado na Área de Trabalho real com a logo oficial em `public/icons/opencharts.ico`.
- Alvo, argumentos, diretório de trabalho e ícone foram relidos e confirmados.
- Inicializador testado: servidor oficial respondeu HTTP 200 com título `OpenCharts — Open-Source Trading Terminal`.

## Pendências e limitações

- Permanecem 8 warnings ESLint já conhecidos, sem erro de lint.
- O build alerta sobre chunks acima de 500 KB e importações simultaneamente estáticas/dinâmicas.
- Rollup remove comentários `@__PURE__` do Zod que não consegue interpretar; build permanece aprovado.
- O E2E paralelo possui instabilidade de concorrência no onboarding falso; a execução serial é integralmente verde.
- Não foram feitos merge com `main`, deploy ou GitHub Actions.

## Conclusão

Os critérios obrigatórios de código, build, testes, inicialização, integração de mercado, preservação e atalho foram atendidos. A equivalência entre a instalação oficial e o GitHub deve ser registrada após o push final da branch, comparando os hashes local e remoto.
