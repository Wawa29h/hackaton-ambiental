"use client"

import { Brain, ShieldAlert, ArrowRight } from "lucide-react"

// Definimos la interfaz con los datos vivos que vienen desde la raíz
interface AIWarningPanelProps {
  text: string
  alertLevel: number
}

export default function AIWarningPanel({ text, alertLevel }: AIWarningPanelProps) {
  // Mapeamos dinámicamente las etiquetas de riesgo según la alerta real
  const riskLabels = ["SIN RIESGO", "VIGILANCIA", "ADVERTENCIA", "ALERTA NVL·1", "ALERTA NVL·2"]
  const currentRisk = riskLabels[alertLevel] ?? "RIESGO DESCONOCIDO"

  const riskColor = alertLevel >= 3 ? "text-red-400 border-red-500/30 bg-red-500/5"
    : alertLevel >= 1 ? "text-amber-400 border-amber-500/30 bg-amber-500/5"
    : "text-emerald-400 border-emerald-500/30 bg-emerald-500/5"

  return (
    <div className="border border-slate-800 bg-[#070a13]">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center border border-slate-700 bg-slate-800/60">
          <Brain className="h-3.5 w-3.5 text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-mono text-[11px] font-semibold tracking-[0.12em] uppercase text-slate-200">
            Análisis IA
          </h3>
          <p className="font-mono text-[9px] text-slate-600 tracking-widest">
            CLAUDE·AI // OPENROUTER
          </p>
        </div>
        {/* alert level badge */}
        <div className={`border px-2 py-1 font-mono text-[9px] font-bold tracking-[0.2em] uppercase ${riskColor}`}>
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-3 w-3" />
            {currentRisk}
          </div>
        </div>
      </div>

      {/* body — predicción real en español de 150 palabras */}
      <div className="px-4 py-3">
        <p className="font-mono text-[10px] leading-[1.8] text-slate-400 whitespace-pre-line">
          {text || "Cargando reporte analítico y recomendaciones de la IA..."}
        </p>
      </div>

      {/* recommendations */}
      <div className="border-t border-slate-800 px-4 py-3">
        <p className="font-mono text-[9px] tracking-[0.2em] text-slate-600 uppercase mb-2">
          RECOMENDACIONES
        </p>
        <div className="space-y-2">
          {[
            "Monitorear calcificación y cambios en pigmentación coralina.",
            "Coordinar alertas con pescadores locales y operadores turísticos.",
          ].map((rec, i) => (
            <div key={i} className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500/60" />
              <span className="font-mono text-[10px] leading-relaxed text-slate-500">{rec}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
