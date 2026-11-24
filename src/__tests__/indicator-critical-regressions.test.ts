import {describe,it,expect} from "vitest";
import {alignHistoryPoints} from "../lib/indicator-sdk/independent-history";
import {prepareTemplateSnapshot} from "../lib/indicator-sdk/template-snapshot";
import {indicatorSchema} from "../lib/indicator-sdk/schema";
const row=indicatorSchema.parse({sdk:1,id:"critical",name:"Critical",version:"2.0.0",kind:"expression"});
describe("critical protections",()=>{it("preserves source version",()=>{const result=prepareTemplateSnapshot([row],[{...row,version:"1.0.0"}],[],["custom:critical"]);expect(result.overrides[0]).toMatchObject({version:"1.0.0",snapshotBaseVersion:"2.0.0"});});it("does not extend stale values indefinitely",()=>{expect(alignHistoryPoints([{time:0,value:2}],[{time:3600,open:1,high:2,low:1,close:2}],3600)).toEqual([]);});});
