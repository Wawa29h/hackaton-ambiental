"use client" // Obligatorio en Next 15 para usar useEffect y useState

import { useEffect, useState } from "react"
import DashboardHeader from "../../components/dashboard-header"
import MetricCards from "../../components/metric-cards"
import AIWarningPanel from "../../components/ai-warning-panel"
import FinancialImpactCard from "../../components/financial-impact-card"
import CoralTimeline from "../../components/coral-timeline"
import ReefViewer from "../../frontend/src/components/ReefViewer/ReefViewer"

export default function Home() {
  const [reefs, setReefs] = useState<any[]>([])
  const [selectedReef, setSelectedReef] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://hackaton-ambiental-production.up.railway.app'

    fetch(`${apiUrl}/reefs`)
      .then((res) => res.json())
      .then((data) => {
        console.log("DATOS RECIBIDOS DEL BACKEND:", data)
        setReefs(data)
        setSelectedReef(data[0])
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error al conectar con el backend:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#020617]">
        <div className="text-center">
          <div className="inline-flex items-center gap-3 border border-emerald-500/20 bg-emerald-500/5 px-6 py-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 bg-emerald-400" />
            </span>
            <span className="font-mono text-xs tracking-[0.2em] text-emerald-400 uppercase">
              Sincronizando · NOAA &amp; Claude AI
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#020617]">
      <DashboardHeader />

      {/* Reef selector bar */}
      <div className="flex items-center gap-4 border-b border-slate-800 bg-[#020617] px-6 py-2">
        <span className="font-mono text-[9px] tracking-[0.2em] text-slate-600 uppercase whitespace-nowrap">
          ESTACIÓN //
        </span>
        <select
          className="flex-1 max-w-xs border border-slate-700 bg-[#020617] px-3 py-1.5 font-mono text-[11px] text-emerald-400 tracking-wider focus:outline-none focus:border-emerald-500/50 rounded-none"
          value={selectedReef?.slug}
          onChange={(e) => setSelectedReef(reefs.find(r => r.slug === e.target.value))}
        >
          {reefs.map((reef) => (
            <option key={reef.slug} value={reef.slug}>{reef.name}</option>
          ))}
        </select>
        {/* live indicator */}
        <div className="ml-auto flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="font-mono text-[9px] text-emerald-500/60 tracking-widest uppercase">EN VIVO</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — 3D viewer 60% */}
        <div className="flex w-[60%] flex-col">
          <div className="flex-1 relative border-r border-slate-800">
            {selectedReef && (
              <ReefViewer
                zone={selectedReef.slug}
                dhw={selectedReef.dhw}
                especies={['PoritesLobata', 'Pocillopora', 'Acropora', 'Diploria']}
              />
            )}
          </div>
        </div>

        {/* Right — data panel 40% */}
        <div className="w-[40%] overflow-y-auto bg-[#020617]">
          {/* panel title strip */}
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-800 bg-[#020617] px-4 py-2">
            <div className="h-px flex-1 bg-emerald-500/10" />
            <span className="font-mono text-[9px] tracking-[0.25em] text-slate-500 uppercase">
              Panel de Emergencia — <span className="text-emerald-500/70">{selectedReef?.name}</span>
            </span>
            <div className="h-px flex-1 bg-emerald-500/10" />
          </div>

          <div className="flex flex-col gap-px bg-slate-800 mt-px">
            <div className="bg-[#020617] p-4">
              <MetricCards
                sst={selectedReef?.current_sst}
                dhw={selectedReef?.dhw}
                viento={selectedReef?.viento?.velocidad_kmh}
              />
            </div>

            <div className="bg-[#020617] p-4">
              <AIWarningPanel
                text={selectedReef?.prediccion}
                alertLevel={selectedReef?.alert_level}
              />
            </div>

            <div className="bg-[#020617] p-4">
              <FinancialImpactCard trend={selectedReef?.tendencia} />
            </div>

            <div className="bg-[#020617] p-4">
              <CoralTimeline interanual={selectedReef?.interanual} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
