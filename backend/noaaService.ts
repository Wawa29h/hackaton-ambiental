// Estaciones del Caribe Occidental / Mesoamérica
const SLUGS_MESOAMERICA = [
  'belize',
  'honduras',
  'nicaragua',
  'quintana_roo',
  'costa_rica_atlantic',
  'panama_atlantic_east',
  'panama_atlantic_west',
  'cayman_islands',
  'jamaica',
]

const BASE_URL = 'https://api.coral.tsr.lol/stations'

export interface ReefStation {
  slug:        string
  name:        string
  latitude:    number
  longitude:   number
  current_sst: number
  dhw:         number
  alert_level: number   // 0-4 escala NOAA CRW
  stress_level: number
  coords:      [number, number]  // [lat, lng] para Leaflet
}

function noaaAlertLevel(dhw: number, stressLevel: number): number {
  if (dhw === 0 && stressLevel === 0) return 0
  if (stressLevel === 1)              return 1
  if (dhw < 4)                        return 2
  if (dhw < 8)                        return 3
  return 4
}

async function fetchStation(slug: string): Promise<ReefStation | null> {
  try {
    const res  = await fetch(`${BASE_URL}/${slug}/current`)
    const data = await res.json()
    return {
      slug,
      name:         data.name,
      latitude:     data.latitude,
      longitude:    data.longitude,
      current_sst:  data.current.sst_max,
      dhw:          data.current.dhw,
      stress_level: data.current.stress_level,
      alert_level:  noaaAlertLevel(data.current.dhw, data.current.stress_level),
      coords:       [data.latitude, data.longitude],
    }
  } catch {
    return null
  }
}

export async function getMesoamericanReefs(): Promise<ReefStation[]> {
  const results = await Promise.all(SLUGS_MESOAMERICA.map(fetchStation))
  return results.filter((r): r is ReefStation => r !== null)
}
