import { useEffect, useRef } from "react";
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
import {aggregateCompleted} from "../../lib/indicator-sdk/aggregate";
import { expressionPoints } from "../../lib/indicator-sdk/expression";
import { useIndicatorLibrary } from "../../lib/indicator-sdk/storage";
import {GraphicPrimitive} from "../../lib/indicator-sdk/graphic-renderer";
import { SessionCandlePrimitive } from "../../lib/indicator-sdk/renderer";
import { CHART_COLORS } from "./constants.ts";

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
): void {
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>>(
    new Map(),
  );
  const library = useIndicatorLibrary();
  const admin = useIndicatorAdmin();
  const overrides = useOverrides(scope);
  const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;

  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    const chart = chartRef.current;
    const source=candleSeriesRef.current;
    const used=new Set<string>();
    const sync=()=>{
    used.clear();
    const live=source.data().flatMap(c=>typeof c.time==="number"&&"open" in c?[c as CandlestickData<Time>]:[]);
    const vols=liveVolumeRef?.current?.data().flatMap(v=>"value" in v?[{time:v.time,value:v.value}]:[])??volumeData;
    const indCandles = toIndicatorCandles(live.length?live:chartData, vols);

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
        if (entry && entry.kind !== "session-candle" && entry.kind !== "graphics") {
          const started=performance.now();
          try {
          const bounded=aggregateCompleted(indCandles.slice(-admin.maxBars),entry.aggregation,sourceSeconds);
          const data = entry.kind === "expression" ? expressionPoints(bounded,entry.expression) : (entry.kind === "sma" ? sma : ema)(bounded, entry.period);
          const s = line(type,{ color: entry.color, lineWidth: entry.lineWidth as 1|2|3|4|5, priceScaleId: "right" });
          s.setData(data.map(p => ({ time: p.time as Time, value: p.value })));
          indicatorSeriesRef.current.set(type, s);
          if(admin.diagnostics)reportIndicator(scope,entry.id,performance.now()-started,bounded.length);
          }catch(e){used.delete(type);if(admin.diagnostics)reportIndicator(scope,entry.id,performance.now()-started,0,e instanceof Error?e.message:String(e));}
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
    };
    let timer:ReturnType<typeof setTimeout>|undefined;
    const schedule=()=>{if(timer!==undefined)return;timer=setTimeout(()=>{timer=undefined;sync();},200);};
    sync();source.subscribeDataChanged(schedule);liveVolumeRef?.current?.subscribeDataChanged(schedule);
    const volume=liveVolumeRef?.current;
    return()=>{source.unsubscribeDataChanged(schedule);volume?.unsubscribeDataChanged(schedule);if(timer!==undefined)clearTimeout(timer);};
    // chartRef/candleSeriesRef are stable refs; colors derived from isDark dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndicators, chartData, isDark, library, volumeData, overrides, admin, sourceSeconds, chartEpoch, liveVolumeRef, scope]);

  useEffect(()=>{const chart=chartRef.current;const seriesMap=indicatorSeriesRef.current;return()=>{if(chart)for(const series of seriesMap.values()){try{chart.removeSeries(series);}catch{/* disposed */}}seriesMap.clear();};},[chartEpoch,chartRef]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const allowed=activeIndicators.filter(x=>x.startsWith("custom:")).slice(0,admin.maxActive);
    const primitives = library.filter(x => allowed.includes(`custom:${x.id}`)).flatMap(x => {const entry=resolveIndicator(x,overrides);return entry.kind==="session-candle"?[new SessionCandlePrimitive(entry,sourceSeconds,admin.maxBars) as import("lightweight-charts").ISeriesPrimitive<Time>]:entry.kind==="graphics"?[new GraphicPrimitive(entry.graphics) as import("lightweight-charts").ISeriesPrimitive<Time>]:[];});
    const attached:typeof primitives=[];
    for (const primitive of primitives) {try{series.attachPrimitive(primitive);attached.push(primitive);}catch(e){console.warn("Indicator attachment failed",e);}}
    return () => { for (const primitive of attached) { try { series.detachPrimitive(primitive); } catch { /* disposed chart */ } } };
  }, [activeIndicators, library, overrides, admin, chartData.length === 0, sourceSeconds, chartEpoch]);
}
