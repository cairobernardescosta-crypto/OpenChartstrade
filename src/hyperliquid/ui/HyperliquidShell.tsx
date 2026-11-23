import { useEffect, type ReactNode } from "react";
import { registerMarketLookup } from "../compliance/index.ts";
import { startFeeConfigPolling } from "../feeConfig.ts";
import { restoreWallet } from "../wallet/index.ts";
import { getHlRegistry } from "./mode.ts";
import { FeeMessageBanner, HlDialogHost } from "./TopBar.tsx";
import { useAccountSync } from "./useAccountSync.ts";

/**
 * Hyperliquid session shell: fee banner, account syncing and dialog host.
 * The product identity and market selector live together in the chart toolbar.
 * Render it INSIDE `<OpenChartsProvider adapter={createHyperliquidAdapter()}>`.
 *
 * On mount it starts fee-config polling and silently restores a previously
 * authorised wallet. It never opens a modal by itself.
 */
export function HyperliquidShell({ children }: { children: ReactNode }) {
  useEffect(() => startFeeConfigPolling(), []);
  useEffect(() => {
    restoreWallet().catch((err: unknown) => console.warn("[hyperliquid] wallet restore failed", err));
  }, []);
  useEffect(() => {
    registerMarketLookup((symbol) => getHlRegistry()?.bySymbol(symbol));
    return () => registerMarketLookup(undefined);
  }, []);
  useAccountSync();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <FeeMessageBanner />
      <div className="relative min-h-0 flex-1">{children}</div>
      <HlDialogHost />
    </div>
  );
}
