import {afterEach,describe,expect,it} from "vitest";
import {publishBestHours,retainBestHours,useBestHoursStatuses} from "../lib/indicator-sdk/best-hours-status";
import type {BestHoursAnalysis} from "../lib/indicator-sdk/best-hours";

const analysis:BestHoursAnalysis={period:7,timezone:"America/Sao_Paulo",minimumObservations:3,hours:[],ranking:[],insufficient:true};
const symbol="phase5:xyz:GOLD";
const id="phase5-best-hours-scope";

afterEach(()=>{
  retainBestHours("primary",symbol,[]);
  retainBestHours("secondary",symbol,[]);
});

describe("Best Hours independent chart scopes",()=>{
  it("keeps statuses isolated when both charts use the same symbol and indicator",()=>{
    publishBestHours({scope:"primary",symbol,id,analysis,error:"",updatedAt:1});
    publishBestHours({scope:"secondary",symbol,id,analysis,error:"",updatedAt:2});

    expect(useBestHoursStatuses().filter(row=>row.symbol===symbol&&row.id===id)).toHaveLength(2);
    expect(useBestHoursStatuses().find(row=>row.scope==="primary")?.updatedAt).toBe(1);
    expect(useBestHoursStatuses().find(row=>row.scope==="secondary")?.updatedAt).toBe(2);
  });

  it("updates and removes one chart status without clearing the other chart",()=>{
    publishBestHours({scope:"primary",symbol,id,analysis,error:"",updatedAt:1});
    publishBestHours({scope:"secondary",symbol,id,analysis,error:"",updatedAt:2});
    publishBestHours({scope:"primary",symbol,id,analysis,error:"primary refreshed",updatedAt:3});

    retainBestHours("primary",symbol,[]);
    const remaining=useBestHoursStatuses().filter(row=>row.symbol===symbol&&row.id===id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({scope:"secondary",updatedAt:2,error:""});
  });

  it("retains another symbol independently within the same chart scope",()=>{
    const otherSymbol="phase5:xyz:ETH";
    publishBestHours({scope:"primary",symbol,id,analysis,error:"",updatedAt:1});
    publishBestHours({scope:"primary",symbol:otherSymbol,id,analysis,error:"",updatedAt:2});

    retainBestHours("primary",symbol,[]);
    expect(useBestHoursStatuses().some(row=>row.symbol===otherSymbol&&row.id===id)).toBe(true);
    retainBestHours("primary",otherSymbol,[]);
  });
});
