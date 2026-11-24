import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitivePaneView, ISeriesPrimitivePaneRenderer, Time, DataChangedScope } from "lightweight-charts";
import { PluginBase } from "../chart-plugins/plugin-base";
import type { ImportedIndicator } from "./schema";
import { sessionRange, type SessionRange } from "./session";
import type { CandleData } from "../indicators";

export class SessionCandlePrimitive extends PluginBase {
  private range: SessionRange|null=null;
  private readonly view: ISeriesPrimitivePaneView;
  constructor(private readonly config:ImportedIndicator,private readonly sourceSeconds=60,private readonly maxBars=5000,private readonly replayData?:readonly import("lightweight-charts").CandlestickData<Time>[]) {
    super();
    this.view={renderer:()=>({draw:(target:CanvasRenderingTarget2D)=>this.draw(target)} satisfies ISeriesPrimitivePaneRenderer)};
  }
  public override attached(param:Parameters<PluginBase["attached"]>[0]) {super.attached(param);this.refresh();}
  protected override dataUpdated(_scope:DataChangedScope) {this.refresh();}
  private refresh() {
    const candles:CandleData[]=(this.replayData??this.series.data()).slice(-this.maxBars).flatMap(x=>typeof x.time==="number" && "open" in x && "close" in x && "high" in x && "low" in x ? [{time:x.time,open:x.open,high:x.high,low:x.low,close:x.close}] : []);
    this.range=sessionRange(candles,this.config);
    if(this.range && (candles[0]!.time>this.range.start || this.sourceSeconds>=86400 || this.range.start%this.sourceSeconds!==0 || this.range.end%this.sourceSeconds!==0))this.range=null;this.requestUpdate();
  }
  paneViews():readonly ISeriesPrimitivePaneView[]{return [this.view];}
  private draw(target:CanvasRenderingTarget2D) {
    const r=this.range;if(!r)return;
    const scale=this.chart.timeScale();
    const data=this.replayData??this.series.data(); const last=data[data.length-1]; if(!last)return;
    const xLast=scale.timeToCoordinate(last.time);if(xLast===null)return;
    const xPrev=data.length>1?scale.timeToCoordinate(data[data.length-2]!.time):null;
    const step=xPrev===null?6:Math.max(1,xLast-xPrev);
    const projectedX=xLast+step*this.config.offset;
    const yO=this.series.priceToCoordinate(r.open), yC=this.series.priceToCoordinate(r.close), yH=this.series.priceToCoordinate(r.high), yL=this.series.priceToCoordinate(r.low);
    if(yO===null||yC===null||yH===null||yL===null)return;
    const timeX=(t:number)=>{const direct=scale.timeToCoordinate(t as Time);if(direct!==null)return direct;const prev=data[data.length-2];const interval=prev?this.sourceSeconds:0;return interval>0&&typeof last.time==="number"?xLast+(t-last.time)/interval*step:null;};
    target.useMediaCoordinateSpace(({context:ctx,mediaSize})=>{
      const x=Math.min(projectedX,mediaSize.width-this.config.width/2-5);
      const showProjected=x>xLast;
      const line=(x1:number,y1:number,x2:number,y2:number,dash:number[]=[])=>{ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
      ctx.save();ctx.globalAlpha=this.config.opacity;ctx.lineWidth=this.config.lineWidth;ctx.strokeStyle=this.config.lineColor;
      const start=timeX(r.start),end=timeX(r.end),hi=timeX(r.highTime),lo=timeX(r.lowTime);
      if(start!==null){if(this.config.showOpen)line(start,0,start,mediaSize.height);if(this.config.showOpenPrice)line(start,yO,showProjected?x:mediaSize.width,yO,[6,4]);}
      if(this.config.showClose&&end!==null)line(end,0,end,mediaSize.height);
      if(this.config.showHighLow&&showProjected){if(hi!==null)line(hi,yH,x,yH);if(lo!==null)line(lo,yL,x,yL);}
      ctx.strokeStyle=r.close>=r.open?this.config.color:this.config.downColor;ctx.fillStyle=ctx.strokeStyle;
      if(showProjected&&this.config.showCandle&&this.config.showWicks)line(x,yH,x,yL);
      if(showProjected&&this.config.showCandle)ctx.fillRect(x-this.config.width/2,Math.min(yO,yC),this.config.width,Math.max(1,Math.abs(yO-yC)));
      if(showProjected&&this.config.showLabels){const label=this.config.sessionMinutes==="session"?"1D":Number(this.config.sessionMinutes)<60?this.config.sessionMinutes+"m":Number(this.config.sessionMinutes)/60+"H";ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText(label,x,yH-7);ctx.fillText(label,x,yL+14);}ctx.restore();
    });
  }
}
