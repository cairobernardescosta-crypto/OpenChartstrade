import type { CandleData, IndicatorPoint } from "../indicators";

// A bounded arithmetic interpreter, not a JavaScript runtime. No identifiers
// other than OHLCV, no property access, calls, loops, imports or external IO.
const functions = {abs: Math.abs, sqrt: Math.sqrt, log:Math.log, exp:Math.exp, floor:Math.floor, ceil:Math.ceil, round:Math.round, sin:Math.sin, cos:Math.cos, tan:Math.tan, sign:Math.sign, log10:Math.log10} as const;
type FunctionName=keyof typeof functions;
type Node = { kind:"number"; value:number } | {kind:"field"; field:"open"|"high"|"low"|"close"|"volume"} | {kind:"parameter";name:string} | {kind:"function";name:FunctionName;arg:Node} | {kind:"binary"; op:string; left:Node; right:Node};
export function compileExpression(source:string,parameters:Readonly<Record<string,number>>={}): (c:CandleData)=>number {
  if(source.length>512) throw new Error("Expression too long");
  const tokens=source.match(/\d+(?:\.\d+)?|[a-zA-Z][a-zA-Z0-9_]*|[+*/()%-]|\s+|./g)?.filter(t=>!/^\s+$/.test(t))??[];
  if(tokens.length>128)throw new Error("Too many tokens");
  let i=0;
  function atom(depth:number):Node {
    if(depth>32)throw new Error("Expression too deep");
    const t=tokens[i++];
    if(t==="("){const n=expr(0,depth+1);if(tokens[i++]!==")")throw new Error("Expected )");return n;}
    if(t==="-"||t==="+")return {kind:"binary",op:t,left:{kind:"number",value:0},right:atom(depth+1)};
    if(t&&/^\d+(?:\.\d+)?$/.test(t)&&Number.isFinite(Number(t)))return {kind:"number",value:Number(t)};
    if(t==="open"||t==="high"||t==="low"||t==="close"||t==="volume")return {kind:"field",field:t};
    if(t&&Object.hasOwn(functions,t)){if(tokens[i++]!=="(")throw new Error("Expected (");const arg=expr(0,depth+1);if(tokens[i++]!==")")throw new Error("Expected )");return {kind:"function",name:t as FunctionName,arg};}
    if(t&&Object.hasOwn(parameters,t)&&Number.isFinite(parameters[t]))return {kind:"parameter",name:t};
    throw new Error("Unsupported token: "+String(t));
  }
  function expr(min:number,depth:number):Node {
    let left=atom(depth);
    while(i<tokens.length){const op=tokens[i]!;const p=op==="+"||op==="-"?1:op==="*"||op==="/"||op==="%"?2:0;if(p===0||p<min)break;i++;left={kind:"binary",op,left,right:expr(p+1,depth+1)};}
    return left;
  }
  const root=expr(0,0);if(i!==tokens.length)throw new Error("Unexpected token");
  function run(n:Node,c:CandleData):number {
    if(n.kind==="number")return n.value;
    if(n.kind==="field")return c[n.field]??NaN;
    if(n.kind==="parameter")return parameters[n.name]??NaN;
    if(n.kind==="function")return functions[n.name](run(n.arg,c));
    const a=run(n.left,c),b=run(n.right,c);
    return n.op==="+"?a+b:n.op==="-"?a-b:n.op==="*"?a*b:b===0?NaN:n.op==="%"?a%b:a/b;
  }
  return c=>run(root,c);
}
export function expressionPoints(candles:readonly CandleData[],source:string,parameters:Readonly<Record<string,number>>={}):IndicatorPoint[]{
  const run=compileExpression(source,parameters);
  return candles.flatMap(c=>{const value=run(c);return Number.isFinite(value)?[{time:c.time,value}]:[];});
}
