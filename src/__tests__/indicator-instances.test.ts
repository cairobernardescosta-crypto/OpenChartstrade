import {describe,it,expect} from "vitest";
import {resolveIndicator,linkedOverridesFrom,validateOverrides} from "../lib/indicator-sdk/instances";
import {parseIndicator,HTF_EXAMPLE} from "../lib/indicator-sdk/schema";
describe("chart overrides",()=>{
 const original=parseIndicator("export default "+HTF_EXAMPLE);
 it("resolves local settings without changing the definition",()=>{expect(resolveIndicator(original,[{...original,open:"12:00"}]).open).toBe("12:00");expect(original.open).toBe("18:00");});
 it("ignores incompatible versions",()=>expect(resolveIndicator(original,[{...original,version:"0.0.1",open:"12:00"}])).toEqual(original));
 it("copies the selected chart settings into an isolated linked snapshot",()=>{const primary=[{...original,open:"12:00"}];const linked=linkedOverridesFrom("primary",{primary,secondary:[],linked:[]});expect(linked).toEqual(primary);expect(linked[0]).not.toBe(primary[0]);expect(linked[0]!.parameters).not.toBe(primary[0]!.parameters);});
 it("migrates persisted settings without a linked scope",()=>{expect(validateOverrides({primary:[],secondary:[]})).toEqual({primary:[],secondary:[],linked:[]});});
});
