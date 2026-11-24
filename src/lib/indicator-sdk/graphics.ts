import {z} from "zod";
const coord=z.object({bars:z.number().int().min(-20000).max(100),price:z.number().finite()}).strict();
const style={id:z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(),visible:z.boolean().default(true),layer:z.enum(["bottom","normal","top"]).default("normal"),anchor:z.enum(["price","open","high","low","close"]).default("price"),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),width:z.number().int().min(1).max(5).default(1),opacity:z.number().min(0.1).max(1).default(1)};
export const graphicSchema=z.discriminatedUnion("type",[
 z.object({type:z.literal("candle"),bars:z.number().int().min(-20000).max(100),open:z.number().finite(),high:z.number().finite(),low:z.number().finite(),close:z.number().finite(),bodyWidth:z.number().min(1).max(50).default(8),...style}).strict(),
 z.object({type:z.literal("line"),from:coord,to:coord,...style}).strict(),
 z.object({type:z.literal("horizontal"),price:z.number().finite(),...style}).strict(),
 z.object({type:z.literal("vertical"),bars:z.number().int().min(-20000).max(100),...style}).strict(),
 z.object({type:z.literal("box"),from:coord,to:coord,fill:z.boolean().default(false),...style}).strict(),
 z.object({type:z.literal("text"),at:coord,text:z.string().max(200),...style}).strict(),
 z.object({type:z.literal("arrow"),from:coord,to:coord,...style}).strict(),
 z.object({type:z.literal("table"),at:coord,rows:z.array(z.array(z.string().max(80)).min(1).max(5)).min(1).max(10),...style}).strict(),
]);
export type Graphic=z.infer<typeof graphicSchema>;

export function validateGraphics(raw:unknown):Graphic[]{const rows=graphicSchema.array().max(100).parse(raw);const ids=rows.flatMap(x=>x.id?[x.id]:[]);if(new Set(ids).size!==ids.length)throw new Error("Duplicate drawing IDs");for(const row of rows)if(row.type==="candle"&&(row.high<Math.max(row.open,row.close)||row.low>Math.min(row.open,row.close)))throw new Error("Invalid candle OHLC");return rows;}
export function updateGraphic(rows:readonly Graphic[],id:string,value:unknown):Graphic[]{if(!rows.some(x=>x.id===id))throw new Error("Unknown drawing ID");const next=graphicSchema.parse(value);return validateGraphics(rows.map(x=>x.id===id?{...next,id}:x));}
export function removeGraphic(rows:readonly Graphic[],id:string):Graphic[]{return rows.filter(x=>x.id!==id);}
