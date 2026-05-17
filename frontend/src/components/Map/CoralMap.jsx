import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { useState } from 'react'
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
// modelos is optional — if omitted, especiesDesdeMetadata() auto-derives the species mix.
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

function getColorEstado(estado) {
  if (estado === 'sano')     return '#2ecc71'
  if (estado === 'moderado') return '#f39c12'
  if (estado === 'riesgo')   return '#e67e22'
  return '#e74c3c'
}

function getDHWPorEstado(estado) {
  if (estado === 'sano')     return 2
  if (estado === 'moderado') return 5
  if (estado === 'riesgo')   return 9
  return 13
}

export default function CoralMap() {
  const [zonaActiva, setZonaActiva] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a1628' }}>

      {/* MAPA */}
      <div style={{ height: zonaActiva ? '45%' : '100%', transition: 'height 0.4s ease' }}>
        <MapContainer
          center={[15.5, -85.0]}
          zoom={6}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="CartoDB"
          />

          {ZONAS_REALES.map(zona => (
            <Marker
              key={zona.id}
              position={zona.coords}
              eventHandlers={{ click: () => setZonaActiva(zona) }}
            >
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <strong>{zona.nombre}</strong> — {zona.pais}<br />
                  <span style={{ color: getColorEstado(zona.estado), fontWeight: 'bold' }}>
                    Cobertura: {zona.cobertura}%
                  </span><br />
                  <small>{zona.descripcion}</small><br />
                  <button
                    onClick={() => setZonaActiva(zona)}
                    style={{
                      marginTop: 8, padding: '4px 12px',
                      background: '#2ecc71', border: 'none',
                      borderRadius: 4, cursor: 'pointer', fontWeight: 'bold'
                    }}
                  >
                    Ver arrecife 3D →
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* VISOR 3D */}
      {zonaActiva && (
        <div style={{
          height: '55%',
          borderTop: '2px solid rgba(46,204,113,0.3)',
          display: 'flex', flexDirection: 'column'
        }}>

          {/* Header */}
          <div style={{
            padding: '10px 16px', background: 'rgba(0,0,0,0.4)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <span style={{ fontWeight: 'bold', color: 'white', fontSize: 15 }}>
                🪸 {zonaActiva.nombre} — {zonaActiva.pais}
              </span>
              <span style={{ marginLeft: 12, color: getColorEstado(zonaActiva.estado), fontSize: 13 }}>
                Cobertura coralina: {zonaActiva.cobertura}%
              </span>
            </div>
            <button
              onClick={() => setZonaActiva(null)}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
                color: '#9fb8d8', borderRadius: 4, padding: '2px 10px', cursor: 'pointer'
              }}
            >
              ✕ cerrar
            </button>
          </div>

          {/* Especies */}
          <div style={{
            padding: '6px 16px', background: 'rgba(0,0,0,0.2)',
            display: 'flex', gap: 8, flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: 12, color: '#9fb8d8' }}>Especies reales:</span>
            {zonaActiva.especies.map(esp => (
              <span key={esp} style={{
                fontSize: 11, padding: '2px 8px',
                background: 'rgba(46,204,113,0.1)',
                border: '1px solid rgba(46,204,113,0.2)',
                borderRadius: 10, color: '#2ecc71', fontStyle: 'italic'
              }}>
                {esp}
              </span>
            ))}
          </div>

          {/* Fuente */}
          <div style={{ padding: '4px 16px' }}>
            <span style={{ fontSize: 11, color: '#555' }}>Fuente: {zonaActiva.fuente}</span>
          </div>

          {/* Visor 3D — especies auto-derived if modelos not set */}
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
    </div>
  )
}
