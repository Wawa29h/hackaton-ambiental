"use client"

import { Clock } from "lucide-react"

const TIMELINE_DATA = [
  {
    year: "1970",
    cover: "46%",
    event: "Cobertura coralina máxima registrada en el Caribe",
    status: "healthy" as const,
  },
  {
    year: "1983",
    cover: "35%",
    event: "Primer evento de blanqueamiento masivo y mortalidad de Diadema antillarum",
    status: "stress" as const,
  },
  {
    year: "1998",
    cover: "22%",
    event: "El Niño: blanqueamiento global sin precedentes — pérdida del 16% en un año",
    status: "bleaching" as const,
  },
  {
    year: "2005",
    cover: "15%",
    event: "Temporada récord de DHW en el Caribe. Blanqueamiento en Belice y Honduras",
    status: "bleaching" as const,
  },
  {
    year: "2010",
    cover: "12%",
    event: "Declive continuo agravado por enfermedades coralinas (SCTLD emergente)",
    status: "stress" as const,
  },
  {
    year: "2023",
    cover: "8%",
    event: "Temperatura oceánica récord global. Blanqueamiento masivo reportado en SAM",
    status: "bleaching" as const,
  },
  {
    year: "2026",
    cover: "~5%",
    event: "Proyección actual — nivel crítico. Esfuerzos de restauración insuficientes",
    status: "bleaching" as const,
  },
]

const STATUS_DOT = {
  healthy: "bg-reef-healthy border-reef-healthy/30 shadow-[0_0_8px_var(--reef-healthy)]",
  stress: "bg-reef-stress border-reef-stress/30 shadow-[0_0_8px_var(--reef-stress)]",
  bleaching: "bg-reef-bleaching border-reef-bleaching/30 shadow-[0_0_8px_var(--reef-bleaching)]",
}

export default function CoralTimeline() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          Declive Histórico del Coral Caribeño
        </h3>
      </div>

      <div className="relative ml-3">
        {/* Vertical line */}
        <div className="absolute left-[5px] top-0 bottom-0 w-px bg-border" />

        <div className="space-y-4">
          {TIMELINE_DATA.map((item, i) => (
            <div key={item.year} className="relative flex gap-4 pl-6">
              {/* Dot on line */}
              <div
                className={`absolute left-0 top-1 h-[11px] w-[11px] rounded-full border ${STATUS_DOT[item.status]}`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-foreground font-mono">{item.year}</span>
                  <div className="flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5">
                    <span className="text-[10px] font-semibold text-foreground">{item.cover}</span>
                    <span className="text-[10px] text-muted-foreground">cobertura</span>
                  </div>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.event}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar visual */}
      <div className="mt-4 flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-reef-healthy via-reef-stress to-reef-bleaching"
            style={{ width: "89%" }}
          />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
          89% pérdida desde 1970
        </span>
      </div>
    </div>
  )
}
