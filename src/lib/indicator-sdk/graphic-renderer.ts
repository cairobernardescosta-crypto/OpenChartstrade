import type {CanvasRenderingTarget2D} from "fancy-canvas";
import type {ISeriesPrimitivePaneView} from "lightweight-charts";
import {PluginBase} from "../chart-plugins/plugin-base";
import type {Graphic} from "./graphics";
export class GraphicPrimitive extends PluginBase {
 private readonly views:ISeriesPrimitivePaneView[];
 constructor(private readonly graphics:readonly Graphic[],private readonly replayData?:readonly import("lightweight-charts").CandlestickData<import("lightweight-charts").Time>[]){super();this.views=(["bottom","normal","top"] as const).map(layer=>({zOrder:()=>layer,renderer:()=>({draw:(target:CanvasRenderingTarget2D)=>this.draw(target,layer)})}));}
 paneViews():readonly ISeriesPrimitivePaneView[]{return this.views;}
 protected override dataUpdated(){this.requestUpdate();}
 private draw(target:CanvasRenderingTarget2D,layer:Graphic["layer"]){
   const scale=this.chart.timeScale(),data=this.replayData??this.series.data(),last=data[data.length-1];if(!last)return;
   const lastX=scale.timeToCoordinate(last.time);if(lastX===null)return;
   const latest=scale.coordinateToLogical(lastX);if(latest===null)return;
   const x=(bars:number)=>this.replayData&&bars>0?null:scale.logicalToCoordinate((latest+bars) as Parameters<typeof scale.logicalToCoordinate>[0]);
   const y=(price:number,bars:number,anchor:Graphic["anchor"],multiplier=1)=>{if(anchor==="price")return this.series.priceToCoordinate(price);const bar=data[data.length-1+bars];if(!bar||!(anchor in bar))return null;const base=(bar as unknown as Record<string,unknown>)[anchor];return typeof base==="number"?this.series.priceToCoordinate(base*multiplier+price):null;};
   const point=(p:{bars:number;price:number},anchor:Graphic["anchor"],multiplier=1)=>{const a=x(p.bars),b=y(p.price,p.bars,anchor,multiplier);return a===null||b===null?null:{x:a,y:b};};
   target.useMediaCoordinateSpace(({context:c,mediaSize:m})=>{
    const line=(a:number,b:number,d:number,e:number)=>{c.beginPath();c.moveTo(a,b);c.lineTo(d,e);c.stroke();};
    for(const g of this.graphics){if(!g.visible||g.layer!==layer)continue;c.save();c.strokeStyle=g.color;c.fillStyle=g.color;c.globalAlpha=g.opacity;c.lineWidth=g.width;c.setLineDash(g.dash==="dashed"?[6,4]:g.dash==="dotted"?[2,3]:[]);c.font="11px sans-serif";
      if(g.type==="candle"){const a=x(g.bars),o=y(g.open,g.bars,g.anchor,g.priceMultiplier),h=y(g.high,g.bars,g.anchor,g.priceMultiplier),l=y(g.low,g.bars,g.anchor,g.priceMultiplier),close=y(g.close,g.bars,g.anchor,g.priceMultiplier);if(a!==null&&o!==null&&h!==null&&l!==null&&close!==null){line(a,h,a,l);c.fillRect(a-g.bodyWidth/2,Math.min(o,close),g.bodyWidth,Math.max(1,Math.abs(o-close)));}}
      else if(g.type==="horizontal"){const p=y(g.price,0,g.anchor,g.priceMultiplier);if(p!==null)line(0,p,m.width,p);}
      else if(g.type==="vertical"){const p=x(g.bars);if(p!==null)line(p,0,p,m.height);}
      else if(g.type==="text"){const p=point(g.at,g.anchor,g.priceMultiplier);if(p)c.fillText(g.text,p.x,p.y);}
      else if(g.type==="table"){const p=point(g.at,g.anchor,g.priceMultiplier);if(p){const w=80,h=18;g.rows.forEach((row,i)=>row.forEach((v,j)=>{c.strokeRect(p.x+j*w,p.y+i*h,w,h);c.fillText(v,p.x+j*w+3,p.y+i*h+13,w-6);}));}}
      else {const a=point(g.from,g.anchor,g.priceMultiplier),b=point(g.to,g.anchor,g.priceMultiplier);if(a&&b){if(g.type==="box"){const l=Math.min(a.x,b.x),t=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);if(g.fill)c.fillRect(l,t,w,h);else c.strokeRect(l,t,w,h);}else{line(a.x,a.y,b.x,b.y);if(g.type==="arrow"){const angle=Math.atan2(b.y-a.y,b.x-a.x);for(const delta of [-0.5,0.5])line(b.x,b.y,b.x-9*Math.cos(angle+delta),b.y-9*Math.sin(angle+delta));}}}}
      c.restore();
    }
   });
 }
}
