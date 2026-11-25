import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitivePaneView, ISeriesPrimitivePaneRenderer, Time, DataChangedScope } from "lightweight-charts";
import { PluginBase } from "../chart-plugins/plugin-base";
import type { ImportedIndicator } from "./schema";
import { sessionRange, sessionPeriodLabel, projectedCandleX, type SessionRange } from "./session";
import type { CandleData } from "../indicators";
import type {BestHoursAnalysis} from "./best-hours";

export class SessionCandlePrimitive extends PluginBase {
  private range: SessionRange|null=null;
  private timer:ReturnType<typeof setInterval>|undefined;
  private readonly view: ISeriesPrimitivePaneView;
  constructor(private readonly config:ImportedIndicator,private readonly sourceSeconds=60,private readonly maxBars=5000,private readonly replayData?:readonly import("lightweight-charts").CandlestickData<Time>[],private readonly independentData?:readonly CandleData[],private readonly independentSeconds=60,private readonly bestHours?:BestHoursAnalysis,private readonly bestHourCandles:readonly CandleData[]=[]) {
    super();
    this.view={renderer:()=>({draw:(target:CanvasRenderingTarget2D)=>this.draw(target)} satisfies ISeriesPrimitivePaneRenderer)};
  }
  public override attached(param:Parameters<PluginBase["attached"]>[0]) {super.attached(param);this.refresh();if(!this.replayData)this.timer=setInterval(()=>this.refresh(),1000);}
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
    if(yO===null||yC===null||yH===null||yL===null)return;
    const timeX=(t:number)=>{const direct=scale.timeToCoordinate(t as Time);if(direct!==null)return direct;const prev=data[data.length-2];const interval=prev?this.sourceSeconds:0;return interval>0&&typeof last.time==="number"?xLast+(t-last.time)/interval*step:null;};
    target.useMediaCoordinateSpace(({context:ctx,mediaSize})=>{
      const closeX=timeX(r.sessionEnd??r.end);
      const anchorX=rangeLastX??(this.independentData?timeX(this.independentData[this.independentData.length-1]?.time??r.start):null);
      const projected=anchorX===null?null:projectedCandleX(anchorX,step,this.config.offset,this.config.width,mediaSize.width,closeX);
      const x=projected??Math.min(mediaSize.width-this.config.width/2-2,Math.max(this.config.width/2+2,anchorX??xLast));
      const showProjected=projected!==null||anchorX!==null;
      const line=(x1:number,y1:number,x2:number,y2:number,dash:number[]=[])=>{ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
      ctx.save();ctx.globalAlpha=this.config.opacity;ctx.lineWidth=this.config.lineWidth;ctx.strokeStyle=this.config.lineColor;
      const start=timeX(r.sessionStart??r.start),end=closeX,rangeStart=timeX(r.start),hi=timeX(r.highTime),lo=timeX(r.lowTime);
      if(start!==null){if(this.config.showOpen)line(start,0,start,mediaSize.height);if(this.config.showOpenPrice&&rangeStart!==null)line(rangeStart,yO,x,yO,[6,4]);}
      if(this.config.showClose&&end!==null){const visibleEnd=Math.max(0,Math.min(mediaSize.width-1,end));line(visibleEnd,0,visibleEnd,mediaSize.height,end!==visibleEnd?[3,4]:[]);if(end!==visibleEnd&&this.config.showLabels){ctx.fillStyle=this.config.lineColor;ctx.font="10px sans-serif";ctx.textAlign=end>visibleEnd?"right":"left";ctx.fillText(this.config.close+(end>visibleEnd?" ›":" ‹"),end>visibleEnd?visibleEnd-4:visibleEnd+4,12);}}
      if(this.config.showHighLow&&showProjected){if(hi!==null)line(hi,yH,x,yH);if(lo!==null)line(lo,yL,x,yL);}
      ctx.strokeStyle=r.close>=r.open?this.config.color:this.config.downColor;ctx.fillStyle=ctx.strokeStyle;
      if(showProjected&&this.config.showCandle&&this.config.showWicks)line(x,yH,x,yL);
      if(showProjected&&this.config.showCandle)ctx.fillRect(x-this.config.width/2,Math.min(yO,yC),this.config.width,Math.max(1,Math.abs(yO-yC)));
      if(showProjected&&this.config.showLabels){const label=sessionPeriodLabel(this.config)+(r.closed?"":" · partial");ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText(label,x,yH-7);ctx.fillText(label,x,yL+14);}
      if(this.config.bestHoursEnabled&&this.bestHours){const ranked=this.bestHours.ranking.slice(0,this.config.bestHoursCount);const formatter=new Intl.DateTimeFormat("en-GB",{timeZone:this.config.timezone,hour:"2-digit",hourCycle:"h23"});const sessionStart=r.sessionStart??r.start,sessionEnd=r.sessionEnd??r.end;ctx.strokeStyle=this.config.bestHoursLineColor;ctx.fillStyle=this.config.bestHoursLineColor;ctx.lineWidth=this.config.bestHoursLineWidth;ctx.globalAlpha=this.config.bestHoursOpacity;const dash=this.config.bestHoursLineStyle==="dotted"?[2,3]:this.config.bestHoursLineStyle==="dashed"?[6,4]:[];for(const [index,result] of ranked.entries()){const candle=this.bestHourCandles.find(row=>row.time>=sessionStart&&row.time+3600<=sessionEnd&&Number(formatter.format(new Date(row.time*1000)))===result.hour);if(!candle)continue;const startX=timeX(Math.max(candle.time,sessionStart)),endX=timeX(Math.min(candle.time+3600,sessionEnd)),priceY=this.series.priceToCoordinate(candle.open);if(startX===null||endX===null||priceY===null)continue;line(startX,priceY,endX,priceY,dash);if(this.config.bestHoursLabels){ctx.font="10px sans-serif";ctx.textAlign="left";ctx.fillText(`${result.startLabel}–${result.endLabel} | ${index+1}º | ${result.mean.toFixed(2)}% | ${this.bestHours.period}d`,Math.max(2,startX+3),priceY-4);}}}
      ctx.restore();
    });
  }
}
