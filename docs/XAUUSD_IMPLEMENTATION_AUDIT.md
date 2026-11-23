# XAUUSD integration audit and implementation plan

## Scope

This audit covers the OpenCharts fork at commit `399e27538d8150796571dbdecbe920a54b771de4` and the preservation protocol in `AGENTS.md` from commit `612d923f1d2bd3ab5894644df76a3e56e78d7685`.

The goal is to make a gold instrument available through the existing market-data and terminal architecture. Do not create a parallel chart, hardcode an unverified contract, or label a perpetual market as spot XAUUSD.

## Phase 1 - source and architecture audit

### Confirmed in the repository

1. `src/hyperliquid/info.ts` already exposes the public Hyperliquid `perpDexs`, `meta`, `perpCategories`, `allMids`, `candleSnapshot` and `l2Book` requests.
2. `src/hyperliquid/symbols.ts` builds a registry from the current dex list and each dex's live `meta.universe`. It skips delisted instruments and maps active markets to the OpenCharts `Symbol` contract.
3. The same file already classifies `GOLD` as `Commodities` and gives it the display name `Gold`. This is a classification rule only. It is not proof that a live GOLD market is currently listed.
4. `src/hyperliquid/marketData.ts` uses the same generic market registry for historical candles, live candle subscriptions, BBO quotes and per-dex `allMids`. It resolves the selected instrument by its exact provider symbol.
5. `src/hyperliquid/ui/HlWatchlist.tsx` and `watchlistModel.ts` already support dynamic market lists, search, favorites and the Commodities category.
6. The shared chart and indicator pipeline consumes the adapter's generic candles. A market returned by the Hyperliquid registry can use that pipeline without a separate XAU chart implementation.
7. `src/components/TradingViewWidgets.tsx` maps the external widget symbol `XAUUSD` to `TVC:GOLD`. These embeds are supplementary, not the primary chart feed, and are disabled in Hyperliquid mode by the existing security guard.
8. Existing unit tests verify GOLD category classification and generic HIP-3 handling with mocked markets. They do not establish that a live gold market currently exists or that its live candles and quote are available.

### Important distinction

A provider symbol such as `xyz:GOLD` is a Hyperliquid HIP-3 perpetual market. It must not automatically be presented as a spot XAUUSD feed. Before enabling trading or calling it XAUUSD, confirm the active provider market, underlying/oracle definition, contract specification, price behavior outside the underlying market hours, and whether its candles and top-of-book are currently available.

### Runtime verification added

`scripts/hl-smoke-xauusd.mts` is a read-only diagnostic. It discovers active GOLD/XAU instruments from the live registry, then checks recent 1h candles and the top-of-book quote. It does not place orders, create a symbol, or generate substitute prices.

Run locally with Node 22.18+:

```bash
node scripts/hl-smoke-xauusd.mts
```

Or:

```bash
npx tsx scripts/hl-smoke-xauusd.mts
```

A result showing no active market, missing candles, or a missing quote is a failed verification, not permission to fabricate a feed.

## Implementation phases

### Phase 1 - audit and source verification
- [x] Inspect the existing adapter, registry, market-data path, watchlist and chart contracts.
- [x] Identify the existing GOLD commodity classification.
- [x] Add a read-only live smoke test for active GOLD/XAU markets.
- [x] Run the smoke test locally and record the exact provider symbol, dex, candles and quote.
- [x] Confirm that the discovered instrument is a HIP-3 perpetual market and must not be labelled as spot XAUUSD.

Local runtime evidence supplied on 2026-11-23:
- Active market: `xyz:GOLD` (dex `xyz`, asset id `110003`).
- Five 1h candles returned successfully.
- Top of book returned bid `3658.6` and ask `3658.9`.
- The observed instrument is a Hyperliquid perpetual contract, not a verified spot XAU/USD feed.

### Phase 2 - symbol identity and discovery
Only after Phase 1 confirms the live instrument:
- Reuse the exact provider symbol as the canonical internal ID.
- Add a user-facing XAUUSD alias only if the provider contract genuinely represents the requested XAU/USD instrument.
- Ensure search, category, watchlist, selected symbol and persisted favorites use the existing symbol contract.
- Do not duplicate a market already returned by the live registry.

### Phase 3 - chart and history
- Verify historical OHLC candles for supported intervals.
- Verify live candle and quote updates.
- Confirm timestamps, price precision, volume semantics and history limits.
- Reuse the existing chart and adapter pipeline.

### Phase 4 - indicators and drawing tools
- Verify the existing indicator engine against the gold candle series.
- Verify overlays, oscillators, drawing tools and timeframe changes.
- Add no gold-specific indicator implementation unless a real contract difference requires it.

### Phase 5 - terminal integration
- Verify watchlist, search, favorites, instrument details and price display.
- Verify alerts, replay and paper trading only where their existing contracts support the instrument.
- Keep live order placement gated by verified market metadata and the existing Hyperliquid risk/compliance flow.

### Phase 6 - interface consistency
- Preserve existing typography, colors, buttons, icons, spacing, responsive behavior, transitions and loading/error states.
- Do not create a separate gold-only terminal or bypass shared components.

### Phase 7 - validation
- Run focused unit tests, full tests, typecheck, lint and build locally.
- Start the application and verify gold and existing crypto instruments side by side.
- Verify that unavailable or stale market data is shown honestly.
- Record all checks as passed, failed or pending.

## Current status

**Phase 1 code audit and basic live provider verification: complete.** The existing dynamic registry already discovers `xyz:GOLD` under its exact provider symbol, and the shared adapter resolves that same symbol for history and quotes. No XAUUSD alias or separate chart is required or justified by the evidence. A focused regression test was added for all supported intervals and live event routing; its local execution remains pending.

The GitHub API environment can inspect and commit repository content, but it cannot truthfully report a local runtime smoke test, local build, browser validation or the user's local Git working-tree state. Those checks remain pending until the diagnostic is run in the local project.

No production application code, trading behavior or symbol aliases were changed. The existing shared adapter path is being covered by focused GOLD integration tests rather than duplicated with a gold-only implementation. No GitHub Actions or workflows are used.
