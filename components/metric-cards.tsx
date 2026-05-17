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
    normal:   { border: "border-[#0ea5e9]/30", bar: "bg-[#0ea5e9]", glow: "shadow-[0_0_15px_rgba(14,165,233,0.15)]", bg: "bg-[#0ea5e9]/5", text: "text-[#38bdf8]", label: "text-[#0ea5e9]" },
    warning:  { border: "border-amber-400/30",   bar: "bg-amber-400",   glow: "shadow-[0_0_15px_rgba(251,191,36,0.15)]", bg: "bg-amber-400/5", text: "text-amber-300",   label: "text-amber-400"   },
    critical: { border: "border-rose-400/30",    bar: "bg-rose-500",    glow: "shadow-[0_0_15px_rgba(244,63,94,0.2)]", bg: "bg-rose-500/10", text: "text-rose-400",     label: "text-rose-400"     },
  }[status]

  return (
    <div className={`relative border ${accentColor.border} ${accentColor.bg} ${accentColor.glow} p-5 rounded-2xl backdrop-blur-md overflow-hidden transition-all duration-300 hover:-translate-y-1`}>
      {/* top accent bar */}
      <div className={`absolute inset-x-0 top-0 h-1 opacity-50 ${accentColor.bar}`} />

      <div className="flex items-center gap-2 mb-4">
        <span className={`p-1.5 rounded-full bg-white/5 border border-white/10 ${accentColor.text}`}>{icon}</span>
        <span className={`font-sans font-bold text-[10px] tracking-widest uppercase ${accentColor.label}`}>
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className={`font-sans text-3xl font-bold leading-none tracking-tight ${accentColor.text}`}>
          {value}
        </span>
        <span className="font-sans font-medium text-xs text-slate-400">{unit}</span>
      </div>

      <p className="mt-3 font-sans text-[10px] leading-relaxed text-slate-400 font-medium">
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
      <div className="mb-4 flex items-center gap-3">
        <span className="font-sans font-semibold text-[11px] tracking-[0.2em] text-slate-400 uppercase">
          Métricas Oceánicas
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
      </div>
      <div className="grid grid-cols-2 gap-4">
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
