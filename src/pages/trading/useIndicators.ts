import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, CandlestickData, Time } from "lightweight-charts";
import { LineStyle } from "lightweight-charts";
import {
  sma,
  ema,
  rsi,
  macd,
  bollingerBands,
  atr,
  stochastic,
  vwap,
  INDICATOR_REGISTRY,
  type IndicatorType,
} from "../../lib/indicators.ts";
import { toIndicatorCandles } from "./utils.ts";
import { useOverrides, resolveIndicator, type ChartScope } from "../../lib/indicator-sdk/instances";
import {useIndicatorAdmin} from "../../lib/indicator-sdk/admin";
import {reportIndicator} from "../../lib/indicator-sdk/diagnostics";
import {AggregationCache,CalculationCache} from "../../lib/indicator-sdk/calculation-cache";
import {IndicatorWorkerClient} from "../../lib/indicator-sdk/worker-client";
import {RuntimeGuard} from "../../lib/indicator-sdk/runtime";
import { useIndicatorLibrary } from "../../lib/indicator-sdk/storage";
import {GraphicPrimitive} from "../../lib/indicator-sdk/graphic-renderer";
import { SessionCandlePrimitive } from "../../lib/indicator-sdk/renderer";
import {IndependentHistoryCache,alignHistoryPoints,historyPlan,historyMaxAge} from "../../lib/indicator-sdk/independent-history";
import type {CandleData} from "../../lib/indicators";
import {api} from "../../services/api.ts";
import { CHART_COLORS } from "./constants.ts";

const independentHistory=new IndependentHistoryCache((symbol,timeframe,limit,toMs)=>api.getCandles(symbol,timeframe,limit,{toMs}));

export function useIndicators(
  chartRef: React.RefObject<IChartApi | null>,
  candleSeriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>,
  chartData: CandlestickData<Time>[],
  activeIndicators: IndicatorType[],
  isDark: boolean,
  volumeData: readonly {time:Time;value:number}[] = [],
  scope:ChartScope = "primary",
  sourceSeconds=60,
  chartEpoch=0,
  liveVolumeRef?:React.RefObject<ISeriesApi<"Histogram"> | null>,
  isReplaying=false,
  symbol="",
): void {
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line"> | ISeriesApi<"Histogram"> | ISeriesApi<"Area">>>(
    new Map(),
  );
  const cacheRef=useRef(new CalculationCache());
  const workerRef=useRef<IndicatorWorkerClient|null>(null);
  const aggregationRef=useRef(new AggregationCache());
  const guardRef=useRef(new RuntimeGuard());
  const signaturesRef=useRef(new Map<string,string>());
  const library = useIndicatorLibrary();
  const admin = useIndicatorAdmin();
  const overrides = useOverrides(scope);
  const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;
  const [history,setHistory]=useState<{key:string;rows:Record<number,CandleData[]>;errors?:Record<number,string>}>({key:"",rows:{}});
  const allowedCustom=activeIndicators.filter(x=>x.startsWith("custom:")).slice(0,admin.maxActive);
  const requestedPeriods=[...new Set(library.filter(x=>allowedCustom.includes(`custom:${x.id}`)).map(x=>resolveIndicator(x,overrides)).filter(x=>x.visible&&x.kind!=="graphics"&&x.kind!=="session-candle"&&x.historySource==="independent"&&historyPlan(x.aggregation)).map(x=>x.aggregation))].sort((a,b)=>a-b);
  const periods=requestedPeriods.slice(0,6);
  const periodKey=periods.join(",");
  const lastTime=chartData[chartData.length-1]?.time;
  const replayCutoff=isReplaying&&typeof lastTime==="number"?lastTime:0;
  const historyKey=JSON.stringify([symbol,periodKey,isReplaying,replayCutoff]);
  useEffect(()=>{if(!symbol||!periodKey)return;let stopped=false;let running=false;
    const refresh=async()=>{if(running)return;running=true;try{const cutoff=isReplaying?replayCutoff:Math.floor(Date.now()/1000);if(!cutoff)return;const results=await Promise.allSettled(periodKey.split(",").map(async raw=>{const n=Number(raw);return [n,await independentHistory.get(symbol,n,cutoff)] as const;}));if(!stopped){const rows:Record<number,CandleData[]>={};const errors:Record<number,string>={};results.forEach((result,index)=>{if(result.status==="fulfilled")rows[result.value[0]]=result.value[1];else errors[Number(periodKey.split(",")[index])]="Market history unavailable";});setHistory({key:historyKey,rows,errors});}}finally{running=false;}};
    void refresh();const timer=isReplaying?undefined:setInterval(()=>void refresh(),30000);return()=>{stopped=true;if(timer!==undefined)clearInterval(timer);};
  },[symbol,periodKey,isReplaying,replayCutoff,historyKey]);

  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    const chart = chartRef.current;
    const source=candleSeriesRef.current;
    const used=new Set<string>();
    const guard=guardRef.current;
    const cache=cacheRef.current;
    const aggregation=aggregationRef.current;
    let disposed=false;let busy=false;let rerun=false;
    const sync=async()=>{
    if(disposed)return;if(busy){rerun=true;return;}busy=true;
    try{
    used.clear();
    const live=source.data().flatMap(c=>typeof c.time==="number"&&"open" in c?[c as CandlestickData<Time>]:[]);
    const vols=liveVolumeRef?.current?.data().flatMap(v=>"value" in v?[{time:v.time,value:v.value}]:[])??volumeData;
    const indCandles = toIndicatorCandles(isReplaying?chartData:live.length?live:chartData, isReplaying?volumeData:vols);
    aggregation.prepare(indCandles.slice(-admin.maxBars),sourceSeconds);
    const activeCustom=new Set(activeIndicators.filter(x=>x.startsWith("custom:")).map(x=>x.slice(7)));
    cache.prune(activeCustom);
    for(const id of signaturesRef.current.keys())if(!activeCustom.has(id)){signaturesRef.current.delete(id);guard.success("custom:"+id);}

    function line(key:string,options:Parameters<IChartApi["addLineSeries"]>[0]){
      used.add(key);
      const existing=indicatorSeriesRef.current.get(key) as ISeriesApi<"Line">|undefined;
      if(existing){existing.applyOptions(options??{});return existing;}
      const series=chart.addLineSeries(options);indicatorSeriesRef.current.set(key,series);return series;
    }
    function histogram(key:string,options:Parameters<IChartApi["addHistogramSeries"]>[0]){
      used.add(key);
      const existing=indicatorSeriesRef.current.get(key) as ISeriesApi<"Histogram">|undefined;
      if(existing){existing.applyOptions(options??{});return existing;}
      const series=chart.addHistogramSeries(options);indicatorSeriesRef.current.set(key,series);return series;
    }

    let importedCount=0;
    for (const type of activeIndicators) {
      if (type.startsWith("custom:")) {
        if(++importedCount>admin.maxActive)continue;
        const definition = library.find(x => `custom:${x.id}` === type);
        const entry = definition && resolveIndicator(definition,overrides);
        if (entry && entry.visible && entry.kind !== "session-candle" && entry.kind !== "graphics") {
          const signature=JSON.stringify(entry);
          const settingsChanged=signaturesRef.current.get(entry.id)!==signature;
          if(settingsChanged){guard.success(type);signaturesRef.current.set(entry.id,signature);}
          if(guard.blocked(type))continue;
          const started=performance.now();
          try {
          const external=entry.historySource==="independent"&&entry.aggregation!==0;
          const bounded=external?(history.key===historyKey?history.rows[entry.aggregation]??[]:[]).slice(-admin.maxBars):aggregation.get(entry.aggregation);
          if(external&&!periods.includes(entry.aggregation)){reportIndicator(scope,entry.id,0,0,"Independent period limit reached (6 per chart)");continue;}
          if(external&&(!bounded.length||history.errors?.[entry.aggregation])){reportIndicator(scope,entry.id,0,0,history.key!==historyKey?"Loading market history":history.errors?.[entry.aggregation]??"No completed market history");continue;}
          const worker=typeof Worker!=="undefined"?(workerRef.current??=new IndicatorWorkerClient()):null;
          const reply=worker?await worker.calculate(entry,bounded):null;
          if(disposed)return;
          const result=reply?.result??cache.calculate(entry,bounded);
          const data=external?alignHistoryPoints(result.points,indCandles,historyMaxAge(entry.aggregation)):entry.aggregation!==0?alignHistoryPoints(result.points.map(p=>({...p,time:p.time+sourceSeconds})),indCandles):result.points;
          if(!reply&&performance.now()-started>100)throw new Error("Indicator execution budget exceeded");
          const key=type+":"+entry.plot;
          const scaleId=entry.scale==="independent"?"indicator-"+entry.id:"right";
          if(!external&&entry.aggregation===0&&result.cached&&!settingsChanged&&indicatorSeriesRef.current.has(key)){used.add(key);guard.success(type);continue;}
          const points=data.map(p=>({time:p.time as Time,value:p.value}));
          if(entry.plot==="histogram")histogram(key,{color:entry.color,priceScaleId:scaleId}).setData(points);
          else if(entry.plot==="area"){
            used.add(key);let area=indicatorSeriesRef.current.get(key) as ISeriesApi<"Area">|undefined;
            const options={lineColor:entry.color,topColor:entry.color+"55",bottomColor:entry.color+"00",priceScaleId:scaleId};
            if(!area){area=chart.addAreaSeries(options);indicatorSeriesRef.current.set(key,area);}else area.applyOptions(options);
            area.setData(points);
          }else line(key,{color:entry.color,lineWidth:entry.lineWidth as 1|2|3|4|5,priceScaleId:scaleId}).setData(points);
          guard.success(type);
          if(admin.diagnostics)reportIndicator(scope,entry.id,reply?.ms??performance.now()-started,bounded.length,"",result.incremental?"incremental":result.cached?"cache":"full",reply?.stats.points??cache.stats().points);
          }catch(e){if(disposed)return;used.delete(type+":"+entry.plot);const failures=guard.fail(type);reportIndicator(scope,entry.id,performance.now()-started,0,(e instanceof Error?e.message:String(e))+(guard.blocked(type)?" — paused after "+failures+" failures":""));}
        }
        continue;
      }
      const config = INDICATOR_REGISTRY.find((r) => r.type === type);
      if (!config) continue;

      switch (type) {
        case "SMA": {
          const data = sma(indCandles, config.defaultParams.period!);
          const s = line("SMA",{
            color: config.color,
            lineWidth: 1,
            priceScaleId: "right",
          });
          s.setData(data.map((p) => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set("SMA", s);
          break;
        }
        case "EMA": {
          const data = ema(indCandles, config.defaultParams.period!);
          const s = line("EMA",{
            color: config.color,
            lineWidth: 1,
            priceScaleId: "right",
          });
          s.setData(data.map((p) => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set("EMA", s);
          break;
        }
        case "RSI": {
          const data = rsi(indCandles, config.defaultParams.period);
          const s = line("RSI",{ color: config.color, lineWidth: 1, priceScaleId: "rsi" });
          s.setData(data.map((p) => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set("RSI", s);
          const refHigh = line("RSI-70",{
            color: "#555",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            priceScaleId: "rsi",
          });
          refHigh.setData(data.map((p) => ({ time: p.time as Time, value: 70 })));
          indicatorSeriesRef.current.set("RSI-70", refHigh);
          const refLow = line("RSI-30",{
            color: "#555",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            priceScaleId: "rsi",
          });
          refLow.setData(data.map((p) => ({ time: p.time as Time, value: 30 })));
          indicatorSeriesRef.current.set("RSI-30", refLow);
          break;
        }
        case "MACD": {
          const data = macd(
            indCandles,
            config.defaultParams.fast,
            config.defaultParams.slow,
            config.defaultParams.signal,
          );
          const mLine = line("MACD-line",{
            color: "#2196f3",
            lineWidth: 1,
            priceScaleId: "macd",
          });
          mLine.setData(data.macd.map((p) => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set("MACD-line", mLine);
          const sLine = line("MACD-signal",{
            color: "#ff9800",
            lineWidth: 1,
            priceScaleId: "macd",
          });
          sLine.setData(data.signal.map((p) => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set("MACD-signal", sLine);
          const histo = histogram("MACD-hist",{ priceScaleId: "macd" });
          histo.setData(
            data.histogram.map((p) => ({
              time: p.time as Time,
              value: p.value,
              color: p.value >= 0 ? colors.up + "99" : colors.down + "99",
            })),
          );
          indicatorSeriesRef.current.set("MACD-hist", histo);
          break;
        }
        case "BOLL": {
          const data = bollingerBands(
            indCandles,
            config.defaultParams.period,
            config.defaultParams.stdDev,
          );
          const upper = line("BOLL-upper",{
            color: config.color + "80",
            lineWidth: 1,
            priceScaleId: "right",
          });
          upper.setData(data.upper.map((p) => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set("BOLL-upper", upper);
          const mid = line("BOLL-mid",{
            color: config.color,
            lineWidth: 1,
            priceScaleId: "right",
          });
          mid.setData(data.middle.map((p) => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set("BOLL-mid", mid);
          const lower = line("BOLL-lower",{
            color: config.color + "80",
            lineWidth: 1,
            priceScaleId: "right",
          });
          lower.setData(data.lower.map((p) => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set("BOLL-lower", lower);
          break;
        }
        case "ATR": {
          const data = atr(indCandles, config.defaultParams.period);
          const s = line("ATR",{ color: config.color, lineWidth: 1, priceScaleId: "atr" });
          s.setData(data.map((p) => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set("ATR", s);
          break;
        }
        case "STOCH": {
          const data = stochastic(
            indCandles,
            config.defaultParams.kPeriod,
            config.defaultParams.dPeriod,
          );
          const kLine = line("STOCH-K",{
            color: "#ab47bc",
            lineWidth: 1,
            priceScaleId: "stoch",
          });
          kLine.setData(data.k.map((p) => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set("STOCH-K", kLine);
          const dLine = line("STOCH-D",{
            color: "#ff7043",
            lineWidth: 1,
            priceScaleId: "stoch",
          });
          dLine.setData(data.d.map((p) => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set("STOCH-D", dLine);
          break;
        }
        case "VWAP": {
          const data = vwap(indCandles);
          const s = line("VWAP",{
            color: config.color,
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            priceScaleId: "right",
          });
          s.setData(data.map((p) => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set("VWAP", s);
          break;
        }
      }
    }
    for(const [key,series] of indicatorSeriesRef.current){if(!used.has(key)){try{chart.removeSeries(series);}catch{/* disposed */}indicatorSeriesRef.current.delete(key);}}
    }finally{busy=false;if(rerun&&!disposed){rerun=false;void sync();}}
    };
    let timer:ReturnType<typeof setTimeout>|undefined;
    const schedule=()=>{if(timer!==undefined)return;timer=setTimeout(()=>{timer=undefined;sync();},200);};
    sync();source.subscribeDataChanged(schedule);liveVolumeRef?.current?.subscribeDataChanged(schedule);
    const volume=liveVolumeRef?.current;
    return()=>{disposed=true;source.unsubscribeDataChanged(schedule);volume?.unsubscribeDataChanged(schedule);if(timer!==undefined)clearTimeout(timer);};
    // chartRef/candleSeriesRef are stable refs; colors derived from isDark dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndicators, chartData, isDark, library, volumeData, overrides, admin, sourceSeconds, chartEpoch, liveVolumeRef, scope, isReplaying, history, historyKey, symbol]);

  useEffect(()=>{const chart=chartRef.current;const seriesMap=indicatorSeriesRef.current;const cache=cacheRef.current;const guard=guardRef.current;const signatures=signaturesRef.current;return()=>{if(chart)for(const series of seriesMap.values()){try{chart.removeSeries(series);}catch{/* disposed */}}seriesMap.clear();cache.clear();guard.reset();signatures.clear();workerRef.current?.stop();workerRef.current=null;};},[chartEpoch,chartRef]);

  const replaySlice=isReplaying?chartData:undefined;
  const [sessionHistory,setSessionHistory]=useState<{key:string;rows:CandleData[];step:number}>({key:"",rows:[],step:60});
  const needsSessionHistory=library.some(x=>allowedCustom.includes(`custom:${x.id}`)&&resolveIndicator(x,overrides).kind==="session-candle"&&resolveIndicator(x,overrides).historySource==="independent");
  const sessionKey=JSON.stringify([symbol,isReplaying,replayCutoff]);
  useEffect(()=>{if(!needsSessionHistory||!symbol)return;let disposed=false;let busy=false;const refresh=async()=>{if(busy)return;busy=true;try{const cutoff=isReplaying?replayCutoff:Math.floor(Date.now()/1000);if(!cutoff)return;const step=60;const rows=await api.getCandles(symbol,"1m",Math.min(admin.maxBars,5000),{toMs:cutoff*1000});if(!disposed)setSessionHistory({key:sessionKey,rows:rows.filter(x=>x.time+step<=cutoff).sort((a,b)=>a.time-b.time),step});}catch{if(!disposed)setSessionHistory({key:sessionKey,rows:[],step:60});}finally{busy=false;}};void refresh();const timer=isReplaying?undefined:setInterval(()=>void refresh(),30000);return()=>{disposed=true;if(timer!==undefined)clearInterval(timer);};},[needsSessionHistory,symbol,isReplaying,replayCutoff,sessionKey,admin.maxBars]);
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const allowed=activeIndicators.filter(x=>x.startsWith("custom:")).slice(0,admin.maxActive);
    const primitives = library.filter(x => allowed.includes(`custom:${x.id}`)).flatMap(x => {const entry=resolveIndicator(x,overrides);if(!entry.visible)return [];const items:import("lightweight-charts").ISeriesPrimitive<Time>[]=[];if(entry.kind==="session-candle")items.push(new SessionCandlePrimitive(entry,sourceSeconds,admin.maxBars,replaySlice,entry.historySource==="independent"?(sessionHistory.key===sessionKey?sessionHistory.rows:[]):undefined,sessionHistory.step));if(entry.graphics.length)items.push(new GraphicPrimitive(entry.graphics,replaySlice));return items;});
    const attached:typeof primitives=[];
    for (const primitive of primitives) {try{series.attachPrimitive(primitive);attached.push(primitive);}catch(e){console.warn("Indicator attachment failed",e);}}
    return () => { for (const primitive of attached) { try { series.detachPrimitive(primitive); } catch { /* disposed chart */ } } };
  }, [activeIndicators, library, overrides, admin, sourceSeconds, chartEpoch, isReplaying, replaySlice,sessionHistory,sessionKey]);
}
