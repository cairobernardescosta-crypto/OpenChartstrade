import {describe,it,expect} from "vitest";
import {nativePaneKey} from "../pages/trading/indicator-panes";
import {indicatorSchema} from "../lib/indicator-sdk/schema";
describe("independent panes",()=>{it("groups native oscillator series",()=>{expect(nativePaneKey("MACD-signal")).toBe("MACD");expect(nativePaneKey("RSI-70")).toBe("RSI");expect(nativePaneKey("SMA")).toBeNull();});it("preserves legacy default and validates pane size",()=>{const row={sdk:1,id:"pane",name:"Pane",version:"1.0.0",kind:"expression"};expect(indicatorSchema.parse(row).scale).toBe("price");expect(indicatorSchema.parse({...row,scale:"pane",paneHeight:180}).paneHeight).toBe(180);expect(indicatorSchema.safeParse({...row,paneHeight:500}).success).toBe(false);});});
