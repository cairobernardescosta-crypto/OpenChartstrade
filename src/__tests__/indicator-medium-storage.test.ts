import {describe,it,expect} from "vitest";
import {CalculationCache} from "../lib/indicator-sdk/calculation-cache";
describe("cache accounting",()=>{it("starts empty",()=>expect(new CalculationCache().stats()).toEqual({entries:0,points:0}));});
