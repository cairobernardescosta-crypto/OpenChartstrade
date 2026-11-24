import { useState } from "react";
import {useIndicatorDiagnostics,resetDiagnostics} from "../../../lib/indicator-sdk/diagnostics";
import {IndicatorPreview} from "./IndicatorPreview";
import {useIndicatorAdmin,saveIndicatorAdmin} from "../../../lib/indicator-sdk/admin";
import {persistenceError} from "../../../lib/indicator-sdk/database";
import { useOverrides, saveOverride, resetOverride, clearOverrides, resolveIndicator, exportOverrides, restoreOverrides, type ChartScope } from "../../../lib/indicator-sdk/instances";
import type { IndicatorType } from "../../../lib/indicators";
import { HTF_EXAMPLE, parseIndicator, indicatorSchema, type ImportedIndicator } from "../../../lib/indicator-sdk/schema";
import { useIndicatorLibrary, installIndicator, updateIndicator, removeIndicator, duplicateIndicator, versions, exportLibrary, restoreLibrary, getLibraryError, recoverLibraryMirror } from "../../../lib/indicator-sdk/storage";

export function IndicatorLibraryMenu({active,toggle,scope="primary"}:{active: IndicatorType[];toggle:(type:IndicatorType)=>void;scope?:ChartScope}) {
  const library=useIndicatorLibrary();
  const admin=useIndicatorAdmin();
  const diagnostics=useIndicatorDiagnostics();
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
  const [backup,setBackup]=useState(false);
  const [backupText,setBackupText]=useState("");
  function attempt(fn:()=>void) {try {fn();setError("");} catch(e){setError(e instanceof Error?e.message:String(e));}}
  return <div className="border-b border-border pb-2 mb-2 space-y-2">
    <button className="w-full text-left rounded px-2 py-1 text-xs hover:bg-secondary" onClick={()=>setOpen(v=>!v)}>+ Import indicator (.ts)</button>
    {open && <div className="space-y-2 px-1" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); const file=e.dataTransfer.files[0];if(file && file.size<=65536 && file.name.endsWith(".ts")) void file.text().then(setSource).catch(e=>setError(String(e)));else setError("Select a .ts file up to 64 KiB");}}>
      <input type="file" accept=".ts" className="w-full text-xs" onChange={e=>{const file=e.target.files?.[0]; if(!file)return; if(file.size>65536||!file.name.endsWith(".ts")){setError("Select a .ts file up to 64 KiB");return;} void file.text().then(setSource).catch(e=>setError(String(e)));}}/>
      <textarea aria-label="Indicator source" className="w-full h-24 bg-background border border-border rounded p-1 text-xs font-mono" value={source} onChange={e=>setSource(e.target.value)} placeholder="export default {...}" maxLength={65536}/>
      <div className="flex gap-2 text-xs"><button onClick={()=>setSource("export default "+HTF_EXAMPLE+";")}>HTF example</button><button onClick={()=>attempt(()=>{setLocalEdit(false);setDraft(parseIndicator(source));})}>Preview</button></div>
    </div>}
    <div className="flex gap-2 text-xs"><button onClick={()=>setFavorites(v=>!v)} aria-pressed={favorites}>★ Favorites</button><button onClick={()=>{setBackupText(exportLibrary());setOverrideText(exportOverrides());setBackup(v=>!v);}}>Backup</button></div>
    {backup && <div className="space-y-1"><textarea aria-label="Library backup" className="w-full h-24 bg-background border border-border text-xs" value={backupText} onChange={e=>setBackupText(e.target.value)}/><button onClick={()=>attempt(()=>{if(window.confirm("Replace indicator library?"))restoreLibrary(backupText);})}>Restore library</button></div>}
    <button className="text-xs" onClick={()=>setShowAdmin(v=>!v)}>Administration</button>
    {showAdmin&&<div className="space-y-2 border border-border rounded p-2 text-xs"><label className="block">Maximum imported indicators <input type="number" min={1} max={30} value={admin.maxActive} onChange={e=>attempt(()=>saveIndicatorAdmin({...admin,maxActive:Number(e.target.value)}))}/></label><label className="block">Maximum historical bars <input type="number" min={100} max={20000} step={100} value={admin.maxBars} onChange={e=>attempt(()=>saveIndicatorAdmin({...admin,maxBars:Number(e.target.value)}))}/></label><p>SDK 1 · {library.length} definitions · {active.filter(x=>x.startsWith("custom:")).length} active</p><p>Executable code, wallet and network access: blocked</p><label className="block"><input type="checkbox" checked={admin.diagnostics} onChange={e=>attempt(()=>saveIndicatorAdmin({...admin,diagnostics:e.target.checked}))}/> Performance diagnostics</label>{admin.diagnostics&&<div className="max-h-32 overflow-y-auto">{diagnostics.filter(x=>x.scope===scope).map(x=><div key={x.id} className="border-t border-border py-1">{x.id}: {x.ms.toFixed(2)} ms · {x.bars} bars {x.error&&<span className="text-red-400">{x.error} ({x.failures})</span>}</div>)}<button onClick={resetDiagnostics}>Clear diagnostics</button></div>}<p>{persistenceError()||"IndexedDB mirror: no recorded write error"}</p><button onClick={()=>{if(window.confirm("Recover library from IndexedDB mirror?"))void recoverLibraryMirror().catch(e=>setError(String(e)));}}>Recover mirror</button></div>}
    {backup&&<div className="space-y-1"><textarea aria-label="Chart settings backup" className="w-full h-20 bg-background border border-border text-xs" value={overrideText} onChange={e=>setOverrideText(e.target.value)}/><button onClick={()=>attempt(()=>{if(window.confirm("Replace chart indicator settings?"))restoreOverrides(overrideText);})}>Restore chart settings</button></div>}
    {getLibraryError() && <p role="alert" className="text-xs">Stored library could not be loaded.</p>}
    {draft && <div className="border border-border rounded p-2 text-xs space-y-2">
      <div className="font-semibold">{draft.name} · {draft.version}</div>
      <IndicatorPreview draft={draft}/><p className="text-muted-foreground">Illustrative preview · sample data</p>
      <div>{draft.kind} · {localEdit?scope+" chart":"library definition"}</div><label>Name <input className="w-full bg-background border border-border" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      {draft.kind==="expression" && <label>Formula (OHLCV arithmetic)<input className="w-full bg-background border border-border" value={draft.expression} onChange={e=>setDraft({...draft,expression:e.target.value})}/></label>}
      {draft.kind==="session-candle" ? <><label className="block">Opening <input type="time" className="bg-background" value={draft.open} onChange={e=>setDraft({...draft,open:e.target.value})}/></label><label className="block">Closing <input type="time" className="bg-background" value={draft.close} onChange={e=>setDraft({...draft,close:e.target.value})}/></label><label className="block">Time zone <input className="w-full bg-background border border-border" value={draft.timezone} onChange={e=>setDraft({...draft,timezone:e.target.value})}/></label></>:<label>Period <input type="number" min={1} max={5000} className="w-20 bg-background" value={draft.period} onChange={e=>setDraft({...draft,period:Number(e.target.value)})}/></label>}
      {draft.kind==="session-candle" && <div className="space-y-1"><label>Bearish <input type="color" value={draft.downColor} onChange={e=>setDraft({...draft,downColor:e.target.value})}/></label><label> Lines <input type="color" value={draft.lineColor} onChange={e=>setDraft({...draft,lineColor:e.target.value})}/></label>{(["offset","width","lineWidth","opacity"] as const).map(k=><label key={k} className="block">{k} <input type="number" step={k==="opacity"?0.1:1} className="w-16 bg-background" value={draft[k]} onChange={e=>setDraft({...draft,[k]:Number(e.target.value)})}/></label>)}{(["showOpen","showClose","showOpenPrice","showHighLow","showCandle","showWicks","showLabels"] as const).map(k=><label key={k} className="block"><input type="checkbox" checked={draft[k]} onChange={e=>setDraft({...draft,[k]:e.target.checked})}/> {k}</label>)}<div>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day,i)=><label key={day} className="mr-1"><input type="checkbox" checked={draft.days.includes(i)} onChange={e=>setDraft({...draft,days:e.target.checked?[...draft.days,i]:draft.days.filter(d=>d!==i)})}/>{day}</label>)}</div></div>}
      {draft.kind!=="session-candle"&&draft.kind!=="graphics"&&<label className="block">Aggregate (minutes) <select className="bg-background" value={draft.aggregation} onChange={e=>setDraft({...draft,aggregation:Number(e.target.value)})}>{[0,15,30,60,120,240,360,720,1440,10080].map(n=><option key={n} value={n}>{n===0?"Chart":n}</option>)}</select></label>}
      <label>Color <input type="color" value={draft.color} onChange={e=>setDraft({...draft,color:e.target.value})}/></label>
      <div className="flex gap-2"><button onClick={()=>attempt(()=>{const value=indicatorSchema.parse(draft); if(localEdit)saveOverride(scope,value);else if(library.some(x=>x.id===value.id)){if(!window.confirm("Replace installed indicator definition?"))return;updateIndicator(value);}else installIndicator(value);setDraft(null);})}>Save</button><button onClick={()=>setDraft(null)}>Cancel</button></div>
    </div>}
    {viewSource!==null&&<div className="space-y-1"><textarea readOnly aria-label="Indicator definition source" className="w-full h-32 bg-background border border-border font-mono text-xs" value={viewSource}/><button onClick={()=>setViewSource(null)}>Close source</button></div>}
    {error && <p role="alert" className="text-xs text-red-400 break-words">{error}</p>}
    {library.length>0 && <input aria-label="Search imported indicators" className="w-full bg-background border border-border rounded px-1 text-xs" placeholder="Search imported" value={query} onChange={e=>setQuery(e.target.value)}/>}
    {library.filter(x=>(!favorites||x.favorite)&&x.name.toLowerCase().includes(query.toLowerCase())).map(x=>{
      const id:IndicatorType=`custom:${x.id}`;
      return <div key={x.id} className="flex gap-2 items-center text-xs px-1">
        <button className="flex-1 text-left truncate" aria-pressed={active.includes(id)} onClick={()=>attempt(()=>{if(!active.includes(id)&&active.filter(x=>x.startsWith("custom:")).length>=admin.maxActive)throw new Error("Active indicator limit reached");toggle(id);})}>{active.includes(id)?"✓ ":"+ "}{x.name}</button>
        <button aria-label={"Favorite "+x.name} onClick={()=>attempt(()=>updateIndicator({...x,favorite:!x.favorite}))}>{x.favorite?"★":"☆"}</button>
        <button aria-label={"Duplicate "+x.name} onClick={()=>attempt(()=>duplicateIndicator(x.id))}>Copy</button>
        {versions(x.id).length>0 && <button aria-label={"Restore previous version of "+x.name} onClick={()=>attempt(()=>{if(window.confirm("Restore previous settings?"))updateIndicator(versions(x.id)[0]!);})}>↶</button>}
        <button aria-label={"View source "+x.name} onClick={()=>setViewSource("export default "+JSON.stringify(x,null,2)+";")}>Code</button>
        <button aria-label={"Configure "+x.name} onClick={()=>{setLocalEdit(true);setDraft(resolveIndicator(x,overrides));}}>Edit</button>
        <button aria-label={"Reset chart settings for "+x.name} onClick={()=>attempt(()=>resetOverride(scope,x.id))}>Reset</button>
        <button aria-label={"Export "+x.name} onClick={()=>{const url=URL.createObjectURL(new Blob(["export default "+JSON.stringify(x,null,2)+";"],{type:"text/plain"}));const a=document.createElement("a");a.href=url;a.download=x.id+".ts";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>↓</button>
        <button aria-label={"Uninstall "+x.name} onClick={()=>attempt(()=>{if(!window.confirm("Uninstall "+x.name+"?"))return;removeIndicator(x.id);clearOverrides(x.id);if(active.includes(id))toggle(id);})}>×</button>
      </div>;
    })}
  </div>;
}
