import {useEffect,useState} from "react";
import {parameterValues,indicatorSchema,type ImportedIndicator} from "../../../lib/indicator-sdk/schema";
import {expressionPoints} from "../../../lib/indicator-sdk/expression";
import {sessionPeriodLabel,sessionRange} from "../../../lib/indicator-sdk/session";
import {sma,ema,type CandleData,type IndicatorPoint} from "../../../lib/indicators";
import {api} from "../../../services/api";
import {getAdapter} from "../../../adapter/registry";
import {resolveMarketSchedule} from "../../../lib/indicator-sdk/market-schedule";
import {SessionHistoryCache} from "../../../lib/indicator-sdk/session-history";
import {IndependentHistoryCache} from "../../../lib/indicator-sdk/independent-history";
import {aggregateCompleted} from "../../../lib/indicator-sdk/aggregate";
import {normalizePreviewCandles,previewStep} from "../../../lib/indicator-sdk/preview-data";
import {useIndicatorAdmin} from "../../../lib/indicator-sdk/admin";
const sessionCache=new SessionHistoryCache((symbol,tf,limit,range)=>api.getCandles(symbol,tf,limit,range));
const historyCache=new IndependentHistoryCache((symbol,tf,limit,toMs)=>api.getCandles(symbol,tf,limit,{toMs}));
const samples:CandleData[]=Array.from({length:100},(_,i)=>{const open=100+Math.sin(i/6)*5+i/10;const close=open+Math.sin(i*1.3)*2;return {time:Date.UTC(2026,0,5)/1000+i*60,open,close,high:Math.max(open,close)+1,low:Math.min(open,close)-1,volume:100+i};});
type Props={draft:ImportedIndicator;symbol?:string;timeframe?:string;replay?:boolean;chartCandles?:readonly CandleData[]};
type Preview={rows:CandleData[];step:number;cutoff:number;config:ImportedIndicator;label:string;error:string;aggregated:boolean};
export function IndicatorPreview({draft,symbol="",timeframe="1m",replay=false,chartCandles}:Props){
 const admin=useIndicatorAdmin();const [sample,setSample]=useState(false);const [state,setState]=useState<{key:string;value:Preview}|null>(null);
 const last=chartCandles?.[chartCandles.length-1]?.time;const replayCutoff=replay?(last??0):0;
 const configKey=JSON.stringify(draft);const key=JSON.stringify([configKey,symbol,timeframe,replay,replayCutoff,sample,admin.maxBars]);
 useEffect(()=>{const parsed=indicatorSchema.safeParse(JSON.parse(configKey));if(!parsed.success)return;let disposed=false;const load=async()=>{
 let c=parsed.data;let step=previewStep(timeframe);const cutoff=replay?replayCutoff:Math.floor(Date.now()/1000);let rows:CandleData[]=[];let error="";let aggregated=false;let label=sample?"Amostra ilustrativa · não representa dados de mercado":replay?"Replay · velas fechadas":symbol+" · "+timeframe+" · histórico de mercado";
 try{if(sample){rows=samples;step=60;c={...c,sessionSchedule:"utc-24h",sessionMinutes:"session",aggregation:0};}
 else if(!symbol||!cutoff)throw Error("Nenhum histórico do mercado selecionado");
 else if(c.kind==="session-candle"){if(c.sessionSchedule==="automatic"){const resolved=await resolveMarketSchedule(getAdapter().marketData,symbol,c,cutoff*1000);c=resolved.config;label+=" · "+resolved.message;}if(c.historySource==="independent"){const result=await sessionCache.get(symbol,c,cutoff,admin.maxBars);rows=result.rows;step=result.step;error=result.error;}else rows=normalizePreviewCandles(chartCandles??[],step,cutoff,admin.maxBars);}
 else if(c.historySource==="independent"&&c.aggregation){rows=await historyCache.get(symbol,c.aggregation,cutoff,c.gapPolicy);aggregated=true;label+=" · HTF independente";}
 else if(replay||chartCandles?.length){rows=normalizePreviewCandles(chartCandles??[],step,cutoff,admin.maxBars);}
 else rows=normalizePreviewCandles(await api.getCandles(symbol,timeframe,Math.min(admin.maxBars,5000),{toMs:cutoff*1000}),step,cutoff,admin.maxBars);
 }catch(e){error=String(e);}if(!disposed)setState({key,value:{rows,step,cutoff:sample?samples[samples.length-1]!.time+60:cutoff,config:c,label,error,aggregated}});};
 const timer=setTimeout(()=>void load(),250);return()=>{disposed=true;clearTimeout(timer);};
 },[key,configKey,symbol,timeframe,replay,replayCutoff,sample,admin.maxBars,chartCandles]);
 const result=indicatorSchema.safeParse(draft);if(!result.success)return <p className="text-xs text-muted-foreground">Corrija as configurações inválidas para visualizar a prévia.</p>;
 const value=state?.key===key?state.value:null;
 return <div className="space-y-1"><label className="block"><input type="checkbox" checked={sample} onChange={e=>setSample(e.target.checked)}/> Amostra ilustrativa</label>{!value?<p>Carregando prévia…</p>:<><p className="text-muted-foreground">{value.label} · {value.rows.length} velas</p>{value.error?<p role="alert">{value.error}</p>:<PreviewPlot data={value}/>}</>}</div>;
}
function PreviewPlot({data}:{data:Preview}){
 const {rows,step,cutoff,config:c,aggregated}=data;
 if(!rows.length)return <p>Nenhum histórico de velas fechadas disponível.</p>;
 if(c.kind==="session-candle"){const r=sessionRange(rows,c,step,cutoff,true);if(!r)return <p>Histórico insuficiente para cobrir a sessão.</p>;const y=(v:number)=>105-(v-r.low)/(r.high-r.low||1)*85;const x=(t:number)=>10+Math.max(0,Math.min(1,(t-r.start)/(r.end-r.start)))*210;const projected=250;const fill=r.close>=r.open?c.color:c.downColor;const stride=Math.max(1,Math.ceil(rows.length/80));return <svg viewBox="0 0 280 130" className="w-full border border-border rounded" role="img" aria-label="Prévia da vela da sessão"><g opacity={c.opacity} stroke={c.lineColor} strokeWidth={c.lineWidth}>{c.showOpen&&<line x1="10" y1="5" x2="10" y2="115"/>}{c.showClose&&<line x1="220" y1="5" x2="220" y2="115"/>}{c.showOpenPrice&&<line x1="10" y1={y(r.open)} x2={projected} y2={y(r.open)} strokeDasharray="4 3"/>}{c.showHighLow&&<><line x1={x(r.highTime)} y1={y(r.high)} x2={projected} y2={y(r.high)}/><line x1={x(r.lowTime)} y1={y(r.low)} x2={projected} y2={y(r.low)}/></>}{rows.filter((b,i)=>i%stride===0&&b.time>=r.start&&b.time<r.end).map(b=><g key={b.time} stroke={b.close>=b.open?c.color:c.downColor}><line x1={x(b.time)} x2={x(b.time)} y1={y(b.high)} y2={y(b.low)}/><rect x={x(b.time)-1} y={Math.min(y(b.open),y(b.close))} width="2" height={Math.max(1,Math.abs(y(b.open)-y(b.close)))} fill={b.close>=b.open?c.color:c.downColor}/></g>)}{c.showCandle&&<>{c.showWicks&&<line x1={projected} x2={projected} y1={y(r.high)} y2={y(r.low)} stroke={fill}/>}<rect x={projected-c.width/2} y={Math.min(y(r.open),y(r.close))} width={c.width} height={Math.max(1,Math.abs(y(r.open)-y(r.close)))} fill={fill} stroke={fill}/></>}</g>{c.showLabels&&<text x="250" y="12" textAnchor="middle" fontSize="9" fill="currentColor">{sessionPeriodLabel(c)}{r.closed?"":" parcial"}</text>}</svg>;}
 if(c.kind==="graphics")return <p>{c.graphics.length} objetos validados · último fechamento {rows[rows.length-1]!.close}. Ative no gráfico para visualizar as âncoras gráficas.</p>;
 let points:IndicatorPoint[];try{const bars=aggregated?rows:aggregateCompleted(rows,c.aggregation,step,true,c.gapPolicy,cutoff);points=c.kind==="expression"?expressionPoints(bars,c.expression,parameterValues(c)):(c.kind==="sma"?sma:ema)(bars,c.period);}catch(e){return <p role="alert">{String(e)}</p>;}
 if(!points.length)return <p>Histórico insuficiente para este período.</p>;
 points=points.slice(-240);const min=Math.min(...points.map(p=>p.value)),max=Math.max(...points.map(p=>p.value));const x=(i:number)=>10+i/Math.max(1,points.length-1)*260;const y=(v:number)=>105-(v-min)/(max-min||1)*90;const coords=points.map((p,i)=>x(i)+","+y(p.value)).join(" ");return <svg viewBox="0 0 280 120" className="w-full border border-border rounded" role="img" aria-label="Prévia do cálculo do indicador">{c.plot==="histogram"?points.map((p,i)=><rect key={p.time} x={x(i)} y={y(p.value)} width={Math.max(1,260/points.length-1)} height={Math.max(1,110-y(p.value))} fill={c.color} opacity={c.opacity}/>):<>{c.plot==="area"&&<polygon points={"10,110 "+coords+" 270,110"} fill={c.color} opacity={c.opacity*0.25}/>}<polyline points={coords} fill="none" stroke={c.color} strokeWidth={c.lineWidth} opacity={c.opacity}/></>}</svg>;
}
