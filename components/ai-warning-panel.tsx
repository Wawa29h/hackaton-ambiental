"use client"

import { Brain, ShieldAlert, ArrowRight } from "lucide-react"

export default function AIWarningPanel() {
  return (
    <div className="rounded-lg border border-reef-bleaching/30 bg-reef-bleaching/5 p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-reef-bleaching/15">
          <Brain className="h-4 w-4 text-reef-bleaching" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Análisis de Alerta IA</h3>
          <p className="text-xs text-muted-foreground">Modelo predictivo v3.2 — actualizado hace 12 min</p>
        </div>
      </div>

      <div className="mt-3 rounded-md bg-background/60 p-3">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-3.5 w-3.5 text-reef-bleaching" />
          <span className="text-xs font-semibold text-reef-bleaching uppercase tracking-wider">Riesgo Crítico</span>
        </div>
        <p className="text-xs leading-relaxed text-foreground/80">
          El modelo predictivo detecta un <span className="font-semibold text-reef-bleaching">87% de probabilidad de blanqueamiento masivo</span> en 
          la zona de <span className="font-semibold text-foreground">Roat&aacute;n y Cayos Cochinos</span> dentro de las pr&oacute;ximas 3 semanas. La SST se ha mantenido
          por encima de 31&deg;C durante 14 d&iacute;as consecutivos, superando el umbral de tolerancia t&eacute;rmica de
          las especies <em>Orbicella faveolata</em> y <em>Acropora cervicornis</em>. Se recomienda acci&oacute;n inmediata.
        </p>
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold text-foreground">Recomendaciones:</p>
        {[
          "Activar protocolo de monitoreo intensivo en arrecifes de Roatán y Cayos Cochinos",
          "Restringir actividades de buceo recreativo en Sandy Bay y Flowers Bay",
          "Desplegar boyas de monitoreo térmico adicionales en zona crítica sur",
          "Iniciar documentación fotográfica submarina para baseline pre-evento",
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
