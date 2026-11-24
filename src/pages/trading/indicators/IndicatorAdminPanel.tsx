import {useState,type ReactNode} from "react";
import {useIndicatorAdmin,saveIndicatorAdmin,adminSchema,type IndicatorAdmin} from "../../../lib/indicator-sdk/admin";
import {useIndicatorDiagnostics,resetDiagnostics} from "../../../lib/indicator-sdk/diagnostics";
import {usePersistenceError} from "../../../lib/indicator-sdk/database";
import {recoverLibraryMirror} from "../../../lib/indicator-sdk/storage";
import type {ChartScope} from "../../../lib/indicator-sdk/instances";
function Section({title,children,initial=false}:{title:string;children:ReactNode;initial?:boolean}){
 return <details open={initial} className="rounded border border-border"><summary className="cursor-pointer px-2 py-2 font-medium">{title}</summary><div className="space-y-2 border-t border-border p-2">{children}</div></details>;
}
function LimitFields({config,onError}:{config:IndicatorAdmin;onError:(message:string)=>void}){
 const [active,setActive]=useState(String(config.maxActive));const [bars,setBars]=useState(String(config.maxBars));
 const parsed=adminSchema.safeParse({...config,maxActive:Number(active),maxBars:Number(bars)});
 const valid=active.trim()!==""&&bars.trim()!==""&&parsed.success;
 const dirty=active!==String(config.maxActive)||bars!==String(config.maxBars);
 return <form className="space-y-2" onSubmit={e=>{e.preventDefault();if(!valid||!parsed.success)return;try{saveIndicatorAdmin(parsed.data);onError("");}catch(e){onError(String(e));}}}>
 <label className="block">Limite de indicadores ativos<input className="mt-1 w-full rounded border border-border bg-background px-2 py-1" type="number" min={1} max={30} step={1} value={active} onChange={e=>setActive(e.target.value)}/></label><p className="text-muted-foreground">De 1 a 30 por gráfico.</p>
 <label className="block">Limite de velas históricas<input className="mt-1 w-full rounded border border-border bg-background px-2 py-1" type="number" min={100} max={20000} step={1} value={bars} onChange={e=>setBars(e.target.value)}/></label><p className="text-muted-foreground">De 100 a 20.000 por cálculo. Limites maiores podem aumentar o consumo de memória.</p>
 {!valid&&<p role="alert" className="text-red-400">Informe valores inteiros dentro dos limites permitidos.</p>}
 <div className="flex flex-wrap gap-2"><button type="submit" disabled={!valid||!dirty} className="rounded border border-border px-2 py-1 disabled:opacity-40">Aplicar limites</button><button type="button" disabled={!dirty} onClick={()=>{setActive(String(config.maxActive));setBars(String(config.maxBars));}} className="rounded px-2 py-1 disabled:opacity-40">Cancelar alterações</button></div></form>;
}
export function IndicatorAdminPanel({scope,installed,activeCount,onError}:{scope:ChartScope;installed:number;activeCount:number;onError:(message:string)=>void}){
 const admin=useIndicatorAdmin();const diagnostics=useIndicatorDiagnostics();const storageError=usePersistenceError();const [recovering,setRecovering]=useState(false);const [recovered,setRecovered]=useState(false);
 const rows=diagnostics.filter(x=>x.scope===scope);const label=scope==="primary"?"principal":"secundário";
 return <section aria-label="Administração de indicadores" className="space-y-2 rounded border border-border p-2 text-xs">
 <div className="grid grid-cols-2 gap-2"><div className="rounded bg-secondary/50 p-2"><p className="text-muted-foreground">Instalados</p><p className="font-semibold tabular-nums">{installed}</p></div><div className="rounded bg-secondary/50 p-2"><p className="text-muted-foreground">Ativos · {label}</p><p className="font-semibold tabular-nums">{activeCount}/{admin.maxActive}</p></div></div>
 <p className="text-muted-foreground">SDK 1 · limites globais, diagnóstico por gráfico.</p>
 <Section title="Limites de execução" initial><LimitFields key={admin.maxActive+":"+admin.maxBars} config={admin} onError={onError}/></Section>
 <Section title="Desempenho e diagnóstico"><label className="flex items-center gap-2"><input type="checkbox" checked={admin.diagnostics} onChange={e=>{try{saveIndicatorAdmin({...admin,diagnostics:e.target.checked});onError("");}catch(e){onError(String(e));}}}/> Ativar diagnóstico de desempenho</label>
 {admin.diagnostics&&<><p className="text-muted-foreground">Gráfico {label} · {rows.length} registros</p><div className="max-h-40 overflow-y-auto">{rows.length===0&&<p>Nenhum cálculo registrado.</p>}{rows.map(x=><div key={x.id} className="space-y-1 border-t border-border py-2"><p className="font-medium break-all">{x.id}</p><p className="tabular-nums">{x.ms.toFixed(2)} ms · {x.bars} velas · {x.mode==="full"?"completo":x.mode==="incremental"?"incremental":"cache"}</p>{x.estimatedBytes!==undefined&&<p>Cache estimado: ~{Math.ceil(x.estimatedBytes/1024)} KiB</p>}{x.slow&&<p className="text-amber-400">Cálculo lento</p>}{x.error&&<p className="text-red-400 break-words">{x.error} ({x.failures})</p>}{x.history.length>0&&<details><summary>Histórico de erros ({x.history.length})</summary>{x.history.map((e,i)=><p key={i}>{new Date(e.at).toLocaleTimeString("pt-BR")} · {e.message}</p>)}</details>}</div>)}</div><button type="button" className="rounded border border-border px-2 py-1" onClick={resetDiagnostics}>Limpar diagnóstico de todos os gráficos</button></>}
 <p className="text-muted-foreground">Após três falhas consecutivas, o cálculo é pausado. Desative e reative o indicador para tentar novamente.</p></Section>
 <Section title="Segurança"><p>Execução de código arbitrário: bloqueada.</p><p>Acesso à carteira e à rede por indicadores importados: bloqueado.</p><p className="text-muted-foreground">Somente definições e fórmulas validadas são permitidas.</p></Section>
 <Section title="Armazenamento e recuperação"><p role={storageError?"alert":"status"} className={storageError?"text-red-400 break-words":"text-muted-foreground"}>{storageError||"IndexedDB: nenhum erro de armazenamento registrado"}</p><button type="button" disabled={recovering} className="rounded border border-border px-2 py-1 disabled:opacity-40" onClick={()=>{if(!window.confirm("Recuperar biblioteca da cópia no IndexedDB?"))return;setRecovered(false);setRecovering(true);void recoverLibraryMirror().then(()=>{setRecovered(true);onError("");}).catch(e=>onError(String(e))).finally(()=>setRecovering(false));}}>{recovering?"Recuperando…":"Recuperar cópia"}</button>{recovered&&<p role="status">Operação de recuperação concluída.</p>}</Section>
 </section>;
}
