import {afterEach,describe,expect,it} from "vitest";
import {act,renderHook} from "@testing-library/react";
import {publishBestHours,retainBestHours,useBestHoursStatuses} from "../lib/indicator-sdk/best-hours-status";
import type {BestHoursAnalysis} from "../lib/indicator-sdk/best-hours";

const analysis:BestHoursAnalysis={period:7,timezone:"America/Sao_Paulo",minimumObservations:3,hours:[],ranking:[],insufficient:true};
const symbol="phase5:xyz:GOLD";
const id="phase5-best-hours-scope";

afterEach(()=>{
  act(()=>{
    retainBestHours("primary",symbol,[]);
    retainBestHours("secondary",symbol,[]);
    retainBestHours("primary","phase5:xyz:ETH",[]);
  });
});

describe("Best Hours independent chart scopes",()=>{
  it("keeps statuses isolated when both charts use the same symbol and indicator",()=>{
    const {result}=renderHook(()=>useBestHoursStatuses());
    act(()=>{
      publishBestHours({scope:"primary",symbol,id,analysis,error:"",updatedAt:1});
      publishBestHours({scope:"secondary",symbol,id,analysis,error:"",updatedAt:2});
    });
    expect(result.current.filter(row=>row.symbol===symbol&&row.id===id)).toHaveLength(2);
    expect(result.current.find(row=>row.scope==="primary")?.updatedAt).toBe(1);
    expect(result.current.find(row=>row.scope==="secondary")?.updatedAt).toBe(2);
  });

  it("updates and removes one chart status without clearing the other chart",()=>{
    const {result}=renderHook(()=>useBestHoursStatuses());
    act(()=>{
      publishBestHours({scope:"primary",symbol,id,analysis,error:"",updatedAt:1});
      publishBestHours({scope:"secondary",symbol,id,analysis,error:"",updatedAt:2});
      publishBestHours({scope:"primary",symbol,id,analysis,error:"primary refreshed",updatedAt:3});
    });

    act(()=>retainBestHours("primary",symbol,[]));
    const remaining=result.current.filter(row=>row.symbol===symbol&&row.id===id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({scope:"secondary",updatedAt:2,error:""});
  });

  it("does not overwrite a different symbol in the same chart scope",()=>{
    const otherSymbol="phase5:xyz:ETH";
    const {result}=renderHook(()=>useBestHoursStatuses());
    act(()=>{
      publishBestHours({scope:"primary",symbol,id,analysis,error:"",updatedAt:1});
      publishBestHours({scope:"primary",symbol:otherSymbol,id,analysis,error:"",updatedAt:2});
    });
    expect(result.current.filter(row=>row.scope==="primary"&&row.id===id)).toHaveLength(2);
    act(()=>retainBestHours("primary",otherSymbol,[id]));
    expect(result.current.filter(row=>row.scope==="primary"&&row.id===id).map(row=>row.symbol)).toEqual([otherSymbol]);
  });
});
