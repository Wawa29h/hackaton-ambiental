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

  const riskColor = alertLevel >= 3 ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
    : alertLevel >= 1 ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
    : "text-[#38bdf8] border-[#0ea5e9]/30 bg-[#0ea5e9]/10"

  return (
    <div className="bg-[#0b1a2e]/50 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-lg">
      {/* header */}
      <div className="flex items-center gap-4 border-b border-white/5 bg-white/5 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-500/10 shadow-inner">
          <Brain className="h-5 w-5 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-sans text-sm font-bold tracking-[0.1em] uppercase text-white">
            Análisis IA
          </h3>
          <p className="font-sans text-[10px] font-medium text-indigo-300/70 tracking-widest uppercase">
            Claude 3.5 Sonnet
          </p>
        </div>
        {/* alert level badge */}
        <div className={`rounded-full border px-3 py-1 font-sans text-[10px] font-bold tracking-[0.1em] uppercase ${riskColor}`}>
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            {currentRisk}
          </div>
        </div>
      </div>

      {/* body — predicción real en español de 150 palabras */}
      <div className="px-6 py-5">
        <p className="font-sans text-[13px] leading-[1.8] text-slate-300 font-medium whitespace-pre-line">
          {text || "Cargando reporte analítico y recomendaciones de la IA..."}
        </p>
      </div>

      {/* recommendations */}
      <div className="border-t border-white/5 bg-white/[0.02] px-6 py-4">
        <p className="font-sans font-bold text-[10px] tracking-[0.2em] text-[#38bdf8] uppercase mb-3">
          RECOMENDACIONES DE LA IA
        </p>
        <div className="space-y-3">
          {[
            "Monitorear calcificación y cambios en pigmentación coralina.",
            "Coordinar alertas con pescadores locales y operadores turísticos.",
          ].map((rec, i) => (
            <div key={i} className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#0ea5e9]" />
              <span className="font-sans text-xs leading-relaxed text-slate-300">{rec}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
