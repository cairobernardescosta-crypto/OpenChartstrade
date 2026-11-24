# Efeitos sonoros

O OpenCharts usa sons curtos e configuráveis, sem reprodução em ticks, candles ou atualizações contínuas do gráfico.

## Controles

- Perfis: Minimalista (padrão), Equilibrado, Completo e Silencioso.
- Volume geral e volume por categoria.
- Categorias: interface, indicadores, ferramentas gráficas, replay, notificações, operações financeiras e conexão.
- Limite de quatro reproduções simultâneas e intervalo mínimo por efeito.
- Preferências persistidas no armazenamento local do navegador.

## Integrações

Os efeitos cobrem ações de interface, seleção de ativo e período, indicadores, ferramentas gráficas, replay, notificações, confirmações financeiras e mudanças de conexão. Sons financeiros são acionados somente após o retorno já confirmado pela lógica existente.

## Arquivos e licença

Os oito arquivos WAV em `public/audio/` totalizam 166.512 bytes. Eles foram selecionados do pacote **Kenney UI Audio**, disponibilizado sob **CC0 1.0**:

- Fonte oficial: https://kenney.nl/assets/ui-audio
- Espelho do pacote: https://github.com/Calinou/kenney-ui-audio
- Licença: https://creativecommons.org/publicdomain/zero/1.0/

O mapeamento individual está em `public/audio/LICENSE.txt`.

## Validação

A interface foi verificada no navegador com o perfil Minimalista, todas as categorias, volumes e botões de teste. TypeScript, lint, testes automatizados, build e orçamento do bundle fazem parte da validação obrigatória.
