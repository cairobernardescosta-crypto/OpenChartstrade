import type {CanvasRenderingTarget2D} from "fancy-canvas";
import type {ISeriesPrimitivePaneView} from "lightweight-charts";
import {PluginBase} from "../chart-plugins/plugin-base";
import type {Graphic} from "./graphics";
export class GraphicPrimitive extends PluginBase {
 private readonly view:ISeriesPrimitivePaneView;
 constructor(private readonly graphics:readonly Graphic[]){super();this.view={renderer:()=>({draw:(target:CanvasRenderingTarget2D)=>this.draw(target)})};}
 paneViews():readonly ISeriesPrimitivePaneView[]{return [this.view];}
 private draw(target:CanvasRenderingTarget2D){
   const scale=this.chart.timeScale(),data=this.series.data(),last=data[data.length-1];if(!last)return;
   const latest=scale.coordinateToLogical(scale.timeToCoordinate(last.time) ?? -1);if(latest===null)return;
   const x=(bars:number)=>scale.logicalToCoordinate((latest+bars) as Parameters<typeof scale.logicalToCoordinate>[0]);
   const y=(price:number)=>this.series.priceToCoordinate(price);
   const point=(p:{bars:number;price:number})=>{const a=x(p.bars),b=y(p.price);return a===null||b===null?null:{x:a,y:b};};
   target.useMediaCoordinateSpace(({context:c,mediaSize:m})=>{
    const line=(a:number,b:number,d:number,e:number)=>{c.beginPath();c.moveTo(a,b);c.lineTo(d,e);c.stroke();};
    for(const g of this.graphics){c.save();c.strokeStyle=g.color;c.fillStyle=g.color;c.globalAlpha=g.opacity;c.lineWidth=g.width;c.font="11px sans-serif";
      if(g.type==="horizontal"){const p=y(g.price);if(p!==null)line(0,p,m.width,p);}
      else if(g.type==="vertical"){const p=x(g.bars);if(p!==null)line(p,0,p,m.height);}
      else if(g.type==="text"){const p=point(g.at);if(p)c.fillText(g.text,p.x,p.y);}
      else if(g.type==="table"){const p=point(g.at);if(p){const w=80,h=18;g.rows.forEach((row,i)=>row.forEach((v,j)=>{c.strokeRect(p.x+j*w,p.y+i*h,w,h);c.fillText(v,p.x+j*w+3,p.y+i*h+13,w-6);}));}}
      else {const a=point(g.from),b=point(g.to);if(a&&b){if(g.type==="box"){const l=Math.min(a.x,b.x),t=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);if(g.fill)c.fillRect(l,t,w,h);else c.strokeRect(l,t,w,h);}else{line(a.x,a.y,b.x,b.y);if(g.type==="arrow"){const angle=Math.atan2(b.y-a.y,b.x-a.x);for(const delta of [-0.5,0.5])line(b.x,b.y,b.x-9*Math.cos(angle+delta),b.y-9*Math.sin(angle+delta));}}}}
      c.restore();
    }
   });
 }
}
