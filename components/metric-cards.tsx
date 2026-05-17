"use client"

import { Thermometer, Waves, TrendingUp, AlertTriangle } from "lucide-react"

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
  status: "normal" | "warning" | "critical"
  delta?: string
  description: string
}

function MetricCard({ icon, label, value, unit, status, delta, description }: MetricCardProps) {
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
        {delta && (
          <div className="flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
            <TrendingUp className="h-3 w-3" />
            {delta}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={`text-3xl font-bold tracking-tight ${valueStyles[status]}`}>{value}</span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

export default function MetricCards() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard
        icon={<Thermometer className="h-4 w-4 text-red-400/70" />}
        label="SST"
        value="31.8"
        unit={"\u00b0C"}
        status="critical"
        delta={"+2.3\u00b0C"}
        description={"Temperatura Superficial del Mar \u2014 promedio regional 7d"}
      />
      <MetricCard
        icon={<Waves className="h-4 w-4 text-red-400/70" />}
        label="DHW"
        value="8.2"
        unit="DHW"
        status="critical"
        delta="+3.1"
        description={"Degree Heating Weeks \u2014 acumulaci\u00f3n t\u00e9rmica 12 semanas"}
      />
      <MetricCard
        icon={<AlertTriangle className="h-4 w-4 text-amber-400/70" />}
        label="Alerta NOAA"
        value="Nivel 2"
        unit=""
        status="warning"
        description={"Alerta de blanqueamiento activa para Roat\u00e1n y Cayos Cochinos"}
      />
      <MetricCard
        icon={<Thermometer className="h-4 w-4 text-amber-400/70" />}
        label={"Anomal\u00eda"}
        value="+1.8"
        unit={"\u00b0C"}
        status="warning"
        delta="vs. MMM"
        description={"Desviaci\u00f3n sobre la media mensual m\u00e1xima climatol\u00f3gica"}
      />
    </div>
  )
}
