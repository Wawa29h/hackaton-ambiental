import DashboardHeader from "@/components/dashboard-header"
import ReefMap from "@/components/reef-map"
import MetricCards from "@/components/metric-cards"
import AIWarningPanel from "@/components/ai-warning-panel"
import FinancialImpactCard from "@/components/financial-impact-card"
import CoralTimeline from "@/components/coral-timeline"

export default function Home() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#060a14]">
      <DashboardHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Left column - 60% - Satellite Map */}
        <div className="flex w-[60%] flex-col p-3">
          <div className="flex-1">
            <ReefMap />
          </div>
        </div>

        {/* Right column - 40% - Emergency Alert Panel */}
        <div className="w-[40%] overflow-y-auto border-l border-emerald-400/10 bg-[#0a0f1e]/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-emerald-400/30 to-transparent" />
            <h2 className="text-[10px] font-semibold tracking-[0.2em] text-emerald-400/60 uppercase">
              Panel de Emergencia
            </h2>
            <div className="h-px flex-1 bg-gradient-to-l from-emerald-400/30 to-transparent" />
          </div>

          <div className="flex flex-col gap-3">
            <MetricCards />
            <AIWarningPanel />
            <FinancialImpactCard />
            <CoralTimeline />
          </div>
        </div>
      </div>
    </div>
  )
}
