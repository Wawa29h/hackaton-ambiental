import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet'
import { useState, useEffect } from 'react'
import ReefViewer from '../ReefViewer/ReefViewer'
import { ESPECIES_POR_ZONA, especiesDesdeMetadata } from '../ReefViewer/species/index'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix icono por defecto de Leaflet con Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// To add a new reef: add one object here with id, nombre, pais, coords, cobertura,
// ocean ('pacific'|'caribbean'), depth ('shallow'|'deep'), estado, descripcion, fuente.
const ZONAS_REALES = [
  {
    id: 'los_cobanos',
    nombre: 'Los Cóbanos',
    pais: 'El Salvador 🇸🇻',
    coords: [13.524, -89.807],
    cobertura: 4,
    ocean: 'pacific',
    depth: 'shallow',
    especies: ['Porites lobata', 'Pocillopora damicornis', 'Pavona clavus'],
    estado: 'critico',
    descripcion: 'Único arrecife de El Salvador. Solo 4% de coral vivo.',
    fuente: 'MARN El Salvador / ResearchGate 2024'
  },
  {
    id: 'roatan',
    nombre: 'Roatán — Cordelia Banks',
    pais: 'Honduras 🇭🇳',
    coords: [16.320, -86.535],
    cobertura: 18,
    ocean: 'caribbean',
    depth: 'shallow',
    especies: ['Acropora cervicornis', 'Acropora palmata', 'Diploria labyrinthiformis', 'Montastraea cavernosa', 'Orbicella annularis'],
    estado: 'riesgo',
    descripcion: 'Perdió cobertura del 46% al 5% en 2024.',
    fuente: 'Roatan Marine Park / CORAL Alliance'
  },
  {
    id: 'cozumel',
    nombre: 'Cozumel',
    pais: 'México 🇲🇽',
    coords: [20.420, -86.922],
    cobertura: 22,
    ocean: 'caribbean',
    depth: 'deep',
    especies: ['Diploria labyrinthiformis', 'Orbicella annularis', 'Acropora palmata', 'Colpophyllia natans', 'Agaricia tenuifolia'],
    estado: 'moderado',
    descripcion: 'Arrecife del Caribe mexicano con alta biodiversidad.',
    fuente: 'CONANP México / CONABIO'
  },
  {
    id: 'cayos_miskitos',
    nombre: 'Cayos Miskitos',
    pais: 'Nicaragua 🇳🇮',
    coords: [14.380, -82.780],
    cobertura: 43,
    ocean: 'caribbean',
    depth: 'shallow',
    especies: ['Pseudodiploria strigosa', 'Montastraea cavernosa', 'Orbicella faveolata', 'Agaricia agaricites', 'Porites astreoides'],
    estado: 'sano',
    descripcion: 'El arrecife más saludable de Centroamérica. 43% de cobertura.',
    fuente: 'ResearchGate / MARFUND 2023'
  }
]

const STATUS_COLORS = {
  sano:     '#34d399',
  moderado: '#fbbf24',
  riesgo:   '#f97316',
  critico:  '#ef4444',
}

const STATUS_LABELS = {
  sano:     'Sano',
  moderado: 'Estrés Térmico',
  riesgo:   'En Riesgo',
  critico:  'Blanqueamiento Severo',
}

function getDHWPorEstado(estado) {
  if (estado === 'sano')     return 2
  if (estado === 'moderado') return 5
  if (estado === 'riesgo')   return 9
  return 13
}

function createGlowIcon(estado, activo = false) {
  const color = STATUS_COLORS[estado] ?? '#34d399'
  const size  = activo ? 36 : 28
  const inner = activo ? 18 : 14
  return L.divIcon({
    className: '',
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:50%;border:2px solid ${color};opacity:0.5;animation:pulse 2s infinite;"></div>
        <div style="width:${inner}px;height:${inner}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.3);box-shadow:0 0 14px ${color},0 0 28px ${color}44;"></div>
      </div>
    `,
  })
}

function MapReady() {
  const map = useMap()
  useEffect(() => { setTimeout(() => map.invalidateSize(), 100) }, [map])
  return null
}

export default function CoralMap() {
  const [zonaActiva, setZonaActiva]   = useState(null)
  const [reefGeoJson, setReefGeoJson] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/data/Mesoamerica.geojson')
      .then(res => { if (!res.ok) throw new Error(res.status); return res.json() })
      .then(data => { if (!cancelled) setReefGeoJson(data) })
      .catch(err => console.warn('[CoralMap] GeoJSON no cargó:', err))
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0f1e' }}>

      {/* ── MAPA ── */}
      <div style={{ height: zonaActiva ? '45%' : '100%', transition: 'height 0.4s ease', position: 'relative' }}>
        <MapContainer
          center={[15.5, -85.0]}
          zoom={6}
          zoomControl={true}
          attributionControl={false}
          style={{ width: '100%', height: '100%', background: '#0a0f1e' }}
        >
          <MapReady />

          {/* Tiles satélite Esri (igual que el mapa de la amiga) */}
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

          {/* GeoJSON del arrecife mesoamericano */}
          {reefGeoJson && (
            <GeoJSON
              data={reefGeoJson}
              style={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.25, weight: 1.5 }}
            />
          )}

          {/* Marcadores con brillo */}
          {ZONAS_REALES.map(zona => (
            <Marker
              key={zona.id}
              position={zona.coords}
              icon={createGlowIcon(zona.estado, zonaActiva?.id === zona.id)}
              eventHandlers={{ click: () => setZonaActiva(zona) }}
            >
              <Popup>
                <div style={{
                  background: 'rgba(10,15,30,0.97)',
                  color: '#e2e8f0',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: `1px solid ${STATUS_COLORS[zona.estado]}33`,
                  fontFamily: 'system-ui, sans-serif',
                  minWidth: 200,
                  boxShadow: `0 0 20px ${STATUS_COLORS[zona.estado]}22`,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#f1f5f9' }}>
                    {zona.nombre}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: STATUS_COLORS[zona.estado],
                      display: 'inline-block',
                      boxShadow: `0 0 6px ${STATUS_COLORS[zona.estado]}`,
                    }} />
                    {STATUS_LABELS[zona.estado]}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11, color: '#94a3b8' }}>
                    <span>Cobertura:</span>
                    <span style={{ color: STATUS_COLORS[zona.estado], fontWeight: 600 }}>{zona.cobertura}%</span>
                    <span>País:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{zona.pais}</span>
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(148,163,184,0.15)', fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>
                    {zona.descripcion}
                  </div>
                  <button
                    onClick={() => setZonaActiva(zona)}
                    style={{
                      marginTop: 10, width: '100%', padding: '6px 0',
                      background: `${STATUS_COLORS[zona.estado]}22`,
                      border: `1px solid ${STATUS_COLORS[zona.estado]}55`,
                      borderRadius: 6, cursor: 'pointer',
                      color: STATUS_COLORS[zona.estado], fontWeight: 700, fontSize: 12,
                    }}
                  >
                    Ver arrecife 3D →
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Indicador LIVE */}
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(52,211,153,0.2)',
          borderRadius: 6, padding: '6px 12px',
          fontSize: 11, fontFamily: 'monospace', color: 'rgba(52,211,153,0.85)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#34d399', display: 'inline-block',
            animation: 'pulse 2s infinite',
            boxShadow: '0 0 6px #34d399',
          }} />
          LIVE — Arrecife Mesoamericano
        </div>

        {/* Coordenadas */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
          background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6, padding: '5px 10px',
          fontSize: 11, fontFamily: 'monospace', color: '#64748b',
        }}>
          15.50°N, 85.00°W · Zoom 6
        </div>

        {/* Leyenda */}
        <div style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 1000,
          background: 'rgba(10,15,30,0.9)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(52,211,153,0.15)',
          borderRadius: 8, padding: '10px 14px',
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'rgba(52,211,153,0.7)', textTransform: 'uppercase' }}>
            Riesgo de Blanqueamiento
          </p>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: STATUS_COLORS[key],
                boxShadow: `0 0 8px ${STATUS_COLORS[key]}88`,
                display: 'inline-block', flexShrink: 0,
              }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── VISOR 3D ── */}
      {zonaActiva && (
        <div style={{
          height: '55%',
          borderTop: `2px solid ${STATUS_COLORS[zonaActiva.estado]}44`,
          display: 'flex', flexDirection: 'column',
          background: '#0a0f1e',
        }}>

          {/* Header */}
          <div style={{
            padding: '10px 16px',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>
                🪸 {zonaActiva.nombre} — {zonaActiva.pais}
              </span>
              <span style={{
                fontSize: 11, padding: '2px 10px',
                background: `${STATUS_COLORS[zonaActiva.estado]}18`,
                border: `1px solid ${STATUS_COLORS[zonaActiva.estado]}44`,
                borderRadius: 20, color: STATUS_COLORS[zonaActiva.estado], fontWeight: 600,
              }}>
                {STATUS_LABELS[zonaActiva.estado]} · {zonaActiva.cobertura}% cobertura
              </span>
            </div>
            <button
              onClick={() => setZonaActiva(null)}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                color: '#64748b', borderRadius: 4, padding: '3px 10px',
                cursor: 'pointer', fontSize: 12,
              }}
            >
              ✕ cerrar
            </button>
          </div>

          {/* Especies */}
          <div style={{
            padding: '6px 16px', background: 'rgba(0,0,0,0.2)',
            display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: '#475569' }}>Especies:</span>
            {zonaActiva.especies.map(esp => (
              <span key={esp} style={{
                fontSize: 10, padding: '2px 8px',
                background: 'rgba(52,211,153,0.08)',
                border: '1px solid rgba(52,211,153,0.2)',
                borderRadius: 10, color: '#34d399', fontStyle: 'italic',
              }}>
                {esp}
              </span>
            ))}
            <span style={{ fontSize: 10, color: '#334155', marginLeft: 4 }}>
              · {zonaActiva.fuente}
            </span>
          </div>

          {/* Visor 3D */}
          <div style={{ flex: 1 }}>
            <ReefViewer
              zone={zonaActiva.id}
              dhw={getDHWPorEstado(zonaActiva.estado)}
              especies={
                zonaActiva.modelos ??
                ESPECIES_POR_ZONA[zonaActiva.id] ??
                especiesDesdeMetadata(zonaActiva)
              }
              cobertura={zonaActiva.cobertura}
              descripcion={zonaActiva.descripcion}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
