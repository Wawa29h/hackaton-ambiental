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

// Paso 1: determina el semáforo según DHW
function getEstadoZona(dhw) {
  if (dhw > 8) return { color: '#ef4444', label: 'VEDA',      permitida: false, maxLanchas: 0,  descripcion: 'Coral en blanqueamiento severo — zona cerrada para recuperación.' }
  if (dhw > 4) return { color: '#f97316', label: 'LIMITADA',  permitida: true,  maxLanchas: 3,  descripcion: 'Coral bajo estrés. Solo pesca de altura, sin buceo ni ancla en coral.' }
  if (dhw > 1) return { color: '#fbbf24', label: 'MODERADA',  permitida: true,  maxLanchas: 6,  descripcion: 'Estrés térmico leve. Pesca moderada permitida, evitar zonas someras.' }
  return         { color: '#34d399', label: 'PERMITIDA', permitida: true,  maxLanchas: 10, descripcion: 'Coral sano. Pesca responsable permitida — ancla solo en arena.' }
}

// Paso 2: calcula coordenadas del sotavento desde el arrecife y el viento
// windDirGrados = de dónde viene el viento (86° = del Este)
// distKm = qué tan lejos del arrecife colocar la zona segura
function calcularSotavento(lat, lon, windDirGrados, distKm = 9) {
  // Sotavento = dirección OPUESTA al viento
  const sotaventoDirRad = ((windDirGrados + 180) % 360) * (Math.PI / 180)
  const gradosPorKm = 1 / 111
  return [
    lat + Math.cos(sotaventoDirRad) * distKm * gradosPorKm,
    lon + Math.sin(sotaventoDirRad) * distKm * gradosPorKm,
  ]
}

// Paso 3: radio de la zona según condición del viento
function calcularRadio(velocidadKmh, dhw) {
  const base = velocidadKmh < 15 ? 10000 : velocidadKmh < 30 ? 7000 : 5000
  // Si hay estrés térmico, reducir el radio (menos área explotable)
  return dhw > 4 ? base * 0.6 : base
}

// Paso 4: rotación para no repetir la misma zona dos días seguidos
// Usa el día del año para rotar entre zonas disponibles
function debeRotar(slug) {
  const dia = Math.floor(Date.now() / 86400000) // días desde epoch
  const slugs = ['honduras', 'nicaragua', 'quintana_roo', 'belize']
  const turnoHoy = dia % slugs.length
  // La zona descansa si le tocó ayer
  return slugs[(turnoHoy - 1 + slugs.length) % slugs.length] === slug
}

// Metadatos fijos por slug — solo nombre e id, coords se calculan del viento
const PESCA_META = {
  honduras:     { id: 'pesca_roatan',    nombre: 'Cordelia Banks' },
  nicaragua:    { id: 'pesca_nicaragua', nombre: 'Miskito Cays'   },
  quintana_roo: { id: 'pesca_cozumel',  nombre: 'Banco Chinchorro'},
  belize:       { id: 'pesca_belize',   nombre: 'Hol Chan'        },
}

// Fallback estático con DHW reales del último noaa.js
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

// Convierte un reef del API aplicando los 4 pasos
function reefApiAZonaPesca(reef) {
  const meta = PESCA_META[reef.slug]
  if (!meta) return null
  const v   = reef.viento ?? {}
  const d   = reef.datos  ?? {}
  const dhw = d.dhw ?? 0
  const lat = reef.coordenadas?.lat ?? 0
  const lon = reef.coordenadas?.lon ?? 0

  // Paso 2: coords calculadas desde el viento real
  const coords = v.direccion_grados != null
    ? calcularSotavento(lat, lon, v.direccion_grados)
    : [lat, lon - 0.08]  // fallback: mover al oeste

  // Paso 3: radio según viento y DHW
  const radio = calcularRadio(v.velocidad_kmh ?? 20, dhw)

  // Paso 4: rotación
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
    estado,                                           // semáforo completo
    sst:        d.sst_max != null ? `${d.sst_max}°C` : '—',
    dhw,
    cobertura:  reef.cobertura ?? null,
    viento:     v.velocidad_kmh != null
      ? `${v.direccion_cardinal ?? ''} ${v.velocidad_kmh} km/h — ${v.condicion ?? ''}`
      : '—',
    sotaventoDe: v.direccion_cardinal ?? '?',        // de dónde viene el viento
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
        width:${size}px;height:${size}px;border-radius:50%;
        background:${activo ? 'rgba(6,182,212,0.3)' : 'rgba(6,182,212,0.15)'};
        border:2px solid ${activo ? 'rgba(6,182,212,1)' : 'rgba(6,182,212,0.6)'};
        display:flex;align-items:center;justify-content:center;
        font-size:${activo ? 20 : 16}px;
        box-shadow:0 0 ${activo ? 20 : 12}px rgba(6,182,212,${activo ? 0.8 : 0.4});
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

const API_URL = import.meta.env.VITE_API_URL ?? 'https://hackaton-ambiental-production.up.railway.app'

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
    isDragging.current = true
    startX.current     = e.clientX
    startWidth.current = panelWidth
    document.body.style.cursor    = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return
      const dx        = startX.current - e.clientX          // arrastrar izq = agrandar
      const newWidth  = Math.min(Math.max(startWidth.current + dx, 320), window.innerWidth * 0.85)
      setPanelWidth(newWidth)
    }
    const onUp = () => {
      if (!isDragging.current) return
      isDragging.current             = false
      document.body.style.cursor    = ''
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
    setPanelWidth(window.innerWidth * 0.55)   // abre al 55% de la pantalla
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

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'row', height: '100vh', background: '#0a0f1e', overflow: 'hidden' }}>

      {/* ── MAPA ── */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
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

          {/* ── Zonas de pesca ── */}
          {zonasPesca.map(zona => (
            <React.Fragment key={zona.id}>
              {/* Círculo — color según semáforo DHW */}
              <Circle
                center={zona.coords}
                radius={zona.radio}
                pathOptions={{
                  color:       zona.estado?.color ?? '#06b6d4',
                  fillColor:   zona.estado?.color ?? '#06b6d4',
                  fillOpacity: zona.estado?.permitida ? 0.08 : 0.18,
                  weight:      zona.estado?.permitida ? 1.5 : 2.5,
                  dashArray:   zona.estado?.permitida ? '6 4' : '2 4',
                }}
              />
              {/* Marcador 🎣 — abre panel inferior */}
              <Marker
                position={zona.coords}
                icon={createFishIcon(pescaActiva?.id === zona.id)}
                eventHandlers={{ click: () => abrirPesca(zona) }}
              />
            </React.Fragment>
          ))}

          {/* Marcadores con brillo */}
          {ZONAS_REALES.map(zona => (
            <Marker
              key={zona.id}
              position={zona.coords}
              icon={createGlowIcon(zona.estado, zonaActiva?.id === zona.id)}
              eventHandlers={{ click: () => abrirArrecife(zona) }}
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

        {/* Indicador LIVE / LOCAL */}
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(8px)',
          border: `1px solid ${apiOnline ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}`,
          borderRadius: 6, padding: '6px 12px',
          fontSize: 11, fontFamily: 'monospace',
          color: apiOnline ? 'rgba(52,211,153,0.85)' : 'rgba(251,191,36,0.85)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: apiOnline ? '#34d399' : '#fbbf24',
            display: 'inline-block',
            animation: 'pulse 2s infinite',
            boxShadow: `0 0 6px ${apiOnline ? '#34d399' : '#fbbf24'}`,
          }} />
          {apiOnline ? 'LIVE — Predicciones NOAA/Claude' : 'LOCAL — Datos del último reporte'}
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
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 6, paddingTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#94a3b8' }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: 'transparent',
                border: '2px dashed #06b6d4',
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
            width: 6,
            flexShrink: 0,
            cursor: 'col-resize',
            background: 'transparent',
            borderLeft: `2px solid ${zonaActiva ? STATUS_COLORS[zonaActiva.estado] + '55' : 'rgba(6,182,212,0.35)'}`,
            position: 'relative',
            zIndex: 10,
            transition: 'border-color 0.2s',
          }}
          title="Arrastra para redimensionar"
        >
          {/* Grip visual */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            display: 'flex', flexDirection: 'column', gap: 3,
          }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{
                width: 2, height: 2, borderRadius: '50%',
                background: zonaActiva ? STATUS_COLORS[zonaActiva.estado] + 'aa' : 'rgba(6,182,212,0.6)',
              }} />
            ))}
          </div>
        </div>

        <div style={{
          width: panelWidth,
          display: 'flex', flexDirection: 'column',
          background: '#0a0f1e',
          overflowY: 'auto',
          flexShrink: 0,
          animation: 'slideIn 0.3s ease',
        }}>

          {/* ── PANEL ARRECIFE 3D ── */}
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

              {/* Botón cerrar — top right flotante */}
              <button
                onClick={() => setZonaActiva(null)}
                style={{
                  position: 'absolute', top: 12, right: 12, zIndex: 20,
                  background: 'rgba(10,15,30,0.7)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#94a3b8', borderRadius: 6, padding: '4px 12px',
                  cursor: 'pointer', fontSize: 12,
                }}
              >✕</button>

              {/* Badge estado — top left flotante */}
              <div style={{
                position: 'absolute', top: 12, left: 12, zIndex: 20,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{
                  background: 'rgba(10,15,30,0.75)', backdropFilter: 'blur(10px)',
                  border: `1px solid ${STATUS_COLORS[zonaActiva.estado]}44`,
                  borderRadius: 8, padding: '6px 12px',
                }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{zonaActiva.pais}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{zonaActiva.nombre}</div>
                </div>
                <span style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, alignSelf: 'flex-start',
                  background: `${STATUS_COLORS[zonaActiva.estado]}22`,
                  border: `1px solid ${STATUS_COLORS[zonaActiva.estado]}66`,
                  color: STATUS_COLORS[zonaActiva.estado],
                  backdropFilter: 'blur(8px)',
                }}>
                  {STATUS_LABELS[zonaActiva.estado]} · {zonaActiva.cobertura}% cobertura
                </span>
              </div>

              {/* Overlay datos — bottom, glass */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
                background: 'linear-gradient(to top, rgba(10,15,30,0.97) 0%, rgba(10,15,30,0.85) 70%, transparent 100%)',
                backdropFilter: 'blur(12px)',
                padding: '24px 16px 16px',
              }}>
                {/* Grid métricas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'COBERTURA',   value: `${zonaActiva.cobertura}%`,  color: STATUS_COLORS[zonaActiva.estado] },
                    { label: 'ALERT LVL',   value: '0/3',                        color: '#6366f1' },
                    { label: 'ESP. CLAVE',  value: zonaActiva.especies?.[0]?.split(' ')[1] ?? '—', color: '#38bdf8' },
                    { label: 'SALUD',       value: `${Math.round(zonaActiva.cobertura * 2.2)}%`, color: '#34d399' },
                  ].map(m => (
                    <div key={m.label} style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 8, padding: '7px 10px',
                    }}>
                      <div style={{ fontSize: 9, color: '#475569', letterSpacing: 1, marginBottom: 4 }}>{m.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Especies con barras */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: '#475569', letterSpacing: 1.5, marginBottom: 6 }}>ESPECIES DOMINANTES</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {(zonaActiva.especies ?? []).slice(0, 4).map((esp, idx) => {
                      const pct = idx === 0 ? 100 : idx === 1 ? 100 : idx === 2 ? 61 : 80
                      const barColor = ['#a855f7','#34d399','#06b6d4','#a855f7'][idx]
                      return (
                        <div key={esp}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>{esp}</span>
                            <span style={{ fontSize: 11, color: barColor, fontWeight: 600 }}>{pct}%</span>
                          </div>
                          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 0.8s ease' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Descripción */}
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                  {zonaActiva.descripcion}
                </div>
              </div>
            </div>
          )}

          {/* ── PANEL PESCA ── */}
          {pescaActiva && (
            <>
              {/* Header */}
              <div style={{
                padding: '14px 16px',
                background: `${pescaActiva.estado?.color ?? '#06b6d4'}0d`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                borderBottom: `1px solid ${pescaActiva.estado?.color ?? '#06b6d4'}22`,
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>
                    🎣 {pescaActiva.nombre}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 700,
                      background: `${pescaActiva.estado?.color}22`,
                      border: `1px solid ${pescaActiva.estado?.color}66`,
                      color: pescaActiva.estado?.color,
                    }}>
                      {pescaActiva.estado?.label}
                    </span>
                    {pescaActiva.fecha && <span style={{ fontSize: 10, color: '#475569' }}>{pescaActiva.fecha}</span>}
                  </div>
                </div>
                <button onClick={() => setPescaActiva(null)} style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#64748b', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
                }}>✕</button>
              </div>

              {/* Contenido en columna */}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Estado */}
                <div style={{
                  background: `${pescaActiva.estado?.color}0f`,
                  border: `1px solid ${pescaActiva.estado?.color}33`,
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Estado del arrecife</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: pescaActiva.estado?.color, marginBottom: 4 }}>
                    {pescaActiva.estado?.label}
                    {pescaActiva.estado?.maxLanchas > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
                        máx {pescaActiva.estado.maxLanchas} lanchas
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                    {pescaActiva.estado?.descripcion}
                  </div>
                </div>

                {/* Métricas en grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { icon: '🌡️', label: 'Temp. mar',   value: pescaActiva.sst,                                       color: '#f97316' },
                    { icon: '🔥', label: 'DHW',          value: `${pescaActiva.dhw}`,                                  color: pescaActiva.estado?.color },
                    { icon: '💨', label: 'Viento',       value: pescaActiva.viento,                                    color: '#94a3b8' },
                    { icon: '🧭', label: 'Zona segura',  value: `Sotavento ${pescaActiva.sotaventoDe ?? 'E'}`,         color: '#67e8f9' },
                  ].map(({ icon, label, value, color }) => (
                    <div key={label} style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 8, padding: '8px 10px',
                    }}>
                      <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>{icon} {label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Predicción */}
                {pescaActiva.estado?.permitida ? (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(52,211,153,0.7)', textTransform: 'uppercase' }}>
                      Predicción Claude · NOAA
                    </div>
                    <div style={{
                      background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)',
                      borderRadius: 8, padding: '10px 14px',
                      fontSize: 12, color: '#cbd5e1', lineHeight: 1.7,
                    }}>
                      {pescaActiva.prediccion}
                    </div>
                  </>
                ) : (
                  <div style={{
                    background: `${pescaActiva.estado?.color}0a`,
                    border: `1px solid ${pescaActiva.estado?.color}33`,
                    borderRadius: 8, padding: '14px',
                    fontSize: 12, color: '#e2e8f0', lineHeight: 1.7,
                  }}>
                    <strong style={{ color: pescaActiva.estado?.color, display: 'block', marginBottom: 6 }}>⛔ Zona no disponible hoy</strong>
                    <p style={{ margin: '0 0 8px' }}>{pescaActiva.estado?.descripcion}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Coral sano hoy = más pesca mañana.</p>
                  </div>
                )}

                {/* Rotación */}
                {pescaActiva.enDescanso && (
                  <div style={{
                    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: 8, padding: '10px 12px',
                    fontSize: 11, color: '#a5b4fc', lineHeight: 1.5,
                  }}>
                    🔄 Zona en descanso hoy — el sistema rota áreas para no sobrecargar el mismo arrecife dos días seguidos.
                  </div>
                )}

                {/* Educación */}
                <div style={{
                  background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)',
                  borderRadius: 8, padding: '10px 12px',
                  fontSize: 11, color: '#6ee7b7', lineHeight: 1.6,
                }}>
                  🪸 <strong>¿Por qué importa el coral?</strong> El arrecife es la guardería de los peces. Con DHW {pescaActiva.dhw} — {
                    pescaActiva.dhw < 1 ? 'el coral está sano y produciendo larvas.'
                    : pescaActiva.dhw < 4 ? 'hay estrés leve. Pesca con cuidado.'
                    : pescaActiva.dhw < 8 ? 'el coral sufre. Menos refugio = menos peces pronto.'
                    : 'el coral blanquea. La pesquería local se verá afectada.'
                  }
                </div>

                {/* Alerta */}
                {pescaActiva.alerta && (
                  <div style={{
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 8, padding: '10px 12px',
                    fontSize: 11, color: '#fca5a5', lineHeight: 1.5,
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
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes slideIn {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
