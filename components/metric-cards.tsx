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
  const accentColor = {
    normal:   { border: "border-emerald-500/20", bar: "bg-emerald-500/40", text: "text-emerald-400", label: "text-emerald-500/60" },
    warning:  { border: "border-amber-500/20",   bar: "bg-amber-500/40",   text: "text-amber-400",   label: "text-amber-500/60"   },
    critical: { border: "border-red-500/25",      bar: "bg-red-500/50",     text: "text-red-400",     label: "text-red-500/60"     },
  }[status]

  return (
    <div className={`relative border ${accentColor.border} bg-[#070a13] p-3 overflow-hidden`}>
      {/* top accent bar */}
      <div className={`absolute inset-x-0 top-0 h-px ${accentColor.bar}`} />
      {/* corner pip */}
      <span className={`absolute right-0 top-0 h-3 w-3 border-b border-l ${accentColor.border}`} />

      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-slate-600">{icon}</span>
        <span className={`font-mono text-[9px] tracking-[0.18em] uppercase ${accentColor.label}`}>
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-2xl font-bold leading-none tracking-tight ${accentColor.text}`}>
          {value}
        </span>
        <span className="font-mono text-[11px] text-slate-600">{unit}</span>
      </div>

      <p className="mt-2 font-mono text-[9px] leading-relaxed text-slate-600 tracking-wide">
        {description}
      </p>
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
  const getSstStatus = (t: number): "normal" | "warning" | "critical" =>
    t >= 30 ? "critical" : t >= 28 ? "warning" : "normal"
  const getDhwStatus = (d: number): "normal" | "warning" | "critical" =>
    d >= 8 ? "critical" : d >= 4 ? "warning" : "normal"

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <span className="font-mono text-[9px] tracking-[0.2em] text-slate-600 uppercase">
          DATOS EN TIEMPO REAL
        </span>
        <div className="flex-1 h-px bg-slate-800" />
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-800">
        <MetricCard
          icon={<Thermometer className="h-3.5 w-3.5" />}
          label="SST"
          value={sst?.toFixed(1) || "0.0"}
          unit="°C"
          status={getSstStatus(sst)}
          description="Sea Surface Temp — satélite NOAA en tiempo real"
        />
        <MetricCard
          icon={<Waves className="h-3.5 w-3.5" />}
          label="DHW"
          value={dhw?.toFixed(1) || "0.0"}
          unit="°C·sem"
          status={getDhwStatus(dhw)}
          description="Degree Heating Weeks — estrés térmico acumulado"
        />
        <MetricCard
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="ALERTA NOAA"
          value={`NVL ${dhw >= 8 ? 2 : dhw >= 4 ? 1 : 0}`}
          unit=""
          status={dhw >= 4 ? "critical" : "normal"}
          description="Nivel oficial del sistema de alerta de blanqueamiento"
        />
        <MetricCard
          icon={<Wind className="h-3.5 w-3.5" />}
          label="VIENTO"
          value={viento?.toFixed(1) || "0.0"}
          unit="km/h"
          status="normal"
          description="Velocidad superficial — estación local"
        />
      </div>
    </div>
  )
}
