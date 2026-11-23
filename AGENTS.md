# Protocolo Geral de Preservação, Evolução e Consistência

Este arquivo define as regras obrigatórias para qualquer agente ou pessoa que altere este repositório. O objetivo é evoluir o OpenCharts sem reconstruir partes que já funcionam, sem regressões e sem acumular cópias desnecessárias.

## 1. Regra principal

Evoluir o sistema existente, respeitando sua arquitetura, seus contratos, sua identidade visual e seus fluxos de dados.

Nenhuma funcionalidade existente pode desaparecer, mudar de comportamento ou ser prejudicada silenciosamente. Toda mudança deve preservar compatibilidade e considerar o sistema como um conjunto integrado.

## 2. Análise obrigatória antes de alterar

Antes de qualquer implementação:

1. Inspecionar a branch atual, último commit, `git status`, diferenças locais e alterações não commitadas.
2. Analisar a arquitetura e identificar funções, componentes, serviços e dependências relacionados à solicitação.
3. Identificar como a funcionalidade atual opera e de onde vêm seus dados.
4. Localizar todos os pontos em que a função é declarada, chamada, exibida ou consumida.
5. Mapear dependências entre páginas, módulos, componentes, serviços, adaptadores e integrações.
6. Preservar funcionalidades, dados, configurações e alterações locais.
7. Não implementar antes de compreender o fluxo afetado.

Se o ambiente de execução não permitir consultar o estado local, declarar essa limitação. Nunca afirmar que o `git status` local está limpo com base apenas no estado remoto do GitHub.

## 3. Preservação do código

1. Não criar cópias de arquivos, backups acumulados ou versões paralelas.
2. Não substituir arquivos inteiros quando uma alteração pontual resolver.
3. Não remover, renomear ou substituir funções sem mapear seus impactos.
4. Não duplicar funções, componentes, serviços ou estruturas existentes.
5. Reutilizar os padrões, contratos e estruturas já adotados pelo projeto.
6. Preservar compatibilidade com módulos e funcionalidades existentes.
7. Evitar alterações em arquivos que não participam da tarefa.
8. Nunca descartar alterações locais sem autorização explícita.
9. Não executar `reset`, `clean`, `restore`, rebase destrutivo ou descarte de arquivos sem autorização explícita.

## 4. Consistência geral do sistema

Toda atualização deve manter consistência entre:

- Código, arquitetura e contratos.
- Interface, experiência de uso e identidade visual.
- Componentes e funcionalidades.
- Botões e respectivas ações.
- Filtros e resultados.
- Formulários, estados e validações.
- Cores, fontes, espaçamentos, tipografia e ícones.
- Animações, motions, transições e efeitos.
- Navegação, páginas e organização dos módulos.
- Dados, estados, cache e atualizações.
- APIs, adaptadores, serviços e integrações.
- Responsividade e diferentes tamanhos de tela.

Nenhuma mudança deve criar comportamentos incompatíveis ou diferenças visuais injustificadas.

## 5. Implementação de novas funcionalidades

Antes de adicionar uma funcionalidade:

1. Procurar se já existe função semelhante ou parcialmente implementada.
2. Identificar componentes e serviços reutilizáveis.
3. Mapear em quais partes do sistema a funcionalidade deve operar.
4. Verificar páginas, módulos e fluxos relacionados.
5. Implementar usando a arquitetura e os contratos existentes.
6. Garantir que botões executem ações reais.
7. Garantir que filtros alterem corretamente os resultados.
8. Validar formulários, estados, dados e integrações.
9. Preservar os padrões visuais e comportamentais.
10. Testar possíveis interferências nas funcionalidades existentes.

Uma funcionalidade não está concluída apenas por aparecer na interface. Ela precisa estar conectada aos fluxos corretos e operar de verdade.

## 6. Alteração de funcionalidades existentes

Ao modificar uma função:

1. Pesquisar onde ela está localizada e onde é utilizada.
2. Identificar todos os chamadores e dependências.
3. Verificar páginas e componentes que compartilham essa função.
4. Avaliar os efeitos da mudança em cada utilização.
5. Preservar compatibilidade com os demais módulos.
6. Atualizar os pontos relacionados quando necessário.
7. Testar todos os fluxos afetados, não apenas a tela solicitada.

Não modificar uma função isoladamente sem avaliar seus consumidores.

## 7. Interface, design e experiência

Toda atualização visual deve respeitar a identidade já estabelecida no projeto.

Preservar:

- Sistema de cores e temas.
- Tipografia, fontes e hierarquia visual.
- Estilo dos botões, ícones, cards e tabelas.
- Menus, navegação, espaçamentos e alinhamentos.
- Responsividade.
- Estados de carregamento, vazios e erros.
- Feedback das ações.

Animações e transições devem seguir o padrão existente e não prejudicar desempenho, acessibilidade ou usabilidade. Não criar uma interface visualmente diferente dentro do mesmo sistema sem solicitação explícita.

## 8. Integrações e fluxos de dados

Toda integração nova ou modificada deve ser analisada de ponta a ponta:

1. Origem dos dados.
2. Recebimento e transporte.
3. Processamento e validação.
4. Armazenamento, quando aplicável.
5. Atualização, sincronização e cache.
6. Comunicação entre módulos.
7. Exibição na interface.
8. Tratamento de erros, indisponibilidade e reconexão.
9. Compatibilidade com integrações existentes.

Não criar integrações isoladas. Para dados de mercado, distinguir claramente dados reais, atrasados, históricos, reproduzidos e simulados. Não apresentar dados simulados como cotações ao vivo.

## 9. Desenvolvimento e validação local

Toda validação deve ser realizada localmente, no ambiente do projeto.

Regras obrigatórias:

- Não utilizar GitHub Actions ou GitHub Workflows.
- Não criar pipelines automatizados de CI/CD.
- Não depender de validações remotas para declarar uma alteração concluída.
- Não executar deploy automaticamente.
- Utilizar o ambiente local para executar e validar o sistema.

Após cada alteração:

1. Executar testes relacionados.
2. Executar o build local.
3. Iniciar o servidor local.
4. Verificar erros no terminal e no console.
5. Testar as funcionalidades na interface.
6. Verificar botões, filtros, navegação e integrações afetadas.
7. Confirmar que as funções anteriores continuam funcionando.
8. Corrigir problemas antes de considerar a atualização concluída.

Se a alteração for feita exclusivamente pela API do GitHub e não houver acesso ao ambiente local, registrar claramente que a validação local ainda está pendente. Não declarar testes ou build como aprovados sem executá-los.

## 10. Versionamento e recuperação

1. Manter o GitHub como fonte principal do código versionado.
2. Utilizar `main` para versões estáveis.
3. Utilizar `dev` para desenvolvimento quando essa branch existir e fizer parte do fluxo adotado.
4. Quando não houver branch de desenvolvimento, criar uma branch de tarefa a partir da base correta, sem trabalhar diretamente em `main` para mudanças de desenvolvimento.
5. Fazer commits pequenos, rastreáveis e com mensagens claras.
6. Utilizar tags para identificar versões estáveis importantes.
7. Antes de recuperar uma versão, analisar o histórico e as diferenças.
8. Recuperar somente as alterações problemáticas sempre que possível.
9. Nunca executar operações destrutivas ou sobrescrever alterações locais sem autorização.

## 11. Entrega da versão local e atalho do Windows

Quando uma nova versão final for efetivamente entregue para uso local:

1. Atualizar o atalho do sistema na Área de Trabalho do Windows.
2. Se o atalho não existir, criá-lo.
3. Confirmar que aponta para o diretório e os arquivos corretos.
4. Garantir que a inicialização use a versão mais recente.
5. Preservar nome, identidade visual e logo oficial.
6. Evitar atalhos antigos apontando para cópias desatualizadas.

A inicialização deve seguir esta sequência:

1. Iniciar o servidor ou serviço local necessário.
2. Aguardar e confirmar que o servidor está pronto.
3. Iniciar a aplicação principal.
4. Abrir a interface com sua identidade visual e logo oficial.

A inicialização deve evitar exigir múltiplos terminais ou comandos manuais. Se o servidor falhar, informar o erro e impedir a abertura da aplicação em estado incompleto. Evitar múltiplas instâncias desnecessárias.

Não criar ou alterar atalhos locais quando não houver acesso ao computador. Nesse caso, informar que a etapa local permanece pendente.

## 12. Controle de qualidade final

Antes de entregar uma atualização, verificar e registrar:

- O código anterior foi preservado.
- Nenhuma função existente foi perdida.
- Não foram criadas duplicações desnecessárias.
- As dependências e os impactos foram identificados.
- Todas as páginas e fluxos relacionados foram verificados.
- Os botões executam suas ações.
- Os filtros apresentam resultados corretos.
- Animações e efeitos funcionam como esperado.
- A identidade visual foi preservada.
- As integrações continuam funcionando.
- A navegação está consistente.
- Os testes locais foram executados.
- O build local foi validado.
- O servidor inicia corretamente.
- O atalho do Windows foi atualizado, quando aplicável.
- A aplicação abre com a logo correta.
- O histórico Git foi atualizado quando autorizado.

Separar claramente itens aprovados, não testados e pendentes. Não marcar como concluído aquilo que não foi verificado.

## 13. Regra de segurança

Se houver risco relevante de regressão, interromper a implementação, explicar o risco e apresentar uma solução antes de continuar.

Se forem encontrados erros anteriores à alteração, registrá-los separadamente. Não corrigir problemas não relacionados sem autorização.

## Princípio final

**Evoluir sem desorganizar. Adicionar sem duplicar. Modificar sem quebrar. Integrar sem isolar. Melhorar sem perder a identidade.**

O sistema deve crescer como uma única estrutura organizada, em que cada nova funcionalidade respeita, complementa e fortalece as demais.
