"use client"

import { Clock } from "lucide-react"

const TIMELINE_DATA = [
  { year: "1970", cover: "46%", event: "Cobertura coralina máxima registrada en el Caribe",                             status: "healthy"   as const },
  { year: "1983", cover: "35%", event: "Primer blanqueamiento masivo — mortalidad de Diadema antillarum",                status: "stress"    as const },
  { year: "1998", cover: "22%", event: "El Niño: blanqueamiento global sin precedentes — pérdida del 16% en un año",     status: "bleaching" as const },
  { year: "2005", cover: "15%", event: "Temporada récord de DHW en el Caribe: Belice y Honduras afectados",              status: "bleaching" as const },
  { year: "2010", cover: "12%", event: "Declive continuo agravado por enfermedades coralinas (SCTLD emergente)",         status: "stress"    as const },
  { year: "2023", cover:  "8%", event: "Temperatura oceánica récord global — blanqueamiento masivo en SAM",              status: "bleaching" as const },
  { year: "2026", cover: "~5%", event: "Proyección actual — nivel crítico. Esfuerzos de restauración insuficientes",     status: "bleaching" as const },
]

const STATUS_CFG = {
  healthy:   { dot: "bg-emerald-400", line: "border-emerald-500/30", year: "text-emerald-400" },
  stress:    { dot: "bg-amber-400",   line: "border-amber-500/30",   year: "text-amber-400"   },
  bleaching: { dot: "bg-red-400",     line: "border-red-500/30",     year: "text-red-400"     },
}

interface CoralTimelineProps {
  interanual?: any
}

export default function CoralTimeline({ interanual }: CoralTimelineProps) {
  return (
    <div className="border border-slate-800 bg-[#070a13]">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <Clock className="h-3.5 w-3.5 text-slate-600" />
        <span className="font-mono text-[11px] font-semibold tracking-[0.12em] uppercase text-slate-200">
          Declive Histórico
        </span>
        <div className="flex-1 h-px bg-slate-800" />
        <span className="font-mono text-[9px] text-slate-600 tracking-widest">CARIBE · 1970–2026</span>
      </div>

      <div className="px-4 py-3">
        <div className="relative ml-2">
          {/* vertical rail */}
          <div className="absolute left-[4px] top-0 bottom-0 w-px bg-slate-800" />

          <div className="space-y-3">
            {TIMELINE_DATA.map((item) => {
              const cfg = STATUS_CFG[item.status]
              return (
                <div key={item.year} className="relative flex gap-4 pl-5">
                  {/* dot */}
                  <div className={`absolute left-0 top-[5px] h-2 w-2 ${cfg.dot} rounded-none`} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-0.5">
                      <span className={`font-mono text-[11px] font-bold ${cfg.year}`}>
                        {item.year}
                      </span>
                      <div className={`border ${cfg.line} px-1.5 py-0.5`}>
                        <span className="font-mono text-[9px] text-slate-300">{item.cover}</span>
                      </div>
                    </div>
                    <p className="font-mono text-[10px] leading-relaxed text-slate-500">
                      {item.event}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* degradation bar */}
        <div className="mt-4 border-t border-slate-800 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[9px] text-slate-600 tracking-widest uppercase">Pérdida acumulada</span>
            <span className="font-mono text-[10px] font-bold text-red-400">89%</span>
          </div>
          <div className="h-1 bg-slate-800 w-full">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
              style={{ width: "89%" }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
