import {describeIndicatorError,type IndicatorErrorContext} from "../../../lib/indicator-sdk/error-message";
export function IndicatorErrorNotice({error,context="general",onDismiss}:{error:unknown;context?:IndicatorErrorContext;onDismiss?:()=>void}){
 const value=describeIndicatorError(error,context);
 return <div role="alert" className="space-y-1 rounded border border-red-400/30 p-2 text-xs break-words"><div className="flex items-start justify-between gap-2"><p className="font-medium text-red-400">{value.message}</p>{onDismiss&&<button type="button" aria-label="Fechar aviso" onClick={onDismiss}>×</button>}</div>{value.action&&<p className="text-muted-foreground">{value.action}</p>}{value.detail&&<details><summary className="cursor-pointer text-muted-foreground">Detalhes técnicos · {value.code}</summary><p className="whitespace-pre-wrap break-all">{value.detail}</p></details>}</div>;
}
