"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from "react-leaflet"
import type { FeatureCollection } from "geojson"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

const ROATAN_CENTER: [number, number] = [16.5, -87.5]
const DEFAULT_ZOOM = 7

const REEF_MARKERS: {
  name: string
  position: [number, number]
  status: "healthy" | "stress" | "bleaching"
  sst: string
  depth: string
  species: string
}[] = [
  {
    name: "Sandy Bay",
    position: [16.3785, -86.565],
    status: "bleaching",
    sst: "31.8\u00b0C",
    depth: "8m",
    species: "Orbicella faveolata",
  },
  {
    name: "West End Wall",
    position: [16.299, -86.601],
    status: "stress",
    sst: "30.4\u00b0C",
    depth: "15m",
    species: "Acropora cervicornis",
  },
  {
    name: "French Harbour",
    position: [16.332, -86.41],
    status: "healthy",
    sst: "28.9\u00b0C",
    depth: "6m",
    species: "Porites astreoides",
  },
  {
    name: "Punta Gorda",
    position: [16.351, -86.335],
    status: "stress",
    sst: "30.1\u00b0C",
    depth: "12m",
    species: "Montastraea cavernosa",
  },
  {
    name: "Flowers Bay",
    position: [16.278, -86.553],
    status: "bleaching",
    sst: "32.1\u00b0C",
    depth: "5m",
    species: "Acropora palmata",
  },
  {
    name: "Cayos Cochinos Norte",
    position: [15.975, -86.48],
    status: "bleaching",
    sst: "31.5\u00b0C",
    depth: "10m",
    species: "Diploria strigosa",
  },
  {
    name: "Cayos Cochinos Sur",
    position: [15.95, -86.46],
    status: "stress",
    sst: "30.6\u00b0C",
    depth: "9m",
    species: "Siderastrea siderea",
  },
]

const STATUS_COLORS: Record<string, string> = {
  healthy: "#34d399",
  stress: "#fbbf24",
  bleaching: "#ef4444",
}

const STATUS_LABELS: Record<string, string> = {
  healthy: "Sano",
  stress: "Estr\u00e9s T\u00e9rmico",
  bleaching: "Blanqueamiento Severo",
}

function createGlowIcon(status: string) {
  const color = STATUS_COLORS[status]
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
    html: `
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        <div class="marker-ring" style="position:absolute;inset:0;border-radius:50%;border:2px solid ${color};opacity:0.5;"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.25);box-shadow:0 0 14px ${color},0 0 28px ${color}44;"></div>
      </div>
    `,
  })
}

function MapReady() {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100)
  }, [map])
  return null
}

export default function ReefMapInner() {
  const [reefGeoJson, setReefGeoJson] = useState<FeatureCollection | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/data/Mesoamerica.geojson")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status}`)
        return res.json()
      })
      .then((data: FeatureCollection) => {
        if (!cancelled) setReefGeoJson(data)
      })
      .catch((err) => console.error("[v0] Failed to fetch reef GeoJSON:", err))
    return () => { cancelled = true }
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border">
      <MapContainer
        center={ROATAN_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={true}
        attributionControl={false}
        style={{ height: "100%", width: "100%", background: "#0a0f1e" }}
        className="z-0"
      >
        <MapReady />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={18}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          attribution="Labels &copy; Esri"
          maxZoom={18}
        />

        {reefGeoJson && (
          <GeoJSON
            data={reefGeoJson}
            pane="overlayPane"
            style={{
              color: "#dc2626",
              fillColor: "#dc2626",
              fillOpacity: 0.4,
              weight: 2,
            }}
          />
        )}

        {REEF_MARKERS.map((marker) => (
          <Marker
            key={marker.name}
            position={marker.position}
            icon={createGlowIcon(marker.status)}
          >
            <Popup>
              <div
                style={{
                  background: "rgba(10, 15, 30, 0.95)",
                  color: "#e2e8f0",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  border: `1px solid ${STATUS_COLORS[marker.status]}33`,
                  fontFamily: "Geist, system-ui, sans-serif",
                  minWidth: "180px",
                  boxShadow: `0 0 20px ${STATUS_COLORS[marker.status]}22`,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "13px",
                    marginBottom: "6px",
                    color: "#f1f5f9",
                  }}
                >
                  {marker.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "11px",
                    color: "#94a3b8",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: STATUS_COLORS[marker.status],
                      display: "inline-block",
                      boxShadow: `0 0 6px ${STATUS_COLORS[marker.status]}`,
                    }}
                  />
                  {STATUS_LABELS[marker.status]}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "4px 12px",
                    marginTop: "8px",
                    fontSize: "11px",
                    color: "#94a3b8",
                  }}
                >
                  <span>SST:</span>
                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                    {marker.sst}
                  </span>
                  <span>Prof.:</span>
                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                    {marker.depth}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: "8px",
                    paddingTop: "6px",
                    borderTop: "1px solid rgba(148,163,184,0.15)",
                    fontSize: "10px",
                    color: "#64748b",
                    fontStyle: "italic",
                  }}
                >
                  {marker.species}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Scan line overlay */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
        <div className="animate-scan absolute inset-x-0 h-px bg-emerald-400/20" />
      </div>

      {/* Top-left live indicator */}
      <div className="absolute left-4 top-4 z-[1000] flex items-center gap-2 rounded-md border border-emerald-400/20 bg-[#0a0f1e]/85 px-3 py-1.5 text-xs font-mono text-emerald-300/80 backdrop-blur-sm">
        <span className="inline-block h-2 w-2 animate-pulse-glow rounded-full bg-emerald-400" />
        LIVE &mdash; Roat&aacute;n &amp; Cayos Cochinos
      </div>

      {/* Coordinates display */}
      <div className="absolute bottom-4 left-4 z-[1000] rounded-md border border-border bg-[#0a0f1e]/85 px-3 py-1.5 font-mono text-xs text-muted-foreground backdrop-blur-sm">
        16.50&deg;N, 87.50&deg;W &middot; Zoom {DEFAULT_ZOOM}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] rounded-lg border border-emerald-400/15 bg-[#0a0f1e]/90 p-3 backdrop-blur-sm">
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-emerald-300/70 uppercase">
          Riesgo de Blanqueamiento
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { label: "Sano", color: "#34d399" },
            { label: "Estr\u00e9s T\u00e9rmico", color: "#fbbf24" },
            { label: "Blanqueamiento Severo", color: "#ef4444" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 text-[11px] text-muted-foreground"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  background: item.color,
                  boxShadow: `0 0 8px ${item.color}88`,
                }}
              />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
