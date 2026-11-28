import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitivePaneView, ISeriesPrimitivePaneRenderer, Time, DataChangedScope } from "lightweight-charts";
import { PluginBase } from "../chart-plugins/plugin-base";
import type { ImportedIndicator } from "./schema";
import { sessionRange, sessionPeriodLabel, projectedCandleX, type SessionRange } from "./session";
import type { CandleData } from "../indicators";
import type {BestHoursAnalysis} from "./best-hours";

/** Resolve a wall-clock hour to its real timestamp inside the active session.
 * Minute-by-minute lookup respects IANA timezone offsets and naturally skips DST gaps.
 */
export function resolveBestHourTimestamps(sessionStart:number,sessionEnd:number,hour:number,timezone:string):number[] {
  if(!Number.isFinite(sessionStart)||!Number.isFinite(sessionEnd)||sessionEnd<=sessionStart||!Number.isInteger(hour)||hour<0||hour>23)return [];
  let formatter:Intl.DateTimeFormat;
  try{formatter=new Intl.DateTimeFormat("en-GB",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});}catch{return [];}
  const dates=new Set<string>(),matches:number[]=[];
  for(let timestamp=Math.ceil(sessionStart/60)*60;timestamp<sessionEnd;timestamp+=60){
    const parts=Object.fromEntries(formatter.formatToParts(new Date(timestamp*1000)).map(part=>[part.type,part.value]));
    if(Number(parts.hour)!==hour||Number(parts.minute)!==0)continue;
    const date=String(parts.year)+"-"+String(parts.month)+"-"+String(parts.day);
    if(dates.has(date))continue;
    dates.add(date);matches.push(timestamp);
  }
  return matches;
}
export function resolveBestHourTimestamp(sessionStart:number,sessionEnd:number,hour:number,timezone:string):number|null {
  return resolveBestHourTimestamps(sessionStart,sessionEnd,hour,timezone)[0]??null;
}

export class SessionCandlePrimitive extends PluginBase {
  private range: SessionRange|null=null;
  private timer:ReturnType<typeof setInterval>|undefined;
  private readonly view: ISeriesPrimitivePaneView;
  private bestHourCacheKey="";
  private bestHourCache:Array<{hour:number;time:number;startLabel:string;endLabel:string;mean:number;rank:number}>=[];
  constructor(private readonly config:ImportedIndicator,private readonly sourceSeconds=60,private readonly maxBars=5000,private readonly replayData?:readonly import("lightweight-charts").CandlestickData<Time>[],private readonly independentData?:readonly CandleData[],private readonly independentSeconds=60,private readonly bestHours?:BestHoursAnalysis,_bestHourCandles:readonly CandleData[]=[]) {
    super();
    this.view={renderer:()=>({draw:(target:CanvasRenderingTarget2D)=>this.draw(target)} satisfies ISeriesPrimitivePaneRenderer)};
  }
  public override attached(param:Parameters<PluginBase["attached"]>[0]) {if(this.timer!==undefined)clearInterval(this.timer);this.timer=undefined;super.attached(param);this.refresh();if(!this.replayData)this.timer=setInterval(()=>this.refresh(),1000);}
  public override detached(){if(this.timer!==undefined)clearInterval(this.timer);this.timer=undefined;super.detached();}
  protected override dataUpdated(_scope:DataChangedScope) {this.refresh();}
  private refresh() {
    const candles:CandleData[]=this.independentData?[...this.independentData]:(this.replayData??this.series.data()).slice(-this.maxBars).flatMap(x=>typeof x.time==="number" && "open" in x && "close" in x && "high" in x && "low" in x ? [{time:x.time,open:x.open,high:x.high,low:x.low,close:x.close}] : []);
    this.range=sessionRange(candles,this.config,this.independentData?this.independentSeconds:this.sourceSeconds,this.replayData?(typeof this.replayData[this.replayData.length-1]?.time==="number"?Number(this.replayData[this.replayData.length-1]!.time):undefined):Math.floor(Date.now()/1000),this.independentData!==undefined);
    this.requestUpdate();
  }
  paneViews():readonly ISeriesPrimitivePaneView[]{return [this.view];}
  private draw(target:CanvasRenderingTarget2D) {
    const r=this.range;if(!r)return;
    const scale=this.chart.timeScale();
    const data=this.replayData??this.series.data(); const last=data[data.length-1]; if(!last)return;
    const xLast=scale.timeToCoordinate(last.time);if(xLast===null)return;
    const xPrev=data.length>1?scale.timeToCoordinate(data[data.length-2]!.time):null;
    const step=xPrev===null?6:Math.max(1,xLast-xPrev);
    const rangeLast=[...data].reverse().find(b=>typeof b.time==="number"&&b.time>=r.start&&b.time<r.end);
    const rangeLastX=rangeLast?scale.timeToCoordinate(rangeLast.time):null;
    const yO=this.series.priceToCoordinate(r.open), yC=this.series.priceToCoordinate(r.close), yH=this.series.priceToCoordinate(r.high), yL=this.series.priceToCoordinate(r.low);
    const numericData=data.flatMap(bar=>typeof bar.time==="number"?[{time:bar.time}]:[]);
    const coordinateStepSeconds=this.independentData?this.independentSeconds:this.sourceSeconds;
    const timeX=(t:number)=>{
      const direct=scale.timeToCoordinate(t as Time);if(direct!==null)return direct;
      const upper=numericData.findIndex(bar=>bar.time>t);
      if(upper>0){
        const left=numericData[upper-1]!,right=numericData[upper]!;
        const leftX=scale.timeToCoordinate(left.time as Time),rightX=scale.timeToCoordinate(right.time as Time);
        if(leftX!==null&&rightX!==null&&right.time>left.time)return leftX+(rightX-leftX)*(t-left.time)/(right.time-left.time);
      }
      const first=numericData[0],lastNumeric=numericData[numericData.length-1];
      if(!first||!lastNumeric||coordinateStepSeconds<=0)return null;
      if(t<first.time){const firstX=scale.timeToCoordinate(first.time as Time);return firstX===null?null:firstX+(t-first.time)/coordinateStepSeconds*step;}
      if(t>lastNumeric.time){const lastX=scale.timeToCoordinate(lastNumeric.time as Time);return lastX===null?null:lastX+(t-lastNumeric.time)/coordinateStepSeconds*step;}
      return null;
    };
    target.useMediaCoordinateSpace(({context:ctx,mediaSize})=>{
      const closeX=timeX(r.sessionEnd??r.end);
      const anchorX=rangeLastX??(this.independentData?timeX(this.independentData[this.independentData.length-1]?.time??r.start):null);
      const projected=anchorX===null?null:projectedCandleX(anchorX,step,this.config.offset,this.config.width,mediaSize.width,closeX);
      const x=projected??Math.min(mediaSize.width-this.config.width/2-2,Math.max(this.config.width/2+2,anchorX??xLast));
      const showProjected=projected!==null||anchorX!==null;
      const line=(x1:number,y1:number,x2:number,y2:number,dash:number[]=[])=>{ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
      ctx.save();ctx.globalAlpha=this.config.opacity;ctx.lineWidth=this.config.lineWidth;ctx.strokeStyle=this.config.lineColor;
      const start=timeX(r.sessionStart??r.start),end=closeX,rangeStart=timeX(r.start),hi=timeX(r.highTime),lo=timeX(r.lowTime);
      if(start!==null){if(this.config.showOpen)line(start,0,start,mediaSize.height);if(this.config.showOpenPrice&&rangeStart!==null&&yO!==null)line(rangeStart,yO,x,yO,[6,4]);}
      if(this.config.showClose&&end!==null){const visibleEnd=Math.max(0,Math.min(mediaSize.width-1,end));line(visibleEnd,0,visibleEnd,mediaSize.height,end!==visibleEnd?[3,4]:[]);if(end!==visibleEnd&&this.config.showLabels){ctx.fillStyle=this.config.lineColor;ctx.font="10px sans-serif";ctx.textAlign=end>visibleEnd?"right":"left";ctx.fillText(this.config.close+(end>visibleEnd?" ›":" ‹"),end>visibleEnd?visibleEnd-4:visibleEnd+4,12);}}
      if(this.config.showHighLow&&showProjected){if(hi!==null&&yH!==null)line(hi,yH,x,yH);if(lo!==null&&yL!==null)line(lo,yL,x,yL);}
      ctx.strokeStyle=r.close>=r.open?this.config.color:this.config.downColor;ctx.fillStyle=ctx.strokeStyle;
      if(showProjected&&this.config.showCandle&&this.config.showWicks&&yH!==null&&yL!==null)line(x,yH,x,yL);
      if(showProjected&&this.config.showCandle&&yO!==null&&yC!==null)ctx.fillRect(x-this.config.width/2,Math.min(yO,yC),this.config.width,Math.max(1,Math.abs(yO-yC)));
      if(showProjected&&this.config.showLabels){const label=sessionPeriodLabel(this.config)+(r.closed?"":" · partial");ctx.font="11px sans-serif";ctx.textAlign="center";if(yH!==null)ctx.fillText(label,x,yH-7);if(yL!==null)ctx.fillText(label,x,yL+14);}
      if(this.config.bestHoursEnabled&&this.bestHours){
        const ranked=this.bestHours.ranking.slice(0,this.config.bestHoursCount);
        const sessionStart=r.sessionStart??r.start,sessionEnd=r.sessionEnd??r.end;
        const cacheKey=JSON.stringify([sessionStart,sessionEnd,this.config.timezone,ranked.map(row=>[row.hour,row.startLabel,row.endLabel,row.mean])]);
        if(cacheKey!==this.bestHourCacheKey){
          this.bestHourCacheKey=cacheKey;
          const seen=new Set<number>();
          this.bestHourCache=ranked.flatMap((row,index)=>resolveBestHourTimestamps(sessionStart,sessionEnd,row.hour,this.config.timezone).flatMap(time=>{
            if(seen.has(time))return [];
            seen.add(time);
            return [{hour:row.hour,time,startLabel:row.startLabel,endLabel:row.endLabel,mean:row.mean,rank:index+1}];
          }));
        }
        ctx.strokeStyle=this.config.bestHoursLineColor;ctx.fillStyle=this.config.bestHoursLineColor;
        ctx.lineWidth=this.config.bestHoursLineWidth;ctx.globalAlpha=this.config.bestHoursOpacity;
        const dash=this.config.bestHoursLineStyle==="dotted"?[2,3]:this.config.bestHoursLineStyle==="dashed"?[6,4]:[];
        for(const [index,result] of this.bestHourCache.entries()){
          const markerX=timeX(result.time);if(markerX===null)continue;
          const future=typeof last.time==="number"&&result.time>last.time;
          if(!future&&(markerX<0||markerX>mediaSize.width))continue;
          const visibleX=Math.max(0,Math.min(mediaSize.width-1,markerX));
          line(visibleX,0,visibleX,mediaSize.height,dash);
          if(this.config.bestHoursLabels){
            ctx.font="10px sans-serif";
            const align=visibleX>mediaSize.width*0.72?"right":"left";
            ctx.textAlign=align;
            const labelX=align==="right"?visibleX-4:visibleX+4;
            ctx.fillText(`${result.startLabel}–${result.endLabel} | ${result.rank}º | ${result.mean.toFixed(2)}% | ${this.bestHours.period}d`,labelX,12+index*12);
          }
        }
      }
      ctx.restore();
    });
  }
}
