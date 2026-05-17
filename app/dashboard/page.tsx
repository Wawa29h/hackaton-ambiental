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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    
    fetch(`${apiUrl}/reefs`)
      .then((res) => res.json())
      .then((data) => {
        // 👇 Aquí ya está inyectada la línea mágica dentro del componente correcto
        console.log("DATOS RECIBIDOS DEL BACKEND:", data)
        setReefs(data)
        setSelectedReef(data[0]) // Belize por defecto
        loading: setLoading(false)
      })
      .catch((err) => console.error('Error al conectar con el backend:', err))
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#060a14] text-emerald-400 font-mono text-sm">
        📡 SINCRONIZANDO CON LA RED NOAA & CLAUDE AI...
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#060a14]">
      {/* Header pasándole el selector si quieren cambiar de arrecife */}
      <DashboardHeader />

      {/* Selector de Arrecifes Rápido en Barra Superior */}
      <div className="px-4 py-2 bg-[#0a0f1e]/80 border-b border-emerald-400/10 flex items-center gap-3">
        <span className="text-xs text-slate-400 font-mono">ESTACIÓN MONITOREADA:</span>
        <select 
          className="bg-[#060a14] border border-emerald-400/20 rounded px-2 py-1 text-xs text-emerald-400 focus:outline-none focus:border-emerald-400"
          value={selectedReef?.slug}
          onChange={(e) => setSelectedReef(reefs.find(r => r.slug === e.target.value))}
        >
          {reefs.map((reef) => (
            <option key={reef.slug} value={reef.slug}>{reef.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left column - 60% - El Arrecife en 3D Vivo con Datos de la API */}
        <div className="flex w-[60%] flex-col p-3">
          <div className="flex-1 rounded-xl overflow-hidden border border-emerald-400/10 bg-[#0a0f1e]/30 relative">
            {selectedReef && (
              <ReefViewer 
                zone={selectedReef.slug} 
                dhw={selectedReef.dhw} 
                especies={['PoritesLobata', 'Pocillopora', 'Acropora', 'Diploria']} 
              />
            )}
          </div>
        </div>

        {/* Right column - 40% - Panel de Emergencia Dinámico */}
        <div className="w-[40%] overflow-y-auto border-l border-emerald-400/10 bg-[#0a0f1e]/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-emerald-400/30 to-transparent" />
            <h2 className="text-[10px] font-semibold tracking-[0.2em] text-emerald-400/60 uppercase">
              Panel de Emergencia — {selectedReef?.name}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-l from-emerald-400/30 to-transparent" />
          </div>

          <div className="flex flex-col gap-3">
            <MetricCards 
              sst={selectedReef?.current_sst} 
              dhw={selectedReef?.dhw} 
              viento={selectedReef?.viento?.velocidad_kmh} 
            />
            
            <AIWarningPanel 
              text={selectedReef?.prediccion} 
              alertLevel={selectedReef?.alert_level}
            />
            
            <FinancialImpactCard trend={selectedReef?.tendencia} />
            <CoralTimeline interanual={selectedReef?.interanual} />
          </div>
        </div>
      </div>
    </div>
  )
} // 📦 EL ARCHIVO DEBE TERMINAR EXACTAMENTE AQUÍ CON ESTA LLAVE