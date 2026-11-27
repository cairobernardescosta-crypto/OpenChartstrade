import { useEffect, useRef, useState,useMemo } from "react";
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
import { useOverrides, resolveIndicator, type ChartScope, type OverrideScope } from "../../lib/indicator-sdk/instances";
import {useIndicatorAdmin} from "../../lib/indicator-sdk/admin";
import {publishHistory,retainHistoryStatuses,historyPhase} from "../../lib/indicator-sdk/history-status";
import {reportIndicator} from "../../lib/indicator-sdk/diagnostics";
import {AggregationCache,CalculationCache,sharedPrefix} from "../../lib/indicator-sdk/calculation-cache";
import {IndicatorWorkerClient} from "../../lib/indicator-sdk/worker-client";
import {RuntimeGuard} from "../../lib/indicator-sdk/runtime";
import { useIndicatorLibrary } from "../../lib/indicator-sdk/storage";
import {GraphicPrimitive} from "../../lib/indicator-sdk/graphic-renderer";
import {getAdapter} from "../../adapter/registry";
import {useMarketAdapter,adapterIdentity} from "../../lib/indicator-sdk/data-source";
import {resolveMarketSchedule,type ResolvedMarketSchedule} from "../../lib/indicator-sdk/market-schedule";
import {SessionHistoryCache,type SessionHistory} from "../../lib/indicator-sdk/session-history";
import type {ImportedIndicator} from "../../lib/indicator-sdk/schema";
import { SessionCandlePrimitive } from "../../lib/indicator-sdk/renderer";
import {calendarPeriodEnd} from "../../lib/indicator-sdk/aggregate";
import {inspectGaps,plotWithGaps} from "../../lib/indicator-sdk/market-gaps";
import {IndependentHistoryCache,historyPlan,historyMaxAge,historyPointExpiry} from "../../lib/indicator-sdk/independent-history";
import type {CandleData} from "../../lib/indicators";
import {IndicatorPanes,nativePaneKey,type PaneColors} from "./indicator-panes";
import { CHART_COLORS } from "./constants.ts";
import {loadBestHoursSnapshot,type BestHoursAnalysis} from "../../lib/indicator-sdk/best-hours.ts";
import {publishBestHours,retainBestHours} from "../../lib/indicator-sdk/best-hours-status.ts";



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
  paneRoot?:React.RefObject<HTMLDivElement|null>,
  visualColors?:PaneColors,
  overrideScope:OverrideScope=scope,
): void {
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line"> | ISeriesApi<"Histogram"> | ISeriesApi<"Area">>>(
    new Map(),
  );
  const paneManagerRef=useRef<IndicatorPanes|null>(null);
  const ownersRef=useRef(new Map<string,IChartApi>());
  const cacheRef=useRef(new CalculationCache());
  const workerRef=useRef<IndicatorWorkerClient|null>(null);
  const aggregationRef=useRef(new AggregationCache());
  const guardRef=useRef(new RuntimeGuard());
  const signaturesRef=useRef(new Map<string,string>());
  const adapter=useMarketAdapter();
  const adapterToken=adapterIdentity(adapter);
  const sessionHistoryCache=useMemo(()=>new SessionHistoryCache((symbol,timeframe,limit,range)=>adapter?adapter.marketData.getCandles({symbol,timeframe,limit,...range}):Promise.reject(Error("Provedor indisponível"))),[adapter]);
  const independentHistory=useMemo(()=>new IndependentHistoryCache((symbol,timeframe,limit,toMs)=>adapter?adapter.marketData.getCandles({symbol,timeframe,limit,toMs}):Promise.reject(Error("Provedor indisponível"))),[adapter]);
  const library = useIndicatorLibrary();
  const admin = useIndicatorAdmin();
  const overrides = useOverrides(overrideScope);
  const colors = visualColors??(isDark ? CHART_COLORS.dark : CHART_COLORS.light);
  const trendColors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;
  const [history,setHistory]=useState<{key:string;rows:Record<string,CandleData[]>;errors?:Record<string,string>}>({key:"",rows:{}});
  const allowedCustom=activeIndicators.filter(x=>x.startsWith("custom:")).slice(0,admin.maxActive);
  const historyDefinitions=JSON.stringify(library.filter(x=>allowedCustom.includes(`custom:${x.id}`)).map(x=>resolveIndicator(x,overrides)).filter(x=>x.visible&&x.kind!=="graphics"&&x.historySource==="independent"&&(x.kind==="session-candle"||x.aggregation!==0)));
  useEffect(()=>{const entries=JSON.parse(historyDefinitions) as ImportedIndicator[];retainHistoryStatuses(scope,entries.map(x=>x.id));for(const entry of entries)publishHistory(scope,symbol,entry.id,"loading");return()=>retainHistoryStatuses(scope,[]);},[historyDefinitions,scope,symbol,isReplaying]);
  const requestedPeriods=[...new Set(library.filter(x=>allowedCustom.includes(`custom:${x.id}`)).map(x=>resolveIndicator(x,overrides)).filter(x=>x.visible&&x.kind!=="graphics"&&x.kind!=="session-candle"&&x.historySource==="independent"&&historyPlan(x.aggregation)).map(x=>x.aggregation+":"+x.gapPolicy))].sort();
  const periods=requestedPeriods.slice(0,6);
  const periodKey=periods.join(",");
  const lastTime=chartData[chartData.length-1]?.time;
  const replayCutoff=isReplaying&&typeof lastTime==="number"?lastTime:0;
  const historyKey=JSON.stringify([symbol,periodKey,isReplaying,replayCutoff,adapterToken]);
  useEffect(()=>{if(!symbol||!periodKey)return;let stopped=false;let running=false;let loaded=false;
    const definitions=(JSON.parse(historyDefinitions) as ImportedIndicator[]).filter(x=>x.kind!=="session-candle");
    const refresh=async()=>{if(running)return;running=true;try{
      const cutoff=isReplaying?replayCutoff:Math.floor(Date.now()/1000);if(!cutoff)return;
      for(const entry of definitions){const id=entry.aggregation+":"+entry.gapPolicy;publishHistory(scope,symbol,entry.id,periodKey.split(",").includes(id)?loaded?"refreshing":"loading":"limited");}
      const results=await Promise.allSettled(periodKey.split(",").map(async raw=>{const [period,policy]=raw.split(":");return [raw,await independentHistory.get(symbol,Number(period),cutoff,policy==="utc-weekdays"?"utc-weekdays":"continuous")] as const;}));
      if(stopped)return;const rows:Record<string,CandleData[]>={};const errors:Record<string,string>={};
      results.forEach((result,index)=>{if(result.status==="fulfilled")rows[result.value[0]]=result.value[1];else errors[periodKey.split(",")[index]!]="Não foi possível consultar o histórico de mercado.";});
      setHistory({key:historyKey,rows,errors});loaded=true;
      for(const entry of definitions){const id=entry.aggregation+":"+entry.gapPolicy;if(!periodKey.split(",").includes(id))continue;const bars=rows[id]?.length??0;publishHistory(scope,symbol,entry.id,historyPhase(bars,errors[id]),bars,errors[id]);}
    }finally{running=false;}};
    void refresh();const timer=isReplaying?undefined:setInterval(()=>void refresh(),30000);return()=>{stopped=true;if(timer!==undefined)clearInterval(timer);};
  },[symbol,periodKey,isReplaying,replayCutoff,historyKey,historyDefinitions,scope,independentHistory]);

  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    const chart = chartRef.current;
    const source=candleSeriesRef.current;
    const owners=ownersRef.current;
    const panes=paneRoot?.current?(paneManagerRef.current??=new IndicatorPanes(chart,paneRoot.current,colors)):null;
    panes?.updateColors(colors);
    const usedPanes=new Set<string>();
    const remove=(key:string)=>{const series=indicatorSeriesRef.current.get(key);if(series)try{(owners.get(key)??chart).removeSeries(series);}catch{/* disposed */}owners.delete(key);indicatorSeriesRef.current.delete(key);};
    const target=(key:string,customPane?:{id:string;label:string;height:number})=>{const id=customPane?.id??nativePaneKey(key);if(!id||!panes)return chart;usedPanes.add(id);return panes.get(id,customPane?.label??id,customPane?.height);};
    const used=new Set<string>();
    let nativePrevious:CandleData[]=[];
    let nativeKeys=new Set<string>();
    const guard=guardRef.current;
    const cache=cacheRef.current;
    const aggregation=aggregationRef.current;
    let disposed=false;let busy=false;let rerun=false;
    const sync=async()=>{
    if(disposed)return;if(busy){rerun=true;return;}busy=true;
    try{
    used.clear();usedPanes.clear();
    const live=source.data().flatMap(c=>typeof c.time==="number"&&"open" in c?[c as CandlestickData<Time>]:[]);
    const vols=liveVolumeRef?.current?.data().flatMap(v=>"value" in v?[{time:v.time,value:v.value}]:[])??volumeData;
    const indCandles = toIndicatorCandles(isReplaying?chartData:live.length?live:chartData, isReplaying?volumeData:vols);
    panes?.setTimeline(indCandles.map(c=>c.time as Time));
    aggregation.prepare(indCandles.slice(-admin.maxBars),sourceSeconds);
    const activeCustom=new Set(activeIndicators.filter(x=>x.startsWith("custom:")).map(x=>x.slice(7)));
    cache.prune(activeCustom);
    for(const id of signaturesRef.current.keys())if(!activeCustom.has(id)){signaturesRef.current.delete(id);guard.success("custom:"+id);}

    function line(key:string,options:Parameters<IChartApi["addLineSeries"]>[0],owner=target(key)){
      if(owners.get(key)&&owners.get(key)!==owner)remove(key);
      if(owner!==chart)options={...options,priceScaleId:"right"};
      used.add(key);
      const existing=indicatorSeriesRef.current.get(key) as ISeriesApi<"Line">|undefined;
      if(existing){existing.applyOptions(options??{});return existing;}
      const series=owner.addLineSeries(options);owners.set(key,owner);indicatorSeriesRef.current.set(key,series);return series;
    }
    function histogram(key:string,options:Parameters<IChartApi["addHistogramSeries"]>[0],owner=target(key)){
      if(owners.get(key)&&owners.get(key)!==owner)remove(key);
      if(owner!==chart)options={...options,priceScaleId:"right"};
      used.add(key);
      const existing=indicatorSeriesRef.current.get(key) as ISeriesApi<"Histogram">|undefined;
      if(existing){existing.applyOptions(options??{});return existing;}
      const series=owner.addHistogramSeries(options);owners.set(key,owner);indicatorSeriesRef.current.set(key,series);return series;
    }

    const nativeUnchanged=nativePrevious.length===indCandles.length&&sharedPrefix(nativePrevious,indCandles)===indCandles.length;
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
          const historyId=entry.aggregation+":"+entry.gapPolicy;
          const bounded=external?(history.key===historyKey?history.rows[historyId]??[]:[]).slice(-admin.maxBars):aggregation.get(entry.aggregation,entry.gapPolicy);
          if(external&&!periods.includes(historyId)){reportIndicator(scope,entry.id,0,0,"Independent period limit reached (6 per chart)");continue;}
          if(external&&history.key!==historyKey)continue;
          if(external&&(!bounded.length||history.errors?.[historyId])){reportIndicator(scope,entry.id,0,0,history.key!==historyKey?"Loading market history":history.errors?.[historyId]??"No completed market history");continue;}
          const worker=typeof Worker!=="undefined"?(workerRef.current??=new IndicatorWorkerClient()):null;
          const reply=worker?await worker.calculate(entry,bounded):null;
          if(disposed)return;
          const result=reply?.result??cache.calculate(entry,bounded);
          const effectiveStep=entry.aggregation?historyMaxAge(entry.aggregation):sourceSeconds;
          const dated=external||entry.aggregation===0?result.points:result.points.map(p=>({...p,time:calendarPeriodEnd(p.time,entry.aggregation,sourceSeconds)}));
          const data=plotWithGaps(dated,indCandles,sourceSeconds,effectiveStep,entry.gapPolicy,entry.aggregation===43200?t=>historyPointExpiry(t,43200):undefined);
          const gaps=inspectGaps(bounded,effectiveStep,entry.gapPolicy);
          if(!reply&&performance.now()-started>100)throw new Error("Indicator execution budget exceeded");
          const key=type+":"+entry.plot;
          const owner=entry.scale==="pane"?target(key,{id:type,label:entry.name,height:entry.paneHeight}):chart;
          if(owners.get(key)&&owners.get(key)!==owner)remove(key);
          const scaleId=entry.scale==="independent"?"indicator-"+entry.id:"right";
          if(!external&&entry.aggregation===0&&result.cached&&!settingsChanged&&indicatorSeriesRef.current.has(key)){used.add(key);guard.success(type);continue;}
          const points=data.map(p=>"value" in p?{time:p.time as Time,value:p.value}:{time:p.time as Time});
          if(entry.plot==="histogram")histogram(key,{color:entry.color,priceScaleId:scaleId},owner).setData(points);
          else if(entry.plot==="area"){
            used.add(key);let area=indicatorSeriesRef.current.get(key) as ISeriesApi<"Area">|undefined;
            const options={lineColor:entry.color,topColor:entry.color+"55",bottomColor:entry.color+"00",priceScaleId:scaleId};
            if(!area){area=owner.addAreaSeries(options);owners.set(key,owner);indicatorSeriesRef.current.set(key,area);}else area.applyOptions(options);
            area.setData(points);
          }else line(key,{color:entry.color,lineWidth:Math.min(entry.lineWidth,4) as 1|2|3|4,priceScaleId:scaleId},owner).setData(points);
          guard.success(type);
          if(admin.diagnostics)reportIndicator(scope,entry.id,reply?.ms??performance.now()-started,bounded.length,gaps.missing?`${gaps.missing} missing history intervals`:"",result.incremental?"incremental":result.cached?"cache":"full",reply?.stats.points??cache.stats().points);
          }catch(e){if(disposed)return;used.delete(type+":"+entry.plot);const failures=guard.fail(type);reportIndicator(scope,entry.id,performance.now()-started,0,(e instanceof Error?e.message:String(e))+(guard.blocked(type)?" — paused after "+failures+" failures":""));}
        }
        continue;
      }
      const config = INDICATOR_REGISTRY.find((r) => r.type === type);
      if (!config) continue;

      if(nativeUnchanged&&nativeKeys.has(type)){if(nativePaneKey(type))usedPanes.add(type);for(const key of indicatorSeriesRef.current.keys())if(key===type||key.startsWith(type+"-"))used.add(key);continue;}
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
              color: p.value >= 0 ? trendColors.up + "99" : trendColors.down + "99",
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
    nativePrevious=indCandles.map(x=>({...x}));nativeKeys=new Set(activeIndicators.filter(x=>!x.startsWith("custom:")));
    for(const key of indicatorSeriesRef.current.keys())if(!used.has(key))remove(key);
    panes?.retain(usedPanes);
    }finally{busy=false;if(rerun&&!disposed){rerun=false;void sync();}}
    };
    let timer:ReturnType<typeof setTimeout>|undefined;
    const schedule=()=>{if(timer!==undefined)return;timer=setTimeout(()=>{timer=undefined;sync();},200);};
    sync();source.subscribeDataChanged(schedule);liveVolumeRef?.current?.subscribeDataChanged(schedule);
    const volume=liveVolumeRef?.current;
    return()=>{disposed=true;source.unsubscribeDataChanged(schedule);volume?.unsubscribeDataChanged(schedule);if(timer!==undefined)clearTimeout(timer);};
    // chartRef/candleSeriesRef are stable refs; colors derived from isDark dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndicators, chartData, isDark, library, volumeData, overrides, admin, sourceSeconds, chartEpoch, liveVolumeRef, scope, isReplaying, history, historyKey, symbol,paneRoot,colors]);

  useEffect(()=>{const chart=chartRef.current;const seriesMap=indicatorSeriesRef.current;const cache=cacheRef.current;const guard=guardRef.current;const signatures=signaturesRef.current;const owners=ownersRef.current;return()=>{if(chart)for(const [key,series] of seriesMap){try{(owners.get(key)??chart).removeSeries(series);}catch{/* disposed */}}owners.clear();seriesMap.clear();paneManagerRef.current?.dispose();paneManagerRef.current=null;cache.clear();guard.reset();signatures.clear();workerRef.current?.stop();workerRef.current=null;};},[chartEpoch,chartRef]);

  const replaySlice=isReplaying?chartData:undefined;
  const automaticDefinitions=JSON.stringify(library.filter(x=>allowedCustom.includes(`custom:${x.id}`)).map(x=>resolveIndicator(x,overrides)).filter(x=>x.visible&&x.kind==="session-candle"&&x.sessionSchedule==="automatic"));
  const scheduleKey=JSON.stringify([symbol,isReplaying,replayCutoff,automaticDefinitions,adapterToken]);
  const [schedules,setSchedules]=useState<{key:string;entries:Record<string,ResolvedMarketSchedule>}>({key:"",entries:{}});
  useEffect(()=>{const entries=JSON.parse(automaticDefinitions) as ImportedIndicator[];if(!entries.length||!symbol)return;let disposed=false;let busy=false;const refresh=async()=>{if(busy)return;busy=true;try{const cutoff=isReplaying?replayCutoff*1000:Date.now();const values:Record<string,ResolvedMarketSchedule>={};for(const entry of entries){if(disposed)return;try{values[entry.id]=await resolveMarketSchedule(getAdapter().marketData,symbol,entry,cutoff);}catch{values[entry.id]={config:{...entry,sessionSchedule:"manual" as const},message:"Provider unavailable — manual fallback",fallback:true};}}if(!disposed)setSchedules({key:scheduleKey,entries:values});}finally{busy=false;}};void refresh();const timer=isReplaying?undefined:setInterval(()=>void refresh(),60000);return()=>{disposed=true;if(timer!==undefined)clearInterval(timer);};},[automaticDefinitions,symbol,isReplaying,replayCutoff,scheduleKey]);
  useEffect(()=>{if(schedules.key!==scheduleKey)return;for(const [id,value] of Object.entries(schedules.entries))if(value.fallback)reportIndicator(scope,id,0,0,value.message);},[schedules,scheduleKey,scope]);
  const [sessionHistory,setSessionHistory]=useState<{key:string;entries:Record<string,SessionHistory>}>({key:"",entries:{}});
  const sessionDefinitions=JSON.stringify(library.filter(x=>allowedCustom.includes(`custom:${x.id}`)).map(x=>resolveIndicator(x,overrides)).filter(x=>x.visible&&x.kind==="session-candle"&&x.historySource==="independent").flatMap(x=>x.sessionSchedule!=="automatic"?[x]:schedules.key===scheduleKey&&schedules.entries[x.id]?[schedules.entries[x.id]!.config]:[]));
  const sessionKey=JSON.stringify([symbol,isReplaying,replayCutoff,sessionDefinitions,admin.maxBars,adapterToken]);
  useEffect(()=>{const entries=JSON.parse(sessionDefinitions) as ImportedIndicator[];if(!entries.length||!symbol)return;let disposed=false;let busy=false;let loaded=false;
    const refresh=async()=>{if(busy)return;busy=true;try{const cutoff=isReplaying?replayCutoff:Math.floor(Date.now()/1000);if(!cutoff)return;
      const results:Record<string,SessionHistory>={};for(const entry of entries){if(disposed)return;publishHistory(scope,symbol,entry.id,loaded?"refreshing":"loading");try{results[entry.id]=await sessionHistoryCache.get(symbol,entry,cutoff,admin.maxBars);}catch(e){results[entry.id]={rows:[],step:60,error:String(e),coveredThrough:0};}}
      if(!disposed){setSessionHistory({key:sessionKey,entries:results});loaded=true;for(const entry of entries){const result=results[entry.id]!;const waiting=result.error==="Aguardando a primeira vela fechada";const limited=result.error==="A sessão excede o limite de histórico disponível";publishHistory(scope,symbol,entry.id,waiting?"empty":limited?"limited":historyPhase(result.rows.length,result.error),result.rows.length,result.error);if(!waiting)reportIndicator(scope,entry.id,0,result.rows.length,result.error);}}
    }finally{busy=false;}};
    void refresh();const timer=isReplaying?undefined:setInterval(()=>void refresh(),15000);return()=>{disposed=true;if(timer!==undefined)clearInterval(timer);};
  },[sessionDefinitions,symbol,isReplaying,replayCutoff,sessionKey,admin.maxBars,scope,sessionHistoryCache]);
  const bestHoursDefinitions=JSON.stringify(library.filter(x=>allowedCustom.includes(`custom:${x.id}`)).map(x=>resolveIndicator(x,overrides)).filter(x=>x.visible&&x.kind==="session-candle"&&x.bestHoursEnabled).flatMap(x=>x.sessionSchedule!=="automatic"?[x]:schedules.key===scheduleKey&&schedules.entries[x.id]?[schedules.entries[x.id]!.config]:[]));
  const bestHoursKey=JSON.stringify([symbol,isReplaying,replayCutoff,bestHoursDefinitions,Math.min(720,admin.maxBars),adapterToken]);
  const [bestHours,setBestHours]=useState<{key:string;entries:Record<string,{analysis:BestHoursAnalysis;rows:CandleData[]}>}>({key:"",entries:{}});
  useEffect(()=>{const entries=JSON.parse(bestHoursDefinitions) as ImportedIndicator[];retainBestHours(scope,symbol,entries.map(entry=>entry.id));if(!entries.length||!symbol||!adapter)return;let disposed=false;let busy=false;
    const refresh=async()=>{if(busy)return;busy=true;const cutoff=isReplaying?replayCutoff:Math.floor(Date.now()/60)*60;try{const limit=Math.min(720,admin.maxBars);const values:Record<string,{analysis:BestHoursAnalysis;rows:CandleData[]}>={};for(const entry of entries){const analysisConfig={days:entry.days,open:entry.open,close:entry.close,timezone:entry.timezone};const cacheKey=JSON.stringify([symbol,isReplaying?replayCutoff:"live",Math.floor(cutoff/60),limit,adapterToken,entry.id,entry.bestHoursPeriod,analysisConfig]);const snapshot=await loadBestHoursSnapshot(cacheKey,async()=>[...await adapter.marketData.getCandles({symbol,timeframe:"1h",limit,toMs:cutoff*1000})] as CandleData[],entry,entry.bestHoursPeriod,cutoff);values[entry.id]=snapshot;publishBestHours({scope,symbol,id:entry.id,analysis:snapshot.analysis,error:"",updatedAt:Date.now()});}if(!disposed)setBestHours({key:bestHoursKey,entries:values});}catch(error){const message=error instanceof Error?error.message:String(error);for(const entry of entries)publishBestHours({scope,symbol,id:entry.id,error:message,updatedAt:Date.now()});}finally{busy=false;}};
    void refresh();const timer=isReplaying?undefined:setInterval(()=>void refresh(),60000);return()=>{disposed=true;if(timer!==undefined)clearInterval(timer);};
  },[bestHoursDefinitions,bestHoursKey,symbol,isReplaying,replayCutoff,adapterToken,adapter,admin.maxBars,scope]);
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const allowed=activeIndicators.filter(x=>x.startsWith("custom:")).slice(0,admin.maxActive);
    const primitives = library.filter(x => allowed.includes(`custom:${x.id}`)).flatMap(x => {const raw=resolveIndicator(x,overrides);if(!raw.visible)return [];const resolved=schedules.key===scheduleKey?schedules.entries[raw.id]:undefined;const entry=raw.sessionSchedule==="automatic"?(resolved?.config??{...raw,sessionSchedule:"manual" as const}):raw;const items:import("lightweight-charts").ISeriesPrimitive<Time>[]=[];if(raw.sessionSchedule==="automatic"&&!resolved)return [];const ranked=bestHours.key===bestHoursKey?bestHours.entries[entry.id]:undefined;if(entry.kind==="session-candle")items.push(new SessionCandlePrimitive(entry,sourceSeconds,admin.maxBars,replaySlice,entry.historySource==="independent"?(sessionHistory.key===sessionKey?sessionHistory.entries[entry.id]?.rows??[]:[]):undefined,sessionHistory.entries[entry.id]?.step??60,ranked?.analysis,ranked?.rows));if(entry.graphics.length)items.push(new GraphicPrimitive(entry.graphics,replaySlice));return items;});
    const attached:typeof primitives=[];
    for (const primitive of primitives) {try{series.attachPrimitive(primitive);attached.push(primitive);}catch(e){console.warn("Indicator attachment failed",e);}}
    return () => { for (const primitive of attached) { try { series.detachPrimitive(primitive); } catch { /* disposed chart */ } } };
  }, [activeIndicators, library, overrides, admin, sourceSeconds, chartEpoch, isReplaying, replaySlice,sessionHistory,sessionKey,schedules,scheduleKey,bestHours,bestHoursKey,candleSeriesRef]);
}
