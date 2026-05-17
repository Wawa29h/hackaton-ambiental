"use client"

import { Activity, Radio, Satellite, Shell } from "lucide-react"

export default function DashboardHeader() {
  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-[#0b1a2e]/80 backdrop-blur-lg px-8 py-4 shadow-sm relative z-20">
      {/* Left — brand */}
      <div className="flex items-center gap-4">
        {/* corner accent */}
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#0ea5e9]/30 bg-[#0ea5e9]/10 shadow-[0_0_15px_rgba(14,165,233,0.2)]">
          <Shell className="h-5 w-5 text-[#38bdf8]" />
        </div>
        <div>
          <h1 className="font-sans text-lg font-bold tracking-widest uppercase text-white">
            CoralWatch
          </h1>
          <p className="font-sans text-[10px] text-[#38bdf8]/70 tracking-widest uppercase font-medium">
            Sistema de Monitoreo Marino
          </p>
        </div>
      </div>

      {/* Right — sensor feeds */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-[11px] font-sans font-medium text-slate-400 tracking-widest uppercase">
          <Satellite className="h-4 w-4 text-[#0ea5e9]/60" />
          NOAA·CRW
        </div>
        <div className="h-5 w-px bg-white/10" />
        <div className="flex items-center gap-2 text-[11px] font-sans font-medium text-slate-400 tracking-widest uppercase">
          <Radio className="h-4 w-4 text-[#0ea5e9]/60" />
          SENTINEL-3
        </div>
        <div className="h-5 w-px bg-white/10" />
        <div className="flex items-center gap-2 border border-rose-500/30 bg-rose-500/10 px-4 py-2 rounded-full backdrop-blur-sm shadow-[0_0_10px_rgba(244,63,94,0.15)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
          </span>
          <Activity className="h-3.5 w-3.5 text-rose-400" />
          <span className="font-sans text-[10px] font-bold text-rose-400 tracking-widest uppercase">
            ALERTA ACTIVA
          </span>
        </div>
      </div>
    </header>
  )
}
