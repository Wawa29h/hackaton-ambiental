"use client"

import dynamic from "next/dynamic"

const ReefMapInner = dynamic(() => import("./reef-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span className="text-xs font-mono">Cargando mapa satelital...</span>
      </div>
    </div>
  ),
})

export default function ReefMap() {
  return (
    <div className="h-full w-full">
      <ReefMapInner />
    </div>
  )
}
