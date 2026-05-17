"use client"

import { Thermometer, Waves, AlertTriangle, Wind } from "lucide-react"

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
  status: "normal" | "warning" | "critical"
  description: string
}

function MetricCard({ icon, label, value, unit, status, description }: MetricCardProps) {
  const borderGlow = {
    normal: "border-emerald-400/25 shadow-[inset_0_1px_0_rgba(52,211,153,0.1)]",
    warning: "border-amber-400/25 shadow-[inset_0_1px_0_rgba(251,191,36,0.1)]",
    critical: "border-red-500/25 shadow-[inset_0_1px_0_rgba(239,68,68,0.1)]",
  }

  const valueStyles = {
    normal: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-red-400",
  }

  return (
    <div className={`rounded-lg border bg-[#0a0f1e]/80 p-4 ${borderGlow[status]}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-[10px] font-medium uppercase tracking-widest">{label}</span>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={`text-3xl font-bold tracking-tight ${valueStyles[status]}`}>{value}</span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

// Recibe los datos dinámicos desde el fetch raíz de Next.js
interface MetricCardsProps {
  sst: number
  dhw: number
  viento: number
}

export default function MetricCards({ sst, dhw, viento }: MetricCardsProps) {
  // Evaluamos dinámicamente el estatus del color según los datos NOAA reales
  const getSstStatus = (t: number) => (t >= 30 ? "critical" : t >= 28 ? "warning" : "normal")
  const getDhwStatus = (d: number) => (d >= 8 ? "critical" : d >= 4 ? "warning" : "normal")

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard
        icon={<Thermometer className="h-4 w-4 text-red-400/70" />}
        label="SST"
        value={sst?.toFixed(1) || "0.0"}
        unit="°C"
        status={getSstStatus(sst)}
        description="Sea Surface Temperature medida en tiempo real por satélite."
      />
      
      <MetricCard
        icon={<Waves className="h-4 w-4 text-red-400/70" />}
        label="DHW"
        value={dhw?.toFixed(1) || "0.0"}
        unit="DHW"
        status={getDhwStatus(dhw)}
        description="Degree Heating Weeks — estrés térmico acumulado."
      />
      
      <MetricCard
        icon={<AlertTriangle className="h-4 w-4 text-amber-400/70" />}
        label="Alerta NOAA"
        value={`Nivel ${dhw >= 8 ? 2 : dhw >= 4 ? 1 : 0}`}
        unit=""
        status={dhw >= 4 ? "critical" : "normal"}
        description="Estado oficial del sistema de alerta de blanqueamiento coralino."
      />
      
      <MetricCard
        icon={<Wind className="h-4 w-4 text-emerald-400/70" />}
        label="Viento"
        value={viento?.toFixed(1) || "0.0"}
        unit="km/h"
        status="normal"
        description="Velocidad del viento superficial registrada en la estación."
      />
    </div>
  )
}