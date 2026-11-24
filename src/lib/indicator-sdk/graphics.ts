import {z} from "zod";
const coord=z.object({bars:z.number().int().min(-20000).max(100),price:z.number().finite()}).strict();
const style={color:z.string().regex(/^#[0-9a-fA-F]{6}$/),width:z.number().int().min(1).max(5).default(1),opacity:z.number().min(0.1).max(1).default(1)};
export const graphicSchema=z.discriminatedUnion("type",[
 z.object({type:z.literal("line"),from:coord,to:coord,...style}).strict(),
 z.object({type:z.literal("horizontal"),price:z.number().finite(),...style}).strict(),
 z.object({type:z.literal("vertical"),bars:z.number().int().min(-20000).max(100),...style}).strict(),
 z.object({type:z.literal("box"),from:coord,to:coord,fill:z.boolean().default(false),...style}).strict(),
 z.object({type:z.literal("text"),at:coord,text:z.string().max(200),...style}).strict(),
 z.object({type:z.literal("arrow"),from:coord,to:coord,...style}).strict(),
 z.object({type:z.literal("table"),at:coord,rows:z.array(z.array(z.string().max(80)).min(1).max(5)).min(1).max(10),...style}).strict(),
]);
export type Graphic=z.infer<typeof graphicSchema>;
