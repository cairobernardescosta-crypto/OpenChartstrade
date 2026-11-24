import { Download, RotateCcw, Upload } from "lucide-react";
import { useRef } from "react";
import { exportWorkspaceBackup, restoreIndicatorBackup } from "../../lib/indicator-sdk/backup.ts";
import { resetWorkspaceMemorySettings, setWorkspaceSaveStatus, updateWorkspaceMemorySettings, useWorkspaceMemorySettings, useWorkspaceSaveStatus, type WorkspaceMemorySettings } from "../../services/workspace-memory.ts";
import { toast } from "../../services/toast.ts";

const LABELS: Record<keyof WorkspaceMemorySettings, string> = {
  restoreSession: "Restaurar última sessão automaticamente", assets: "Salvar ativos selecionados", timeframes: "Salvar timeframes",
  indicators: "Salvar indicadores automaticamente", drawings: "Salvar desenhos automaticamente", favorites: "Manter favoritos",
  drawingTemplates: "Manter modelos de ferramentas", layout: "Manter layout dos gráficos", viewport: "Restaurar zoom e posição temporal",
  appearance: "Manter preferências visuais", recoverLastValid: "Restaurar última sessão válida",
};
export function WorkspaceMemoryTab() {
  const settings = useWorkspaceMemorySettings(); const status = useWorkspaceSaveStatus(); const fileRef = useRef<HTMLInputElement>(null);
  const download = async () => { try { setWorkspaceSaveStatus("saving"); const backup = await exportWorkspaceBackup(); const blob = new Blob([backup], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `opencharts-workspace-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url); setWorkspaceSaveStatus("saved"); } catch (error) { setWorkspaceSaveStatus("error", error instanceof Error ? error.message : "Falha ao exportar."); toast.error("Falha na exportação", error instanceof Error ? error.message : "Falha ao exportar."); } };
  return <div className="space-y-3">
    <div><h3 className="text-xs font-semibold">Memória do ambiente de trabalho</h3><p className="text-[11px] text-muted-foreground">Preferências não sensíveis são salvas automaticamente.</p></div>
    <div className="space-y-1">{(Object.keys(LABELS) as Array<keyof WorkspaceMemorySettings>).map(key => <label key={key} className="flex items-center justify-between gap-3 rounded border border-border/60 px-2 py-1.5 text-xs"><span>{LABELS[key]}</span><input type="checkbox" checked={settings[key]} onChange={e => updateWorkspaceMemorySettings({ [key]: e.target.checked })} /></label>)}</div>
    <div className="rounded bg-secondary/50 px-2 py-1.5 text-[11px] text-muted-foreground" role="status">{status.state === "saving" ? "Salvando alterações…" : status.state === "error" ? `Falha ao salvar${status.message ? `: ${status.message}` : ""}` : status.state === "recovered" ? "Sessão recuperada" : `Todas as alterações salvas${status.at ? ` · ${new Date(status.at).toLocaleTimeString()}` : ""}`}</div>
    <div className="flex flex-wrap gap-2"><button className="flex items-center gap-1 rounded bg-secondary px-2 py-1 text-xs" onClick={() => void download()}><Download className="h-3 w-3"/>Exportar ambiente</button><button className="flex items-center gap-1 rounded bg-secondary px-2 py-1 text-xs" onClick={() => fileRef.current?.click()}><Upload className="h-3 w-3"/>Importar ambiente</button><button className="flex items-center gap-1 rounded bg-secondary px-2 py-1 text-xs" onClick={() => { if (confirm("Restaurar as preferências padrão de persistência?")) resetWorkspaceMemorySettings(); }}><RotateCcw className="h-3 w-3"/>Restaurar padrões</button></div>
    <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={async e => { const file=e.target.files?.[0]; if(!file)return; try { const text=await file.text(); if(!confirm("Restaurar este ambiente e substituir preferências correspondentes?"))return; setWorkspaceSaveStatus("restoring"); await restoreIndicatorBackup(text); setWorkspaceSaveStatus("recovered"); toast.success("Ambiente restaurado", "Indicadores, desenhos, templates e preferências foram recuperados. Reabra o OpenCharts para aplicar tudo."); } catch(error) { setWorkspaceSaveStatus("error", error instanceof Error ? error.message : "Arquivo inválido"); toast.error("Falha na restauração", error instanceof Error ? error.message : "Arquivo inválido"); } finally { e.target.value=""; } }} />
  </div>;
}
