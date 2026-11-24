# OpenCharts — Guia consolidado do SDK de indicadores 1

> Estado: implementação acumulada na branch `feat/xauusd-market-audit`. A compilação, os testes e a validação visual desta rodada ainda estão pendentes no ambiente local. Este guia descreve o código implementado, não uma certificação de funcionamento.

## Índice

- [Importação e segurança](#importação-e-segurança)
- [Biblioteca e edição](#biblioteca-e-edição)
- [Histórico e sessões HTF](#histórico-e-sessões-htf)
- [Objetos gráficos e prévias](#objetos-gráficos-e-prévias)
- [Painéis, templates e aparência](#painéis-templates-e-aparência)
- [Administração e desempenho](#administração-e-desempenho)
- [Persistência, revisões e backups](#persistência-revisões-e-backups)
- [Limitações e validação](#limitações-e-validação)

## Importação e segurança

Abra Indicadores → Importar indicador (.ts). O arquivo deve conter exclusivamente `export default` seguido de um objeto JSON válido, com ponto e vírgula opcional. Limite de entrada: 64 KiB conforme as verificações do importador. Nenhum TypeScript arbitrário é executado.

```ts
export default {
  "sdk": 1,
  "id": "typical-price",
  "name": "Preço típico",
  "version": "1.0.0",
  "kind": "expression",
  "expression": "(high+low+close)/3"
};
```

Tipos: `sma`, `ema`, `expression`, `session-candle`, `graphics`. Consulte [schema.ts](../src/lib/indicator-sdk/schema.ts) para o contrato completo e os valores padrão. Os identificadores internos permanecem em inglês.

Expressões: campos open, high, low, close, volume; operadores +, -, *, /, %, parênteses; funções abs, sqrt, log, exp, floor, ceil, round, sin, cos, tan, sign, log10. Até 20 parâmetros numéricos com prefixo p_. Limites do interpretador: 512 caracteres, 128 tokens e profundidade controlada de 32. Resultados não finitos não são desenhados. Não há acesso a propriedades arbitrárias, imports, rede, carteira ou armazenamento a partir da fórmula.

## Biblioteca e edição

Importar → visualizar prévia → instalar → ativar no gráfico. Busca, categorias, favoritos e filtros ativos/inativos. O menu de ações reúne duplicação, edição, código normalizado, exportação .ts, revisões, restauração e desinstalação.

- Global: modifica a definição instalada. Personalizações compatíveis têm prioridade; alteração de versão pode tornar uma personalização inativa.
- Individual: grava exclusivamente a personalização do gráfico principal ou secundário escolhido; o destino é fixado ao abrir o editor. Restaurar padrão remove apenas essa personalização.
- A biblioteca suporta até 100 definições; cada gráfico suporta até 100 personalizações armazenadas. Limites de indicadores ativos são configuráveis separadamente na administração.

## Histórico e sessões HTF

Matemática: linha, área e histograma. Agregações de 15, 30, 60, 120, 240, 360, 720, 1440, 10080 e 43200 minutos, além do período do gráfico (0). Semana inicia na segunda-feira e mês civil tem duração variável. Valores derivados completos são disponibilizados no fechamento correspondente.

Histórico independente: usa API de mercado somente para leitura, corte exclusivo em milissegundos, até 5.000 velas por consulta matemática, seis períodos distintos por gráfico e cache de 16 entradas com atualização ao vivo a cada 30 segundos. Períodos intermediários podem ser derivados de velas horárias e diárias. O replay restringe a consulta ao cursor histórico.

HTF Candle Range: configure abertura, fechamento, fuso IANA, dias, sessão inteira ou segmento intradiário, semana e mês. Linhas de abertura/fechamento, extrema, preço inicial e vela projetada são configuráveis. O histórico independente da sessão usa resolução alinhada compatível com o orçamento de velas, paginação em blocos de até 5.000 e atualização de 15 segundos. Cobertura insuficiente não gera OHLC fictício. Projeções exigem espaço visual; extremos de velas agregadas não revelam o instante intrabar exato.

Horários: manual, 24/7 UTC ou automático. O adaptador pode fornecer uma convenção recorrente; o automático atualiza a cada 60 segundos no modo ao vivo e usa a referência do replay. Sem metadados válidos, usa configuração manual. Hyperliquid declara convenção contínua 24/7 para mercados reconhecidos. Isso não equivale ao calendário da bolsa subjacente nem garante ausência de manutenção. `xyz:GOLD` é um contrato perpétuo HIP-3, não cotação spot XAU/USD. Consulte a [auditoria GOLD](XAUUSD_IMPLEMENTATION_AUDIT.md).

Lacunas: contínuo 24/7 por padrão; política opcional de dias úteis UTC para fechamento conhecido de fim de semana. Não infere feriados. Intervalos incompletos ou OHLCV inválidos são rejeitados em agregações; séries personalizadas podem apresentar espaços vazios. Estados do histórico: carregando, atualizando, disponível, vazio, falha e limite.

## Objetos gráficos e prévias

Até 100 comandos declarativos: line, horizontal, vertical, box, text, arrow, table, candle. Propriedades de posição em deslocamento lógico de barras, preço absoluto ou âncora OHLC, multiplicador, largura, opacidade, cor, traçado, visibilidade e camada bottom/normal/top. IDs opcionais e únicos. Consulte [graphics.ts](../src/lib/indicator-sdk/graphics.ts).

A prévia usa velas fechadas do gráfico selecionado ou histórico independente conforme configuração. Amostra ilustrativa é uma opção explícita, identificada. A prévia SVG de objetos usa escala própria, amostragem de velas e abreviações em tabelas; não é uma reprodução pixel a pixel do gráfico principal. Âncoras indisponíveis são sinalizadas e deslocamentos futuros são bloqueados no replay. Previews não comprovam funcionamento do renderizador real.

## Painéis, templates e aparência

RSI, MACD, ATR e STOCH usam instâncias de gráfico inferiores; indicadores matemáticos importados podem escolher painel inferior com altura de 80–320 px, escala sobreposta independente ou preço principal. Lightweight Charts 4 permanece instalado. Sincronização de faixa lógica e alinhamento visual requerem teste local.

Preferências do gráfico principal preservam suas chaves; secundário usa prefixo chart.secondary.* e padrões próprios. Templates capturam configurações efetivas, instalam definições ausentes e preservam versões já instaladas com snapshots individuais. Seleção e autosave são separados por gráfico. Validação de persistência e restauração visual pendente.

## Administração e desempenho

Seções: limites de execução, desempenho e diagnóstico, segurança, armazenamento e recuperação. Limite ativo de 1–30 por gráfico (padrão 10); histórico de 100–20.000 velas (padrão 5.000). Aplicação explícita dos limites, não a cada digitação.

Cache de cálculo por gráfico: 12 entradas e orçamento de 100.000 pontos combinados. Reutilização de prefixos OHLCV, atualizações incrementais de expressões e médias quando aplicável, agregação compartilhada. Worker: fila de quatro requisições, 20.000 velas por entrada, timeout de dois segundos com encerramento do worker. Caminho síncrono possui verificações de tempo cooperativas; não há limite absoluto de heap independente. Diagnóstico registra tempo decorrido, modo, quantidade de velas, estimativa de cache (64 bytes por ponto) e até dez erros recentes. Não representa memória real ou benchmark de CPU. Três falhas consecutivas podem pausar um cálculo; desativar e reativar permite nova tentativa.

## Persistência, revisões e backups

IndexedDB e cache de recuperação localStorage com envelopes de revisão; hidratação valida os dados e compara revisões. A gravação comum usa fila assíncrona; erros aparecem no diagnóstico. Restauração unificada usa uma transação IndexedDB para estados do SDK. Modelos e desenhos de adaptadores externos não têm transação comum; há tentativa de rollback compensatório em caso de falha.

Até 20 revisões por indicador. Novas revisões registram o instante de arquivamento; ordenação decrescente, empates estáveis e revisões legadas sem data exibidas ao final. Restaurar arquiva a definição substituída. O formato .ts não contém metadados de revisão.

Central de backups:
- Indicadores e configurações: JSON versão 1, biblioteca, revisões, personalizações e administração.
- Espaço de trabalho: JSON versão 2, inclui modelos e desenhos persistidos. Mescla modelos por nome e desenhos por ID.
- Avançado: biblioteca/revisões e personalizações isoladas; colagem JSON manual.
- Validação e confirmação antes de restauração. Exportações nomeadas com data/hora UTC.

Não inclui carteira, credenciais, ordens, journal nem desenhos secundários não salvos. A cobertura de desenhos depende dos símbolos e índice persistidos. Backups antigos são lidos pela versão atual, mas versões antigas do aplicativo podem não compreender o novo envelope de revisão. Limite do backup unificado: 16.000.000 conforme verificações de tamanho; biblioteca isolada possui limite próprio. Verifique o diagnóstico antes de considerar uma gravação parcial confirmada.

## Limitações e validação

Não executar TypeScript arbitrário, não inventar candles, não apresentar amostras como feed ao vivo e não tratar GOLD perpétuo como spot. Calendários excepcionais, memória real, concorrência entre abas e durabilidade após falhas não estão certificados.

O [roteiro de validação local](indicator-validation.md) reúne os testes pendentes desta rodada. O [histórico de evolução](indicator-sdk-history.md) preserva os registros anteriores; afirmações antigas descrevem seu momento de implementação, não o estado atual. O protocolo obrigatório continua em [AGENTS.md](../AGENTS.md). Nenhum GitHub Actions, merge ou deploy é autorizado por esta documentação.
