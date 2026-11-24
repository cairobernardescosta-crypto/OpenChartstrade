import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { MobileAccountBar, MobileTradingPanel } from "../components/MobileTradingPanel.tsx";
import { type IndicatorType } from "../lib/indicators.ts";
import { useCandles } from "../services/queries.ts";
import { useHoverCollapse } from "../hooks/useHoverCollapse.ts";
import { useChartDrawings } from "../hooks/useChartDrawings.ts";
import { safeStorage } from "../lib/safe-storage.ts";
import type { PlaceOrderInput } from "../services/schemas.ts";
import { updateChartPreferences,useChartPreferences } from "../hooks/useChartPreferences.ts";
import { useTradingStore } from "../services/store.tsx";
import { getWorkspaceMemorySettings } from "../services/workspace-memory.ts";
import { useTerminal } from "../terminal/use-terminal.ts";
import { BottomPanel } from "./trading/BottomPanel.tsx";
import { ChartPanel } from "./trading/ChartPanel.tsx";
import { ChartToolbar } from "./trading/ChartToolbar.tsx";
import { REPLAY_ENABLED, type DrawingTool, type Timeframe } from "./trading/constants.ts";
import { getPipDigits } from "./trading/utils.ts";

 // Optional panels are split into separate chunks and fetched only when opened.
const DOMPanel = lazy(() => import("./trading/DOMPanel.tsx").then((m) => ({ default: m.DOMPanel })));
const WatchlistPanel = lazy(() => import("./trading/WatchlistPanel.tsx").then((m) => ({ default: m.WatchlistPanel })));
const ReplayScrubber = lazy(() => import("./trading/ReplayScrubber.tsx").then((m) => ({ default: m.ReplayScrubber })));
const MarketNewsFeed = lazy(() => import("../components/TradingPowerFeatures.tsx").then((m) => ({ default: m.NewsFeed })));
const TradingViewTechnicalAnalysis = lazy(() => import("../components/TradingViewWidgets.tsx").then((m) => ({ default: m.TradingViewTechnicalAnalysis })));
import { MarketClosedBanner } from "./trading/MarketClosedBanner.tsx";
import { OrderPanel } from "./trading/OrderPanel.tsx";

const SECONDARY_STATE_KEY = "opencharts.workspace.secondary-chart.v1";
const LAYOUT_STATE_KEY = "opencharts.workspace.layout.v1";
const INDICATOR_IDS = new Set(["SMA", "EMA", "RSI", "MACD", "BOLL", "ATR", "STOCH", "VWAP"]);

interface SecondaryChartState {
  symbol?: string;
  timeframe?: Timeframe;
  indicators?: IndicatorType[];
  plugins?: string[];
}
interface LayoutState {
  chartLayout?: "single" | "split";
  activeChart?: "primary" | "secondary";
  bottomTab?: "positions" | "orders" | "history" | "journal" | "calendar" | "news";
  rightPanel?: "order" | "dom" | "watchlist" | "news" | "tv-analysis";
  showRightPanel?: boolean;
}
function readSecondaryState(): SecondaryChartState {
  const memory = getWorkspaceMemorySettings();
  if (!memory.restoreSession) return {};
  const raw = safeStorage.getJSON<unknown>(SECONDARY_STATE_KEY, {});
  if (!raw || typeof raw !== "object") return {};
  const row = raw as Record<string, unknown>;
  const timeframe = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"].includes(String(row.timeframe)) ? row.timeframe as Timeframe : undefined;
  const indicators = Array.isArray(row.indicators) ? [...new Set(row.indicators.filter((value): value is IndicatorType => typeof value === "string" && (INDICATOR_IDS.has(value) || /^custom:[a-z][a-z0-9-]{0,63}$/.test(value))))] : undefined;
  const plugins = Array.isArray(row.plugins) ? [...new Set(row.plugins.filter((value): value is string => typeof value === "string" && value.length <= 100))] : undefined;
  return {
    symbol: memory.assets && typeof row.symbol === "string" && row.symbol.length <= 200 ? row.symbol : undefined,
    timeframe: memory.timeframes ? timeframe : undefined,
    indicators: memory.indicators ? indicators : undefined,
    plugins: memory.appearance ? plugins : undefined,
  };
}
function readLayoutState(): LayoutState {
  const memory = getWorkspaceMemorySettings();
  if (!memory.restoreSession || !memory.layout) return {};
  const raw = safeStorage.getJSON<unknown>(LAYOUT_STATE_KEY, {});
  return raw && typeof raw === "object" ? raw as LayoutState : {};
}

/**
 * The default terminal layout.
 *
 * All shared state comes from `<TerminalProvider>` (see src/terminal/context)
 * — this component only arranges the panels and owns the layout: panel sizes,
 * which tab is open, what is visible. Applications that want a different
 * arrangement compose the panels from `src/terminal/panels.tsx` instead of
 * modifying this file.
 */

export function TradingPage() {
  // Shared terminal state lives in <TerminalProvider>; this component is the
  // default layout on top of it. Panel sizes, tab selection and visibility are
  // layout concerns, so they stay here.
  const {
    selectedSymbol,
    setSelectedSymbol,
    symbols,
    symbolInfo,
    pipDigits,
    tick,
    isDark,
    timeframe,
    setTimeframe: handleTimeframeChange,
    candles,
    liveCandle,
    replayCandles,
    replayTradeEvents,
    isReplaying,
    chartPrefs,
    activeIndicators,
    toggleIndicator,
    clearIndicators: handleClearIndicators,
    activePlugins,
    togglePlugin: handleTogglePlugin,
    setPlugins: handleSetPlugins,
    cycleMagnetMode,
    drawingTool,
    setDrawingTool,
    drawings,
    addDrawing,
    updateDrawing,
    removeDrawing,
    clearDrawings,
    undoDrawing,
    redoDrawing,
    activeAccountId,
    account,
    positions,
    orders,
    positionPnl,
    chartPositions,
    chartOrders,
    isFeedConnected,
    oneClick,
    toggleOneClick,
    soundMuted,
    toggleSoundMute,
    onOrderSuccess,
    requestOrderConfirmation: setConfirmOrder,
    submitOrderDirect,
    quickOrder: handleQuickOrder,
    modifyPositionLevels: handleChartModifyPosition,
    editPosition: setModifyingPosition,
    editOrder: setModifyingOrder,
    journalEntries,
    journalLoading,
    createJournal,
    updateJournal,
    deleteJournal,
  } = useTerminal();

  const [initialSecondary] = useState<SecondaryChartState>(readSecondaryState);
  const [initialLayout] = useState<LayoutState>(readLayoutState);

  // ── Layout state ──
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  const [chartLayout, setChartLayout] = useState<"single" | "split">(initialLayout.chartLayout === "split" ? "split" : "single");
  const [activeChart, setActiveChart] = useState<"primary" | "secondary">(initialLayout.activeChart === "secondary" ? "secondary" : "primary");
  const secondaryPrefs=useChartPreferences("secondary");
  const focusedPrefs=activeChart==="primary"?chartPrefs:secondaryPrefs;
  // The secondary chart owns its market and indicator state. It starts on 1h
  // so split mode is useful immediately for multi-timeframe analysis.
  const [secondarySymbol, setSecondarySymbol] = useState(initialSecondary.symbol ?? selectedSymbol);
  const [secondaryTimeframe, setSecondaryTimeframe] = useState<Timeframe>(initialSecondary.timeframe ?? "1h");
  const [secondaryIndicators, setSecondaryIndicators] = useState<IndicatorType[]>(initialSecondary.indicators ?? []);
  const [secondaryDrawingTool, setSecondaryDrawingTool] = useState<DrawingTool>("none");
  const {
    drawings: secondaryDrawings,
    addDrawing: addSecondaryDrawing,
    updateDrawing: updateSecondaryDrawing,
    removeDrawing: removeSecondaryDrawing,
    clearDrawings: clearSecondaryDrawings,
  } = useChartDrawings(secondarySymbol, secondaryTimeframe, "secondary");
  const [secondaryPlugins, setSecondaryPlugins] = useState<string[]>(initialSecondary.plugins ?? secondaryPrefs.activePlugins);
  const hadStoredSecondaryRef = useRef(Boolean(initialSecondary.symbol));
  // Hyperliquid can replace the initial placeholder symbol after its market
  // list loads. Correct only an invalid secondary symbol; preserve user choice.
  useEffect(() => {
    if (hadStoredSecondaryRef.current || symbols.length === 0 || symbols.some((symbol) => symbol.name === secondarySymbol)) return;
    const fallback = symbols.find((symbol) => symbol.name === selectedSymbol)?.name ?? symbols[0]?.name;
    if (fallback) setSecondarySymbol(fallback);
  }, [secondarySymbol, selectedSymbol, symbols]);

  useEffect(() => {
    const memory = getWorkspaceMemorySettings();
    const previous = safeStorage.getJSON<SecondaryChartState>(SECONDARY_STATE_KEY, {});
    safeStorage.setJSON(SECONDARY_STATE_KEY, {
      ...previous,
      ...(memory.assets ? { symbol: secondarySymbol } : {}),
      ...(memory.timeframes ? { timeframe: secondaryTimeframe } : {}),
      ...(memory.indicators ? { indicators: secondaryIndicators } : {}),
      ...(memory.appearance ? { plugins: secondaryPlugins } : {}),
    } satisfies SecondaryChartState);
  }, [secondarySymbol, secondaryTimeframe, secondaryIndicators, secondaryPlugins]);



  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      if (event.key === "1") {
        event.preventDefault();
        setActiveChart("primary");
        setChartLayout("single");
      } else if (event.key === "2") {
        event.preventDefault();
        setChartLayout("split");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const [bottomTab, setBottomTab] = useState<
    "positions" | "orders" | "history" | "journal" | "calendar" | "news"
  >(initialLayout.bottomTab ?? "positions");
  const [rightPanel, setRightPanel] = useState<
    "order" | "dom" | "watchlist" | "news" | "tv-analysis"
  >(initialLayout.rightPanel ?? "order");
  const [showRightPanel, setShowRightPanel] = useState(initialLayout.showRightPanel ?? true);
  const rightPanelHover = useHoverCollapse();
  const bottomPanelHover = useHoverCollapse();
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  useEffect(() => {
    if (getWorkspaceMemorySettings().layout) safeStorage.setJSON(LAYOUT_STATE_KEY, { chartLayout, activeChart, bottomTab, rightPanel, showRightPanel } satisfies LayoutState);
  }, [chartLayout, activeChart, bottomTab, rightPanel, showRightPanel]);

  // ── Vertical resize: chart vs bottom panel ──
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => {
    const saved = safeStorage.getItem("bottomPanelHeight");
    const parsed = saved === null ? 220 : Number.parseInt(saved, 10);
    return Number.isFinite(parsed) ? Math.max(100, Math.min(600, parsed)) : 220;
  });
  const resizingRef = useRef(false);
  const bottomPanelPointerInsideRef = useRef(false);
  const bottomPanelFocusInsideRef = useRef(false);
  const rightPanelPointerInsideRef = useRef(false);
  const rightPanelFocusInsideRef = useRef(false);
  const handleRightPanelChange = useCallback(
    (panel: "order" | "dom" | "watchlist" | "news" | "tv-analysis") => {
      setRightPanel(panel);
      setShowRightPanel(true);
      rightPanelHover.onPointerEnter();
    },
    [rightPanelHover.onPointerEnter],
  );
  const handleRightPanelVisibilityToggle = useCallback(() => {
    if (showRightPanel) {
      setShowRightPanel(false);
      rightPanelHover.onPointerLeave();
      return;
    }
    setShowRightPanel(true);
    rightPanelHover.onPointerEnter();
  }, [showRightPanel, rightPanelHover.onPointerEnter, rightPanelHover.onPointerLeave]);
  const resizeStartY = useRef(0);
  const resizeStartH = useRef(0);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      resizingRef.current = true;
      const clientY = "touches" in e ? e.touches[0]!.clientY : e.clientY;
      resizeStartY.current = clientY;
      resizeStartH.current = bottomPanelHeight;

      const onMove = (ev: MouseEvent | TouchEvent) => {
        if (!resizingRef.current) return;
        const y = "touches" in ev ? ev.touches[0]!.clientY : (ev as MouseEvent).clientY;
        const delta = resizeStartY.current - y;
        const newH = Math.max(100, Math.min(600, resizeStartH.current + delta));
        setBottomPanelHeight(newH);
      };
      const onUp = () => {
        resizingRef.current = false;
        setBottomPanelHeight((h) => {
          safeStorage.setItem("bottomPanelHeight", String(h));
          return h;
        });
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
        if (!bottomPanelPointerInsideRef.current && !bottomPanelFocusInsideRef.current) {
          bottomPanelHover.onPointerLeave();
        }
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onUp);
    },
    [bottomPanelHeight, bottomPanelHover.onPointerLeave],
  );

  // Loading a chart template swaps the whole indicator list; the toolbar's
  // own menu toggles one at a time.
  const setIndicators = useCallback(
    (next: IndicatorType[]) => {
      for (const type of next) if (!activeIndicators.includes(type)) toggleIndicator(type);
      for (const type of activeIndicators) if (!next.includes(type)) toggleIndicator(type);
    },
    [activeIndicators, toggleIndicator],
  );
  const setSecondaryIndicatorsFromToolbar = useCallback((next: IndicatorType[]) => {
    setSecondaryIndicators(next);
  }, []);
  const ticks = useTradingStore((s) => s.ticks);
  const { data: secondaryCandles = [] } = useCandles(secondarySymbol, secondaryTimeframe, 400, undefined, false, chartLayout === "split");
  const secondaryTick = useTradingStore((s) => s.ticks[secondarySymbol]);
  const secondaryLiveCandle = useTradingStore(
    (s) => s.liveCandleUpdates[secondarySymbol + ":" + secondaryTimeframe],
  );
  const secondarySymbolInfo = symbols.find((symbol) => symbol.name === secondarySymbol);
  const secondaryPipDigits = getPipDigits(secondarySymbolInfo, secondarySymbol);

  const toggleSecondaryIndicator = useCallback((type: IndicatorType) => {
    setSecondaryIndicators((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type],
    );
  }, []);
  const toggleSecondaryPlugin = useCallback((id: string) => {
    setSecondaryPlugins((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);
  const clearSecondaryIndicators = useCallback(() => setSecondaryIndicators([]), []);


  return (

    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Mobile Account Bar (small screens only) ────── */}
      <div className="md:hidden">
        <MobileAccountBar
          balance={account?.balance ?? 0}
          equity={account?.equity ?? account?.balance ?? 0}
          margin={account?.margin ?? 0}
          pnl={positionPnl}
        />
      </div>

      {/* ── Top Toolbar ──────────────────────────────────── */}
      <ChartToolbar
        previewCandles={activeChart==="primary"?(replayCandles??candles??[]):secondaryCandles}
        selectedSymbol={activeChart === "primary" ? selectedSymbol : secondarySymbol}
        symbols={symbols}
        onSymbolChange={activeChart === "primary" ? setSelectedSymbol : setSecondarySymbol}
        timeframe={activeChart === "primary" ? timeframe : secondaryTimeframe}
        onTimeframeChange={activeChart === "primary" ? handleTimeframeChange : setSecondaryTimeframe}
        chartLayout={chartLayout}
        onChartLayoutChange={(layout) => {
          if (layout === "single") setActiveChart("primary");
          setChartLayout(layout);
        }}
        indicatorScope={activeChart}
        activeIndicators={activeChart === "primary" ? activeIndicators : secondaryIndicators}
        onToggleIndicator={activeChart === "primary" ? toggleIndicator : toggleSecondaryIndicator}
        showIndicatorMenu={showIndicatorMenu}
        onToggleIndicatorMenu={() => setShowIndicatorMenu((v) => !v)}
        drawingTool={activeChart === "primary" ? drawingTool : secondaryDrawingTool}
        onDrawingTool={activeChart === "primary" ? setDrawingTool : setSecondaryDrawingTool}
        drawings={activeChart === "primary" ? drawings : secondaryDrawings}
        onClearDrawings={activeChart === "primary" ? clearDrawings : clearSecondaryDrawings}
        rightPanel={rightPanel}
        onRightPanel={handleRightPanelChange}
        showRightPanel={showRightPanel}
        onToggleRightPanel={handleRightPanelVisibilityToggle}
        tick={activeChart === "primary" ? tick : secondaryTick}
        symbolInfo={activeChart === "primary" ? symbolInfo : secondarySymbolInfo}
        isReplaying={activeChart === "primary" && isReplaying}
        replayAccountId={activeChart === "primary" ? activeAccountId : null}
        activePlugins={activeChart === "primary" ? activePlugins : secondaryPlugins}
        onTogglePlugin={activeChart === "primary" ? handleTogglePlugin : toggleSecondaryPlugin}
        onSetIndicators={activeChart === "primary" ? setIndicators : setSecondaryIndicatorsFromToolbar}
        onSetPlugins={activeChart === "primary" ? handleSetPlugins : setSecondaryPlugins}
        magnetMode={focusedPrefs.magnetMode}
        onCycleMagnet={cycleMagnetMode}
        stayInDrawingMode={focusedPrefs.stayInDrawingMode}
        onToggleStayInDrawingMode={() =>
          updateChartPreferences({ stayInDrawingMode: !focusedPrefs.stayInDrawingMode },activeChart)
        }
      />

      <MarketClosedBanner symbolInfo={symbolInfo} />

      {/* ── Main Layout ──────────────────────────────────── */}
      <div className="relative flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Chart + Bottom Panel */}
        <div className="relative flex flex-col flex-1 min-w-0">
          {/* Chart Area. Split mode initially mirrors the primary chart configuration. */}
          <div className={`flex-1 min-h-[200px] relative ${chartLayout === "split" ? "grid grid-cols-2 gap-px bg-border" : ""}`}>
            <div className={`min-w-0 min-h-0 h-full relative overflow-hidden ${activeChart === "primary" && chartLayout === "split" ? "ring-1 ring-inset ring-primary/50" : ""}`} onPointerDownCapture={() => setActiveChart("primary")}>
            <ChartPanel
              candles={replayCandles ?? candles ?? []}
              selectedSymbol={selectedSymbol}
              timeframe={replayCandles ? "1m" : timeframe}
              isDark={isDark}
              activeIndicators={activeIndicators}
              drawingTool={drawingTool}
              drawings={drawings}
              onAddDrawing={addDrawing}
              onUpdateDrawing={updateDrawing}
              onRemoveDrawing={removeDrawing}
              onDrawingComplete={() => setDrawingTool("none")}
              onDrawingToolSelect={setDrawingTool}
              onUndoDrawing={undoDrawing}
              onRedoDrawing={redoDrawing}
              magnetMode={chartPrefs.magnetMode}
              stayInDrawingMode={chartPrefs.stayInDrawingMode}
              positions={chartPositions}
              orders={chartOrders}
              tick={replayCandles ? undefined : tick}
              liveCandle={replayCandles ? undefined : liveCandle}
              pipDigits={pipDigits}
              symbolInfo={symbolInfo}
              onModifyPosition={handleChartModifyPosition}
              replayTradeEvents={replayTradeEvents}
              isReplaying={isReplaying}
              activePlugins={activePlugins}
              onTogglePlugin={handleTogglePlugin}
              accountEquity={account?.equity ?? account?.balance ?? 0}
              accountId={activeAccountId}
              onQuickOrder={handleQuickOrder}
              onClearDrawings={clearDrawings}
              onClearIndicators={handleClearIndicators}
            />
            </div>
            {chartLayout === "split" && (
              <div className={`flex min-w-0 min-h-0 flex-col overflow-hidden bg-background ${activeChart === "secondary" ? "ring-1 ring-inset ring-primary/50" : ""}`} onPointerDownCapture={() => setActiveChart("secondary")}>
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <ChartPanel
                    key="secondary"
                    candles={secondaryCandles}
                    selectedSymbol={secondarySymbol}
                    timeframe={secondaryTimeframe}
                    isDark={isDark}
                    indicatorScope="secondary"
                    activeIndicators={secondaryIndicators}
                    drawingTool={secondaryDrawingTool}
                    drawings={secondaryDrawings}
                    onAddDrawing={addSecondaryDrawing}
                    onUpdateDrawing={updateSecondaryDrawing}
                    onRemoveDrawing={removeSecondaryDrawing}
                    onDrawingComplete={() => setSecondaryDrawingTool("none")}
                    onDrawingToolSelect={setSecondaryDrawingTool}
                    magnetMode={secondaryPrefs.magnetMode}
                    stayInDrawingMode={secondaryPrefs.stayInDrawingMode}
                    positions={[]}
                    orders={[]}
                    tick={secondaryTick}
                    liveCandle={secondaryLiveCandle}
                    pipDigits={secondaryPipDigits}
                    symbolInfo={secondarySymbolInfo}
                    activePlugins={secondaryPlugins}
                    onTogglePlugin={toggleSecondaryPlugin}
                    onClearDrawings={clearSecondaryDrawings}
                    onClearIndicators={clearSecondaryIndicators}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Replay timeline scrubber — disabled until the feature is QA'd */}
          {REPLAY_ENABLED && isReplaying && activeAccountId != null && (
            <Suspense fallback={null}>
              <ReplayScrubber accountId={activeAccountId} />
            </Suspense>
          )}

          {/* Bottom panel: the resize grip remains visible while the content collapses. */}
          <div
            role="group"
            aria-label="Painel inferior retrátil"
            aria-expanded={bottomPanelHover.isExpanded}
            tabIndex={0}
            onMouseEnter={() => {
              bottomPanelPointerInsideRef.current = true;
              bottomPanelHover.onPointerEnter();
            }}
            onMouseLeave={() => {
              bottomPanelPointerInsideRef.current = false;
              if (!resizingRef.current && !bottomPanelFocusInsideRef.current) {
                bottomPanelHover.onPointerLeave();
              }
            }}
            onFocus={() => {
              bottomPanelFocusInsideRef.current = true;
              bottomPanelHover.onPointerEnter();
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                bottomPanelFocusInsideRef.current = false;
                if (!resizingRef.current && !bottomPanelPointerInsideRef.current) {
                  bottomPanelHover.onPointerLeave();
                }
              }
            }}
            className="md:absolute md:inset-x-0 md:bottom-0 md:z-20 flex flex-col"
          >
            {/* ── Resize Handle ── */}
            <div
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
              className="hidden md:flex h-1.5 cursor-row-resize items-center justify-center hover:bg-primary/20 active:bg-primary/30 transition-colors group border-t border-border bg-secondary/40 touch-none"
            >
              <div className="w-8 h-0.5 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
            </div>

            {/* Keep BottomPanel mounted so tab and table state survive collapse. */}
            <div
              className={`overflow-hidden transition-[max-height] duration-[600ms] ease-out motion-reduce:transition-none ${
                bottomPanelHover.isExpanded
                  ? "md:max-h-[var(--bottom-panel-height)]"
                  : "md:max-h-0"
              }`}
              style={{ "--bottom-panel-height": `${bottomPanelHeight}px` } as React.CSSProperties}
            >
              <BottomPanel
                tab={bottomTab}
                onTabChange={setBottomTab}
                positions={positions}
                orders={orders}
                accountId={activeAccountId}
                onModifyPosition={setModifyingPosition}
                onModifyOrder={setModifyingOrder}
                onSelectPositionSymbol={setSelectedSymbol}
                onSelectOrderSymbol={setSelectedSymbol}
                height={bottomPanelHeight}
                isFeedConnected={isFeedConnected}
                journalEntries={journalEntries}
                journalLoading={journalLoading}
                onCreateJournal={createJournal}
                onUpdateJournal={updateJournal}
                onDeleteJournal={deleteJournal}
              />
            </div>
          </div>
        </div>

        {/* Fixed hit area; only the panel surface moves, avoiding hover loss during animation. */}
        <div
          role="complementary"
          aria-label="Painel lateral retrátil"
          aria-expanded={showRightPanel && rightPanelHover.isExpanded}
          tabIndex={showRightPanel ? 0 : -1}
          onMouseEnter={() => {
            rightPanelPointerInsideRef.current = true;
            rightPanelHover.onPointerEnter();
          }}
          onMouseLeave={() => {
            rightPanelPointerInsideRef.current = false;
            if (!rightPanelFocusInsideRef.current) rightPanelHover.onPointerLeave();
          }}
          onFocus={() => {
            rightPanelFocusInsideRef.current = true;
            rightPanelHover.onPointerEnter();
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              rightPanelFocusInsideRef.current = false;
              if (!rightPanelPointerInsideRef.current) rightPanelHover.onPointerLeave();
            }
          }}
          className={`absolute inset-y-0 right-0 z-30 hidden w-[280px] md:block xl:w-[320px] ${
            showRightPanel && rightPanelHover.isExpanded ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <div
            aria-hidden={!showRightPanel || !rightPanelHover.isExpanded}
            inert={!showRightPanel || !rightPanelHover.isExpanded}
            className={[
              "absolute inset-y-0 right-0 flex w-full border-t md:border-t-0 md:border-l border-border flex-col bg-card overflow-hidden shrink-0 md:max-h-none transition-transform duration-[600ms] ease-out motion-reduce:transition-none",
              !showRightPanel
                ? "translate-x-full pointer-events-none"
                : rightPanelHover.isExpanded
                  ? "translate-x-0 pointer-events-auto"
                  : "translate-x-[calc(100%-12px)] pointer-events-none",
            ].join(" ")}
          >
            {rightPanel === "order" && (
              <OrderPanel
                symbol={selectedSymbol}
                symbolInfo={symbolInfo}
                tick={tick}
                accountId={activeAccountId}
                oneClick={oneClick}
                onToggleOneClick={toggleOneClick}
                onConfirmOrder={setConfirmOrder}
                accountBalance={account?.balance}
                isFeedConnected={isFeedConnected}
                soundMuted={soundMuted}
                onToggleMute={toggleSoundMute}
                onOrderSuccess={onOrderSuccess}
              />
            )}
            {rightPanel === "dom" && (
              <Suspense fallback={null}>
                <DOMPanel symbol={selectedSymbol} tick={tick} />
              </Suspense>
            )}
            {rightPanel === "watchlist" && (
              <Suspense fallback={null}>
                <WatchlistPanel
                symbols={symbols}
                ticks={ticks}
                selectedSymbol={selectedSymbol}
                onSelect={setSelectedSymbol}
                oneClick={oneClick}
                accountId={activeAccountId}
                isFeedConnected={isFeedConnected}
                />
              </Suspense>
            )}
            {rightPanel === "news" && (
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <Suspense fallback={null}>
                  <MarketNewsFeed symbol={selectedSymbol} />
                </Suspense>
              </div>
            )}
            {rightPanel === "tv-analysis" && (
              <div className="flex-1 overflow-hidden">
                <Suspense fallback={null}>
                  <TradingViewTechnicalAnalysis
                    symbol={selectedSymbol}
                    theme={isDark ? "dark" : "light"}
                    interval={timeframe}
                    width="100%"
                    height="100%"
                  />
                </Suspense>
              </div>
            )}
          </div>
          {showRightPanel && !rightPanelHover.isExpanded && (
            <div
              aria-hidden="true"
              className="pointer-events-auto absolute inset-y-0 right-0 z-20 flex w-3 items-center justify-center border-l border-border bg-secondary/90"
            >
              <ChevronLeft className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile Trading Panel (small screens only) ──── */}
      <div className="md:hidden">
        {!mobilePanelOpen && (
          <button
            onClick={() => setMobilePanelOpen(true)}
            className="fixed bottom-20 right-4 z-40 bg-primary text-primary-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <span className="text-2xl font-bold">$</span>
          </button>
        )}
        {mobilePanelOpen && (
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto bg-card border-t border-border rounded-t-2xl shadow-2xl safe-area-bottom">
            <div className="flex justify-center py-1">
              <button
                onClick={() => setMobilePanelOpen(false)}
                className="w-10 h-1.5 rounded-full bg-muted-foreground/30"
              />
            </div>
            <MobileTradingPanel
              symbol={selectedSymbol}
              bid={tick?.bid}
              ask={tick?.ask}
              positions={positions || []}
              onPlaceOrder={(order) => {
                if (oneClick && order.type === "MARKET") {
                  void submitOrderDirect({
                    ...order,
                    accountId: activeAccountId!,
                  } as PlaceOrderInput)
                    .then(onOrderSuccess)
                    .catch(() => {
                      // Already reported by submitOrderDirect.
                    });
                  setMobilePanelOpen(false);
                  return;
                }
                setConfirmOrder({
                  ...(order as PlaceOrderInput),
                  accountId: activeAccountId!,
                  _submit: () =>
                    submitOrderDirect({
                      ...order,
                      accountId: activeAccountId!,
                    } as PlaceOrderInput),
                });
                setMobilePanelOpen(false);
              }}
            />
          </div>
        )}
      </div>

    </div>
  );
}

