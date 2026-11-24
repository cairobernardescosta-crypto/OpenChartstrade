import { z } from "zod";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const indicatorSchema = z.object({
  sdk: z.literal(1),
  id,
  name: z.string().trim().min(1).max(80),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500).default(""),
  kind: z.enum(["sma", "ema", "session-candle"]),
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
}).strict();

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
