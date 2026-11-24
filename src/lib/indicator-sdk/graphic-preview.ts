import type {CandleData} from "../indicators";
import type {Graphic} from "./graphics";
export function graphicPrice(rows:readonly CandleData[],bars:number,price:number,anchor:Graphic["anchor"],multiplier:number){if(anchor==="price")return Number.isFinite(price)?price:null;const bar=rows[rows.length-1+bars];if(!bar)return null;const value=bar[anchor]*multiplier+price;return Number.isFinite(value)?value:null;}
export function graphicOffsetVisible(bars:number,count:number,replay:boolean){return Number.isInteger(bars)&&bars>=1-count&&bars<=(replay?0:100);}
export function graphicOffsets(g:Graphic):number[]{switch(g.type){case "horizontal":return [0];case "vertical":case "candle":return [g.bars];case "text":case "table":return [g.at.bars];default:return [g.from.bars,g.to.bars];}}
