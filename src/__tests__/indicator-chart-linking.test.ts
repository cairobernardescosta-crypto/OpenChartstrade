import {describe,expect,it} from "vitest";
import {indicatorSchema} from "../lib/indicator-sdk/schema";
import {independentOverridesFromLinked,linkedOverridesFrom,validateOverrides} from "../lib/indicator-sdk/instances";

const definition=indicatorSchema.parse({
  sdk:1,id:"linked-test",name:"Linked test",version:"1.0.0",kind:"session-candle",
  color:"#112233",downColor:"#445566",lineColor:"#778899",lineWidth:3,
  sessionMinutes:"60",bestHoursEnabled:true,bestHoursPeriod:30,bestHoursCount:3,
});

describe("linked chart configuration lifecycle",()=>{
  it("uses the primary chart as the source when selected",()=>{
    const primary={...definition,color:"#111111",sessionMinutes:"60",bestHoursPeriod:7};
    const secondary={...definition,color:"#222222",sessionMinutes:"120",bestHoursPeriod:15};
    expect(linkedOverridesFrom("primary",{primary:[primary],secondary:[secondary],linked:[]})[0]).toMatchObject({color:"#111111",sessionMinutes:"60",bestHoursPeriod:7});
  });
  it("can switch the source to the secondary chart without mixing settings",()=>{
    const primary={...definition,color:"#111111",sessionMinutes:"60",bestHoursPeriod:7};
    const secondary={...definition,color:"#222222",sessionMinutes:"240",bestHoursPeriod:30};
    expect(linkedOverridesFrom("secondary",{primary:[primary],secondary:[secondary],linked:[]})[0]).toMatchObject({color:"#222222",sessionMinutes:"240",bestHoursPeriod:30});
  });
  it("copies the shared state into two isolated scopes when unlinking",()=>{
    const linked={...definition,color:"#abcdef",lineColor:"#fedcba",sessionMinutes:"120",bestHoursPeriod:15,bestHoursCount:3};
    const independent=independentOverridesFromLinked({primary:[],secondary:[],linked:[linked]});
    expect(independent.primary[0]).toMatchObject({color:"#abcdef",lineColor:"#fedcba",sessionMinutes:"120",bestHoursPeriod:15,bestHoursCount:3});
    expect(independent.secondary[0]).toEqual(independent.primary[0]);
    expect(independent.secondary[0]).not.toBe(independent.primary[0]);
    expect(independent.secondary[0]!.parameters).not.toBe(independent.primary[0]!.parameters);
  });
  it("preserves each scope through persisted-state validation and restoration",()=>{
    const stored={primary:[{...definition,color:"#101010"}],secondary:[{...definition,color:"#202020"}],linked:[{...definition,color:"#303030",bestHoursPeriod:30}]};
    const restored=validateOverrides(JSON.parse(JSON.stringify(stored)));
    expect(restored.primary[0]?.color).toBe("#101010");
    expect(restored.secondary[0]?.color).toBe("#202020");
    expect(restored.linked[0]).toMatchObject({color:"#303030",bestHoursPeriod:30});
  });
  it("migrates pre-linking persisted state without losing either chart scope",()=>{
    const restored=validateOverrides({primary:[{...definition,color:"#111111"}],secondary:[{...definition,color:"#222222"}]});
    expect(restored.primary[0]?.color).toBe("#111111");
    expect(restored.secondary[0]?.color).toBe("#222222");
    expect(restored.linked).toEqual([]);
  });
});
