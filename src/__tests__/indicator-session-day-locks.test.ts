import {describe,expect,it} from "vitest";
import {analyzeBestHours} from "../lib/indicator-sdk/best-hours";
import {sessionBounds} from "../lib/indicator-sdk/session";
import {indicatorSchema} from "../lib/indicator-sdk/schema";
import type {CandleData} from "../lib/indicators";

const hour=3600;
const utc=(year:number,month:number,day:number,hourOfDay=0)=>Date.UTC(year,month-1,day,hourOfDay)/1000;
const bar=(time:number,low=100,high=102):CandleData=>({time,open:low,high,low,close:high,volume:1});

const weekdays=indicatorSchema.parse({
  sdk:1,id:"day-locks",name:"Day Locks",version:"1.0.0",kind:"session-candle",
  sessionSchedule:"manual",timezone:"UTC",open:"00:00",close:"23:59",days:[1,2,3,4,5],
});

describe("session day locks",()=>{
  it("freezes the last eligible weekday session during Saturday and Sunday",()=>{
    const friday=utc(2026,11,27);
    const expected={start:friday,end:friday+23*hour+59*60};
    expect(sessionBounds(weekdays,utc(2026,11,28,12))).toMatchObject(expected);
    expect(sessionBounds(weekdays,utc(2026,11,29,12))).toMatchObject(expected);
  });

  it("starts a new session on Monday and does not inherit the weekend lock",()=>{
    const monday=utc(2026,11,30);
    expect(sessionBounds(weekdays,monday+12*hour)).toMatchObject({
      start:monday,end:monday+23*hour+59*60,
    });
  });

  it("keeps a Friday overnight session open on Saturday morning but not Saturday evening",()=>{
    const overnight=indicatorSchema.parse({
      ...weekdays,open:"18:00",close:"17:00",
    });
    const friday=utc(2026,11,27);
    const saturdayMorning=utc(2026,11,28,2);
    const saturdayEvening=utc(2026,11,28,18);
    const expected={start:friday+18*hour,end:friday+24*hour+17*hour};
    expect(sessionBounds(overnight,saturdayMorning)).toMatchObject(expected);
    expect(sessionBounds(overnight,saturdayEvening)).toMatchObject(expected);
    expect(saturdayEvening).toBeGreaterThan(expected.end);
  });

  it("applies weekday locks using the configured IANA timezone",()=>{
    const saoPaulo=indicatorSchema.parse({
      ...weekdays,timezone:"America/Sao_Paulo",open:"09:00",close:"17:00",
    });
    const monday=utc(2026,11,30,13);
    expect(sessionBounds(saoPaulo,monday)).toMatchObject({
      start:utc(2026,11,30,12),end:utc(2026,11,30,20),
    });
  });

  it("returns no eligible session when every day is locked",()=>{
    const noDays=indicatorSchema.parse({...weekdays,days:[]});
    expect(sessionBounds(noDays,utc(2026,11,30,12))).toBeNull();
  });

  it("excludes weekend candles from Best Hours while retaining configured weekdays",()=>{
    const cutoff=utc(2026,12,1);
    const rows=Array.from({length:7},(_,index)=>bar(utc(2026,11,24+index,10)));
    const result=analyzeBestHours(rows,weekdays,7,cutoff);
    const ten=result.hours.find(row=>row.hour===10);
    expect(ten).toMatchObject({observations:5,observedDays:5,expectedDays:5});
  });
});
