import {describe,expect,it} from "vitest";
import {analyzeBestHours} from "../lib/indicator-sdk/best-hours";
import {indicatorSchema} from "../lib/indicator-sdk/schema";
import type {CandleData} from "../lib/indicators";

const hour=3600;
const bar=(time:number,low=100,high=101):CandleData=>({time,open:low,high,low,close:high,volume:1});
const base=indicatorSchema.parse({sdk:1,id:"htf",name:"HTF",version:"1.0.0",kind:"session-candle",sessionSchedule:"utc-24h",timezone:"UTC"});

describe("best trading hours",()=>{
 it("keeps schema defaults backward compatible",()=>expect(base).toMatchObject({bestHoursEnabled:false,bestHoursPeriod:7,bestHoursCount:3,bestHoursLineStyle:"dashed"}));
 it("calculates mean, median, population deviation and ranking",()=>{const cutoff=Date.UTC(2026,0,8)/1000;const rows=[bar(cutoff-7*86400+10*hour,100,102),bar(cutoff-6*86400+10*hour,100,104),bar(cutoff-5*86400+10*hour,100,106),bar(cutoff-7*86400+11*hour,100,101),bar(cutoff-6*86400+11*hour,100,101),bar(cutoff-5*86400+11*hour,100,101)];const result=analyzeBestHours(rows,base,7,cutoff);expect(result.ranking[0]).toMatchObject({hour:10,mean:4,median:4,observations:3,consistency:"moderate"});expect(result.ranking[0]!.standardDeviation).toBeCloseTo(Math.sqrt(8/3));});
 it("uses observation minimums for each period",()=>{const cutoff=Date.UTC(2026,1,1)/1000;const make=(count:number)=>Array.from({length:count},(_,i)=>bar(cutoff-(i+1)*86400+9*hour));expect(analyzeBestHours(make(1),base,1,cutoff).ranking).toHaveLength(1);expect(analyzeBestHours(make(2),base,7,cutoff).insufficient).toBe(true);expect(analyzeBestHours(make(5),base,15,cutoff).ranking).toHaveLength(1);expect(analyzeBestHours(make(7),base,30,cutoff).insufficient).toBe(true);});
 it("marks the 24 hour result provisional",()=>{const cutoff=Date.UTC(2026,0,2)/1000;expect(analyzeBestHours([bar(cutoff-2*hour)],base,1,cutoff).ranking[0]?.confidence).toBe("provisional");});
 it("deduplicates a date/hour and rejects invalid, future and forming candles",()=>{const cutoff=Date.UTC(2026,0,8,12)/1000;const valid=bar(cutoff-2*hour,100,105);const rows=[valid,{...valid,high:150},bar(cutoff-hour/2),bar(cutoff+hour),{...bar(cutoff-3*hour),high:99}];const result=analyzeBestHours(rows,base,1,cutoff);expect(result.hours).toHaveLength(1);expect(result.hours[0]).toMatchObject({observations:1,mean:5});});
 it("keeps only full hourly candles inside an overnight session",()=>{const config=indicatorSchema.parse({...base,sessionSchedule:"manual",open:"18:00",close:"02:00",days:[1,2,3,4,5]});const cutoff=Date.UTC(2026,0,6,3)/1000;const rows=[bar(Date.UTC(2026,0,5,17)/1000),bar(Date.UTC(2026,0,5,18)/1000),bar(Date.UTC(2026,0,6,1)/1000),bar(Date.UTC(2026,0,6,2)/1000)];const result=analyzeBestHours(rows,config,1,cutoff);expect(result.hours.map(row=>row.hour)).toEqual([1,18]);});
 it("groups by the configured timezone and applies chronological tie break",()=>{const config={...base,timezone:"America/Sao_Paulo"};const cutoff=Date.UTC(2026,0,8,12)/1000;const rows=[bar(Date.UTC(2026,0,7,12)/1000),bar(Date.UTC(2026,0,6,12)/1000),bar(Date.UTC(2026,0,5,12)/1000),bar(Date.UTC(2026,0,7,13)/1000),bar(Date.UTC(2026,0,6,13)/1000),bar(Date.UTC(2026,0,5,13)/1000)];const result=analyzeBestHours(rows,config,7,cutoff);expect(result.ranking.map(row=>row.hour)).toEqual([9,10]);expect(result.timezone).toBe("America/Sao_Paulo");});
});
