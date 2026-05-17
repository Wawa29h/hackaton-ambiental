"use client"

import { Activity, Radio, Satellite, Shell } from "lucide-react"

export default function DashboardHeader() {
  return (
    <header className="flex items-center justify-between border-b border-emerald-400/10 bg-[#0a0f1e]/80 px-6 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 shadow-[0_0_12px_rgba(52,211,153,0.15)]">
          <Shell className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-foreground">
            CoralWatch Caribbean
          </h1>
          <p className="text-xs text-emerald-300/50">
            {"Sistema de Monitoreo \u2014 Roat\u00e1n & Cayos Cochinos"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Satellite className="h-3.5 w-3.5 text-emerald-400/60" />
          <span className="font-mono">NOAA CRW</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Radio className="h-3.5 w-3.5 text-emerald-400/60" />
          <span className="font-mono">Sentinel-3 SLSTR</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
          <Activity className="h-3.5 w-3.5" />
          ALERTA ACTIVA
        </div>
      </div>
    </header>
  )
}
