import { RotateCcw, Volume2 } from "lucide-react";
import { applySoundProfile, playSound, resetSoundSettings, updateSoundCategory, updateSoundSettings, useSoundSettings, type SoundCategory, type SoundProfile } from "../../services/audio.ts";

const categoryLabels: Record<SoundCategory, string> = {
  interface: "Interface",
  indicators: "Indicadores",
  drawings: "Ferramentas gráficas",
  replay: "Replay",
  notifications: "Notificações",
  financial: "Operações financeiras",
  connection: "Conexão",
};
const categoryEffects: Record<SoundCategory, Parameters<typeof playSound>[0]> = {
  interface: "ui", indicators: "toggle", drawings: "toggle", replay: "ui", notifications: "success", financial: "financial", connection: "connection",
};

export function SoundSettingsTab() {
  const settings = useSoundSettings();
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><div><div className="text-xs font-medium">Ativar efeitos sonoros</div><div className="text-[10px] text-muted-foreground">Sons discretos; nunca em ticks ou atualizações do gráfico.</div></div><input aria-label="Ativar efeitos sonoros" type="checkbox" checked={settings.enabled} onChange={(event)=>applySoundProfile(event.target.checked?(settings.profile==="silent"?"minimal":settings.profile):"silent")}/></div>
    <label className="block text-xs">Perfil<select aria-label="Perfil sonoro" className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5" value={settings.profile} onChange={(event)=>applySoundProfile(event.target.value as SoundProfile)}><option value="minimal">Minimalista</option><option value="balanced">Equilibrado</option><option value="complete">Completo</option><option value="silent">Silencioso</option></select></label>
    <label className="block text-xs">Volume geral: {Math.round(settings.masterVolume*100)}%<input aria-label="Volume geral" className="mt-1 w-full" type="range" min="0" max="100" value={Math.round(settings.masterVolume*100)} onChange={(event)=>updateSoundSettings({masterVolume:Number(event.target.value)/100})}/></label>
    <div className="border-t border-border pt-2">
      {(Object.keys(categoryLabels) as SoundCategory[]).map((category)=>{const value=settings.categories[category];return <div key={category} className="grid grid-cols-[1fr_90px_28px] items-center gap-2 py-1.5"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value.enabled} onChange={(event)=>updateSoundCategory(category,{enabled:event.target.checked})}/>{categoryLabels[category]}</label><input aria-label={`Volume ${categoryLabels[category]}`} type="range" min="0" max="100" value={Math.round(value.volume*100)} onChange={(event)=>updateSoundCategory(category,{volume:Number(event.target.value)/100})}/><button title={`Testar ${categoryLabels[category]}`} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={()=>void playSound(categoryEffects[category],category,true)}><Volume2 className="h-3.5 w-3.5"/></button></div>})}
    </div>
    <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground" onClick={resetSoundSettings}><RotateCcw className="h-3 w-3"/>Restaurar padrão Minimalista</button>
  </div>;
}
