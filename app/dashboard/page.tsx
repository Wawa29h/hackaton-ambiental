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
      <div className="flex h-screen items-center justify-center bg-[#06111e] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0b1a2e] via-[#06111e] to-[#020610]">
        <div className="text-center">
          <div className="inline-flex items-center gap-3 border border-[#0ea5e9]/30 bg-[#0ea5e9]/10 px-8 py-4 rounded-full backdrop-blur-md shadow-[0_0_30px_rgba(14,165,233,0.15)]">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0ea5e9] opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#0ea5e9]" />
            </span>
            <span className="font-sans font-medium text-sm tracking-[0.1em] text-[#0ea5e9] uppercase">
              Sincronizando Corrientes Marinas
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#06111e] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b1a2e] via-[#06111e] to-[#030914] text-slate-200">
      <DashboardHeader />

      {/* Reef selector bar */}
      <div className="flex items-center gap-4 border-b border-white/5 bg-white/5 backdrop-blur-md px-6 py-3 shadow-sm z-10">
        <span className="font-sans font-medium text-[10px] tracking-[0.2em] text-slate-400 uppercase whitespace-nowrap">
          ESTACIÓN ACTIVA
        </span>
        <select
          className="flex-1 max-w-xs border border-white/10 bg-[#0b1a2e]/80 px-4 py-2 font-sans font-medium text-sm text-[#38bdf8] focus:outline-none focus:border-[#0ea5e9]/50 rounded-full shadow-inner cursor-pointer appearance-none"
          value={selectedReef?.slug}
          onChange={(e) => setSelectedReef(reefs.find(r => r.slug === e.target.value))}
        >
          {reefs.map((reef) => (
            <option key={reef.slug} value={reef.slug}>{reef.name}</option>
          ))}
        </select>
        {/* live indicator */}
        <div className="ml-auto flex items-center gap-2 bg-[#0ea5e9]/10 px-3 py-1.5 rounded-full border border-[#0ea5e9]/20">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0ea5e9] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#38bdf8]" />
          </span>
          <span className="font-sans font-semibold text-[10px] text-[#38bdf8] tracking-widest uppercase">EN VIVO</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — 3D viewer 60% */}
        <div className="flex w-[60%] flex-col">
          <div className="flex-1 relative border-r border-white/5 bg-black/20">
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
        <div className="w-[40%] overflow-y-auto bg-transparent relative scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {/* panel title strip */}
          <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-[#0b1a2e]/90 backdrop-blur-md px-6 py-4 shadow-md">
            <span className="font-sans font-medium text-[11px] tracking-[0.2em] text-slate-400 uppercase">
              Análisis Satelital — <span className="text-[#38bdf8] font-bold">{selectedReef?.name}</span>
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-[#0ea5e9]/30 to-transparent" />
          </div>

          <div className="flex flex-col gap-6 p-6">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <MetricCards
                sst={selectedReef?.current_sst}
                dhw={selectedReef?.dhw}
                viento={selectedReef?.viento?.velocidad_kmh}
              />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 fill-mode-both">
              <AIWarningPanel
                text={selectedReef?.prediccion}
                alertLevel={selectedReef?.alert_level}
              />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both">
              <FinancialImpactCard trend={selectedReef?.tendencia} />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300 fill-mode-both">
              <CoralTimeline interanual={selectedReef?.interanual} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
