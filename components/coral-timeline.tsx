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
  healthy:   { dot: "bg-[#0ea5e9]", line: "border-[#0ea5e9]/30", year: "text-[#38bdf8]" },
  stress:    { dot: "bg-amber-400",   line: "border-amber-500/30",   year: "text-amber-400"   },
  bleaching: { dot: "bg-rose-400",     line: "border-rose-500/30",     year: "text-rose-400"     },
}

interface CoralTimelineProps {
  interanual?: any
}

export default function CoralTimeline({ interanual }: CoralTimelineProps) {
  return (
    <div className="bg-[#0b1a2e]/40 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden shadow-sm p-2">
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Clock className="h-4 w-4 text-[#38bdf8]" />
        <span className="font-sans text-[13px] font-bold tracking-[0.1em] uppercase text-white">
          Declive Histórico
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
        <span className="font-sans font-medium text-[10px] text-slate-400 tracking-widest">CARIBE · 1970–2026</span>
      </div>

      <div className="px-4 py-3">
        <div className="relative ml-2">
          {/* vertical rail */}
          <div className="absolute left-[4px] top-2 bottom-2 w-[2px] rounded-full bg-white/5" />

          <div className="space-y-4">
            {TIMELINE_DATA.map((item) => {
              const cfg = STATUS_CFG[item.status]
              return (
                <div key={item.year} className="relative flex gap-5 pl-6 group">
                  {/* dot */}
                  <div className={`absolute left-0 top-[6px] h-2.5 w-2.5 ${cfg.dot} rounded-full shadow-[0_0_8px_currentColor] transition-transform group-hover:scale-125`} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`font-sans text-[13px] font-bold ${cfg.year}`}>
                        {item.year}
                      </span>
                      <div className={`border ${cfg.line} bg-white/5 rounded-full px-2 py-0.5`}>
                        <span className="font-sans text-[10px] font-semibold text-slate-300">{item.cover}</span>
                      </div>
                    </div>
                    <p className="font-sans text-[11px] leading-relaxed text-slate-400">
                      {item.event}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* degradation bar */}
        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-sans font-medium text-[10px] text-slate-400 tracking-widest uppercase">Pérdida acumulada</span>
            <span className="font-sans text-[12px] font-bold text-rose-400">89%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full w-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#0ea5e9] via-amber-400 to-rose-500"
              style={{ width: "89%" }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
