import { getAdapter } from "../adapter/registry.ts";
import type { OrderModification, PositionModification } from "../adapter/types.ts";
import { uid } from "../lib/uid.ts";
import {drawingGroupsSchema} from "../lib/indicator-sdk/chart-backup-schema";
import type { DrawingLine } from "../pages/trading/constants.ts";
import type { AccountMetricsResponse } from "./api/auth.ts";
import type {
  CreateJournalEntryInput,
  JournalEntriesResponse,
  JournalEntry,
  UpdateJournalEntryInput,
} from "./api/journal.ts";
import type { MarketDataCandlesPayload } from "./api/market-data.ts";
import * as replay from "./replay.ts";
import type { Account, Candle, Order, PlaceOrderInput, Position, Symbol } from "./schemas.ts";

/**
 * Internal data facade.
 *
 * Everything in the terminal reads and writes through this object, and every
 * method here resolves against whatever adapter is installed (see
 * `src/adapter/`). Applications never implement this shape — they implement
 * the much smaller `OpenChartsAdapter` contract, and this layer maps it onto
 * the calls the UI has always made.
 *
 * Keeping the mapping in one place means the public contract can stay small and
 * stable while the internals are free to change.
 */

export const API_BASE = "";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 0, code = "API_ERROR") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Trading is optional in the contract; tell the caller plainly when it is absent. */
function trading() {
  const gateway = getAdapter().trading;
  if (!gateway) {
    throw new ApiError(
      "This OpenCharts adapter provides market data only — trading is not available.",
      501,
      "TRADING_UNSUPPORTED",
    );
  }
  return gateway;
}

// ── Storage-backed user data ──────────────────────────────
// Drawings, chart templates and journal entries go through the adapter's
// storage driver so an integrator can keep them with the user's account.

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  const storage = getAdapter().storage;
  if (!storage) return fallback;
  try {
    const raw = await storage.get(key);
    if (raw == null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  const storage = getAdapter().storage;
  if (!storage) return;
  try {
    await storage.set(key, JSON.stringify(value));
  } catch {
    // A full or unavailable store must not break the interaction that
    // triggered the write; the value simply does not persist.
  }
}

const DRAW_KEY = (symbol: string) => `oc_drawings_${symbol}`;
const JOURNAL_KEY = "oc_journal_entries";

const DRAW_INDEX="oc_drawings_index";
let drawingMutation: Promise<void> = Promise.resolve();

function enqueueDrawingMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = drawingMutation.then(operation, operation);
  drawingMutation = result.then(() => undefined, () => undefined);
  return result;
}

function parseDrawingIndex(raw: string | null): string[] {
  const value: unknown = JSON.parse(raw ?? "[]");
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("Invalid drawing index");
  }
  return [...new Set(value)];
}

async function readDrawings(symbol: string): Promise<DrawingLine[]> {
  const storage = getAdapter().storage;
  if (!storage) return [];
  const raw = await storage.get(DRAW_KEY(symbol));
  const groups = drawingGroupsSchema.parse([{
    symbol,
    drawings: JSON.parse(raw ?? "[]"),
  }]);
  return groups[0]!.drawings as DrawingLine[];
}

const chartDrawings = {
  exportAll: async () => {const storage=getAdapter().storage;if(!storage)throw new Error("Drawing storage unavailable");const index=JSON.parse(await storage.get(DRAW_INDEX)??"[]") as string[];const symbols=await api.getSymbols();const names=[...new Set([...index,...symbols.map(s=>s.name)])];const groups=await Promise.all(names.map(async symbol=>({symbol,drawings:JSON.parse(await storage.get(DRAW_KEY(symbol))??"[]")})));return drawingGroupsSchema.parse(groups.filter(g=>Array.isArray(g.drawings)&&g.drawings.length));},
  importAll: async (raw:unknown) => {
    const groups=drawingGroupsSchema.parse(raw);
    return enqueueDrawingMutation(async()=>{
      const storage=getAdapter().storage;
      if(!storage)throw new Error("Drawing storage unavailable");
      const index=parseDrawingIndex(await storage.get(DRAW_INDEX));
      const symbols=[...new Set([...index,...groups.map(g=>g.symbol)])];
      const keys=[DRAW_INDEX,...symbols.map(DRAW_KEY)];
      const previous=new Map<string,string|null>();
      for(const key of keys)previous.set(key,await storage.get(key));
      const restore=async()=>{for(const [key,value] of previous){if(value===null)await storage.remove(key);else await storage.set(key,value);}};
      try{
        const incoming=new Map(groups.map(group=>[group.symbol,group.drawings]));
        for(const symbol of symbols){
          const drawings=incoming.get(symbol);
          if(drawings===undefined)await storage.remove(DRAW_KEY(symbol));
          else await storage.set(DRAW_KEY(symbol),JSON.stringify(drawings));
        }
        await storage.set(DRAW_INDEX,JSON.stringify(groups.map(group=>group.symbol)));
      }catch(error){await restore();throw error;}
      return ()=>enqueueDrawingMutation(restore);
    });
  },
  list: async (symbol: string): Promise<DrawingLine[]> => {
    return readDrawings(symbol);
  },
  save: async (symbol: string, _timeframe: string, drawing: DrawingLine) => {
    return enqueueDrawingMutation(async()=>{
      const storage=getAdapter().storage;
      if(!storage)throw new Error("Drawing storage unavailable");
      const drawingKey=DRAW_KEY(symbol);
      const previousDrawings=await storage.get(drawingKey);
      const previousIndex=await storage.get(DRAW_INDEX);
      const list = (await readDrawings(symbol)).filter((d) => d.id !== drawing.id);
      list.push(drawing);
      try{
        await storage.set(drawingKey,JSON.stringify(list));
        const index=parseDrawingIndex(previousIndex);
        await storage.set(DRAW_INDEX,JSON.stringify([...new Set([...index,symbol])]));
      }catch(error){
        if(previousDrawings===null)await storage.remove(drawingKey);else await storage.set(drawingKey,previousDrawings);
        if(previousIndex===null)await storage.remove(DRAW_INDEX);else await storage.set(DRAW_INDEX,previousIndex);
        throw error;
      }
      return { saved: true };
    });
  },
  remove: async (drawingId: string) => {
    return enqueueDrawingMutation(async()=>{
      const storage=getAdapter().storage;
      if(!storage)throw new Error("Drawing storage unavailable");
      // Drawing ids are unique across symbols, so use both the current market
      // catalogue and the persisted index (which retains delisted symbols).
      const symbols = await api.getSymbols();
      const index=parseDrawingIndex(await storage.get(DRAW_INDEX));
      for (const symbol of new Set([...index,...symbols.map(row=>row.name)])) {
        const list = await readDrawings(symbol);
        if (list.some((d) => d.id === drawingId)) {
          await storage.set(DRAW_KEY(symbol),JSON.stringify(list.filter((d) => d.id !== drawingId)));
        }
      }
      return { deleted: true };
    });
  },
  clear: async (symbol: string) => {
    return enqueueDrawingMutation(async()=>{
      const storage=getAdapter().storage;
      if(!storage)throw new Error("Drawing storage unavailable");
      await storage.set(DRAW_KEY(symbol), "[]");
      return { cleared: true };
    });
  },
};

// ── Derived responses ─────────────────────────────────────

function metricsFrom(account: Account): AccountMetricsResponse {
  return {
    accountId: account.id,
    equity: account.equity,
    balance: account.balance,
    freeMargin: account.freeMargin,
    marginUsed: account.margin,
    floatingPnl: account.equity - account.balance,
    dailyPnl: 0,
    ddDaily: null,
    ddDailyMax: null,
    ddTotal: null,
    ddTotalMax: null,
    ddTrailing: null,
    ddTrailingMax: null,
    trailingDrawdownFloor: null,
    trailingDrawdownPeak: null,
    trailingDrawdownMode: null,
    trailingDrawdownTrailMode: null,
    trailingDrawdownFloorLocked: false,
    trailingDrawdownTrailToBreakeven: false,
    profitTargetPercent: null,
    profitTargetProgress: 0,
    minTradingDays: null,
    tradingDaysCompleted: 0,
    minDaysProgress: 0,
    status: account.status,
    phase: account.phase,
    highWaterMark: account.balance,
    startingBalance: account.template?.startingBalance ?? account.balance,
    currency: "USD",
    lastMarkTs: new Date().toISOString(),
  } as AccountMetricsResponse;
}

const candlesPayload = (candles: Candle[]): MarketDataCandlesPayload => ({
  candles: candles.map((c) => ({ ...c, timestamp: c.time * 1000 })),
  metadata: { isPartial: false, backfillQueued: false, historicalCoverageStart: null },
});

const DEMO_USER = {
  id: "demo-user",
  email: "demo@opencharts.dev",
  firstName: "Demo",
  lastName: "Trader",
  roles: ["trader"],
  status: "ACTIVE",
  createdAt: new Date().toISOString(),
};

type AuthResponse = { accessToken: string; refreshToken: string; user: typeof DEMO_USER };
const authResponse = (): AuthResponse => ({
  accessToken: "local",
  refreshToken: "local",
  user: DEMO_USER,
});

export const api = {
  // ── Session ──
  // OpenCharts ships no authentication: the host application owns identity and
  // decides what its adapter exposes. These keep the existing store happy.
  login: (_email: string, _password: string): Promise<AuthResponse> =>
    Promise.resolve(authResponse()),
  demoLogin: (): Promise<AuthResponse> => Promise.resolve(authResponse()),
  completeMfaLogin: (_token: string, _code: string): Promise<AuthResponse> =>
    Promise.resolve(authResponse()),
  logout: (_refreshToken?: string) => Promise.resolve({ success: true }),
  refreshToken: (_token: string) =>
    Promise.resolve({ accessToken: "local", refreshToken: "local" }),

  // ── Market data ──
  getSymbols: async (): Promise<Symbol[]> => getAdapter().marketData.getSymbols(),

  getCandles: async (
    symbol: string,
    timeframe: string,
    limit?: number,
    range?: { fromMs?: number; toMs?: number },
  ): Promise<Candle[]> =>
    getAdapter().marketData.getCandles({
      symbol,
      timeframe,
      limit,
      fromMs: range?.fromMs,
      toMs: range?.toMs,
    }),

  getCandlesWithMeta: async (
    symbol: string,
    timeframe: string,
    limit?: number,
    range?: { fromMs?: number; toMs?: number },
  ): Promise<MarketDataCandlesPayload> =>
    api.getCandles(symbol, timeframe, limit, range).then(candlesPayload),

  getTick: async (symbol: string) => {
    const quote = await getAdapter().marketData.getQuote?.(symbol);
    return quote ?? { symbol, bid: 0, ask: 0, timestamp: Date.now() };
  },

  getMarketDataHealth: () => {
    const marketData = getAdapter().marketData as unknown as { getHealth?: () => unknown };
    return Promise.resolve(marketData.getHealth?.() ?? { status: "ok" as const });
  },

  /** No calendar provider in the contract; hosts render their own if they have one. */
  getEconomicCalendar: (_currencies: string[], _from?: string, _to?: string) =>
    Promise.resolve([]),

  // ── Accounts ──
  // These are `async` so a missing gateway (or a throwing one) rejects rather
  // than throwing synchronously past the caller's .catch().
  getMyAccounts: async (): Promise<Account[]> => trading().getAccounts(),
  getAccountMetrics: async (accountId: string): Promise<AccountMetricsResponse> => {
    const accounts = await trading().getAccounts();
    const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
    if (!account) throw new ApiError("No trading account available", 404, "NO_ACCOUNT");
    return metricsFrom(account);
  },

  // ── Trading ──
  getPositions: async (accountId: string): Promise<Position[]> =>
    trading().getPositions(accountId),
  getOrders: async (accountId: string, status?: string): Promise<Order[]> =>
    trading().getOrders(accountId, status),
  getClosedPositions: async (accountId: string, page = 1) =>
    trading().getClosedPositions(accountId, page),

  placeOrder: async (input: PlaceOrderInput): Promise<Order> => trading().placeOrder(input),
  modifyOrder: async (orderId: string, modification: OrderModification): Promise<Order> =>
    trading().modifyOrder(orderId, modification),
  cancelOrder: async (orderId: string) => {
    await trading().cancelOrder(orderId);
    return { success: true };
  },
  cancelAllOrders: async (accountId?: string) => {
    await trading().cancelAllOrders(accountId);
    return { success: true };
  },
  closePosition: async (positionId: string, quantity?: number) => {
    await trading().closePosition(positionId, quantity);
    return { success: true };
  },
  closeAllPositions: async (accountId?: string) => {
    await trading().closeAllPositions(accountId);
    return { success: true };
  },
  modifyPosition: async (
    positionId: string,
    modification: PositionModification,
  ): Promise<Position> => trading().modifyPosition(positionId, modification),

  // ── Chart persistence ──
  chartDrawings,
  getPreferences: (): Promise<Record<string, string> | null> => Promise.resolve(null),
  savePreferences: (_prefs: Record<string, string>) => Promise.resolve({ success: true }),

  // ── Trade journal ──
  getJournalEntries: async (
    accountId: string,
    opts?: { limit?: number; symbol?: string },
  ): Promise<JournalEntriesResponse> => {
    const all = await readJSON<JournalEntry[]>(JOURNAL_KEY, []);
    let entries = (Array.isArray(all) ? all : []).filter((e) => e.accountId === accountId);
    if (opts?.symbol) entries = entries.filter((e) => e.symbolName === opts.symbol);
    const total = entries.length;
    if (opts?.limit != null && opts.limit > 0) entries = entries.slice(0, opts.limit);
    return { entries, total };
  },
  createJournalEntry: async (data: CreateJournalEntryInput): Promise<JournalEntry> => {
    const entry: JournalEntry = {
      id: uid(),
      accountId: data.accountId,
      positionId: data.positionId ?? null,
      symbolName: data.symbolName ?? null,
      side: data.side ?? null,
      entryPrice: data.entryPrice ?? null,
      exitPrice: data.exitPrice ?? null,
      pnl: data.pnl ?? null,
      emotion: data.emotion ?? null,
      setupType: null,
      rating: data.rating ?? null,
      tags: data.tags ?? [],
      notes: data.notes ?? "",
      createdAt: new Date().toISOString(),
    };
    const all = await readJSON<JournalEntry[]>(JOURNAL_KEY, []);
    await writeJSON(JOURNAL_KEY, [entry, ...(Array.isArray(all) ? all : [])]);
    return entry;
  },
  updateJournalEntry: async (
    id: string,
    data: UpdateJournalEntryInput,
  ): Promise<JournalEntry | null> => {
    const all = await readJSON<JournalEntry[]>(JOURNAL_KEY, []);
    const list = Array.isArray(all) ? [...all] : [];
    const idx = list.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    const updated: JournalEntry = {
      ...list[idx]!,
      ...(data.emotion !== undefined ? { emotion: data.emotion } : {}),
      ...(data.rating !== undefined ? { rating: data.rating } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    };
    list[idx] = updated;
    await writeJSON(JOURNAL_KEY, list);
    return updated;
  },
  deleteJournalEntry: async (id: string) => {
    const all = await readJSON<JournalEntry[]>(JOURNAL_KEY, []);
    const list = Array.isArray(all) ? all : [];
    await writeJSON(
      JOURNAL_KEY,
      list.filter((e) => e.id !== id),
    );
    return { success: true };
  },

  // ── Session replay ──
  // Built on top of `marketData.getCandles`, so replay works against any
  // adapter rather than needing one of its own.
  replayGetSession: (accountId: string, sessionDate: string, symbol?: string) =>
    replay.getSession(sessionDate, symbol, accountId),
  replayStart: (accountId: string, sessionDate: string, speed = 1, symbol?: string) =>
    replay.start(sessionDate, speed, symbol, accountId),
  replayPause: (_accountId: string, _sessionDate: string) => {
    replay.pause();
    return Promise.resolve({ success: true });
  },
  replayResume: (_accountId: string, _sessionDate: string) => {
    replay.resume();
    return Promise.resolve({ success: true });
  },
  replayStop: (_accountId: string, _sessionDate: string) => {
    replay.stop();
    return Promise.resolve({ success: true });
  },
  replaySetSpeed: (_accountId: string, _sessionDate: string, speed: number) =>
    Promise.resolve(replay.setSpeed(speed)),
  replaySeek: (_accountId: string, _sessionDate: string, timestamp: string) =>
    Promise.resolve(replay.seek(timestamp)),
  replayPatchSession: (
    _accountId: string,
    patch: { sessionDate?: string; cursorTimestamp?: number },
  ) => {
    replay.patchSession(patch);
    return Promise.resolve({ success: true });
  },
};
