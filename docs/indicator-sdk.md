# OpenCharts Indicator SDK 1
Import a .ts containing exactly export default followed by a JSON object. No executable TypeScript is run. Supported kinds: sma, ema, session-candle, expression. Expressions accept bounded OHLCV arithmetic only (+ - * / parentheses); no calls, imports, network or wallet access. Example: {"sdk":1,"id":"typical","name":"Typical price","version":"1.0.0","kind":"expression","expression":"(high+low+close)/3"}.
Use Indicators > Import indicator; preview parameters, save and activate. Includes search, favorites, duplication, name/color/settings editing, export, five prior definition snapshots and JSON library backup/restore. Storage remains localStorage. Edit applies to the selected chart, Reset restores library defaults. Duplicate creates another independently configurable definition. Version changes invalidate stale chart overrides. Library backup does not include chart overrides.
Session candle supports opening/closing, IANA timezone, weekdays, color, opacity, width, distance and visibility. Future boundary projection is approximate with gaps/coarse candles; complete session history is required. Leave sufficient right chart margin. Historical volume is now passed to mathematical indicators; live-volume updates still require verification.
Not complete: IndexedDB, arbitrary TS sandbox, full drawing API, true lower panes, multi-timeframe requests, visual preview, diagnostic/admin dashboard, incremental updates, comprehensive replay tests, template snapshots of overrides. Run local typecheck, lint, unit tests, E2E and build before release.

## Increment: storage and management
IndexedDB mirrors library, revision history and per-chart overrides asynchronously; localStorage remains the authoritative compatibility cache. Manual mirror recovery restores library definitions. Library export includes revision history; chart settings are exported/restored separately. Preview uses synthetic data, not the live chart. Administrative limits restrict imported active instances and mathematical history size. The session primitive is still not bounded by the mathematical history limit. Diagnostics show persistence errors and counts, not measured memory/CPU. Arbitrary TS execution, full graphical DSL, real multi-timeframe aggregation and live integration validation remain outstanding.

## Declarative graphics
The graphics kind accepts up to 100 validated drawing commands: line, horizontal, vertical, box, text, arrow and table. Coordinates use price and logical bar offsets from the latest bar. These are static declarative graphics, not a general programmable drawing runtime. Graphics preview reports validated command count; actual chart rendering requires local validation.

## Live update and aggregation increment
Mathematical series are reused while active and refreshed from candle/volume series subscriptions, coalesced to 200 ms. Calculations remain full-window, not O(1). Imported mathematical kinds can aggregate complete UTC-aligned periods from loaded lower-resolution candles; incomplete buckets and gaps are excluded and output is timestamped at the last contributing bar. No independent market-data requests are made. HTF session drawing rejects incomplete starting history and incompatible source boundaries; future coordinates remain approximate and visible right margin is still needed. Local typecheck and browser testing are required.

## Template and diagnostic increment
Templates now include active imported definitions and chart-specific overrides. Loading validates definitions, installs only missing IDs, retains existing installed versions, and filters unknown indicator IDs. Older templates remain supported. Scope changes remount the template menu; the existing global template selection/autosave preferences remain shared. Diagnostic timings measure mathematical calculation and series update wall time; not CPU or memory. Calculation errors are isolated per imported mathematical indicator and its series is removed for that update. Source view displays the normalized declarative definition, not an original source archive. Local verification pending.

## Primary persistence
IndexedDB records are read on startup, validated and migrated from the compatibility cache only if absent. LocalStorage remains a best-effort recovery cache. In-session revisions prevent delayed hydration from overwriting a newer local edit. Library, history, chart overrides and admin settings are persisted. Multi-tab conflicts, crash durability and migration require browser tests before release.

## Parameter and plot increment
Bounded expression functions abs/sqrt/log/exp/floor/ceil/round and up to 20 named numeric parameters (p_ prefix) are interpreted without JavaScript execution. Custom math can render as line, area or histogram. Category and active filters and per-chart visibility are available. True separate panes and arbitrary TypeScript remain unsupported. Tests added, not run.

## Calendar and session periods
Weekly aggregation aligns to Monday UTC; calendar month aggregation uses actual month length, excludes incomplete or gapped buckets, and is computed from loaded chart history. HTF session candles support full session or session-relative intraday segments. Session lines remain visible even when projected candle has no viewport space. Independent external timeframe fetching remains unsupported.

## Restricted runtime guard
Imported expressions execute only through the bounded interpreter, with a 20,000-bar hard ceiling and cooperative 100 ms deadline checked every 64 bars. SMA/EMA duration is checked after calculation. Three consecutive failures pause the calculation until the hook is recreated (for example, toggling the indicator). Errors remain visible even when success diagnostics are disabled. This is capability restriction, not an arbitrary TypeScript sandbox or a hard browser memory/process limit. No imported code receives wallet, network or storage APIs. Local tests pending.

## Drawing object lifecycle
Graphics support optional stable IDs, individual updates/removal, visibility, three primitive layers, OHLC-relative price anchors and custom OHLC candle drawings. Mathematical indicators may carry graphics in addition to their plot. Independent overlay price scales are supported; true separate lower panes require a chart-library migration and are not implemented here. No arbitrary script execution is introduced. Local verification pending.

## Manager phase
A unified JSON backup contains definitions, history, both chart scopes and administrative settings. All sections are validated before restore; writes remain separate queued IndexedDB transactions, not atomic across stores. The manager supports original definition editing and selection of up to five saved revisions. Startup hydration guards prevent library and override changes during initial reads. Existing separate backup controls remain available. Browser migration and restore tests remain pending.

## Performance phase
Per-chart bounded calculation cache (12 entries, 100,000 combined input/output points), exact OHLCV prefix comparison, incremental expression suffix calculations, shared aggregation, and unchanged-output rendering skip. SMA/EMA recompute when input changes to preserve rolling-window semantics. Runtime failure guards persist across ordinary React updates and reset on definition changes or deactivation. Diagnostics record ten recent errors per indicator and flag slow calculations. No measured benchmark or local test result is claimed.

## Template and replay phase
Templates capture effective imported settings, validate before mutation and resolve version conflicts by keeping the installed definition while applying a chart-local snapshot. Secondary template selection and autosave state are separate from primary. Secondary templates do not change shared appearance preferences. Replay math and session primitives consume the supplied historical slice, rather than live series data. Native graphics still use the chart series for anchors. Full replay integration and UI verification remain pending.

## Independent history
Optional independent history uses the existing read-only market API, explicit exclusive end times (no extra chart subscriptions), a 16-entry request cache, at most six distinct periods per chart, and 30-second live refresh. Native intervals are requested directly; others derive from hourly or daily candles. Results are aligned to chart bars only after their source close. Replay uses the historical cursor, never wall-clock future candles. Missing history renders no output. Local verification pending.

## HTF session lifecycle
Session range freezes through closing and disabled weekdays, resets at the next eligible opening, and rejects missing or misaligned source bars when resolution is provided. Full-session boundary lines are independent of intraday HTF segments. Projection is anchored to the last contributing bar and stays inside the session and viewport where space permits. A dashed edge marker indicates offscreen closing time, not its actual chart coordinate. Preview uses actual sample OHLC extrema and configured offset/period. Local visual verification remains pending.

## Regression protection
Chart-derived HTF values are aligned at confirmed source close, replay graphics use only the historical slice, independent histories honor administrative limits and active math indicator selection, and cache entries use source-aware keys and LRU refresh. Recovery rejects concurrent edits. Added regression coverage for rewind, close-time alignment and executable imports. Native trading and wallet modules untouched. Local checks pending.

## Resource diagnostics
The worker queue is limited to four requests and each request to 20,000 candles. Cache diagnostics expose retained points and an approximate 64-byte-per-point budget estimate; this is not measured browser heap usage or a hard process memory limit. A browser Worker cannot enforce an independent absolute heap quota.

## Session extensions
Weekly and monthly civil-period options and a 24/7 UTC convention are available. The latter is not an official exchange calendar or underlying commodity schedule. Independent session history currently requests up to 5,000 closed one-minute bars, so long periods may be incomplete and intentionally hidden. Local validation and further long-history integration remain pending.

## Additional medium corrections
The expression whitelist now includes trigonometric functions, sign, log10 and remainder. Drawing objects support line styles and an editor for creating all supported commands and validating their properties. Native indicators skip identical-input recomputation within the chart effect. Arbitrary executable TypeScript and independent heap limits remain intentionally unsupported.

## M05 independent lower panes
Lightweight Charts 4 remains installed. Native RSI, MACD, ATR and STOCH are grouped in separate chart instances with independent right-hand scales; custom math indicators may select a lower pane and a height of 80–320px. Each child chart uses the parent candle timeline and synchronizes visible logical ranges in both directions. Panes are removed when unused and disposed with their chart. Price overlays and drawing primitives remain on the parent. Crosshair synchronization and visual alignment require local verification.

## M10 workspace backup
Version 2 optionally includes saved chart templates and adapter-persisted drawings grouped by symbol. Version 1 remains accepted. Restore merges template names and drawing IDs, preserving unrelated records. All sections are validated before writes. Native adapter storage does not provide transactions, so failed restores attempt compensating rollback and report incomplete rollback. Export covers currently listed symbols and the persisted drawing index; unsaved secondary-chart drawings are not included. Wallet, account credentials, journal and orders are excluded. Local validation pending.

## M17 visual preferences
Primary preferences retain their existing keys. Secondary preferences are stored in the same user-scoped preference store under chart.secondary.* with independent defaults. Settings dialogs and template snapshots apply to their own chart; lower panes follow their owning chart colors. Drawing interaction preferences are scoped as well. Existing primary settings remain unchanged. Local visual, persistence and template verification pending.

## M19 market gaps
Continuous 24/7 is the default, including Hyperliquid HIP-3; underlying oracle market closure is not an excuse to ignore missing exchange bars. An explicit UTC weekday-only aggregation policy supports known weekend closures, not exchange holidays or intraday schedules. Incomplete open intervals are rejected, invalid OHLCV is rejected for aggregation, and custom plots emit whitespace instead of indefinite stale values. Local validation pending.

## M20 independent HTF history
Each enabled session indicator requests its own bounded session interval, using the finest supported aligned source resolution within the configured bar budget. Requests are paginated in blocks of up to 5,000 candles, deduplicated, and restricted to closed candles at the replay/live cutoff. Missing coverage is reported instead of fabricating OHLC. Live refresh runs every 15 seconds; it is not tick-level streaming. Calendar-period coverage and official exchange schedules receive further work in M21/M22. Local validation pending.

## M21 weekly and monthly historical coverage
Weekly HTF uses Monday boundaries and monthly HTF uses actual civil calendar months, including leap years. UTC 24/7 remains continuous; a manual calendar with explicit UTC weekday gap policy permits known weekend gaps but rejects missing open bars. Source resolution can fall back to aligned 4h or 1d candles within the configured bar budget. Completed derived weekly/monthly indicator values become available at the true calendar boundary, and monthly values expire at the next real month boundary rather than a fixed 31-day interval. Partial session projections are labeled. Coarser source bars identify the bar containing the extreme, not the exact intrabar timestamp. Exchange holidays and provider schedules remain M22. Local validation pending.

## M22 automatic market schedules
The adapter contract optionally supplies a recurring session for a symbol at a given timestamp. Hyperliquid declares its continuous UTC trading convention for recognized markets, not the underlying oracle's exchange calendar. Automatic mode validates provider metadata, refreshes every minute in live mode, uses replay timestamps, and falls back to stored manual settings when metadata is unavailable. The provider contract currently represents recurring hours only; exchange holidays, exceptional closures and intraday maintenance intervals are not supplied by Hyperliquid and are not inferred. Local validation pending.

## M23 market-data preview
The indicator editor uses the selected chart's actual closed bars, or independent historical data according to the indicator configuration. Replay is bounded to the replay timestamp. Session previews use the session calculation and optional provider schedule. Illustrative candles require explicit selection and are labeled. Graphics-only commands retain a summary and require activation for full rendering. Local tests and visual verification pending.
