"use client"

import { Activity, Radio, Satellite, Shell } from "lucide-react"

export default function DashboardHeader() {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-[#020617] px-6 py-3">
      {/* Left — brand */}
      <div className="flex items-center gap-4">
        {/* corner accent */}
        <div className="relative flex h-9 w-9 items-center justify-center border border-emerald-500/30 bg-emerald-500/5">
          <Shell className="h-5 w-5 text-emerald-400" />
          {/* top-left corner pip */}
          <span className="absolute -left-px -top-px h-2 w-2 border-l border-t border-emerald-400/60" />
          <span className="absolute -bottom-px -right-px h-2 w-2 border-b border-r border-emerald-400/60" />
        </div>
        <div>
          <h1 className="font-mono text-sm font-bold tracking-[0.15em] uppercase text-slate-100">
            CoralWatch
          </h1>
          <p className="font-mono text-[10px] text-emerald-500/50 tracking-widest">
            SYS // MONITOR // CARIBE
          </p>
        </div>
      </div>

      {/* Right — sensor feeds */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 tracking-widest uppercase">
          <Satellite className="h-3.5 w-3.5 text-emerald-500/50" />
          NOAA·CRW
        </div>
        <div className="h-4 w-px bg-slate-800" />
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 tracking-widest uppercase">
          <Radio className="h-3.5 w-3.5 text-emerald-500/50" />
          SENTINEL-3
        </div>
        <div className="h-4 w-px bg-slate-800" />
        <div className="flex items-center gap-2 border border-red-500/40 bg-red-500/8 px-3 py-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping bg-red-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 bg-red-400" />
          </span>
          <Activity className="h-3 w-3 text-red-400" />
          <span className="font-mono text-[10px] font-semibold text-red-400 tracking-widest uppercase">
            ALERTA ACTIVA
          </span>
        </div>
      </div>
    </header>
  )
}
