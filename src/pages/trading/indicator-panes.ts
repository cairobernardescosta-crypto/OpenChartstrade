import {createChart,ColorType,LineStyle,type IChartApi,type ISeriesApi,type Time,type LogicalRange} from "lightweight-charts";
export function nativePaneKey(key:string):string|null{for(const name of ["RSI","MACD","ATR","STOCH"])if(key===name||key.startsWith(name+"-"))return name;return null;}
type Pane={chart:IChartApi;host:HTMLDivElement;timeline:ISeriesApi<"Line">;observer:ResizeObserver;onRange:(range:LogicalRange|null)=>void};
export type PaneColors={background:string;text:string;grid:string};
export class IndicatorPanes {
 private panes=new Map<string,Pane>();private syncing=false;private times:Time[]=[];private signature="";private readonly onMainRange=(range:LogicalRange|null)=>this.sync(this.main,range);
 constructor(private main:IChartApi,private root:HTMLDivElement,private colors:PaneColors){main.timeScale().subscribeVisibleLogicalRangeChange(this.onMainRange);}
 updateColors(colors:PaneColors){this.colors=colors;for(const p of this.panes.values())p.chart.applyOptions({layout:{background:{type:ColorType.Solid,color:colors.background},textColor:colors.text},grid:{vertLines:{color:colors.grid},horzLines:{color:colors.grid}}});}
 private sync(source:IChartApi,range:LogicalRange|null){if(this.syncing||!range)return;this.syncing=true;try{for(const chart of [this.main,...[...this.panes.values()].map(p=>p.chart)])if(chart!==source)chart.timeScale().setVisibleLogicalRange(range);}finally{this.syncing=false;}}
 setTimeline(times:Time[]){const signature=times.join(",");if(signature===this.signature)return;this.signature=signature;this.times=times;for(const p of this.panes.values())p.timeline.setData(times.map(time=>({time})));this.sync(this.main,this.main.timeScale().getVisibleLogicalRange());}
 get(key:string,label:string,height=120):IChartApi{
 const existing=this.panes.get(key);if(existing){existing.host.style.height=height+"px";return existing.chart;}
 const host=document.createElement("div");host.className="relative shrink-0 border-t border-border";host.style.height=height+"px";
 const title=document.createElement("span");title.className="absolute z-10 left-2 top-1 text-[10px] text-muted-foreground pointer-events-none";title.textContent=label;host.appendChild(title);
 const body=document.createElement("div");body.className="w-full h-full";host.appendChild(body);this.root.appendChild(host);
 const chart=createChart(body,{width:Math.max(1,body.clientWidth),height:Math.max(1,body.clientHeight),layout:{background:{type:ColorType.Solid,color:this.colors.background},textColor:this.colors.text,fontSize:10},grid:{vertLines:{color:this.colors.grid,style:LineStyle.Dotted},horzLines:{color:this.colors.grid,style:LineStyle.Dotted}},rightPriceScale:{minimumWidth:80,scaleMargins:{top:0.15,bottom:0.12}},timeScale:{visible:false,fixLeftEdge:false,fixRightEdge:false},handleScale:true,handleScroll:true});
 const timeline=chart.addLineSeries({visible:false,lastValueVisible:false,priceLineVisible:false});timeline.setData(this.times.map(time=>({time})));
 const observer=new ResizeObserver(()=>chart.resize(Math.max(1,body.clientWidth),Math.max(1,body.clientHeight)));observer.observe(body);
 const onRange=(range:LogicalRange|null)=>this.sync(chart,range);chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
 this.panes.set(key,{chart,host,timeline,observer,onRange});const range=this.main.timeScale().getVisibleLogicalRange();if(range)chart.timeScale().setVisibleLogicalRange(range);return chart;
 }
 retain(keys:ReadonlySet<string>){for(const [key,p] of this.panes)if(!keys.has(key)){p.observer.disconnect();p.chart.timeScale().unsubscribeVisibleLogicalRangeChange(p.onRange);p.chart.remove();p.host.remove();this.panes.delete(key);}}
 dispose(){try{this.main.timeScale().unsubscribeVisibleLogicalRangeChange(this.onMainRange);}catch{/* parent disposed */}this.retain(new Set());}
}
