// Requiere: npm install leaflet react-leaflet
// En Next.js usar: dynamic(() => import('./ReefMap'), { ssr: false })

import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useReefStations, alertColor } from '../hooks/useReefStations'

const ALERT_LABELS: Record<number, string> = {
  0: 'Sin estrés',
  1: 'Vigilancia',
  2: 'Alerta 1',
  3: 'Alerta 2',
  4: 'Crítico',
}

const _API_BASE = (import.meta as any).env?.VITE_API_URL
  ?? 'https://hackaton-ambiental-production.up.railway.app'

interface ReefMapProps {
  apiUrl?: string
  height?: number
}

export default function ReefMap({
  apiUrl  = `${_API_BASE}/reefs`,
  height  = 500,
}: ReefMapProps) {
  const { stations, loading, error } = useReefStations(apiUrl)

  if (loading) return <p style={{ color: '#9fb8d8' }}>Cargando estaciones...</p>
  if (error)   return <p style={{ color: '#e74c3c' }}>Error: {error}</p>

  return (
    <MapContainer
      center={[16, -86]}
      zoom={6}
      style={{ height, width: '100%', borderRadius: 12 }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />

      {stations.map(station => (
        <CircleMarker
          key={station.slug}
          center={station.coords}
          radius={10 + station.dhw * 1.5}
          pathOptions={{
            color:       alertColor(station.alert_level),
            fillColor:   alertColor(station.alert_level),
            fillOpacity: 0.75,
            weight:      2,
          }}
        >
          <Tooltip>
            <strong>{station.name}</strong><br />
            SST: {station.current_sst}°C<br />
            DHW: {station.dhw}<br />
            Estado: {ALERT_LABELS[station.alert_level] ?? '–'}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
