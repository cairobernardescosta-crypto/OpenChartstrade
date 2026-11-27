export type ChartIndicatorScope = "primary" | "secondary";

/**
 * Resolve the source of imported-indicator settings for a chart.
 * Linked charts read from one selected source; unlinked charts keep their own scope.
 */
export function resolveIndicatorSettingsScope(
  chartScope: ChartIndicatorScope,
  chartsLinked: boolean,
  linkedSource: ChartIndicatorScope,
): ChartIndicatorScope {
  return chartsLinked ? linkedSource : chartScope;
}
