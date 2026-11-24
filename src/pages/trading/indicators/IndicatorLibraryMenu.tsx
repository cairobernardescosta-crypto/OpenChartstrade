import { useState } from "react";
import {useQueryClient} from "@tanstack/react-query";
import {IndicatorActions} from "./IndicatorActions";
import {GraphicEditor} from "./GraphicEditor";
import {exportIndicatorBackup,exportWorkspaceBackup,restoreIndicatorBackup,MAX_BACKUP_SIZE} from "../../../lib/indicator-sdk/backup";
import {IndicatorAdminPanel} from "./IndicatorAdminPanel";
import {IndicatorPreview} from "./IndicatorPreview";
import {useIndicatorAdmin} from "../../../lib/indicator-sdk/admin";
import {usePersistenceError} from "../../../lib/indicator-sdk/database";
import { useOverrides, saveOverride, resetOverride, clearOverrides, resolveIndicator, exportOverrides, restoreOverrides, type ChartScope } from "../../../lib/indicator-sdk/instances";
import type { CandleData,IndicatorType } from "../../../lib/indicators";
import { HTF_EXAMPLE, parseIndicator, indicatorSchema, type ImportedIndicator } from "../../../lib/indicator-sdk/schema";
import { useIndicatorLibrary, installIndicator, updateIndicator, removeIndicator, duplicateIndicator, versions, restoreVersion, setIndicatorFavorite, exportLibrary, restoreLibrary, getLibraryError } from "../../../lib/indicator-sdk/storage";

export function IndicatorLibraryMenu({active,toggle,scope="primary",symbol="",timeframe="1m",replay=false,previewCandles}:{active: IndicatorType[];toggle:(type:IndicatorType)=>void;scope?:ChartScope;symbol?:string;timeframe?:string;replay?:boolean;previewCandles?:readonly CandleData[]}) {
  const queryClient=useQueryClient();
  const library=useIndicatorLibrary();
  const admin=useIndicatorAdmin();
  const storageError=usePersistenceError();
  const [restoring,setRestoring]=useState(false);
  const [viewSource,setViewSource]=useState<string|null>(null);
  const [showAdmin,setShowAdmin]=useState(false);
  const [overrideText,setOverrideText]=useState("");
  const overrides=useOverrides(scope);
  const [localEdit,setLocalEdit]=useState(false);
  const [source,setSource]=useState("");
  const [open,setOpen]=useState(false);
  const [error,setError]=useState("");
  const [draft,setDraft]=useState<ImportedIndicator|null>(null);
  const [query,setQuery]=useState("");
  const [favorites,setFavorites]=useState(false);
  const [filter,setFilter]=useState("all");
  const [backup,setBackup]=useState(false);
  const [backupText,setBackupText]=useState("");
  const [fullBackup,setFullBackup]=useState("");
  const [revisionId,setRevisionId]=useState<string|null>(null);
  function attempt(fn:()=>void) {try {fn();setError("");} catch(e){setError(e instanceof Error?e.message:String(e));}}
  return <div className="border-b border-border pb-2 mb-2 space-y-2">
    <button className="w-full text-left rounded px-2 py-1 text-xs hover:bg-secondary" onClick={()=>setOpen(v=>!v)}>+ Importar indicador (.ts)</button>
    {open && <div className="space-y-2 px-1" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); const file=e.dataTransfer.files[0];if(file && file.size<=65536 && file.name.endsWith(".ts")) void file.text().then(setSource).catch(e=>setError(String(e)));else setError("Selecione um arquivo .ts de até 64 KiB");}}>
      <input type="file" accept=".ts" className="w-full text-xs" onChange={e=>{const file=e.target.files?.[0]; if(!file)return; if(file.size>65536||!file.name.endsWith(".ts")){setError("Selecione um arquivo .ts de até 64 KiB");return;} void file.text().then(setSource).catch(e=>setError(String(e)));}}/>
      <textarea aria-label="Código do indicador" className="w-full h-24 bg-background border border-border rounded p-1 text-xs font-mono" value={source} onChange={e=>setSource(e.target.value)} placeholder="export default {...}" maxLength={65536}/>
      <div className="flex gap-2 text-xs"><button onClick={()=>setSource("export default "+HTF_EXAMPLE+";")}>Exemplo HTF</button><button onClick={()=>attempt(()=>{setLocalEdit(false);setDraft(parseIndicator(source));})}>Prévia</button></div>
    </div>}
    <div className="flex gap-2 text-xs"><button onClick={()=>setFavorites(v=>!v)} aria-pressed={favorites}>★ Favoritos</button><button onClick={()=>{attempt(()=>{setFullBackup(exportIndicatorBackup());setBackupText(exportLibrary());setOverrideText(exportOverrides());setBackup(v=>!v);});}}>Backup</button></div>
    {backup&&<div className="space-y-2 rounded border border-border p-2 text-xs"><p className="font-semibold">Backup completo de indicadores</p><button className="rounded border border-border px-2 py-1" onClick={()=>attempt(()=>{const url=URL.createObjectURL(new Blob([exportIndicatorBackup()],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="opencharts-indicators-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);})}>Baixar backup dos indicadores</button><button className="rounded border border-border px-2 py-1" disabled={restoring} onClick={()=>{setRestoring(true);void exportWorkspaceBackup().then(text=>{const url=URL.createObjectURL(new Blob([text],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="opencharts-workspace-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setFullBackup(text);setError("");}).catch(e=>setError(String(e))).finally(()=>setRestoring(false));}}>Baixar backup do espaço de trabalho (modelos e desenhos salvos)</button><input aria-label="Selecionar backup completo" type="file" accept=".json" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>MAX_BACKUP_SIZE){setError("Arquivo de backup muito grande");return;}void file.text().then(setFullBackup).catch(e=>setError(String(e)));}}/><textarea aria-label="Backup completo" className="w-full h-24 bg-background border border-border rounded" value={fullBackup} onChange={e=>setFullBackup(e.target.value)}/><button disabled={restoring} onClick={()=>{if(!window.confirm("Restaurar definições, revisões e configurações dos indicadores e mesclar modelos e desenhos salvos, quando incluídos?"))return;setRestoring(true);void restoreIndicatorBackup(fullBackup).then(()=>{setError("");void queryClient.invalidateQueries();}).catch(e=>setError(String(e))).finally(()=>setRestoring(false));}}>{restoring?"Restaurando…":"Restaurar backup completo"}</button></div>}
    {backup && <div className="space-y-1"><textarea aria-label="Backup da biblioteca" className="w-full h-24 bg-background border border-border text-xs" value={backupText} onChange={e=>setBackupText(e.target.value)}/><button onClick={()=>attempt(()=>{if(window.confirm("Substituir a biblioteca de indicadores?"))restoreLibrary(backupText);})}>Restaurar biblioteca</button></div>}
    <button type="button" className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-secondary" aria-expanded={showAdmin} onClick={()=>setShowAdmin(v=>!v)}>Administração <span aria-hidden="true">{showAdmin?"−":"+"}</span></button>
    {showAdmin&&<IndicatorAdminPanel scope={scope} installed={library.length} activeCount={active.filter(x=>x.startsWith("custom:")).length} onError={setError}/>}
    {backup&&<div className="space-y-1"><textarea aria-label="Backup das configurações do gráfico" className="w-full h-20 bg-background border border-border text-xs" value={overrideText} onChange={e=>setOverrideText(e.target.value)}/><button onClick={()=>attempt(()=>{if(window.confirm("Substituir as configurações dos indicadores do gráfico?"))restoreOverrides(overrideText);})}>Restaurar configurações do gráfico</button></div>}
    {getLibraryError() && <p role="alert" className="text-xs">Não foi possível carregar a biblioteca salva.</p>}
    {draft && <div className="border border-border rounded p-2 text-xs space-y-2">
      <div className="font-semibold">{draft.name} · {draft.version}</div>
      <IndicatorPreview draft={draft} symbol={symbol} timeframe={timeframe} replay={replay} chartCandles={previewCandles}/>
      <div>{draft.kind} · {localEdit?(scope==="primary"?"gráfico principal":"gráfico secundário"):"definição da biblioteca"}</div>{!localEdit&&<><label className="block">Versão <input className="bg-background border border-border" value={draft.version} onChange={e=>setDraft({...draft,version:e.target.value})}/></label><label className="block">Autor <input className="bg-background border border-border" value={draft.author} onChange={e=>setDraft({...draft,author:e.target.value})}/></label><label className="block">Descrição <textarea className="w-full bg-background border border-border" value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label></>}<label>Nome <input className="w-full bg-background border border-border" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      {draft.kind==="expression" && <label>Fórmula (aritmética OHLCV)<input className="w-full bg-background border border-border" value={draft.expression} onChange={e=>setDraft({...draft,expression:e.target.value})}/></label>}
      {draft.kind==="session-candle" ? <><label className="block">Abertura <input type="time" className="bg-background" value={draft.open} onChange={e=>setDraft({...draft,open:e.target.value})}/></label><label className="block">Fechamento <input type="time" className="bg-background" value={draft.close} onChange={e=>setDraft({...draft,close:e.target.value})}/></label><label className="block">Fuso horário <input className="w-full bg-background border border-border" value={draft.timezone} onChange={e=>setDraft({...draft,timezone:e.target.value})}/></label></>:<label>Período <input type="number" min={1} max={5000} className="w-20 bg-background" value={draft.period} onChange={e=>setDraft({...draft,period:Number(e.target.value)})}/></label>}
      {draft.kind==="session-candle"&&<><label className="block">Horários <select value={draft.sessionSchedule} onChange={e=>setDraft({...draft,sessionSchedule:e.target.value as ImportedIndicator["sessionSchedule"]})}><option value="manual">Manual</option><option value="automatic">Automático (provedor / alternativa manual)</option><option value="utc-24h">24/7 UTC (convenção Hyperliquid)</option></select></label><label className="block">Histórico <select value={draft.historySource} onChange={e=>setDraft({...draft,historySource:e.target.value as ImportedIndicator["historySource"]})}><option value="chart">Gráfico</option><option value="independent">Histórico independente do mercado (velas fechadas)</option></select></label></>}
      {draft.kind==="session-candle"&&<label className="block">Período HTF <select value={draft.sessionMinutes} onChange={e=>setDraft({...draft,sessionMinutes:e.target.value as ImportedIndicator["sessionMinutes"]})}>{["session","15","30","60","120","240","360","720","week","month"].map(n=><option key={n} value={n}>{n==="session"?"Sessão completa":n==="week"?"Semanal":n==="month"?"Mensal":n+" min"}</option>)}</select></label>}
      {draft.kind==="session-candle" && <div className="space-y-1"><label>Baixa <input type="color" value={draft.downColor} onChange={e=>setDraft({...draft,downColor:e.target.value})}/></label><label> Linhas <input type="color" value={draft.lineColor} onChange={e=>setDraft({...draft,lineColor:e.target.value})}/></label>{(["offset","width","lineWidth","opacity"] as const).map(k=><label key={k} className="block">{{offset:"Deslocamento",width:"Largura",lineWidth:"Espessura da linha",opacity:"Opacidade"}[k]} <input type="number" step={k==="opacity"?0.1:1} className="w-16 bg-background" value={draft[k]} onChange={e=>setDraft({...draft,[k]:Number(e.target.value)})}/></label>)}{(["showOpen","showClose","showOpenPrice","showHighLow","showCandle","showWicks","showLabels"] as const).map(k=><label key={k} className="block"><input type="checkbox" checked={draft[k]} onChange={e=>setDraft({...draft,[k]:e.target.checked})}/> {{showOpen:"Mostrar abertura",showClose:"Mostrar fechamento",showOpenPrice:"Mostrar preço de abertura",showHighLow:"Mostrar máxima e mínima",showCandle:"Mostrar vela",showWicks:"Mostrar pavios",showLabels:"Mostrar rótulos"}[k]}</label>)}<div>{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((day,i)=><label key={day} className="mr-1"><input type="checkbox" checked={draft.days.includes(i)} onChange={e=>setDraft({...draft,days:e.target.checked?[...draft.days,i]:draft.days.filter(d=>d!==i)})}/>{day}</label>)}</div></div>}
      {draft.kind!=="session-candle"&&draft.kind!=="graphics"&&<label className="block">Agregação (minutos) <select className="bg-background" value={draft.aggregation} onChange={e=>setDraft({...draft,aggregation:Number(e.target.value)})}>{[0,15,30,60,120,240,360,720,1440,10080,43200].map(n=><option key={n} value={n}>{n===0?"Gráfico":n===43200?"Mês civil":n}</option>)}</select></label>}
      {draft.kind!=="session-candle"&&draft.kind!=="graphics"&&draft.aggregation!==0&&<label className="block">Fonte do histórico <select className="bg-background" value={draft.historySource} onChange={e=>setDraft({...draft,historySource:e.target.value as ImportedIndicator["historySource"]})}><option value="chart">Agregação do gráfico</option><option value="independent">Histórico independente do mercado</option></select></label>}
      <label className="block">Categoria <input className="bg-background border border-border" value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}/></label>
      <label className="block"><input type="checkbox" checked={draft.visible} onChange={e=>setDraft({...draft,visible:e.target.checked})}/> Visível no gráfico</label>
      {draft.kind!=="graphics"&&draft.kind!=="session-candle"&&<label className="block">Exibição <select value={draft.plot} onChange={e=>setDraft({...draft,plot:e.target.value as ImportedIndicator["plot"]})}><option value="line">Linha</option><option value="histogram">Histograma</option><option value="area">Área</option></select></label>}
      {draft.parameters.map(p=><label className="block" key={p.key}>{p.label}<input className="bg-background w-24" type="number" min={p.min} max={p.max} step={p.step} value={p.value} onChange={e=>setDraft({...draft,parameters:draft.parameters.map(v=>v.key===p.key?{...v,value:Number(e.target.value)}:v)})}/></label>)}
      {draft.parameters.length>0&&<button onClick={()=>setDraft({...draft,parameters:draft.parameters.map(p=>({...p,value:p.defaultValue}))})}>Restaurar parâmetros</button>}
      {draft.kind!=="graphics"&&draft.kind!=="session-candle"&&<label className="block">Escala de preço <select value={draft.scale} onChange={e=>setDraft({...draft,scale:e.target.value as ImportedIndicator["scale"]})}><option value="price">Preço principal</option><option value="independent">Escala independente sobreposta</option><option value="pane">Painel inferior do indicador</option></select></label>}
      {draft.scale==="pane"&&<label className="block">Altura do painel <input type="number" min={80} max={320} value={draft.paneHeight} onChange={e=>setDraft({...draft,paneHeight:Number(e.target.value)})}/></label>}
      {draft.kind!=="graphics"&&draft.kind!=="session-candle"&&<label className="block">Tratamento de lacunas do mercado <select value={draft.gapPolicy} onChange={e=>setDraft({...draft,gapPolicy:e.target.value as ImportedIndicator["gapPolicy"]})}><option value="continuous">Contínuo 24/7 (padrão)</option><option value="utc-weekdays">Dias úteis em UTC (configuração explícita)</option></select></label>}
      <GraphicEditor rows={draft.graphics} color={draft.color} onChange={graphics=>setDraft({...draft,graphics})}/>
      <label>Cor <input type="color" value={draft.color} onChange={e=>setDraft({...draft,color:e.target.value})}/></label>
      <div className="flex gap-2"><button onClick={()=>attempt(()=>{const value=indicatorSchema.parse(draft); if(localEdit)saveOverride(scope,value);else if(library.some(x=>x.id===value.id)){if(!window.confirm("Substituir a definição instalada do indicador?"))return;updateIndicator(value);}else installIndicator(value);setDraft(null);})}>Salvar</button><button onClick={()=>setDraft(null)}>Cancelar</button></div>
    </div>}
    {viewSource!==null&&<div className="space-y-1"><textarea aria-label="Código da definição do indicador" className="w-full h-32 bg-background border border-border font-mono text-xs" value={viewSource} onChange={e=>setViewSource(e.target.value)}/><button onClick={()=>attempt(()=>{setLocalEdit(false);setDraft(parseIndicator(viewSource));setViewSource(null);})}>Pré-visualizar código editado</button><button onClick={()=>setViewSource(null)}>Fechar código</button></div>}
    {storageError&&<p role="alert" className="text-xs text-red-400 break-words">{storageError}</p>}
    {error && <p role="alert" className="text-xs text-red-400 break-words">{error}</p>}
    {library.length>0 && <input aria-label="Buscar indicadores importados" className="w-full bg-background border border-border rounded px-1 text-xs" placeholder="Buscar importados" value={query} onChange={e=>setQuery(e.target.value)}/>}
    <select aria-label="Filtrar indicadores" className="bg-background text-xs" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option>{[...new Set(library.map(x=>x.category))].map(c=><option key={c} value={"category:"+c}>{c}</option>)}</select>
    {library.filter(x=>(!favorites||x.favorite)&&x.name.toLowerCase().includes(query.toLowerCase())&&(filter==="all"||(filter==="active"&&active.includes(`custom:${x.id}`))||(filter==="inactive"&&!active.includes(`custom:${x.id}`))||filter==="category:"+x.category)).map(x=>{
      const id:IndicatorType=`custom:${x.id}`;
      return <div key={x.id} className="flex flex-wrap gap-2 items-center text-xs px-1 py-1 border-b border-border">
        <button className="flex-1 text-left truncate" aria-pressed={active.includes(id)} onClick={()=>attempt(()=>{if(!active.includes(id)&&active.filter(x=>x.startsWith("custom:")).length>=admin.maxActive)throw new Error("Limite de indicadores ativos atingido");toggle(id);})}>{active.includes(id)?"✓ ":"+ "}{x.name}</button>
        <button aria-label={"Favoritar "+x.name} onClick={()=>attempt(()=>setIndicatorFavorite(x.id,!x.favorite))}>{x.favorite?"★":"☆"}</button>
        <IndicatorActions name={x.name} actions={[
          {label:"Editar neste gráfico",run:()=>{setLocalEdit(true);setDraft(resolveIndicator(x,overrides));}},
          {label:"Editar definição global",run:()=>{setLocalEdit(false);setDraft(x);}},
          {label:"Duplicar",run:()=>attempt(()=>duplicateIndicator(x.id))},
          {label:"Histórico de versões",disabled:versions(x.id).length===0,run:()=>setRevisionId(revisionId===x.id?null:x.id)},
          {label:"Ver código",run:()=>setViewSource("export default "+JSON.stringify(x,null,2)+";")},
          {label:"Restaurar configurações do gráfico",run:()=>attempt(()=>resetOverride(scope,x.id))},
          {label:"Exportar (.ts)",run:()=>{const url=URL.createObjectURL(new Blob(["export default "+JSON.stringify(x,null,2)+";"],{type:"text/plain"}));const a=document.createElement("a");a.href=url;a.download=x.id+".ts";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}},
          {label:"Desinstalar",danger:true,run:()=>attempt(()=>{if(!window.confirm("Desinstalar "+x.name+"?"))return;removeIndicator(x.id);clearOverrides(x.id);if(active.includes(id))toggle(id);})}
        ]}/>
        {revisionId===x.id&&<div className="basis-full space-y-1 rounded border border-border p-2">{versions(x.id).map((v,index)=><div key={index} className="flex items-center gap-2"><span className="flex-1 truncate">{v.name} · {v.version} · revisão {index+1}</span><button onClick={()=>setViewSource("export default "+JSON.stringify(v,null,2)+";")}>Ver</button><button onClick={()=>attempt(()=>{if(window.confirm("Restaurar a revisão selecionada?"))restoreVersion(x.id,index);})}>Restaurar</button></div>)}</div>}

      </div>;
    })}
  </div>;
}
