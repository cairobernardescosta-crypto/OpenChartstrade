# OpenCharts Indicator SDK (initial foundation)

SDK 1 accepts a .ts file containing exactly `export default` followed by a JSON object (optional semicolon). It never evaluates imported JavaScript or TypeScript functions. Supported declarative kinds: sma, ema, session-candle. Arbitrary TypeScript, package imports and executable code are rejected. This restriction is deliberate because OpenCharts handles wallet and trading operations.

The schema, session calculation, local library and unit tests form the first implementation increment. UI and chart rendering integration, per-chart instances, IndexedDB, versioning and broader renderer support are not yet implemented. The local library uses localStorage for this initial bounded prototype.
