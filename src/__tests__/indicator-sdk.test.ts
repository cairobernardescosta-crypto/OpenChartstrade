import { describe, it, expect } from "vitest";
import { parseIndicator, HTF_EXAMPLE } from "../lib/indicator-sdk/schema";
import { sessionRange } from "../lib/indicator-sdk/session";
describe("declarative indicator SDK", () => {
  it("parses the example",()=>expect(parseIndicator("export default "+HTF_EXAMPLE+";").kind).toBe("session-candle"));
  it("rejects executable source",()=>expect(()=>parseIndicator("export default (() => fetch('/'))();")).toThrow());
  it("rejects invalid hours",()=>expect(()=>parseIndicator('export default {"sdk":1,"id":"test","name":"Test","version":"1.0.0","kind":"session-candle","open":"25:00"}')).toThrow());
  it("aggregates overnight sessions and excludes close boundary",()=>{
    const config={...parseIndicator("export default "+HTF_EXAMPLE),timezone:"UTC"};
    const bar=(iso:string, close:number)=>({time:Date.parse(iso)/1000,open:close,high:close+1,low:close-1,close});
    const range=sessionRange([bar("2026-01-01T18:00:00Z",10),bar("2026-01-02T10:00:00Z",15),bar("2026-01-02T17:00:00Z",100)],config);
    expect(range?.open).toBe(10); expect(range?.high).toBe(16); expect(range?.close).toBe(15);
  });
});
