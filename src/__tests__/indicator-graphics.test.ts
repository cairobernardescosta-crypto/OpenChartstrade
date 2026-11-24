import {describe,it,expect} from "vitest";
import {graphicSchema} from "../lib/indicator-sdk/graphics";
describe("graphic commands",()=>{
 it("accepts price anchored horizontal lines",()=>expect(graphicSchema.parse({type:"horizontal",price:100,color:"#ffffff"}).type).toBe("horizontal"));
 it("rejects unknown commands",()=>expect(graphicSchema.safeParse({type:"execute",code:"alert(1)"}).success).toBe(false));
 it("rejects excessive offsets",()=>expect(graphicSchema.safeParse({type:"vertical",bars:10000,color:"#ffffff"}).success).toBe(false));
});
