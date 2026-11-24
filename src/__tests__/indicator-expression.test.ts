import {describe,it,expect} from "vitest";
import {compileExpression,expressionPoints} from "../lib/indicator-sdk/expression";
const c={time:1,open:10,high:14,low:8,close:12,volume:5};
describe("bounded indicator expression",()=>{
  it("respects precedence",()=>expect(compileExpression("open + close * 2")(c)).toBe(34));
  it("supports OHLCV",()=>expect(compileExpression("(high+low)/2+volume")(c)).toBe(16));
  it.each(["fetch('x')","close.constructor","globalThis","while(1)","close;1"])("rejects %s",s=>expect(()=>compileExpression(s)).toThrow());
  it("drops nonfinite output",()=>expect(expressionPoints([c],"close/0")).toEqual([]));
});
