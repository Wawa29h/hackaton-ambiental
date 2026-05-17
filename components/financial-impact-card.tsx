"use client"

import { DollarSign, TrendingDown, Fish, Ship } from "lucide-react"

interface FinancialImpactCardProps {
  trend?: string
}

export default function FinancialImpactCard({ trend }: FinancialImpactCardProps) {
  return (
    <div className="border border-slate-800 bg-[#070a13]">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center border border-amber-500/25 bg-amber-500/5">
          <DollarSign className="h-3.5 w-3.5 text-amber-400/70" />
        </div>
        <div>
          <h3 className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-slate-200">
            Valor en Riesgo
          </h3>
          <p className="font-mono text-[9px] text-slate-600 tracking-widest">
            IMPACTO ECONÓMICO REGIONAL
          </p>
        </div>
      </div>

      <div className="px-4 py-3">
        {/* big number */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="font-mono text-3xl font-bold text-amber-400 tracking-tight">$2.5M</span>
          <span className="font-mono text-[10px] text-slate-600 uppercase tracking-widest">
            pérdida / temporada
          </span>
        </div>

        {/* breakdown grid */}
        <div className="grid grid-cols-3 gap-px bg-slate-800">
          {[
            { icon: <Fish className="h-3 w-3" />,        label: "PESCA",       value: "$890K",  change: "-34%" },
            { icon: <Ship className="h-3 w-3" />,         label: "TURISMO",     value: "$1.2M",  change: "-41%" },
            { icon: <TrendingDown className="h-3 w-3" />, label: "COSTA",       value: "$410K",  change: "-28%" },
          ].map((item) => (
            <div key={item.label} className="bg-[#070a13] p-3 text-center">
              <div className="flex justify-center text-slate-600 mb-1.5">{item.icon}</div>
              <p className="font-mono text-sm font-bold text-slate-200">{item.value}</p>
              <p className="font-mono text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">{item.label}</p>
              <p className="font-mono text-[10px] font-bold text-red-400 mt-1">{item.change}</p>
            </div>
          ))}
        </div>

        {trend && (
          <p className="mt-3 font-mono text-[9px] text-slate-600 tracking-wide border-t border-slate-800 pt-2">
            TENDENCIA: <span className="text-slate-400">{trend}</span>
          </p>
        )}
      </div>
    </div>
  )
}
