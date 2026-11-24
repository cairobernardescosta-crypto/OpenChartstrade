import { z } from "zod";
import { compileExpression } from "./expression";
import {graphicSchema} from "./graphics";
import {aggregationMinutes} from "./aggregate";

const parameterSchema=z.object({key:z.string().regex(/^p_[a-z][a-z0-9_]{0,30}$/),label:z.string().min(1).max(60),min:z.number().finite(),max:z.number().finite(),step:z.number().positive().finite(),value:z.number().finite(),defaultValue:z.number().finite()}).strict().refine(p=>p.min<=p.value&&p.value<=p.max&&p.min<=p.defaultValue&&p.defaultValue<=p.max,"Parameter outside bounds");
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const indicatorSchema = z.object({
  sdk: z.literal(1),
  id,
  name: z.string().trim().min(1).max(80),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500).default(""),
  kind: z.enum(["sma", "ema", "session-candle", "expression", "graphics"]),
  graphics:z.array(graphicSchema).max(100).default([]),
  expression: z.string().max(512).default("close"),
  parameters:z.array(parameterSchema).max(20).default([]),
  plot:z.enum(["line","histogram","area"]).default("line"),
  category:z.string().max(60).default("Custom"),
  visible:z.boolean().default(true),
  aggregation:z.number().refine(v=>aggregationMinutes.some(m=>m===v),"Unsupported aggregation").default(0),
  favorite: z.boolean().default(false),
  author: z.string().max(80).default(""),
  opacity: z.number().min(0.1).max(1).default(1),
  days: z.array(z.number().int().min(0).max(6)).max(7).default([0,1,2,3,4,5,6]),
  showWicks: z.boolean().default(true),
  showLabels: z.boolean().default(true),
  showOpenPrice: z.boolean().default(true),
  showCandle: z.boolean().default(true),
  lineWidth: z.number().int().min(1).max(5).default(1),
  period: z.number().int().min(1).max(5000).default(20),
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("18:00"),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("17:00"),
  timezone: z.string().max(80).default("America/Sao_Paulo").refine(v => {
    try { new Intl.DateTimeFormat("en", { timeZone: v }); return true; } catch { return false; }
  }, "Invalid time zone"),
  color: color.default("#60b35c"),
  downColor: color.default("#df5555"),
  lineColor: color.default("#999999"),
  offset: z.number().int().min(1).max(100).default(12),
  width: z.number().int().min(1).max(20).default(8),
  showOpen: z.boolean().default(true),
  showClose: z.boolean().default(true),
  showHighLow: z.boolean().default(true),
}).strict().superRefine((value,ctx)=>{if(new Set(value.parameters.map(p=>p.key)).size!==value.parameters.length)ctx.addIssue({code:"custom",path:["parameters"],message:"Duplicate parameter keys"});if(value.kind==="expression"){try{compileExpression(value.expression,parameterValues(value));}catch(e){ctx.addIssue({code:"custom",path:["expression"],message:String(e)});}}});

export type ImportedIndicator = z.infer<typeof indicatorSchema>;

// Deliberately not a JavaScript evaluator: only an exported JSON literal is accepted.
export function parseIndicator(source: string): ImportedIndicator {
  if (source.length > 65536) throw new Error("Indicator exceeds 64 KiB");
  const match = /^\s*export\s+default\s+([\s\S]+?)\s*;?\s*$/.exec(source);
  if (!match) throw new Error("Expected export default followed by a JSON object");
  return indicatorSchema.parse(JSON.parse(match[1]!));
}

export const HTF_EXAMPLE = JSON.stringify({
  sdk: 1, id: "htf-candle-range", name: "HTF Candle Range", version: "1.0.0",
  kind: "session-candle", open: "18:00", close: "17:00", timezone: "America/Sao_Paulo"
}, null, 2);

export function parameterValues(value:Pick<ImportedIndicator,"parameters">):Record<string,number>{return Object.fromEntries(value.parameters.map(p=>[p.key,p.value]));}
