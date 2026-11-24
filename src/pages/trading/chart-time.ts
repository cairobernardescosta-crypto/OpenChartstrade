import { TickMarkType, type Time } from "lightweight-charts";

export const CHART_TIME_ZONE = "America/Sao_Paulo";

function dateFromChartTime(time: Time): Date {
  if (typeof time === "number") return new Date(time * 1000);
  if (typeof time === "string") return new Date(time);
  return new Date(Date.UTC(time.year, time.month - 1, time.day));
}

export function formatChartTime(time: Time): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: CHART_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(dateFromChartTime(time));
}

export function formatChartTick(time: Time, type: TickMarkType): string {
  const date = dateFromChartTime(time);
  if (type === TickMarkType.Year) return new Intl.DateTimeFormat("pt-BR", {timeZone:CHART_TIME_ZONE,year:"numeric"}).format(date);
  if (type === TickMarkType.Month) return new Intl.DateTimeFormat("pt-BR", {timeZone:CHART_TIME_ZONE,month:"short"}).format(date);
  if (type === TickMarkType.DayOfMonth) return new Intl.DateTimeFormat("pt-BR", {timeZone:CHART_TIME_ZONE,day:"2-digit",month:"short"}).format(date);
  return new Intl.DateTimeFormat("pt-BR", {timeZone:CHART_TIME_ZONE,hour:"2-digit",minute:"2-digit",second:type===TickMarkType.TimeWithSeconds?"2-digit":undefined,hourCycle:"h23"}).format(date);
}
