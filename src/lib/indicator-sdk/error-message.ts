export type IndicatorErrorContext="general"|"history"|"graphics"|"calculation"|"storage";
export type IndicatorErrorMessage={code:string;message:string;action:string;detail:string};
const rules:readonly [RegExp,string,string,string][]=[
 [/rollback incomplete/i,"RESTORE_ROLLBACK","A restauração falhou e a recuperação anterior não foi concluída.","Não repita a restauração antes de verificar o armazenamento e o backup."],
 [/quota|disk full|storage full/i,"STORAGE_QUOTA","O espaço de armazenamento disponível foi atingido.","Libere espaço ou exporte um backup antes de tentar novamente."],
 [/indexeddb write failed|recovery cache|could not persist/i,"STORAGE_WRITE","Não foi possível confirmar a gravação dos dados.","Verifique o armazenamento e exporte uma cópia de segurança."],
 [/indexeddb read failed|could not load.*library/i,"STORAGE_READ","Não foi possível ler os dados salvos.","Verifique o armazenamento e a opção de recuperação."],
 [/restoration in progress|storage is loading|settings are loading/i,"STORAGE_BUSY","O armazenamento está ocupado ou ainda está carregando.","Aguarde a conclusão da operação e tente novamente."],
 [/64 KiB|backup too large|exceeds.*size|arquivo de backup muito grande/i,"FILE_SIZE","O arquivo ultrapassa o tamanho permitido.","Selecione um arquivo menor ou reduza o conteúdo."],
 [/expected export default/i,"IMPORT_FORMAT","O formato do indicador não é reconhecido.","Use export default seguido de um objeto JSON válido."],
 [/unsupported.*backup|invalid history|invalid overrides/i,"BACKUP_FORMAT","O formato do backup é incompatível ou inválido.","Selecione um backup exportado pelo OpenCharts."],
 [/duplicate|already installed/i,"DUPLICATE","Há identificadores repetidos ou um indicador já instalado.","Use um identificador único ou edite a definição existente."],
 [/limit reached|too many|limite.*atingido|excede o limite/i,"LIMIT","Um limite configurado foi atingido.","Revise os limites na administração ou reduza a quantidade de dados."],
 [/deadline exceeded|execution budget|timed? ?out|timeout/i,"TIMEOUT","A operação excedeu o tempo permitido.","Reduza o histórico ou a complexidade do cálculo e tente novamente."],
 [/missing history intervals|faltam velas|histórico.*incompleto|incomplete session/i,"HISTORY_GAP","O histórico recebido contém lacunas.","Confira a fonte e o período. Nenhuma vela ausente será inventada."],
 [/no completed market history|sem velas|nenhum histórico/i,"HISTORY_EMPTY","Não há histórico suficiente disponível.","Verifique o ativo e o período selecionado."],
 [/network|failed to fetch|offline|market history unavailable|não foi possível consultar o histórico/i,"NETWORK","Não foi possível consultar o provedor de dados.","Verifique a conexão e tente novamente."],
 [/indicator not installed|unknown revision/i,"NOT_FOUND","O indicador ou a revisão não está mais disponível.","Reabra a biblioteca e selecione uma definição existente."],
 [/syntaxerror|unexpected token|unexpected end|invalid json/i,"INVALID_JSON","O conteúdo JSON contém um erro de sintaxe.","Revise aspas, vírgulas e chaves antes de continuar."]
];
const fallback:Record<IndicatorErrorContext,[string,string,string]>={general:["OPERATION","Não foi possível concluir a operação.","Confira os dados e tente novamente."],history:["HISTORY","Não foi possível obter o histórico solicitado.","Confira o ativo, o período e a conexão."],graphics:["GRAPHICS","Não foi possível aplicar as propriedades gráficas.","Revise os campos do objeto."],calculation:["CALCULATION","Não foi possível calcular o indicador.","Revise a fórmula, os parâmetros e o histórico."],storage:["STORAGE","Não foi possível concluir a operação de armazenamento.","Verifique a persistência e mantenha um backup atualizado."]};
export function describeIndicatorError(error:unknown,context:IndicatorErrorContext="general"):IndicatorErrorMessage{
 const raw=error instanceof Error?error.message:String(error??"");
 // Do not display secrets, URLs with query tokens, or arbitrarily long payloads.
 const detail=raw.replace(/https?:\/\/[^\s"'<>]+/gi,"[URL omitida]").replace(/(?:bearer\s+|(?:api[_-]?key|token|password|secret|private[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,"[credencial omitida]").slice(0,1200);
 const rule=rules.find(([pattern])=>pattern.test(raw));if(rule)return {code:rule[1],message:rule[2],action:rule[3],detail};
 if(/zoderror|invalid_type|too_small|too_big|invalid_value|unrecognized_keys/i.test(raw)){
 return {code:"VALIDATION",message:"Uma ou mais configurações são inválidas.",action:"Confira os campos indicados nos detalhes e corrija os valores.",detail};
 }
 if(/^(Selecione um arquivo|A definição original|A definição global mudou|Aguardando a primeira vela)/.test(raw))return {code:"INPUT",message:detail,action:"",detail:""};
 const [code,message,action]=fallback[context];return {code,message,action,detail};
}
