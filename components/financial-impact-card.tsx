"use client"

import { DollarSign, TrendingDown, Fish, Ship } from "lucide-react"

export default function FinancialImpactCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-reef-stress/15">
          <DollarSign className="h-4 w-4 text-reef-stress" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Valor en Riesgo del Arrecife Caribeño</h3>
          <p className="text-xs text-muted-foreground">Estimación de impacto económico regional</p>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-reef-stress">$2.5M</span>
        <span className="text-xs text-muted-foreground">pérdida potencial / temporada</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { icon: <Fish className="h-3.5 w-3.5" />, label: "Pesca", value: "$890K", change: "-34%" },
          { icon: <Ship className="h-3.5 w-3.5" />, label: "Turismo", value: "$1.2M", change: "-41%" },
          { icon: <TrendingDown className="h-3.5 w-3.5" />, label: "Protección Costera", value: "$410K", change: "-28%" },
        ].map((item) => (
          <div key={item.label} className="rounded-md bg-secondary/50 p-2 text-center">
            <div className="flex justify-center text-muted-foreground">{item.icon}</div>
            <p className="mt-1 text-xs font-medium text-foreground">{item.value}</p>
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
            <p className="text-[10px] font-semibold text-reef-bleaching">{item.change}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
