import {describe,it,expect} from "vitest";
import {indicatorSchema,parameterValues} from "../lib/indicator-sdk/schema";
import {compileExpression} from "../lib/indicator-sdk/expression";
const base={sdk:1,id:"params",name:"Params",version:"1.0.0",kind:"expression",expression:"abs(close-p_offset)",parameters:[{key:"p_offset",label:"Offset",min:0,max:20,step:1,value:10,defaultValue:5}]};
describe("bounded parameters",()=>{it("evaluates allowed functions",()=>{const c=indicatorSchema.parse(base);expect(compileExpression(c.expression,parameterValues(c))({time:1,open:5,high:6,low:4,close:5})).toBe(5);});it("rejects arbitrary calls",()=>expect(indicatorSchema.safeParse({...base,expression:"fetch(close)"}).success).toBe(false));it("rejects duplicate parameters",()=>expect(indicatorSchema.safeParse({...base,parameters:[...base.parameters,...base.parameters]}).success).toBe(false));});
