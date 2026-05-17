import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Circle, useMap } from 'react-leaflet'
import { useState, useEffect, useRef, useCallback } from 'react'
import ReefViewer from '../ReefViewer/ReefViewer'
import { ESPECIES_POR_ZONA, especiesDesdeMetadata } from '../ReefViewer/species/index'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Design tokens ────────────────────────────────────────────────────────────
const FONT_SANS = "'Outfit', system-ui, sans-serif"
const FONT_DATA = "'Inter', system-ui, sans-serif"
const BG0   = '#06111e'
const BG1   = 'rgba(11, 26, 46, 0.7)'
const BG2   = 'rgba(255, 255, 255, 0.05)'
const B     = '1px solid rgba(255,255,255,0.08)'  // border glass

// ── Datos base de arrecifes (datos biológicos fijos + fallback) ──────────────
// Los campos dinámicos (estado, dhw, sst, predicciones) se sobreescriben con la API
const ZONAS_BASE = [
  { id: 'los_cobanos',    nombre: 'Los Cóbanos',             pais: 'El Salvador', coords: [13.524,-89.807], cobertura: 4,  ocean:'pacific',   depth:'shallow', especies:['Porites lobata','Pocillopora damicornis','Pavona clavus'],                                                                          estado:'critico',  dhw:0,   sst:null, descripcion:'Único arrecife de El Salvador. Solo 4% de coral vivo.' },
  { id: 'roatan',         nombre: 'Roatán — Cordelia Banks', pais: 'Honduras',    coords: [16.320,-86.535], cobertura: 18, ocean:'caribbean', depth:'shallow', especies:['Acropora cervicornis','Acropora palmata','Diploria labyrinthiformis','Montastraea cavernosa','Orbicella annularis'],              estado:'riesgo',   dhw:0.8, sst:null, descripcion:'Perdió cobertura del 46% al 18% en 2024.' },
  { id: 'cozumel',        nombre: 'Cozumel',                 pais: 'México',      coords: [20.420,-86.922], cobertura: 22, ocean:'caribbean', depth:'deep',    especies:['Diploria labyrinthiformis','Orbicella annularis','Acropora palmata','Colpophyllia natans','Agaricia tenuifolia'],                estado:'moderado', dhw:0.9, sst:null, descripcion:'Arrecife del Caribe mexicano con alta biodiversidad.' },
  { id: 'cayos_miskitos', nombre: 'Cayos Miskitos',          pais: 'Nicaragua',   coords: [14.380,-82.780], cobertura: 43, ocean:'caribbean', depth:'shallow', especies:['Pseudodiploria strigosa','Montastraea cavernosa','Orbicella faveolata','Agaricia agaricites','Porites astreoides'],              estado:'sano',     dhw:0.4, sst:null, descripcion:'El arrecife más saludable de Centroamérica. 43% de cobertura.' },
]

// Mapeo: slug de la API (/reefs) → id de zona en ZONAS_BASE
const SLUG_A_ZONA = {
  honduras:     'roatan',
  nicaragua:    'cayos_miskitos',
  quintana_roo: 'cozumel',
  belize:       null, // no está en ZONAS_BASE
}

// Convierte DHW real → estado semáforo
function dhwAEstado(dhw) {
  if (dhw > 8) return 'critico'
  if (dhw > 4) return 'riesgo'
  if (dhw > 1) return 'moderado'
  return 'sano'
}

// Merge datos API sobre la base biológica
function mergeZonasConApi(apiReefs) {
  return ZONAS_BASE.map(zona => {
    const r = apiReefs.find(a => SLUG_A_ZONA[a.slug] === zona.id || a.slug === zona.id)
    if (!r) return zona
    const dhw = r.datos?.dhw ?? zona.dhw
    return {
      ...zona,
      dhw,
      sst:    r.datos?.sst_max ?? zona.sst,
      viento: r.viento         ?? null,
      estado: dhwAEstado(dhw),
      baa:    r.datos?.baa_label ?? null,
      alerta: r.predictions?.alerta         ?? null,
      predBlanqueamiento: r.predictions?.blanqueamiento ?? null,
      predPesca:          r.predictions?.pesca          ?? null,
      predSalud:          r.predictions?.salud          ?? null,
      fechaDatos:         r.fecha ?? null,
    }
  })
}

const CFG = {
  sano:     { accent: '#0ea5e9', label: 'SANO'      },
  moderado: { accent: '#f59e0b', label: 'ESTRÉS'    },
  riesgo:   { accent: '#f43f5e', label: 'EN RIESGO' },
  critico:  { accent: '#e11d48', label: 'CRÍTICO'   },
}

// ── Lógica de pesca responsable ──────────────────────────────────────────────
function getEstadoZona(dhw) {
  if (dhw > 8) return { color:'#ef4444', label:'VEDA',      permitida:false, maxLanchas:0,  descripcion:'Coral en blanqueamiento severo — zona cerrada para recuperación.' }
  if (dhw > 4) return { color:'#f97316', label:'LIMITADA',  permitida:true,  maxLanchas:3,  descripcion:'Coral bajo estrés. Solo pesca de altura, sin buceo ni ancla en coral.' }
  if (dhw > 1) return { color:'#fbbf24', label:'MODERADA',  permitida:true,  maxLanchas:6,  descripcion:'Estrés térmico leve. Pesca moderada permitida, evitar zonas someras.' }
  return         { color:'#34d399', label:'PERMITIDA', permitida:true,  maxLanchas:10, descripcion:'Coral sano. Pesca responsable permitida — ancla solo en arena.' }
}
function calcularSotavento(lat, lon, windDirGrados, distKm=9) {
  const rad = ((windDirGrados+180)%360)*(Math.PI/180)
  const g   = 1/111
  return [lat+Math.cos(rad)*distKm*g, lon+Math.sin(rad)*distKm*g]
}
function calcularRadio(vel, dhw) {
  const base = vel<15?10000:vel<30?7000:5000
  return dhw>4?base*0.6:base
}
function debeRotar(slug) {
  const dia = Math.floor(Date.now()/86400000)
  const arr = ['honduras','nicaragua','quintana_roo','belize']
  return arr[(dia-1+arr.length)%arr.length]===slug
}
const PESCA_META = {
  honduras:     {id:'pesca_roatan',   nombre:'Cordelia Banks'},
  nicaragua:    {id:'pesca_nicaragua',nombre:'Miskito Cays'},
  quintana_roo: {id:'pesca_cozumel', nombre:'Banco Chinchorro'},
  belize:       {id:'pesca_belize',  nombre:'Hol Chan'},
}
const ZONAS_PESCA_FALLBACK = [
  {id:'pesca_roatan',   nombre:'Cordelia Banks',  coords:[16.318,-86.620],radio:6000,sst:'30.3°C',dhw:0.83,viento:'E 37 km/h', enDescanso:false, sotaventoDe:'O', estado:getEstadoZona(0.83), prediccion:'Salida 5:00–6:00 AM. Lado oeste de Cordelia Banks, 15–25 m.',alerta:'Superó umbral de blanqueamiento.'},
  {id:'pesca_nicaragua',nombre:'Miskito Cays',    coords:[14.375,-82.830],radio:7000,sst:'29.9°C',dhw:2.15,viento:'E 35 km/h', enDescanso:false, sotaventoDe:'O', estado:getEstadoZona(2.15), prediccion:'Salida 4:30–5:00 AM. Zonas protegidas al OESTE, 8–15 m.',  alerta:'DHW 2.15 — estrés nivel 2.'},
  {id:'pesca_cozumel',  nombre:'Banco Chinchorro',coords:[18.760,-87.380],radio:8000,sst:'30.2°C',dhw:0.92,viento:'E 23 km/h', enDescanso:false, sotaventoDe:'O', estado:getEstadoZona(0.92), prediccion:'Salida 5:30 AM. Cara oeste del atolón, 8–15 m.',            alerta:'Agua rebasa 30°C y sigue subiendo.'},
  {id:'pesca_belize',   nombre:'Hol Chan',         coords:[17.728,-87.570],radio:5000,sst:'30.9°C',dhw:0.33,viento:'E 27 km/h', enDescanso:false, sotaventoDe:'O', estado:getEstadoZona(0.33), prediccion:'Salida 5:30 AM. Oeste de Hol Chan (sotavento), 8–12 m.',    alerta:'Estrés térmico con DHW subiendo.'},
]
function reefApiAZonaPesca(reef) {
  const meta=PESCA_META[reef.slug]; if(!meta)return null
  const v=reef.viento??{}, d=reef.datos??{}, dhw=d.dhw??0
  const lat=reef.coordenadas?.lat??0, lon=reef.coordenadas?.lon??0
  const coords=v.direccion_grados!=null?calcularSotavento(lat,lon,v.direccion_grados):[lat,lon-0.08]
  const radio=calcularRadio(v.velocidad_kmh??20,dhw)
  const enDescanso=debeRotar(reef.slug)
  const estado=enDescanso?{color:'#6366f1',label:'DESCANSO',permitida:false,maxLanchas:0,descripcion:'Esta zona descansa hoy.'}:getEstadoZona(dhw)
  return {id:meta.id,nombre:meta.nombre,coords,radio,enDescanso,estado,
    sst:d.sst_max!=null?`${d.sst_max}°C`:'—',dhw,cobertura:reef.cobertura??null,
    viento:v.velocidad_kmh!=null?`${v.direccion_cardinal??''} ${v.velocidad_kmh} km/h`:'—',
    sotaventoDe:v.direccion_cardinal??'?',
    prediccion:reef.predictions?.pesca??'Sin predicción disponible.',
    alerta:reef.predictions?.alerta??'',fecha:reef.fecha??''}
}

// ── Iconos Leaflet ────────────────────────────────────────────────────────────
function createFishIcon(activo=false) {
  const s=activo?38:32
  return L.divIcon({className:'',iconSize:[s,s],iconAnchor:[s/2,s/2],html:`
    <div style="width:${s}px;height:${s}px;background:${activo?'rgba(6,182,212,0.25)':'rgba(6,182,212,0.1)'};
      border:1px solid ${activo?'rgba(6,182,212,0.9)':'rgba(6,182,212,0.4)'};
      display:flex;align-items:center;justify-content:center;font-size:${activo?20:16}px;
      box-shadow:0 0 ${activo?16:8}px rgba(6,182,212,${activo?0.5:0.2})">🎣</div>`})
}
const STATUS_COLORS = {sano:'#0ea5e9',moderado:'#f59e0b',riesgo:'#f43f5e',critico:'#e11d48'}
const STATUS_LABELS = {sano:'Sano',moderado:'Estrés Térmico',riesgo:'En Riesgo',critico:'Blanqueamiento Severo'}
function getDHWPorEstado(e){return e==='sano'?2:e==='moderado'?5:e==='riesgo'?9:13}
function createGlowIcon(estado,activo=false){
  const color=STATUS_COLORS[estado]??'#34d399',s=activo?34:26,inner=activo?14:10
  return L.divIcon({className:'',iconSize:[s,s],iconAnchor:[s/2,s/2],popupAnchor:[0,-s/2-4],html:`
    <div style="position:relative;width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border:2px solid ${color};opacity:0.4;animation:pulse 2s infinite;border-radius:2px"></div>
      <div style="width:${inner}px;height:${inner}px;background:${color};box-shadow:0 0 10px ${color},0 0 20px ${color}44"></div>
    </div>`})
}
function MapReady(){const map=useMap();useEffect(()=>{setTimeout(()=>map.invalidateSize(),100)},[map]);return null}

const API_URL = import.meta.env.VITE_API_URL ?? 'https://hackaton-ambiental-production.up.railway.app'
const SP_COLORS = ['#a78bfa','#34d399','#38bdf8','#fb923c']
const SP_PCT    = [100,94,61,80]

// ── Componentes UI ────────────────────────────────────────────────────────────
function Label({children}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
      <span style={{fontFamily:FONT_SANS,fontWeight:600,fontSize:10,color:'#94a3b8',letterSpacing:'0.2em',textTransform:'uppercase',whiteSpace:'nowrap'}}>{children}</span>
      <div style={{flex:1,height:1,background:'linear-gradient(to right, rgba(255,255,255,0.1), transparent)'}}/>
    </div>
  )
}
function MetricBox({label,value,color}){
  return(
    <div style={{background:'rgba(255,255,255,0.03)',border:B,borderRadius:16,padding:'12px 14px',position:'relative',overflow:'hidden',backdropFilter:'blur(10px)'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:color,opacity:0.8}}/>
      <div style={{fontFamily:FONT_SANS,fontWeight:600,fontSize:9,color:'#94a3b8',letterSpacing:'0.15em',marginBottom:6}}>{label}</div>
      <div style={{fontFamily:FONT_DATA,fontSize:22,fontWeight:700,lineHeight:1,color}}>{value}</div>
    </div>
  )
}

export default function CoralMap() {
  const [zonaActiva,       setZonaActiva]       = useState(null)
  const [pescaActiva,      setPescaActiva]      = useState(null)
  const [reefGeoJson,      setReefGeoJson]      = useState(null)
  const [zonasPesca,       setZonasPesca]       = useState(ZONAS_PESCA_FALLBACK)
  const [zonasReales,      setZonasReales]      = useState(ZONAS_BASE)
  const [apiOnline,        setApiOnline]        = useState(false)
  const [tab,              setTab]              = useState('arrecife')
  const [panelWidth,       setPanelWidth]       = useState(380)
  const [prediccionViva,   setPrediccionViva]   = useState(null)
  const [loadingPrediccion,setLoadingPrediccion]= useState(false)

  // Mapeo zona frontend → ID del endpoint /api/zona/{id}
  const ZONA_API_ID = {
    los_cobanos:    'los_cobanos',
    roatan:         'roatan',
    cozumel:        'cozumel',
    cayos_miskitos: 'cayos_miskitos',
    pesca_roatan:   'roatan',
    pesca_nicaragua:'cayos_miskitos',
    pesca_cozumel:  'cozumel',
  }

  async function fetchPrediccionViva(zonaId) {
    const apiId = ZONA_API_ID[zonaId]
    if (!apiId) return
    setLoadingPrediccion(true)
    setPrediccionViva(null)
    try {
      const res  = await fetch(`${API_URL}/api/zona/${apiId}/estado-completo`)
      const data = await res.json()
      setPrediccionViva({
        alerta:  data.alerta_pescador ?? null,
        veda:    data.veda            ?? null,
        temp:    data.temperatura_c   ?? null,
        dhw:     data.dhw             ?? null,
      })
    } catch {
      setPrediccionViva({ alerta: 'No se pudo obtener predicción en tiempo real.', veda: null })
    } finally {
      setLoadingPrediccion(false)
    }
  }
  const isDragging  = useRef(false)
  const startX      = useRef(0)
  const startWidth  = useRef(0)

  const onDragStart = useCallback((e)=>{
    isDragging.current=true; startX.current=e.clientX; startWidth.current=panelWidth
    document.body.style.cursor='col-resize'; document.body.style.userSelect='none'
  },[panelWidth])

  useEffect(()=>{
    const onMove=(e)=>{
      if(!isDragging.current)return
      const dx=startX.current-e.clientX
      setPanelWidth(Math.min(Math.max(startWidth.current+dx,280),window.innerWidth*0.85))
    }
    const onUp=()=>{
      if(!isDragging.current)return
      isDragging.current=false; document.body.style.cursor=''; document.body.style.userSelect=''
    }
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp)
    return()=>{window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp)}
  },[])

  useEffect(()=>{
    let c=false
    fetch('/data/Mesoamerica.geojson').then(r=>{if(!r.ok)throw r;return r.json()}).then(d=>{if(!c)setReefGeoJson(d)}).catch(()=>{})
    return()=>{c=true}
  },[])

  useEffect(()=>{
    let c=false
    fetch(`${API_URL}/reefs`).then(r=>{if(!r.ok)throw r;return r.json()}).then(data=>{
      if(c)return
      // Zonas de pesca con datos reales
      const z=data.map(reefApiAZonaPesca).filter(Boolean)
      if(z.length>0) setZonasPesca(z)
      // Zonas de arrecife con estado, DHW, SST y predicciones reales
      const zr=mergeZonasConApi(data)
      setZonasReales(zr)
      setApiOnline(true)
    }).catch(()=>{})
    return()=>{c=true}
  },[])

  function abrirArrecife(z){setZonaActiva(z);setPescaActiva(null);setPanelWidth(window.innerWidth*0.45);fetchPrediccionViva(z.id)}
  function abrirPesca(z)   {setPescaActiva(z);setZonaActiva(null);setPanelWidth(380);fetchPrediccionViva(z.id)}

  const panelAbierto = zonaActiva||pescaActiva
  const cfgActiva    = zonaActiva ? CFG[zonaActiva.estado] : null

  return (
    <div style={{display:'flex',height:'100vh',background:BG0,overflow:'hidden',fontFamily:FONT_SANS}}>

      {/* ══ SIDEBAR IZQUIERDO ══ */}
      <div style={{width:260,flexShrink:0,background:BG1,backdropFilter:'blur(24px)',borderRight:B,display:'flex',flexDirection:'column'}}>

        {/* Logo */}
        <div style={{padding:'24px 20px 16px',borderBottom:B}}>
          <div style={{fontFamily:FONT_SANS,fontWeight:600,fontSize:9,color:'#38bdf8',letterSpacing:'0.25em',marginBottom:6}}>SYS // MONITOR</div>
          <div style={{fontSize:22,fontWeight:700,color:'#f1f5f9',letterSpacing:'-0.01em'}}>CoralWatch</div>
          <div style={{fontFamily:FONT_SANS,fontWeight:600,fontSize:9,color:'#0ea5e9',letterSpacing:'0.2em',marginTop:4}}>CARIBE · NOAA · LIVE</div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:B}}>
          {[['arrecife','🪸 Arrecife'],['pesca','🎣 Pesca']].map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              flex:1,padding:'12px 4px',fontFamily:FONT_SANS,fontWeight:600,fontSize:10,letterSpacing:'0.15em',textTransform:'uppercase',cursor:'pointer',
              background:tab===t?'rgba(14, 165, 233, 0.1)':'transparent',
              borderBottom:tab===t?'2px solid #0ea5e9':'2px solid transparent',
              color:tab===t?'#0ea5e9':'#94a3b8',border:'none',borderBottom:tab===t?'2px solid #0ea5e9':'2px solid transparent',
            }}>{label}</button>
          ))}
        </div>

        {/* Lista de zonas */}
        <div style={{flex:1,overflowY:'auto',padding:'12px'}}>
          {tab==='arrecife' && zonasReales.map(z=>{
            const c=CFG[z.estado]
            const activo=zonaActiva?.id===z.id
            return(
              <button key={z.id} onClick={()=>abrirArrecife(z)} style={{
                width:'100%',textAlign:'left',padding:'14px 16px',background:'transparent',
                border:`1px solid ${activo?c.accent+'66':'rgba(255,255,255,0.05)'}`,
                borderRadius:16, cursor:'pointer', marginBottom:8,
                background:activo?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.02)',
                boxShadow:activo?`0 0 15px ${c.accent}22`:''
              }}>
                <div style={{fontFamily:FONT_SANS,fontWeight:700,fontSize:9,color:c.accent,letterSpacing:'0.2em',marginBottom:4}}>{c.label}</div>
                <div style={{fontSize:14,fontWeight:600,color:'#e2e8f0',lineHeight:1.3,marginBottom:4}}>{z.nombre}</div>
                <div style={{fontFamily:FONT_SANS,fontWeight:500,fontSize:10,color:'#94a3b8'}}>{z.pais} · {z.cobertura}%</div>
              </button>
            )
          })}

          {tab==='pesca' && zonasPesca.map(z=>{
            const activo=pescaActiva?.id===z.id
            return(
              <button key={z.id} onClick={()=>abrirPesca(z)} style={{
                width:'100%',textAlign:'left',padding:'14px 16px',background:'transparent',
                border:`1px solid ${activo?(z.estado?.color??'#0ea5e9')+'66':'rgba(255,255,255,0.05)'}`,
                borderRadius:16, cursor:'pointer', marginBottom:8,
                background:activo?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.02)',
                boxShadow:activo?`0 0 15px ${z.estado?.color??'#0ea5e9'}22`:''
              }}>
                <div style={{fontFamily:FONT_SANS,fontWeight:700,fontSize:9,color:z.estado?.color??'#0ea5e9',letterSpacing:'0.2em',marginBottom:4}}>{z.estado?.label}</div>
                <div style={{fontSize:14,fontWeight:600,color:'#e2e8f0',marginBottom:4}}>🎣 {z.nombre}</div>
                <div style={{fontFamily:FONT_SANS,fontWeight:500,fontSize:10,color:'#94a3b8'}}>DHW {z.dhw} · {z.viento}</div>
              </button>
            )
          })}
        </div>

        {/* Footer API status */}
        <div style={{padding:'12px 16px',borderTop:B,display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.02)'}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:apiOnline?'#0ea5e9':'#fbbf24',display:'inline-block',animation:'blink 1.4s step-start infinite',boxShadow:`0 0 8px ${apiOnline?'#0ea5e9':'#fbbf24'}`}}/>
          <span style={{fontFamily:FONT_SANS,fontWeight:600,fontSize:10,color:apiOnline?'#38bdf8':'#fcd34d',letterSpacing:'0.15em'}}>
            {apiOnline?'API ONLINE':'CACHE LOCAL'}
          </span>
        </div>
      </div>

      {/* ══ MAPA ══ */}
      <div style={{flex:1,minWidth:0,position:'relative'}}>
        <MapContainer center={[15.5,-85.0]} zoom={6} zoomControl={true} attributionControl={false}
          style={{width:'100%',height:'100%',background:BG0}}>
          <MapReady/>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={18}/>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxZoom={18}/>
          {reefGeoJson&&<GeoJSON data={reefGeoJson} style={{color:'#dc2626',fillColor:'#dc2626',fillOpacity:0.2,weight:1.5}}/>}

          {zonasPesca.map(z=>(
            <React.Fragment key={z.id}>
              <Circle center={z.coords} radius={z.radio} pathOptions={{
                color:z.estado?.color??'#06b6d4',fillColor:z.estado?.color??'#06b6d4',
                fillOpacity:z.estado?.permitida?0.06:0.15,weight:z.estado?.permitida?1:2,
                dashArray:z.estado?.permitida?'6 4':'2 4'}}/>
              <Marker position={z.coords} icon={createFishIcon(pescaActiva?.id===z.id)} eventHandlers={{click:()=>abrirPesca(z)}}/>
            </React.Fragment>
          ))}

          {zonasReales.map(z=>(
            <Marker key={z.id} position={z.coords} icon={createGlowIcon(z.estado,zonaActiva?.id===z.id)} eventHandlers={{click:()=>abrirArrecife(z)}}>
              <Popup>
                <div style={{background:'rgba(11, 26, 46, 0.85)',backdropFilter:'blur(10px)',color:'#e2e8f0',padding:'16px',border:`1px solid ${STATUS_COLORS[z.estado]}66`,borderRadius:16,fontFamily:FONT_SANS,minWidth:220,boxShadow:'0 4px 30px rgba(0,0,0,0.5)'}}>
                  <div style={{fontSize:10,fontWeight:600,color:'#94a3b8',letterSpacing:'0.2em',marginBottom:6}}>{z.pais.toUpperCase()}</div>
                  <div style={{fontWeight:700,fontSize:16,marginBottom:12,color:'#f1f5f9'}}>{z.nombre}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 12px',fontSize:11,color:'#94a3b8',marginBottom:16}}>
                    <span>Cobertura</span><span style={{color:STATUS_COLORS[z.estado],fontWeight:700}}>{z.cobertura}%</span>
                    <span>Estado</span>  <span style={{color:STATUS_COLORS[z.estado],fontWeight:700}}>{STATUS_LABELS[z.estado]}</span>
                  </div>
                  <button onClick={()=>abrirArrecife(z)} style={{
                    width:'100%',padding:'10px 0',background:`${STATUS_COLORS[z.estado]}22`,
                    border:`1px solid ${STATUS_COLORS[z.estado]}66`,borderRadius:8,cursor:'pointer',
                    color:STATUS_COLORS[z.estado],fontFamily:FONT_SANS,fontWeight:700,fontSize:10,letterSpacing:'0.15em',textTransform:'uppercase',transition:'all 0.2s'
                  }}>VER ARRECIFE 3D →</button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* HUD coords */}
        <div style={{position:'absolute',bottom:16,left:16,zIndex:1000,background:'rgba(11,26,46,0.7)',backdropFilter:'blur(8px)',border:B,borderRadius:12,padding:'8px 12px',fontFamily:FONT_DATA,fontWeight:500,fontSize:10,color:'#94a3b8'}}>
          15.50°N · 85.00°W · Z6
        </div>

        {/* Leyenda */}
        <div style={{position:'absolute',bottom:16,right:16,zIndex:1000,background:'rgba(11,26,46,0.7)',backdropFilter:'blur(8px)',border:B,borderRadius:16,padding:'16px'}}>
          <div style={{fontFamily:FONT_SANS,fontWeight:700,fontSize:9,color:'#0ea5e9',letterSpacing:'0.25em',marginBottom:12}}>RIESGO DE BLANQUEAMIENTO</div>
          {Object.entries(STATUS_LABELS).map(([k,label])=>(
            <div key={k} style={{display:'flex',alignItems:'center',gap:10,fontFamily:FONT_SANS,fontSize:11,color:'#e2e8f0',marginBottom:8}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:STATUS_COLORS[k],boxShadow:`0 0 8px ${STATUS_COLORS[k]}`,display:'inline-block',flexShrink:0}}/>
              {label}
            </div>
          ))}
          <div style={{borderTop:B,marginTop:10,paddingTop:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10,fontFamily:FONT_SANS,fontSize:11,color:'#e2e8f0'}}>
              <span style={{width:10,height:10,borderRadius:'50%',border:'2px dashed #0ea5e9',display:'inline-block',flexShrink:0}}/>
              Zona de Pesca
            </div>
          </div>
        </div>
      </div>

      {/* ══ PANEL DERECHO ══ */}
      {panelAbierto&&(
        <>
          {/* Drag handle */}
          <div onMouseDown={onDragStart} style={{
            width:4,flexShrink:0,cursor:'col-resize',background:'transparent',
            borderLeft:`1px solid ${cfgActiva?cfgActiva.accent+'55':'rgba(6,182,212,0.3)'}`,position:'relative',zIndex:10,
          }}>
            <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',display:'flex',flexDirection:'column',gap:4}}>
              {[0,1,2,3,4].map(i=><div key={i} style={{width:2,height:2,background:cfgActiva?cfgActiva.accent+'88':'rgba(6,182,212,0.6)'}}/>)}
            </div>
          </div>

          <div style={{width:panelWidth,flexShrink:0,background:'rgba(11,26,46,0.85)',backdropFilter:'blur(24px)',borderLeft:B,display:'flex',flexDirection:'column',overflowY:'auto',animation:'slideIn 0.25s ease'}}>

            {/* ── Panel Arrecife 3D ── */}
            {zonaActiva&&(
              <div style={{position:'relative',flex:1,minHeight:0}}>
                <div style={{position:'absolute',inset:0}}>
                  <ReefViewer zone={zonaActiva.id} dhw={getDHWPorEstado(zonaActiva.estado)}
                    especies={zonaActiva.modelos??ESPECIES_POR_ZONA[zonaActiva.id]??especiesDesdeMetadata(zonaActiva)}
                    cobertura={zonaActiva.cobertura} descripcion={zonaActiva.descripcion}/>
                </div>

                {/* Cerrar */}
                <button onClick={()=>setZonaActiva(null)} style={{
                  position:'absolute',top:16,right:16,zIndex:20,background:'rgba(255,255,255,0.1)',backdropFilter:'blur(8px)',border:B,borderRadius:16,
                  color:'#e2e8f0',padding:'8px 16px',cursor:'pointer',fontFamily:FONT_SANS,fontWeight:600,fontSize:10,letterSpacing:'0.1em',transition:'all 0.2s'
                }}>✕ ESC</button>

                {/* Overlay bottom */}
                <div style={{
                  position:'absolute',bottom:0,left:0,right:0,zIndex:20,
                  background:`linear-gradient(to top, rgba(6,17,30,0.95) 0%, rgba(6,17,30,0.8) 55%, transparent 100%)`,
                  padding:'60px 24px 24px',
                }}>
                  {/* País + nombre */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontFamily:FONT_SANS,fontWeight:600,fontSize:10,color:'#94a3b8',letterSpacing:'0.2em',marginBottom:6}}>{zonaActiva.pais.toUpperCase()}</div>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
                      <span style={{fontSize:28,fontWeight:700,color:'#f1f5f9',letterSpacing:'-0.02em'}}>{zonaActiva.nombre}</span>
                      <span style={{fontFamily:FONT_SANS,fontSize:10,padding:'4px 12px',borderRadius:16,background:`${cfgActiva.accent}22`,
                        border:`1px solid ${cfgActiva.accent}66`,color:cfgActiva.accent,letterSpacing:'0.15em',fontWeight:700}}>
                        {cfgActiva.label}
                      </span>
                    </div>
                    <div style={{display:'inline-flex',alignItems:'center',gap:8,fontFamily:FONT_SANS,fontWeight:600,fontSize:10,
                      color:cfgActiva.accent,background:'rgba(255,255,255,0.05)',borderRadius:16,padding:'6px 12px',letterSpacing:'0.12em'}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:cfgActiva.accent,animation:'blink 1.4s step-start infinite',boxShadow:`0 0 8px ${cfgActiva.accent}`}}/>
                      {cfgActiva.label} · {zonaActiva.cobertura}% COBERTURA
                    </div>
                  </div>

                  {/* Métricas — datos reales de NOAA */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8,marginBottom:20}}>
                    <MetricBox label="COBERTURA" value={`${zonaActiva.cobertura}%`}
                      color={cfgActiva.accent}/>
                    <MetricBox label="DHW"
                      value={zonaActiva.dhw!=null?zonaActiva.dhw.toFixed(1):'—'}
                      color={zonaActiva.dhw>4?'#ef4444':zonaActiva.dhw>1?'#f59e0b':'#f59e0b'}/>
                    <MetricBox label="SST"
                      value={zonaActiva.sst!=null?`${zonaActiva.sst.toFixed(1)}°`:'—'}
                      color="#f59e0b"/>
                    <MetricBox label="ESP. CLAVE"
                      value={zonaActiva.especies?.[0]?.split(' ').pop()??'—'}
                      color="#0ea5e9"/>
                  </div>
                  {/* Viento y fecha si hay datos reales */}
                  {zonaActiva.viento&&(
                    <div style={{fontFamily:MONO,fontSize:8,color:'#334155',letterSpacing:'0.15em',marginBottom:10,borderLeft:'2px solid rgba(30,41,59,0.9)',paddingLeft:8}}>
                      VIENTO {zonaActiva.viento.direccion_cardinal} {zonaActiva.viento.velocidad_kmh} km/h
                      {zonaActiva.fechaDatos&&<span style={{marginLeft:12,color:'#1e3a5f'}}>NOAA {zonaActiva.fechaDatos}</span>}
                    </div>
                  )}

                  {/* Especies */}
                  <Label>ESPECIES DOMINANTES</Label>
                  <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
                    {(zonaActiva.especies??[]).slice(0,4).map((esp,i)=>(
                      <div key={esp}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                          <span style={{fontSize:11,color:'#94a3b8',fontStyle:'italic',fontFamily:FONT_SANS}}>{esp}</span>
                          <span style={{fontFamily:FONT_DATA,fontSize:11,color:SP_COLORS[i],fontWeight:700}}>{SP_PCT[i]}%</span>
                        </div>
                        <div style={{height:4,borderRadius:2,background:'rgba(255,255,255,0.05)'}}>
                          <div style={{width:`${SP_PCT[i]}%`,height:'100%',borderRadius:2,background:SP_COLORS[i],transition:'width 0.8s cubic-bezier(0.16,1,0.3,1)'}}/>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{fontFamily:FONT_SANS,fontSize:12,color:'#94a3b8',lineHeight:1.7,borderTop:B,paddingTop:12,marginBottom:10}}>
                    {zonaActiva.descripcion}
                  </div>

                  {/* Predicciones de noaa.js (Claude AI, actualizadas diariamente) */}
                  {zonaActiva.predBlanqueamiento&&(
                    <>
                      <Label>BLANQUEAMIENTO · PREDICCIÓN</Label>
                      <div style={{borderLeft:'2px solid rgba(239,68,68,0.4)',paddingLeft:10,fontFamily:MONO,fontSize:9,color:'#fca5a5',lineHeight:1.8,marginBottom:10}}>
                        {zonaActiva.predBlanqueamiento}
                      </div>
                    </>
                  )}
                  {zonaActiva.predPesca&&(
                    <>
                      <Label>PESCA RESPONSABLE · HOY</Label>
                      <div style={{borderLeft:'2px solid rgba(52,211,153,0.4)',paddingLeft:10,fontFamily:MONO,fontSize:9,color:'#6ee7b7',lineHeight:1.8,marginBottom:10}}>
                        {zonaActiva.predPesca}
                      </div>
                    </>
                  )}

                  {/* Alerta Claude en tiempo real (Copernicus + NOAA ahora mismo) */}
                  <Label>ALERTA CLAUDE · AHORA</Label>
                  {loadingPrediccion?(
                    <div style={{display:'flex',alignItems:'center',gap:8,paddingLeft:10}}>
                      <span style={{width:5,height:5,background:'#6366f1',animation:'blink 0.8s step-start infinite',display:'inline-block'}}/>
                      <span style={{fontFamily:MONO,fontSize:9,color:'#6366f1',letterSpacing:'0.15em'}}>GENERANDO CON CLAUDE AI...</span>
                    </div>
                  ):prediccionViva?.alerta&&(
                    <div style={{borderLeft:'2px solid rgba(99,102,241,0.4)',paddingLeft:10,fontFamily:MONO,fontSize:9,color:'#94a3b8',lineHeight:1.8}}>
                      <div style={{fontFamily:MONO,fontSize:7,color:'#1e3a5f',letterSpacing:'0.2em',marginBottom:5}}>
                        CLAUDE · {prediccionViva.temp!=null?`${prediccionViva.temp}°C · `:''}DHW {prediccionViva.dhw??'—'}
                      </div>
                      {prediccionViva.alerta}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Panel Pesca ── */}
            {pescaActiva&&(
              <>
                <div style={{padding:'20px 24px',background:'rgba(255,255,255,0.02)',borderBottom:B,borderLeft:`4px solid ${pescaActiva.estado?.color??'#0ea5e9'}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <div style={{fontFamily:FONT_SANS,fontWeight:600,fontSize:10,color:'#94a3b8',letterSpacing:'0.2em',marginBottom:6}}>ZONA DE PESCA RESPONSABLE</div>
                    <div style={{fontSize:20,fontWeight:700,color:'#f1f5f9',marginBottom:10}}>🎣 {pescaActiva.nombre}</div>
                    <div style={{display:'inline-flex',alignItems:'center',gap:8,fontFamily:FONT_SANS,fontSize:10,padding:'6px 12px',borderRadius:16,
                      background:`${pescaActiva.estado?.color}22`,border:`1px solid ${pescaActiva.estado?.color}66`,
                      color:pescaActiva.estado?.color,letterSpacing:'0.15em',fontWeight:700}}>
                      {pescaActiva.estado?.label} · MÁX {pescaActiva.estado?.maxLanchas} LANCHAS
                    </div>
                  </div>
                  <button onClick={()=>setPescaActiva(null)} style={{background:'rgba(255,255,255,0.05)',border:B,borderRadius:16,color:'#e2e8f0',padding:'8px 12px',cursor:'pointer',fontFamily:FONT_SANS,fontSize:12}}>✕</button>
                </div>

                <div style={{padding:'24px',display:'flex',flexDirection:'column',gap:16}}>
                  {/* Métricas */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[
                      {label:'TEMP. MAR',  value:pescaActiva.sst,                          color:'#f59e0b'},
                      {label:'DHW',        value:`${pescaActiva.dhw}`,                     color:pescaActiva.estado?.color},
                      {label:'VIENTO',     value:pescaActiva.viento,                       color:'#94a3b8'},
                      {label:'SOTAVENTO',  value:pescaActiva.sotaventoDe??'O',             color:'#38bdf8'},
                    ].map(m=><MetricBox key={m.label} {...m}/>)}
                  </div>

                  {/* Estado */}
                  <div style={{borderLeft:`3px solid ${pescaActiva.estado?.color}`,paddingLeft:16,background:'rgba(255,255,255,0.02)',borderRadius:'0 16px 16px 0',padding:'12px 16px'}}>
                    <div style={{fontFamily:FONT_SANS,fontWeight:600,fontSize:9,color:'#94a3b8',letterSpacing:'0.18em',marginBottom:6}}>ESTADO DEL ARRECIFE</div>
                    <div style={{fontSize:16,fontWeight:700,color:pescaActiva.estado?.color,marginBottom:6}}>
                      {pescaActiva.estado?.label}
                      {pescaActiva.estado?.maxLanchas>0&&<span style={{fontFamily:FONT_SANS,fontSize:11,fontWeight:500,color:'#94a3b8',marginLeft:12}}>MÁX {pescaActiva.estado.maxLanchas}</span>}
                    </div>
                    <div style={{fontFamily:FONT_SANS,fontSize:11,color:'#cbd5e1',lineHeight:1.7}}>{pescaActiva.estado?.descripcion}</div>
                  </div>

                  {/* Predicción Claude en tiempo real */}
                  <Label>PREDICCIÓN CLAUDE · TIEMPO REAL</Label>
                  {loadingPrediccion?(
                    <div style={{borderLeft:'3px solid rgba(99,102,241,0.5)',paddingLeft:16,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:'#6366f1',animation:'blink 0.8s step-start infinite',display:'inline-block'}}/>
                      <span style={{fontFamily:FONT_SANS,fontSize:10,fontWeight:600,color:'#6366f1',letterSpacing:'0.15em'}}>GENERANDO CON CLAUDE AI...</span>
                    </div>
                  ):prediccionViva?.alerta?(
                    <div style={{borderLeft:'3px solid rgba(14,165,233,0.5)',paddingLeft:16,fontFamily:FONT_SANS,fontSize:11,color:'#cbd5e1',lineHeight:1.8}}>
                      <div style={{fontFamily:FONT_SANS,fontSize:9,fontWeight:600,color:'#94a3b8',letterSpacing:'0.2em',marginBottom:6}}>
                        CLAUDE · {prediccionViva.temp!=null?`${prediccionViva.temp}°C · `:''}DHW {prediccionViva.dhw??'—'} · AHORA
                      </div>
                      {prediccionViva.alerta}
                      {prediccionViva.veda?.mensaje&&(
                        <div style={{marginTop:8,fontFamily:FONT_SANS,fontSize:10,color:prediccionViva.veda.color??'#0ea5e9',borderTop:B,paddingTop:8}}>
                          {prediccionViva.veda.label} — {prediccionViva.veda.mensaje}
                        </div>
                      )}
                    </div>
                  ):(
                    <div style={{borderLeft:`3px solid ${pescaActiva.estado?.color}`,paddingLeft:16,fontFamily:FONT_SANS,fontSize:11,color:'#e2e8f0',lineHeight:1.8}}>
                      <strong style={{color:pescaActiva.estado?.color,display:'block',marginBottom:6,letterSpacing:'0.1em',fontSize:10}}>
                        {pescaActiva.estado?.permitida?'PREDICCIÓN':'⛔ ZONA NO DISPONIBLE HOY'}
                      </strong>
                      <span style={{color:'#94a3b8'}}>{pescaActiva.prediccion??pescaActiva.estado?.descripcion}</span>
                    </div>
                  )}

                  {/* Educación */}
                  <div style={{borderLeft:'3px solid rgba(14,165,233,0.3)',paddingLeft:16,fontFamily:FONT_SANS,fontSize:11,color:'#38bdf8',lineHeight:1.7}}>
                    🪸 DHW {pescaActiva.dhw} — {pescaActiva.dhw<1?'coral sano y produciendo larvas.':pescaActiva.dhw<4?'estrés leve. Pesca con cuidado.':pescaActiva.dhw<8?'coral sufre. Menos refugio = menos peces.':'coral blanquea. Pesquería afectada.'}
                  </div>

                  {pescaActiva.alerta&&(
                    <div style={{borderLeft:'3px solid rgba(244,63,94,0.5)',paddingLeft:16,fontFamily:FONT_SANS,fontSize:11,color:'#fb7185',lineHeight:1.7}}>
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes slideIn{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:1}}
        .leaflet-popup-content-wrapper{background:transparent!important;box-shadow:none!important;padding:0!important;border-radius:0!important}
        .leaflet-popup-content{margin:0!important}
        .leaflet-popup-tip-container{display:none!important}
      `}</style>
    </div>
  )
}
