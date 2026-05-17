"use client"

import { DollarSign, TrendingDown, Fish, Ship } from "lucide-react"

interface FinancialImpactCardProps {
  trend?: any
}

export default function FinancialImpactCard({ trend }: FinancialImpactCardProps) {
  return (
    <div className="bg-gradient-to-br from-[#0b1a2e]/60 to-[#0b1a2e]/30 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden shadow-sm">
      {/* header */}
      <div className="flex items-center gap-4 border-b border-white/5 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 shadow-inner">
          <DollarSign className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h3 className="font-sans text-sm font-bold tracking-[0.1em] uppercase text-white">
            Valor en Riesgo
          </h3>
          <p className="font-sans text-[10px] font-medium text-amber-400/60 tracking-widest uppercase">
            IMPACTO ECONÓMICO REGIONAL
          </p>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* big number */}
        <div className="flex items-baseline gap-2 mb-6">
          <span className="font-sans text-5xl font-bold text-amber-400 tracking-tight">$2.5M</span>
          <span className="font-sans text-[11px] font-medium text-slate-400 uppercase tracking-widest">
            pérdida / temporada
          </span>
        </div>

        {/* breakdown grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Fish className="h-4 w-4" />,        label: "PESCA",       value: "$890K",  change: "-34%" },
            { icon: <Ship className="h-4 w-4" />,         label: "TURISMO",     value: "$1.2M",  change: "-41%" },
            { icon: <TrendingDown className="h-4 w-4" />, label: "COSTA",       value: "$410K",  change: "-28%" },
          ].map((item) => (
            <div key={item.label} className="bg-white/5 rounded-2xl p-4 text-center border border-white/5 shadow-inner">
              <div className="flex justify-center text-[#38bdf8] mb-2">{item.icon}</div>
              <p className="font-sans text-base font-bold text-white">{item.value}</p>
              <p className="font-sans text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">{item.label}</p>
              <p className="font-sans text-[11px] font-bold text-rose-400 mt-2 bg-rose-500/10 inline-block px-2 py-0.5 rounded-full">{item.change}</p>
            </div>
          ))}
        </div>

        {trend && (
          <div className="mt-5 bg-white/5 rounded-xl px-4 py-3 border border-white/5 flex items-center justify-between">
            <span className="font-sans text-[10px] font-bold text-slate-400 tracking-widest uppercase">
              TENDENCIA
            </span>
            <span className="font-sans text-[12px] font-semibold text-[#38bdf8]">
              {typeof trend === 'string' 
                ? trend 
                : trend?.sst_pendiente_diaria !== undefined 
                  ? `SST ${trend.sst_pendiente_diaria > 0 ? '+' : ''}${trend.sst_pendiente_diaria}°C/día`
                  : JSON.stringify(trend)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
