"use client"

import { Brain, ShieldAlert, ArrowRight } from "lucide-react"

// Definimos la interfaz con los datos vivos que vienen desde la raíz
interface AIWarningPanelProps {
  text: string
  alertLevel: number
}

export default function AIWarningPanel({ text, alertLevel }: AIWarningPanelProps) {
  // Mapeamos dinámicamente las etiquetas de riesgo según la alerta real
  const riskLabels = ["Sin Riesgo", "Vigilancia", "Advertencia", "Alerta Nivel 1", "Alerta Nivel 2"]
  const currentRisk = riskLabels[alertLevel] || "Riesgo Desconocido"
  
  return (
    <div className="rounded-lg border border-reef-bleaching/30 bg-reef-bleaching/5 p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-reef-bleaching/15">
          <Brain className="h-4 w-4 text-reef-bleaching" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Análisis de Alerta IA</h3>
          <p className="text-xs text-muted-foreground">Generado por Claude AI — OpenRouter Gateway</p>
        </div>
      </div>

      <div className="mt-3 rounded-md bg-background/60 p-3">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-3.5 w-3.5 text-reef-bleaching" />
          <span className="text-xs font-semibold text-reef-bleaching uppercase tracking-wider">
            {currentRisk}
          </span>
        </div>
        {/* Aquí renderizamos la predicción real en español de 150 palabras */}
        <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-line">
          {text || "Cargando reporte analítico y recomendaciones de la IA..."}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold text-foreground">Recomendaciones de Seguridad:</p>
        {[
          "Monitorear las tasas de calcificación y cambios en la pigmentación de los corales.",
          "Coordinar alertas comunitarias con pescadores locales y operadores turísticos.",
        ].map((rec, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-ocean-glow" />
            <span>{rec}</span>
          </div>
        ))}
      </div>
    </div>
  )
}