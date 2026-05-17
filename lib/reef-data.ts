export interface ReefZone {
  id: string
  title: string
  country: string
  location: {
    city: string
    country: string
    lat: number
    lng: number
  }
  color: "teal" | "emerald" | "cyan" | "blue"
}

export const reefZones: ReefZone[] = [
  {
    id: "belize",
    title: "Hol Chan Marine Reserve",
    country: "Belize",
    location: { city: "San Pedro", country: "Belize", lat: 17.025, lng: -88.075 },
    color: "teal",
  },
  {
    id: "honduras",
    title: "Roatán — Cordelia Banks",
    country: "Honduras",
    location: { city: "Roatán", country: "Honduras", lat: 16.32, lng: -86.535 },
    color: "emerald",
  },
  {
    id: "nicaragua",
    title: "Cayos Miskitos",
    country: "Nicaragua",
    location: { city: "Puerto Cabezas", country: "Nicaragua", lat: 14.38, lng: -82.78 },
    color: "cyan",
  },
  {
    id: "mexico",
    title: "Banco Chinchorro",
    country: "México",
    location: { city: "Mahahual", country: "México", lat: 18.75, lng: -87.34 },
    color: "blue",
  },
  {
    id: "el_salvador",
    title: "Los Cóbanos",
    country: "El Salvador",
    location: { city: "Sonsonate", country: "El Salvador", lat: 13.524, lng: -89.807 },
    color: "teal",
  },
]
