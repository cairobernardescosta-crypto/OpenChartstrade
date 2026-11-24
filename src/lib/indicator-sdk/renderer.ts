import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitivePaneView, ISeriesPrimitivePaneRenderer, Time, DataChangedScope } from "lightweight-charts";
import { PluginBase } from "../chart-plugins/plugin-base";
import type { ImportedIndicator } from "./schema";
import { sessionRange, type SessionRange } from "./session";
import type { CandleData } from "../indicators";

export class SessionCandlePrimitive extends PluginBase {
  private range: SessionRange|null=null;
  private readonly view: ISeriesPrimitivePaneView;
  constructor(private readonly config:ImportedIndicator) {
    super();
    this.view={renderer:()=>({draw:(target:CanvasRenderingTarget2D)=>this.draw(target)} satisfies ISeriesPrimitivePaneRenderer)};
  }
  public override attached(param:Parameters<PluginBase["attached"]>[0]) {super.attached(param);this.refresh();}
  protected override dataUpdated(_scope:DataChangedScope) {this.refresh();}
  private refresh() {
    const candles=this.series.data().filter((x):x is typeof x & CandleData => typeof x.time==="number" && "open" in x && "close" in x && "high" in x && "low" in x);
    this.range=sessionRange(candles,this.config);this.requestUpdate();
  }
  paneViews():readonly ISeriesPrimitivePaneView[]{return [this.view];}
  private draw(target:CanvasRenderingTarget2D) {
    const r=this.range;if(!r)return;
    const scale=this.chart.timeScale();
    const data=this.series.data(); const last=data[data.length-1]; if(!last)return;
    const xLast=scale.timeToCoordinate(last.time);if(xLast===null)return;
    const xPrev=data.length>1?scale.timeToCoordinate(data[data.length-2]!.time):null;
    const step=xPrev===null?6:Math.max(1,xLast-xPrev);
    const x=xLast+step*this.config.offset;
    const yO=this.series.priceToCoordinate(r.open), yC=this.series.priceToCoordinate(r.close), yH=this.series.priceToCoordinate(r.high), yL=this.series.priceToCoordinate(r.low);
    if(yO===null||yC===null||yH===null||yL===null)return;
    const timeX=(t:number)=>{const direct=scale.timeToCoordinate(t as Time);if(direct!==null)return direct;const prev=data[data.length-2];const interval=prev&&typeof prev.time==="number"&&typeof last.time==="number"?last.time-prev.time:0;return interval>0&&typeof last.time==="number"?xLast+(t-last.time)/interval*step:null;};
    target.useMediaCoordinateSpace(({context:ctx,mediaSize})=>{
      const line=(x1:number,y1:number,x2:number,y2:number,dash:number[]=[])=>{ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
      ctx.save();ctx.lineWidth=1;ctx.strokeStyle=this.config.lineColor;
      const start=timeX(r.start),end=timeX(r.end),hi=timeX(r.highTime),lo=timeX(r.lowTime);
      if(this.config.showOpen&&start!==null){line(start,0,start,mediaSize.height);line(start,yO,x,yO,[6,4]);}
      if(this.config.showClose&&end!==null)line(end,0,end,mediaSize.height);
      if(this.config.showHighLow){if(hi!==null)line(hi,yH,x,yH);if(lo!==null)line(lo,yL,x,yL);}
      ctx.strokeStyle=r.close>=r.open?this.config.color:this.config.downColor;ctx.fillStyle=ctx.strokeStyle;
      line(x,yH,x,yL);
      ctx.fillRect(x-this.config.width/2,Math.min(yO,yC),this.config.width,Math.max(1,Math.abs(yO-yC)));
      ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText("1D",x,yH-7);ctx.fillText("1D",x,yL+14);ctx.restore();
    });
  }
}
