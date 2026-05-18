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
const MONO = "'JetBrains Mono','Fira Code','Courier New',monospace"
const BRAND = {
  ink: '#2b1454',
  plum: '#5b1f68',
  magenta: '#b43a82',
  coral: '#c85b54',
  clay: '#d6845d',
  sand: '#e7ae68',
  paper: '#fbfaf7',
}
const BG0   = '#06111e'
const BG1   = 'rgba(11, 26, 46, 0.7)'
const BG2   = 'rgba(255, 255, 255, 0.05)'
const B     = '1px solid rgba(255,255,255,0.08)'  // border glass

// ── Datos base de arrecifes (datos biológicos fijos + fallback) ──────────────
// Los campos dinámicos (estado, dhw, sst, predicciones) se sobreescriben con la API
const ZONAS_BASE = [
  { id: 'los_cobanos',       nombre: 'Los Cóbanos',             pais: 'El Salvador', coords: [13.529,-89.814], cobertura: 4,  ocean:'pacific',   depth:'shallow', especies:['Porites lobata','Pocillopora damicornis','Pavona clavus'],                                                                              estado:'moderado', dhw:1.11, sst:30.52, descripcion:'Único arrecife de El Salvador. Solo 4% de coral vivo. SST 30.5°C — estrés térmico activo.' },
  { id: 'barra_santiago',    nombre: 'Barra de Santiago',       pais: 'El Salvador', coords: [13.682,-90.041], cobertura: 12, ocean:'pacific',   depth:'shallow', especies:['Porites lobata','Pavona gigantea','Pocillopora damicornis','Gardineroseris planulata'],                                              estado:'sano',     dhw:0.31, sst:30.37, descripcion:'Reserva de Biosfera del Pacífico salvadoreño. Corales en roca volcánica, manglares y pastos marinos.' },
  { id: 'roatan',            nombre: 'Roatán — Cordelia Banks', pais: 'Honduras',    coords: [16.326,-86.538], cobertura: 18, ocean:'caribbean', depth:'shallow', especies:['Acropora cervicornis','Acropora palmata','Diploria labyrinthiformis','Montastraea cavernosa','Orbicella annularis'],                  estado:'sano',     dhw:0,    sst:28.54, descripcion:'Perdió cobertura del 46% al 18% en 2024. Actualmente sin estrés térmico.' },
  { id: 'cozumel',           nombre: 'Cozumel',                 pais: 'México',      coords: [20.420,-86.922], cobertura: 22, ocean:'caribbean', depth:'deep',    especies:['Diploria labyrinthiformis','Orbicella annularis','Acropora palmata','Colpophyllia natans','Agaricia tenuifolia'],                    estado:'moderado', dhw:0.9,  sst:null,  descripcion:'Arrecife del Caribe mexicano con alta biodiversidad.' },
  { id: 'cayos_miskitos',    nombre: 'Cayos Miskitos',          pais: 'Nicaragua',   coords: [14.380,-82.780], cobertura: 43, ocean:'caribbean', depth:'shallow', especies:['Pseudodiploria strigosa','Montastraea cavernosa','Orbicella faveolata','Agaricia agaricites','Porites astreoides'],                  estado:'sano',     dhw:0.4,  sst:null,  descripcion:'El arrecife más saludable de Centroamérica. 43% de cobertura.' },
]

// Mapeo: slug de la API (/reefs) → id de zona en ZONAS_BASE
const SLUG_A_ZONA = {
  honduras:     'roatan',
  nicaragua:    'cayos_miskitos',
  quintana_roo: 'cozumel',
  belize:       null, // no está en ZONAS_BASE
}

// Merge datos API sobre la base biológica actualizando el estado de estrés térmico
function mergeZonasConApi(apiReefs) {
  return ZONAS_BASE.map(zona => {
    const r = apiReefs.find(a => SLUG_A_ZONA[a.slug] === zona.id || a.slug === zona.id)
    if (!r) return zona
    const dhw = r.datos?.dhw ?? zona.dhw
    
    const stress = r.datos?.stress_level ?? 0;
    let estado = 'sano';
    if (stress >= 3 || dhw >= 8) estado = 'critico';
    else if (stress === 2 || dhw >= 4) estado = 'riesgo';
    else if (stress === 1 || dhw >= 1) estado = 'moderado';

    return {
      ...zona,
      dhw,
      sst:    r.datos?.sst_max ?? zona.sst,
      viento: r.viento         ?? null,
      estado: estado,
      baa_numeric: r.datos?.stress_level ?? 0,
      baa:    r.datos?.baa_label ?? null,
      alerta: r.predictions?.alerta         ?? null,
      predBlanqueamiento: r.predictions?.blanqueamiento ?? null,
      predPesca:          r.predictions?.pesca          ?? null,
      predSalud:          r.predictions?.salud          ?? null,
      proyeccion_diaria:  r.proyeccion_diaria           ?? zona.proyeccion_diaria ?? null,
      fechaDatos:         r.fecha ?? null,
    }
  })
}

const CFG = {
  sano:     { accent: BRAND.plum, label: 'SANO'      },
  moderado: { accent: BRAND.sand, label: 'ESTRÉS'    },
  riesgo:   { accent: BRAND.clay, label: 'EN RIESGO' },
  critico:  { accent: BRAND.coral, label: 'CRÍTICO'   },
}

// ── Lógica de pesca responsable ──────────────────────────────────────────────
function getEstadoZona(dhw) {
  if (dhw > 8) return { color:'#ef4444', label:'VEDA',      permitida:false, maxLanchas:0,  descripcion:'Coral en blanqueamiento severo — zona cerrada para recuperación.' }
  if (dhw > 4) return { color:'#f97316', label:'LIMITADA',  permitida:true,  maxLanchas:3,  descripcion:'Coral bajo estrés. Solo pesca de altura, sin buceo ni ancla en coral.' }
  if (dhw > 1) return { color:'#fbbf24', label:'MODERADA',  permitida:true,  maxLanchas:6,  descripcion:'Estrés térmico leve. Pesca moderada permitida, evitar zonas someras.' }
  return         { color:BRAND.plum, label:'PERMITIDA', permitida:true,  maxLanchas:10, descripcion:'Coral sano. Pesca responsable permitida — ancla solo en arena.' }
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
  {id:'pesca_roatan',   nombre:'Cordelia Banks',  coords:[16.318,-86.620],radio:6000,sst:'30.3°C',dhw:0.83,viento:'E 37 km/h', enDescanso:false, sotaventoDe:'O', estado:getEstadoZona(0.83), prediccion:'Salida 5:00–6:00 AM. Lado oeste de Cordelia Banks, 15–25 m. Anclar en arena, respetar tallas mínimas.',alerta:'Superó umbral de blanqueamiento.',blanqueamiento:predLocalBlanqueamiento(0.83)},
  {id:'pesca_nicaragua',nombre:'Miskito Cays',    coords:[14.375,-82.830],radio:7000,sst:'29.9°C',dhw:2.15,viento:'E 35 km/h', enDescanso:false, sotaventoDe:'O', estado:getEstadoZona(2.15), prediccion:'Salida 4:30–5:00 AM. Zonas protegidas al OESTE, 8–15 m. DHW en ascenso — mantener distancia del coral.',alerta:'DHW 2.15 — estrés nivel 2.',blanqueamiento:predLocalBlanqueamiento(2.15)},
  {id:'pesca_cozumel',  nombre:'Banco Chinchorro',coords:[18.760,-87.380],radio:8000,sst:'30.2°C',dhw:0.92,viento:'E 23 km/h', enDescanso:false, sotaventoDe:'O', estado:getEstadoZona(0.92), prediccion:'Salida 5:30 AM. Cara oeste del atolón, 8–15 m. Buenas condiciones — coral estable.',alerta:'Agua rebasa 30°C y sigue subiendo.',blanqueamiento:predLocalBlanqueamiento(0.92)},
  {id:'pesca_belize',   nombre:'Hol Chan',         coords:[17.728,-87.570],radio:5000,sst:'30.9°C',dhw:0.33,viento:'E 27 km/h', enDescanso:false, sotaventoDe:'O', estado:getEstadoZona(0.33), prediccion:'Salida 5:30 AM. Oeste de Hol Chan (sotavento), 8–12 m. DHW bajo — excelentes condiciones.',alerta:'Estrés térmico con DHW subiendo.',blanqueamiento:predLocalBlanqueamiento(0.33)},
]
function reefApiAZonaPesca(reef) {
  const meta=PESCA_META[reef.slug]; if(!meta)return null
  const v=reef.viento??{}, d=reef.datos??{}, dhw=d.dhw??0
  const lat=reef.coordenadas?.lat??0, lon=reef.coordenadas?.lon??0
  const coords=v.direccion_grados!=null?calcularSotavento(lat,lon,v.direccion_grados):[lat,lon-0.08]
  const radio=calcularRadio(v.velocidad_kmh??20,dhw)
  const enDescanso=debeRotar(reef.slug)
  const estado=enDescanso?{color:'#6366f1',label:'DESCANSO',permitida:false,maxLanchas:0,descripcion:'Esta zona descansa hoy.'}:getEstadoZona(dhw)
  const zonaBase = {id:meta.id,nombre:meta.nombre,coords,radio,enDescanso,estado,
    sst:d.sst_max!=null?`${d.sst_max}°C`:'—',dhw,cobertura:reef.cobertura??null,
    viento:v.velocidad_kmh!=null?`${v.direccion_cardinal??''} ${v.velocidad_kmh} km/h`:'—',
    sotaventoDe:v.direccion_cardinal??'?',
    tendencia:reef.tendencia??null,
    alerta:reef.predictions?.alerta??'',fecha:reef.fecha??''}
  zonaBase.prediccion    = reef.predictions?.pesca        || predLocalPesca(zonaBase)
  zonaBase.blanqueamiento= reef.predictions?.blanqueamiento || predLocalBlanqueamiento(dhw)
  zonaBase.salud         = reef.predictions?.salud        || `Cobertura ${reef.cobertura??'—'}%. ${estado.descripcion}`
  return zonaBase
}

// ── PFZ sintético local (sin backend) ────────────────────────────────────────
// Genera frentes térmicos simulados centrados en la zona de pesca activa.
// Deriva los puntos día a día con corriente local.
function generarPfzLocal(zona = null) {
  const cLat = zona?.coords?.[0] ?? 13.10
  const cLon = zona?.coords?.[1] ?? -89.60
  const nombre = zona?.nombre ?? 'la zona'
  // Semillas relativas al centro de la zona activa
  const OFFSETS = [
    { dLat:  0.00, dLon:  0.00, grad: 0.013 },
    { dLat:  0.15, dLon: -0.20, grad: 0.010 },
    { dLat: -0.20, dLon:  0.15, grad: 0.012 },
    { dLat:  0.25, dLon:  0.25, grad: 0.008 },
    { dLat: -0.10, dLon: -0.30, grad: 0.011 },
    { dLat:  0.30, dLon: -0.10, grad: 0.007 },
  ]
  // Corriente dominante según latitud (Pacífico vs Caribe)
  const isPacific = cLon < -87
  const DRIFT_LON = isPacific ? -0.10 : -0.07
  const DRIFT_LAT = isPacific ? -0.04 : -0.02
  const sst0 = zona?.sst ? parseFloat(zona.sst) : (isPacific ? 28.8 : 29.5)
  const CONSEJOS = [
    `Salir 5:00–6:00 AM hacia zona alta cerca de ${nombre}. Frente activo hoy.`,
    `Frente desplazado al O. Alta productividad a 15–20 km de ${nombre}. Salir 5:30 AM.`,
    `Proyección favorable. Zona alta detectada — explorar {coord}.`,
    `Frentes moderados. Buscar aguas entre ${(sst0-0.5).toFixed(1)}–${(sst0+0.5).toFixed(1)}°C.`,
    `Corriente favorece peces pelágicos al sur de la zona central.`,
    `Frente térmico consolidado cerca de {coord}. Máxima probabilidad primeras horas.`,
    `Dispersión leve de frentes. Navegar entre puntos de alta prob. con GPS.`,
    `Nuevo frente emergente. Alta probabilidad en aguas de ${sst0.toFixed(1)}°C.`,
  ]
  const hoy = new Date()
  const dias = []
  for (let d = 0; d < 8; d++) {
    const fecha = new Date(hoy); fecha.setDate(fecha.getDate() + d)
    const fechaStr = fecha.toISOString().slice(0, 10)
    const puntosAlta = []; const puntosMedia = []
    for (const o of OFFSETS) {
      const lat = +(cLat + o.dLat + DRIFT_LAT * d).toFixed(4)
      const lng = +(cLon + o.dLon + DRIFT_LON * d).toFixed(4)
      const grad = o.grad * Math.max(0.4, 1 - d * 0.07)
      const intensidad = Math.min(1, grad / 0.005)
      const sst = +(sst0 + (Math.random() - 0.5) * 0.4).toFixed(2)
      const ptoBase = { lat, lng, sst, intensidad: +intensidad.toFixed(2) }
      if (grad >= 0.010) puntosAlta.push(ptoBase)
      else if (grad >= 0.006) puntosMedia.push(ptoBase)
      const offset = 0.10
      ;[[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dl,dg]) => {
        const g2 = grad * (0.55 + Math.random() * 0.35)
        const pto = { lat:+(lat+dl*offset).toFixed(4), lng:+(lng+dg*offset).toFixed(4), sst, intensidad:+Math.min(1,g2/0.005).toFixed(2) }
        if (g2 >= 0.010) puntosAlta.push(pto)
        else puntosMedia.push(pto)
      })
    }
    const centroideAlta = puntosAlta.length ? {
      lat: +(puntosAlta.reduce((s,p)=>s+p.lat,0)/puntosAlta.length).toFixed(3),
      lng: +(puntosAlta.reduce((s,p)=>s+p.lng,0)/puntosAlta.length).toFixed(3),
    } : null
    const coord = centroideAlta ? `${centroideAlta.lat}°N ${Math.abs(centroideAlta.lng).toFixed(2)}°O` : 'zona central'
    const consejo = CONSEJOS[d].replace('{coord}', coord)
    dias.push({
      dia: d, fecha: fechaStr,
      puntos_alta: puntosAlta, puntos_media: puntosMedia,
      resumen: {
        n_alta: puntosAlta.length, n_media: puntosMedia.length,
        centroide_alta: centroideAlta,
        sst_media_c: +(puntosAlta.concat(puntosMedia).reduce((s,p)=>s+p.sst,0)/Math.max(1,puntosAlta.length+puntosMedia.length)).toFixed(1),
        consejo_pescador: consejo,
      }
    })
  }
  return {
    zona: nombre,
    fecha_sst: hoy.toISOString().slice(0,10),
    generado_en: new Date().toISOString(),
    sst_stats: { mean_c: sst0 },
    dias, _fuente: 'sintético-local',
  }
}

// ── Predicción local de pesca (no requiere API) ──────────────────────────────
function predLocalPesca(zona) {
  const dhw     = zona.dhw ?? 0
  const nombre  = zona.nombre ?? 'la zona'
  const viento  = zona.viento ?? ''
  const sst     = zona.sst ?? '—'
  const lado    = zona.sotaventoDe ?? 'O'
  const estado  = zona.estado ?? getEstadoZona(dhw)

  if (!estado.permitida) {
    return `⛔ ${nombre} en veda hoy. DHW ${dhw.toFixed(1)} — coral bajo estrés severo. Evitar la zona y permitir recuperación.`
  }

  const hora  = dhw > 4 ? '5:00–5:30 AM' : dhw > 1 ? '5:00–6:00 AM' : '5:30–6:30 AM'
  const prof  = dhw > 4 ? 'aguas profundas (>20 m), lejos del coral' : dhw > 1 ? '15–25 m, lado protegido' : '8–20 m'
  const tip   = dhw > 4
    ? 'Anclar solo en arena. No bucear sobre coral.'
    : dhw > 1
    ? `Trabajar lado ${lado} (sotavento). Respetar tallas mínimas.`
    : `Salida ideal por lado ${lado}. Coral en buenas condiciones — anclar solo en arena.`

  const sstTxt = sst !== '—' ? ` SST ${sst}.` : ''
  const vientoTxt = viento && viento !== '—' ? ` Viento ${viento}.` : ''

  return `Salida recomendada ${hora} en ${nombre}.${sstTxt}${vientoTxt} Pescar a ${prof}. ${tip}`
}

function predLocalBlanqueamiento(dhw) {
  if (dhw > 8)  return `DHW ${dhw.toFixed(1)} — blanqueamiento severo activo. Recuperación estimada: 6–12 semanas si baja la temperatura.`
  if (dhw > 4)  return `DHW ${dhw.toFixed(1)} — riesgo alto de blanqueamiento próximos 7 días. Evitar perturbaciones adicionales.`
  if (dhw > 1)  return `DHW ${dhw.toFixed(1)} — estrés leve. Sin blanqueamiento inminente, pero vigilar si SST sigue subiendo.`
  return `DHW ${dhw.toFixed(1)} — coral sano. Sin riesgo de blanqueamiento en el horizonte próximo.`
}

// ── Iconos Leaflet ────────────────────────────────────────────────────────────
function createFishIcon(activo=false) {
  const s=activo?38:32
  return L.divIcon({className:'',iconSize:[s,s],iconAnchor:[s/2,s/2],html:`
    <div class="wp-float" style="width:${s}px;height:${s}px;background:${activo?'rgba(6,182,212,0.25)':'rgba(6,182,212,0.1)'};
      border:1px solid ${activo?'rgba(6,182,212,0.9)':'rgba(6,182,212,0.4)'};
      display:flex;align-items:center;justify-content:center;font-size:${activo?20:16}px;
      box-shadow:0 0 ${activo?16:8}px rgba(6,182,212,${activo?0.5:0.2})">🎣</div>`})
}
const STATUS_COLORS = {sano:BRAND.plum,moderado:BRAND.sand,riesgo:BRAND.clay,critico:BRAND.coral}
const STATUS_LABELS = {sano:'Sano',moderado:'Estrés Térmico',riesgo:'En Riesgo',critico:'Blanqueamiento Severo'}
function getDHWPorEstado(e){return e==='sano'?2:e==='moderado'?5:e==='riesgo'?9:13}
function createGlowIcon(estado, activo=false){
  const color = STATUS_COLORS[estado] ?? '#34d399'
  const w = activo ? 36 : 28
  const h = activo ? 48 : 38
  const cx = w/2, cy = h*0.36
  // Anillos sonar dobles — más visibles cuando activo, sutiles cuando no
  const sonarSize = activo ? 44 : 32
  const sonarOff  = -(sonarSize/2 - cx)
  const rings = `
    <div class="sonar-ring" style="width:${sonarSize}px;height:${sonarSize}px;top:${cy - sonarSize/2}px;left:${sonarOff}px;border:2px solid ${color};opacity:0.8"></div>
    <div class="sonar-ring2" style="width:${sonarSize*0.75}px;height:${sonarSize*0.75}px;top:${cy - sonarSize*0.375}px;left:${sonarOff + sonarSize*0.125}px;border:1.5px solid ${color};opacity:0.6"></div>
  `
  const svgPin = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="position:relative;z-index:2">
    <defs>
      <filter id="glow-${estado}-${activo}">
        <feGaussianBlur stdDeviation="${activo?3:1.8}" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <path d="M${cx} ${h-2} C${cx} ${h-2} ${w*0.1} ${h*0.54} ${w*0.1} ${cy}
             A${w*0.4} ${w*0.4} 0 1 1 ${w*0.9} ${cy}
             C${w*0.9} ${h*0.54} ${cx} ${h-2} ${cx} ${h-2}Z"
          fill="${color}" filter="url(#glow-${estado}-${activo})" opacity="${activo?1:0.88}"/>
    <circle cx="${cx}" cy="${cy}" r="${w*0.17}" fill="white" opacity="0.95"/>
    ${activo ? `<circle cx="${cx}" cy="${cy}" r="${w*0.09}" fill="${color}" opacity="0.8"/>` : ''}
  </svg>`

  return L.divIcon({
    className: '',
    iconSize:    [w, h],
    iconAnchor:  [w/2, h],
    popupAnchor: [0, -h],
    html: `<div class="wp-float${activo?' wp-float--activo':''}" style="position:relative;width:${w}px;height:${h}px">${rings}${svgPin}</div>`,
  })
}
function MapReady(){const map=useMap();useEffect(()=>{setTimeout(()=>map.invalidateSize(),100)},[map]);return null}
function CustomZoom(){
  const map=useMap()
  const btn={
    width:36,height:36,border:'1px solid rgba(43,20,84,0.18)',borderRadius:10,cursor:'pointer',
    fontFamily:'system-ui',fontWeight:900,fontSize:18,lineHeight:'34px',textAlign:'center',
    background:'rgba(251,250,247,0.93)',backdropFilter:'blur(12px)',
    color:BRAND.ink,display:'flex',alignItems:'center',justifyContent:'center',
    boxShadow:'0 4px 12px rgba(43,20,84,0.14)',transition:'background 0.15s',userSelect:'none',
  }
  return(
    <div style={{position:'absolute',top:100,left:16,zIndex:1000,display:'flex',flexDirection:'column',gap:5}}>
      <div role="button" style={btn} onMouseDown={e=>{e.preventDefault();map.zoomIn()}} title="Acercar">＋</div>
      <div role="button" style={btn} onMouseDown={e=>{e.preventDefault();map.zoomOut()}} title="Alejar">－</div>
    </div>
  )
}

const API_URL = import.meta.env.VITE_API_URL ?? 'https://hackaton-ambiental-production.up.railway.app'
const SP_COLORS = [BRAND.ink,BRAND.plum,BRAND.magenta,BRAND.clay,BRAND.sand]
const SP_PCT    = [100,94,61,80]

// ── Componentes UI ────────────────────────────────────────────────────────────
function Label({children, dark=false}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
      <span style={{fontFamily:MONO,fontWeight:700,fontSize:9,
        color: dark ? '#94a3b8' : '#38bdf8',
        letterSpacing:'0.22em',textTransform:'uppercase',whiteSpace:'nowrap'}}>{children}</span>
      <div style={{flex:1,height:1,background: dark
        ? 'linear-gradient(to right, rgba(15,23,42,0.14), transparent)'
        : 'linear-gradient(to right, rgba(56,189,248,0.2), transparent)'}}/>
    </div>
  )
}
function MetricBox({label,value,color}){
  return(
    <div style={{background:'rgba(248,250,252,0.88)',border:'1px solid rgba(15,23,42,0.12)',borderRadius:16,padding:'12px 14px',position:'relative',overflow:'hidden',backdropFilter:'blur(10px)',boxShadow:'0 12px 28px rgba(2,6,23,0.12)'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:color,opacity:0.8}}/>
      <div style={{fontFamily:FONT_SANS,fontWeight:800,fontSize:9,color:'#64748b',letterSpacing:'0.15em',marginBottom:6}}>{label}</div>
      <div style={{fontFamily:FONT_DATA,fontSize:22,fontWeight:700,lineHeight:1,color}}>{value}</div>
    </div>
  )
}
function extraerHorario(texto) {
  const match = String(texto ?? '').match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?(?:\s*[–-]\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)?)/i)
  return match?.[1] ?? 'Temprano, antes del viento fuerte'
}
function nivelHumano(dhw) {
  if (dhw >= 8) return 'Muy alto'
  if (dhw >= 4) return 'Alto'
  if (dhw >= 1) return 'Medio'
  return 'Bajo'
}
function saludCoral(dhw) {
  return Math.max(6, Math.min(98, Math.round(96 - (dhw ?? 0) * 10)))
}
function textoSalud(score) {
  if (score >= 80) return 'Salud estable'
  if (score >= 55) return 'Vigilar de cerca'
  if (score >= 30) return 'Estres alto'
  return 'Riesgo critico'
}
function consejoPescaArrecife(zona) {
  if (zona.estado === 'critico') return 'Evitar pesca cerca del coral. Buscar zonas arenosas o aguas mas profundas.'
  if (zona.estado === 'riesgo') return 'Pescar con cupo bajo y sin anclar sobre coral. Mejor salir temprano.'
  if (zona.estado === 'moderado') return 'Pesca responsable permitida. Mantener distancia del coral somero.'
  return 'Zona favorable para pesca responsable. Cuidar tallas minimas y evitar dañar el fondo.'
}
function consejoCuidadoArrecife(zona) {
  if (zona.estado === 'critico') return 'Prioridad alta: reportar blanqueamiento, reducir turismo intenso y evitar contacto.'
  if (zona.estado === 'riesgo') return 'Vigilar cambios de color y temperatura. Evitar anclas y actividad intensa.'
  if (zona.estado === 'moderado') return 'Monitorear esta semana y mantener buenas practicas de navegación.'
  return 'Arrecife estable. Mantener monitoreo y pesca responsable para conservarlo.'
}
function weeklySeries(zona) {
  const dhw = zona?.tendencia?.dhw_serie?.map(Number).filter(n=>Number.isFinite(n))
  if (dhw?.length) return dhw.slice(-7)
  const now = Number(zona?.dhw ?? 0)
  return [0.82,0.88,0.94,1,1.06,1.12,1.18].map(x=>Math.max(0,Number((now*x).toFixed(2))))
}
function KoralioBadge(){
  return (
    <div style={{
      position:'absolute',top:16,left:16,zIndex:1000,
      display:'flex',alignItems:'center',gap:10,
      background:'rgba(251,250,247,0.93)',backdropFilter:'blur(16px)',
      border:'1px solid rgba(43,20,84,0.14)',borderRadius:18,
      boxShadow:'0 18px 42px rgba(43,20,84,0.18)',
      padding:'10px 13px'
    }}>
      <div style={{
        width:34,height:34,borderRadius:'48% 52% 46% 54%',
        background:`linear-gradient(135deg, ${BRAND.sand}, ${BRAND.coral} 45%, ${BRAND.plum} 78%, ${BRAND.ink})`,
        position:'relative',boxShadow:`inset 0 0 0 1px rgba(255,255,255,0.45), 0 8px 16px ${BRAND.plum}33`
      }}>
        <span style={{position:'absolute',left:9,top:5,width:1,height:24,background:'rgba(255,255,255,0.38)',transform:'rotate(18deg)'}}/>
        <span style={{position:'absolute',left:17,top:4,width:1,height:25,background:'rgba(255,255,255,0.28)',transform:'rotate(-16deg)'}}/>
        <span style={{position:'absolute',left:5,top:16,width:24,height:1,background:'rgba(255,255,255,0.32)',transform:'rotate(9deg)'}}/>
      </div>
      <div>
        <div style={{fontSize:17,fontWeight:950,color:BRAND.ink,letterSpacing:'0.09em',lineHeight:1}}>KORALIO</div>
        <div style={{fontSize:8,fontWeight:900,color:BRAND.coral,letterSpacing:'0.18em',marginTop:3}}>REEF WATCH</div>
      </div>
    </div>
  )
}
function WeeklyChart({zona}) {
  const data = weeklySeries(zona)
  const max = Math.max(1,...data)
  const points = data.map((v,i)=>`${18+i*(244/(data.length-1))},${112-(v/max)*76}`).join(' ')
  const area = `18,116 ${points} 262,116`
  return (
    <div style={{background:'rgba(248,250,252,0.84)',border:'1px solid rgba(15,23,42,0.12)',boxShadow:'0 14px 36px rgba(2,6,23,0.16)',padding:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
        <div>
          <div style={{fontSize:14,fontWeight:800,color:'#0f172a'}}>Prediccion semanal</div>
          <div style={{fontSize:11,color:'#64748b'}}>Acumulacion de calor DHW, 7 dias</div>
        </div>
        <div style={{fontFamily:MONO,fontSize:10,color:BRAND.plum,background:'rgba(91,31,104,0.1)',padding:'4px 7px'}}>DHW</div>
      </div>
      <svg viewBox="0 0 280 128" style={{width:'100%',height:128,display:'block'}}>
        {[34,58,82,106].map(y=><line key={y} x1="18" x2="262" y1={y} y2={y} stroke="rgba(15,23,42,0.08)" strokeWidth="1"/>)}
        <polygon points={area} fill="rgba(180,58,130,0.16)"/>
        <polyline points={points} fill="none" stroke={BRAND.magenta} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        {data.map((v,i)=><circle key={i} cx={18+i*(244/(data.length-1))} cy={112-(v/max)*76} r="3.5" fill={BRAND.magenta}/>)}
        {['Hoy','D2','D3','D4','D5','D6','D7'].map((d,i)=><text key={d} x={18+i*(244/6)} y="126" textAnchor="middle" fontSize="9" fill="#64748b">{d}</text>)}
      </svg>
    </div>
  )
}
function DecisionCard({label, value, detail, color}) {
  return (
    <div style={{background:'rgba(248,250,252,0.88)',border:'1px solid rgba(15,23,42,0.12)',borderTop:`3px solid ${color}`,boxShadow:'0 14px 36px rgba(2,6,23,0.14)',padding:'14px 15px'}}>
      <div style={{fontSize:11,color:'#64748b',fontWeight:700,marginBottom:8}}>{label}</div>
      <div style={{fontSize:24,fontWeight:900,color:'#0f172a',lineHeight:1.05,marginBottom:8}}>{value}</div>
      <div style={{fontSize:12,color:'#475569',lineHeight:1.45,fontWeight:600}}>{detail}</div>
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
  const [alertaEstado,     setAlertaEstado]     = useState(null) // null | 'sending' | 'ok' | 'error'
  const [tab,              setTab]              = useState('arrecife')
  const [panelWidth,       setPanelWidth]       = useState(380)
  const [prediccionViva,   setPrediccionViva]   = useState(null)
  const [loadingPrediccion,setLoadingPrediccion]= useState(false)
  const [loadingProyeccion,setLoadingProyeccion]= useState(false)
  const [diaPrediccion,   setDiaPrediccion]    = useState(0)
  const [slide,           setSlide]            = useState(0)
  const [infoOculta,       setInfoOculta]       = useState(false)
  const [twinPos,          setTwinPos]          = useState({ x: null, y: 20 })
  const [pfzData,          setPfzData]          = useState(null)
  const [pfzDia,           setPfzDia]           = useState(0)

  const [twinWidth,        setTwinWidth]        = useState(760)
  const [infoHeight,       setInfoHeight]       = useState(260)

  // Mapeo zona frontend → ID del endpoint /api/zona/{id}
  const ZONA_API_ID = {
    los_cobanos:    'los_cobanos',
    barra_santiago: 'barra_santiago',
    roatan:         'roatan',
    cozumel:        'cozumel',
    cayos_miskitos: 'cayos_miskitos',
    pesca_roatan:   'roatan',
    pesca_nicaragua:'cayos_miskitos',
    pesca_cozumel:  'cozumel',
  }

  async function fetchPrediccionViva(zonaId, zonaObj = null) {
    const apiId = ZONA_API_ID[zonaId]
    if (!apiId) return
    setLoadingPrediccion(true)
    setPrediccionViva(null)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 12000)
    try {
      const res  = await fetch(`${API_URL}/api/zona/${apiId}/estado-completo`, { signal: ctrl.signal })
      const data = await res.json()
      if (data.alerta_pescador) {
        setPrediccionViva({
          alerta: data.alerta_pescador,
          veda:   data.veda   ?? null,
          temp:   data.temperatura_c ?? null,
          dhw:    data.dhw    ?? null,
        })
      } else {
        // API respondió pero sin texto útil → usar predicción local
        setPrediccionViva(null)
      }
    } catch {
      // Timeout, red caída o 500 → no mostrar error, el fallback local se muestra
      setPrediccionViva(null)
    } finally {
      clearTimeout(timer)
      setLoadingPrediccion(false)
    }
  }

  async function fetchProyeccionSemanal(zonaId) {
    const apiId = ZONA_API_ID[zonaId]
    if (!apiId) return
    setLoadingProyeccion(true)
    try {
      const res = await fetch(`${API_URL}/api/zona/${apiId}/prediccion-semanal`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const proyeccion = data.proyeccion_diaria ?? []
      const attach = z => z && z.id === zonaId
        ? { ...z, proyeccion_diaria: proyeccion, prediccionSemanal: data }
        : z
      setZonaActiva(prev => attach(prev))
      setZonasReales(prev => prev.map(attach))
    } catch {
      const fallback = zonaActiva?.dhw != null
        ? [{ dia: 0, dhw: zonaActiva.dhw, baa: zonaActiva.baa_numeric ?? 0, fuente: 'dato actual' }]
        : []
      setZonaActiva(prev => prev && prev.id === zonaId ? { ...prev, proyeccion_diaria: fallback } : prev)
    } finally {
      setLoadingProyeccion(false)
    }
  }
  const isDragging  = useRef(false)
  const startX      = useRef(0)
  const startWidth  = useRef(0)
  const twinDragging = useRef(false)
  const twinStartX   = useRef(0)
  const twinStartY   = useRef(0)
  const twinStartPos = useRef({ x: 0, y: 20 })
  const twinPanelRef = useRef(null)
  const twinResizeMode = useRef(null)
  const twinStartWidth = useRef(760)
  const twinStartInfoHeight = useRef(260)

  const onDragStart = useCallback((e)=>{
    isDragging.current=true; startX.current=e.clientX; startWidth.current=panelWidth
    document.body.style.cursor='col-resize'; document.body.style.userSelect='none'
  },[panelWidth])

  const onTwinDragStart = useCallback((e)=>{
    if (e.target.closest('button')) return
    const rect = twinPanelRef.current?.getBoundingClientRect()
    const current = {
      x: twinPos.x ?? rect?.left ?? Math.max(240, window.innerWidth - 780),
      y: twinPos.y ?? rect?.top ?? 20,
    }
    twinDragging.current = true
    twinStartX.current = e.clientX
    twinStartY.current = e.clientY
    twinStartPos.current = current
    setTwinPos(current)
    document.body.style.cursor='move'
    document.body.style.userSelect='none'
  },[twinPos])

  const onTwinResizeStart = useCallback((e, mode)=>{
    e.preventDefault()
    e.stopPropagation()
    const rect = twinPanelRef.current?.getBoundingClientRect()
    const current = {
      x: twinPos.x ?? rect?.left ?? Math.max(240, window.innerWidth - twinWidth - 20),
      y: twinPos.y ?? rect?.top ?? 20,
    }
    twinResizeMode.current = mode
    twinStartX.current = e.clientX
    twinStartY.current = e.clientY
    twinStartPos.current = current
    twinStartWidth.current = rect?.width ?? twinWidth
    twinStartInfoHeight.current = infoHeight
    setTwinPos(current)
    document.body.style.cursor = mode === 'width' ? 'ew-resize' : 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [twinPos, twinWidth, infoHeight])

  useEffect(()=>{
    const onMove=(e)=>{
      if(isDragging.current){
        const dx=startX.current-e.clientX
        setPanelWidth(Math.min(Math.max(startWidth.current+dx,280),window.innerWidth*0.85))
      }
      if(twinDragging.current){
        const dx=e.clientX-twinStartX.current
        const dy=e.clientY-twinStartY.current
        const panelW=twinPanelRef.current?.offsetWidth ?? 760
        const panelH=twinPanelRef.current?.offsetHeight ?? 700
        setTwinPos({
          x: Math.min(Math.max(twinStartPos.current.x + dx, 230), window.innerWidth - panelW - 12),
          y: Math.min(Math.max(twinStartPos.current.y + dy, 8), window.innerHeight - panelH + 80),
        })
      }
      if(twinResizeMode.current === 'width'){
        const dx=e.clientX-twinStartX.current
        const maxWidth=Math.min(window.innerWidth - 245, 1100)
        const newWidth=Math.min(Math.max(twinStartWidth.current - dx, 520), maxWidth)
        const newX=Math.min(Math.max(twinStartPos.current.x + dx, 230), window.innerWidth - newWidth - 12)
        setTwinWidth(newWidth)
        setTwinPos(pos => ({ ...pos, x: newX }))
      }
      if(twinResizeMode.current === 'info'){
        const dy=e.clientY-twinStartY.current
        const panelH=twinPanelRef.current?.offsetHeight ?? window.innerHeight - 40
        setInfoHeight(Math.min(Math.max(twinStartInfoHeight.current - dy, 110), Math.max(140, panelH - 340)))
      }
    }
    const onUp=()=>{
      if(!isDragging.current && !twinDragging.current && !twinResizeMode.current)return
      isDragging.current=false
      twinDragging.current=false
      twinResizeMode.current=null
      document.body.style.cursor=''
      document.body.style.userSelect=''
    }
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp)
    return()=>{window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp)}
  },[])

  useEffect(()=>{
    let c=false
    fetch('/data/Mesoamerica.geojson').then(r=>{if(!r.ok)throw r;return r.json()}).then(d=>{if(!c)setReefGeoJson(d)}).catch(()=>{})
    return()=>{c=true}
  },[])

  // PFZ se genera al abrir una zona de pesca (abrirPesca)

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

  async function enviarAlertaMake() {
    const webhookUrl = import.meta.env.VITE_MAKE_WEBHOOK
    if (!webhookUrl) {
      alert('Agrega VITE_MAKE_WEBHOOK en el .env del frontend')
      return
    }
    setAlertaEstado('sending')

    // Construir payload con la zona activa (o un resumen general si no hay zona abierta)
    const zona = zonaActiva
    const payload = zona ? {
      arrecife:        zona.nombre,
      pais:            zona.pais ?? '',
      nivel_de_alerta: STATUS_LABELS[zona.estado] ?? zona.estado ?? 'Desconocido',
      estado:          zona.estado ?? '',
      dhw:             zona.dhw ?? 0,
      sst:             zona.sst ?? 0,
      cobertura_coral: zona.cobertura ? `${zona.cobertura}%` : '',
      mensaje_pescador: zona.predictions?.alerta ?? zona.descripcion ?? '',
      fecha:           new Date().toLocaleDateString('es-SV', { day:'2-digit', month:'long', year:'numeric' }),
      fuente:          'CoralWatch — NOAA Coral Reef Watch',
    } : {
      arrecife:        'Todos los arrecifes monitoreados',
      nivel_de_alerta: 'Ver reporte completo',
      fecha:           new Date().toLocaleDateString('es-SV', { day:'2-digit', month:'long', year:'numeric' }),
      fuente:          'CoralWatch — NOAA Coral Reef Watch',
    }

    try {
      // Enviar directo al webhook de Make (evita filtro de nivel crítico del backend)
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Make respondió ${res.status}`)
      setAlertaEstado('ok')
      setTimeout(() => setAlertaEstado(null), 4000)
    } catch (e) {
      console.error('[Make]', e)
      setAlertaEstado('error')
      setTimeout(() => setAlertaEstado(null), 4000)
    }
  }

  function abrirArrecife(z){
    setDiaPrediccion(0)
    setZonaActiva(z)
    setPescaActiva(null)
    setPfzData(null)   // cierra el slider PFZ al ver arrecife 3D
    setPfzDia(0)
    setPanelWidth(window.innerWidth*0.45)
    setInfoOculta(false)
    fetchPrediccionViva(z.id)
    fetchProyeccionSemanal(z.id)
  }
  // fetchPfz ya no se usa — PFZ se genera localmente en abrirPesca(z)

  function abrirPesca(z) {
    setPescaActiva(z)
    setZonaActiva(null)
    setPanelWidth(420)
    setPfzDia(0)
    // Generar PFZ centrado en esta zona específica (inmediato, sin API)
    setPfzData(generarPfzLocal(z))
    fetchPrediccionViva(z.id)
  }

  const panelAbierto = pescaActiva
  const cfgActiva    = zonaActiva ? CFG[zonaActiva.estado] : null
  const proyeccionActiva = zonaActiva?.proyeccion_diaria ?? []
  const puntoPrediccion = proyeccionActiva[diaPrediccion] ?? proyeccionActiva[0] ?? null
  const dhwVisual = puntoPrediccion?.dhw ?? zonaActiva?.dhw ?? 0
  const baaVisual = puntoPrediccion?.baa ?? zonaActiva?.baa_numeric ?? 0
  const zonasOrdenadas = [...zonasPesca].sort((a,b)=>(a.dhw??0)-(b.dhw??0))
  const mejorZona = zonasOrdenadas.find(z=>z.estado?.permitida) ?? zonasOrdenadas[0]
  const zonaRiesgo = [...zonasPesca].sort((a,b)=>(b.dhw??0)-(a.dhw??0))[0]
  const zonaGuia = pescaActiva ?? mejorZona
  const colorGuia = zonaGuia?.estado?.color ?? '#34d399'
  const decisionPesca = zonaGuia?.estado?.permitida ? 'Si se puede salir' : 'Mejor descansar la zona'
  const detallePesca = zonaGuia?.estado?.permitida
    ? `${zonaGuia.nombre}: salir ${extraerHorario(zonaGuia.prediccion)} y pescar del lado protegido.`
    : `${zonaGuia?.nombre ?? 'Zona seleccionada'} necesita recuperacion hoy.`
  const resumenProximosDias = zonaRiesgo?.blanqueamiento ?? zonaRiesgo?.alerta ?? 'Sin prediccion disponible.'
  const saludHoy = saludCoral(zonaGuia?.dhw)
  const zonasSeguras = zonasPesca.filter(z=>z.estado?.permitida).sort((a,b)=>(a.dhw??0)-(b.dhw??0)).slice(0,3)
  const slides = [
    { key:'salud', title:'Salud del coral', eyebrow:'Hoy', color:colorGuia },
    { key:'semana', title:'Prediccion semanal', eyebrow:'Proximos 7 dias', color:colorGuia },
    { key:'pesca', title:'Zonas seguras', eyebrow:'Pesca responsable', color:colorGuia },
  ]
  const activeSlide = slides[slide % slides.length]

  return (
    <div style={{display:'flex',height:'100vh',background:BG0,overflow:'hidden',fontFamily:FONT_SANS}}>

      {/* ══ SIDEBAR IZQUIERDO ══ */}
      <div style={{
        width:260,flexShrink:0,
          background:`linear-gradient(180deg, ${BRAND.paper}, rgba(245,239,232,0.97))`,
        backdropFilter:'blur(24px)',
        borderRight:'1px solid rgba(15,23,42,0.12)',
        boxShadow:'18px 0 44px rgba(2,6,23,0.16)',
        display:'flex',flexDirection:'column'
      }}>

        {/* Logo + impacto */}
        <div style={{padding:'20px 20px 14px',borderBottom:'1px solid rgba(43,20,84,0.12)',background:'rgba(255,255,255,0.78)'}}>
          <div style={{fontFamily:FONT_SANS,fontWeight:800,fontSize:9,color:BRAND.coral,letterSpacing:'0.25em',marginBottom:4}}>SYS // MONITOR · VEDA DINÁMICA</div>
          <div style={{fontSize:22,fontWeight:950,color:BRAND.ink,letterSpacing:'0.08em'}}>KORALIO</div>
          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4,marginBottom:12}}>
            <div style={{fontFamily:FONT_SANS,fontWeight:800,fontSize:9,color:BRAND.plum,letterSpacing:'0.2em'}}>CARIBE · NOAA · LIVE</div>
            <div style={{fontFamily:MONO,fontSize:8,color:apiOnline?'#10b981':'#94a3b8',background:apiOnline?'rgba(16,185,129,0.1)':'rgba(148,163,184,0.1)',padding:'2px 5px',borderRadius:4,whiteSpace:'nowrap'}}>
              {apiOnline ? '● EN VIVO' : '● CACHE'}
            </div>
          </div>
          {/* Números de impacto */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
            {[
              {n:'5',label:'arrecifes'},
              {n:'1,800+',label:'pescadores'},
              {n:'NOAA',label:'satélite'},
            ].map(({n,label})=>(
              <div key={label} style={{textAlign:'center',background:'rgba(91,31,104,0.07)',border:'1px solid rgba(91,31,104,0.12)',padding:'7px 4px',borderRadius:8}}>
                <div style={{fontFamily:MONO,fontWeight:900,fontSize:13,color:BRAND.ink,lineHeight:1}}>{n}</div>
                <div style={{fontFamily:FONT_SANS,fontWeight:700,fontSize:8,color:'#64748b',letterSpacing:'0.12em',textTransform:'uppercase',marginTop:2}}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid rgba(15,23,42,0.12)',background:'rgba(226,232,240,0.65)',padding:6,gap:6}}>
          {[['arrecife','🪸 Arrecife'],['pesca','🎣 Pesca']].map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              flex:1,padding:'12px 4px',fontFamily:FONT_SANS,fontWeight:600,fontSize:10,letterSpacing:'0.15em',textTransform:'uppercase',cursor:'pointer',
              background:tab===t?'rgba(255,255,255,0.9)':'transparent',
              border:'1px solid rgba(15,23,42,0.08)',
              borderBottom:tab===t?`2px solid ${BRAND.coral}`:'1px solid rgba(15,23,42,0.08)',
              color:tab===t?BRAND.ink:'#64748b',
              boxShadow:tab===t?'0 8px 18px rgba(15,23,42,0.08)':'none',
            }}>{label}</button>
          ))}
        </div>

        {/* Banner principal: decisión del pescador — refleja zona activa */}
        {(()=>{
          // Prioridad: arrecife activo → zona pesca activa → mejor zona general
          const zonaRef = zonaActiva
            ? zonasPesca.find(z => z.id === zonaActiva.id || z.nombre === zonaActiva.nombre) ?? mejorZona
            : pescaActiva ?? mejorZona
          if (!zonaRef) return null

          // Si viene de un arrecife, derivar estado desde DHW
          const estadoBanner = zonaRef.estado ?? getEstadoZona(zonaRef.dhw ?? zonaActiva?.dhw ?? 0)
          const bannerColor  = estadoBanner?.color ?? '#34d399'
          const permitida    = estadoBanner?.permitida ?? true
          const nombre       = zonaActiva?.nombre ?? zonaRef.nombre
          const dhw          = zonaActiva?.dhw ?? zonaRef.dhw ?? 0
          const maxLanchas   = estadoBanner?.maxLanchas ?? estadoBanner?.max_lanchas ?? '—'

          return (
          <div style={{
            margin:'10px 12px 0',
            padding:'11px 13px',
            background: permitida
              ? `linear-gradient(135deg,${bannerColor}18,${bannerColor}08)`
              : 'linear-gradient(135deg,rgba(239,68,68,0.1),rgba(185,28,28,0.05))',
            border:`1.5px solid ${bannerColor}55`,
            borderRadius:12,
            animation: permitida ? 'glowPulse 3s ease-in-out infinite' : 'none',
            color: bannerColor,
            transition:'all 0.3s ease',
          }}>
            <div style={{fontFamily:MONO,fontWeight:800,fontSize:8,color:'#94a3b8',letterSpacing:'0.22em',marginBottom:6}}>
              {zonaActiva ? `🪸 ${zonaActiva.pais?.toUpperCase() ?? 'ARRECIFE'}` : '¿SALIR A PESCAR HOY?'}
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
              <div style={{fontFamily:FONT_SANS,fontWeight:900,fontSize:16,color:bannerColor,lineHeight:1.1,letterSpacing:'-0.01em'}}>
                {estadoBanner?.label ?? (permitida ? 'Permitida' : 'Veda')}
              </div>
              <div style={{fontFamily:MONO,fontWeight:800,fontSize:10,color:bannerColor,
                background:`${bannerColor}18`,border:`1px solid ${bannerColor}33`,
                padding:'4px 8px',borderRadius:6,whiteSpace:'nowrap'}}>
                DHW {(dhw).toFixed(1)}
              </div>
            </div>
            <div style={{fontFamily:FONT_SANS,fontSize:10,color:'#475569',marginTop:5,lineHeight:1.4}}>
              {nombre} · máx <strong style={{color:bannerColor}}>{maxLanchas}</strong> lanchas hoy
            </div>
          </div>
          )
        })()}

        {/* Carrusel sencillo para pescadores */}
        {false&&zonaGuia&&(
          <div style={{
            margin:12,background:'rgba(241,245,249,0.92)',border:'1px solid rgba(255,255,255,0.55)',
            boxShadow:'0 18px 42px rgba(2,6,23,0.28)',padding:12,backdropFilter:'blur(18px)'
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:10,color:activeSlide.color,fontWeight:900,letterSpacing:'0.1em',textTransform:'uppercase'}}>{activeSlide.eyebrow}</div>
                <div style={{fontSize:20,fontWeight:950,color:'#0f172a',letterSpacing:0,lineHeight:1.05}}>{activeSlide.title}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <button onClick={()=>setSlide((slide+slides.length-1)%slides.length)} style={{width:28,height:28,border:'1px solid rgba(15,23,42,0.12)',background:'rgba(255,255,255,0.72)',fontWeight:900,cursor:'pointer',color:'#0f172a'}}>‹</button>
                <button onClick={()=>setSlide((slide+1)%slides.length)} style={{width:28,height:28,border:'1px solid rgba(15,23,42,0.12)',background:'rgba(255,255,255,0.72)',fontWeight:900,cursor:'pointer',color:'#0f172a'}}>›</button>
              </div>
            </div>

            {activeSlide.key==='salud'&&(
              <div style={{display:'grid',gap:8}}>
                <DecisionCard label="Salud del coral hoy" value={`${saludHoy}%`} detail={`${textoSalud(saludHoy)} en ${zonaGuia.nombre}. DHW ${zonaGuia.dhw}.`} color={colorGuia}/>
                <DecisionCard label="Pesca de hoy" value={decisionPesca} detail={detallePesca} color={colorGuia}/>
              </div>
            )}

            {activeSlide.key==='semana'&&(
              <div style={{display:'grid',gap:8}}>
                <WeeklyChart zona={zonaGuia}/>
                <div style={{fontSize:12,color:'#334155',fontWeight:700,lineHeight:1.55,background:'rgba(255,255,255,0.62)',border:'1px solid rgba(15,23,42,0.1)',padding:'9px 10px'}}>
                  {resumenProximosDias.slice(0,170)+(resumenProximosDias.length>170?'...':'')}
                </div>
              </div>
            )}

            {activeSlide.key==='pesca'&&(
              <div style={{background:'rgba(248,250,252,0.84)',border:'1px solid rgba(15,23,42,0.12)',boxShadow:'0 12px 28px rgba(2,6,23,0.14)',padding:12}}>
                <div style={{fontSize:14,fontWeight:800,color:'#0f172a',marginBottom:2}}>Zonas de pesca seguras</div>
                <div style={{fontSize:11,color:'#64748b',marginBottom:8}}>Ordenadas por menor estres termico</div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {zonasSeguras.map(z=>(
                    <button key={z.id} onClick={()=>abrirPesca(z)} style={{
                      display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center',textAlign:'left',
                      background:'rgba(255,255,255,0.72)',border:'1px solid rgba(15,23,42,0.1)',padding:'8px 9px',cursor:'pointer'
                    }}>
                      <span>
                        <span style={{display:'block',fontSize:12,fontWeight:800,color:'#0f172a'}}>{z.nombre}</span>
                        <span style={{display:'block',fontSize:10,color:'#64748b'}}>Salir {extraerHorario(z.prediccion)}</span>
                      </span>
                      <span style={{fontFamily:MONO,fontSize:9,fontWeight:800,color:z.estado?.color,background:`${z.estado?.color}18`,padding:'5px 6px'}}>
                        DHW {z.dhw}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:10}}>
              <div style={{display:'flex',gap:6}}>
                {slides.map((s,i)=>(
                  <button key={s.key} onClick={()=>setSlide(i)} aria-label={s.title} style={{
                    width:i===slide?22:7,height:7,borderRadius:999,border:'none',
                    background:i===slide?activeSlide.color:'rgba(15,23,42,0.22)',cursor:'pointer'
                  }}/>
                ))}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,fontWeight:800,color:apiOnline?'#047857':'#92400e'}}>
                <span style={{width:7,height:7,borderRadius:999,background:apiOnline?BRAND.plum:BRAND.sand}}/>
                {apiOnline?'Datos en vivo':'Datos guardados'}
              </div>
            </div>
          </div>
        )}

        {/* Lista de zonas */}
        <div style={{flex:1,overflowY:'auto',padding:'12px'}}>
          {tab==='arrecife' && zonasReales.map(z=>{
            const c=CFG[z.estado]
            const activo=zonaActiva?.id===z.id
            const dhwPct = Math.min(100, ((z.dhw??0)/12)*100)
            const dhwColor = (z.dhw??0)>8?'#ef4444':(z.dhw??0)>4?'#f97316':(z.dhw??0)>1?'#fbbf24':BRAND.plum
            return(
              <button key={z.id} onClick={()=>abrirArrecife(z)} className="reef-card" style={{
                width:'100%',textAlign:'left',padding:'12px 14px 12px 0',
                border:`1px solid ${activo?c.accent+'55':'rgba(15,23,42,0.08)'}`,
                borderRadius:12, cursor:'pointer', marginBottom:7,
                background:activo?'rgba(255,255,255,0.97)':'rgba(255,255,255,0.68)',
                boxShadow:activo?`0 8px 24px ${c.accent}28,0 2px 6px rgba(15,23,42,0.08)`:'0 2px 8px rgba(15,23,42,0.05)',
                display:'flex',gap:0,overflow:'hidden',
              }}>
                {/* Borde izquierdo de color */}
                <div style={{width:4,flexShrink:0,background:c.accent,borderRadius:'12px 0 0 12px',alignSelf:'stretch',minHeight:52,margin:'-0px 12px 0px 0px'}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                    <div style={{fontFamily:MONO,fontWeight:800,fontSize:8,color:c.accent,letterSpacing:'0.18em'}}>{c.label}</div>
                    <div style={{fontFamily:MONO,fontWeight:700,fontSize:8,color:'#94a3b8'}}>DHW {(z.dhw??0).toFixed(1)}</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:800,color:'#0f172a',lineHeight:1.25,marginBottom:3}}>{z.nombre}</div>
                  <div style={{fontFamily:FONT_SANS,fontWeight:600,fontSize:9,color:'#94a3b8',marginBottom:6}}>{z.pais} · cobertura {z.cobertura}%</div>
                  {/* Barra DHW */}
                  <div style={{height:3,background:'rgba(15,23,42,0.08)',borderRadius:999,overflow:'hidden'}}>
                    <div style={{
                      height:'100%',width:`${dhwPct}%`,
                      background:`linear-gradient(90deg,${dhwColor}99,${dhwColor})`,
                      borderRadius:999,
                      transition:'width 0.6s ease',
                    }}/>
                  </div>
                </div>
              </button>
            )
          })}

          {tab==='pesca' && zonasPesca.map(z=>{
            const activo=pescaActiva?.id===z.id
            const zColor = z.estado?.color ?? '#0ea5e9'
            const dhwPct = Math.min(100, ((z.dhw??0)/12)*100)
            return(
              <button key={z.id} onClick={()=>abrirPesca(z)} className="reef-card" style={{
                width:'100%',textAlign:'left',padding:'12px 14px 12px 0',
                border:`1px solid ${activo?zColor+'55':'rgba(15,23,42,0.08)'}`,
                borderRadius:12, cursor:'pointer', marginBottom:7,
                background:activo?'rgba(255,255,255,0.97)':'rgba(255,255,255,0.68)',
                boxShadow:activo?`0 8px 24px ${zColor}28`:'0 2px 8px rgba(15,23,42,0.05)',
                display:'flex',overflow:'hidden',
              }}>
                <div style={{width:4,flexShrink:0,background:zColor,borderRadius:'12px 0 0 12px',alignSelf:'stretch',marginRight:12}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                    <div style={{fontFamily:MONO,fontWeight:800,fontSize:8,color:zColor,letterSpacing:'0.18em'}}>{z.estado?.label ?? '—'}</div>
                    <div style={{fontFamily:MONO,fontWeight:700,fontSize:8,color:'#94a3b8'}}>DHW {(z.dhw??0).toFixed(1)}</div>
                  </div>
                  <div style={{fontSize:13,fontWeight:800,color:'#0f172a',marginBottom:3}}>🎣 {z.nombre}</div>
                  <div style={{fontFamily:FONT_SANS,fontSize:9,color:'#94a3b8',marginBottom:6}}>{z.viento ?? '—'}</div>
                  <div style={{height:3,background:'rgba(15,23,42,0.08)',borderRadius:999,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${dhwPct}%`,background:`linear-gradient(90deg,${zColor}88,${zColor})`,borderRadius:999,transition:'width 0.6s ease'}}/>
                  </div>
                </div>
              </button>
            )
          })}

          {/* Carrusel debajo de la lista */}
          {zonaGuia&&(
            <div style={{
              margin:12,background:'rgba(241,245,249,0.92)',border:'1px solid rgba(255,255,255,0.55)',
              boxShadow:'0 18px 42px rgba(2,6,23,0.28)',padding:12,backdropFilter:'blur(18px)'
            }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:10,color:activeSlide.color,fontWeight:900,letterSpacing:'0.1em',textTransform:'uppercase'}}>{activeSlide.eyebrow}</div>
                  <div style={{fontSize:20,fontWeight:950,color:'#0f172a',letterSpacing:0,lineHeight:1.05}}>{activeSlide.title}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <button onClick={()=>setSlide((slide+slides.length-1)%slides.length)} style={{width:28,height:28,border:'1px solid rgba(15,23,42,0.12)',background:'rgba(255,255,255,0.72)',fontWeight:900,cursor:'pointer',color:'#0f172a'}}>‹</button>
                  <button onClick={()=>setSlide((slide+1)%slides.length)} style={{width:28,height:28,border:'1px solid rgba(15,23,42,0.12)',background:'rgba(255,255,255,0.72)',fontWeight:900,cursor:'pointer',color:'#0f172a'}}>›</button>
                </div>
              </div>

              {activeSlide.key==='salud'&&(
                <div style={{display:'grid',gap:8}}>
                  <DecisionCard label="Salud del coral hoy" value={`${saludHoy}%`} detail={`${textoSalud(saludHoy)} en ${zonaGuia.nombre}. DHW ${zonaGuia.dhw}.`} color={colorGuia}/>
                  <DecisionCard label="Pesca de hoy" value={decisionPesca} detail={detallePesca} color={colorGuia}/>
                </div>
              )}

              {activeSlide.key==='semana'&&(
                <div style={{display:'grid',gap:8}}>
                  <WeeklyChart zona={zonaGuia}/>
                  <div style={{fontSize:12,color:'#334155',fontWeight:700,lineHeight:1.55,background:'rgba(255,255,255,0.62)',border:'1px solid rgba(15,23,42,0.1)',padding:'9px 10px'}}>
                    {resumenProximosDias.slice(0,170)+(resumenProximosDias.length>170?'...':'')}
                  </div>
                </div>
              )}

              {activeSlide.key==='pesca'&&(
                <div style={{background:'rgba(248,250,252,0.84)',border:'1px solid rgba(15,23,42,0.12)',boxShadow:'0 12px 28px rgba(2,6,23,0.14)',padding:12}}>
                  <div style={{fontSize:14,fontWeight:800,color:'#0f172a',marginBottom:2}}>Zonas de pesca seguras</div>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:8}}>Ordenadas por menor estres termico</div>
                  <div style={{display:'flex',flexDirection:'column',gap:7}}>
                    {zonasSeguras.map(z=>(
                      <button key={z.id} onClick={()=>abrirPesca(z)} style={{
                        display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center',textAlign:'left',
                        background:'rgba(255,255,255,0.72)',border:'1px solid rgba(15,23,42,0.1)',padding:'8px 9px',cursor:'pointer'
                      }}>
                        <span>
                          <span style={{display:'block',fontSize:12,fontWeight:800,color:'#0f172a'}}>{z.nombre}</span>
                          <span style={{display:'block',fontSize:10,color:'#64748b'}}>Salir {extraerHorario(z.prediccion)}</span>
                        </span>
                        <span style={{fontFamily:MONO,fontSize:9,fontWeight:800,color:z.estado?.color,background:`${z.estado?.color}18`,padding:'5px 6px'}}>
                          DHW {z.dhw}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:10}}>
                <div style={{display:'flex',gap:6}}>
                  {slides.map((s,i)=>(
                    <button key={s.key} onClick={()=>setSlide(i)} aria-label={s.title} style={{
                      width:i===slide?22:7,height:7,borderRadius:999,border:'none',
                      background:i===slide?activeSlide.color:'rgba(15,23,42,0.22)',cursor:'pointer'
                    }}/>
                  ))}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,fontWeight:800,color:apiOnline?'#047857':'#92400e'}}>
                  <span style={{width:7,height:7,borderRadius:999,background:apiOnline?BRAND.plum:BRAND.sand}}/>
                  {apiOnline?'Datos en vivo':'Datos guardados'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer API status + botón Make */}
        <div style={{padding:'12px 16px',borderTop:'1px solid rgba(15,23,42,0.1)',background:'rgba(255,255,255,0.72)',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:apiOnline?BRAND.plum:BRAND.sand,display:'inline-block',animation:'blink 1.4s step-start infinite',boxShadow:`0 0 8px ${apiOnline?BRAND.plum:BRAND.sand}`}}/>
            <span style={{fontFamily:FONT_SANS,fontWeight:800,fontSize:10,color:apiOnline?BRAND.ink:'#92400e',letterSpacing:'0.15em'}}>
              {apiOnline?'API ONLINE':'CACHE LOCAL'}
            </span>
          </div>

          {/* Botón alerta Make */}
          <button
            onClick={enviarAlertaMake}
            disabled={alertaEstado==='sending'}
            style={{
              width:'100%', padding:'10px 0',
              background: alertaEstado==='ok'   ? '#dcfce7' :
                          alertaEstado==='error' ? '#fee2e2' :
                          alertaEstado==='sending'?'rgba(239,68,68,0.08)' :
                          'rgba(239,68,68,0.1)',
              border: `1.5px solid ${
                alertaEstado==='ok'    ? '#86efac' :
                alertaEstado==='error' ? '#fca5a5' : '#ef444466'}`,
              borderRadius:12, cursor: alertaEstado==='sending'?'wait':'pointer',
              fontFamily:FONT_SANS, fontWeight:800, fontSize:11,
              color: alertaEstado==='ok'   ? '#166534' :
                     alertaEstado==='error'? '#991b1b' : '#dc2626',
              letterSpacing:'0.06em',
              transition:'all 0.2s ease',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            }}>
            {alertaEstado==='sending' && <span style={{width:8,height:8,borderRadius:'50%',background:'#dc2626',animation:'blink 0.6s step-start infinite',display:'inline-block'}}/>}
            {alertaEstado==='ok'      ? '✅ Alertas enviadas'   :
             alertaEstado==='error'   ? '❌ Error al enviar'    :
             alertaEstado==='sending' ? 'Enviando...'           :
             '🚨 Alertar Pescadores'}
          </button>
        </div>
      </div>

      {/* ══ MAPA ══ */}
      <div style={{flex:1,minWidth:0,position:'relative'}}>
        <KoralioBadge/>
        <MapContainer center={[15.5,-85.0]} zoom={6} zoomControl={false} attributionControl={false}
          style={{width:'100%',height:'100%',background:BG0}}>
          <MapReady/>
          <CustomZoom/>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={18}/>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxZoom={18}/>
          {reefGeoJson&&<GeoJSON 
            key={JSON.stringify(zonasReales.map(z=>z.estado))}
            data={reefGeoJson} 
            style={(feature) => {
              if (!feature || !feature.geometry || !feature.geometry.coordinates) {
                return { color: BRAND.plum, fillColor: BRAND.plum, fillOpacity: 0.25, weight: 1.5 };
              }
              let coords = feature.geometry.coordinates;
              if (!Array.isArray(coords) || coords.length === 0) {
                return { color: BRAND.plum, fillColor: BRAND.plum, fillOpacity: 0.25, weight: 1.5 };
              }
              while (Array.isArray(coords[0])) {
                if (coords.length === 0) break;
                coords = coords[0];
              }
              if (coords.length < 2 || typeof coords[0] !== 'number') {
                return { color: BRAND.plum, fillColor: BRAND.plum, fillOpacity: 0.25, weight: 1.5 };
              }
              const [lng, lat] = coords;
              
              let closest = null;
              let minDist = Infinity;
              for (const z of zonasReales) {
                if (!z.coords) continue;
                const dist = Math.pow(z.coords[0] - lat, 2) + Math.pow(z.coords[1] - lng, 2);
                if (dist < minDist) { minDist = dist; closest = z; }
              }
              
              const color = closest && STATUS_COLORS[closest.estado] ? STATUS_COLORS[closest.estado] : BRAND.plum;
              return { color: color, fillColor: color, fillOpacity: 0.4, weight: 1.5 };
            }}
          />}

          {zonasPesca.map(z=>(
            <React.Fragment key={z.id}>
              <Circle center={z.coords} radius={z.radio} pathOptions={{
                color:z.estado?.color??'#06b6d4',fillColor:z.estado?.color??'#06b6d4',
                fillOpacity:z.estado?.permitida?0.06:0.15,weight:z.estado?.permitida?1:2,
                dashArray:z.estado?.permitida?'6 4':'2 4'}}/>
              <Marker position={z.coords} icon={createFishIcon(pescaActiva?.id===z.id)} eventHandlers={{click:()=>abrirPesca(z)}}/>
            </React.Fragment>
          ))}

          {/* ── Capa PFZ: frentes térmicos ── */}
          {pfzData?.dias?.[pfzDia]?.puntos_alta?.map((p,i)=>(
            <Circle key={`pfz-a-${pfzDia}-${i}`}
              center={[p.lat, p.lng]} radius={15000}
              pathOptions={{color:'#ef4444',fillColor:'#ef4444',fillOpacity:Math.min(0.45,p.intensidad*0.55),weight:0,stroke:false}}/>
          ))}
          {pfzData?.dias?.[pfzDia]?.puntos_media?.map((p,i)=>(
            <Circle key={`pfz-m-${pfzDia}-${i}`}
              center={[p.lat, p.lng]} radius={11000}
              pathOptions={{color:'#f97316',fillColor:'#fbbf24',fillOpacity:Math.min(0.3,p.intensidad*0.4),weight:0,stroke:false}}/>
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

        {/* ── PFZ Day Slider flotante ── */}
        {pfzData?.dias && (
          <div style={{
            position:'absolute', bottom:16, left:16, right:16,
            zIndex:1000,
            background:'rgba(6,17,30,0.92)', backdropFilter:'blur(18px)',
            border:'1px solid rgba(239,68,68,0.35)', borderRadius:14,
            padding:'10px 14px', boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
            animation:'fadeUp 0.3s ease',
          }}>
            {/* Header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,gap:8}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:'#ef4444',display:'inline-block',animation:'blink 1s step-start infinite',flexShrink:0}}/>
                <span style={{fontFamily:MONO,fontWeight:800,fontSize:8,color:'#ef4444',letterSpacing:'0.18em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {pfzData.zona ?? 'ZONA DE PESCA'}
                </span>
              </div>
              <span style={{fontFamily:MONO,fontSize:9,fontWeight:700,flexShrink:0,
                color: pfzDia===0 ? '#34d399' : '#f59e0b',
                background: pfzDia===0 ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)',
                border: `1px solid ${pfzDia===0?'rgba(52,211,153,0.35)':'rgba(245,158,11,0.35)'}`,
                padding:'2px 8px',borderRadius:5,whiteSpace:'nowrap'}}>
                {pfzDia===0 ? '📡 HOY' : `🔮 D+${pfzDia}`}
              </span>
            </div>

            {/* Slider */}
            <input type="range" min={0} max={7} step={1} value={pfzDia}
              onChange={e => setPfzDia(Number(e.target.value))}
              style={{width:'100%', accentColor:'#ef4444', cursor:'pointer', marginBottom:6, display:'block'}}
            />

            {/* Días como botones */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:3}}>
              {pfzData.dias.map((d, i) => {
                const nAlta = d?.resumen?.n_alta ?? 0
                const isActivo = i === pfzDia
                return (
                  <button key={i} onClick={() => setPfzDia(i)} style={{
                    padding:'4px 2px', border:'none', borderRadius:6, cursor:'pointer',
                    background: isActivo ? '#ef4444' : 'rgba(255,255,255,0.07)',
                    color: isActivo ? '#fff' : '#94a3b8',
                    fontFamily:MONO, fontSize:7, fontWeight:700, lineHeight:1.3,
                    transition:'all 0.15s',
                  }}>
                    <div>{i===0 ? 'HOY' : `D+${i}`}</div>
                    {nAlta > 0 && <div style={{opacity:0.75}}>{nAlta}p</div>}
                  </button>
                )
              })}
            </div>

            {/* Consejo del día */}
            {pfzData.dias[pfzDia]?.resumen?.consejo_pescador && (
              <div style={{marginTop:8,paddingTop:7,borderTop:'1px solid rgba(239,68,68,0.18)',
                fontFamily:FONT_SANS,fontSize:9,color:'#94a3b8',lineHeight:1.5}}>
                {pfzData.dias[pfzDia].resumen.consejo_pescador}
              </div>
            )}
          </div>
        )}

        {/* Carrusel sencillo para pescadores */}
        {false&&zonaGuia&&(
          <div style={{
            position:'absolute',top:16,left:16,zIndex:1000,width:'min(430px,calc(100% - 32px))',
            background:'rgba(241,245,249,0.82)',border:'1px solid rgba(255,255,255,0.55)',
            boxShadow:'0 24px 70px rgba(2,6,23,0.32)',padding:14,backdropFilter:'blur(18px)'
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:activeSlide.color,fontWeight:900,letterSpacing:'0.1em',textTransform:'uppercase'}}>{activeSlide.eyebrow}</div>
                <div style={{fontSize:23,fontWeight:950,color:'#0f172a',letterSpacing:0,lineHeight:1.05}}>{activeSlide.title}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <button onClick={()=>setSlide((slide+slides.length-1)%slides.length)} style={{width:30,height:30,border:'1px solid rgba(15,23,42,0.12)',background:'rgba(255,255,255,0.72)',fontWeight:900,cursor:'pointer',color:'#0f172a'}}>‹</button>
                <button onClick={()=>setSlide((slide+1)%slides.length)} style={{width:30,height:30,border:'1px solid rgba(15,23,42,0.12)',background:'rgba(255,255,255,0.72)',fontWeight:900,cursor:'pointer',color:'#0f172a'}}>›</button>
              </div>
            </div>

            {activeSlide.key==='salud'&&(
              <div style={{display:'grid',gap:10}}>
                <DecisionCard
                  label="Salud del coral hoy"
                  value={`${saludHoy}%`}
                  detail={`${textoSalud(saludHoy)} en ${zonaGuia.nombre}. DHW ${zonaGuia.dhw}.`}
                  color={colorGuia}
                />
                <DecisionCard
                  label="Pesca de hoy"
                  value={decisionPesca}
                  detail={detallePesca}
                  color={colorGuia}
                />
              </div>
            )}

            {activeSlide.key==='semana'&&(
              <div style={{display:'grid',gap:10}}>
                <WeeklyChart zona={zonaGuia}/>
                <div style={{fontSize:12,color:'#334155',fontWeight:700,lineHeight:1.55,background:'rgba(255,255,255,0.62)',border:'1px solid rgba(15,23,42,0.1)',padding:'10px 12px'}}>
                  {resumenProximosDias.slice(0,190)+(resumenProximosDias.length>190?'...':'')}
                </div>
              </div>
            )}

            {activeSlide.key==='pesca'&&(
              <div style={{background:'rgba(248,250,252,0.84)',border:'1px solid rgba(15,23,42,0.12)',boxShadow:'0 14px 36px rgba(2,6,23,0.16)',padding:14}}>
                <div style={{fontSize:14,fontWeight:800,color:'#0f172a',marginBottom:2}}>Zonas de pesca seguras</div>
                <div style={{fontSize:11,color:'#64748b',marginBottom:10}}>Ordenadas por menor estres termico</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {zonasSeguras.map(z=>(
                    <button key={z.id} onClick={()=>abrirPesca(z)} style={{
                      display:'grid',gridTemplateColumns:'1fr auto',gap:10,alignItems:'center',textAlign:'left',
                      background:'rgba(255,255,255,0.72)',border:'1px solid rgba(15,23,42,0.1)',padding:'9px 10px',cursor:'pointer'
                    }}>
                      <span>
                        <span style={{display:'block',fontSize:13,fontWeight:800,color:'#0f172a'}}>{z.nombre}</span>
                        <span style={{display:'block',fontSize:11,color:'#64748b'}}>Salir {extraerHorario(z.prediccion)}</span>
                      </span>
                      <span style={{fontFamily:MONO,fontSize:10,fontWeight:800,color:z.estado?.color,background:`${z.estado?.color}18`,padding:'5px 7px'}}>
                        DHW {z.dhw}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:12}}>
              <div style={{display:'flex',gap:6}}>
                {slides.map((s,i)=>(
                  <button key={s.key} onClick={()=>setSlide(i)} aria-label={s.title} style={{
                    width:i===slide?22:7,height:7,borderRadius:999,border:'none',
                    background:i===slide?activeSlide.color:'rgba(15,23,42,0.22)',cursor:'pointer'
                  }}/>
                ))}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,fontWeight:800,color:apiOnline?'#047857':'#92400e'}}>
                <span style={{width:7,height:7,borderRadius:999,background:apiOnline?'#10b981':'#f59e0b'}}/>
                {apiOnline?'Datos en vivo':'Datos guardados'}
              </div>
            </div>
          </div>
        )}

        {/* HUD coords */}
        <div style={{
          position:'absolute',bottom:16,left:16,zIndex:1000,
          background:'rgba(251,250,247,0.92)',backdropFilter:'blur(14px)',
          border:'1px solid rgba(43,20,84,0.14)',borderRadius:12,
          boxShadow:'0 14px 34px rgba(43,20,84,0.16)',
          padding:'8px 12px',fontFamily:FONT_DATA,fontWeight:800,fontSize:10,color:BRAND.ink
        }}>
          15.50°N · 85.00°W · Z6
        </div>

        {/* Leyenda */}
        <div style={{
          position:'absolute',top:16,right:16,zIndex:1000,
          background:'rgba(251,250,247,0.94)',backdropFilter:'blur(14px)',
          border:'1px solid rgba(43,20,84,0.14)',borderRadius:16,
          boxShadow:'0 18px 42px rgba(43,20,84,0.18)',
          padding:'16px'
        }}>
          <div style={{fontFamily:FONT_SANS,fontWeight:900,fontSize:9,color:BRAND.coral,letterSpacing:'0.25em',marginBottom:12}}>RIESGO DE BLANQUEAMIENTO</div>
          {Object.entries(STATUS_LABELS).map(([k,label])=>(
            <div key={k} style={{display:'flex',alignItems:'center',gap:10,fontFamily:FONT_SANS,fontWeight:800,fontSize:11,color:BRAND.ink,marginBottom:8}}>
              <span style={{width:11,height:11,borderRadius:'50%',background:STATUS_COLORS[k],boxShadow:`0 0 12px ${STATUS_COLORS[k]}66`,display:'inline-block',flexShrink:0}}/>
              {label}
            </div>
          ))}
          <div style={{borderTop:'1px solid rgba(43,20,84,0.12)',marginTop:10,paddingTop:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10,fontFamily:FONT_SANS,fontWeight:800,fontSize:11,color:BRAND.ink}}>
              <span style={{width:10,height:10,borderRadius:'50%',border:`2px dashed ${BRAND.magenta}`,display:'inline-block',flexShrink:0}}/>
              Zona de Pesca
            </div>
          </div>
        </div>

        {/* Panel flotante del gemelo digital: 3D arriba + datos completos abajo */}
        {zonaActiva && (
          <div ref={twinPanelRef} style={{
            position: 'absolute',
            top: twinPos.y,
            left: twinPos.x ?? undefined,
            right: twinPos.x == null ? 20 : 'auto',
            width: Math.min(twinWidth, window.innerWidth - 245),
            height: 'calc(100vh - 40px)',
            zIndex: 2000,
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(2,6,23,0.32), 0 8px 20px rgba(2,6,23,0.18)',
            background: 'rgba(241,245,249,0.9)',
            backdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.55)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div
              onMouseDown={(e)=>onTwinResizeStart(e, 'width')}
              title="Arrastra para cambiar el ancho"
              style={{
                position:'absolute',
                left:0,
                top:0,
                bottom:0,
                width:10,
                zIndex:35,
                cursor:'ew-resize',
                background:'linear-gradient(to right, rgba(52,211,153,0.28), transparent)',
              }}
            />
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              background: 'linear-gradient(to bottom, rgba(248,250,252,0.92), rgba(248,250,252,0))',
              cursor: 'move',
              userSelect: 'none',
              pointerEvents: 'auto',
            }} onMouseDown={onTwinDragStart}>
              <div style={{ pointerEvents: 'none' }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: cfgActiva?.accent ?? '#10b981', letterSpacing: '0.2em', marginBottom: 3, fontWeight: 900 }}>
                  GEMELO DIGITAL · ARRASTRA PARA MOVER
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  {zonaActiva.nombre}
                </div>
              </div>
              <div style={{display:'flex',gap:6,pointerEvents:'auto'}}>
                <button onClick={() => setInfoOculta(v => !v)} style={{
                  background: infoOculta ? `${cfgActiva?.accent ?? '#10b981'}22` : 'rgba(255,255,255,0.72)',
                  border: `1px solid ${cfgActiva?.accent ?? '#10b981'}44`,
                  color: cfgActiva?.accent ?? '#10b981',
                  padding: '5px 10px',
                  cursor: 'pointer',
                  fontFamily: MONO,
                  fontSize: 9,
                  letterSpacing: '0.12em',
                }}>{infoOculta ? 'MOSTRAR INFO' : 'OCULTAR INFO'}</button>
                <button onClick={() => {
                  setTwinPos({ x: null, y: 20 })
                  setInfoOculta(false)
                  setTwinWidth(760)
                  setInfoHeight(260)
                }} style={{
                  background: 'rgba(255,255,255,0.72)',
                  border: '1px solid rgba(15,23,42,0.12)',
                  color: '#334155',
                  padding: '5px 10px',
                  cursor: 'pointer',
                  fontFamily: MONO,
                  fontSize: 9,
                  letterSpacing: '0.12em',
                }}>RESET</button>
                <button onClick={() => setZonaActiva(null)} style={{
                  background: 'rgba(255,255,255,0.72)',
                  border: '1px solid rgba(15,23,42,0.12)',
                  color: '#334155',
                  padding: '5px 10px',
                  cursor: 'pointer',
                  fontFamily: MONO,
                  fontSize: 9,
                  letterSpacing: '0.12em',
                }}>CERRAR</button>
              </div>
            </div>
            <div style={{
              position: 'relative',
              width: '100%',
              height: infoOculta ? '100%' : `calc(100% - ${infoHeight + 12}px)`,
              minHeight: 0,
              flex: '0 0 auto',
              overflow: 'hidden',
              isolation: 'isolate',
              borderBottom: infoOculta ? 'none' : `1px solid ${cfgActiva?.accent ?? '#10b981'}33`,
            }}>
              <ReefViewer
                zone={zonaActiva.id}
                dhw={dhwVisual}
                baa={baaVisual}
                especies={zonaActiva.modelos ?? ESPECIES_POR_ZONA[zonaActiva.id] ?? especiesDesdeMetadata(zonaActiva)}
                cobertura={zonaActiva.cobertura}
                descripcion={zonaActiva.descripcion}
                showHud={false}
              />
            </div>

            {!infoOculta && (
              <div
                onMouseDown={(e)=>onTwinResizeStart(e, 'info')}
                title="Arrastra para subir o bajar la informacion"
                style={{
                  flex:'0 0 12px',
                  height:12,
                  cursor:'ns-resize',
                  borderTop:`1px solid ${cfgActiva?.accent ?? '#10b981'}55`,
                  borderBottom:'1px solid rgba(15,23,42,0.12)',
                  background:'linear-gradient(90deg, transparent, rgba(52,211,153,0.18), transparent)',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                }}
              >
                <div style={{width:54,height:2,background:`${cfgActiva?.accent ?? '#10b981'}88`}}/>
              </div>
            )}

            <div style={{
              flex: `0 0 ${infoHeight}px`,
              height: infoHeight,
              boxSizing: 'border-box',
              display: infoOculta ? 'none' : 'block',
              overflowY: 'auto',
              background: 'rgba(241,245,249,0.94)',
              borderTop: `1px solid ${cfgActiva?.accent ?? '#10b981'}33`,
              padding: '14px 16px 16px',
            }}>
              <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',marginBottom:12}}>
                <div>
                  <div style={{fontFamily:MONO,fontSize:8,color:cfgActiva?.accent ?? '#10b981',letterSpacing:'0.22em',marginBottom:4,fontWeight:900}}>
                    {zonaActiva.pais.toUpperCase()} · NOAA LIVE
                  </div>
                  <div style={{fontSize:20,fontWeight:900,color:'#0f172a',letterSpacing:'-0.02em',lineHeight:1.1}}>
                    {zonaActiva.nombre}
                  </div>
                </div>
                <div style={{
                  fontFamily:MONO,fontSize:9,padding:'5px 10px',
                  background:`${cfgActiva?.accent ?? '#10b981'}14`,
                  border:`1px solid ${cfgActiva?.accent ?? '#10b981'}44`,
                  color:cfgActiva?.accent ?? '#10b981',
                  letterSpacing:'0.16em',
                  whiteSpace:'nowrap',
                }}>
                  {cfgActiva?.label} · {zonaActiva.cobertura}% COB.
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'repeat(4, minmax(0, 1fr))',gap:4,marginBottom:14}}>
                <MetricBox label="COBERTURA" value={`${zonaActiva.cobertura}%`} color={cfgActiva?.accent ?? '#67e8f9'}/>
                <MetricBox label={`DHW D+${diaPrediccion}`} value={dhwVisual!=null?Number(dhwVisual).toFixed(1):'—'} color={dhwVisual>4?'#ef4444':dhwVisual>1?'#f59e0b':'#34d399'}/>
                <MetricBox label="SST" value={zonaActiva.sst!=null?`${zonaActiva.sst.toFixed(1)}°C`:'—'} color="#f97316"/>
                <MetricBox label="BAA" value={`${baaVisual}/4`} color="#38bdf8"/>
              </div>

              <Label>SIMULACION TEMPORAL KORALIO</Label>
              <div style={{borderLeft:`2px solid ${dhwVisual>4?'#ef4444':dhwVisual>1?'#f59e0b':'#34d399'}`,paddingLeft:10,marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:8}}>
                  <span style={{fontFamily:MONO,fontSize:9,color:'#cbd5e1',letterSpacing:'0.12em'}}>
                    DIA {diaPrediccion} · {puntoPrediccion?.fecha ?? 'HOY'}
                  </span>
                  <span style={{fontFamily:MONO,fontSize:8,color:'#64748b',letterSpacing:'0.12em'}}>
                    {loadingProyeccion?'CARGANDO NOAA/COPERNICUS':'NOAA 30D + COPERNICUS'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="7"
                  step="1"
                  value={diaPrediccion}
                  disabled={loadingProyeccion || proyeccionActiva.length === 0}
                  onChange={(e)=>setDiaPrediccion(Number(e.target.value))}
                  style={{width:'100%',accentColor:dhwVisual>4?'#ef4444':dhwVisual>1?'#f59e0b':'#34d399',cursor:'pointer'}}
                />
                <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:4,marginTop:6}}>
                  {Array.from({length:8},(_,i)=>(
                    <button key={i} onClick={()=>setDiaPrediccion(i)} disabled={proyeccionActiva.length===0} style={{
                      border:'none',
                      background:i===diaPrediccion?'rgba(52,211,153,0.18)':'rgba(15,23,42,0.7)',
                      color:i===diaPrediccion?'#a7f3d0':'#64748b',
                      fontFamily:MONO,
                      fontSize:8,
                      padding:'4px 0',
                      cursor:'pointer',
                    }}>D+{i}</button>
                  ))}
                </div>
              </div>

              {zonaActiva.viento&&(
                <div style={{fontFamily:MONO,fontSize:9,color:'#94a3b8',letterSpacing:'0.08em',marginBottom:12,borderLeft:'2px solid rgba(56,189,248,0.35)',paddingLeft:10}}>
                  Viento {zonaActiva.viento.direccion_cardinal} · {zonaActiva.viento.velocidad_kmh} km/h
                  {zonaActiva.fechaDatos&&<span style={{marginLeft:12,color:'#64748b'}}>datos {zonaActiva.fechaDatos}</span>}
                </div>
              )}

              <Label>ESPECIES REALES DEL ARRECIFE</Label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2, minmax(0, 1fr))',gap:'6px 12px',marginBottom:12}}>
                {(zonaActiva.especies??[]).slice(0,6).map((esp,i)=>(
                  <div key={esp} style={{borderLeft:`2px solid ${SP_COLORS[i%SP_COLORS.length]}`,paddingLeft:8}}>
                    <div style={{fontSize:11,color:'#e2e8f0',fontStyle:'italic',lineHeight:1.25}}>{esp}</div>
                    <div style={{height:2,background:'rgba(255,255,255,0.07)',marginTop:4}}>
                      <div style={{width:`${SP_PCT[i%SP_PCT.length]}%`,height:'100%',background:SP_COLORS[i%SP_COLORS.length]}}/>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{fontFamily:MONO,fontSize:10,color:'#cbd5e1',lineHeight:1.7,borderTop:B,paddingTop:10,marginBottom:12}}>
                {zonaActiva.descripcion}
              </div>

              {zonaActiva.predBlanqueamiento&&(
                <>
                  <Label>BLANQUEAMIENTO · PREDICCIÓN</Label>
                  <div style={{borderLeft:'2px solid rgba(239,68,68,0.45)',paddingLeft:10,fontFamily:MONO,fontSize:10,color:'#fecaca',lineHeight:1.75,marginBottom:12}}>
                    {zonaActiva.predBlanqueamiento}
                  </div>
                </>
              )}

              {zonaActiva.predPesca&&(
                <>
                  <Label>PESCA RESPONSABLE · HOY</Label>
                  <div style={{borderLeft:'2px solid rgba(52,211,153,0.45)',paddingLeft:10,fontFamily:MONO,fontSize:10,color:'#a7f3d0',lineHeight:1.75,marginBottom:12}}>
                    {zonaActiva.predPesca}
                  </div>
                </>
              )}

              <Label dark>ALERTA SATELITAL · AHORA</Label>
              {loadingPrediccion?(
                <div style={{display:'flex',alignItems:'center',gap:8,paddingLeft:10}}>
                  <span style={{width:5,height:5,background:'#6366f1',animation:'blink 0.8s step-start infinite',display:'inline-block'}}/>
                  <span style={{fontFamily:MONO,fontSize:9,color:'#6366f1',letterSpacing:'0.15em'}}>PROCESANDO DATOS NOAA...</span>
                </div>
              ):prediccionViva?.alerta&&(
                <div style={{borderLeft:'2px solid rgba(99,102,241,0.35)',paddingLeft:10,fontFamily:MONO,fontSize:10,color:'#334155',lineHeight:1.75}}>
                  <div style={{fontFamily:MONO,fontSize:8,color:'#64748b',letterSpacing:'0.18em',marginBottom:5}}>
                    COPERNICUS · {prediccionViva.temp!=null?`${prediccionViva.temp}°C · `:''}DHW {prediccionViva.dhw??'—'}
                  </div>
                  {prediccionViva.alerta}
                </div>
              )}
            </div>
          </div>
        )}
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
                  <ReefViewer zone={zonaActiva.id} dhw={zonaActiva.dhw != null ? zonaActiva.dhw : getDHWPorEstado(zonaActiva.estado)} baa={zonaActiva.baa_numeric}
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
                    <div style={{fontFamily:MONO,fontSize:8,color:'#94a3b8',letterSpacing:'0.15em',marginBottom:10,borderLeft:'2px solid rgba(148,163,184,0.4)',paddingLeft:8}}>
                      VIENTO {zonaActiva.viento.direccion_cardinal} {zonaActiva.viento.velocidad_kmh} km/h
                      {zonaActiva.fechaDatos&&<span style={{marginLeft:12,color:'#94a3b8'}}>NOAA {zonaActiva.fechaDatos}</span>}
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

                  {/* Predicciones de noaa.js (actualizadas diariamente) */}
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
                  <Label>ALERTA SATELITAL · AHORA</Label>
                  {loadingPrediccion?(
                    <div style={{display:'flex',alignItems:'center',gap:8,paddingLeft:10}}>
                      <span style={{width:5,height:5,background:'#6366f1',animation:'blink 0.8s step-start infinite',display:'inline-block'}}/>
                      <span style={{fontFamily:MONO,fontSize:9,color:'#6366f1',letterSpacing:'0.15em'}}>PROCESANDO DATOS NOAA...</span>
                    </div>
                  ):prediccionViva?.alerta&&(
                    <div style={{borderLeft:'2px solid rgba(99,102,241,0.4)',paddingLeft:10,fontFamily:MONO,fontSize:9,color:'#94a3b8',lineHeight:1.8}}>
                      <div style={{fontFamily:MONO,fontSize:7,color:'#64748b',letterSpacing:'0.2em',marginBottom:5}}>
                        NOAA · {prediccionViva.temp!=null?`${prediccionViva.temp}°C · `:''}DHW {prediccionViva.dhw??'—'}
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
                  <Label>ANÁLISIS SATELITAL · TIEMPO REAL</Label>
                  {loadingPrediccion?(
                    <div style={{borderLeft:'3px solid rgba(99,102,241,0.5)',paddingLeft:16,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:'#6366f1',animation:'blink 0.8s step-start infinite',display:'inline-block'}}/>
                      <span style={{fontFamily:FONT_SANS,fontSize:10,fontWeight:600,color:'#6366f1',letterSpacing:'0.15em'}}>PROCESANDO DATOS NOAA...</span>
                    </div>
                  ):prediccionViva?.alerta?(
                    <div style={{borderLeft:'3px solid rgba(14,165,233,0.5)',paddingLeft:16,fontFamily:FONT_SANS,fontSize:11,color:'#cbd5e1',lineHeight:1.8}}>
                      <div style={{fontFamily:FONT_SANS,fontSize:9,fontWeight:600,color:'#94a3b8',letterSpacing:'0.2em',marginBottom:6}}>
                        NOAA · {prediccionViva.temp!=null?`${prediccionViva.temp}°C · `:''}DHW {prediccionViva.dhw??'—'} · AHORA
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
                      <span style={{color:'#cbd5e1'}}>{pescaActiva.prediccion??pescaActiva.estado?.descripcion}</span>
                    </div>
                  )}

                  {/* Educación */}
                  <div style={{borderLeft:'3px solid rgba(14,165,233,0.3)',paddingLeft:16,fontFamily:FONT_SANS,fontSize:11,color:'#38bdf8',lineHeight:1.7}}>
                    🪸 DHW {pescaActiva.dhw} — {pescaActiva.dhw<1?'coral sano y produciendo larvas.':pescaActiva.dhw<4?'estrés leve. Pesca con cuidado.':pescaActiva.dhw<8?'coral sufre. Menos refugio = menos peces.':'coral blanquea. Pesquería afectada.'}
                  </div>

                  <Label>COMO SE VERA EN LOS PROXIMOS DIAS</Label>
                  <div style={{borderLeft:'2px solid rgba(251,191,36,0.35)',paddingLeft:12,fontSize:12,color:'#fde68a',lineHeight:1.65}}>
                    {pescaActiva.blanqueamiento}
                  </div>

                  {pescaActiva.alerta&&(
                    <div style={{borderLeft:'3px solid rgba(244,63,94,0.5)',paddingLeft:16,fontFamily:FONT_SANS,fontSize:11,color:'#fb7185',lineHeight:1.7}}>
                      ⚠️ {pescaActiva.alerta}
                    </div>
                  )}

                  {/* El slider PFZ está en el mapa (abajo) */}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700;800&display=swap');
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes slideIn{from{transform:translateX(30px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes sonar{0%{transform:scale(0.6);opacity:0.9}100%{transform:scale(2.8);opacity:0}}
        @keyframes sonar2{0%{transform:scale(0.6);opacity:0.7}100%{transform:scale(2.2);opacity:0}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 8px currentColor,0 0 16px currentColor}50%{box-shadow:0 0 18px currentColor,0 0 36px currentColor}}
        @keyframes fadeUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes dhwFill{from{width:0%}to{width:var(--dhw-pct)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        .wp-float{animation:float 2.8s ease-in-out infinite}
        .wp-float--activo{animation-duration:1.8s;animation-name:float}
        .reef-card{transition:transform 0.15s ease,box-shadow 0.15s ease}
        .reef-card:hover{transform:translateY(-1px)}
        .leaflet-popup-content-wrapper{background:transparent!important;box-shadow:none!important;padding:0!important;border-radius:0!important}
        .leaflet-popup-content{margin:0!important}
        .leaflet-popup-tip-container{display:none!important}
        .sonar-ring{position:absolute;border-radius:50%;pointer-events:none;animation:sonar 2s ease-out infinite}
        .sonar-ring2{position:absolute;border-radius:50%;pointer-events:none;animation:sonar 2s ease-out infinite 0.7s}
        .leaflet-control-zoom{display:none!important}
      `}</style>
    </div>
  )
}
