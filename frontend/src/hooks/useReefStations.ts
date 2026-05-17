import { useState, useEffect } from 'react'

export interface ReefStation {
  slug:         string
  name:         string
  latitude:     number
  longitude:    number
  current_sst:  number
  dhw:          number
  alert_level:  number
  stress_level: number
  coords:       [number, number]
}

const ALERT_COLORS: Record<number, string> = {
  0: '#2ecc71',   // sin estrés
  1: '#f1c40f',   // alerta vigilancia
  2: '#f39c12',   // alerta 1
  3: '#e67e22',   // alerta 2
  4: '#e74c3c',   // blanqueamiento masivo
}

export function alertColor(level: number): string {
  return ALERT_COLORS[level] ?? '#cccccc'
}

export function useReefStations(apiUrl = 'http://localhost:3001/reefs') {
  const [stations, setStations] = useState<ReefStation[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res  = await fetch(apiUrl)
        const data = await res.json()

        // Normaliza el formato de reefs.json al formato ReefStation
        const normalized: ReefStation[] = data.map((r: any) => ({
          slug:         r.slug,
          name:         r.nombre ?? r.name,
          latitude:     r.coordenadas?.lat  ?? r.latitude,
          longitude:    r.coordenadas?.lon  ?? r.longitude,
          current_sst:  r.datos?.sst_max    ?? r.current_sst,
          dhw:          r.datos?.dhw        ?? r.dhw,
          stress_level: r.datos?.stress_level ?? r.stress_level,
          alert_level:  r.datos?.stress_level ?? r.alert_level ?? 0,
          coords:       [
            r.coordenadas?.lat ?? r.latitude,
            r.coordenadas?.lon ?? r.longitude,
          ],
        }))

        if (!cancelled) {
          setStations(normalized)
          setError(null)
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [apiUrl])

  return { stations, loading, error }
}
