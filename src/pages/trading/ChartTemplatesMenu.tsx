import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, CloudUpload, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ChartPreferences,
  TEMPLATE_PREF_KEYS,
  updateChartPreferences,
  useChartPreferences,
} from "../../hooks/useChartPreferences.ts";
import { INDICATOR_REGISTRY, type IndicatorType } from "../../lib/indicators.ts";
import {useIndicatorLibrary,installMissingDefinitions,assertLibraryReady} from "../../lib/indicator-sdk/storage";
import {useOverrides,replaceChartOverrides,assertOverridesReady,type ChartScope} from "../../lib/indicator-sdk/instances";
import {buildTemplateSnapshot,prepareTemplateSnapshot} from "../../lib/indicator-sdk/template-snapshot";
import { cn } from "../../lib/utils.ts";
import {
  type ChartTemplate,
  type ChartTemplateContent,
  chartTemplatesApi,
} from "../../services/api/chart-templates.ts";
import { toast } from "../../services/toast.ts";

// ── Chart templates (TradingView/TradeLocker-style layout templates) ─────────
// Save/load named snapshots of chart appearance (colors, element visibility,
// challenge overlays), active indicators and plugins. Stored server-side via
// the trader-qol ChartLayout endpoints, so templates follow the user across
// devices. Optional autosave keeps the active template in sync with changes.

const AUTOSAVE_DEBOUNCE_MS = 1_500;

export interface ChartTemplatesMenuProps {
  activeIndicators: IndicatorType[];
  indicatorScope?:ChartScope;
  onSetIndicators: (indicators: IndicatorType[]) => void;
  activePlugins: string[];
  onSetPlugins: (ids: string[]) => void;
}

function snapshotContent(
  prefs: ChartPreferences,
  indicators: IndicatorType[],
  plugins: string[],
): ChartTemplateContent {
  const snapshot: Record<string, string | boolean> = {};
  for (const key of TEMPLATE_PREF_KEYS) {
    snapshot[key] = prefs[key];
  }
  return { version: 1, prefs: snapshot, indicators, plugins };
}

function contentToPrefsPatch(content: ChartTemplateContent): Partial<ChartPreferences> {
  const patch: Record<string, string | boolean> = {};
  for (const key of TEMPLATE_PREF_KEYS) {
    const value = content.prefs[key];
    if (value !== undefined) patch[key] = value;
  }
  return patch as Partial<ChartPreferences>;
}

function useChartTemplates() {
  const queryClient = useQueryClient();
  const { data: templates = [] } = useQuery({
    queryKey: ["chart-templates"] as const,
    queryFn: () => chartTemplatesApi.list(),
    staleTime: 60_000,
    retry: 1,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["chart-templates"] });
  const save = useMutation({
    mutationFn: (vars: { name: string; content: ChartTemplateContent }) =>
      chartTemplatesApi.save(vars.name, vars.content),
    onSuccess: invalidate,
    onError: () => toast.error("Templates", "Failed to save template"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => chartTemplatesApi.remove(id),
    onSuccess: invalidate,
    onError: () => toast.error("Templates", "Failed to delete template"),
  });
  return { templates, save, remove };
}

/** Debounced autosave of the current settings into the active template. */
function useTemplateAutosave(
  enabled: boolean,
  activeName: string,
  content: ChartTemplateContent,
  saveFn: (vars: { name: string; content: ChartTemplateContent }) => void,
): void {
  const timerRef = useRef<number | null>(null);
  // Serialise so the effect only fires on real changes, not object identity.
  const serialized = JSON.stringify(content);
  const previousRef = useRef<{name:string;serialized:string}|null>(null);

  useEffect(() => {
    if (!enabled || !activeName) return;
    const previous=previousRef.current;
    previousRef.current={name:activeName,serialized};
    if(!previous||previous.name!==activeName||previous.serialized===serialized)return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      saveFn({ name: activeName, content: JSON.parse(serialized) as ChartTemplateContent });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [enabled, activeName, serialized, saveFn]);


}

function MenuRow({
  icon,
  label,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className="flex h-3.5 w-3.5 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function AutosaveRow({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <div className="flex items-center gap-2 text-xs text-foreground">
        <CloudUpload className="h-3.5 w-3.5 text-muted-foreground" />
        Autosave
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={cn(
          "inline-flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border-0 p-0 transition-colors",
          enabled ? "bg-primary" : "bg-secondary",
        )}
      >
        <span
          className={cn(
            "inline-block h-3 w-3 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-[18px]" : "translate-x-[2px]",
          )}
        />
      </button>
    </div>
  );
}

function AddTemplateRow({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  if (!adding) {
    return (
      <MenuRow
        icon={<Plus className="h-3.5 w-3.5" />}
        label="Add template"
        onClick={() => setAdding(true)}
      />
    );
  }
  const commit = () => {
    const trimmed = name.trim();
    if (trimmed) onAdd(trimmed);
    setAdding(false);
    setName("");
  };
  return (
    <div className="px-3 py-1.5">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setAdding(false);
        }}
        onBlur={commit}
        placeholder="Template name…"
        className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
      />
    </div>
  );
}

function TemplateList({
  templates,
  activeName,
  manageMode,
  onApply,
  onDelete,
}: {
  templates: ChartTemplate[];
  activeName: string;
  manageMode: boolean;
  onApply: (t: ChartTemplate) => void;
  onDelete: (t: ChartTemplate) => void;
}) {
  if (templates.length === 0) {
    return <div className="px-3 py-2 text-[11px] text-muted-foreground">No templates yet</div>;
  }
  return (
    <>
      {templates.map((t) => (
        <div key={t.id} className="group flex items-center">
          <button
            onClick={() => onApply(t)}
            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center text-primary">
              {t.name === activeName && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="truncate">{t.name}</span>
          </button>
          {manageMode && (
            <button
              onClick={() => onDelete(t)}
              title={`Delete "${t.name}"`}
              className="px-2 text-red-400/70 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </>
  );
}

export function ChartTemplatesMenu(props: ChartTemplatesMenuProps) {
  const { activeIndicators, onSetIndicators, activePlugins, onSetPlugins, indicatorScope="primary" } = props;
  const library=useIndicatorLibrary();
  const overrides=useOverrides(indicatorScope);
  const prefs = useChartPreferences();
  const { templates, save, remove } = useChartTemplates();
  const [open, setOpen] = useState(false);
  const [manageMode, setManageMode] = useState(false);

  const [secondaryName,setSecondaryName]=useState(()=>{try{return localStorage.getItem("oc_secondary_template")??"";}catch{return "";}});
  const [secondaryAutosave,setSecondaryAutosave]=useState(false);
  const activeName = indicatorScope==="primary"?prefs.activeChartTemplate:secondaryName;
  const autosave = indicatorScope==="primary"?prefs.chartTemplateAutosave:secondaryAutosave;
  const setActiveName=(name:string)=>{if(indicatorScope==="primary")updateChartPreferences({activeChartTemplate:name});else{setSecondaryName(name);try{localStorage.setItem("oc_secondary_template",name);}catch{/* unavailable */}}};
  const content:ChartTemplateContent = {...snapshotContent(prefs, activeIndicators, activePlugins), ...buildTemplateSnapshot(library,overrides,activeIndicators)};

  // react-query guarantees `mutate` identity is stable across renders.
  const { mutate: saveMutate } = save;
  const saveFn = useCallback(
    (vars: { name: string; content: ChartTemplateContent }) => saveMutate({...vars,name:indicatorScope==="secondary"?"[secondary] "+vars.name:vars.name}),
    [saveMutate,indicatorScope],
  );
  useTemplateAutosave(autosave, activeName, content, saveFn);

  const applyTemplate = (t: ChartTemplate) => {
    const c = t.panels[0];
    if (!c) return;
    try {
      assertLibraryReady();assertOverridesReady();
      const prepared=prepareTemplateSnapshot(library,c.importedDefinitions,c.importedOverrides,c.indicators??[]);
      installMissingDefinitions(prepared.missing);
      replaceChartOverrides(indicatorScope,prepared.overrides);
      const available=new Set(prepared.available.map(x=>"custom:"+x.id));
      const ids=(c.indicators??[]).filter(id=>typeof id==="string"&&(available.has(id)||INDICATOR_REGISTRY.some(x=>x.type===id))) as IndicatorType[];
      if(indicatorScope==="primary")updateChartPreferences(contentToPrefsPatch(c));
      setActiveName(t.name);
      onSetIndicators(ids);
    } catch(e){toast.error("Templates",e instanceof Error?e.message:"Invalid indicator snapshot");return;}
    onSetPlugins(c.plugins ?? []);
    setOpen(false);
    toast.info("Templates", `Loaded "${t.name}"`);
  };

  const addTemplate = (name: string) => {
    saveFn({ name, content });
    setActiveName(name);
    toast.success("Templates", `Saved "${name}"`);
  };

  const deleteTemplate = (t: ChartTemplate) => {
    remove.mutate(t.id);
    if (t.name === activeName) setActiveName("");
  };

  return (
    <div className="relative hidden md:block">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Chart layout templates"
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
          open ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <CloudUpload className="h-3.5 w-3.5" />
        <span className="hidden max-w-[110px] truncate lg:inline">{activeName || "Templates"}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-60 rounded-lg border border-border bg-card/95 py-1 shadow-2xl backdrop-blur-xl">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Layout templates
            </div>
            <AutosaveRow
              enabled={autosave}
              onToggle={() => indicatorScope==="primary"?updateChartPreferences({ chartTemplateAutosave: !autosave }):setSecondaryAutosave(v=>!v)}
            />
            <AddTemplateRow onAdd={addTemplate} />
            <MenuRow
              icon={<Save className="h-3.5 w-3.5" />}
              label={activeName ? `Save "${activeName}"` : "Save template"}
              disabled={!activeName || autosave}
              onClick={() => {
                saveFn({ name: activeName, content });
                toast.success("Templates", `Saved "${activeName}"`);
              }}
            />
            <MenuRow
              icon={<Trash2 className="h-3.5 w-3.5" />}
              label={manageMode ? "Done managing" : "Manage templates…"}
              onClick={() => setManageMode((v) => !v)}
            />
            <div className="my-1 border-t border-border" />
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recently used
            </div>
            <div className="max-h-48 overflow-y-auto">
              <TemplateList
                templates={templates.filter(t=>indicatorScope==="secondary"?t.name.startsWith("[secondary] "):!t.name.startsWith("[secondary] ")).map(t=>indicatorScope==="secondary"?{...t,name:t.name.slice(12)}:t)}
                activeName={activeName}
                manageMode={manageMode}
                onApply={applyTemplate}
                onDelete={deleteTemplate}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
