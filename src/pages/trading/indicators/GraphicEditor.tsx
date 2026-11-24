import {useState} from "react";
import {IndicatorErrorNotice} from "./IndicatorErrorNotice";
import {graphicSchema,validateGraphics,type Graphic} from "../../../lib/indicator-sdk/graphics";
const graphicLabels={line:"Linha",horizontal:"Horizontal",vertical:"Vertical",box:"Retângulo",text:"Texto",arrow:"Seta",table:"Tabela",candle:"Vela"};
const types=["line","horizontal","vertical","box","text","arrow","table","candle"] as const;
export function GraphicEditor({rows,color,onChange}:{rows:Graphic[];color:string;onChange:(rows:Graphic[])=>void}){
 const [kind,setKind]=useState<Graphic["type"]>("line");const [error,setError]=useState("");
 const change=(next:unknown)=>{try{onChange(validateGraphics(next));setError("");}catch(e){setError(String(e));}};
 const add=()=>{const at={bars:0,price:0},from={bars:-10,price:0},to={bars:0,price:0};const base={type:kind,color,anchor:"close",id:crypto.randomUUID()};const fields=kind==="horizontal"?{price:0}:kind==="vertical"?{bars:0}:kind==="text"?{at,text:"Rótulo"}:kind==="table"?{at,rows:[["Rótulo","Valor"]]}:kind==="candle"?{bars:0,open:0,high:1,low:-1,close:0}:{from,to};try{change([...rows,graphicSchema.parse({...base,...fields})]);}catch(e){setError(String(e));}};
 return <div className="space-y-2"><div className="flex gap-2"><select value={kind} onChange={e=>setKind(e.target.value as Graphic["type"])}>{types.map(t=><option key={t} value={t}>{graphicLabels[t]}</option>)}</select><button disabled={rows.length>=100} onClick={add}>Adicionar objeto</button></div>{rows.map((g,i)=><details key={g.id??i} className="border border-border rounded p-1"><summary>{graphicLabels[g.type]} · {i+1}</summary><ObjectFields value={g} onSave={next=>change(rows.map((x,j)=>j===i?next:x))}/><button onClick={()=>change(rows.filter((_,j)=>j!==i))}>Remover</button></details>)}{error&&<IndicatorErrorNotice error={error} context="graphics" onDismiss={()=>setError("")}/>}</div>;
}
function ObjectFields({value,onSave}:{value:Graphic;onSave:(value:unknown)=>void}){
 const [source,setSource]=useState(JSON.stringify(value,null,2));const [error,setError]=useState("");
 return <div className="space-y-1"><textarea aria-label="Propriedades do objeto" className="w-full h-32 bg-background font-mono" value={source} onChange={e=>setSource(e.target.value)}/><button onClick={()=>{try{onSave(graphicSchema.parse(JSON.parse(source)));setError("");}catch(e){setError(String(e));}}}>Aplicar propriedades</button>{error&&<IndicatorErrorNotice error={error} context="graphics" onDismiss={()=>setError("")}/>}</div>;
}
