import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Circle,
  Equal,
  EyeOff,
  GripVertical,
  Layers,
  Layers3,
  type LucideIcon,
  Minus,
  MousePointer2,
  MoveUpRight,
  MoveVertical,
  PenTool,
  Ruler,
  Rows3,
  Spline,
  Square,
  TrendingUp,
  Triangle,
  Type,
  Star,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDragOffset } from "../../hooks/useDragOffset.ts";
import { cn } from "../../lib/utils.ts";
import { safeStorage } from "../../lib/safe-storage.ts";
import type { DrawingTool } from "./constants.ts";
import { DRAWING_TOOL_FAVORITES_EVENT, getDrawingToolFavorites, setDrawingToolFavorite } from "./drawingToolFavorites.ts";

interface ToolMeta {
  tool: DrawingTool;
  icon: LucideIcon;
  label: string;
}

interface ToolGroup {
  id: string;
  icon: LucideIcon;
  label: string;
  tools: ToolMeta[];
}

// TradingView-style left rail: tools grouped behind a flyout per category.
const GROUPS: ToolGroup[] = [
  {
    id: "lines",
    icon: TrendingUp,
    label: "Lines",
    tools: [
      { tool: "trendline", icon: TrendingUp, label: "Trend Line" },
      { tool: "ray", icon: MoveUpRight, label: "Ray" },
      { tool: "extended", icon: Spline, label: "Extended Line" },
      { tool: "horizontal", icon: Minus, label: "Horizontal Line" },
      { tool: "vertical", icon: MoveVertical, label: "Vertical Line" },
      { tool: "channel", icon: Equal, label: "Parallel Channel" },
    ],
  },
  {
    id: "fib",
    icon: Layers,
    label: "Fibonacci",
    tools: [
      { tool: "fibonacci", icon: Layers, label: "Fib Retracement" },
      { tool: "fibextension", icon: Layers3, label: "Fib Extension" },
    ],
  },
  {
    id: "shapes",
    icon: Square,
    label: "Shapes",
    tools: [
      { tool: "rectangle", icon: Square, label: "Rectangle" },
      { tool: "ellipse", icon: Circle, label: "Ellipse" },
      { tool: "triangle", icon: Triangle, label: "Triangle" },
      { tool: "arrow", icon: ArrowRight, label: "Arrow" },
    ],
  },
  {
    id: "trade",
    icon: ArrowUpRight,
    label: "Trade",
    tools: [
      { tool: "long-position", icon: ArrowUpRight, label: "Long Position" },
      { tool: "short-position", icon: ArrowDownRight, label: "Short Position" },
      { tool: "measure", icon: Ruler, label: "Measure" },
    ],
  },
  { id: "text", icon: Type, label: "Text", tools: [{ tool: "text", icon: Type, label: "Text" }] },
];

function RailButton({
  icon: Icon,
  title,
  active,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded hover:bg-secondary",
        active ? "bg-primary/20 text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function RailGroup({
  group,
  activeTool,
  open,
  onToggle,
  onSelect,
  favorites,
  onFavorite,
  orientation,
}: {
  group: ToolGroup;
  activeTool: DrawingTool;
  open: boolean;
  onToggle: () => void;
  onSelect: (t: DrawingTool) => void;
  favorites: Set<DrawingTool>;
  onFavorite: (t: DrawingTool) => void;
  orientation: "vertical" | "horizontal";
}) {
  const activeMeta = group.tools.find((t) => t.tool === activeTool);
  const Icon = activeMeta?.icon ?? group.icon;
  return (
    <div className="relative">
      <RailButton icon={Icon} title={group.label} active={Boolean(activeMeta)} onClick={onToggle} />
      {open && (
        <div className={cn("absolute z-30 min-w-[190px] rounded-md bg-card border border-border shadow-xl py-1", orientation === "vertical" ? "left-full top-0 ml-1" : "left-0 top-full mt-1")}>
          {group.tools.map((t) => (
            <div key={t.tool} className={cn("flex items-center hover:bg-secondary", activeTool === t.tool && "bg-secondary text-primary")}>
              <button type="button" onClick={() => onSelect(t.tool)} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 text-left text-sm">
                <t.icon className="h-3.5 w-3.5 shrink-0" />
                {t.label}
              </button>
              <button type="button" aria-label={(favorites.has(t.tool) ? "Remover dos favoritos " : "Adicionar aos favoritos ") + t.label} className="mr-2 rounded p-1 text-muted-foreground hover:text-primary" onClick={() => onFavorite(t.tool)}>
                <Star className="h-3.5 w-3.5" fill={favorites.has(t.tool) ? "currentColor" : "none"} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DrawingToolRail({
  drawingTool,
  onDrawingTool,
}: {
  drawingTool: DrawingTool;
  onDrawingTool: (t: DrawingTool) => void;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [hidden, setHidden] = useState(() => safeStorage.getItem("opencharts.drawing-rail.hidden") === "true");
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">(() => safeStorage.getItem("opencharts.drawing-rail.orientation") === "horizontal" ? "horizontal" : "vertical");
  const [favorites, setFavorites] = useState(() => new Set(getDrawingToolFavorites()));
  const ref = useRef<HTMLDivElement>(null);
  const drag = useDragOffset();

  useEffect(() => {
    if (!openGroup) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenGroup(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openGroup]);
  useEffect(() => {
    const refresh = () => setFavorites(new Set(getDrawingToolFavorites()));
    window.addEventListener(DRAWING_TOOL_FAVORITES_EVENT, refresh);
    return () => window.removeEventListener(DRAWING_TOOL_FAVORITES_EVENT, refresh);
  }, []);

  const select = (t: DrawingTool) => {
    onDrawingTool(drawingTool === t ? "none" : t);
    setOpenGroup(null);
  };

  const hide = () => {
    setOpenGroup(null);
    setHidden(true);
    safeStorage.setItem("opencharts.drawing-rail.hidden", "true");
  };
  const toggleFavorite = (tool: DrawingTool) => setDrawingToolFavorite(tool, !favorites.has(tool));
  const toggleOrientation = () => setOrientation((current) => {
    const next = current === "vertical" ? "horizontal" : "vertical";
    safeStorage.setItem("opencharts.drawing-rail.orientation", next);
    return next;
  });
  const favoriteMeta = GROUPS.flatMap((group) => group.tools).filter((tool) => favorites.has(tool.tool));

  // Collapsed: a small restorable button where the rail was last positioned.
  if (hidden) {
    return (
      <button
        type="button"
        title="Show drawing tools"
        onClick={() => { setHidden(false); safeStorage.setItem("opencharts.drawing-rail.hidden", "false"); }}
        style={drag.style}
        className="absolute left-1 top-1 z-20 rounded-md border border-border bg-card/90 p-1.5 text-muted-foreground backdrop-blur-sm hover:text-primary"
      >
        <PenTool className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      ref={ref}
      style={drag.style}
      className={cn("absolute left-1 top-1 z-20 flex items-center gap-0.5 rounded-md bg-card/90 border border-border p-0.5 backdrop-blur-sm", orientation === "vertical" ? "flex-col" : "flex-row")}
    >
      <div
        onPointerDown={drag.onPointerDown}
        title="Drag to move"
        className={cn("flex cursor-move justify-center text-muted-foreground/50 hover:text-muted-foreground", orientation === "vertical" ? "w-full py-0.5" : "h-full px-0.5")}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <RailButton
        icon={MousePointer2}
        title="Cursor"
        active={drawingTool === "none"}
        onClick={() => {
          onDrawingTool("none");
          setOpenGroup(null);
        }}
      />
      {GROUPS.map((g) => (
        <RailGroup
          key={g.id}
          group={g}
          activeTool={drawingTool}
          open={openGroup === g.id}
          onToggle={() => setOpenGroup((o) => (o === g.id ? null : g.id))}
          onSelect={select}
          favorites={favorites}
          onFavorite={toggleFavorite}
          orientation={orientation}
        />
      ))}
      {favoriteMeta.map((tool) => <RailButton key={"favorite:"+tool.tool} icon={tool.icon} title={"Favorito: "+tool.label} active={drawingTool===tool.tool} onClick={() => select(tool.tool)} />)}
      <div className={cn("border-border/50", orientation === "vertical" ? "my-0.5 w-full border-t" : "mx-0.5 h-full border-l")} />
      <RailButton icon={Rows3} title={orientation === "vertical" ? "Mudar barra para horizontal" : "Mudar barra para vertical"} onClick={toggleOrientation} />
      <RailButton icon={EyeOff} title="Hide toolbar" onClick={hide} />
    </div>
  );
}
