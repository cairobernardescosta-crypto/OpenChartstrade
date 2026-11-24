import {parameterValues,indicatorSchema,type ImportedIndicator} from "../../../lib/indicator-sdk/schema";
import {expressionPoints} from "../../../lib/indicator-sdk/expression";
import {sessionPeriodLabel} from "../../../lib/indicator-sdk/session";
import {sma,ema} from "../../../lib/indicators";
const candles=Array.from({length:80},(_,i)=>{const open=100+Math.sin(i/6)*5+i/10;const close=open+Math.sin(i*1.3)*2;return {time:i,open,close,high:Math.max(open,close)+1,low:Math.min(open,close)-1,volume:100+i};});
export function IndicatorPreview({draft}:{draft:ImportedIndicator}){
  const result=indicatorSchema.safeParse(draft);
  if(!result.success)return <p className="text-xs text-muted-foreground">Correct invalid settings to preview.</p>;
  const c=result.data;
  if(c.kind==="session-candle"){const sample=candles.slice(0,20);const high=Math.max(...sample.map(b=>b.high)),low=Math.min(...sample.map(b=>b.low));const open=sample[0]!.open,close=sample[sample.length-1]!.close;const y=(v:number)=>100-(v-low)/(high-low||1)*80;const hi=sample.findIndex(b=>b.high===high),lo=sample.findIndex(b=>b.low===low);const x=Math.min(255,174+c.offset*3);const fill=close>=open?c.color:c.downColor;return <svg viewBox="0 0 280 120" className="w-full border border-border rounded" role="img" aria-label="Illustrative session candle preview">
    <g opacity={c.opacity} stroke={c.lineColor} strokeWidth={c.lineWidth}>
      {c.showOpen&&<line x1="15" y1="5" x2="15" y2="110"/>}{c.showClose&&<line x1="265" y1="5" x2="265" y2="110"/>}
      {c.showOpenPrice&&<line x1="15" y1={y(open)} x2={x} y2={y(open)} strokeDasharray="6 4"/>}
      {c.showHighLow&&<><line x1={22+hi*8} y1={y(high)} x2={x} y2={y(high)}/><line x1={22+lo*8} y1={y(low)} x2={x} y2={y(low)}/></>}
      {sample.map((b,i)=>{return <g key={i} stroke="currentColor" strokeWidth="0.8"><line x1={22+i*8} x2={22+i*8} y1={y(b.high)} y2={y(b.low)}/><rect x={19+i*8} y={Math.min(y(b.open),y(b.close))} width="6" height={Math.max(1,Math.abs(y(b.open)-y(b.close)))} fill={b.close>=b.open?c.color:c.downColor}/></g>;})}
      {c.showCandle&&<>{c.showWicks&&<line x1={x} x2={x} y1={y(high)} y2={y(low)} stroke={fill}/>}<rect x={x-c.width/2} y={Math.min(y(open),y(close))} width={c.width} height={Math.max(1,Math.abs(y(open)-y(close)))} fill={fill} stroke={fill}/></>}
    </g>{c.showLabels&&<g fontSize="8" fill="currentColor"><text x={x} y="12" textAnchor="middle">{sessionPeriodLabel(c)}</text><text x="15" y="118">{c.open}</text><text x="265" y="118" textAnchor="end">{c.close}</text></g>}
  </svg>;}
  if(c.kind==="graphics")return <p className="text-xs text-muted-foreground">{c.graphics.length} validated drawing commands. Activate on chart to view price-anchored objects.</p>;
  const points=c.kind==="expression"?expressionPoints(candles,c.expression,parameterValues(c)):(c.kind==="sma"?sma:ema)(candles,c.period);
  if(!points.length)return <p className="text-xs text-muted-foreground">Insufficient sample history for this period.</p>;
  const low=Math.min(...points.map(p=>p.value)),high=Math.max(...points.map(p=>p.value));
  const coords=points.map(p=>((p.time/79)*260+10)+","+(105-(p.value-low)/(high-low||1)*90)).join(" ");
  return <svg viewBox="0 0 280 120" className="w-full border border-border rounded" role="img" aria-label="Indicator preview using synthetic data"><polyline points={coords} fill="none" stroke={c.color} strokeWidth={c.lineWidth} opacity={c.opacity}/></svg>;
}
