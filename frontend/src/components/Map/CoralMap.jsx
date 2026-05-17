import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Circle, useMap } from 'react-leaflet'
import { useState, useEffect, useRef, useCallback } from 'react'
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

// ── Design tokens industriales ──────────────────────────────────────────────
const MONO = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace"
const BG0  = '#020617'   // fondo base
const BG1  = '#070a13'   // cards/panels
const BG2  = '#0b1120'   // overlays
const BORDER = 'rgba(30,41,59,0.9)'   // slate-800

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

// ─── Lógica de zona de pesca responsable ────────────────────────────────────
function getEstadoZona(dhw) {
  if (dhw > 8) return { color: '#ef4444', label: 'VEDA',      permitida: false, maxLanchas: 0,  descripcion: 'Coral en blanqueamiento severo — zona cerrada para recuperación.' }
  if (dhw > 4) return { color: '#f97316', label: 'LIMITADA',  permitida: true,  maxLanchas: 3,  descripcion: 'Coral bajo estrés. Solo pesca de altura, sin buceo ni ancla en coral.' }
  if (dhw > 1) return { color: '#fbbf24', label: 'MODERADA',  permitida: true,  maxLanchas: 6,  descripcion: 'Estrés térmico leve. Pesca moderada permitida, evitar zonas someras.' }
  return         { color: '#34d399', label: 'PERMITIDA', permitida: true,  maxLanchas: 10, descripcion: 'Coral sano. Pesca responsable permitida — ancla solo en arena.' }
}

function calcularSotavento(lat, lon, windDirGrados, distKm = 9) {
  const sotaventoDirRad = ((windDirGrados + 180) % 360) * (Math.PI / 180)
  const gradosPorKm = 1 / 111
  return [
    lat + Math.cos(sotaventoDirRad) * distKm * gradosPorKm,
    lon + Math.sin(sotaventoDirRad) * distKm * gradosPorKm,
  ]
}

function calcularRadio(velocidadKmh, dhw) {
  const base = velocidadKmh < 15 ? 10000 : velocidadKmh < 30 ? 7000 : 5000
  return dhw > 4 ? base * 0.6 : base
}

function debeRotar(slug) {
  const dia = Math.floor(Date.now() / 86400000)
  const slugs = ['honduras', 'nicaragua', 'quintana_roo', 'belize']
  const turnoHoy = dia % slugs.length
  return slugs[(turnoHoy - 1 + slugs.length) % slugs.length] === slug
}

const PESCA_META = {
  honduras:     { id: 'pesca_roatan',    nombre: 'Cordelia Banks' },
  nicaragua:    { id: 'pesca_nicaragua', nombre: 'Miskito Cays'   },
  quintana_roo: { id: 'pesca_cozumel',  nombre: 'Banco Chinchorro'},
  belize:       { id: 'pesca_belize',   nombre: 'Hol Chan'        },
}

const ZONAS_PESCA_FALLBACK = [
  { id: 'pesca_roatan',    nombre: 'Cordelia Banks', coords: [16.318, -86.620], radio: 6000, sst: '30.3°C', dhw: 0.83, viento: 'E 37 km/h', enDescanso: false,
    prediccion: 'Salida 5:00–6:00 AM. Lado oeste de Cordelia Banks, 15–25 m, usando el arrecife como barrera contra viento E. Retornar antes de 2:00 PM.',
    alerta: 'Cordelia Banks superó umbral de blanqueamiento. Protege zonas de reproducción.' },
  { id: 'pesca_nicaragua', nombre: 'Miskito Cays',   coords: [14.375, -82.830], radio: 7000, sst: '29.9°C', dhw: 2.15, viento: 'E 35.5 km/h', enDescanso: false,
    prediccion: 'Salida 4:30–5:00 AM. Zonas protegidas al OESTE de los cayos, 8–15 m. Langosta Espinosa en arrecifes someros del lado occidental.',
    alerta: 'DHW 2.15 — estrés térmico nivel 2. Riesgo de blanqueamiento en aumento.' },
  { id: 'pesca_cozumel',   nombre: 'Banco Chinchorro',coords: [18.760, -87.380], radio: 8000, sst: '30.2°C', dhw: 0.92, viento: 'E 22.9 km/h', enDescanso: false,
    prediccion: 'Salida 5:30–6:00 AM desde Mahahual. Cara oeste del atolón, 8–15 m. Pez Loro Gigante en arrecifes someros.',
    alerta: 'Agua rebasa 30°C y sigue subiendo. Reporta colonias pálidas al CONANP.' },
  { id: 'pesca_belize',    nombre: 'Hol Chan',        coords: [17.728, -87.570], radio: 5000, sst: '30.9°C', dhw: 0.33, viento: 'E 27.3 km/h', enDescanso: false,
    prediccion: 'Salida 5:30–6:00 AM. Oeste de Hol Chan (sotavento), 8–12 m en pastos marinos.',
    alerta: 'Hol Chan en estrés térmico con DHW subiendo. Evita anclar en coral vivo.' },
]

function reefApiAZonaPesca(reef) {
  const meta = PESCA_META[reef.slug]
  if (!meta) return null
  const v   = reef.viento ?? {}
  const d   = reef.datos  ?? {}
  const dhw = d.dhw ?? 0
  const lat = reef.coordenadas?.lat ?? 0
  const lon = reef.coordenadas?.lon ?? 0
  const coords = v.direccion_grados != null
    ? calcularSotavento(lat, lon, v.direccion_grados)
    : [lat, lon - 0.08]
  const radio = calcularRadio(v.velocidad_kmh ?? 20, dhw)
  const enDescanso = debeRotar(reef.slug)
  const estado = enDescanso
    ? { color: '#6366f1', label: 'DESCANSO', permitida: false, maxLanchas: 0, descripcion: 'Esta zona descansa hoy para permitir recuperación del arrecife. Prueba otra zona.' }
    : getEstadoZona(dhw)
  return {
    id:         meta.id,
    nombre:     meta.nombre,
    coords,
    radio,
    enDescanso,
    estado,
    sst:        d.sst_max != null ? `${d.sst_max}°C` : '—',
    dhw,
    cobertura:  reef.cobertura ?? null,
    viento:     v.velocidad_kmh != null
      ? `${v.direccion_cardinal ?? ''} ${v.velocidad_kmh} km/h — ${v.condicion ?? ''}`
      : '—',
    sotaventoDe: v.direccion_cardinal ?? '?',
    prediccion:  reef.predictions?.pesca  ?? 'Sin predicción disponible.',
    alerta:      reef.predictions?.alerta ?? '',
    blanqueamiento: reef.predictions?.blanqueamiento ?? '',
    fecha:       reef.fecha ?? '',
  }
}

function createFishIcon(activo = false) {
  const size = activo ? 38 : 32
  return L.divIcon({
    className: '',
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    html: `
      <div style="
        width:${size}px;height:${size}px;
        background:${activo ? 'rgba(6,182,212,0.25)' : 'rgba(6,182,212,0.1)'};
        border:1px solid ${activo ? 'rgba(6,182,212,0.9)' : 'rgba(6,182,212,0.5)'};
        display:flex;align-items:center;justify-content:center;
        font-size:${activo ? 20 : 16}px;
        box-shadow:0 0 ${activo ? 16 : 8}px rgba(6,182,212,${activo ? 0.5 : 0.2});
      ">🎣</div>
    `,
  })
}

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
  const size  = activo ? 34 : 26
  const inner = activo ? 14 : 10
  // Square industrial marker instead of circle
  return L.divIcon({
    className: '',
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border:1px solid ${color};opacity:0.4;animation:pulse 2s infinite;"></div>
        <div style="width:${inner}px;height:${inner}px;background:${color};box-shadow:0 0 10px ${color},0 0 20px ${color}44;"></div>
      </div>
    `,
  })
}

function MapReady() {
  const map = useMap()
  useEffect(() => { setTimeout(() => map.invalidateSize(), 100) }, [map])
  return null
}

const API_URL = import.meta.env.VITE_API_URL ?? 'https://hackaton-ambiental-production.up.railway.app'

// ── Componentes internos de UI industrial ────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: '#334155',
      textTransform: 'uppercase', marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {children}
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  )
}

function MetricBox({ label, value, color }) {
  return (
    <div style={{
      background: BG1,
      border: `1px solid ${BORDER}`,
      padding: '8px 10px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: color + '66' }} />
      <div style={{ fontFamily: MONO, fontSize: 9, color: '#334155', letterSpacing: '0.18em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

export default function CoralMap() {
  const [zonaActiva,   setZonaActiva]   = useState(null)
  const [pescaActiva,  setPescaActiva]  = useState(null)
  const [reefGeoJson,  setReefGeoJson]  = useState(null)
  const [zonasPesca,   setZonasPesca]   = useState(ZONAS_PESCA_FALLBACK)
  const [apiOnline,    setApiOnline]    = useState(false)
  const [panelWidth,   setPanelWidth]   = useState(420)
  const isDragging   = useRef(false)
  const startX       = useRef(0)
  const startWidth   = useRef(0)
  const containerRef = useRef(null)

  // Drag-to-resize handlers
  const onDragStart = useCallback((e) => {
    isDragging.current  = true
    startX.current      = e.clientX
    startWidth.current  = panelWidth
    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return
      const dx       = startX.current - e.clientX
      const newWidth = Math.min(Math.max(startWidth.current + dx, 320), window.innerWidth * 0.85)
      setPanelWidth(newWidth)
    }
    const onUp = () => {
      if (!isDragging.current) return
      isDragging.current             = false
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  function abrirPesca(zona)  {
    setPescaActiva(zona)
    setZonaActiva(null)
    setPanelWidth(420)
  }
  function abrirArrecife(z)  {
    setZonaActiva(z)
    setPescaActiva(null)
    setPanelWidth(window.innerWidth * 0.55)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/data/Mesoamerica.geojson')
      .then(res => { if (!res.ok) throw new Error(res.status); return res.json() })
      .then(data => { if (!cancelled) setReefGeoJson(data) })
      .catch(err => console.warn('[CoralMap] GeoJSON no cargó:', err))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_URL}/reefs`)
      .then(res => { if (!res.ok) throw new Error(res.status); return res.json() })
      .then(data => {
        if (cancelled) return
        const zonas = data.map(reefApiAZonaPesca).filter(Boolean)
        if (zonas.length > 0) { setZonasPesca(zonas); setApiOnline(true) }
      })
      .catch(() => console.info('[CoralMap] Backend no disponible, usando datos locales.'))
    return () => { cancelled = true }
  }, [])

  const panelAbierto = zonaActiva || pescaActiva
  const accentColor  = zonaActiva ? STATUS_COLORS[zonaActiva.estado] : '#06b6d4'

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'row', height: '100vh', background: BG0, overflow: 'hidden' }}>

      {/* ── MAPA ── */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <MapContainer
          center={[15.5, -85.0]}
          zoom={6}
          zoomControl={true}
          attributionControl={false}
          style={{ width: '100%', height: '100%', background: BG0 }}
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
              style={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.2, weight: 1.5 }}
            />
          )}

          {/* Zonas de pesca */}
          {zonasPesca.map(zona => (
            <React.Fragment key={zona.id}>
              <Circle
                center={zona.coords}
                radius={zona.radio}
                pathOptions={{
                  color:       zona.estado?.color ?? '#06b6d4',
                  fillColor:   zona.estado?.color ?? '#06b6d4',
                  fillOpacity: zona.estado?.permitida ? 0.06 : 0.15,
                  weight:      zona.estado?.permitida ? 1 : 2,
                  dashArray:   zona.estado?.permitida ? '6 4' : '2 4',
                }}
              />
              <Marker
                position={zona.coords}
                icon={createFishIcon(pescaActiva?.id === zona.id)}
                eventHandlers={{ click: () => abrirPesca(zona) }}
              />
            </React.Fragment>
          ))}

          {/* Marcadores arrecifes */}
          {ZONAS_REALES.map(zona => (
            <Marker
              key={zona.id}
              position={zona.coords}
              icon={createGlowIcon(zona.estado, zonaActiva?.id === zona.id)}
              eventHandlers={{ click: () => abrirArrecife(zona) }}
            >
              <Popup>
                {/* ── POPUP industrial ── */}
                <div style={{
                  background: BG1,
                  color: '#cbd5e1',
                  padding: '14px 16px',
                  border: `1px solid ${STATUS_COLORS[zona.estado]}33`,
                  borderLeft: `3px solid ${STATUS_COLORS[zona.estado]}`,
                  fontFamily: MONO,
                  minWidth: 210,
                  borderRadius: 0,
                }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: '#334155', letterSpacing: '0.2em', marginBottom: 4 }}>
                    {zona.pais.replace(/\s*[\uD800-\uDFFF]{2}/g, '').trim()}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
                    {zona.nombre}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <div style={{
                      width: 6, height: 6,
                      background: STATUS_COLORS[zona.estado],
                      flexShrink: 0,
                    }} />
                    <span style={{ fontFamily: MONO, fontSize: 9, color: STATUS_COLORS[zona.estado], letterSpacing: '0.15em' }}>
                      {STATUS_LABELS[zona.estado].toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px', fontFamily: MONO, fontSize: 10, color: '#475569', marginBottom: 10 }}>
                    <span>COBERTURA</span>
                    <span style={{ color: STATUS_COLORS[zona.estado], fontWeight: 700 }}>{zona.cobertura}%</span>
                    <span>OCÉANO</span>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>{zona.ocean?.toUpperCase()}</span>
                  </div>
                  <div style={{
                    borderTop: `1px solid ${BORDER}`,
                    paddingTop: 8, marginBottom: 10,
                    fontFamily: MONO, fontSize: 9, color: '#334155', lineHeight: 1.6,
                  }}>
                    {zona.descripcion}
                  </div>
                  <button
                    onClick={() => setZonaActiva(zona)}
                    style={{
                      width: '100%', padding: '7px 0',
                      background: `${STATUS_COLORS[zona.estado]}12`,
                      border: `1px solid ${STATUS_COLORS[zona.estado]}44`,
                      borderRadius: 0, cursor: 'pointer',
                      color: STATUS_COLORS[zona.estado],
                      fontFamily: MONO, fontWeight: 700, fontSize: 10,
                      letterSpacing: '0.15em', textTransform: 'uppercase',
                    }}
                  >
                    VER ARRECIFE 3D →
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* ── HUD superior izquierdo: LIVE indicator ── */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 8,
          background: BG1,
          border: `1px solid ${apiOnline ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'}`,
          borderLeft: `2px solid ${apiOnline ? '#34d399' : '#fbbf24'}`,
          padding: '6px 12px',
          fontFamily: MONO, fontSize: 10,
          color: apiOnline ? '#34d399' : '#fbbf24',
          letterSpacing: '0.1em',
        }}>
          <span style={{
            width: 6, height: 6,
            background: apiOnline ? '#34d399' : '#fbbf24',
            display: 'inline-block',
            animation: 'blink 1.4s step-start infinite',
          }} />
          {apiOnline ? 'LIVE // NOAA · CLAUDE·AI' : 'CACHE // ÚLTIMO REPORTE'}
        </div>

        {/* ── HUD inferior izquierdo: coords ── */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
          background: BG1, border: `1px solid ${BORDER}`,
          padding: '5px 10px',
          fontFamily: MONO, fontSize: 10, color: '#334155', letterSpacing: '0.08em',
        }}>
          15.50°N · 85.00°W · Z6
        </div>

        {/* ── Leyenda inferior derecha ── */}
        <div style={{
          position: 'absolute', bottom: 12, right: panelAbierto ? 0 : 12, zIndex: 1000,
          background: BG1, border: `1px solid ${BORDER}`,
          borderLeft: '2px solid rgba(52,211,153,0.2)',
          padding: '10px 14px',
          transition: 'right 0.3s ease',
        }}>
          <p style={{
            margin: '0 0 8px', fontFamily: MONO, fontSize: 9,
            fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(52,211,153,0.5)',
            textTransform: 'uppercase',
          }}>
            RIESGO DE BLANQUEAMIENTO
          </p>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 10, color: '#475569', marginBottom: 5 }}>
              <span style={{
                width: 8, height: 8,
                background: STATUS_COLORS[key],
                display: 'inline-block', flexShrink: 0,
              }} />
              {label}
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 6, paddingTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 10, color: '#475569' }}>
              <span style={{
                width: 8, height: 8,
                background: 'transparent',
                border: '1px dashed #06b6d4',
                display: 'inline-block', flexShrink: 0,
              }} />
              Zona de Pesca
            </div>
          </div>
        </div>
      </div>

      {/* ── PANEL LATERAL DERECHO ── */}
      {panelAbierto && (
        <>
          {/* Handle de resize */}
          <div
            onMouseDown={onDragStart}
            style={{
              width: 4,
              flexShrink: 0,
              cursor: 'col-resize',
              background: 'transparent',
              borderLeft: `1px solid ${accentColor}44`,
              position: 'relative',
              zIndex: 10,
            }}
            title="Arrastra para redimensionar"
          >
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{
                  width: 2, height: 2,
                  background: accentColor + '88',
                }} />
              ))}
            </div>
          </div>

          <div style={{
            width: panelWidth,
            display: 'flex', flexDirection: 'column',
            background: BG0,
            overflowY: 'auto',
            flexShrink: 0,
            borderLeft: `1px solid ${BORDER}`,
            animation: 'slideIn 0.25s ease',
          }}>

            {/* ══ PANEL ARRECIFE 3D ══ */}
            {zonaActiva && (
              <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>

                {/* Visor 3D — ocupa TODO el panel */}
                <div style={{ position: 'absolute', inset: 0 }}>
                  <ReefViewer
                    zone={zonaActiva.id}
                    dhw={getDHWPorEstado(zonaActiva.estado)}
                    especies={zonaActiva.modelos ?? ESPECIES_POR_ZONA[zonaActiva.id] ?? especiesDesdeMetadata(zonaActiva)}
                    cobertura={zonaActiva.cobertura}
                    descripcion={zonaActiva.descripcion}
                  />
                </div>

                {/* Botón cerrar */}
                <button
                  onClick={() => setZonaActiva(null)}
                  style={{
                    position: 'absolute', top: 10, right: 10, zIndex: 20,
                    background: BG1, border: `1px solid ${BORDER}`,
                    color: '#475569', padding: '4px 10px',
                    cursor: 'pointer', fontFamily: MONO, fontSize: 11,
                    letterSpacing: '0.1em',
                    borderRadius: 0,
                  }}
                >✕ ESC</button>

                {/* ── Overlay datos — bottom glass ── */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
                  background: `linear-gradient(to top, ${BG0}fd 0%, ${BG0}e8 55%, transparent 100%)`,
                  backdropFilter: 'blur(12px)',
                  padding: '40px 14px 14px',
                }}>
                  {/* País + Nombre + estado */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: '#334155', letterSpacing: '0.2em', marginBottom: 4 }}>
                      {zonaActiva.pais.replace(/\s*[\uD800-\uDFFF]{2}/g, '').trim()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                        {zonaActiva.nombre}
                      </span>
                      <span style={{
                        fontFamily: MONO, fontSize: 9, padding: '3px 8px',
                        background: `${STATUS_COLORS[zonaActiva.estado]}12`,
                        border: `1px solid ${STATUS_COLORS[zonaActiva.estado]}44`,
                        borderRadius: 0,
                        color: STATUS_COLORS[zonaActiva.estado],
                        letterSpacing: '0.15em', fontWeight: 700, textTransform: 'uppercase',
                      }}>
                        {STATUS_LABELS[zonaActiva.estado]}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: MONO, fontSize: 9,
                      color: STATUS_COLORS[zonaActiva.estado],
                      background: `${STATUS_COLORS[zonaActiva.estado]}0e`,
                      borderLeft: `2px solid ${STATUS_COLORS[zonaActiva.estado]}`,
                      padding: '3px 8px', display: 'inline-block',
                      letterSpacing: '0.12em',
                    }}>
                      {STATUS_LABELS[zonaActiva.estado].toUpperCase()} · {zonaActiva.cobertura}% COBERTURA
                    </div>
                  </div>

                  {/* Grid métricas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 12 }}>
                    {[
                      { label: 'COBERTURA',  value: `${zonaActiva.cobertura}%`,                               color: STATUS_COLORS[zonaActiva.estado] },
                      { label: 'ALERT LVL',  value: '0/3',                                                    color: '#6366f1' },
                      { label: 'ESP. CLAVE', value: zonaActiva.especies?.[0]?.split(' ').pop() ?? '—',         color: '#38bdf8' },
                      { label: 'SALUD',      value: `${Math.round(zonaActiva.cobertura * 2.2)}%`,              color: '#34d399' },
                    ].map(m => (
                      <MetricBox key={m.label} {...m} />
                    ))}
                  </div>

                  {/* Especies */}
                  <SectionLabel>ESPECIES DOMINANTES</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {(zonaActiva.especies ?? []).slice(0, 4).map((esp, idx) => {
                      const pct      = [100, 100, 61, 80][idx] ?? 70
                      const barColor = ['#a855f7', '#34d399', '#06b6d4', '#a855f7'][idx]
                      return (
                        <div key={esp}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'center' }}>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>{esp}</span>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: barColor, fontWeight: 700 }}>{pct}%</span>
                          </div>
                          <div style={{ height: 2, background: 'rgba(255,255,255,0.05)' }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
                              transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
                            }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Descripción */}
                  <div style={{
                    fontFamily: MONO, fontSize: 10, color: '#334155', lineHeight: 1.7,
                    borderTop: `1px solid ${BORDER}`, paddingTop: 8,
                  }}>
                    {zonaActiva.descripcion}
                  </div>
                </div>
              </div>
            )}

            {/* ══ PANEL PESCA ══ */}
            {pescaActiva && (
              <>
                {/* Header */}
                <div style={{
                  padding: '12px 14px',
                  background: BG1,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  borderBottom: `1px solid ${BORDER}`,
                  flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: '#334155', letterSpacing: '0.2em' }}>ZONA DE PESCA</span>
                    </div>
                    <span style={{ fontFamily: MONO, fontWeight: 700, color: '#f1f5f9', fontSize: 15, letterSpacing: '-0.01em' }}>
                      🎣 {pescaActiva.nombre}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: MONO, fontSize: 9, padding: '2px 8px',
                        background: `${pescaActiva.estado?.color}12`,
                        border: `1px solid ${pescaActiva.estado?.color}44`,
                        color: pescaActiva.estado?.color,
                        letterSpacing: '0.15em', fontWeight: 700, textTransform: 'uppercase',
                      }}>
                        {pescaActiva.estado?.label}
                      </span>
                      {pescaActiva.fecha && (
                        <span style={{ fontFamily: MONO, fontSize: 9, color: '#334155' }}>{pescaActiva.fecha}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setPescaActiva(null)} style={{
                    background: 'transparent', border: `1px solid ${BORDER}`,
                    color: '#334155', padding: '4px 10px', cursor: 'pointer',
                    fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em',
                    borderRadius: 0,
                  }}>✕</button>
                </div>

                {/* Cuerpo pesca */}
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

                  {/* Estado del arrecife */}
                  <div style={{
                    background: `${pescaActiva.estado?.color}08`,
                    borderLeft: `2px solid ${pescaActiva.estado?.color}`,
                    padding: '10px 12px',
                  }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: '#334155', letterSpacing: '0.18em', marginBottom: 5, textTransform: 'uppercase' }}>Estado del arrecife</div>
                    <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: pescaActiva.estado?.color, marginBottom: 4 }}>
                      {pescaActiva.estado?.label}
                      {pescaActiva.estado?.maxLanchas > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 400, color: '#475569', marginLeft: 10 }}>
                          MÁX {pescaActiva.estado.maxLanchas} LANCHAS
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: '#475569', lineHeight: 1.7 }}>
                      {pescaActiva.estado?.descripcion}
                    </div>
                  </div>

                  {/* Métricas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {[
                      { icon: '🌡️', label: 'TEMP. MAR',  value: pescaActiva.sst,                          color: '#f97316' },
                      { icon: '🔥', label: 'DHW',         value: `${pescaActiva.dhw}`,                     color: pescaActiva.estado?.color },
                      { icon: '💨', label: 'VIENTO',      value: pescaActiva.viento,                       color: '#94a3b8' },
                      { icon: '🧭', label: 'ZONA SEGURA', value: `Sotavento ${pescaActiva.sotaventoDe ?? 'E'}`, color: '#67e8f9' },
                    ].map(({ icon, label, value, color }) => (
                      <div key={label} style={{
                        background: BG1, border: `1px solid ${BORDER}`,
                        padding: '8px 10px',
                      }}>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: '#334155', letterSpacing: '0.15em', marginBottom: 4 }}>
                          {icon} {label}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Predicción */}
                  {pescaActiva.estado?.permitida ? (
                    <>
                      <SectionLabel>PREDICCIÓN CLAUDE · NOAA</SectionLabel>
                      <div style={{
                        background: 'rgba(6,182,212,0.04)',
                        borderLeft: '2px solid rgba(6,182,212,0.3)',
                        padding: '10px 12px',
                        fontFamily: MONO, fontSize: 11, color: '#94a3b8', lineHeight: 1.8,
                      }}>
                        {pescaActiva.prediccion}
                      </div>
                    </>
                  ) : (
                    <div style={{
                      background: `${pescaActiva.estado?.color}06`,
                      borderLeft: `2px solid ${pescaActiva.estado?.color}`,
                      padding: '12px',
                      fontFamily: MONO, fontSize: 11, color: '#e2e8f0', lineHeight: 1.7,
                    }}>
                      <strong style={{ color: pescaActiva.estado?.color, display: 'block', marginBottom: 6, letterSpacing: '0.1em', fontSize: 10 }}>
                        ⛔ ZONA NO DISPONIBLE HOY
                      </strong>
                      <p style={{ margin: '0 0 6px', color: '#64748b' }}>{pescaActiva.estado?.descripcion}</p>
                      <p style={{ margin: 0, fontSize: 10, color: '#334155' }}>Coral sano hoy = más pesca mañana.</p>
                    </div>
                  )}

                  {/* Rotación */}
                  {pescaActiva.enDescanso && (
                    <div style={{
                      background: 'rgba(99,102,241,0.06)',
                      borderLeft: '2px solid rgba(99,102,241,0.4)',
                      padding: '10px 12px',
                      fontFamily: MONO, fontSize: 10, color: '#a5b4fc', lineHeight: 1.7,
                    }}>
                      🔄 Zona en descanso hoy — rotación automática para no sobrecargar el mismo arrecife dos días seguidos.
                    </div>
                  )}

                  {/* Educación */}
                  <div style={{
                    background: 'rgba(52,211,153,0.03)',
                    borderLeft: '2px solid rgba(52,211,153,0.2)',
                    padding: '10px 12px',
                    fontFamily: MONO, fontSize: 10, color: '#6ee7b7', lineHeight: 1.7,
                  }}>
                    🪸 DHW {pescaActiva.dhw} — {
                      pescaActiva.dhw < 1 ? 'coral sano y produciendo larvas.'
                      : pescaActiva.dhw < 4 ? 'estrés leve. Pesca con cuidado.'
                      : pescaActiva.dhw < 8 ? 'coral sufre. Menos refugio = menos peces pronto.'
                      : 'coral blanquea. La pesquería se verá afectada.'
                    }
                  </div>

                  {/* Alerta */}
                  {pescaActiva.alerta && (
                    <div style={{
                      background: 'rgba(239,68,68,0.05)',
                      borderLeft: '2px solid rgba(239,68,68,0.3)',
                      padding: '10px 12px',
                      fontFamily: MONO, fontSize: 10, color: '#fca5a5', lineHeight: 1.7,
                    }}>
                      ⚠️ {pescaActiva.alerta}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.4); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
        @keyframes slideIn {
          from { transform: translateX(30px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        .leaflet-popup-content { margin: 0 !important; }
        .leaflet-popup-tip-container { display: none !important; }
      `}</style>
    </div>
  )
}
