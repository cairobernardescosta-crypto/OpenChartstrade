import {describe,it,expect} from "vitest";
import {RuntimeGuard,runBoundedExpression,MAX_RUNTIME_BARS} from "../lib/indicator-sdk/runtime";
const candle={time:1,open:4,high:8,low:2,close:6,volume:10};
describe("restricted indicator runtime",()=>{
 it("evaluates allowed expressions",()=>expect(runBoundedExpression([candle],"sqrt(close*close)")).toEqual([{time:1,value:6}]));
 it("rejects network calls",()=>expect(()=>runBoundedExpression([candle],"fetch(close)")).toThrow());
 it("rejects oversized history",()=>expect(()=>runBoundedExpression(Array(MAX_RUNTIME_BARS+1).fill(candle),"close")).toThrow());
 it("enforces a cooperative time budget",()=>expect(()=>runBoundedExpression([candle],"close",{},-1)).toThrow());
 it("pauses after consecutive failures",()=>{const guard=new RuntimeGuard();guard.fail("a");guard.fail("a");expect(guard.blocked("a")).toBe(false);guard.fail("a");expect(guard.blocked("a")).toBe(true);expect(guard.blocked("b")).toBe(false);guard.reset();expect(guard.blocked("a")).toBe(false);});
 it("clears consecutive failures after success",()=>{const guard=new RuntimeGuard();guard.fail("a");guard.fail("a");guard.success("a");guard.fail("a");expect(guard.blocked("a")).toBe(false);});
});
