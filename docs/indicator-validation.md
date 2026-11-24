# OpenCharts — Roteiro de validação local do SDK

Estado inicial de todos os itens abaixo: **PENDENTE** para a rodada acumulada de indicadores. A evidência do smoke test GOLD anterior não certifica esta rodada.

## 1. Preparação e verificações automatizadas

No checkout local autorizado, verificar branch, HEAD, alterações não commitadas e dependências. Não descartar dados. Executar no PowerShell, um comando de cada vez ou em um bloco com verificação de exit code:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run check:size
```

A instalação de dependências só deve ocorrer se necessária, após proteger alterações locais. Para distribuição da biblioteca, executar também build:lib e check:package. Antes de qualquer atualização, corrigir falhas e repetir os testes relacionados. E2E: inspecionar previamente os cenários de `npm.cmd run e2e:hl`, usar ambiente isolado e não enviar ordens reais.

## 2. Matriz manual de regressão

| Área | Verificação local | Estado |
|---|---|---|
| Importador | JSON válido, inválido, tamanho, tentativas de código executável, parâmetros e fórmulas | Pendente |
| Edição | Instalar, ativar, duplicar, editar global/individual, redefinir, excluir, favoritos | Pendente |
| Gráficos | Independência de aparência, painéis, escalas, faixa lógica, redimensionamento e troca de ativo | Pendente |
| HTF | Abertura/fechamento, fuso, DST, sessão noturna, 24/7, semana, mês, períodos parciais, lacunas | Pendente |
| Provedor | GOLD perpétuo e cripto, fonte real, horários automáticos e fallback | Pendente |
| Replay | Nenhum dado posterior ao cursor, retrocesso, troca de gráfico, projeções | Pendente |
| Histórico | Carregamento, erros, vazio, limites, nova tentativa, troca rápida de símbolo | Pendente |
| Preview | Velas reais, amostras identificadas, cálculos, oito objetos gráficos, estilos e âncoras | Pendente |
| Persistência | Reinício, hidratação, gravação, falhas, concorrência, recuperação | Pendente |
| Backup | v1/v2, legado, revisão datada/sem data, parcial, inválido, rollback, preservação de dados alheios | Pendente |
| Recursos | Worker, timeout, fila, cache, indicadores múltiplos, pausas e recuperação | Pendente |
| Interface | Textos pt-BR, menus, administração, acessibilidade, campos, erros e navegação | Pendente |

## 3. Encerramento

Registrar commit testado, ambiente, comandos, exit codes, evidências visuais, falhas e limitações. Separar aprovado, falhou e não testado. Não atualizar o checkout de uso nem marcar release estável antes da autorização e da aprovação local. Não executar GitHub Actions ou deploy automático. Consulte [AGENTS.md](../AGENTS.md).
