import {describe,expect,it} from "vitest";
import {resolveMarketSchedule} from "../lib/indicator-sdk/market-schedule";
import {sessionBounds} from "../lib/indicator-sdk/session";
import {indicatorSchema} from "../lib/indicator-sdk/schema";
import type {MarketDataSource} from "../adapter/types";

const hour=3600;
const utc=(year:number,month:number,day:number,hourOfDay=0)=>Date.UTC(year,month-1,day,hourOfDay)/1000;
const base=indicatorSchema.parse({
  sdk:1,id:"schedule-locks",name:"Schedule Locks",version:"1.0.0",kind:"session-candle",
  sessionSchedule:"automatic",timezone:"UTC",open:"00:00",close:"23:59",days:[0,1,2,3,4,5,6],
});
const source:MarketDataSource={getSymbols:async()=>[],getCandles:async()=>[],subscribe:()=>()=>{}};

describe("automatic and calendar session day policies",()=>{
  it("applies provider weekday restrictions to automatic non-continuous markets",async()=>{
    const provider:MarketDataSource={...source,getMarketSchedule:async()=>({
      timezone:"UTC",open:"00:00",close:"23:59",days:[1,2,3,4,5],continuous:false,source:"Provider weekdays",
    })};
    const resolved=await resolveMarketSchedule(provider,"GOLD",base,0);
    expect(resolved.fallback).toBe(false);
    expect(resolved.config).toMatchObject({sessionSchedule:"manual",days:[1,2,3,4,5]});
    const friday=utc(2026,11,27);
    expect(sessionBounds(resolved.config,utc(2026,11,28,12))).toMatchObject({
      start:friday,end:friday+23*hour+59*60,
    });
  });

  it("intentionally releases day locks when the provider declares a continuous market",async()=>{
    const provider:MarketDataSource={...source,getMarketSchedule:async()=>({
      timezone:"UTC",open:"00:00",close:"00:00",days:[0,1,2,3,4,5,6],continuous:true,source:"Provider 24/7",
    })};
    const resolved=await resolveMarketSchedule(provider,"GOLD",base,0);
    expect(resolved.config.sessionSchedule).toBe("utc-24h");
    expect(sessionBounds(resolved.config,utc(2026,11,28,12))).toMatchObject({
      start:utc(2026,11,28),end:utc(2026,11,29),
    });
    expect(sessionBounds(resolved.config,utc(2026,11,29,12))).toMatchObject({
      start:utc(2026,11,29),end:utc(2026,11,30),
    });
  });

  it("keeps weekly and monthly calendar periods independent of daily weekday locks",()=>{
    const weekly=indicatorSchema.parse({...base,sessionSchedule:"manual",sessionMinutes:"week",days:[1,2,3,4,5]});
    const monthly=indicatorSchema.parse({...base,sessionSchedule:"manual",sessionMinutes:"month",days:[1,2,3,4,5]});
    const saturday=utc(2026,11,28,12);
    expect(sessionBounds(weekly,saturday)).toMatchObject({
      start:utc(2026,11,23),end:utc(2026,11,30),
    });
    expect(sessionBounds(monthly,saturday)).toMatchObject({
      start:utc(2026,11,1),end:utc(2026,12,1),
    });
  });
});
