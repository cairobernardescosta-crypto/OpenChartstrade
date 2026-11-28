import {describe,expect,it,vi} from "vitest";
import {analyzeBestHours,loadBestHoursSnapshot} from "../lib/indicator-sdk/best-hours";
import {resolveBestHourTimestamp,resolveBestHourTimestamps} from "../lib/indicator-sdk/renderer";
import {indicatorSchema} from "../lib/indicator-sdk/schema";
import type {CandleData} from "../lib/indicators";

const hour=3600;
const bar=(time:number,low=100,high=101):CandleData=>({time,open:low,high,low,close:high,volume:1});
const base=indicatorSchema.parse({sdk:1,id:"htf",name:"HTF",version:"1.0.0",kind:"session-candle",sessionSchedule:"utc-24h",timezone:"UTC"});

describe("best trading hours",()=>{

 it("resolves a ranked hour on the chart timeline without requiring a candle",()=>{
  const start=Date.UTC(2026,0,8,0)/1000,end=Date.UTC(2026,0,9,0)/1000;
  expect(resolveBestHourTimestamp(start,end,10,"UTC")).toBe(Date.UTC(2026,0,8,10)/1000);
 });
 it("resolves local hour boundaries in the configured timezone",()=>{
  const start=Date.UTC(2026,0,8,3)/1000,end=Date.UTC(2026,0,9,3)/1000;
  expect(resolveBestHourTimestamp(start,end,9,"America/Sao_Paulo")).toBe(Date.UTC(2026,0,8,12)/1000);
 });
 it("supports overnight sessions and rejects hours outside the session",()=>{
  const start=Date.UTC(2026,0,5,18)/1000,end=Date.UTC(2026,0,6,2)/1000;
  expect(resolveBestHourTimestamp(start,end,1,"UTC")).toBe(Date.UTC(2026,0,6,1)/1000);
  expect(resolveBestHourTimestamp(start,end,10,"UTC")).toBeNull();
 });
 it("does not invent a timestamp for a local hour skipped by daylight saving",()=>{
  const start=Date.UTC(2026,2,8,5)/1000,end=Date.UTC(2026,2,8,9)/1000;
  expect(resolveBestHourTimestamp(start,end,2,"America/New_York")).toBeNull();
  expect(resolveBestHourTimestamp(start,end,3,"America/New_York")).toBe(Date.UTC(2026,2,8,7)/1000);
 });
 it("shares one fetch and analysis snapshot between linked charts",async()=>{const cutoff=Date.UTC(2026,0,8)/1000;const load=vi.fn(async()=>[bar(cutoff-2*hour)]);const key="linked-best-hours-test";const first=loadBestHoursSnapshot(key,load,base,1,cutoff);const second=loadBestHoursSnapshot(key,load,base,1,cutoff);expect(load).toHaveBeenCalledTimes(1);const [a,b]=await Promise.all([first,second]);expect(a).toBe(b);expect(a.analysis.period).toBe(1);});
 it("keeps schema defaults backward compatible",()=>expect(base).toMatchObject({bestHoursEnabled:false,bestHoursPeriod:7,bestHoursCount:3,bestHoursLineStyle:"dashed"}));
 it("calculates mean, median, population deviation and ranking",()=>{const cutoff=Date.UTC(2026,0,8)/1000;const rows=[bar(cutoff-7*86400+10*hour,100,102),bar(cutoff-6*86400+10*hour,100,104),bar(cutoff-5*86400+10*hour,100,106),bar(cutoff-7*86400+11*hour,100,101),bar(cutoff-6*86400+11*hour,100,101),bar(cutoff-5*86400+11*hour,100,101)];const result=analyzeBestHours(rows,base,7,cutoff);expect(result.ranking[0]).toMatchObject({hour:10,mean:4,median:4,observations:3,consistency:"moderate"});expect(result.ranking[0]!.standardDeviation).toBeCloseTo(Math.sqrt(8/3));});
 it("uses observation minimums for each period",()=>{const cutoff=Date.UTC(2026,1,1)/1000;const make=(count:number)=>Array.from({length:count},(_,i)=>bar(cutoff-(i+1)*86400+9*hour));expect(analyzeBestHours(make(1),base,1,cutoff).ranking).toHaveLength(1);expect(analyzeBestHours(make(2),base,7,cutoff).insufficient).toBe(true);expect(analyzeBestHours(make(5),base,15,cutoff).ranking).toHaveLength(1);expect(analyzeBestHours(make(7),base,30,cutoff).insufficient).toBe(true);});
 it("marks the 24 hour result provisional",()=>{const cutoff=Date.UTC(2026,0,2)/1000;expect(analyzeBestHours([bar(cutoff-2*hour)],base,1,cutoff).ranking[0]?.confidence).toBe("provisional");});
 it("deduplicates a date/hour and rejects invalid, future and forming candles",()=>{const cutoff=Date.UTC(2026,0,8,12)/1000;const valid=bar(cutoff-2*hour,100,105);const rows=[valid,{...valid,high:150},bar(cutoff-hour/2),bar(cutoff+hour),{...bar(cutoff-3*hour),high:99}];const result=analyzeBestHours(rows,base,1,cutoff);expect(result.hours).toHaveLength(1);expect(result.hours[0]).toMatchObject({observations:1,mean:5});});
 it("keeps only full hourly candles inside an overnight session",()=>{const config=indicatorSchema.parse({...base,sessionSchedule:"manual",open:"18:00",close:"02:00",days:[1,2,3,4,5]});const cutoff=Date.UTC(2026,0,6,3)/1000;const rows=[bar(Date.UTC(2026,0,5,17)/1000),bar(Date.UTC(2026,0,5,18)/1000),bar(Date.UTC(2026,0,6,1)/1000),bar(Date.UTC(2026,0,6,2)/1000)];const result=analyzeBestHours(rows,config,1,cutoff);expect(result.hours.map(row=>row.hour)).toEqual([1,18]);});
 it("groups by the configured timezone and applies chronological tie break",()=>{const config={...base,timezone:"America/Sao_Paulo"};const cutoff=Date.UTC(2026,0,8,12)/1000;const rows=[bar(Date.UTC(2026,0,7,12)/1000),bar(Date.UTC(2026,0,6,12)/1000),bar(Date.UTC(2026,0,5,12)/1000),bar(Date.UTC(2026,0,7,13)/1000),bar(Date.UTC(2026,0,6,13)/1000),bar(Date.UTC(2026,0,5,13)/1000)];const result=analyzeBestHours(rows,config,7,cutoff);expect(result.ranking.map(row=>row.hour)).toEqual([9,10]);expect(result.timezone).toBe("America/Sao_Paulo");});

 it("uses local calendar days across a daylight-saving boundary",()=>{const config=indicatorSchema.parse({...base,sessionSchedule:"manual",timezone:"America/New_York",open:"00:00",close:"23:59",days:[0,1,2,3,4,5,6]});const cutoff=Date.UTC(2026,2,9,16)/1000;const beforeLocalWindow=bar(Date.UTC(2026,2,2,16)/1000);const insideLocalWindow=bar(Date.UTC(2026,2,2,17)/1000);const result=analyzeBestHours([beforeLocalWindow,insideLocalWindow],config,7,cutoff);expect(result.hours.reduce((sum,row)=>sum+row.observations,0)).toBe(1);});
 it("counts only configured trading weekdays in analysis coverage",()=>{const config=indicatorSchema.parse({...base,sessionSchedule:"manual",timezone:"America/New_York",open:"00:00",close:"23:59",days:[1,2,3,4,5]});const cutoff=Date.UTC(2026,0,11,17)/1000;const rows=[0,1,2,3,4].map(day=>bar(Date.UTC(2026,0,5+day,15)/1000));const result=analyzeBestHours(rows,config,7,cutoff);expect(result.hours[0]?.expectedDays).toBe(5);});
 it("folds the repeated autumn DST hour into one daily observation",()=>{const config=indicatorSchema.parse({...base,sessionSchedule:"manual",timezone:"America/New_York",open:"00:00",close:"23:59",days:[0,1,2,3,4,5,6]});const cutoff=Date.UTC(2026,10,1,8)/1000;const rows=[bar(Date.UTC(2026,10,1,5)/1000,100,102),bar(Date.UTC(2026,10,1,6)/1000,100,104)];const result=analyzeBestHours(rows,config,1,cutoff);expect(result.hours).toHaveLength(1);expect(result.hours[0]).toMatchObject({hour:1,observations:1,mean:3});});

 it("projects every daily occurrence across a weekly session without duplicating the DST fallback hour",()=>{const weekStart=Date.UTC(2026,0,5,18)/1000,weekEnd=Date.UTC(2026,0,12,18)/1000;expect(resolveBestHourTimestamps(weekStart,weekEnd,10,"UTC")).toEqual(Array.from({length:7},(_,i)=>Date.UTC(2026,0,6+i,10)/1000));const fallbackStart=Date.UTC(2026,10,1,4)/1000,fallbackEnd=Date.UTC(2026,10,1,8)/1000;expect(resolveBestHourTimestamps(fallbackStart,fallbackEnd,1,"America/New_York")).toEqual([Date.UTC(2026,10,1,5)/1000]);});
});
